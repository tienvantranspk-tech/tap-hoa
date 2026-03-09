import { env } from "../../config/env";

type AttemptInfo = {
  count: number;
  resetAt: number;
};

const attempts = new Map<string, AttemptInfo>();

const windowMs = env.LOGIN_RATE_LIMIT_WINDOW_MINUTES * 60 * 1000;

const normalizeKey = (key: string) => key.trim().toLowerCase();

const ensureRecord = (key: string) => {
  const now = Date.now();
  const normalized = normalizeKey(key);
  const record = attempts.get(normalized);

  if (!record || now >= record.resetAt) {
    const fresh = { count: 0, resetAt: now + windowMs };
    attempts.set(normalized, fresh);
    return fresh;
  }

  return record;
};

export const assertLoginAllowed = (key: string) => {
  const record = ensureRecord(key);
  if (record.count >= env.LOGIN_RATE_LIMIT_MAX_ATTEMPTS) {
    const retryAfterSeconds = Math.ceil((record.resetAt - Date.now()) / 1000);
    return {
      allowed: false,
      retryAfterSeconds,
    };
  }

  return { allowed: true, retryAfterSeconds: 0 };
};

export const recordLoginFailure = (key: string) => {
  const record = ensureRecord(key);
  record.count += 1;
};

export const clearLoginAttempts = (key: string) => {
  attempts.delete(normalizeKey(key));
};
