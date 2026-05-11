import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { RateLimiter } from "../rate-limiter.js";

describe("RateLimiter", () => {
  let limiter: RateLimiter;

  beforeEach(() => {
    limiter = new RateLimiter();
  });

  afterEach(() => {
    limiter.stop();
  });

  it("allows requests under the limit", () => {
    const key = RateLimiter.buildKey("tenant", "user", "server", "tool");
    const result = limiter.check(key, 5);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
    expect(result.limit).toBe(5);
  });

  it("blocks requests at the limit", () => {
    const key = RateLimiter.buildKey("tenant", "user", "server", "tool");

    for (let i = 0; i < 3; i++) {
      const result = limiter.check(key, 3);
      expect(result.allowed).toBe(true);
    }

    const blocked = limiter.check(key, 3);
    expect(blocked.allowed).toBe(false);
    expect(blocked.current).toBe(3);
  });

  it("isolates different keys", () => {
    const key1 = RateLimiter.buildKey("t", "u", "s", "tool1");
    const key2 = RateLimiter.buildKey("t", "u", "s", "tool2");

    for (let i = 0; i < 3; i++) {
      limiter.check(key1, 3);
    }

    const result = limiter.check(key2, 3);
    expect(result.allowed).toBe(true);
    expect(result.current).toBe(1);
  });

  it("builds correct key format", () => {
    const key = RateLimiter.buildKey("tenant1", "user1", "myServer", "myTool");
    expect(key).toBe("tenant1:user1:myServer:myTool");
  });

  it("tracks current count accurately", () => {
    const key = "test:key";
    expect(limiter.check(key, 10).current).toBe(1);
    expect(limiter.check(key, 10).current).toBe(2);
    expect(limiter.check(key, 10).current).toBe(3);
  });

  it("start and stop are idempotent", () => {
    limiter.start();
    limiter.start(); // Should not throw
    limiter.stop();
    limiter.stop(); // Should not throw
  });
});
