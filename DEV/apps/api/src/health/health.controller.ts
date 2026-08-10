import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { ApiTags, ApiOperation } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';

const SERVER_STARTED_AT = new Date().toISOString();

@SkipThrottle()
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Healthcheck — checks DB connectivity' })
  async check() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch (err) {
      throw new ServiceUnavailableException({
        status: 'error',
        component: 'database',
        message: err instanceof Error ? err.message : String(err),
        timestamp: new Date().toISOString(),
      });
    }
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      startedAt: SERVER_STARTED_AT,
      commit: (process.env.RAILWAY_GIT_COMMIT_SHA ?? 'local').slice(0, 7),
    };
  }
}
