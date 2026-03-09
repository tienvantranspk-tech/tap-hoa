import { app } from "./src/app.ts";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import "dotenv/config";

const prisma = new PrismaClient();

async function run() {
  const server = app.listen(0, async () => {
    try {
      const port = (server.address() as any).port;
      const user = await prisma.user.findFirst();
      const token = jwt.sign({ userId: user!.id }, process.env.JWT_SECRET || "super-secret-change-me", { expiresIn: "100y" });

      const product = await prisma.product.findFirst({ include: { priceTier: true } });
      const wh = await prisma.warehouse.findFirst();

      // make sure stock exists
      await prisma.stockLedger.create({
        data: { productId: product!.id, warehouseId: wh!.id, qtyChange: 100, unitCost: product!.cost, refType: "TEST", refId: "12345" }
      });

      const unitPrice = product!.customPrice ?? product!.priceTier?.price ?? 0;
      const lineTotal = unitPrice * 6;

      const body = {
        customerId: (await prisma.customer.findFirst())!.id,
        warehouseId: wh!.id,
        discountType: 'amount',
        discountValue: 0,
        items: [{ productId: product!.id, qty: 6 }],
        payments: [{ method: 'CASH', amount: lineTotal }]
      };

      const res = await fetch(`http://localhost:${port}/api/sales/invoices`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
      });
      console.log('Status HTTP:', res.status);
      console.log('Body:', await res.text());

      server.close();
      await prisma.$disconnect();
    } catch (e) {
      console.error(e);
      server.close();
      await prisma.$disconnect();
    }
  });

}

run();
