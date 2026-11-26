/** Engine functions return errors as values instead of throwing (ARCHITECTURE §3). */
export type Result<T> = { ok: true; value: T } | { ok: false; error: string };
