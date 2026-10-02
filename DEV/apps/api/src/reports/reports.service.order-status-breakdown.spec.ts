import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService — Dashboard: Tỷ lệ đơn thành công/huỷ', () => {
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

  const baseQuery = { from: '2026-09-01', to: '2026-09-30' };

  describe('orderStatusBreakdown', () => {
    it('runs a single readonly query, excluding soft-deleted bills/mappings/orders', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.orderStatusBreakdown(baseQuery);

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"Order_MerchantBill_Mapping"/);
      expect(sqlArg.sql).toMatch(/b\."IsDeleted"\s*=\s*false/i);
      expect(sqlArg.sql).toMatch(/omb\."IsDeleted"\s*=\s*false/i);
      expect(sqlArg.sql).toMatch(/o\."IsDeleted"\s*=\s*false/i);
    });

    it('classifies success as DELIVERED/OrderStatusId=10, same definition as salesCount', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.orderStatusBreakdown(baseQuery);

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/"OrderStatusCode"\s*=\s*'DELIVERED'/);
      expect(sqlArg.sql).toMatch(/"OrderStatusId"\s*=\s*10/);
    });

    it('classifies cancelled as any OrderStatusCode starting with CANCELLED (chốt 2026-10-02)', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.orderStatusBreakdown(baseQuery);

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/"OrderStatusCode"\s+LIKE\s+'CANCELLED%'/);
    });

    it('groups by the computed bucket (success/cancelled/other)', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.orderStatusBreakdown(baseQuery);

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/GROUP BY\s+bucket/i);
    });

    it('maps the 3 buckets into a flat result and sums total, defaulting missing buckets to 0', async () => {
      queryRawMock.mockResolvedValue([
        { bucket: 'success', cnt: 42n },
        { bucket: 'cancelled', cnt: 3n },
      ]);

      const result = await service.orderStatusBreakdown(baseQuery);

      expect(result).toEqual({ success: 42, cancelled: 3, other: 0, total: 45 });
    });

    it('returns all zeros when there are no matching bills at all', async () => {
      queryRawMock.mockResolvedValue([]);

      const result = await service.orderStatusBreakdown(baseQuery);

      expect(result).toEqual({ success: 0, cancelled: 0, other: 0, total: 0 });
    });
  });
});
