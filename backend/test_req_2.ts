import { PrismaClient } from '@prisma/client';
import "dotenv/config";
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst();
  const token = jwt.sign({ id: user!.id }, process.env.JWT_SECRET || "super-secret-change-me", { expiresIn: "100y" });

  const body = {
    customerId: 1,
    warehouseId: 1,
    discountType: 'amount',
    discountValue: 0,
    items: [{ productId: 8, qty: 6 }],
    payments: [{ method: 'CASH', amount: 90000 }]
  };

  console.log("SENDING HTTP REQUEST");
  const res = await fetch('http://localhost:4000/api/sales/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  console.log('Status:', res.status);
  const json = await res.json();
  console.log('JSON:', json);

  console.log("DIRECT CALL");
  try {
    const { createSale } = await import('./src/services/sales/createSale.ts');
    const res2 = await createSale({
      ...body,
      discountType: 'amount' as any,
      createdById: user!.id
    }, prisma as any);
    console.log('DIRECT SUCCESS:', res2.id);
  } catch (e: any) {
    console.log('DIRECT FAIL:', e.name, e.message);
  }

}

run().catch(console.error).finally(() => prisma.$disconnect());
