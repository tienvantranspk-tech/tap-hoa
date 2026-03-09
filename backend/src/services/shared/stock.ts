import { Prisma } from "@prisma/client";

export const getStockQty = async (
  tx: Prisma.TransactionClient,
  productId: number,
  warehouseId: number
) => {
  const result = await tx.stockLedger.aggregate({
    where: { productId, warehouseId },
    _sum: { qtyChange: true },
  });
  return result._sum.qtyChange ?? 0;
};

export const getGlobalStockQty = async (tx: Prisma.TransactionClient, productId: number) => {
  const result = await tx.stockLedger.aggregate({
    where: { productId },
    _sum: { qtyChange: true },
  });
  return result._sum.qtyChange ?? 0;
};
