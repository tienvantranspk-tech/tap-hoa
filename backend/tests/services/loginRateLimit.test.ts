import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

type RateLimitModule = typeof import("../../src/services/auth/loginRateLimit");

let rateLimit: RateLimitModule;

const key = "admin@donggia.local:127.0.0.1";

describe("loginRateLimit", () => {
  beforeEach(async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-06T00:00:00.000Z"));

    process.env.DATABASE_URL = "file:./test.db";
    process.env.JWT_SECRET = "test-secret-123";

    vi.resetModules();
    rateLimit = await import("../../src/services/auth/loginRateLimit");
    rateLimit.clearLoginAttempts(key);
  });

  afterEach(() => {
    rateLimit.clearLoginAttempts(key);
    vi.useRealTimers();
  });

  it("blocks after max attempts and allows again after clear", () => {
    expect(rateLimit.assertLoginAllowed(key).allowed).toBe(true);

    for (let i = 0; i < 5; i += 1) {
      rateLimit.recordLoginFailure(key);
    }

    const blocked = rateLimit.assertLoginAllowed(key);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterSeconds).toBeGreaterThan(0);

    rateLimit.clearLoginAttempts(key);
    expect(rateLimit.assertLoginAllowed(key).allowed).toBe(true);
  });
});
