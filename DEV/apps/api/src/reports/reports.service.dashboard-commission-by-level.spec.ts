import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService — Dashboard: Hoa hồng theo cấp hệ (toàn hệ thống)', () => {
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

  describe('commissionByLevel — companyId omitted (dashboard, toàn hệ thống)', () => {
    it('runs a single readonly query grouped by AffiliateLevel, WITHOUT any company filter', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.commissionByLevel({ from: '2026-04-01', to: '2026-04-30' });

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"ConfigAffiliateLevel"/);
      expect(sqlArg.sql).not.toMatch(/"UserLogin_Company_Mapping"/);
      expect(sqlArg.sql).not.toMatch(/EXISTS/i);
    });

    it('maps BigInt/Decimal raw rows into JSON-safe plain values, same shape as the company-scoped variant', async () => {
      queryRawMock.mockResolvedValue([
        { level_no: 1n, level_name: 'Đại sứ', total_commission: new Prisma.Decimal('5000000') },
      ]);

      const result = await service.commissionByLevel({ from: '2026-04-01', to: '2026-04-30' });

      expect(result).toEqual([{ levelNo: 1, levelName: 'Đại sứ', totalCommission: '5000000' }]);
    });
  });

  describe('commissionByLevel — companyId provided (Screen 2B, không đổi hành vi cũ)', () => {
    it('still scopes to the given company via EXISTS when companyId is passed', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.commissionByLevel({ from: '2026-04-01', to: '2026-04-30', companyId: '4' });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/"UserLogin_Company_Mapping"/);
      expect(sqlArg.sql).toMatch(/EXISTS/i);
      expect(sqlArg.values).toContain(4n);
    });

    it('still rejects an explicitly empty companyId (Screen 2B defense-in-depth)', async () => {
      await expect(
        service.commissionByLevel({ from: '2026-04-01', to: '2026-04-30', companyId: '' }),
      ).rejects.toThrow();

      expect(queryRawMock).not.toHaveBeenCalled();
    });
  });
});
