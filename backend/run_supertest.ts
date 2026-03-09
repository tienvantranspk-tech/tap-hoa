import { app } from "./src/app.ts";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import "dotenv/config";
import supertest from "supertest";

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

    const res = await supertest(app)
        .post('/api/sales/invoices')
        .set('Authorization', `Bearer ${token}`)
        .send(body);

    console.log('Status:', res.status);
    console.log('Body:', res.body);
}

run().finally(() => prisma.$disconnect());
