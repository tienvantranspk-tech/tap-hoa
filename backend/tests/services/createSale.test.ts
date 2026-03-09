import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createSale } from "../../src/services/sales/createSale";

describe("createSale service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates invoice and stock ledger entries", async () => {
    const tx = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 1,
            name: "Banh",
            active: true,
            cost: 6000,
            priceTier: { price: 10000 },
          },
        ]),
      },
      stockLedger: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { qtyChange: 30 } }),
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
      salesInvoice: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 99,
          code: "INV-20260303-0001",
          total: 18000,
          lines: [],
          payments: [],
          customer: { id: 1 },
          warehouse: { id: 1 },
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };

    const db = {
      $transaction: async (fn: (trx: typeof tx) => unknown) => fn(tx),
    };

    const result = await createSale(
      {
        customerId: 1,
        warehouseId: 1,
        discountType: "amount",
        discountValue: 2000,
        items: [{ productId: 1, qty: 2 }],
        payments: [{ method: "CASH", amount: 18000 }],
        createdById: 1,
      },
      db as never
    );

    expect(result.code).toBe("INV-20260303-0001");
    expect(tx.stockLedger.create).toHaveBeenCalledTimes(1);
    expect(tx.salesInvoice.create).toHaveBeenCalledTimes(1);
  });

  it("does not fail sale creation when audit log write fails", async () => {
    const tx = {
      product: {
        findMany: vi.fn().mockResolvedValue([
          {
            id: 1,
            name: "Banh",
            active: true,
            cost: 6000,
            priceTier: { price: 10000 },
          },
        ]),
      },
      stockLedger: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { qtyChange: 30 } }),
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
      salesInvoice: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 100,
          code: "INV-20260303-0002",
          total: 10000,
          lines: [],
          payments: [],
          customer: { id: 1 },
          warehouse: { id: 1 },
        }),
      },
      auditLog: {
        create: vi.fn().mockRejectedValue(new Error("audit unavailable")),
      },
    };

    const db = {
      $transaction: async (fn: (trx: typeof tx) => unknown) => fn(tx),
    };

    const result = await createSale(
      {
        customerId: 1,
        warehouseId: 1,
        discountType: "amount",
        discountValue: 0,
        items: [{ productId: 1, qty: 1 }],
        payments: [{ method: "CASH", amount: 10000 }],
        createdById: 1,
      },
      db as never
    );

    expect(result.id).toBe(100);
    expect(tx.salesInvoice.create).toHaveBeenCalledTimes(1);
  });
});
