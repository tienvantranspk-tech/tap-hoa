import { AUDIT_ACTIONS, STOCK_REF_TYPES } from "../../constants/domain";
import { prisma } from "../../db/prisma";
import { AppError } from "../../utils/appError";
import { getStockQty } from "../shared/stock";
import { transferStock } from "./transferStock";
import { createAuditLog } from "../shared/audit";

export { transferStock };

export const listWarehouses = async () => {
  const warehouses = await prisma.warehouse.findMany({
    orderBy: { id: "asc" },
  });

  const stockByWarehouse = await prisma.stockLedger.groupBy({
    by: ["warehouseId"],
    _sum: { qtyChange: true },
  });

  const map = new Map(stockByWarehouse.map((item) => [item.warehouseId, item._sum.qtyChange ?? 0]));

  return warehouses.map((warehouse) => ({
    ...warehouse,
    stockQty: map.get(warehouse.id) ?? 0,
  }));
};

export const createWarehouse = async (input: { name: string; location?: string | null }) => {
  return prisma.warehouse.create({
    data: {
      name: input.name,
      location: input.location,
    },
  });
};

export const updateWarehouse = async (id: number, input: { name?: string; location?: string | null }) => {
  const existing = await prisma.warehouse.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Warehouse not found", 404);
  }
  return prisma.warehouse.update({
    where: { id },
    data: {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.location !== undefined ? { location: input.location } : {}),
    },
  });
};

export const getWarehouseStockItems = async (warehouseId: number) => {
  const grouped = await prisma.stockLedger.groupBy({
    by: ["productId"],
    where: { warehouseId },
    _sum: { qtyChange: true },
  });

  const productIds = grouped.map((item) => item.productId);
  const products = await prisma.product.findMany({
    where: { id: { in: productIds } },
    include: { priceTier: true },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));

  return grouped.map((item) => ({
    product: productMap.get(item.productId),
    qty: item._sum.qtyChange ?? 0,
  }));
};

export const adjustStock = async (input: {
  productId: number;
  warehouseId: number;
  qtyChange: number;
  unitCost?: number;
  note?: string;
  createdById: number;
}) => {
  if (!input.qtyChange) {
    throw new AppError("qtyChange cannot be zero", 400);
  }

  return prisma.$transaction(async (tx) => {
    const product = await tx.product.findUnique({ where: { id: input.productId } });
    if (!product) {
      throw new AppError("Product not found", 404);
    }

    const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse) {
      throw new AppError("Warehouse not found", 404);
    }

    if (input.qtyChange < 0) {
      const currentQty = await getStockQty(tx, input.productId, input.warehouseId);
      if (currentQty + input.qtyChange < 0) {
        throw new AppError("Adjustment would make stock negative", 400);
      }
    }

    const entry = await tx.stockLedger.create({
      data: {
        productId: input.productId,
        warehouseId: input.warehouseId,
        qtyChange: input.qtyChange,
        unitCost: input.unitCost ?? product.cost,
        refType: STOCK_REF_TYPES.STOCK_ADJUST,
        refId: `ADJ-${Date.now()}`,
        note: input.note,
      },
    });

    await createAuditLog(tx, {
      entity: "StockLedger",
      entityId: String(entry.id),
      action: AUDIT_ACTIONS.CREATE,
      afterJson: entry,
      createdById: input.createdById,
    });

    return entry;
  }, { maxWait: 15000, timeout: 30000 });
};

export const stockCount = async (input: {
  warehouseId: number;
  note?: string;
  createdById: number;
  items: Array<{ productId: number; countedQty: number }>;
}) => {
  if (!input.items.length) {
    throw new AppError("Count items are empty", 400);
  }

  return prisma.$transaction(async (tx) => {
    const warehouse = await tx.warehouse.findUnique({ where: { id: input.warehouseId } });
    if (!warehouse) {
      throw new AppError("Warehouse not found", 404);
    }

    const productIds = input.items.map((item) => item.productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
    });
    if (products.length !== productIds.length) {
      throw new AppError("Some products not found", 404);
    }

    const refId = `CNT-${Date.now()}-${input.warehouseId}`;
    const adjustments: Array<{ productId: number; beforeQty: number; countedQty: number; diffQty: number }> = [];

    for (const item of input.items) {
      if (item.countedQty < 0) {
        throw new AppError("Counted qty must be >= 0", 400);
      }

      const product = products.find((entry) => entry.id === item.productId);
      if (!product) {
        continue;
      }

      const currentQty = await getStockQty(tx, item.productId, input.warehouseId);
      const diffQty = item.countedQty - currentQty;

      if (!diffQty) {
        adjustments.push({
          productId: item.productId,
          beforeQty: currentQty,
          countedQty: item.countedQty,
          diffQty,
        });
        continue;
      }

      await tx.stockLedger.create({
        data: {
          productId: item.productId,
          warehouseId: input.warehouseId,
          qtyChange: diffQty,
          unitCost: product.cost,
          refType: STOCK_REF_TYPES.STOCK_ADJUST,
          refId,
          note: input.note || "Stock count",
        },
      });

      adjustments.push({
        productId: item.productId,
        beforeQty: currentQty,
        countedQty: item.countedQty,
        diffQty,
      });
    }

    await createAuditLog(tx, {
      entity: "StockCount",
      entityId: refId,
      action: AUDIT_ACTIONS.CREATE,
      createdById: input.createdById,
      afterJson: {
        warehouseId: input.warehouseId,
        note: input.note,
        adjustments,
      },
    });

    return {
      warehouseId: input.warehouseId,
      refId,
      adjustments,
      countedAt: new Date(),
    };
  }, { maxWait: 15000, timeout: 30000 });
};
