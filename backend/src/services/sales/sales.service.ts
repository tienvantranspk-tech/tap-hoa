import { prisma } from "../../db/prisma";
import { createSale, returnInvoiceItems, voidInvoice } from "./createSale";

export { createSale, returnInvoiceItems, voidInvoice };

export const listInvoices = async (query: {
  dateFrom?: Date;
  dateTo?: Date;
  status?: "COMPLETED" | "VOID";
  search?: string;
  page: number;
  pageSize: number;
}) => {
  const where = {
    ...(query.status ? { status: query.status } : {}),
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
            { customer: { name: { contains: query.search } } },
          ],
        }
      : {}),
  };

  const skip = (query.page - 1) * query.pageSize;

  const [total, items] = await Promise.all([
    prisma.salesInvoice.count({ where }),
    prisma.salesInvoice.findMany({
      where,
      include: {
        customer: true,
        warehouse: true,
        lines: { include: { product: { include: { priceTier: true } } } },
        payments: true,
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

export const getInvoiceForReceipt = async (id: number) => {
  return prisma.salesInvoice.findUnique({
    where: { id },
    include: {
      customer: true,
      warehouse: true,
      createdBy: { select: { id: true, email: true, fullName: true, role: true } },
      lines: {
        include: {
          product: true,
        },
      },
      payments: true,
    },
  });
};

