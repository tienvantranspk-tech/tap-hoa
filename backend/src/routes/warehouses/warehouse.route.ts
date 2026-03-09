import { Router } from "express";
import { z } from "zod";
import {
  getWarehouseStock,
  getWarehouses,
  postAdjust,
  postStockCount,
  postTransfer,
  postWarehouse,
  putWarehouse,
} from "../../controllers/warehouses/warehouse.controller";
import { authorize, ROLES } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const warehouseSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    location: z.string().optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

const updateWarehouseSchema = z.object({
  body: z.object({
    name: z.string().min(2).optional(),
    location: z.string().optional().nullable(),
  }),
  params: z.object({
    id: z.string(),
  }),
  query: z.object({}),
});

const transferSchema = z.object({
  body: z.object({
    fromWarehouseId: z.number().int(),
    toWarehouseId: z.number().int(),
    note: z.string().optional(),
    items: z.array(
      z.object({
        productId: z.number().int(),
        qty: z.number().int().positive(),
      })
    ),
  }),
  params: z.object({}),
  query: z.object({}),
});

const adjustSchema = z.object({
  body: z.object({
    warehouseId: z.number().int(),
    productId: z.number().int(),
    qtyChange: z.number().int().refine((v) => v !== 0),
    unitCost: z.number().nonnegative().optional(),
    note: z.string().optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

const stockCountSchema = z.object({
  body: z.object({
    warehouseId: z.number().int(),
    note: z.string().optional(),
    items: z.array(
      z.object({
        productId: z.number().int(),
        countedQty: z.number().int().nonnegative(),
      })
    ),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const warehouseRouter = Router();

warehouseRouter.get("/", getWarehouses);
warehouseRouter.get("/:id/stock", getWarehouseStock);
warehouseRouter.post("/", authorize(ROLES.ADMIN, ROLES.MANAGER), validate(warehouseSchema), postWarehouse);
warehouseRouter.put("/:id", authorize(ROLES.ADMIN, ROLES.MANAGER), validate(updateWarehouseSchema), putWarehouse);
warehouseRouter.post("/transfer", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE), validate(transferSchema), postTransfer);
warehouseRouter.post("/adjust", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE), validate(adjustSchema), postAdjust);
warehouseRouter.post(
  "/stock-count",
  authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE),
  validate(stockCountSchema),
  postStockCount
);
