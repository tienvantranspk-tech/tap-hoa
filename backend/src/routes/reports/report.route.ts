import { Router } from "express";
import {
  getAuditLogs,
  getLowStock,
  getProfit,
  getProfitByMonth,
  getProfitByYear,
  getRestockSuggestions,
  getRevenueSummary,
  getShiftReport,
  getTopProducts,
  postShiftClose,
} from "../../controllers/reports/report.controller";
import { authorize, ROLES } from "../../middleware/auth";

export const reportRouter = Router();

reportRouter.get("/summary", authorize(ROLES.ADMIN, ROLES.MANAGER), getRevenueSummary);
reportRouter.get("/top-products", authorize(ROLES.ADMIN, ROLES.MANAGER), getTopProducts);
reportRouter.get("/profit", authorize(ROLES.ADMIN, ROLES.MANAGER), getProfit);
reportRouter.get("/profit-by-month", authorize(ROLES.ADMIN, ROLES.MANAGER), getProfitByMonth);
reportRouter.get("/profit-by-year", authorize(ROLES.ADMIN, ROLES.MANAGER), getProfitByYear);
reportRouter.get("/low-stock", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE), getLowStock);
reportRouter.get("/restock-suggestions", authorize(ROLES.ADMIN, ROLES.MANAGER, ROLES.WAREHOUSE), getRestockSuggestions);
reportRouter.get("/audit-logs", authorize(ROLES.ADMIN, ROLES.MANAGER), getAuditLogs);
reportRouter.get("/shift-summary", authorize(ROLES.ADMIN, ROLES.MANAGER), getShiftReport);
reportRouter.post("/shift-close", authorize(ROLES.ADMIN, ROLES.MANAGER), postShiftClose);
