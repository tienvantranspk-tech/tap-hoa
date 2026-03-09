import { INVOICE_STATUSES } from "../../constants/domain";
import { prisma } from "../../db/prisma";
import { env } from "../../config/env";
import { AppError } from "../../utils/appError";

type Period = "day" | "week" | "month";

type ReportRangeInput = {
  period?: Period;
  dateFrom?: Date;
  dateTo?: Date;
};

const tzOffsetMs = env.REPORT_TZ_OFFSET_MINUTES * 60 * 1000;

const toTzTime = (date: Date) => new Date(date.getTime() + tzOffsetMs);
const fromTzTime = (date: Date) => new Date(date.getTime() - tzOffsetMs);

const toDateKey = (date: Date) => {
  const inTz = toTzTime(date);
  const y = inTz.getUTCFullYear();
  const m = String(inTz.getUTCMonth() + 1).padStart(2, "0");
  const d = String(inTz.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
};

const startOfTzDay = (date: Date) => {
  const inTz = toTzTime(date);
  const startInTz = new Date(Date.UTC(inTz.getUTCFullYear(), inTz.getUTCMonth(), inTz.getUTCDate(), 0, 0, 0, 0));
  return fromTzTime(startInTz);
};

const endOfTzDay = (date: Date) => {
  const inTz = toTzTime(date);
  const endInTz = new Date(Date.UTC(inTz.getUTCFullYear(), inTz.getUTCMonth(), inTz.getUTCDate(), 23, 59, 59, 999));
  return fromTzTime(endInTz);
};

const periodRange = (period: Period) => {
  const now = new Date();
  const startToday = startOfTzDay(now);

  if (period === "day") {
    return { from: startToday, to: now };
  }

  if (period === "month") {
    const todayInTz = toTzTime(now);
    const monthStartInTz = new Date(Date.UTC(todayInTz.getUTCFullYear(), todayInTz.getUTCMonth(), 1, 0, 0, 0, 0));
    return { from: fromTzTime(monthStartInTz), to: now };
  }

  const todayInTz = toTzTime(startToday);
  const weekDay = todayInTz.getUTCDay();
  const diffToMonday = weekDay === 0 ? 6 : weekDay - 1;
  const weekStartInTz = new Date(todayInTz);
  weekStartInTz.setUTCDate(weekStartInTz.getUTCDate() - diffToMonday);

  return {
    from: fromTzTime(weekStartInTz),
    to: now,
  };
};

const resolveRange = (input: ReportRangeInput) => {
  if (input.dateFrom || input.dateTo) {
    const from = input.dateFrom ? startOfTzDay(input.dateFrom) : periodRange("month").from;
    const to = input.dateTo ? endOfTzDay(input.dateTo) : new Date();

    if (from > to) {
      throw new AppError("dateFrom must be <= dateTo", 400);
    }

    return {
      period: input.period ?? "custom",
      from,
      to,
    };
  }

  const period = input.period ?? "day";
  const range = periodRange(period);
  return {
    period,
    ...range,
  };
};

export const revenueSummary = async (input: ReportRangeInput) => {
  const range = resolveRange(input);
  const invoiceWhere = {
    status: INVOICE_STATUSES.COMPLETED,
    createdAt: { gte: range.from, lte: range.to },
  };

  const [invoiceAgg, costRows] = await Promise.all([
    prisma.salesInvoice.aggregate({
      where: invoiceWhere,
      _sum: { total: true },
      _count: { _all: true },
    }),
    prisma.salesLine.findMany({
      where: {
        invoice: invoiceWhere,
      },
      select: {
        qty: true,
        unitCost: true,
      },
    }),
  ]);

  const estimatedCost = Math.round(costRows.reduce((sum, line) => sum + line.qty * line.unitCost, 0));
  const revenue = invoiceAgg._sum.total ?? 0;

  return {
    period: range.period,
    from: range.from,
    to: range.to,
    invoices: invoiceAgg._count._all,
    revenue,
    estimatedCost,
    estimatedProfit: Math.round(revenue - estimatedCost),
  };
};

export const topSellingProducts = async (input: ReportRangeInput & { limit?: number }) => {
  const range = resolveRange(input);
  const limit = Math.max(1, Math.min(100, input.limit ?? 10));

  const grouped = await prisma.salesLine.groupBy({
    by: ["productId"],
    where: {
      invoice: {
        status: INVOICE_STATUSES.COMPLETED,
        createdAt: { gte: range.from, lte: range.to },
      },
    },
    _sum: {
      qty: true,
      lineTotal: true,
    },
    orderBy: {
      _sum: {
        qty: "desc",
      },
    },
    take: limit,
  });

  if (!grouped.length) {
    return [];
  }

  const products = await prisma.product.findMany({
    where: { id: { in: grouped.map((item) => item.productId) } },
    include: { priceTier: true },
  });

  const productMap = new Map(products.map((product) => [product.id, product]));

  return grouped.map((item) => ({
    product: productMap.get(item.productId) ?? null,
    qty: item._sum.qty ?? 0,
    revenue: item._sum.lineTotal ?? 0,
  }));
};

export const profitByDate = async (input: ReportRangeInput) => {
  const range = resolveRange(input);
  const invoices = await prisma.salesInvoice.findMany({
    where: {
      status: INVOICE_STATUSES.COMPLETED,
      createdAt: { gte: range.from, lte: range.to },
    },
    include: { lines: true },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<string, { revenue: number; cost: number }>();

  for (const invoice of invoices) {
    const dateKey = toDateKey(invoice.createdAt);
    const current = map.get(dateKey) ?? { revenue: 0, cost: 0 };
    current.revenue += invoice.total;
    current.cost += invoice.lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
    map.set(dateKey, current);
  }

  return Array.from(map.entries()).map(([date, value]) => ({
    date,
    revenue: Math.round(value.revenue),
    cost: Math.round(value.cost),
    profit: Math.round(value.revenue - value.cost),
  }));
};

export const profitByMonth = async (input: ReportRangeInput) => {
  // Default: full current year
  const now = new Date();
  const defaultFrom = input.dateFrom ?? fromTzTime(new Date(Date.UTC(toTzTime(now).getUTCFullYear(), 0, 1)));
  const defaultTo = input.dateTo ?? now;
  const from = startOfTzDay(defaultFrom);
  const to = endOfTzDay(defaultTo);

  const invoices = await prisma.salesInvoice.findMany({
    where: {
      status: INVOICE_STATUSES.COMPLETED,
      createdAt: { gte: from, lte: to },
    },
    include: { lines: true },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<string, { revenue: number; cost: number }>();

  for (const invoice of invoices) {
    const inTz = toTzTime(invoice.createdAt);
    const monthKey = `${inTz.getUTCFullYear()}-${String(inTz.getUTCMonth() + 1).padStart(2, "0")}`;
    const current = map.get(monthKey) ?? { revenue: 0, cost: 0 };
    current.revenue += invoice.total;
    current.cost += invoice.lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
    map.set(monthKey, current);
  }

  return Array.from(map.entries()).map(([date, value]) => ({
    date,
    revenue: Math.round(value.revenue),
    cost: Math.round(value.cost),
    profit: Math.round(value.revenue - value.cost),
  }));
};

export const profitByYear = async (input: ReportRangeInput) => {
  // Default: last 5 years
  const now = new Date();
  const defaultFrom = input.dateFrom ?? fromTzTime(new Date(Date.UTC(toTzTime(now).getUTCFullYear() - 4, 0, 1)));
  const defaultTo = input.dateTo ?? now;
  const from = startOfTzDay(defaultFrom);
  const to = endOfTzDay(defaultTo);

  const invoices = await prisma.salesInvoice.findMany({
    where: {
      status: INVOICE_STATUSES.COMPLETED,
      createdAt: { gte: from, lte: to },
    },
    include: { lines: true },
    orderBy: { createdAt: "asc" },
  });

  const map = new Map<string, { revenue: number; cost: number }>();

  for (const invoice of invoices) {
    const inTz = toTzTime(invoice.createdAt);
    const yearKey = String(inTz.getUTCFullYear());
    const current = map.get(yearKey) ?? { revenue: 0, cost: 0 };
    current.revenue += invoice.total;
    current.cost += invoice.lines.reduce((sum, line) => sum + line.qty * line.unitCost, 0);
    map.set(yearKey, current);
  }

  return Array.from(map.entries()).map(([date, value]) => ({
    date,
    revenue: Math.round(value.revenue),
    cost: Math.round(value.cost),
    profit: Math.round(value.revenue - value.cost),
  }));
};

export const lowStockAlerts = async (limit = 100) => {
  const products = await prisma.product.findMany({
    where: { active: true },
    include: { priceTier: true },
  });

  if (!products.length) {
    return [];
  }

  const grouped = await prisma.stockLedger.groupBy({
    by: ["productId"],
    where: { productId: { in: products.map((product) => product.id) } },
    _sum: { qtyChange: true },
  });

  const stockMap = new Map(grouped.map((item) => [item.productId, item._sum.qtyChange ?? 0]));

  return products
    .map((product) => ({
      product,
      stockQty: stockMap.get(product.id) ?? 0,
    }))
    .filter((item) => item.stockQty <= item.product.minStock)
    .sort((a, b) => a.stockQty - b.stockQty)
    .slice(0, Math.max(1, Math.min(limit, 500)));
};

export const restockSuggestions = async (limit = 50) => {
  const lows = await lowStockAlerts(limit);

  return lows.map((item) => {
    const needed = Math.max(item.product.minStock - item.stockQty, 1);
    return {
      product: item.product,
      stockQty: item.stockQty,
      minStock: item.product.minStock,
      suggestedQty: needed,
      estimatedCost: Math.round(needed * item.product.cost),
    };
  });
};

export const listAuditLogs = async (query: {
  entity?: string;
  action?: string;
  createdById?: number;
  dateFrom?: Date;
  dateTo?: Date;
  page: number;
  pageSize: number;
}) => {
  const where = {
    ...(query.entity ? { entity: { contains: query.entity } } : {}),
    ...(query.action ? { action: { contains: query.action } } : {}),
    ...(query.createdById ? { createdById: query.createdById } : {}),
    ...(query.dateFrom || query.dateTo
      ? {
        createdAt: {
          ...(query.dateFrom ? { gte: query.dateFrom } : {}),
          ...(query.dateTo ? { lte: query.dateTo } : {}),
        },
      }
      : {}),
  };

  const skip = (query.page - 1) * query.pageSize;

  const [total, items] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: {
        createdBy: {
          select: {
            id: true,
            email: true,
            fullName: true,
            role: true,
          },
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

export const getShiftSummary = async (query: {
  userId?: number;
  dateFrom: Date;
  dateTo: Date;
}) => {
  const whereCompleted = {
    status: INVOICE_STATUSES.COMPLETED,
    createdAt: { gte: query.dateFrom, lte: query.dateTo },
    ...(query.userId ? { createdById: query.userId } : {}),
  };

  const [invoices, voidCount] = await Promise.all([
    prisma.salesInvoice.findMany({
      where: whereCompleted,
      include: {
        payments: true,
        createdBy: { select: { id: true, email: true, fullName: true, role: true } },
      },
    }),
    prisma.salesInvoice.count({
      where: {
        status: INVOICE_STATUSES.VOID,
        createdAt: { gte: query.dateFrom, lte: query.dateTo },
        ...(query.userId ? { createdById: query.userId } : {}),
      },
    }),
  ]);

  const paymentByMethod = invoices
    .flatMap((invoice) => invoice.payments)
    .reduce(
      (acc, payment) => {
        acc[payment.method] = (acc[payment.method] ?? 0) + payment.amount;
        return acc;
      },
      {} as Record<string, number>
    );

  const byUserMap = new Map<number, { user: any; invoices: number; revenue: number }>();
  for (const invoice of invoices) {
    const user = invoice.createdBy;
    const current = byUserMap.get(user.id) ?? { user, invoices: 0, revenue: 0 };
    current.invoices += 1;
    current.revenue += invoice.total;
    byUserMap.set(user.id, current);
  }

  return {
    from: query.dateFrom,
    to: query.dateTo,
    invoiceCount: invoices.length,
    voidCount,
    revenue: invoices.reduce((sum, invoice) => sum + invoice.total, 0),
    paymentByMethod,
    byUser: Array.from(byUserMap.values()),
  };
};

export const closeShift = async (input: {
  userId?: number;
  dateFrom: Date;
  dateTo: Date;
  note?: string;
  closedById: number;
}) => {
  const summary = await getShiftSummary({
    userId: input.userId,
    dateFrom: input.dateFrom,
    dateTo: input.dateTo,
  });

  await prisma.auditLog.create({
    data: {
      entity: "ShiftClose",
      entityId: `${input.userId ?? "ALL"}-${Date.now()}`,
      action: "CLOSE",
      createdById: input.closedById,
      afterJson: JSON.stringify({
        userId: input.userId,
        note: input.note,
        summary,
      }),
    },
  });

  return {
    ...summary,
    closedAt: new Date(),
    note: input.note,
  };
};
