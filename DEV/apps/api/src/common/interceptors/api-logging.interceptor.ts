import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable, throwError } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';
import { Request } from 'express';

const SKIP_PATHS = ['/api/health', '/favicon.ico'];

/**
 * Lightweight request logger (console/Railway logs only). This app has no
 * writable DB of its own — see PrismaService — so request logs are not
 * persisted anywhere; add a separate writable store here if that's needed later.
 */
@Injectable()
export class ApiLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger('http');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    if (context.getType() !== 'http') return next.handle();

    const req = context.switchToHttp().getRequest<Request>();
    const path = req.url.split('?')[0];
    if (SKIP_PATHS.some((p) => path.startsWith(p))) return next.handle();

    const startTime = Date.now();
    const res = context.switchToHttp().getResponse<{ statusCode: number }>();

    const log = (statusCode: number) => {
      this.logger.log(`${req.method} ${path} ${statusCode} ${Date.now() - startTime}ms`);
    };

    return next.handle().pipe(
      tap(() => log(res.statusCode)),
      catchError((err: unknown) => {
        log((err as { status?: number })?.status ?? 500);
        return throwError(() => err);
      }),
    );
  }
}
