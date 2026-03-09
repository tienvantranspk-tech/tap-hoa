import { prisma } from "../../db/prisma";
import { AUDIT_ACTIONS } from "../../constants/domain";
import { AppError } from "../../utils/appError";
import { createAuditLog } from "../shared/audit";

export type PaginationMeta = {
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
};

export type PaginatedResult<T> = {
  items: T[];
} & PaginationMeta;

export const listProducts = async (query: {
  search?: string;
  active?: boolean;
  priceTierId?: number;
  stockStatus?: "LOW" | "OUT" | "IN";
  page: number;
  pageSize: number;
}): Promise<PaginatedResult<any>> => {
  const where = {
    ...(query.search
      ? {
        OR: [
          { name: { contains: query.search } },
          { sku: { contains: query.search } },
          { barcode: { contains: query.search } },
        ],
      }
      : {}),
    ...(typeof query.active === "boolean" ? { active: query.active } : {}),
    ...(query.priceTierId ? { priceTierId: query.priceTierId } : {}),
  };

  const skip = (query.page - 1) * query.pageSize;

  const [total, products] = await Promise.all([
    prisma.product.count({ where }),
    prisma.product.findMany({
      where,
      include: { priceTier: true },
      orderBy: { id: "desc" },
      skip,
      take: query.pageSize,
    }),
  ]);

  if (!products.length) {
    return {
      items: [],
      total,
      page: query.page,
      pageSize: query.pageSize,
      totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
    };
  }

  const stock = await prisma.stockLedger.groupBy({
    by: ["productId"],
    where: { productId: { in: products.map((item) => item.id) } },
    _sum: { qtyChange: true },
  });

  const stockMap = new Map(stock.map((item) => [item.productId, item._sum.qtyChange ?? 0]));

  const withStock = products.map((product) => ({
    ...product,
    stockQty: stockMap.get(product.id) ?? 0,
  }));

  const filteredByStockStatus = withStock.filter((product) => {
    if (!query.stockStatus) {
      return true;
    }
    if (query.stockStatus === "OUT") {
      return product.stockQty <= 0;
    }
    if (query.stockStatus === "LOW") {
      return product.stockQty <= product.minStock;
    }
    return product.stockQty > product.minStock;
  });

  return {
    items: filteredByStockStatus,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
};

export const createProduct = async (
  input: {
    sku: string;
    barcode: string;
    name: string;
    unit: string;
    priceTierId?: number | null;
    customPrice?: number | null;
    cost: number;
    minStock: number;
    active?: boolean;
    promoPrice?: number | null;
    promoStartAt?: string | null;
    promoEndAt?: string | null;
  },
  createdById: number
) => {
  const product = await prisma.product.create({
    data: {
      sku: input.sku,
      barcode: input.barcode,
      name: input.name,
      unit: input.unit,
      priceTierId: input.priceTierId ?? undefined,
      customPrice: input.customPrice ?? undefined,
      cost: input.cost,
      minStock: input.minStock,
      active: input.active ?? true,
      promoPrice: input.promoPrice ?? undefined,
      promoStartAt: input.promoStartAt ? new Date(input.promoStartAt) : null,
      promoEndAt: input.promoEndAt ? new Date(input.promoEndAt) : null,
    },
  });

  await createAuditLog(prisma, {
    entity: "Product",
    entityId: String(product.id),
    action: AUDIT_ACTIONS.CREATE,
    afterJson: product,
    createdById,
  });

  return product;
};

export const updateProduct = async (
  id: number,
  input: Partial<{
    sku: string;
    barcode: string;
    name: string;
    unit: string;
    priceTierId: number | null;
    customPrice: number | null;
    cost: number;
    minStock: number;
    active: boolean;
    promoPrice?: number | null;
    promoStartAt?: string | null;
    promoEndAt?: string | null;
  }>,
  updatedById: number
) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Product not found", 404);
  }

  const updateData: Record<string, unknown> = {};
  if (input.sku !== undefined) updateData.sku = input.sku;
  if (input.barcode !== undefined) updateData.barcode = input.barcode;
  if (input.name !== undefined) updateData.name = input.name;
  if (input.unit !== undefined) updateData.unit = input.unit;
  if (input.cost !== undefined) updateData.cost = input.cost;
  if (input.minStock !== undefined) updateData.minStock = input.minStock;
  if (input.active !== undefined) updateData.active = input.active;
  if (input.promoPrice !== undefined) updateData.promoPrice = input.promoPrice;
  if (input.promoStartAt !== undefined) updateData.promoStartAt = input.promoStartAt ? new Date(input.promoStartAt) : null;
  if (input.promoEndAt !== undefined) updateData.promoEndAt = input.promoEndAt ? new Date(input.promoEndAt) : null;
  if (input.priceTierId !== undefined) updateData.priceTierId = input.priceTierId;
  if (input.customPrice !== undefined) updateData.customPrice = input.customPrice;

  const product = await prisma.product.update({
    where: { id },
    data: updateData,
  });

  if (input.priceTierId && existing.priceTierId && input.priceTierId !== existing.priceTierId) {
    await prisma.productPriceTierHistory.create({
      data: {
        productId: id,
        oldPriceTierId: existing.priceTierId,
        newPriceTierId: input.priceTierId,
        changedById: updatedById,
      },
    });

    await createAuditLog(prisma, {
      entity: "Product",
      entityId: String(product.id),
      action: AUDIT_ACTIONS.PRICE_TIER_CHANGE,
      beforeJson: { priceTierId: existing.priceTierId },
      afterJson: { priceTierId: input.priceTierId },
      createdById: updatedById,
    });
  }

  await createAuditLog(prisma, {
    entity: "Product",
    entityId: String(product.id),
    action: AUDIT_ACTIONS.UPDATE,
    beforeJson: existing,
    afterJson: product,
    createdById: updatedById,
  });

  return product;
};

export const deactivateProduct = async (id: number, updatedById: number) => {
  const existing = await prisma.product.findUnique({ where: { id } });
  if (!existing) {
    throw new AppError("Product not found", 404);
  }

  const product = await prisma.product.update({
    where: { id },
    data: { active: false },
  });

  await createAuditLog(prisma, {
    entity: "Product",
    entityId: String(product.id),
    action: AUDIT_ACTIONS.DELETE,
    beforeJson: existing,
    afterJson: product,
    createdById: updatedById,
  });

  return product;
};

export const getProductPriceTierHistory = async (productId: number) => {
  return prisma.productPriceTierHistory.findMany({
    where: { productId },
    include: {
      oldPriceTier: true,
      newPriceTier: true,
      changedBy: {
        select: { id: true, email: true, role: true },
      },
    },
    orderBy: { changedAt: "desc" },
  });
};
