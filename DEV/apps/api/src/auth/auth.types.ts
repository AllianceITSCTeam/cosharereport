/**
 * Claims we expect inside the JWT that CoShare signs and hands us via /sso?token=...
 * NOTE: field names are a placeholder — confirm the real claim names with the CoShare
 * team before relying on anything beyond `sub`.
 */
export interface CoshareTokenPayload {
  sub: string;
  name?: string;
  email?: string;
  role?: string;
  [claim: string]: unknown;
}

/** Payload we sign into our own session cookie after a successful /sso exchange. */
export interface SessionPayload {
  sub: string;
  name?: string;
  email?: string;
  role?: string;
}
