/**
 * Safely extract an array from a value that may be null, undefined, or non-array.
 * Returns the value as-is if it is already an array, otherwise returns [].
 *
 * TypeScript infers the element type automatically from the input:
 *
 * @example
 * // Paginated response: { data: T[], pagination: {...} }
 * const rows = safeArray(queryResult?.data);   // inferred as T[]
 *
 * // Direct array or unknown
 * const statuses = safeArray(rawStatuses);     // inferred from rawStatuses type
 * const typed    = safeArray<MyType>(raw);     // explicit generic when input is unknown
 */
export function safeArray<T>(value: T[] | readonly T[] | null | undefined): T[];
export function safeArray<T = unknown>(value: unknown): T[];
export function safeArray<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}
