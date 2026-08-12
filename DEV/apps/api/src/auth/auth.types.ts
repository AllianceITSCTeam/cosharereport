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

/**
 * Shape of the JSON returned by CoShare's OAuth2 token endpoint
 * (`POST /oauth2/token`, grant_type=password). Only the fields we read are typed;
 * the rest (app_menu, project_screens, configs, avatar_url…) are ignored.
 */
export interface CoshareOAuthResponse {
  access_token: string;
  token_type?: string;
  user_name?: string;
  name?: string;
  user_id?: string;
  user_uniqueid?: string;
  user_type?: string;
  fa2_needverify?: boolean;
  fa2_needenable?: boolean;
  [key: string]: unknown;
}
