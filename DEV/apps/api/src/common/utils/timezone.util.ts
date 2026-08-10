/**
 * Deprecated IANA timezone aliases that Node.js/browsers accept but PostgreSQL rejects.
 * Maps alias → canonical name recognized by PostgreSQL's tzdata.
 */
const DEPRECATED_ALIASES: Record<string, string> = {
  'Asia/Saigon': 'Asia/Ho_Chi_Minh',
  'Asia/Calcutta': 'Asia/Kolkata',
  'Asia/Katmandu': 'Asia/Kathmandu',
  'Asia/Rangoon': 'Asia/Yangon',
  'Asia/Ulan_Bator': 'Asia/Ulaanbaatar',
  'Asia/Dacca': 'Asia/Dhaka',
  'Asia/Thimbu': 'Asia/Thimphu',
  'Asia/Macao': 'Asia/Macau',
  'Pacific/Truk': 'Pacific/Chuuk',
  'Pacific/Ponape': 'Pacific/Pohnpei',
  'Pacific/Johnston': 'Pacific/Honolulu',
  'America/Ensenada': 'America/Tijuana',
  'America/Shiprock': 'America/Denver',
};

/**
 * Normalizes a timezone string to a PostgreSQL-recognized canonical IANA name.
 * - Maps known deprecated aliases to their canonical equivalents.
 * - Validates via Node.js Intl (throws for truly unrecognized names).
 * - Returns 'UTC' for null/undefined/empty/unrecognized input.
 */
export function normalizeTimezone(tz: string | null | undefined): string {
  if (!tz) return 'UTC';
  const resolved = DEPRECATED_ALIASES[tz] ?? tz;
  try {
    new Intl.DateTimeFormat(undefined, { timeZone: resolved });
    return resolved;
  } catch {
    return 'UTC';
  }
}

/**
 * Same as normalizeTimezone but preserves null/undefined (no UTC fallback).
 * Use when storing to DB where null means "inherit from office/company".
 */
export function normalizeTimezoneNullable(tz: string | null | undefined): string | null {
  if (tz === null || tz === undefined || tz === '') return null;
  return normalizeTimezone(tz);
}
