import { app } from "./src/app.ts";
import { PrismaClient } from "@prisma/client";
import jwt from "jsonwebtoken";
import "dotenv/config";
import http from 'http';

const prisma = new PrismaClient();

async function run() {
    const server = app.listen(0, async () => {
        try {
            const port = (server.address() as any).port;
            const user = await prisma.user.findFirst();
            const token = jwt.sign({ userId: user!.id }, process.env.JWT_SECRET || "super-secret-change-me", { expiresIn: "100y" });

            const body = {
                customerId: 1,
                warehouseId: 1,
                discountType: 'amount',
                discountValue: 0,
                items: [{ productId: 8, qty: 6 }],
                payments: [{ method: 'CASH', amount: 90000 }]
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
            console.log('Body:', await res.json());

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
