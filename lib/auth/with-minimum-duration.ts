export type DurationClock = {
  now(): number;
  sleep(milliseconds: number): Promise<void>;
};

export async function withMinimumDuration<T>(
  work: () => Promise<T>,
  minimumMilliseconds: number,
  clock: DurationClock,
): Promise<T> {
  const startedAt = clock.now();
  const result = await work();
  const remainingMilliseconds = minimumMilliseconds - (clock.now() - startedAt);

  if (remainingMilliseconds > 0) {
    await clock.sleep(remainingMilliseconds);
  }

  return result;
}
