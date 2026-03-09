import { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { AppError } from "../utils/appError";
import { logger } from "../config/logger";

export const notFound = (_req: Request, _res: Response, next: NextFunction) => {
  next(new AppError("Route not found", 404));
};

export const errorHandler = (error: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (error instanceof ZodError) {
    const flat = error.flatten();
    const fieldErrors = flat.fieldErrors;
    const details = Object.entries(fieldErrors)
      .map(([key, msgs]) => `${key}: ${(msgs as string[]).join(", ")}`)
      .join("; ");
    return res.status(422).json({
      message: details ? `Validation error – ${details}` : "Validation error",
      errors: flat,
    });
  }

  if (error instanceof AppError) {
    return res.status(error.statusCode).json({
      message: error.message,
    });
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === "P2002") {
      return res.status(409).json({
        message: "Du lieu bi trung, vui long kiem tra lai.",
      });
    }
    if (error.code === "P2003") {
      return res.status(400).json({
        message: "Du lieu lien ket khong hop le hoac da bi xoa.",
      });
    }
    if (error.code === "P2025") {
      return res.status(404).json({
        message: "Khong tim thay du lieu yeu cau.",
      });
    }
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    return res.status(400).json({
      message: "Du lieu gui len khong hop le.",
    });
  }

  logger.error("Unhandled error", error);
  return res.status(500).json({
    message: "Internal server error",
  });
};
