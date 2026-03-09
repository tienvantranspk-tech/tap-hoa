import { Router } from "express";
import { z } from "zod";
import { getPurchaseReceipts, postPurchaseReceipt } from "../../controllers/purchases/purchase.controller";
import { authorize, ROLES } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const createReceiptSchema = z.object({
  body: z.object({
    supplierId: z.number().int(),
    warehouseId: z.number().int(),
    items: z.array(
      z.object({
        productId: z.number().int(),
        qty: z.number().int().positive(),
        unitCost: z.number().positive(),
      })
    ),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const purchaseRouter = Router();

purchaseRouter.get("/receipts", getPurchaseReceipts);
purchaseRouter.post("/receipts", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE), validate(createReceiptSchema), postPurchaseReceipt);

