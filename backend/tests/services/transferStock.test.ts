import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { transferStock } from "../../src/services/warehouses/transferStock";

describe("transferStock service", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-03T10:00:00.000Z"));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates transfer and two ledger entries per line", async () => {
    const tx = {
      product: {
        findMany: vi.fn().mockResolvedValue([{ id: 1, name: "SP1", cost: 7000 }]),
      },
      stockLedger: {
        aggregate: vi.fn().mockResolvedValue({ _sum: { qtyChange: 20 } }),
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
      stockTransfer: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({
          id: 5,
          code: "TRF-20260303-0001",
          lines: [],
          fromWarehouse: { id: 1 },
          toWarehouse: { id: 2 },
        }),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({ id: 1 }),
      },
    };

    const db = {
      $transaction: async (fn: (trx: typeof tx) => unknown) => fn(tx),
    };

    const result = await transferStock(
      {
        fromWarehouseId: 1,
        toWarehouseId: 2,
        createdById: 1,
        items: [{ productId: 1, qty: 5 }],
      },
      db as never
    );

    expect(result.code).toBe("TRF-20260303-0001");
    expect(tx.stockLedger.create).toHaveBeenCalledTimes(2);
    expect(tx.auditLog.create).toHaveBeenCalledTimes(1);
  });
});
