import { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/appError";

export const validate =
  <T>(schema: { parse: (data: unknown) => T }) =>
  (req: Request, _res: Response, next: NextFunction) => {
    try {
      schema.parse({
        body: req.body,
        params: req.params,
        query: req.query,
      });
      next();
    } catch (error) {
      next(error);
    }
  };

export const requireUser = (req: Request) => {
  if (!req.user) {
    throw new AppError("Unauthorized", 401);
  }
  return req.user;
};
