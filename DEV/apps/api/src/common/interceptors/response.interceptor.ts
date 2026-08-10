import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { ApiResponse } from '@shared/types/api-response.type';

@Injectable()
export class ResponseInterceptor<T> implements NestInterceptor<T, ApiResponse<T>> {
  intercept(
    _context: ExecutionContext,
    next: CallHandler<T>,
  ): Observable<ApiResponse<T>> {
    const startTime = Date.now();

    return next.handle().pipe(
      map((data) => {
        const durationMs = Date.now() - startTime;

        // If data is already an ApiResponse shape, inject durationMs and pass through
        if (
          data !== null &&
          typeof data === 'object' &&
          'success' in data &&
          typeof (data as Record<string, unknown>)['success'] === 'boolean'
        ) {
          return { ...(data as unknown as ApiResponse<T>), durationMs };
        }

        return {
          success: true,
          data,
          durationMs,
        };
      }),
    );
  }
}
