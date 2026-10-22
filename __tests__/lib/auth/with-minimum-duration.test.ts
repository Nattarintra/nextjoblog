import { describe, expect, it, vi } from "vitest";

import { withMinimumDuration } from "@/lib/auth/with-minimum-duration";

function createClock(start = 1_000) {
  let current = start;
  return {
    now: () => current,
    sleep: vi.fn(async (milliseconds: number) => {
      current += milliseconds;
    }),
  };
}

describe("withMinimumDuration", () => {
  it("waits for the remaining duration when work is faster", async () => {
    const clock = createClock();

    await expect(
      withMinimumDuration(async () => "done", 100, clock),
    ).resolves.toBe("done");
    expect(clock.sleep).toHaveBeenCalledWith(100);
  });

  it("does not wait when work already exceeds the floor", async () => {
    const clock = createClock();
    const work = vi.fn(async () => {
      clock.now = () => 1_200;
      return "done";
    });

    await withMinimumDuration(work, 100, clock);
    expect(clock.sleep).not.toHaveBeenCalled();
  });

  it("propagates work failures", async () => {
    const clock = createClock();
    const failure = new Error("failed");

    await expect(
      withMinimumDuration(async () => {
        throw failure;
      }, 100, clock),
    ).rejects.toBe(failure);
    expect(clock.sleep).not.toHaveBeenCalled();
  });
});
