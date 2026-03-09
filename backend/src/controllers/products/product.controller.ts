import { NextFunction, Request, Response } from "express";
import {
  createProduct,
  deactivateProduct,
  getProductPriceTierHistory,
  listProducts,
  updateProduct,
} from "../../services/products/product.service";
import { requireUser } from "../../middleware/validate";

const parsePage = (value: unknown, fallback: number) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }
  return Math.floor(parsed);
};

export const getProducts = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const items = await listProducts({
      search: req.query.search?.toString(),
      active: req.query.active ? req.query.active === "true" : undefined,
      priceTierId: req.query.priceTierId ? Number(req.query.priceTierId) : undefined,
      stockStatus: req.query.stockStatus ? (req.query.stockStatus.toString() as "LOW" | "OUT" | "IN") : undefined,
      page: parsePage(req.query.page, 1),
      pageSize: parsePage(req.query.pageSize, 20),
    });
    res.json(items);
  } catch (error) {
    next(error);
  }
};

export const postProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const item = await createProduct(req.body, user.id);
    res.status(201).json(item);
  } catch (error) {
    next(error);
  }
};

export const putProduct = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const item = await updateProduct(Number(req.params.id), req.body, user.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const deleteProductById = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = requireUser(req);
    const item = await deactivateProduct(Number(req.params.id), user.id);
    res.json(item);
  } catch (error) {
    next(error);
  }
};

export const getProductTierHistory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const history = await getProductPriceTierHistory(Number(req.params.id));
    res.json(history);
  } catch (error) {
    next(error);
  }
};
