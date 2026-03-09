import { Router } from "express";
import { z } from "zod";
import { login } from "../../controllers/auth/auth.controller";
import { validate } from "../../middleware/validate";

const loginSchema = z.object({
  body: z.object({
    email: z.string().email(),
    password: z.string().min(6),
  }),
  params: z.object({}),
  query: z.object({}),
});

export const authRouter = Router();

authRouter.post("/login", validate(loginSchema), login);
