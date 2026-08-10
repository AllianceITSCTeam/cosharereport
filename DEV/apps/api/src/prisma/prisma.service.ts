import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

const WRITE_ACTIONS = new Set([
  'create',
  'createMany',
  'update',
  'updateMany',
  'upsert',
  'delete',
  'deleteMany',
  'executeRaw',
  'executeRawUnsafe',
]);

/**
 * This app only ever connects to CoShare's database through a readonly Postgres
 * role — Postgres itself will reject any write. This middleware fails fast at the
 * application layer too, so a write attempt shows up as a clear error instead of
 * a confusing Postgres permission-denied deep in a query.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    const baseUrl = (process.env.DATABASE_URL ?? '').split('?')[0];
    const url = `${baseUrl}?connection_limit=3&pool_timeout=10`;
    super({
      datasources: { db: { url } },
      log:
        process.env.NODE_ENV === 'production'
          ? [
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ]
          : [
              { emit: 'stdout', level: 'info' },
              { emit: 'stdout', level: 'warn' },
              { emit: 'stdout', level: 'error' },
            ],
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.$use(async (params: any, next: (params: any) => Promise<unknown>) => {
      if (WRITE_ACTIONS.has(params.action)) {
        throw new Error(
          `Blocked write attempt via Prisma: ${params.model ?? ''}.${params.action}. ` +
            'This app only has readonly access to the CoShare database.',
        );
      }
      return next(params);
    });
  }

  async onModuleInit(): Promise<void> {
    try {
      await this.$connect();
      this.logger.log('Database connected (readonly)');
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.logger.error('Database connection failed', message);
      throw err;
    }
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }
}
