import { PrismaClient } from "@prisma/client";
import { AUDIT_ACTIONS, STOCK_REF_TYPES } from "../../constants/domain";
import { prisma } from "../../db/prisma";
import { AppError } from "../../utils/appError";
import { nextDailyCode } from "../../utils/code";
import { getStockQty } from "../shared/stock";
import { createAuditLog } from "../shared/audit";

type DbLike = Pick<PrismaClient, "$transaction">;

export type TransferStockInput = {
  fromWarehouseId: number;
  toWarehouseId: number;
  createdById: number;
  note?: string;
  items: Array<{
    productId: number;
    qty: number;
  }>;
};

export const transferStock = async (input: TransferStockInput, db: DbLike = prisma) => {
  if (input.fromWarehouseId === input.toWarehouseId) {
    throw new AppError("From and to warehouse must be different", 400);
  }
  if (!input.items.length) {
    throw new AppError("Transfer items are empty", 400);
  }

  return db.$transaction(async (tx) => {
    const productIds = input.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });

    if (products.length !== productIds.length) {
      throw new AppError("Some products not found", 404);
    }

    for (const item of input.items) {
      if (item.qty <= 0) {
        throw new AppError("Qty must be greater than 0", 400);
      }

      const stockQty = await getStockQty(tx, item.productId, input.fromWarehouseId);
      if (stockQty < item.qty) {
        const product = products.find((entry) => entry.id === item.productId);
        throw new AppError(`Not enough stock for ${product?.name ?? item.productId}`, 400);
      }
    }

    const now = new Date();
    const datePrefix = `TRF-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const lastTransfer = await tx.stockTransfer.findFirst({
      where: { code: { startsWith: datePrefix } },
      orderBy: { code: "desc" },
    });
    const code = nextDailyCode("TRF", lastTransfer?.code ?? null, now);

    const transfer = await tx.stockTransfer.create({
      data: {
        code,
        fromWarehouseId: input.fromWarehouseId,
        toWarehouseId: input.toWarehouseId,
        createdById: input.createdById,
        note: input.note,
        lines: {
          create: input.items.map((item) => {
            const product = products.find((entry) => entry.id === item.productId);
            return {
              productId: item.productId,
              qty: item.qty,
              unitCost: product?.cost ?? 0,
            };
          }),
        },
      },
      include: {
        lines: true,
        fromWarehouse: true,
        toWarehouse: true,
      },
    });

    for (const item of input.items) {
      const product = products.find((entry) => entry.id === item.productId);
      const unitCost = product?.cost ?? 0;

      await tx.stockLedger.create({
        data: {
          productId: item.productId,
          warehouseId: input.fromWarehouseId,
          qtyChange: -item.qty,
          unitCost,
          refType: STOCK_REF_TYPES.TRANSFER_OUT,
          refId: String(transfer.id),
          note: input.note,
        },
      });

      await tx.stockLedger.create({
        data: {
          productId: item.productId,
          warehouseId: input.toWarehouseId,
          qtyChange: item.qty,
          unitCost,
          refType: STOCK_REF_TYPES.TRANSFER_IN,
          refId: String(transfer.id),
          note: input.note,
        },
      });
    }

    await createAuditLog(tx, {
      entity: "StockTransfer",
      entityId: String(transfer.id),
      action: AUDIT_ACTIONS.CREATE,
      afterJson: transfer,
      createdById: input.createdById,
    });

    return transfer;
  });
};
