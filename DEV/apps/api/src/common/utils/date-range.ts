/**
 * Converts a local date string (YYYY-MM-DD) to a UTC Date representing
 * the start or end of that day in the given IANA timezone.
 * Falls back to treating the date as UTC if timezone is invalid or absent.
 */
function localDayToUtc(dateStr: string, isEnd: boolean, timezone?: string | null): Date {
  const timeStr = isEnd ? '23:59:59' : '00:00:00';
  const fakeUtc = new Date(`${dateStr}T${timeStr}Z`);

  if (timezone) {
    try {
      const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      });
      const parts = Object.fromEntries(
        fmt.formatToParts(fakeUtc).map((p) => [p.type, p.value]),
      );
      const localMs = Date.UTC(
        parseInt(parts['year']),
        parseInt(parts['month']) - 1,
        parseInt(parts['day']),
        parseInt(parts['hour'] === '24' ? '0' : parts['hour']),
        parseInt(parts['minute']),
        parseInt(parts['second']),
      );
      const offsetMs = localMs - fakeUtc.getTime();
      const result = new Date(fakeUtc.getTime() - offsetMs);
      if (isEnd) result.setUTCMilliseconds(999);
      return result;
    } catch {
      // Invalid IANA zone — fall through to UTC
    }
  }

  if (isEnd) fakeUtc.setUTCMilliseconds(999);
  return fakeUtc;
}

/**
 * Returns a UTC {gte, lte} range for the given local date strings and timezone.
 *
 * Example: startDate='2026-04-09', endDate='2026-04-09', timezone='Asia/Ho_Chi_Minh'
 *   → gte = 2026-04-08T17:00:00.000Z  (April 9 00:00:00 UTC+7)
 *   → lte = 2026-04-09T16:59:59.999Z  (April 9 23:59:59.999 UTC+7)
 */
export function toUtcDateRange(
  startDate: string,
  endDate: string,
  timezone?: string | null,
): { gte: Date; lte: Date } {
  return {
    gte: localDayToUtc(startDate, false, timezone),
    lte: localDayToUtc(endDate, true, timezone),
  };
}
