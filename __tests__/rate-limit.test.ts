import { describe, expect, test } from "vitest";
import { createRateLimiter } from "../lib/rate-limit";

const WINDOW_MS = 60_000;

function failTimes(limiter: ReturnType<typeof createRateLimiter>, key: string, times: number, now = 0) {
  for (let i = 0; i < times; i++) limiter.recordFailure(key, now);
}

describe("createRateLimiter", () => {
  test("Should_NotBlock_When_FailuresAreUnderTheLimit", () => {
    const limiter = createRateLimiter(10, WINDOW_MS);

    failTimes(limiter, "1.1.1.1", 9);

    expect(limiter.isBlocked("1.1.1.1", 0)).toBe(false);
  });

  test("Should_Block_When_LimitIsReached", () => {
    const limiter = createRateLimiter(10, WINDOW_MS);

    failTimes(limiter, "1.1.1.1", 10);

    expect(limiter.isBlocked("1.1.1.1", 0)).toBe(true);
  });

  test("Should_StayBlocked_When_WindowHasNotEnded", () => {
    const limiter = createRateLimiter(10, WINDOW_MS);

    failTimes(limiter, "1.1.1.1", 10);

    expect(limiter.isBlocked("1.1.1.1", WINDOW_MS - 1)).toBe(true);
  });

  test("Should_ResetCounter_When_WindowHasEnded", () => {
    const limiter = createRateLimiter(10, WINDOW_MS);
    failTimes(limiter, "1.1.1.1", 10);

    expect(limiter.isBlocked("1.1.1.1", WINDOW_MS)).toBe(false);
    failTimes(limiter, "1.1.1.1", 9, WINDOW_MS);
    expect(limiter.isBlocked("1.1.1.1", WINDOW_MS)).toBe(false);
  });

  test("Should_CountEachIpSeparately_When_AnotherIpIsBlocked", () => {
    const limiter = createRateLimiter(10, WINDOW_MS);

    failTimes(limiter, "1.1.1.1", 10);

    expect(limiter.isBlocked("2.2.2.2", 0)).toBe(false);
  });
});
