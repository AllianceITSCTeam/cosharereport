import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService — Thống kê lượt bán', () => {
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

  describe('salesCount', () => {
    it('runs a single readonly query, excluding soft-deleted products', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.salesCount(baseQuery);

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"MerchantProduct"/);
      expect(sqlArg.sql).toMatch(/p\."IsDeleted"\s*=\s*false/i);
    });

    it('left-joins the sales aggregate so products with zero sales still appear', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.salesCount(baseQuery);

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/LEFT JOIN/i);
      expect(sqlArg.sql).toMatch(/COALESCE\(/i);
    });

    it('aggregates lượt bán as SUM(Quantity) over DELIVERED orders within the date range', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.salesCount(baseQuery);

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/SUM\(\s*d\."Quantity"\s*\)/i);
      expect(sqlArg.sql).toMatch(/"OrderStatusCode"\s*=\s*'DELIVERED'/);
      expect(sqlArg.sql).toMatch(/"OrderStatusId"\s*=\s*10/);
      expect(sqlArg.sql).toMatch(/"Order_MerchantBill_Mapping"/);
      expect(sqlArg.sql).toMatch(/d\."IsDeleted"\s*=\s*false/i);
      expect(sqlArg.sql).toMatch(/b\."IsDeleted"\s*=\s*false/i);
      expect(sqlArg.sql).toMatch(/"BillDate"/);
    });

    it('rejects a non-numeric groupProductId instead of sending it to Postgres as text', async () => {
      await expect(
        service.salesCount({ ...baseQuery, groupProductId: 'abc' }),
      ).rejects.toThrow();
      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('filters by code, name and groupProductId', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.salesCount({ ...baseQuery, code: 'SP001', name: 'Áo thun', groupProductId: '42' });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/code\s+ILIKE|p\."Code"\s+ILIKE/i);
      expect(sqlArg.sql).toMatch(/name\s+ILIKE|p\."Name"\s+ILIKE/i);
      expect(sqlArg.values).toContain('%SP001%');
      expect(sqlArg.values).toContain('%Áo thun%');
      expect(sqlArg.values).toContain(42n);
    });

    it('paginates with LIMIT/OFFSET computed from page/pageSize, defaulting to 1/50', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.salesCount({ ...baseQuery, page: 3, pageSize: 20 });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/LIMIT/i);
      expect(sqlArg.sql).toMatch(/OFFSET/i);
      expect(sqlArg.values).toContain(20);
      expect(sqlArg.values).toContain(40);
    });

    it('computes total count in the SAME query via a window function', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.salesCount(baseQuery);

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/COUNT\(\*\)\s*OVER\s*\(/i);
    });

    it('defaults to sorting by sales_count DESC', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.salesCount(baseQuery);

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/ORDER BY\s+sales_count\s+DESC/i);
    });

    it('sorts by sales_count ASC when sortBy=salesCount&sortDir=asc', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.salesCount({ ...baseQuery, sortBy: 'salesCount', sortDir: 'asc' });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/ORDER BY\s+sales_count\s+ASC/i);
    });

    it('sorts by code/name when requested, via a whitelisted column (never interpolating raw input)', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.salesCount({ ...baseQuery, sortBy: 'code', sortDir: 'asc' });
      let sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/ORDER BY\s+code\s+ASC/i);

      queryRawMock.mockClear();
      await service.salesCount({ ...baseQuery, sortBy: 'name', sortDir: 'desc' });
      sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/ORDER BY\s+name\s+DESC/i);
    });

    it('maps BigInt raw rows into JSON-safe plain values and derives pagination from the window column', async () => {
      queryRawMock.mockResolvedValue([
        {
          id: 101n,
          code: 'SP001',
          name: 'Áo thun',
          group_code: 'NH01',
          group_name: 'Thời trang',
          sales_count: 15n,
          total_count: 1n,
        },
      ]);

      const result = await service.salesCount({ ...baseQuery, page: 1, pageSize: 50 });

      expect(result).toEqual({
        rows: [
          {
            id: '101',
            code: 'SP001',
            name: 'Áo thun',
            groupCode: 'NH01',
            groupName: 'Thời trang',
            salesCount: 15,
          },
        ],
        pagination: { page: 1, pageSize: 50, totalCount: 1 },
      });
    });
  });
});
