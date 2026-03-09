import { PrismaClient } from "@prisma/client";
import { AUDIT_ACTIONS, STOCK_REF_TYPES } from "../../constants/domain";
import { prisma } from "../../db/prisma";
import { AppError } from "../../utils/appError";
import { nextDailyCode } from "../../utils/code";
import { getGlobalStockQty } from "../shared/stock";
import { createAuditLog } from "../shared/audit";

type DbLike = Pick<PrismaClient, "$transaction">;

export type CreatePurchaseReceiptInput = {
  supplierId: number;
  warehouseId: number;
  createdById: number;
  items: Array<{
    productId: number;
    qty: number;
    unitCost: number;
  }>;
};

export const createPurchaseReceipt = async (input: CreatePurchaseReceiptInput, db: DbLike = prisma) => {
  if (!input.items.length) {
    throw new AppError("Receipt items are empty", 400);
  }

  return db.$transaction(async (tx) => {
    const productIds = input.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw new AppError("Some products not found", 404);
    }

    const now = new Date();
    const datePrefix = `GRN-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const lastReceipt = await tx.purchaseReceipt.findFirst({
      where: { code: { startsWith: datePrefix } },
      orderBy: { code: "desc" },
    });
    const code = nextDailyCode("GRN", lastReceipt?.code ?? null, now);

    const lines = input.items.map((item) => {
      if (item.qty <= 0) {
        throw new AppError("Qty must be greater than 0", 400);
      }
      if (item.unitCost <= 0) {
        throw new AppError("Unit cost must be greater than 0", 400);
      }

      const lineCost = Math.round(item.qty * item.unitCost);
      return {
        ...item,
        lineCost,
      };
    });

    const totalCost = lines.reduce((sum, line) => sum + line.lineCost, 0);

    const receipt = await tx.purchaseReceipt.create({
      data: {
        code,
        supplierId: input.supplierId,
        warehouseId: input.warehouseId,
        totalCost,
        createdById: input.createdById,
        lines: {
          create: lines,
        },
      },
      include: {
        lines: { include: { product: true } },
        supplier: true,
        warehouse: true,
      },
    });

    for (const line of lines) {
      const product = products.find((item) => item.id === line.productId);
      if (!product) {
        continue;
      }

      const existingQty = await getGlobalStockQty(tx, line.productId);
      const newQty = existingQty + line.qty;
      const newCost =
        newQty <= 0 ? line.unitCost : (product.cost * existingQty + line.unitCost * line.qty) / newQty;

      await tx.product.update({
        where: { id: line.productId },
        data: {
          cost: Number(newCost.toFixed(2)),
        },
      });

      await tx.stockLedger.create({
        data: {
          productId: line.productId,
          warehouseId: input.warehouseId,
          qtyChange: line.qty,
          unitCost: line.unitCost,
          refType: STOCK_REF_TYPES.PURCHASE_RECEIPT,
          refId: String(receipt.id),
        },
      });
    }

    await createAuditLog(tx, {
      entity: "PurchaseReceipt",
      entityId: String(receipt.id),
      action: AUDIT_ACTIONS.CREATE,
      afterJson: receipt,
      createdById: input.createdById,
    });

    return receipt;
  }, { maxWait: 15000, timeout: 30000 });
};
