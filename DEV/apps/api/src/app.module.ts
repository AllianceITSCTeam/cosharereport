import { Module } from '@nestjs/common';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { ServeStaticModule } from '@nestjs/serve-static';
import { ConfigModule } from '@nestjs/config';
import * as path from 'path';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { HttpExceptionFilter } from './common/filters/http-exception.filter';
import { ApiLoggingInterceptor } from './common/interceptors/api-logging.interceptor';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { ReportsModule } from './reports/reports.module';
import { HealthModule } from './health/health.module';

@Module({
  imports: [
    ...(process.env.NODE_ENV === 'production'
      ? [
          ServeStaticModule.forRoot({
            rootPath: path.join(process.cwd(), 'apps/api/public'),
            exclude: ['/api/(.*)'],
          }),
        ]
      : []),
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: '.env',
      validate: (config: Record<string, unknown>) => {
        const required = ['DATABASE_URL', 'COSHARE_JWT_SECRET', 'SESSION_JWT_SECRET'];
        for (const key of required) {
          if (!config[key]) {
            throw new Error(`Missing required environment variable: ${key}`);
          }
        }
        return config;
      },
    }),
    ThrottlerModule.forRoot([
      { name: 'default', ttl: 60000, limit: 300 },
      { name: 'sso', ttl: 60000, limit: 10 },
    ]),
    PrismaModule,
    AuthModule,
    ReportsModule,
    HealthModule,
  ],
  controllers: [],
  providers: [
    { provide: APP_FILTER, useClass: HttpExceptionFilter },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_INTERCEPTOR, useClass: ApiLoggingInterceptor },
  ],
})
export class AppModule {}
