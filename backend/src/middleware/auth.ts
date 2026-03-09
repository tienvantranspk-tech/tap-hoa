import { NextFunction, Request, Response } from "express";
import { ROLES, Role } from "../constants/domain";
import { prisma } from "../db/prisma";
import { verifyToken } from "../utils/jwt";
import { AppError } from "../utils/appError";

export const authenticate = async (req: Request, _res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return next(new AppError("Unauthorized", 401));
  }

  const token = authHeader.split(" ")[1];
  let payload: ReturnType<typeof verifyToken>;

  try {
    payload = verifyToken(token);
  } catch {
    return next(new AppError("Unauthorized", 401));
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: payload.userId },
      select: { id: true, email: true, role: true },
    });

    if (!user) {
      return next(new AppError("Unauthorized", 401));
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role as Role,
    };

    return next();
  } catch (error) {
    return next(error);
  }
};

export const authorize = (...roles: Role[]) => {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      return next(new AppError("Unauthorized", 401));
    }
    if (!roles.includes(req.user.role)) {
      return next(new AppError("Forbidden", 403));
    }
    return next();
  };
};

export { ROLES };
