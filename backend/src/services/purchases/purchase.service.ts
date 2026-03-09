import { prisma } from "../../db/prisma";
import { createPurchaseReceipt } from "./createPurchaseReceipt";

export { createPurchaseReceipt };

export const listPurchaseReceipts = async (query: {
  dateFrom?: Date;
  dateTo?: Date;
  search?: string;
  page: number;
  pageSize: number;
}) => {
  const where = {
    ...(query.dateFrom || query.dateTo
      ? {
          createdAt: {
            ...(query.dateFrom ? { gte: query.dateFrom } : {}),
            ...(query.dateTo ? { lte: query.dateTo } : {}),
          },
        }
      : {}),
    ...(query.search
      ? {
          OR: [
            { code: { contains: query.search } },
            { supplier: { name: { contains: query.search } } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.pageSize;

  const [total, items] = await Promise.all([
    prisma.purchaseReceipt.count({ where }),
    prisma.purchaseReceipt.findMany({
      where,
      include: {
        supplier: true,
        warehouse: true,
        createdBy: { select: { id: true, email: true, role: true } },
        lines: {
          include: { product: true },
        },
      },
      orderBy: { createdAt: "desc" },
      skip,
      take: query.pageSize,
    }),
  ]);

  return {
    items,
    total,
    page: query.page,
    pageSize: query.pageSize,
    totalPages: Math.max(1, Math.ceil(total / query.pageSize)),
  };
};
