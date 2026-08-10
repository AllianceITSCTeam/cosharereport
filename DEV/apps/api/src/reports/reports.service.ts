import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Reference implementation for report endpoints — each report is a readonly
 * Prisma query (findMany/aggregate) against the CoShare schema.
 *
 * TODO: once `prisma db pull` has introspected the real CoShare database
 * (see prisma/schema.prisma), replace `ping()` with the first real report
 * query and add one method per report here.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async ping(): Promise<{ connected: boolean }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { connected: true };
  }

  async latestUsers() {
    return this.prisma.userLogin.findMany({
      select: {
        Log_CreatedDate: true,
        DisplayName: true,
        Username: true,
      },
      orderBy: { Log_CreatedDate: 'desc' },
      take: 10,
    });
  }
}
