import { format } from 'date-fns';

/**
 * Unified datetime formats used across the app.
 * Change these constants to update every formatted timestamp in one place.
 */
export const DATE_FORMAT = 'dd/MM/yyyy';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'dd/MM/yyyy HH:mm';
export const DATETIME_SECONDS_FORMAT = 'dd/MM/yyyy HH:mm:ss';

/** Full datetime: "31/01/2026 14:30" */
export function formatDateTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), DATETIME_FORMAT);
  } catch {
    return '—';
  }
}

/** Date only: "31/01/2026" */
export function formatDate(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), DATE_FORMAT);
  } catch {
    return '—';
  }
}

/** Time only: "14:30" */
export function formatTime(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), TIME_FORMAT);
  } catch {
    return '—';
  }
}

/** Datetime with seconds: "31/01/2026 14:30:00" */
export function formatDateTimeSeconds(date: string | Date | null | undefined): string {
  if (!date) return '—';
  try {
    return format(new Date(date), DATETIME_SECONDS_FORMAT);
  } catch {
    return '—';
  }
}

/** Elapsed duration as HH:MM:SS — shared by StatusCard and FloatingWidget */
export function formatElapsedHMS(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  return [h, m, s].map((v) => String(v).padStart(2, '0')).join(':');
}
