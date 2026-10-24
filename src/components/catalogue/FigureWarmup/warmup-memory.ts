const STORAGE_KEY = 'figure-warmup';

function readKeys(): Set<string> {
  try {
    const saved: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
    return new Set(
      Array.isArray(saved) ? saved.filter((key): key is string => typeof key === 'string') : [],
    );
  } catch {
    return new Set();
  }
}

/** Source paths and version tags share the existing persisted key format. */
export function createWarmupMemory(version: string) {
  const keyFor = (src: string) => `${src}#${version}`;
  return {
    has(src: string): boolean {
      return readKeys().has(keyFor(src));
    },
    remember(src: string): void {
      const keys = [...readKeys(), keyFor(src)].filter((key) => key.endsWith(`#${version}`));
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify([...new Set(keys)]));
      } catch {}
    },
  };
}
