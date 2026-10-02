import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService — Top nhóm hàng bán chạy', () => {
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

  describe('topGroupProducts', () => {
    it('runs a single readonly query, excluding soft-deleted groups/products', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.topGroupProducts(baseQuery);

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"MerchantGroupProduct"/);
      expect(sqlArg.sql).toMatch(/gp\."IsDeleted"\s*=\s*false/i);
    });

    it('left-joins the sales aggregate so groups with zero sales still appear', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.topGroupProducts(baseQuery);

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/LEFT JOIN/i);
      expect(sqlArg.sql).toMatch(/COALESCE\(/i);
    });

    it('aggregates lượt bán the same way as salesCount: DELIVERED orders, grouped by MerchantGroupProductId', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.topGroupProducts(baseQuery);

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/SUM\(\s*d\."Quantity"\s*\)/i);
      expect(sqlArg.sql).toMatch(/"OrderStatusCode"\s*=\s*'DELIVERED'/);
      expect(sqlArg.sql).toMatch(/"OrderStatusId"\s*=\s*10/);
      expect(sqlArg.sql).toMatch(/"Order_MerchantBill_Mapping"/);
      expect(sqlArg.sql).toMatch(/GROUP BY\s+p\."MerchantGroupProductId"/i);
    });

    it('paginates with LIMIT/OFFSET computed from page/pageSize, defaulting to 1/50', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.topGroupProducts({ ...baseQuery, page: 2, pageSize: 10 });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/LIMIT/i);
      expect(sqlArg.sql).toMatch(/OFFSET/i);
      expect(sqlArg.values).toContain(10);
      expect(sqlArg.values).toContain(10);
    });

    it('computes total count in the SAME query via a window function and defaults to sales_count DESC', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.topGroupProducts(baseQuery);

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/COUNT\(\*\)\s*OVER\s*\(/i);
      expect(sqlArg.sql).toMatch(/ORDER BY\s+sales_count\s+DESC/i);
    });

    it('maps BigInt raw rows into JSON-safe plain values and derives pagination from the window column', async () => {
      queryRawMock.mockResolvedValue([
        { id: 7n, code: 'NH01', name: 'Thời trang', sales_count: 42n, total_count: 1n },
      ]);

      const result = await service.topGroupProducts({ ...baseQuery, page: 1, pageSize: 50 });

      expect(result).toEqual({
        rows: [{ id: '7', code: 'NH01', name: 'Thời trang', salesCount: 42 }],
        pagination: { page: 1, pageSize: 50, totalCount: 1 },
      });
    });
  });
});
