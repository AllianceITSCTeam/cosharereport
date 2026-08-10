import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  Injectable,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { ApiResponse } from '@shared/types/api-response.type';
import * as path from 'path';
import * as fs from 'fs';

@Injectable()
@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let code: string | undefined;
    let errors: string[] = [];
    let stack: string | undefined;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const exceptionResponse = exception.getResponse();

      if (typeof exceptionResponse === 'string') {
        message = exceptionResponse;
      } else if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
        const resp = exceptionResponse as Record<string, unknown>;
        message = (resp['message'] as string) ?? exception.message;
        code = resp['code'] as string | undefined;

        if (Array.isArray(resp['message'])) {
          errors = resp['message'] as string[];
          message = 'Validation failed';
        }
      }
      stack = exception.stack;
    } else if (exception instanceof Error) {
      message = exception.message;
      stack = exception.stack;
    }

    if (status >= 500) {
      this.logger.error(`${request.method} ${request.url} — ${message}`, stack);
    }

    // SPA fallback: non-API 404s serve index.html so React Router handles routing
    if (status === HttpStatus.NOT_FOUND && !request.path.startsWith('/api')) {
      const indexPath = path.join(process.cwd(), 'apps/api/public', 'index.html');
      if (fs.existsSync(indexPath)) {
        return response.sendFile(indexPath);
      }
    }

    const body: ApiResponse<null> = {
      success: false,
      message,
      code,
      errors: errors.length > 0 ? errors : undefined,
    };

    response.status(status).json(body);
  }
}
