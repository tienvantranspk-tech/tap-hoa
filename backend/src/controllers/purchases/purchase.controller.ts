import { NextFunction, Request, Response } from "express";
import { requireUser } from "../../middleware/validate";
import { createPurchaseReceipt, listPurchaseReceipts } from "../../services/purchases/purchase.service";

const parsePage = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
};

export const postPurchaseReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const receipt = await createPurchaseReceipt({
      ...req.body,
      createdById: user.id,
    });
    res.status(201).json(receipt);
  } catch (error) {
    next(error);
  }
};

export const getPurchaseReceipts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const receipts = await listPurchaseReceipts({
      search: req.query.search?.toString(),
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom.toString()) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo.toString()) : undefined,
      page: parsePage(req.query.page, 1),
      pageSize: parsePage(req.query.pageSize, 20),
    });
    res.json(receipts);
  } catch (error) {
    next(error);
  }
};
