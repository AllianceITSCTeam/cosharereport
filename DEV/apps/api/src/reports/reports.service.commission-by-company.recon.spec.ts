import { Test } from '@nestjs/testing';
import { PrismaService } from '../prisma/prisma.service';
import { ReportsService } from './reports.service';

/**
 * Reconciliation suite for Screen 2 — hits the REAL readonly CoShare DB. Opt-in only
 * (`RECON_DB=1 npx jest reports.service.commission-by-company.recon.spec.ts`), never a CI gate
 * (see reports.service.recon.spec.ts for why).
 *
 * Golden numbers queried 2026-08-12 against `CoShareTest`, companyId=12 (AllianceITSC) — the
 * company with the most commission rows (102,245 rows / 24 sellers) at the time, chosen because
 * `docs/db/conventions.md §5.1` shows the old golden-number company (Freetrend, Id=14) no longer
 * has any data on this DB. The [2000-01-01, 2030-01-01] range stands in for "toàn kỳ".
 *
 * This run is also what caught a real bug: `UserLogin_Company_Mapping.CompanyId` is bigint in
 * Postgres, but the DTO passes companyId as a route/query string — a bare text param failed with
 * "operator does not exist: bigint = text". Fixed via `parseCompanyId()` in reports.service.ts,
 * which parses+validates the string before binding it as a bigint. See docs/reports/
 * commission-by-company.md §Ghi chú.
 *
 * ⚠️ 2026-08-13: the `totalRevenue` golden number recorded here on 2026-08-12
 * (2,526,988,796,800) was WRONG — it was computed by calling the buggy `commissionByPerson()`
 * itself (via a throwaway script), so the recon test just re-validated the bug against its own
 * output instead of an independent truth. Manual QA caught it by comparing Screen 1's
 * per-company revenue against Screen 2's summed per-person revenue for the same
 * company/date range and finding Screen 2 ~2x too high. Root cause + fix: see the fan-out
 * guard comment on `ReportsService.commissionByPerson()`. The `totalRevenue` assertion below is
 * replaced with a cross-report invariant against `commissionOverview()` (Screen 1) instead of a
 * hardcoded number, so it can't silently re-validate a shared bug the same way again. `totalOrders`
 * and commission figures were NOT affected (orders already used `COUNT(DISTINCT MerchantBillId)`;
 * commission is intentionally summed over every row) — left as hardcoded golden numbers.
 */
const describeIfReconDb = process.env.RECON_DB === '1' ? describe : describe.skip;

describeIfReconDb('ReportsService — Screen 2 reconciliation vs golden numbers (companyId=12)', () => {
  let service: ReportsService;
  let prisma: PrismaService;

  const companyId = '12';
  const from = '2000-01-01';
  const to = '2030-01-01';

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

  it('commissionByPerson matches golden numbers for the full period (orders/commission unaffected by the 2026-08-13 revenue bug)', async () => {
    const rows = await service.commissionByPerson({ from, to, companyId });

    const totalOrders = rows.reduce((sum, r) => sum + r.totalOrders, 0);
    const totalCommission = rows.reduce((sum, r) => sum + Number(r.totalCommission), 0);

    expect(rows.length).toBe(24); // 24 sellers mapped to company 12
    expect(totalOrders).toBe(101825);
    expect(Math.round(totalCommission)).toBe(74386819469);
  });

  it('revenue reconciles against Screen 1 (commissionOverview) for the same company + period (regression guard, 2026-08-13)', async () => {
    // The bug: commissionByPerson summed a bill's TotalMoney once per commission ROW instead of
    // once per DISTINCT (seller, bill) pair, so a bill paying L1+L2+L3 to the same seller counted
    // its revenue 3x. Screen 1 pins exactly one company per bill and sums TotalMoney once per bill
    // — it's the independent source of truth this cross-check compares against, instead of a
    // hardcoded number that could (and did) silently re-encode the same bug.
    const [personRows, overviewRows] = await Promise.all([
      service.commissionByPerson({ from, to, companyId }),
      service.commissionOverview({ from, to }),
    ]);

    const screen2Revenue = personRows.reduce((sum, r) => sum + Number(r.revenue), 0);
    const screen1Revenue = Number(
      overviewRows.find((r) => r.companyId === companyId)?.revenue ?? 0,
    );

    expect(screen1Revenue).toBeGreaterThan(0);
    expect(Math.round(screen2Revenue)).toBe(Math.round(screen1Revenue));
  });

  it('commissionByLevel matches golden numbers per AffiliateLevel (2026-08-12)', async () => {
    const rows = await service.commissionByLevel({ from, to, companyId });

    expect(rows).toEqual([
      { levelNo: 1, levelName: 'Đại sứ', totalCommission: '512770082' },
      { levelNo: 2, levelName: 'Đồng hành', totalCommission: '73863738285' },
      { levelNo: 3, levelName: 'Lan tỏa', totalCommission: '10311102' },
    ]);
  });

  it('total commission reconciles between the by-person and by-level breakdowns (cross-check invariant)', async () => {
    // Both grids slice the SAME set of commission rows (SellUserId-attributed, scoped to
    // companyId=12) by a different dimension — person vs. level. Their totals must match exactly,
    // otherwise one of the two queries is silently dropping or double-counting rows.
    const [byPerson, byLevel] = await Promise.all([
      service.commissionByPerson({ from, to, companyId }),
      service.commissionByLevel({ from, to, companyId }),
    ]);

    const sumByPerson = byPerson.reduce((sum, r) => sum + Number(r.totalCommission), 0);
    const sumByLevel = byLevel.reduce((sum, r) => sum + Number(r.totalCommission), 0);

    expect(Math.round(sumByPerson)).toBe(Math.round(sumByLevel));
    expect(Math.round(sumByPerson)).toBe(74386819469);
  });

  it('rejects querying without a companyId — Screen 2 must never silently return all-company data', async () => {
    await expect(service.commissionByPerson({ from, to, companyId: '' })).rejects.toThrow();
    await expect(service.commissionByLevel({ from, to, companyId: '' })).rejects.toThrow();
  });
});
