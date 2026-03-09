import { Router } from "express";
import {
    getCustomersDebt,
    getCustomerDebtHistory,
    postDebtPayment,
    postDebtAdjust,
    putDebtLimit,
    getReminders,
} from "../../controllers/debts/debt.controller";
import { authorize, ROLES } from "../../middleware/auth";

export const debtRouter = Router();

// List all customers with debt summary
debtRouter.get("/", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER), getCustomersDebt);

// Get debt reminders (customers with outstanding debts)
debtRouter.get("/reminders", authorize(ROLES.ADMIN, ROLES.MANAGER), getReminders);

// Get debt transaction history for a customer
debtRouter.get("/:customerId/history", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER), getCustomerDebtHistory);

// Record a debt payment from customer
debtRouter.post("/:customerId/payment", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.CASHIER), postDebtPayment);

// Adjust debt (increase/decrease)
debtRouter.post("/:customerId/adjust", authorize(ROLES.ADMIN, ROLES.MANAGER), postDebtAdjust);

// Update customer debt limit
debtRouter.put("/:customerId/limit", authorize(ROLES.ADMIN, ROLES.MANAGER), putDebtLimit);
