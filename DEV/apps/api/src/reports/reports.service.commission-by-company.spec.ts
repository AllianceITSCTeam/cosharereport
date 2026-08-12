import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService — Screen 2 (Hoa hồng theo công ty)', () => {
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

  describe('commissionByPerson (S2A — drill-down theo người bán)', () => {
    it('rejects when companyId is missing (§2.1 bắt buộc chọn 1 công ty)', async () => {
      await expect(
        service.commissionByPerson({ from: '2026-04-01', to: '2026-04-30', companyId: '' }),
      ).rejects.toThrow();

      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('rejects a non-numeric companyId instead of sending it to Postgres as text', async () => {
      await expect(
        service.commissionByPerson({ from: '2026-04-01', to: '2026-04-30', companyId: 'abc' }),
      ).rejects.toThrow();

      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('runs a single readonly raw query scoped to the given company', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.commissionByPerson({ from: '2026-04-01', to: '2026-04-30', companyId: '4' });

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"MerchantBillCommission"/);
      expect(sqlArg.sql).toMatch(/"UserLogin_Company_Mapping"/);
      // Company.Id is bigint in Postgres — a bare text param fails with
      // "operator does not exist: bigint = text" (caught via RECON_DB reconciliation).
      expect(sqlArg.values).toContain(4n);
    });

    it('commission column is attributed to the seller who created it (SellUserId), not the beneficiary', async () => {
      // Chốt 2026-08-12: "Hoa hồng" ở Screen 2 = hoa hồng người bán TẠO RA (SellUserId),
      // không phải AffiliateUserId (người nhận). Xem docs/reports/commission-by-company.md §1.
      const sqlArg = await buildSql(service);
      expect(sqlArg.sql).toMatch(/SellUserId/);
    });

    it('never double-counts order revenue when a bill has multiple commission rows (fan-out guard)', async () => {
      const sqlArg = await buildSql(service);
      // Doanh thu phải lấy 1 lần/đơn, không SUM trực tiếp TotalMoney sau khi JOIN
      // MerchantBillCommission (04-DB-Verification-Findings.md §C "BẪY FAN-OUT").
      expect(sqlArg.sql).toMatch(/DISTINCT|LATERAL|MAX\(/i);
    });

    it('does not inflate revenue when the SAME seller has multiple commission rows for the SAME bill (multi-level payout)', async () => {
      // Regression guard for the bug found 2026-08-13: manual QA compared Screen 1's per-company
      // revenue against Screen 2's cộng dồn per-person revenue for the same company/date range and
      // found Screen 2 ~2x too high. Root cause: 1 bill paying out L1+L2+L3 commission to the SAME
      // SellUserId produces 3 MerchantBillCommission rows; the old query summed a LATERAL
      // MAX(TotalMoney) per COMMISSION ROW instead of per DISTINCT (seller, bill) pair, so that
      // bill's revenue was counted 3x for that seller. Fix: dedupe (seller, bill) into its own CTE
      // ("seller_bills") BEFORE summing revenue, and sum CommisionAmount over ALL rows separately
      // ("commission_stats") since every commission row is a real, distinct payout that must count.
      const sqlArg = await buildSql(service);
      expect(sqlArg.sql).toMatch(/DISTINCT\s+seller_id,\s*bill_id/i);
      expect(sqlArg.sql).toMatch(/seller_bills/i);
      expect(sqlArg.sql).toMatch(/commission_stats/i);
      // Revenue must be summed from the deduped seller_bills scope, not from the raw
      // per-commission-row set — i.e. the SUM(TotalMoney) sits inside order_stats, which is built
      // on top of seller_bills.
      expect(sqlArg.sql).toMatch(/order_stats AS \(\s*SELECT[\s\S]*?FROM seller_bills/i);
    });

    it('maps BigInt/Decimal raw rows into JSON-safe plain values (one row per person)', async () => {
      queryRawMock.mockResolvedValue([
        {
          seller_id: 6797n,
          person_name: 'Liêu Quang Vinh',
          revenue: new Prisma.Decimal('12345678'),
          total_orders: 42n,
          success_orders: 10n,
          cancelled_orders: 2n,
          total_commission: new Prisma.Decimal('987654'),
        },
      ]);

      const result = await service.commissionByPerson({
        from: '2026-04-01',
        to: '2026-04-30',
        companyId: '4',
      });

      expect(result).toEqual([
        {
          sellerId: '6797',
          personName: 'Liêu Quang Vinh',
          revenue: '12345678',
          totalOrders: 42,
          successOrders: 10,
          cancelledOrders: 2,
          totalCommission: '987654',
        },
      ]);
    });

    async function buildSql(svc: ReportsService): Promise<Prisma.Sql> {
      queryRawMock.mockResolvedValue([]);
      await svc.commissionByPerson({ from: '2026-04-01', to: '2026-04-30', companyId: '4' });
      return queryRawMock.mock.calls[queryRawMock.mock.calls.length - 1][0] as Prisma.Sql;
    }
  });

  describe('commissionByLevel (S2B — pie chart theo cấp hệ hoa hồng)', () => {
    it('rejects when companyId is missing (thuộc Screen 2, cùng điều kiện bắt buộc)', async () => {
      await expect(
        service.commissionByLevel({ from: '2026-04-01', to: '2026-04-30', companyId: '' }),
      ).rejects.toThrow();

      expect(queryRawMock).not.toHaveBeenCalled();
    });

    it('runs a single readonly raw query grouped by AffiliateLevel, scoped to the company', async () => {
      queryRawMock.mockResolvedValue([]);

      await service.commissionByLevel({ from: '2026-04-01', to: '2026-04-30', companyId: '4' });

      expect(queryRawMock).toHaveBeenCalledTimes(1);
      const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
      expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
      expect(sqlArg.sql).toMatch(/"ConfigAffiliateLevel"/);
      expect(sqlArg.sql).toMatch(/AffiliateLevel/);
      expect(sqlArg.values).toContain(4n);
    });

    it('maps BigInt/Decimal raw rows into JSON-safe plain values (one row per level)', async () => {
      queryRawMock.mockResolvedValue([
        { level_no: 1n, level_name: 'Đại sứ', total_commission: new Prisma.Decimal('2682494') },
        { level_no: 2n, level_name: 'Đồng hành', total_commission: new Prisma.Decimal('10936588') },
      ]);

      const result = await service.commissionByLevel({
        from: '2026-04-01',
        to: '2026-04-30',
        companyId: '4',
      });

      expect(result).toEqual([
        { levelNo: 1, levelName: 'Đại sứ', totalCommission: '2682494' },
        { levelNo: 2, levelName: 'Đồng hành', totalCommission: '10936588' },
      ]);
    });
  });
});
