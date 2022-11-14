/**
 * Ensure an array of values even if only a single value is passed.
 */
export function ensureArray<T>(value: T | T[]): T[] {
  return Array.isArray(value) ? value : [value];
}
