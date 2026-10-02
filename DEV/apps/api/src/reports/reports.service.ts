import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { getCurrentMonthRange, getMonthRange, toUtcDateRange } from '../common/utils/date-range';
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

interface CommissionTrendRawRow {
  month: Date;
  revenue: Prisma.Decimal;
  total_orders: bigint;
  success_orders: bigint;
  cancelled_orders: bigint;
  total_commission: Prisma.Decimal;
}

export interface CommissionTrendRow {
  month: string;
  revenue: string;
  totalOrders: number;
  successOrders: number;
  cancelledOrders: number;
  totalCommission: string;
}

interface DashboardTopCtvRawRow {
  affiliate_user_id: bigint;
  display_name: string | null;
  total_commission: Prisma.Decimal;
}

export interface DashboardTopCtvRow {
  affiliateUserId: string;
  displayName: string | null;
  totalCommission: string;
}

interface DashboardCtvReferralRawRow {
  user_login_id: bigint;
  display_name: string | null;
  referral_code: string | null;
  direct_referrals: bigint;
}

export interface DashboardCtvReferralRow {
  userLoginId: string;
  displayName: string | null;
  referralCode: string | null;
  directReferrals: number;
}

/** Every bigint-typed id column fails with "operator does not exist: bigint = text" on a bare string param. */
function parseBigIntParam(value: string, paramName: string): bigint {
  if (!/^\d+$/.test(value)) {
    throw new BadRequestException(`${paramName} must be a positive integer`);
  }
  return BigInt(value);
}

function parseCompanyId(companyId: string): bigint {
  if (!companyId) {
    throw new BadRequestException('companyId is required for Screen 2 (Hoa hồng theo công ty)');
  }
  return parseBigIntParam(companyId, 'companyId');
}

/** Optional bigint filter — undefined/empty means "no filter", anything else must parse. */
function parseOptionalBigIntParam(value: string | undefined, paramName: string): bigint | null {
  if (value === undefined || value === '') return null;
  return parseBigIntParam(value, paramName);
}

type MerchantProductStatus = 'SELLING' | 'OUT_OF_STOCK' | 'HIDDEN';

interface MerchantProductRawRow {
  id: bigint;
  code: string | null;
  name: string | null;
  group_code: string | null;
  group_name: string | null;
  status: MerchantProductStatus;
  id_guid: string;
  total_count: bigint;
}

export interface MerchantProductRow {
  id: string;
  code: string | null;
  name: string | null;
  groupCode: string | null;
  groupName: string | null;
  status: MerchantProductStatus;
  link: string;
}

export interface MerchantProductQuery {
  code?: string;
  name?: string;
  groupProductId?: string;
  status?: MerchantProductStatus;
  page?: number;
  pageSize?: number;
}

export interface MerchantProductResult {
  rows: MerchantProductRow[];
  pagination: { page: number; pageSize: number; totalCount: number };
}

interface MerchantGroupProductRawRow {
  id: bigint;
  code: string | null;
  name: string | null;
}

export interface MerchantGroupProductOption {
  id: string;
  code: string | null;
  name: string | null;
}

type SalesCountSortBy = 'salesCount' | 'code' | 'name';
type SalesCountSortDir = 'asc' | 'desc';

interface SalesCountRawRow {
  id: bigint;
  code: string | null;
  name: string | null;
  group_code: string | null;
  group_name: string | null;
  sales_count: bigint;
  total_count: bigint;
}

export interface SalesCountRow {
  id: string;
  code: string | null;
  name: string | null;
  groupCode: string | null;
  groupName: string | null;
  salesCount: number;
}

export interface SalesCountQuery {
  from: string;
  to: string;
  timezone?: string;
  code?: string;
  name?: string;
  groupProductId?: string;
  page?: number;
  pageSize?: number;
  sortBy?: SalesCountSortBy;
  sortDir?: SalesCountSortDir;
}

export interface SalesCountResult {
  rows: SalesCountRow[];
  pagination: { page: number; pageSize: number; totalCount: number };
}

const SALES_COUNT_SORT_COLUMNS: Record<SalesCountSortBy, Prisma.Sql> = {
  salesCount: Prisma.sql`sales_count`,
  code: Prisma.sql`code`,
  name: Prisma.sql`name`,
};

interface TopGroupProductRawRow {
  id: bigint;
  code: string | null;
  name: string | null;
  sales_count: bigint;
  total_count: bigint;
}

export interface TopGroupProductRow {
  id: string;
  code: string | null;
  name: string | null;
  salesCount: number;
}

export interface TopGroupProductsQuery {
  from: string;
  to: string;
  timezone?: string;
  page?: number;
  pageSize?: number;
  sortDir?: 'asc' | 'desc';
}

export interface TopGroupProductsResult {
  rows: TopGroupProductRow[];
  pagination: { page: number; pageSize: number; totalCount: number };
}

type OrderStatusBucket = 'success' | 'cancelled' | 'other';

interface OrderStatusBreakdownRawRow {
  bucket: OrderStatusBucket;
  cnt: bigint;
}

export interface OrderStatusBreakdownResult {
  success: number;
  cancelled: number;
  other: number;
  total: number;
}

interface CommissionByPersonRawRow {
  seller_id: bigint;
  person_name: string | null;
  revenue: Prisma.Decimal;
  total_orders: bigint;
  success_orders: bigint;
  cancelled_orders: bigint;
  total_commission: Prisma.Decimal;
}

export interface CommissionByPersonRow {
  sellerId: string;
  personName: string | null;
  revenue: string;
  totalOrders: number;
  successOrders: number;
  cancelledOrders: number;
  totalCommission: string;
}

interface CompanyRawRow {
  id: bigint;
  name: string | null;
}

export interface CompanyOption {
  id: string;
  name: string | null;
}

interface CommissionByLevelRawRow {
  level_no: bigint | number;
  level_name: string | null;
  total_commission: Prisma.Decimal;
}

export interface CommissionByLevelRow {
  levelNo: number;
  levelName: string | null;
  totalCommission: string;
}

interface CommissionDetailRawRow {
  bill_id: bigint;
  order_code: string | null;
  order_date: Date | null;
  buyer_name: string | null;
  msnv: string | null;
  referrer_name: string | null;
  beneficiary_name: string | null;
  order_total: Prisma.Decimal;
  commission_amount: Prisma.Decimal;
  order_status: number | null;
  total_count: bigint;
  sum_order_total: Prisma.Decimal;
  sum_commission: Prisma.Decimal;
  success_orders: bigint;
  cancelled_orders: bigint;
}

export interface CommissionDetailRow {
  billId: string;
  orderCode: string | null;
  orderDate: string | null;
  buyerName: string | null;
  msnv: string | null;
  referrerName: string | null;
  beneficiaryName: string | null;
  orderTotal: string;
  commissionAmount: string;
  orderStatus: number | null;
}

export interface CommissionDetailSummary {
  totalOrders: number;
  successOrders: number;
  cancelledOrders: number;
  sumOrderTotal: string;
  sumCommission: string;
}

export interface CommissionDetailResult {
  rows: CommissionDetailRow[];
  summary: CommissionDetailSummary;
  pagination: { page: number; pageSize: number; totalCount: number };
}

export interface CommissionDetailExportResult {
  rows: CommissionDetailRow[];
  summary: CommissionDetailSummary;
  truncated: boolean;
}

/** Hard safety cap on unpaginated exports — see docs/reports/commission-orders.md §Xuất Excel. */
const EXPORT_ROW_CAP = 50000;

interface CommissionDetailQuery {
  from: string;
  to: string;
  companyId?: string;
  affiliateLevelId?: string;
  affiliateUserId?: string;
  msnv?: string;
  statusBill?: number;
  productType?: 'PHYSICAL' | 'NON_PHYSICAL';
  keyword?: string;
  timezone?: string;
}

interface MerchantBillDetailRawRow {
  item_name: string | null;
  quantity: Prisma.Decimal;
  unit_price: Prisma.Decimal;
  line_total: Prisma.Decimal;
}

export interface MerchantBillDetailRow {
  itemName: string | null;
  quantity: string;
  unitPrice: string;
  lineTotal: string;
}

interface CommissionLevelRawRow {
  id: bigint;
  level_no: number | null;
  name: string | null;
}

export interface CommissionLevelOption {
  id: string;
  levelNo: number | null;
  name: string | null;
}

interface CommissionBeneficiaryRawRow {
  id: bigint;
  name: string | null;
}

export interface CommissionBeneficiaryOption {
  id: string;
  name: string | null;
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

  /**
   * Dashboard — Xu hướng doanh thu & hoa hồng N tháng gần nhất (mặc định 6, tối đa 12),
   * kết thúc tại `toMonth` (mặc định tháng hiện tại). Không tách theo Công ty (khác
   * `commissionOverview`) — mục đích chỉ là xem xu hướng theo thời gian, nên không cần
   * dedup seller→company per bill.
   */
  async commissionTrend(query: {
    toMonth?: string;
    months?: number;
    timezone?: string;
  }): Promise<CommissionTrendRow[]> {
    const timezone = normalizeTimezone(query.timezone);
    const months = query.months && query.months > 0 ? Math.min(Math.floor(query.months), 12) : 6;
    const endMonth = query.toMonth ?? getCurrentMonthRange(timezone).to.slice(0, 7);
    const [endYear, endMonthNo] = endMonth.split('-').map(Number);
    const startMonthDate = new Date(Date.UTC(endYear, endMonthNo - months, 1));
    const startMonth = `${startMonthDate.getUTCFullYear()}-${String(startMonthDate.getUTCMonth() + 1).padStart(2, '0')}`;

    const { from } = getMonthRange(startMonth);
    const { to } = getMonthRange(endMonth);
    const { gte, lte } = toUtcDateRange(from, to, timezone);

    const rows = await this.prisma.$queryRaw<CommissionTrendRawRow[]>(Prisma.sql`
      WITH bill_filtered AS (
        SELECT b."Id", b."BillDate", b."TotalMoney", b."StatusBill"
        FROM dbo."MerchantBill" b
        WHERE b."IsDeleted" = false AND b."BillDate" >= ${gte} AND b."BillDate" <= ${lte}
      ),
      comm_per_bill AS (
        SELECT c."MerchantBillId" AS bill_id, SUM(c."CommisionAmount") AS commission
        FROM dbo."MerchantBillCommission" c
        WHERE c."IsDeleted" = false
        GROUP BY c."MerchantBillId"
      )
      SELECT
        date_trunc('month', bf."BillDate")           AS month,
        COALESCE(SUM(bf."TotalMoney"), 0)            AS revenue,
        COUNT(*)                                     AS total_orders,
        COUNT(*) FILTER (WHERE bf."StatusBill" = 2)  AS success_orders,
        COUNT(*) FILTER (WHERE bf."StatusBill" = 3)  AS cancelled_orders,
        COALESCE(SUM(cpb.commission), 0)             AS total_commission
      FROM bill_filtered bf
      LEFT JOIN comm_per_bill cpb ON cpb.bill_id = bf."Id"
      GROUP BY date_trunc('month', bf."BillDate")
      ORDER BY month ASC
    `);

    return rows.map((r) => ({
      month: r.month.toISOString().slice(0, 7),
      revenue: String(r.revenue),
      totalOrders: Number(r.total_orders),
      successOrders: Number(r.success_orders),
      cancelledOrders: Number(r.cancelled_orders),
      totalCommission: String(r.total_commission),
    }));
  }

  /**
   * Screen 2A — Hoa hồng theo công ty: drill-down theo NGƯỜI BÁN (SellUserId), bắt buộc companyId.
   * Cột "Hoa hồng" = hoa hồng người bán đó TẠO RA (chốt 2026-08-12, xem
   * docs/reports/commission-by-company.md §1) — SUM(CommisionAmount) các dòng có SellUserId = người đó,
   * KHÔNG phải AffiliateUserId (người nhận).
   *
   * Fan-out guard (bug tìm thấy 2026-08-13, xem Ghi chú trong commission-by-company.md): 1 đơn có
   * thể sinh NHIỀU dòng MerchantBillCommission cho CÙNG một SellUserId — mỗi dòng ứng với 1
   * AffiliateLevel được trả hoa hồng cho đơn đó (vd 1 đơn trả cả L1+L2+L3 → 3 dòng, cùng
   * SellUserId, khác AffiliateUserId/AffiliateLevel). Bản trước dùng LATERAL MAX(TotalMoney) rồi
   * SUM theo từng DÒNG hoa hồng ⇒ 1 đơn có 3 dòng thì doanh thu bị cộng 3 lần cho seller đó — phát
   * hiện khi đối chiếu thủ công thấy tổng doanh thu Screen 2 (theo người, cộng dồn) khác tổng
   * doanh thu Screen 1 (theo Cty) trên cùng 1 công ty/khoảng ngày.
   * Sửa: tách `seller_bills` = DISTINCT (seller, bill) TRƯỚC khi cộng doanh thu (mỗi đơn/seller chỉ
   * tính 1 lần), tách riêng `commission_stats` = SUM(CommisionAmount) trên MỌI dòng (không dedup —
   * mỗi dòng là 1 khoản hoa hồng thực trả, phải cộng đủ).
   */
  async commissionByPerson(query: {
    from: string;
    to: string;
    companyId: string;
    timezone?: string;
  }): Promise<CommissionByPersonRow[]> {
    const companyId = parseCompanyId(query.companyId);
    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);

    const rows = await this.prisma.$queryRaw<CommissionByPersonRawRow[]>(Prisma.sql`
      WITH scoped_commission AS (
        SELECT
          c."SellUserId"      AS seller_id,
          c."MerchantBillId"  AS bill_id,
          c."CommisionAmount" AS commission_amount
        FROM dbo."MerchantBillCommission" c
        JOIN dbo."UserLogin_Company_Mapping" cmap
             ON cmap."UserLoginId" = c."SellUserId" AND cmap."IsDeleted" = false
        JOIN dbo."MerchantBill" b ON b."Id" = c."MerchantBillId" AND b."IsDeleted" = false
        WHERE c."IsDeleted" = false
          AND cmap."CompanyId" = ${companyId}
          AND b."BillDate" >= ${gte} AND b."BillDate" <= ${lte}
      ),
      seller_bills AS (
        -- 1 seller có thể có nhiều dòng hoa hồng cho CÙNG 1 đơn (nhiều cấp) — pin (seller, bill)
        -- 1 lần trước khi cộng doanh thu/đếm đơn, tránh nhân đôi/ba doanh thu của đơn đó.
        SELECT DISTINCT seller_id, bill_id FROM scoped_commission
      ),
      order_stats AS (
        SELECT
          sb.seller_id,
          COUNT(*)                                   AS total_orders,
          COUNT(*) FILTER (WHERE b."StatusBill" = 2) AS success_orders,
          COUNT(*) FILTER (WHERE b."StatusBill" = 3) AS cancelled_orders,
          COALESCE(SUM(b."TotalMoney"), 0)           AS revenue
        FROM seller_bills sb
        JOIN dbo."MerchantBill" b ON b."Id" = sb.bill_id
        GROUP BY sb.seller_id
      ),
      commission_stats AS (
        SELECT seller_id, COALESCE(SUM(commission_amount), 0) AS total_commission
        FROM scoped_commission
        GROUP BY seller_id
      )
      SELECT
        seller."Id"          AS seller_id,
        seller."DisplayName" AS person_name,
        os.total_orders      AS total_orders,
        os.success_orders    AS success_orders,
        os.cancelled_orders  AS cancelled_orders,
        os.revenue           AS revenue,
        cs.total_commission  AS total_commission
      FROM commission_stats cs
      JOIN order_stats os ON os.seller_id = cs.seller_id
      JOIN dbo."UserLogin" seller ON seller."Id" = cs.seller_id
      ORDER BY cs.total_commission DESC
    `);

    return rows.map((r) => ({
      sellerId: String(r.seller_id),
      personName: r.person_name,
      revenue: String(r.revenue),
      totalOrders: Number(r.total_orders),
      successOrders: Number(r.success_orders),
      cancelledOrders: Number(r.cancelled_orders),
      totalCommission: String(r.total_commission),
    }));
  }

  /**
   * Screen 2B — biểu đồ tròn: hoa hồng theo cấp hệ (AffiliateLevel). `companyId` optional:
   * Screen 2B (DTO bắt buộc companyId ở lớp validation) luôn truyền nó, scoping theo công ty
   * dùng EXISTS trên SellUserId → company mapping (cùng cách Screen 2A/Queries.sql đã verify);
   * dashboard "toàn hệ thống" gọi method này KHÔNG truyền companyId để bỏ hẳn điều kiện EXISTS.
   */
  async commissionByLevel(query: {
    from: string;
    to: string;
    companyId?: string;
    timezone?: string;
  }): Promise<CommissionByLevelRow[]> {
    const companyId = query.companyId !== undefined ? parseCompanyId(query.companyId) : null;
    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);
    const companyFilter =
      companyId !== null
        ? Prisma.sql`AND EXISTS (
              SELECT 1 FROM dbo."UserLogin_Company_Mapping" m
              WHERE m."UserLoginId" = c."SellUserId" AND m."IsDeleted" = false
                AND m."CompanyId" = ${companyId})`
        : Prisma.empty;

    const rows = await this.prisma.$queryRaw<CommissionByLevelRawRow[]>(Prisma.sql`
      SELECT
        c."AffiliateLevel"                              AS level_no,
        COALESCE(lvl."NameInCommision", lvl."Name",
                 'Cấp ' || c."AffiliateLevel")           AS level_name,
        COALESCE(SUM(c."CommisionAmount"), 0)            AS total_commission
      FROM dbo."MerchantBillCommission" c
      JOIN dbo."MerchantBill" b ON b."Id" = c."MerchantBillId" AND b."IsDeleted" = false
      LEFT JOIN dbo."ConfigAffiliateLevel" lvl ON lvl."Id" = c."AffiliateLevelId"
      WHERE c."IsDeleted" = false
        AND b."BillDate" >= ${gte} AND b."BillDate" <= ${lte}
        ${companyFilter}
      GROUP BY c."AffiliateLevel", lvl."NameInCommision", lvl."Name"
      ORDER BY level_no
    `);

    return rows.map((r) => ({
      levelNo: Number(r.level_no),
      levelName: r.level_name,
      totalCommission: String(r.total_commission),
    }));
  }

  /**
   * Screen 3 — Báo cáo đơn hàng: danh sách chi tiết đơn, PHÂN TRANG, có dòng summary.
   *
   * Grain (chốt 2026-08-12, xem docs/reports/commission-orders.md §1): 1 dòng lưới = 1
   * `MerchantBill`, KHÔNG phải 1 dòng `MerchantBillCommission` như gợi ý trong
   * 01-Commission-Report-DataModel.md §3 — vì 1 đơn có thể trả hoa hồng cho NHIỀU
   * người/cấp (đã thấy ở bug Screen 2 2026-08-13). `commission_agg` gộp TRƯỚC theo
   * `MerchantBillId`: `SUM(CommisionAmount)` trên MỌI dòng của đơn đó (không chỉ phần của
   * 1 người/cấp đang lọc — filter theo affiliateLevelId/affiliateUserId/companyId chỉ
   * THU HẸP đơn nào xuất hiện, KHÔNG thu hẹp số tiền hiển thị trên dòng đơn đó, xem
   * EXISTS bên dưới), và `STRING_AGG(DISTINCT ...)` gộp tên nhiều người hưởng/người giới
   * thiệu vào 1 ô.
   *
   * Phân trang + summary tính trong CÙNG 1 query bằng window function (`OVER()`), áp dụng
   * SAU khi lọc nhưng TRƯỚC `LIMIT/OFFSET` — tránh 2 query rows/summary lệch filter nhau
   * (cảnh báo trong 02-Commission-Report-Queries.sql).
   */
  async commissionDetail(
    query: CommissionDetailQuery & { page?: number; pageSize?: number },
  ): Promise<CommissionDetailResult> {
    if (!query.from || !query.to) {
      throw new BadRequestException('from/to are required for Screen 3 (Báo cáo đơn hàng)');
    }

    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);
    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.floor(query.pageSize) : 50;
    const offset = (page - 1) * pageSize;

    const conditions = this.buildCommissionDetailFilter(query, gte, lte);
    const whereClause = Prisma.join(conditions, ' AND ');

    const rows = await this.prisma.$queryRaw<CommissionDetailRawRow[]>(Prisma.sql`
      ${this.buildCommissionDetailCte(whereClause)}
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return {
      rows: this.mapCommissionDetailRows(rows),
      summary: this.summaryFromRows(rows),
      pagination: {
        page,
        pageSize,
        totalCount: rows[0] ? Number(rows[0].total_count) : 0,
      },
    };
  }

  /**
   * Điều kiện lọc dùng chung cho cả bản phân trang (`commissionDetail`) lẫn bản xuất Excel
   * (`commissionDetailExport`) — tách riêng để 2 bản KHÔNG BAO GIỜ lệch filter với nhau.
   */
  private buildCommissionDetailFilter(
    query: CommissionDetailQuery,
    gte: Date,
    lte: Date,
  ): Prisma.Sql[] {
    const companyId = parseOptionalBigIntParam(query.companyId, 'companyId');
    const affiliateLevelId = parseOptionalBigIntParam(query.affiliateLevelId, 'affiliateLevelId');
    const affiliateUserId = parseOptionalBigIntParam(query.affiliateUserId, 'affiliateUserId');

    const conditions: Prisma.Sql[] = [
      Prisma.sql`b."IsDeleted" = false`,
      Prisma.sql`b."BillDate" >= ${gte} AND b."BillDate" <= ${lte}`,
    ];

    if (companyId !== null) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM dbo."MerchantBillCommission" c
        JOIN dbo."UserLogin_Company_Mapping" m ON m."UserLoginId" = c."SellUserId" AND m."IsDeleted" = false
        WHERE c."MerchantBillId" = b."Id" AND c."IsDeleted" = false AND m."CompanyId" = ${companyId}
      )`);
    }
    if (affiliateLevelId !== null) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM dbo."MerchantBillCommission" c
        WHERE c."MerchantBillId" = b."Id" AND c."IsDeleted" = false AND c."AffiliateLevelId" = ${affiliateLevelId}
      )`);
    }
    if (affiliateUserId !== null) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM dbo."MerchantBillCommission" c
        WHERE c."MerchantBillId" = b."Id" AND c."IsDeleted" = false AND c."AffiliateUserId" = ${affiliateUserId}
      )`);
    }
    if (query.statusBill !== undefined) {
      conditions.push(Prisma.sql`b."StatusBill" = ${query.statusBill}`);
    }
    if (query.msnv) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM dbo."ConfigEmployee" e
        WHERE e."UserLoginId" = buyer."Id" AND e."IsDeleted" = false AND e."EmployeeCode" = ${query.msnv}
      )`);
    }
    // Loại sp: không có đơn trộn (chốt §4) — PHI VẬT LÝ = có mặt hàng ZALOOA, VẬT LÝ = không có.
    if (query.productType === 'NON_PHYSICAL') {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM dbo."MerchantBillDetail" d
        JOIN dbo."MerchantProduct" p ON p."Id" = d."ProductId"
        WHERE d."MerchantBillId" = b."Id" AND d."IsDeleted" = false AND p."Code" ILIKE '%ZALOOA%'
      )`);
    } else if (query.productType === 'PHYSICAL') {
      conditions.push(Prisma.sql`NOT EXISTS (
        SELECT 1 FROM dbo."MerchantBillDetail" d
        JOIN dbo."MerchantProduct" p ON p."Id" = d."ProductId"
        WHERE d."MerchantBillId" = b."Id" AND d."IsDeleted" = false AND p."Code" ILIKE '%ZALOOA%'
      )`);
    }
    if (query.keyword) {
      const kw = `%${query.keyword}%`;
      conditions.push(Prisma.sql`(
        EXISTS (
          SELECT 1 FROM dbo."Order_MerchantBill_Mapping" omb
          JOIN dbo."Order" o ON o."Id" = omb."OrderId" AND o."IsDeleted" = false
          WHERE omb."BillId" = b."Id" AND omb."IsDeleted" = false AND o."OrderNumber" ILIKE ${kw}
        )
        OR buyer."DisplayName" ILIKE ${kw}
        OR ca.beneficiary_name ILIKE ${kw}
        OR ca.referrer_name ILIKE ${kw}
      )`);
    }

    return conditions;
  }

  /** SQL dùng chung: `commission_agg` + `filtered` CTE, chưa có LIMIT/OFFSET — caller tự bọc thêm outer SELECT + LIMIT. */
  private buildCommissionDetailCte(whereClause: Prisma.Sql): Prisma.Sql {
    return Prisma.sql`
      WITH commission_agg AS (
        SELECT
          c."MerchantBillId"                                AS bill_id,
          SUM(c."CommisionAmount")                          AS total_commission,
          STRING_AGG(DISTINCT ben."DisplayName", ', ')      AS beneficiary_name,
          STRING_AGG(DISTINCT seller."DisplayName", ', ')   AS referrer_name
        FROM dbo."MerchantBillCommission" c
        LEFT JOIN dbo."UserLogin" ben    ON ben."Id" = c."AffiliateUserId"
        LEFT JOIN dbo."UserLogin" seller ON seller."Id" = c."SellUserId"
        WHERE c."IsDeleted" = false
        GROUP BY c."MerchantBillId"
      ),
      filtered AS (
        SELECT
          b."Id"                                                 AS bill_id,
          (
            SELECT o."OrderNumber"
            FROM dbo."Order_MerchantBill_Mapping" omb
            JOIN dbo."Order" o ON o."Id" = omb."OrderId" AND o."IsDeleted" = false
            WHERE omb."BillId" = b."Id" AND omb."IsDeleted" = false
            ORDER BY omb."Id"
            LIMIT 1
          )                                                       AS order_code,
          b."BillDate"                                           AS order_date,
          COALESCE(buyer."DisplayName", b."RenterReceiverName")  AS buyer_name,
          (
            SELECT e."EmployeeCode"
            FROM dbo."ConfigEmployee" e
            WHERE e."UserLoginId" = buyer."Id" AND e."IsDeleted" = false
            ORDER BY e."Id"
            LIMIT 1
          )                                                       AS msnv,
          ca.referrer_name                                       AS referrer_name,
          ca.beneficiary_name                                    AS beneficiary_name,
          b."TotalMoney"                                         AS order_total,
          COALESCE(ca.total_commission, 0)                       AS commission_amount,
          b."StatusBill"                                         AS order_status
        FROM dbo."MerchantBill" b
        LEFT JOIN commission_agg ca      ON ca.bill_id = b."Id"
        LEFT JOIN dbo."UserLogin" buyer  ON buyer."ID_GUID" = b."RenterGUID"
        WHERE ${whereClause}
      )
      SELECT
        *,
        COUNT(*) OVER()                                    AS total_count,
        COALESCE(SUM(order_total) OVER(), 0)                AS sum_order_total,
        COALESCE(SUM(commission_amount) OVER(), 0)          AS sum_commission,
        COUNT(*) FILTER (WHERE order_status = 2) OVER()    AS success_orders,
        COUNT(*) FILTER (WHERE order_status = 3) OVER()    AS cancelled_orders
      FROM filtered
      ORDER BY order_date DESC, bill_id DESC
    `;
  }

  private mapCommissionDetailRows(rows: CommissionDetailRawRow[]): CommissionDetailRow[] {
    return rows.map((r) => ({
      billId: String(r.bill_id),
      orderCode: r.order_code,
      orderDate: r.order_date ? r.order_date.toISOString() : null,
      buyerName: r.buyer_name,
      msnv: r.msnv,
      referrerName: r.referrer_name,
      beneficiaryName: r.beneficiary_name,
      orderTotal: String(r.order_total),
      commissionAmount: String(r.commission_amount),
      orderStatus: r.order_status,
    }));
  }

  private summaryFromRows(rows: CommissionDetailRawRow[]): CommissionDetailSummary {
    const first = rows[0];
    return {
      totalOrders: first ? Number(first.total_count) : 0,
      successOrders: first ? Number(first.success_orders) : 0,
      cancelledOrders: first ? Number(first.cancelled_orders) : 0,
      sumOrderTotal: first ? String(first.sum_order_total) : '0',
      sumCommission: first ? String(first.sum_commission) : '0',
    };
  }

  /**
   * Screen 3 — Xuất Excel: TOÀN BỘ đơn khớp filter (không phân trang, chốt với user 2026-08-13),
   * dùng lại y hệt `buildCommissionDetailFilter`/CTE của `commissionDetail` — 2 bản không bao giờ
   * lệch điều kiện lọc. Giới hạn an toàn `EXPORT_ROW_CAP` dòng để tránh OOM nếu filter quá rộng;
   * `truncated: true` báo cho FE biết khi tổng thực > cap để cảnh báo người dùng thu hẹp filter.
   */
  async commissionDetailExport(query: CommissionDetailQuery): Promise<CommissionDetailExportResult> {
    if (!query.from || !query.to) {
      throw new BadRequestException('from/to are required for Screen 3 (Báo cáo đơn hàng)');
    }

    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);
    const conditions = this.buildCommissionDetailFilter(query, gte, lte);
    const whereClause = Prisma.join(conditions, ' AND ');

    const rows = await this.prisma.$queryRaw<CommissionDetailRawRow[]>(Prisma.sql`
      ${this.buildCommissionDetailCte(whereClause)}
      LIMIT ${EXPORT_ROW_CAP}
    `);

    const first = rows[0];
    const totalCount = first ? Number(first.total_count) : 0;

    return {
      rows: this.mapCommissionDetailRows(rows),
      summary: this.summaryFromRows(rows),
      truncated: totalCount > EXPORT_ROW_CAP,
    };
  }

  /** Screen 3 — expander "▸ Chi tiết đơn hàng": mặt hàng của 1 đơn (Mặt hàng/SL/Đơn giá/Thành tiền). */
  async commissionDetailItems(billId: string): Promise<MerchantBillDetailRow[]> {
    const id = parseBigIntParam(billId, 'billId');

    const rows = await this.prisma.$queryRaw<MerchantBillDetailRawRow[]>(Prisma.sql`
      SELECT
        d."ProductName"  AS item_name,
        d."Quantity"     AS quantity,
        d."ProductPrice" AS unit_price,
        d."TotalMoney"   AS line_total
      FROM dbo."MerchantBillDetail" d
      WHERE d."MerchantBillId" = ${id} AND d."IsDeleted" = false
      ORDER BY d."OrderNo"
    `);

    return rows.map((r) => ({
      itemName: r.item_name,
      quantity: String(r.quantity),
      unitPrice: String(r.unit_price),
      lineTotal: String(r.line_total),
    }));
  }

  /** Danh sách cấp hệ hoa hồng cho filter "Cấp hệ hoa hồng" ở Screen 3. */
  async commissionLevels(): Promise<CommissionLevelOption[]> {
    const rows = await this.prisma.$queryRaw<CommissionLevelRawRow[]>(Prisma.sql`
      SELECT
        "Id"                                    AS id,
        "Level"                                 AS level_no,
        COALESCE("NameInCommision", "Name")     AS name
      FROM dbo."ConfigAffiliateLevel"
      WHERE "IsDeleted" = false
      ORDER BY "Level"
    `);

    return rows.map((r) => ({
      id: String(r.id),
      levelNo: r.level_no === null ? null : Number(r.level_no),
      name: r.name,
    }));
  }

  /**
   * Danh sách người hưởng hoa hồng (AffiliateUserId) có phát sinh hoa hồng trong khoảng
   * ngày (và công ty, nếu có), cho filter "Người hưởng hoa hồng" ở Screen 3.
   */
  async commissionBeneficiaries(query: {
    from: string;
    to: string;
    companyId?: string;
    timezone?: string;
  }): Promise<CommissionBeneficiaryOption[]> {
    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);
    const companyId = parseOptionalBigIntParam(query.companyId, 'companyId');

    const conditions: Prisma.Sql[] = [
      Prisma.sql`c."IsDeleted" = false`,
      Prisma.sql`b."BillDate" >= ${gte} AND b."BillDate" <= ${lte}`,
    ];
    if (companyId !== null) {
      conditions.push(Prisma.sql`EXISTS (
        SELECT 1 FROM dbo."UserLogin_Company_Mapping" m
        WHERE m."UserLoginId" = c."SellUserId" AND m."IsDeleted" = false AND m."CompanyId" = ${companyId}
      )`);
    }

    const rows = await this.prisma.$queryRaw<CommissionBeneficiaryRawRow[]>(Prisma.sql`
      SELECT DISTINCT ben."Id" AS id, ben."DisplayName" AS name
      FROM dbo."MerchantBillCommission" c
      JOIN dbo."MerchantBill" b  ON b."Id" = c."MerchantBillId" AND b."IsDeleted" = false
      JOIN dbo."UserLogin" ben   ON ben."Id" = c."AffiliateUserId"
      WHERE ${Prisma.join(conditions, ' AND ')}
      ORDER BY name
    `);

    return rows.map((r) => ({ id: String(r.id), name: r.name }));
  }

  /**
   * Hàng hóa trên website — danh sách sản phẩm, lọc theo mã/tên/nhóm/trạng thái.
   * Trạng thái không có cột sẵn trên MerchantProduct, suy ra (chốt với user 2026-10-01, SỬA lại
   * 2026-10-02 — 2 lần — xem Ghi chú trong docs/reports/merchant-products.md):
   *   - HIDDEN: IsHideOnWeb OR IsSuspended OR IsDisable (ưu tiên cao nhất). IsDisable ĐÃ bị bỏ rồi
   *     ĐƯA LẠI vào rule này theo yêu cầu trực tiếp của user (2026-10-02, lần 2) — dù có bằng chứng
   *     12/2238 sản phẩm IsDisable=true từng phát sinh đơn hàng thật (xem docs), user xác nhận vẫn
   *     muốn coi IsDisable=true là "Đã ẩn" trên report này.
   *   - OUT_OF_STOCK: còn lại, InventoryMoment.StockBooked <= 0 (hoặc không có dòng tồn kho).
   *     ⚠️ TẠM DÙNG StockBooked thay vì StockActual (chốt lại với user 2026-10-02) vì StockActual
   *     luôn NULL trên toàn bộ dữ liệu hiện có và bảng Inventory rỗng hoàn toàn — không có cột tồn
   *     kho nào khác khả dụng. StockBooked (số lượng đang đặt/giữ chỗ) KHÔNG cùng nghĩa với "còn
   *     hàng để bán" — đây là proxy tạm để có dữ liệu demo đa dạng, không phải định nghĩa chính xác.
   *     Cần CoShare xác nhận nguồn tồn kho đúng trước khi coi rule này là chính thức.
   *   - SELLING: còn lại
   * mã/tên/nhóm lọc TRONG CTE `base` (trên cột gốc của MerchantProduct); status lọc Ở WHERE
   * NGOÀI `base` (trên cột đã tính CASE) — 2 lớp WHERE không gộp chung được vì status là cột
   * suy ra, còn alias "p"/"gp" không còn tồn tại ngoài phạm vi CTE.
   */
  async merchantProducts(query: MerchantProductQuery): Promise<MerchantProductResult> {
    const groupProductId = parseOptionalBigIntParam(query.groupProductId, 'groupProductId');
    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.floor(query.pageSize) : 50;
    const offset = (page - 1) * pageSize;

    const innerConditions: Prisma.Sql[] = [Prisma.sql`p."IsDeleted" = false`];
    if (query.code) {
      innerConditions.push(Prisma.sql`p."Code" ILIKE ${`%${query.code}%`}`);
    }
    if (query.name) {
      innerConditions.push(Prisma.sql`p."Name" ILIKE ${`%${query.name}%`}`);
    }
    if (groupProductId !== null) {
      innerConditions.push(Prisma.sql`p."MerchantGroupProductId" = ${groupProductId}`);
    }

    const outerConditions: Prisma.Sql[] = [];
    if (query.status) {
      outerConditions.push(Prisma.sql`status = ${query.status}`);
    }
    const outerWhereClause =
      outerConditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(outerConditions, ' AND ')}` : Prisma.empty;

    const rows = await this.prisma.$queryRaw<MerchantProductRawRow[]>(Prisma.sql`
      WITH base AS (
        SELECT
          p."Id"    AS id,
          p."Code"    AS code,
          p."Name"    AS name,
          gp."Code"   AS group_code,
          gp."Name"   AS group_name,
          p."ID_GUID" AS id_guid,
          CASE
            WHEN p."IsHideOnWeb" OR p."IsSuspended" OR p."IsDisable" THEN 'HIDDEN'
            WHEN COALESCE(im."StockBooked", 0) <= 0 THEN 'OUT_OF_STOCK'
            ELSE 'SELLING'
          END AS status
        FROM dbo."MerchantProduct" p
        LEFT JOIN dbo."MerchantGroupProduct" gp ON gp."Id" = p."MerchantGroupProductId"
        LEFT JOIN dbo."InventoryMoment" im ON im."ProductId" = p."Id"
        WHERE ${Prisma.join(innerConditions, ' AND ')}
      )
      SELECT *, COUNT(*) OVER() AS total_count
      FROM base
      ${outerWhereClause}
      ORDER BY code
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return {
      rows: rows.map((r) => ({
        id: String(r.id),
        code: r.code,
        name: r.name,
        groupCode: r.group_code,
        groupName: r.group_name,
        status: r.status,
        link: `https://coshare.vn/product/${r.id_guid}`,
      })),
      pagination: {
        page,
        pageSize,
        totalCount: rows[0] ? Number(rows[0].total_count) : 0,
      },
    };
  }

  /** Danh sách nhóm hàng cho filter "Nhóm hàng" của báo cáo Hàng hóa trên website. */
  async merchantProductGroups(): Promise<MerchantGroupProductOption[]> {
    const rows = await this.prisma.$queryRaw<MerchantGroupProductRawRow[]>(Prisma.sql`
      SELECT "Id" AS id, "Code" AS code, "Name" AS name
      FROM dbo."MerchantGroupProduct"
      WHERE "IsDeleted" = false
      ORDER BY "Name"
    `);

    return rows.map((r) => ({ id: String(r.id), code: r.code, name: r.name }));
  }

  /**
   * Thống kê lượt bán — TOÀN BỘ sản phẩm (kể cả chưa từng bán), kèm "lượt bán" = SUM(Quantity)
   * các dòng MerchantBillDetail thuộc đơn ĐÃ GIAO (Order.OrderStatusCode='DELIVERED', tương đương
   * OrderStatusId=10), trong khoảng BillDate lọc.
   * SỬA 2026-10-02: ban đầu chốt lọc theo MerchantBill.StatusBill=2 ("Thành công") nhưng phát hiện
   * TOÀN BỘ 1234 đơn trong DB hiện tại đều ở StatusBill=1 ("Đang xử lý") — không đơn nào từng đạt
   * StatusBill=2/3 — nên report luôn trả về 0 lượt bán cho mọi sản phẩm. User xác nhận lại: trạng
   * thái "đã giao" thực tế được theo dõi trên `Order.OrderStatusCode`/`OrderStatusId` (qua
   * `Order_MerchantBill_Mapping`), không phải `MerchantBill.StatusBill`. Đã verify 1 bill chỉ map
   * với đúng 1 Order (không fan-out nhân đôi Quantity khi JOIN).
   */
  async salesCount(query: SalesCountQuery): Promise<SalesCountResult> {
    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);
    const groupProductId = parseOptionalBigIntParam(query.groupProductId, 'groupProductId');
    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.floor(query.pageSize) : 50;
    const offset = (page - 1) * pageSize;
    const sortColumn = SALES_COUNT_SORT_COLUMNS[query.sortBy ?? 'salesCount'];
    const sortDir = query.sortDir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    const conditions: Prisma.Sql[] = [];
    if (query.code) {
      conditions.push(Prisma.sql`code ILIKE ${`%${query.code}%`}`);
    }
    if (query.name) {
      conditions.push(Prisma.sql`name ILIKE ${`%${query.name}%`}`);
    }
    if (groupProductId !== null) {
      conditions.push(Prisma.sql`group_id = ${groupProductId}`);
    }
    const whereClause = conditions.length > 0 ? Prisma.sql`WHERE ${Prisma.join(conditions, ' AND ')}` : Prisma.empty;

    const rows = await this.prisma.$queryRaw<SalesCountRawRow[]>(Prisma.sql`
      WITH sales AS (
        SELECT d."ProductId" AS product_id, SUM(d."Quantity") AS sales_count
        FROM dbo."MerchantBillDetail" d
        JOIN dbo."MerchantBill" b ON b."Id" = d."MerchantBillId" AND b."IsDeleted" = false
        JOIN dbo."Order_MerchantBill_Mapping" omb ON omb."BillId" = b."Id" AND omb."IsDeleted" = false
        JOIN dbo."Order" o ON o."Id" = omb."OrderId" AND o."IsDeleted" = false
        WHERE d."IsDeleted" = false
          AND (o."OrderStatusCode" = 'DELIVERED' OR o."OrderStatusId" = 10)
          AND b."BillDate" >= ${gte} AND b."BillDate" <= ${lte}
        GROUP BY d."ProductId"
      ), base AS (
        SELECT
          p."Id"                        AS id,
          p."Code"                      AS code,
          p."Name"                      AS name,
          p."MerchantGroupProductId"    AS group_id,
          gp."Code"                     AS group_code,
          gp."Name"                     AS group_name,
          COALESCE(s.sales_count, 0)    AS sales_count
        FROM dbo."MerchantProduct" p
        LEFT JOIN dbo."MerchantGroupProduct" gp ON gp."Id" = p."MerchantGroupProductId"
        LEFT JOIN sales s ON s.product_id = p."Id"
        WHERE p."IsDeleted" = false
      )
      SELECT *, COUNT(*) OVER() AS total_count
      FROM base
      ${whereClause}
      ORDER BY ${sortColumn} ${sortDir}, id ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return {
      rows: rows.map((r) => ({
        id: String(r.id),
        code: r.code,
        name: r.name,
        groupCode: r.group_code,
        groupName: r.group_name,
        salesCount: Number(r.sales_count),
      })),
      pagination: {
        page,
        pageSize,
        totalCount: rows[0] ? Number(rows[0].total_count) : 0,
      },
    };
  }

  /**
   * Top nhóm hàng bán chạy — biến thể của `salesCount`, group theo `MerchantGroupProductId`
   * thay vì từng sản phẩm. Nhóm chưa từng bán vẫn hiện với sales_count=0 (LEFT JOIN từ catalog).
   * "Lượt bán" dùng đúng định nghĩa đã sửa ở `salesCount` (xem comment ở đó): đơn ĐÃ GIAO
   * (Order.OrderStatusCode='DELIVERED'/OrderStatusId=10 qua Order_MerchantBill_Mapping), không
   * phải MerchantBill.StatusBill.
   */
  async topGroupProducts(query: TopGroupProductsQuery): Promise<TopGroupProductsResult> {
    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);
    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.floor(query.pageSize) : 50;
    const offset = (page - 1) * pageSize;
    const sortDir = query.sortDir === 'asc' ? Prisma.sql`ASC` : Prisma.sql`DESC`;

    const rows = await this.prisma.$queryRaw<TopGroupProductRawRow[]>(Prisma.sql`
      WITH sales AS (
        SELECT p."MerchantGroupProductId" AS group_id, SUM(d."Quantity") AS sales_count
        FROM dbo."MerchantBillDetail" d
        JOIN dbo."MerchantBill" b ON b."Id" = d."MerchantBillId" AND b."IsDeleted" = false
        JOIN dbo."Order_MerchantBill_Mapping" omb ON omb."BillId" = b."Id" AND omb."IsDeleted" = false
        JOIN dbo."Order" o ON o."Id" = omb."OrderId" AND o."IsDeleted" = false
        JOIN dbo."MerchantProduct" p ON p."Id" = d."ProductId" AND p."IsDeleted" = false
        WHERE d."IsDeleted" = false
          AND (o."OrderStatusCode" = 'DELIVERED' OR o."OrderStatusId" = 10)
          AND b."BillDate" >= ${gte} AND b."BillDate" <= ${lte}
        GROUP BY p."MerchantGroupProductId"
      )
      SELECT
        gp."Id"                       AS id,
        gp."Code"                     AS code,
        gp."Name"                     AS name,
        COALESCE(s.sales_count, 0)    AS sales_count,
        COUNT(*) OVER()               AS total_count
      FROM dbo."MerchantGroupProduct" gp
      LEFT JOIN sales s ON s.group_id = gp."Id"
      WHERE gp."IsDeleted" = false
      ORDER BY sales_count ${sortDir}, id ASC
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    return {
      rows: rows.map((r) => ({
        id: String(r.id),
        code: r.code,
        name: r.name,
        salesCount: Number(r.sales_count),
      })),
      pagination: {
        page,
        pageSize,
        totalCount: rows[0] ? Number(rows[0].total_count) : 0,
      },
    };
  }

  /**
   * Dashboard — Tỷ lệ đơn thành công/huỷ trong 1 tháng. "Thành công" = Order.OrderStatusCode
   * ='DELIVERED'/OrderStatusId=10 (cùng định nghĩa đã chốt ở `salesCount`); "huỷ" =
   * OrderStatusCode bắt đầu bằng 'CANCELLED' (chốt với user 2026-10-02, khớp
   * CANCELLED_BYRENTER/CANCELLED_BYADMIN — cả 2 đều có IsCancel=true trong DB thật). Còn lại rơi
   * vào "other" (đang xử lý/đang giao...). Dùng INNER JOIN tới Order như `salesCount`/
   * `topGroupProducts` — bill không map được Order bị loại khỏi report, không tính vào "other".
   */
  async orderStatusBreakdown(query: {
    from: string;
    to: string;
    timezone?: string;
  }): Promise<OrderStatusBreakdownResult> {
    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);

    const rows = await this.prisma.$queryRaw<OrderStatusBreakdownRawRow[]>(Prisma.sql`
      SELECT
        CASE
          WHEN o."OrderStatusCode" = 'DELIVERED' OR o."OrderStatusId" = 10 THEN 'success'
          WHEN o."OrderStatusCode" LIKE 'CANCELLED%' THEN 'cancelled'
          ELSE 'other'
        END AS bucket,
        COUNT(*) AS cnt
      FROM dbo."MerchantBill" b
      JOIN dbo."Order_MerchantBill_Mapping" omb ON omb."BillId" = b."Id" AND omb."IsDeleted" = false
      JOIN dbo."Order" o ON o."Id" = omb."OrderId" AND o."IsDeleted" = false
      WHERE b."IsDeleted" = false
        AND b."BillDate" >= ${gte} AND b."BillDate" <= ${lte}
      GROUP BY bucket
    `);

    const result: OrderStatusBreakdownResult = { success: 0, cancelled: 0, other: 0, total: 0 };
    for (const r of rows) {
      result[r.bucket] = Number(r.cnt);
    }
    result.total = result.success + result.cancelled + result.other;

    return result;
  }

  /**
   * Danh sách công ty cho selector Screen 2 (bắt buộc chọn Cty) — loại soft-deleted
   * (`IsDeleted = false`), không phụ thuộc khoảng ngày hay có dữ liệu hoa hồng hay không.
   */
  async companies(): Promise<CompanyOption[]> {
    const rows = await this.prisma.$queryRaw<CompanyRawRow[]>(Prisma.sql`
      SELECT
        co."Id"                                        AS id,
        COALESCE(co."ShortName", co."Name", co."Code")  AS name
      FROM dbo."Company" co
      WHERE co."IsDeleted" = false
      ORDER BY name
    `);

    return rows.map((r) => ({
      id: String(r.id),
      name: r.name,
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

  /**
   * Dashboard — Top 5 CTV theo hoa hồng trong 1 tháng (mặc định tháng hiện tại nếu không truyền
   * `month`). "Doanh thu CTV" = tổng hoa hồng ĐÃ DUYỆT (IsApproved = true) họ nhận được (chốt với
   * user 2026-10-02) — khác với các báo cáo hoa hồng khác (overview/by-company/detail) vốn không
   * lọc IsApproved, chỉ IsDeleted = false.
   */
  async dashboardTopCtv(query: { month?: string; timezone?: string }): Promise<DashboardTopCtvRow[]> {
    const timezone = normalizeTimezone(query.timezone);
    const { from, to } = query.month ? getMonthRange(query.month) : getCurrentMonthRange(timezone);
    const { gte, lte } = toUtcDateRange(from, to, timezone);

    const rows = await this.prisma.$queryRaw<DashboardTopCtvRawRow[]>(Prisma.sql`
      SELECT
        c."AffiliateUserId"              AS affiliate_user_id,
        u."DisplayName"                  AS display_name,
        SUM(c."CommisionAmount")         AS total_commission
      FROM dbo."MerchantBillCommission" c
      JOIN dbo."MerchantBill" b ON b."Id" = c."MerchantBillId" AND b."IsDeleted" = false
      LEFT JOIN dbo."UserLogin" u ON u."Id" = c."AffiliateUserId"
      WHERE c."IsDeleted" = false
        AND c."IsApproved" = true
        AND b."BillDate" >= ${gte} AND b."BillDate" <= ${lte}
      GROUP BY c."AffiliateUserId", u."DisplayName"
      ORDER BY total_commission DESC
      LIMIT 5
    `);

    return rows.map((r) => ({
      affiliateUserId: String(r.affiliate_user_id),
      displayName: r.display_name,
      totalCommission: String(r.total_commission),
    }));
  }

  /**
   * Dashboard — Top 5 CTV theo số người giới thiệu TRỰC TIẾP trong 1 tháng. "Trực tiếp" =
   * số dòng AffiliatePartnerClosure có Level=2 (chốt 2026-09-09, xem
   * docs/requirements/ctv-referral/). Lọc theo JoinDate của NGƯỜI ĐƯỢC GIỚI THIỆU (descendant),
   * không phải ngày CTV đó tham gia.
   */
  async dashboardTopCtvReferral(query: {
    month?: string;
    timezone?: string;
  }): Promise<DashboardCtvReferralRow[]> {
    const timezone = normalizeTimezone(query.timezone);
    const { from, to } = query.month ? getMonthRange(query.month) : getCurrentMonthRange(timezone);
    const { gte, lte } = toUtcDateRange(from, to, timezone);

    const rows = await this.prisma.$queryRaw<DashboardCtvReferralRawRow[]>(Prisma.sql`
      SELECT
        ap."UserLoginId"      AS user_login_id,
        u."DisplayName"       AS display_name,
        ap."ReferralCode"     AS referral_code,
        COUNT(*)              AS direct_referrals
      FROM dbo."AffiliatePartnerClosure" cl
      JOIN dbo."AffiliatePartner" ap ON ap."UserLoginId" = cl."AncestorUserId" AND ap."IsDeleted" = false
      LEFT JOIN dbo."UserLogin" u ON u."Id" = ap."UserLoginId"
      WHERE cl."IsDeleted" = false
        AND cl."Level" = 2
        AND cl."JoinDate" >= ${gte} AND cl."JoinDate" <= ${lte}
      GROUP BY ap."UserLoginId", u."DisplayName", ap."ReferralCode"
      ORDER BY direct_referrals DESC
      LIMIT 5
    `);

    return rows.map((r) => ({
      userLoginId: String(r.user_login_id),
      displayName: r.display_name,
      referralCode: r.referral_code,
      directReferrals: Number(r.direct_referrals),
    }));
  }
}
