import type { Request } from 'express';

/**
 * Extract the real client IP from a request, respecting X-Forwarded-For
 * when running behind Railway's proxy / load balancer.
 */
export function extractIp(req: Request): string | undefined {
  const forwarded = req.headers['x-forwarded-for'];
  if (forwarded) {
    const first = Array.isArray(forwarded) ? forwarded[0] : forwarded.split(',')[0];
    return first.trim() || undefined;
  }
  return req.socket?.remoteAddress ?? req.ip ?? undefined;
}
