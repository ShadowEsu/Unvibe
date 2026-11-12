export async function withRetry<T>(
  task: () => Promise<T>,
  attempts = 3,
  baseDelayMs = 500,
): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      return await task();
    } catch (err) {
      lastError = err;
      if (i < attempts - 1) await sleep(baseDelayMs * 2 ** i + Math.random() * 100);
    }
  }
  throw lastError;
}