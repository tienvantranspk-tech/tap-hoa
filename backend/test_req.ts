import "dotenv/config";
import { PrismaClient } from '@prisma/client';
import "dotenv/config";
import jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

async function run() {
  const user = await prisma.user.findFirst();
  const token = jwt.sign({ id: user!.id }, process.env.JWT_SECRET || "super-secret-change-me", { expiresIn: "100y" });

  const product = await prisma.product.findFirst({ include: { priceTier: true } });
  const qty = 1;
  const unitPrice = product!.customPrice ?? product!.priceTier?.price ?? 0;

  // ensure we have stock
  const wh = await prisma.warehouse.findFirst();
  await prisma.stockLedger.create({
    data: { productId: product!.id, warehouseId: wh!.id, qtyChange: 100, unitCost: product!.cost, refType: "TEST", refId: "123" }
  });

  const body = {
    customerId: (await prisma.customer.findFirst())!.id,
    warehouseId: wh!.id,
    discountType: 'amount',
    discountValue: 0,
    items: [{ productId: product!.id, qty }],
    payments: [{ method: 'CASH', amount: qty * unitPrice }]
  };

  const res = await fetch('http://localhost:4000/api/sales/invoices', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify(body)
  });
  console.log(res.status);
  const json = await res.json();
  console.log(json);
}

run().catch(console.error).finally(() => prisma.$disconnect());
