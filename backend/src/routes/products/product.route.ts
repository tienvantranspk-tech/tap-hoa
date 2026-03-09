import { Router } from "express";
import { z } from "zod";
import {
  deleteProductById,
  getProductTierHistory,
  getProducts,
  postProduct,
  putProduct,
} from "../../controllers/products/product.controller";
import { authorize, ROLES } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const flexDateTime = z.string().refine(
  (val) => !isNaN(Date.parse(val)),
  { message: "Invalid date format" }
).transform((val) => new Date(val).toISOString());

const productBody = z.object({
  sku: z.string().min(2),
  barcode: z.string().min(3),
  name: z.string().min(2),
  unit: z.string().default("pcs"),
  priceTierId: z.number().int().optional().nullable(),
  customPrice: z.number().int().nonnegative().optional().nullable(),
  cost: z.number().nonnegative(),
  minStock: z.number().int().nonnegative(),
  active: z.boolean().optional(),
  promoPrice: z.number().int().nonnegative().optional().nullable(),
  promoStartAt: flexDateTime.optional().nullable(),
  promoEndAt: flexDateTime.optional().nullable(),
});

const createSchema = z.object({
  body: productBody.refine(
    (data) => data.priceTierId != null || data.customPrice != null,
    { message: "Phải chọn mức đồng giá hoặc nhập giá riêng", path: ["priceTierId"] }
  ),
  params: z.object({}),
  query: z.object({}),
});

const updateSchema = z.object({
  body: productBody.partial(),
  params: z.object({ id: z.string().regex(/^\d+$/) }),
  query: z.object({}),
});

export const productRouter = Router();

productRouter.get("/", getProducts);
productRouter.get("/:id/tier-history", getProductTierHistory);
productRouter.post("/", authorize(ROLES.ADMIN, ROLES.MANAGER), validate(createSchema), postProduct);
productRouter.put("/:id", authorize(ROLES.ADMIN, ROLES.MANAGER), validate(updateSchema), putProduct);
productRouter.delete("/:id", authorize(ROLES.ADMIN, ROLES.MANAGER), deleteProductById);

