import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService — Dashboard: Top 5 CTV theo hoa hồng', () => {
  let service: ReportsService;
  let queryRawMock: jest.Mock;

  beforeEach(async () => {
    queryRawMock = jest.fn();
    const moduleRef = await Test.createTestingModule({
      providers: [
        ReportsService,
        { provide: PrismaService, useValue: { $queryRaw: queryRawMock } },
      ],
    }).compile();

    service = moduleRef.get(ReportsService);
  });

  describe('dashboardTopCtv', () => {
    it('runs a single readonly query, only counting approved and non-deleted commissions', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.dashboardTopCtv({});

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"MerchantBillCommission"/);
      expect(sqlArg.sql).toMatch(/c\."IsDeleted"\s*=\s*false/i);
      expect(sqlArg.sql).toMatch(/c\."IsApproved"\s*=\s*true/i);
      expect(sqlArg.sql).toMatch(/b\."IsDeleted"\s*=\s*false/i);
    });

    it('filters by BillDate within the current month and groups by AffiliateUserId', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.dashboardTopCtv({});

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/"BillDate"/);
      expect(sqlArg.sql).toMatch(/GROUP BY\s+c\."AffiliateUserId"/i);
      expect(sqlArg.values.length).toBeGreaterThanOrEqual(2);
    });

    it('sorts by total commission DESC and caps at 5 rows', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.dashboardTopCtv({});

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/ORDER BY\s+total_commission\s+DESC/i);
      expect(sqlArg.sql).toMatch(/LIMIT 5/i);
    });

    it('uses the given month instead of the current month when provided', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.dashboardTopCtv({ month: '2026-01' });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      const dateValues = sqlArg.values.filter((v): v is Date => v instanceof Date);
      expect(dateValues[0].toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(dateValues[1].toISOString()).toBe('2026-01-31T23:59:59.999Z');
    });

    it('maps bigint/decimal raw rows into JSON-safe plain values', async () => {
      queryRawMock.mockResolvedValue([
        { affiliate_user_id: 55n, display_name: 'Nguyễn Văn A', total_commission: new Prisma.Decimal('1234567.5') },
      ]);

      const result = await service.dashboardTopCtv({});

      expect(result).toEqual([
        { affiliateUserId: '55', displayName: 'Nguyễn Văn A', totalCommission: '1234567.5' },
      ]);
    });
  });
});
