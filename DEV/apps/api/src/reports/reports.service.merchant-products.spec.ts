import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService — Hàng hóa trên website', () => {
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

  describe('merchantProducts', () => {
    it('runs a single readonly query against MerchantProduct, excluding soft-deleted rows', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.merchantProducts({});

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"MerchantProduct"/);
      expect(sqlArg.sql).toMatch(/p\."IsDeleted"\s*=\s*false/i);
    });

    it('rejects a non-numeric groupProductId instead of sending it to Postgres as text', async () => {
      await expect(service.merchantProducts({ groupProductId: 'abc' })).rejects.toThrow();
      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('filters by code and name via ILIKE INSIDE the base CTE — not in the outer WHERE, where alias "p" is out of scope (regression: 42P01 missing FROM-clause entry for "p")', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.merchantProducts({ code: 'SP001', name: 'Áo thun' });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/p\."Code"\s+ILIKE/i);
      expect(sqlArg.sql).toMatch(/p\."Name"\s+ILIKE/i);
      expect(sqlArg.values).toContain('%SP001%');
      expect(sqlArg.values).toContain('%Áo thun%');

      const fromBaseIdx = sqlArg.sql.indexOf('FROM base');
      const codeFilterIdx = sqlArg.sql.indexOf('p."Code" ILIKE');
      expect(codeFilterIdx).toBeGreaterThan(-1);
      expect(codeFilterIdx).toBeLessThan(fromBaseIdx);
    });

    it('filters by groupProductId as an exact bigint match INSIDE the base CTE (same scoping regression as code/name)', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.merchantProducts({ groupProductId: '42' });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/"MerchantGroupProductId"/);
      expect(sqlArg.values).toContain(42n);

      const fromBaseIdx = sqlArg.sql.indexOf('FROM base');
      const groupFilterIdx = sqlArg.sql.indexOf('p."MerchantGroupProductId" =');
      expect(groupFilterIdx).toBeGreaterThan(-1);
      expect(groupFilterIdx).toBeLessThan(fromBaseIdx);
    });

    it('derives status from IsHideOnWeb/IsSuspended/IsDisable (ẩn) taking priority over tồn kho — IsDisable đưa lại vào rule "Đã ẩn" theo yêu cầu trực tiếp của user (2026-10-02, lần 2)', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.merchantProducts({});

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/"IsHideOnWeb"/);
      expect(sqlArg.sql).toMatch(/"IsSuspended"/);
      expect(sqlArg.sql).toMatch(/'HIDDEN'/);
      expect(sqlArg.sql).toMatch(/"StockBooked"/);
      expect(sqlArg.sql).toMatch(/'OUT_OF_STOCK'/);
      expect(sqlArg.sql).toMatch(/'SELLING'/);

      // IsDisable PHẢI nằm trong nhánh tính "Đã ẩn" (CASE ... HIDDEN), không phải ở nơi khác
      const caseIdx = sqlArg.sql.indexOf('CASE');
      const endCaseIdx = sqlArg.sql.indexOf('END', caseIdx);
      const caseBody = sqlArg.sql.slice(caseIdx, endCaseIdx);
      expect(caseBody).toMatch(/"IsDisable"/);
      const hiddenBranchIdx = caseBody.indexOf("'HIDDEN'");
      expect(caseBody.indexOf('"IsDisable"')).toBeLessThan(hiddenBranchIdx);
    });

    it('filters by the computed status via an outer WHERE on the status CTE', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.merchantProducts({ status: 'OUT_OF_STOCK' });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/status\s*=/i);
      expect(sqlArg.values).toContain('OUT_OF_STOCK');
    });

    it('paginates with LIMIT/OFFSET computed from page/pageSize, defaulting to 1/50', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.merchantProducts({ page: 3, pageSize: 20 });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/LIMIT/i);
      expect(sqlArg.sql).toMatch(/OFFSET/i);
      expect(sqlArg.values).toContain(20);
      expect(sqlArg.values).toContain(40);
    });

    it('computes total count in the SAME query via a window function', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.merchantProducts({});

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/COUNT\(\*\)\s*OVER\s*\(/i);
    });

    it('maps BigInt raw rows into JSON-safe plain values, derives pagination from the window column, and builds the product link from ID_GUID', async () => {
      queryRawMock.mockResolvedValue([
        {
          id: 101n,
          code: 'SP001',
          name: 'Áo thun',
          group_code: 'NH01',
          group_name: 'Thời trang',
          status: 'SELLING',
          id_guid: '11111111-1111-1111-1111-111111111111',
          total_count: 1n,
        },
      ]);

      const result = await service.merchantProducts({ page: 1, pageSize: 50 });

      expect(result).toEqual({
        rows: [
          {
            id: '101',
            code: 'SP001',
            name: 'Áo thun',
            groupCode: 'NH01',
            groupName: 'Thời trang',
            status: 'SELLING',
            link: 'https://coshare.vn/product/11111111-1111-1111-1111-111111111111',
          },
        ],
        pagination: { page: 1, pageSize: 50, totalCount: 1 },
      });
    });

    it('selects ID_GUID in the base CTE so the link column can be built', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.merchantProducts({});

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/p\."ID_GUID"\s+AS\s+id_guid/i);
    });
  });

  describe('merchantProductGroups', () => {
    it('runs a single readonly query against MerchantGroupProduct, excluding soft-deleted rows', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.merchantProductGroups();

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"MerchantGroupProduct"/);
      expect(sqlArg.sql).toMatch(/"IsDeleted"\s*=\s*false/i);
    });

    it('maps rows into JSON-safe id/code/name', async () => {
      queryRawMock.mockResolvedValue([{ id: 7n, code: 'NH01', name: 'Thời trang' }]);

      const result = await service.merchantProductGroups();

      expect(result).toEqual([{ id: '7', code: 'NH01', name: 'Thời trang' }]);
    });
  });
});
