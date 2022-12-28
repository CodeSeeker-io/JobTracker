export function debounce<Fn extends (...args: unknown[]) => void>(
  callback: Fn,
  debounceTimeMs: number
): (...args: Parameters<Fn>) => void {
  if (!Number.isInteger(debounceTimeMs) || debounceTimeMs < 0) {
    throw new Error(`${debounceTimeMs} is not a non-negative integer`);
  }

  if (debounceTimeMs === 0) {
    return callback;
  }

  let debounceId: number | null = null;
  return function callDebounced(...args: Parameters<Fn>): void {
    if (debounceId !== null) {
      window.clearTimeout(debounceId);
    }

    debounceId = window.setTimeout(() => {
      callback(...args);
      debounceId = null;
    }, debounceTimeMs);
  };
}
