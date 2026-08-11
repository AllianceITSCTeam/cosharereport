import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

/**
 * Reconciliation suite — hits the REAL readonly CoShare DB. Opt-in only
 * (`RECON_DB=1 npx jest reports.service.recon.spec.ts`), never a CI gate:
 * prod/test data drifts, so these numbers are only true as of the date noted below.
 *
 * Golden numbers refreshed 2026-08-11 directly against the `CoShareTest` DB —
 * superseding the 2026-08-10 numbers in
 * docs/requirements/commission-report/04-DB-Verification-Findings.md §C (1.218 orders /
 * Freetrend), which no longer match this DB (Company Id=14 no longer has Freetrend's
 * Code/Name — the test DB was reseeded, not just grown). See docs/db/conventions.md §5
 * for the full note. The [2000-01-01, 2030-01-01] range below stands in for "toàn kỳ".
 */
const describeIfReconDb = process.env.RECON_DB === '1' ? describe : describe.skip;

describeIfReconDb('ReportsService.commissionOverview — reconciliation vs golden numbers', () => {
  let service: ReportsService;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [ReportsService, PrismaService],
    }).compile();

    service = moduleRef.get(ReportsService);
    prisma = moduleRef.get(PrismaService);
    await prisma.$connect();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('matches golden numbers for the full period (docs/db/conventions.md §5, refreshed 2026-08-11)', async () => {
    const rows = await service.commissionOverview({ from: '2000-01-01', to: '2030-01-01' });

    const totalOrders = rows.reduce((sum, r) => sum + r.totalOrders, 0);
    const totalRevenue = rows.reduce((sum, r) => sum + Number(r.revenue), 0);
    const totalCommission = rows.reduce((sum, r) => sum + Number(r.totalCommission), 0);

    expect(totalOrders).toBe(142400);
    expect(Math.round(totalRevenue)).toBe(6151893571500);
    expect(Math.round(totalCommission)).toBe(74412265906);
  });

  it('never double-counts revenue across companies (fan-out guard, §C "BẪY FAN-OUT")', async () => {
    // A bill with multiple sellers must be pinned to exactly one company —
    // otherwise summing revenue per company overshoots the single-bill total
    // (the bug the verified SQL was specifically fixed to avoid).
    const rows = await service.commissionOverview({ from: '2000-01-01', to: '2030-01-01' });
    const totalRevenue = rows.reduce((sum, r) => sum + Number(r.revenue), 0);

    expect(Math.round(totalRevenue)).toBeLessThanOrEqual(6151893571500);
  });

  it('accounts for every bill, including ones whose seller has no company mapping', async () => {
    // seller_company LEFT JOINs by design (04-...Findings.md: mapping coverage was 100%
    // in the old dataset but is not guaranteed going forward) — unmapped bills must still
    // show up as a null-company row rather than silently vanishing from the totals.
    const rows = await service.commissionOverview({ from: '2000-01-01', to: '2030-01-01' });
    const unmapped = rows.find((r) => r.companyId === null);

    expect(unmapped).toBeDefined();
    expect(unmapped?.totalOrders).toBe(13400);
  });
});
