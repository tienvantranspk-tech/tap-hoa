import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { createPurchaseReceipt } from "../../src/services/purchases/createPurchaseReceipt";

describe("createPurchaseReceipt service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates receipt, updates moving average cost and stock ledger", async () => {
    const tx = {
      product: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, cost: 5000 }]),
        update: vi.fn().mockResolvedValue({ id: 1, cost: 5500 }),
      },
      stockLedger: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { qtyChange: 10 } }),
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
      purchaseReceipt: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 8,
          code: "GRN-20260303-0001",
          lines: [],
          supplier: { id: 1 },
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

    const result = await createPurchaseReceipt(
      {
        supplierId: 1,
        warehouseId: 1,
        createdById: 1,
        items: [{ productId: 1, qty: 10, unitCost: 6000 }],
      },
      db as never
    );

    expect(result.code).toBe("GRN-20260303-0001");
    expect(tx.product.update).toHaveBeenCalledTimes(1);
    expect(tx.stockLedger.create).toHaveBeenCalledTimes(1);
  });
});
