import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService — Dashboard: Top 5 CTV theo số người giới thiệu', () => {
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

  describe('dashboardTopCtvReferral', () => {
    it('runs a single readonly query, excluding soft-deleted closures/partners', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.dashboardTopCtvReferral({});

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"AffiliatePartnerClosure"/);
      expect(sqlArg.sql).toMatch(/"AffiliatePartner"/);
      expect(sqlArg.sql).toMatch(/cl\."IsDeleted"\s*=\s*false/i);
      expect(sqlArg.sql).toMatch(/ap\."IsDeleted"\s*=\s*false/i);
    });

    it('counts only DIRECT referrals (Level = 2), filtered by descendant JoinDate', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.dashboardTopCtvReferral({});

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/cl\."Level"\s*=\s*2/);
      expect(sqlArg.sql).toMatch(/cl\."JoinDate"/);
      expect(sqlArg.sql).toMatch(/GROUP BY\s+ap\."UserLoginId"/i);
    });

    it('sorts by direct_referrals DESC and caps at 5 rows', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.dashboardTopCtvReferral({});

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).toMatch(/ORDER BY\s+direct_referrals\s+DESC/i);
      expect(sqlArg.sql).toMatch(/LIMIT 5/i);
    });

    it('uses the given month instead of the current month when provided', async () => {
      queryRawMock.mockResolvedValue([]);
      await service.dashboardTopCtvReferral({ month: '2026-01' });

      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      const dateValues = sqlArg.values.filter((v): v is Date => v instanceof Date);
      expect(dateValues[0].toISOString()).toBe('2026-01-01T00:00:00.000Z');
      expect(dateValues[1].toISOString()).toBe('2026-01-31T23:59:59.999Z');
    });

    it('maps bigint raw rows into JSON-safe plain values', async () => {
      queryRawMock.mockResolvedValue([
        { user_login_id: 99n, display_name: 'Trần Thị B', referral_code: 'CTV099', direct_referrals: 3n },
      ]);

      const result = await service.dashboardTopCtvReferral({});

      expect(result).toEqual([
        { userLoginId: '99', displayName: 'Trần Thị B', referralCode: 'CTV099', directReferrals: 3 },
      ]);
    });
  });
});
