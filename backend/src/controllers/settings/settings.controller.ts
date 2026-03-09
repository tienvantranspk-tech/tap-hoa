import { NextFunction, Request, Response } from "express";
import {
  createCustomer,
  createPriceTier,
  createSupplier,
  createUser,
  deletePriceTier,
  listCustomers,
  listPriceTiers,
  listSuppliers,
  listUsers,
  updateCustomer,
  updatePriceTier,
  updateSupplier,
} from "../../services/settings/settings.service";

export const getPriceTiers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listPriceTiers());
  } catch (error) {
    next(error);
  }
};

export const postPriceTier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createPriceTier(req.body));
  } catch (error) {
    next(error);
  }
};

export const putPriceTier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updatePriceTier(Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
};

export const removePriceTier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await deletePriceTier(Number(req.params.id)));
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listUsers());
  } catch (error) {
    next(error);
  }
};

export const postUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createUser(req.body));
  } catch (error) {
    next(error);
  }
};

export const getCustomers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listCustomers());
  } catch (error) {
    next(error);
  }
};

export const postCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createCustomer(req.body));
  } catch (error) {
    next(error);
  }
};

export const putCustomer = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updateCustomer(Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
};

export const getSuppliers = async (_req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await listSuppliers());
  } catch (error) {
    next(error);
  }
};

export const postSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.status(201).json(await createSupplier(req.body));
  } catch (error) {
    next(error);
  }
};

export const putSupplier = async (req: Request, res: Response, next: NextFunction) => {
  try {
    res.json(await updateSupplier(Number(req.params.id), req.body));
  } catch (error) {
    next(error);
  }
};
