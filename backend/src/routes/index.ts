import { Router } from "express";
import { authenticate } from "../middleware/auth";
import { authRouter } from "./auth/auth.route";
import { debtRouter } from "./debts/debt.route";
import { productRouter } from "./products/product.route";
import { purchaseRouter } from "./purchases/purchase.route";
import { reportRouter } from "./reports/report.route";
import { salesRouter } from "./sales/sales.route";
import { settingsRouter } from "./settings/settings.route";
import { warehouseRouter } from "./warehouses/warehouse.route";

export const router = Router();

router.use("/auth", authRouter);
router.use(authenticate);
router.use("/products", productRouter);
router.use("/sales", salesRouter);
router.use("/purchases", purchaseRouter);
router.use("/warehouses", warehouseRouter);
router.use("/reports", reportRouter);
router.use("/settings", settingsRouter);
router.use("/debts", debtRouter);
