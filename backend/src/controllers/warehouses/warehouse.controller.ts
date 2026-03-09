import { NextFunction, Request, Response } from "express";
import { requireUser } from "../../middleware/validate";
import {
  adjustStock,
  createWarehouse,
  updateWarehouse,
  getWarehouseStockItems,
  listWarehouses,
  stockCount,
  transferStock,
} from "../../services/warehouses/warehouse.service";

export const getWarehouses = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await listWarehouses();
    res.json(items);
  } catch (error) {
    next(error);
  }
};

export const postWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await createWarehouse(req.body);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const putWarehouse = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const item = await updateWarehouse(Number(req.params.id), req.body);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const postTransfer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const transfer = await transferStock({
      ...req.body,
      createdById: user.id,
    });
    res.status(201).json(transfer);
  } catch (error) {
    next(error);
  }
};

export const postAdjust = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const adjust = await adjustStock({
      ...req.body,
      createdById: user.id,
    });
    res.status(201).json(adjust);
  } catch (error) {
    next(error);
  }
};

export const postStockCount = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const result = await stockCount({
      ...req.body,
      createdById: user.id,
    });
    res.status(201).json(result);
  } catch (error) {
    next(error);
  }
};

export const getWarehouseStock = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const stock = await getWarehouseStockItems(Number(req.params.id));
    res.json(stock);
  } catch (error) {
    next(error);
  }
};
