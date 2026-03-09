import { PrismaClient } from '@prisma/client';
import { createSale } from './src/services/sales/createSale';

const prisma = new PrismaClient();

async function run() {
  console.log("STARTING DIRECT TEST");
  try {
    const body = {
      customerId: 1,
      warehouseId: 1,
      discountType: 'amount' as const,
      discountValue: 0,
      items: [{ productId: 8, qty: 6 }],
      payments: [{ method: 'CASH' as const, amount: 90000 }]
    };
    await createSale({
      ...body,
      createdById: 1
    }, prisma as any);
    console.log('SUCCESS');
  } catch (e) {
    console.error('ERROR_THROWN:', e);
  } finally {
    await prisma.$disconnect();
  }
}
run();
