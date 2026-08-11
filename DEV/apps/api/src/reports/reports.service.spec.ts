import { Test } from '@nestjs/testing';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

describe('ReportsService.commissionOverview (Screen 1 — Hoa hồng tổng quan)', () => {
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

  it('runs a single readonly raw query (no company filter) for the given range', async () => {
    queryRawMock.mockResolvedValue([]);

    await service.commissionOverview({ from: '2026-04-01', to: '2026-04-30' });

    expect(queryRawMock).toHaveBeenCalledTimes(1);
    const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
    expect(sqlArg.sql.trim()).toMatch(/^WITH\s/i);
    expect(sqlArg.sql).not.toMatch(/\b(INSERT INTO|UPDATE\s+\w+\s+SET|DELETE FROM|CREATE TABLE|ALTER TABLE|DROP TABLE)\b/i);
    expect(sqlArg.sql).toMatch(/"MerchantBill"/);
    expect(sqlArg.sql).toMatch(/"MerchantBillCommission"/);
    expect(sqlArg.sql).toMatch(/"Company"/);
  });

  it('maps BigInt/Decimal raw rows into JSON-safe plain values (one row per company)', async () => {
    queryRawMock.mockResolvedValue([
      {
        company_id: 14n,
        company_name: 'Freetrend',
        revenue: new Prisma.Decimal('160191779'),
        total_orders: 1218n,
        success_orders: 0n,
        cancelled_orders: 0n,
        total_commission: new Prisma.Decimal('13621482'),
      },
    ]);

    const result = await service.commissionOverview({ from: '2026-04-01', to: '2026-04-30' });

    expect(result).toEqual([
      {
        companyId: '14',
        companyName: 'Freetrend',
        revenue: '160191779',
        totalOrders: 1218,
        successOrders: 0,
        cancelledOrders: 0,
        totalCommission: '13621482',
      },
    ]);
  });

  it('never sums order revenue twice for a company (grain = 1 row per bill, not per commission line)', async () => {
    // Regression guard for the fan-out trap documented in 04-DB-Verification-Findings.md §C:
    // joining Company through MerchantBillCommission.SellUserId directly (without first
    // pinning exactly one company per bill) double-counts bills that have multiple sellers.
    // Pinning is done via DISTINCT ON, not a per-bill correlated subquery — the latter doesn't
    // scale past a few thousand bills (see reports.service.recon.spec.ts).
    queryRawMock.mockResolvedValue([]);

    await service.commissionOverview({ from: '2026-04-01', to: '2026-04-30' });

    const sqlArg = queryRawMock.mock.calls[0][0] as Prisma.Sql;
    expect(sqlArg.sql).toMatch(/bill_company/i);
    expect(sqlArg.sql).toMatch(/DISTINCT ON/i);
  });
});
