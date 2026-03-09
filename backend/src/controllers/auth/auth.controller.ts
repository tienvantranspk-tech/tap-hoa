import { Request, Response, NextFunction } from "express";
import { loginWithEmail } from "../../services/auth/auth.service";

export const login = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const email = req.body.email?.toString() ?? "";
    const ip = req.ip || "unknown";
    const rateLimitKey = `${email}:${ip}`;
    const result = await loginWithEmail(email, req.body.password, rateLimitKey);
    res.json(result);
  } catch (error) {
    next(error);
  }
};
