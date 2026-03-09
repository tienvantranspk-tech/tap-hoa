import { NextFunction, Request, Response } from "express";
import {
  closeShift,
  getShiftSummary,
  listAuditLogs,
  lowStockAlerts,
  profitByDate,
  profitByMonth,
  profitByYear,
  restockSuggestions,
  revenueSummary,
  topSellingProducts,
} from "../../services/reports/report.service";
import { requireUser } from "../../middleware/validate";

const parsePage = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
};

const parseDate = (value: unknown) => {
  if (!value) {
    return undefined;
  }
  const date = new Date(value.toString());
  if (Number.isNaN(date.getTime())) {
    return undefined;
  }
  return date;
};

const parsePeriod = (value: unknown, fallback: "day" | "week" | "month") => {
  const raw = value?.toString();
  if (raw === "day" || raw === "week" || raw === "month") {
    return raw;
  }
  return fallback;
};

export const getRevenueSummary = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = parsePeriod(req.query.period, "day");
    const data = await revenueSummary({
      period,
      dateFrom: parseDate(req.query.dateFrom),
      dateTo: parseDate(req.query.dateTo),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getTopProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 10;
    const period = parsePeriod(req.query.period, "month");
    const data = await topSellingProducts({
      period,
      limit,
      dateFrom: parseDate(req.query.dateFrom),
      dateTo: parseDate(req.query.dateTo),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getProfit = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const period = parsePeriod(req.query.period, "month");
    const data = await profitByDate({
      period,
      dateFrom: parseDate(req.query.dateFrom),
      dateTo: parseDate(req.query.dateTo),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getProfitByMonth = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await profitByMonth({
      dateFrom: parseDate(req.query.dateFrom),
      dateTo: parseDate(req.query.dateTo),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getProfitByYear = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await profitByYear({
      dateFrom: parseDate(req.query.dateFrom),
      dateTo: parseDate(req.query.dateTo),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getLowStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 100;
    const data = await lowStockAlerts(limit);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getRestockSuggestions = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const limit = req.query.limit ? Number(req.query.limit) : 50;
    const data = await restockSuggestions(limit);
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getAuditLogs = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const data = await listAuditLogs({
      entity: req.query.entity?.toString(),
      action: req.query.action?.toString(),
      createdById: req.query.createdById ? Number(req.query.createdById) : undefined,
      dateFrom: parseDate(req.query.dateFrom),
      dateTo: parseDate(req.query.dateTo),
      page: parsePage(req.query.page, 1),
      pageSize: parsePage(req.query.pageSize, 20),
    });
    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const getShiftReport = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const dateFrom = parseDate(req.query.dateFrom);
    const dateTo = parseDate(req.query.dateTo);
    if (!dateFrom || !dateTo) {
      res.status(400).json({ message: "dateFrom and dateTo are required" });
      return;
    }

    const data = await getShiftSummary({
      userId: req.query.userId ? Number(req.query.userId) : undefined,
      dateFrom,
      dateTo,
    });

    res.json(data);
  } catch (error) {
    next(error);
  }
};

export const postShiftClose = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const dateFrom = parseDate(req.body.dateFrom);
    const dateTo = parseDate(req.body.dateTo);

    if (!dateFrom || !dateTo) {
      res.status(400).json({ message: "dateFrom and dateTo are required" });
      return;
    }

    const data = await closeShift({
      userId: req.body.userId ? Number(req.body.userId) : undefined,
      dateFrom,
      dateTo,
      note: req.body.note,
      closedById: user.id,
    });

    res.status(201).json(data);
  } catch (error) {
    next(error);
  }
};
