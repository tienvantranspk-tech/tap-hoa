import { Router } from "express";
import { z } from "zod";
import {
  getReceipt,
  getSalesInvoices,
  postReturnInvoice,
  postSale,
  postVoidInvoice,
} from "../../controllers/sales/sales.controller";
import { authorize, ROLES } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const createSaleSchema = z.object({
  body: z.object({
    customerId: z.number().int(),
    warehouseId: z.number().int(),
    discountType: z.enum(["percent", "amount"]),
    discountValue: z.number().nonnegative(),
    items: z.array(
      z.object({
        productId: z.number().int(),
        qty: z.number().int().positive(),
      })
    ),
    payments: z.array(
      z.object({
        method: z.enum(["CASH", "BANK", "DEBT"]),
        amount: z.number().int().nonnegative(),
      })
    ),
  }),
  params: z.object({}),
  query: z.object({}),
});

const voidSchema = z.object({
  body: z.object({ reason: z.string().min(2).optional() }),
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({}),
});

const returnSchema = z.object({
  body: z.object({
    reason: z.string().min(2).optional(),
    items: z.array(
      z.object({
        productId: z.number().int(),
        qty: z.number().int().positive(),
      })
    ),
  }),
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({}),
});

export const salesRouter = Router();

salesRouter.get("/invoices", getSalesInvoices);
salesRouter.get("/receipt/:id", getReceipt);
salesRouter.post("/invoices", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER), validate(createSaleSchema), postSale);
salesRouter.post("/invoices/:id/void", authorize(ROLES.ADMIN, ROLES.MANAGER), validate(voidSchema), postVoidInvoice);
salesRouter.post(
  "/invoices/:id/return",
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER),
  validate(returnSchema),
  postReturnInvoice
);
