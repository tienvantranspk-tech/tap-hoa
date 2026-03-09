import { Router } from "express";
import { z } from "zod";
import {
  getCustomers,
  getPriceTiers,
  getSuppliers,
  getUsers,
  postCustomer,
  postPriceTier,
  postSupplier,
  postUser,
  putCustomer,
  putPriceTier,
  putSupplier,
  removePriceTier,
} from "../../controllers/settings/settings.controller";
import { authorize, ROLES } from "../../middleware/auth";
import { validate } from "../../middleware/validate";

const priceTierSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    price: z.number().int().positive(),
  }),
  params: z.object({}),
  query: z.object({}),
});

const userSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
    fullName: z.string().optional(),
    role: z.enum(["ADMIN", "MANAGER", "CASHIER", "WAREHOUSE"]),
  }),
  params: z.object({}),
  query: z.object({}),
});

const personSchema = z.object({
  body: z.object({
    name: z.string().min(2),
    phone: z.string().optional(),
    address: z.string().optional(),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const settingsRouter = Router();

settingsRouter.get("/price-tiers", authorize(ROLES.ADMIN, ROLES.MANAGER), getPriceTiers);
settingsRouter.post("/price-tiers", authorize(ROLES.ADMIN), validate(priceTierSchema), postPriceTier);
settingsRouter.put("/price-tiers/:id", authorize(ROLES.ADMIN), putPriceTier);
settingsRouter.delete("/price-tiers/:id", authorize(ROLES.ADMIN), removePriceTier);

settingsRouter.get("/users", authorize(ROLES.ADMIN, ROLES.MANAGER), getUsers);
settingsRouter.post("/users", authorize(ROLES.ADMIN), validate(userSchema), postUser);

settingsRouter.get("/customers", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER), getCustomers);
settingsRouter.post("/customers", authorize(ROLES.ADMIN, ROLES.MANAGER), validate(personSchema), postCustomer);
settingsRouter.put("/customers/:id", authorize(ROLES.ADMIN, ROLES.MANAGER), validate(personSchema), putCustomer);

settingsRouter.get("/suppliers", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE), getSuppliers);
settingsRouter.post("/suppliers", authorize(ROLES.ADMIN, ROLES.MANAGER), validate(personSchema), postSupplier);
settingsRouter.put("/suppliers/:id", authorize(ROLES.ADMIN, ROLES.MANAGER), validate(personSchema), putSupplier);

