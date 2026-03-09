import { prisma } from "../../db/prisma";
import { AUDIT_ACTIONS } from "../../constants/domain";
import { AppError } from "../../utils/appError";
import { comparePassword } from "../../utils/password";
import { signToken } from "../../utils/jwt";
import { assertLoginAllowed, clearLoginAttempts, recordLoginFailure } from "./loginRateLimit";
import { createAuditLog } from "../shared/audit";

export const loginWithEmail = async (email: string, password: string, rateLimitKey: string) => {
  const rateLimit = assertLoginAllowed(rateLimitKey);
  if (!rateLimit.allowed) {
    throw new AppError(`Too many login attempts. Retry in ${rateLimit.retryAfterSeconds}s`, 429);
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    recordLoginFailure(rateLimitKey);
    throw new AppError("Invalid email or password", 401);
  }

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) {
    recordLoginFailure(rateLimitKey);
    throw new AppError("Invalid email or password", 401);
  }

  clearLoginAttempts(rateLimitKey);

  const token = signToken({
    userId: user.id,
    email: user.email,
    role: user.role,
  });

  await createAuditLog(prisma, {
    entity: "User",
    entityId: String(user.id),
    action: AUDIT_ACTIONS.LOGIN,
    createdById: user.id,
    afterJson: { email: user.email },
  });

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      fullName: user.fullName,
    },
  };
};
