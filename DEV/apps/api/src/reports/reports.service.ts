import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { toUtcDateRange } from '../common/utils/date-range';
import { normalizeTimezone } from '../common/utils/timezone.util';

interface CommissionOverviewRawRow {
  company_id: bigint | null;
  company_name: string | null;
  revenue: Prisma.Decimal;
  total_orders: bigint;
  success_orders: bigint;
  cancelled_orders: bigint;
  total_commission: Prisma.Decimal;
}

export interface CommissionOverviewRow {
  companyId: string | null;
  companyName: string | null;
  revenue: string;
  totalOrders: number;
  successOrders: number;
  cancelledOrders: number;
  totalCommission: string;
}

/**
 * Reference implementation for report endpoints — each report is a readonly
 * Prisma query (findMany/aggregate) against the CoShare schema.
 *
 * TODO: once `prisma db pull` has introspected the real CoShare database
 * (see prisma/schema.prisma), replace `ping()` with the first real report
 * query and add one method per report here.
 */
@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  async ping(): Promise<{ connected: boolean }> {
    await this.prisma.$queryRaw`SELECT 1`;
    return { connected: true };
  }

  /**
   * Screen 1 — Hoa hồng tổng quan: one row per Company, no company filter.
   * Grain pitfall (04-DB-Verification-Findings.md §C): a bill can have multiple
   * sellers, so `seller_company` pins exactly one company per bill (DISTINCT ON)
   * before summing revenue — summing after joining MerchantBillCommission directly
   * would double-count multi-seller bills. Bills whose seller has no company
   * mapping fall into a null-company row (company_id/company_name both null).
   */
  async commissionOverview(query: {
    from: string;
    to: string;
    timezone?: string;
  }): Promise<CommissionOverviewRow[]> {
    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);

    const rows = await this.prisma.$queryRaw<CommissionOverviewRawRow[]>(Prisma.sql`
      WITH seller_company AS (
        -- one company per bill, picked once via DISTINCT ON (not a per-bill correlated
        -- subquery — that doesn't scale past a few thousand bills, see reports.service.recon.spec.ts)
        SELECT DISTINCT ON (c."MerchantBillId")
               c."MerchantBillId" AS bill_id,
               cmap."CompanyId"   AS company_id
        FROM dbo."MerchantBillCommission" c
        JOIN dbo."UserLogin_Company_Mapping" cmap
             ON cmap."UserLoginId" = c."SellUserId" AND cmap."IsDeleted" = false
        WHERE c."IsDeleted" = false
        ORDER BY c."MerchantBillId", c."Id"
      ),
      bill_company AS (
        SELECT b."Id"         AS bill_id,
               b."TotalMoney" AS total_money,
               b."StatusBill" AS status_bill,
               sc.company_id  AS company_id
        FROM dbo."MerchantBill" b
        LEFT JOIN seller_company sc ON sc.bill_id = b."Id"
        WHERE b."IsDeleted" = false
          AND b."BillDate" >= ${gte} AND b."BillDate" <= ${lte}
      ),
      comm_per_bill AS (
        SELECT c."MerchantBillId" AS bill_id, SUM(c."CommisionAmount") AS commission
        FROM dbo."MerchantBillCommission" c
        WHERE c."IsDeleted" = false
        GROUP BY c."MerchantBillId"
      )
      SELECT
        co."Id"                                              AS company_id,
        COALESCE(co."ShortName", co."Name", co."Code")       AS company_name,
        COALESCE(SUM(bc.total_money), 0)             AS revenue,
        COUNT(*)                                     AS total_orders,
        COUNT(*) FILTER (WHERE bc.status_bill = 2)   AS success_orders,
        COUNT(*) FILTER (WHERE bc.status_bill = 3)   AS cancelled_orders,
        COALESCE(SUM(cpb.commission), 0)             AS total_commission
      FROM bill_company bc
      LEFT JOIN dbo."Company" co  ON co."Id" = bc.company_id
      LEFT JOIN comm_per_bill cpb ON cpb.bill_id = bc.bill_id
      GROUP BY co."Id"
      ORDER BY total_commission DESC
    `);

    return rows.map((r) => ({
      companyId: r.company_id === null ? null : String(r.company_id),
      companyName: r.company_name,
      revenue: String(r.revenue),
      totalOrders: Number(r.total_orders),
      successOrders: Number(r.success_orders),
      cancelledOrders: Number(r.cancelled_orders),
      totalCommission: String(r.total_commission),
    }));
  }

  async latestUsers() {
    return this.prisma.userLogin.findMany({
      select: {
        Log_CreatedDate: true,
        DisplayName: true,
        Username: true,
      },
      orderBy: { Log_CreatedDate: 'desc' },
      take: 10,
    });
  }
}
