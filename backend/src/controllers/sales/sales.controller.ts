import { NextFunction, Request, Response } from "express";
import { requireUser } from "../../middleware/validate";
import {
  createSale,
  getInvoiceForReceipt,
  listInvoices,
  returnInvoiceItems,
  voidInvoice,
} from "../../services/sales/sales.service";

const parsePage = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
};

export const postSale = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const result = await createSale({
      ...req.body,
      createdById: user.id,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getSalesInvoices = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoices = await listInvoices({
      status: req.query.status ? (req.query.status.toString() as "COMPLETED" | "VOID") : undefined,
      search: req.query.search?.toString(),
      dateFrom: req.query.dateFrom ? new Date(req.query.dateFrom.toString()) : undefined,
      dateTo: req.query.dateTo ? new Date(req.query.dateTo.toString()) : undefined,
      page: parsePage(req.query.page, 1),
      pageSize: parsePage(req.query.pageSize, 20),
    });
    res.json(invoices);
  } catch (error) {
    next(error);
  }
};

export const postVoidInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const result = await voidInvoice(Number(req.params.id), user, req.body.reason ?? "Void by user");
    res.json(result);
  } catch (error) {
    next(error);
  }
};

export const postReturnInvoice = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const result = await returnInvoiceItems(
      {
        invoiceId: Number(req.params.id),
        reason: req.body.reason ?? "Customer return",
        items: req.body.items ?? [],
      },
      user
    );
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getReceipt = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const invoice = await getInvoiceForReceipt(Number(req.params.id));
    res.json(invoice);
  } catch (error) {
    next(error);
  }
};
