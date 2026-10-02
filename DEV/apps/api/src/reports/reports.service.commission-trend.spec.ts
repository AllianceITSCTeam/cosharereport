import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService — Dashboard: Xu hướng hoa hồng theo tháng', () => {
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

  describe('commissionTrend', () => {
    it('runs a single readonly query, excluding soft-deleted bills/commissions', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.commissionTrend({});

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"MerchantBill"/);
      expect(sqlArg.sql).toMatch(/b\."IsDeleted"\s*=\s*false/i);
      expect(sqlArg.sql).toMatch(/c\."IsDeleted"\s*=\s*false/i);
    });

    it('groups by calendar month via date_trunc', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.commissionTrend({});

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/date_trunc\('month',\s*bf\."BillDate"\)/i);
      expect(sqlArg.sql).toMatch(/GROUP BY\s+date_trunc\('month',\s*bf\."BillDate"\)/i);
      expect(sqlArg.sql).toMatch(/ORDER BY\s+month\s+ASC/i);
    });

    it('defaults to the 6 months ending at the current month when no params given', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.commissionTrend({ toMonth: '2026-06' });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      const dateValues = sqlArg.values.filter((v): v is Date => v instanceof Date);
      expect(dateValues[0].toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(dateValues[1].toISOString()).toBe('2026-06-30T23:59:59.999Z');
    });

    it('respects a custom months count, capped sensibly across a year boundary', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.commissionTrend({ toMonth: '2026-02', months: 3 });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      const dateValues = sqlArg.values.filter((v): v is Date => v instanceof Date);
      expect(dateValues[0].toISOString()).toBe('2025-12-01T00:00:00.000Z');
      expect(dateValues[1].toISOString()).toBe('2026-02-28T23:59:59.999Z');
    });

    it('maps bigint/decimal raw rows into JSON-safe plain values', async () => {
      queryRawMock.mockResolvedValue([
        {
          month: new Date('2026-06-01T00:00:00.000Z'),
          revenue: new Prisma.Decimal('1000000'),
          total_orders: 10n,
          success_orders: 7n,
          cancelled_orders: 1n,
          total_commission: new Prisma.Decimal('50000'),
        },
      ]);

      const result = await service.commissionTrend({ toMonth: '2026-06' });

      expect(result).toEqual([
        {
          month: '2026-06',
          revenue: '1000000',
          totalOrders: 10,
          successOrders: 7,
          cancelledOrders: 1,
          totalCommission: '50000',
        },
      ]);
    });
  });
});
