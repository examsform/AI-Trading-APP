import { describe, expect, it } from "vitest";
import { checkRateLimit } from "./rateLimit";

describe("rate limiter", () => {
  it("allows requests under the limit", () => {
    const key = "test-" + crypto.randomUUID();
    for (let i = 0; i < 5; i++) {
      const r = checkRateLimit(key, 10);
      expect(r.allowed).toBe(true);
    }
  });

  it("blocks requests once the limit is exceeded within the window", () => {
    const key = "test-" + crypto.randomUUID();
    for (let i = 0; i < 3; i++) checkRateLimit(key, 3);
    const blocked = checkRateLimit(key, 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.retryAfterMs).toBeGreaterThan(0);
  });

  it("tracks separate keys independently", () => {
    const keyA = "a-" + crypto.randomUUID();
    const keyB = "b-" + crypto.randomUUID();
    for (let i = 0; i < 3; i++) checkRateLimit(keyA, 3);
    const bResult = checkRateLimit(keyB, 3);
    expect(bResult.allowed).toBe(true);
  });
});
