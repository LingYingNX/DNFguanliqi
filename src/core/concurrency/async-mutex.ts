export type AsyncMutex = {
  readonly runExclusive: <T>(action: () => Promise<T>) => Promise<T>;
};

export function createAsyncMutex(): AsyncMutex {
  let tail = Promise.resolve();
  return {
    async runExclusive<T>(action: () => Promise<T>): Promise<T> {
      let release: (() => void) | undefined;
      const current = new Promise<void>((resolve) => {
        release = resolve;
      });
      const previous = tail;
      tail = previous.then(() => current);
      await previous;
      try {
        return await action();
      } finally {
        release?.();
      }
    },
  };
}
