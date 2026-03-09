import { PrismaClient } from '@prisma/client';
import { createSale } from './src/services/sales/createSale';

const prisma = new PrismaClient();

async function run() {
  const result = await createSale({
    customerId: 1,
    warehouseId: 1,
    discountType: 'amount',
    discountValue: 0,
    items: [{ productId: 1, qty: 6 }],
    payments: [{ method: 'CASH', amount: 90000 }],
    createdById: 1,
  }, prisma);
  console.log(result);
}
run()
  .catch((err) => { console.error("TEST_ERROR"); console.error(err); })
  .finally(async () => { await prisma.$disconnect(); });
