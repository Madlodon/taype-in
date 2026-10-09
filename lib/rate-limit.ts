// Limite les codes de course essayés par IP pour empêcher de les deviner (SALLE-10).
// Seuls les échecs comptent : une personne qui revient dans sa course n'est pas bloquée.
export const CODE_ATTEMPT_LIMIT = 10;
export const CODE_ATTEMPT_WINDOW_MS = 60_000;

type Window = { count: number; resetAt: number };

export type RateLimiter = {
  isBlocked: (key: string, now?: number) => boolean;
  recordFailure: (key: string, now?: number) => void;
};

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  const windows = new Map<string, Window>();

  function current(key: string, now: number) {
    const window = windows.get(key);
    if (window && now >= window.resetAt) {
      windows.delete(key);
      return undefined;
    }
    return window;
  }

  return {
    isBlocked: (key, now = Date.now()) => (current(key, now)?.count ?? 0) >= limit,
    recordFailure: (key, now = Date.now()) => {
      const window = current(key, now);
      if (window) {
        window.count += 1;
        return;
      }
      // Les fenêtres expirées des autres IP sont retirées pour ne pas garder la mémoire.
      for (const [other, { resetAt }] of windows) {
        if (now >= resetAt) windows.delete(other);
      }
      windows.set(key, { count: 1, resetAt: now + windowMs });
    },
  };
}

// Partagé par le formulaire (Next.js) et Socket.IO, qui chargent chacun leur copie du module.
const store = globalThis as { codeAttempts?: RateLimiter };
export const codeAttempts = (store.codeAttempts ??= createRateLimiter(
  CODE_ATTEMPT_LIMIT,
  CODE_ATTEMPT_WINDOW_MS,
));
