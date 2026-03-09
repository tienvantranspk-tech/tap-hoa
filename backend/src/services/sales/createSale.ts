import { PrismaClient } from "@prisma/client";
import {
  AUDIT_ACTIONS,
  INVOICE_STATUSES,
  PAYMENT_METHODS,
  PaymentMethod,
  ROLES,
  Role,
  STOCK_REF_TYPES,
} from "../../constants/domain";
import { prisma } from "../../db/prisma";
import { AppError } from "../../utils/appError";
import { nextDailyCode } from "../../utils/code";
import { getStockQty } from "../shared/stock";
import { incurDebt } from "../debts/debt.service";
import { createAuditLog } from "../shared/audit";

type DbLike = Pick<PrismaClient, "$transaction">;

export type CreateSaleInput = {
  customerId: number;
  warehouseId: number;
  discountType: "percent" | "amount";
  discountValue: number;
  items: Array<{
    productId: number;
    qty: number;
  }>;
  payments: Array<{
    method: PaymentMethod;
    amount: number;
  }>;
  createdById: number;
};

const roundMoney = (value: number) => Math.round(value);

export const createSale = async (input: CreateSaleInput, db: DbLike = prisma) => {
  if (!input.items.length) {
    throw new AppError("Cart is empty", 400);
  }

  for (const payment of input.payments) {
    if (![PAYMENT_METHODS.CASH, PAYMENT_METHODS.BANK, PAYMENT_METHODS.DEBT].includes(payment.method)) {
      throw new AppError("Unsupported payment method", 400);
    }
  }

  return db.$transaction(async (tx) => {
    const products = await tx.product.findMany({
      where: {
        id: { in: input.items.map((item) => item.productId) },
        active: true,
      },
      include: { priceTier: true },
    });

    if (products.length !== input.items.length) {
      throw new AppError("Some products are unavailable", 400);
    }

    const productMap = new Map(products.map((product) => [product.id, product]));

    const lines = [] as Array<{
      productId: number;
      qty: number;
      unitPrice: number;
      unitCost: number;
      lineTotal: number;
    }>;

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new AppError(`Product ${item.productId} not found`, 400);
      }
      if (item.qty <= 0) {
        throw new AppError("Quantity must be greater than 0", 400);
      }

      const availableQty = await getStockQty(tx, item.productId, input.warehouseId);
      if (availableQty < item.qty) {
        throw new AppError(`Not enough stock for ${product.name}`, 400);
      }

      // Determine base unit price: customPrice or priceTier.price
      let unitPrice = product.customPrice ?? product.priceTier?.price ?? 0;
      const tNow = new Date();
      const isPromoActive =
        product.promoPrice != null &&
        (!product.promoStartAt || product.promoStartAt <= tNow) &&
        (!product.promoEndAt || product.promoEndAt >= tNow);

      if (isPromoActive) {
        unitPrice = product.promoPrice!;
      }

      const lineTotal = unitPrice * item.qty;
      lines.push({
        productId: item.productId,
        qty: item.qty,
        unitPrice,
        unitCost: product.cost,
        lineTotal,
      });
    }

    const subtotal = lines.reduce((sum, line) => sum + line.lineTotal, 0);
    const discount =
      input.discountType === "percent"
        ? roundMoney((subtotal * input.discountValue) / 100)
        : roundMoney(input.discountValue);
    const total = Math.max(0, subtotal - discount);

    const paymentTotal = input.payments.reduce((sum, payment) => sum + payment.amount, 0);
    if (paymentTotal !== total) {
      throw new AppError("Payment total must equal invoice total", 400);
    }

    const now = new Date();
    const datePrefix = `INV-${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    const lastInvoice = await tx.salesInvoice.findFirst({
      where: { code: { startsWith: datePrefix } },
      orderBy: { code: "desc" },
    });
    const code = nextDailyCode("INV", lastInvoice?.code ?? null, now);

    const invoice = await tx.salesInvoice.create({
      data: {
        code,
        customerId: input.customerId,
        warehouseId: input.warehouseId,
        subtotal,
        discount,
        total,
        status: INVOICE_STATUSES.COMPLETED,
        createdById: input.createdById,
        lines: {
          create: lines,
        },
        payments: {
          create: input.payments,
        },
      },
      include: {
        lines: { include: { product: true } },
        customer: true,
        warehouse: true,
        payments: true,
      },
    });

    // Handle DEBT payment
    const debtPayment = input.payments.find(p => p.method === PAYMENT_METHODS.DEBT);
    if (debtPayment && debtPayment.amount > 0) {
      await incurDebt(tx, {
        customerId: input.customerId,
        invoiceId: invoice.id,
        amount: debtPayment.amount,
        createdById: input.createdById,
      });
    }

    for (const line of lines) {
      await tx.stockLedger.create({
        data: {
          productId: line.productId,
          warehouseId: input.warehouseId,
          qtyChange: -line.qty,
          unitCost: line.unitCost,
          refType: STOCK_REF_TYPES.SALE,
          refId: String(invoice.id),
        },
      });
    }

    await createAuditLog(tx, {
      entity: "SalesInvoice",
      entityId: String(invoice.id),
      action: AUDIT_ACTIONS.CREATE,
      afterJson: invoice,
      createdById: input.createdById,
    });

    return invoice;
  }, { maxWait: 15000, timeout: 30000 });
};

export const voidInvoice = async (
  invoiceId: number,
  user: { id: number; role: Role },
  reason: string,
  db: DbLike = prisma
) => {
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.MANAGER) {
    throw new AppError("Only Admin/Manager can void invoice", 403);
  }

  return db.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findUnique({
      where: { id: invoiceId },
      include: { lines: true },
    });

    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }
    if (invoice.status === INVOICE_STATUSES.VOID) {
      throw new AppError("Invoice already voided", 400);
    }

    const updated = await tx.salesInvoice.update({
      where: { id: invoiceId },
      data: {
        status: INVOICE_STATUSES.VOID,
        voidReason: reason,
        voidedAt: new Date(),
      },
      include: { lines: true, payments: true, customer: true, warehouse: true },
    });

    for (const line of invoice.lines) {
      await tx.stockLedger.create({
        data: {
          productId: line.productId,
          warehouseId: invoice.warehouseId,
          qtyChange: line.qty,
          unitCost: line.unitCost,
          refType: STOCK_REF_TYPES.VOID_SALE,
          refId: String(invoice.id),
          note: reason,
        },
      });
    }

    await createAuditLog(tx, {
      entity: "SalesInvoice",
      entityId: String(invoice.id),
      action: AUDIT_ACTIONS.VOID,
      beforeJson: invoice,
      afterJson: updated,
      createdById: user.id,
    });

    return updated;
  }, { maxWait: 15000, timeout: 30000 });
};

export const returnInvoiceItems = async (
  input: {
    invoiceId: number;
    reason: string;
    items: Array<{ productId: number; qty: number }>;
  },
  user: { id: number; role: Role },
  db: DbLike = prisma
) => {
  if (user.role !== ROLES.ADMIN && user.role !== ROLES.MANAGER && user.role !== ROLES.CASHIER) {
    throw new AppError("Only Admin/Manager/Cashier can return items", 403);
  }

  if (!input.items.length) {
    throw new AppError("Return items are empty", 400);
  }

  return db.$transaction(async (tx) => {
    const invoice = await tx.salesInvoice.findUnique({
      where: { id: input.invoiceId },
      include: {
        lines: true,
      },
    });

    if (!invoice) {
      throw new AppError("Invoice not found", 404);
    }

    if (invoice.status !== INVOICE_STATUSES.COMPLETED) {
      throw new AppError("Only completed invoices can be returned", 400);
    }

    const lineMap = new Map<number, { soldQty: number; unitPrice: number; unitCost: number }>();

    for (const line of invoice.lines) {
      const existing = lineMap.get(line.productId);
      if (!existing) {
        lineMap.set(line.productId, {
          soldQty: line.qty,
          unitPrice: line.unitPrice,
          unitCost: line.unitCost,
        });
        continue;
      }

      lineMap.set(line.productId, {
        soldQty: existing.soldQty + line.qty,
        unitPrice: line.unitPrice,
        unitCost: line.unitCost,
      });
    }

    const returnedItems: Array<{ productId: number; qty: number; refundAmount: number }> = [];
    let refundAmount = 0;

    for (const item of input.items) {
      if (item.qty <= 0) {
        throw new AppError("Return qty must be greater than 0", 400);
      }

      const line = lineMap.get(item.productId);
      if (!line) {
        throw new AppError(`Product ${item.productId} not found in invoice`, 400);
      }

      const returnRefId = `${invoice.id}:${item.productId}`;
      const returnedAgg = await tx.stockLedger.aggregate({
        where: {
          productId: item.productId,
          warehouseId: invoice.warehouseId,
          refType: STOCK_REF_TYPES.SALE_RETURN,
          refId: returnRefId,
        },
        _sum: { qtyChange: true },
      });

      const alreadyReturned = returnedAgg._sum.qtyChange ?? 0;
      const remainingQty = line.soldQty - alreadyReturned;
      if (item.qty > remainingQty) {
        throw new AppError(`Return qty exceeds sold qty for product ${item.productId}`, 400);
      }

      await tx.stockLedger.create({
        data: {
          productId: item.productId,
          warehouseId: invoice.warehouseId,
          qtyChange: item.qty,
          unitCost: line.unitCost,
          refType: STOCK_REF_TYPES.SALE_RETURN,
          refId: returnRefId,
          note: input.reason,
        },
      });

      const lineRefund = item.qty * line.unitPrice;
      refundAmount += lineRefund;
      returnedItems.push({
        productId: item.productId,
        qty: item.qty,
        refundAmount: lineRefund,
      });
    }

    await createAuditLog(tx, {
      entity: "SalesInvoice",
      entityId: String(invoice.id),
      action: AUDIT_ACTIONS.UPDATE,
      createdById: user.id,
      afterJson: {
        type: "RETURN_ITEMS",
        reason: input.reason,
        returnedItems,
        refundAmount,
      },
    });

    return {
      invoiceId: invoice.id,
      reason: input.reason,
      refundAmount,
      items: returnedItems,
      returnedAt: new Date(),
    };
  }, { maxWait: 15000, timeout: 30000 });
};
