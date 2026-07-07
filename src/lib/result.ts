/**
 * Minimal, dependency-free `Result` type.
 *
 * Used where failure is an expected outcome that the caller should handle
 * explicitly (e.g. a network fetch inside a polling loop) rather than an
 * exception to bubble up. The discriminated `ok` field lets TypeScript narrow
 * both branches without a library.
 */
export type Result<T, E> = { ok: true; value: T } | { ok: false; error: E };

export function ok<T>(value: T): Result<T, never> {
  return { ok: true, value };
}

export function err<E>(error: E): Result<never, E> {
  return { ok: false, error };
}
