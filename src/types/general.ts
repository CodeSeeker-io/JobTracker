export type NonEmptyArray<T> = [T, ...T[]];

/** Discriminated union representing an operation that can fail. */
export type Result<T, E extends Error = Error> =
  | { ok: true; data: T }
  | { ok: false; error: E };

export type Json =
  | string
  | number
  | boolean
  | null
  | Json[]
  | { [key: string]: Json };
