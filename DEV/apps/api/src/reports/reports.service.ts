import { BadRequestException, Injectable } from '@nestjs/common';
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
   * Screen 2B — biểu đồ tròn: hoa hồng theo cấp hệ (AffiliateLevel), trong 1 công ty. Bắt buộc companyId
   * như Screen 2A (thuộc cùng màn hình). Scoping theo công ty dùng EXISTS trên SellUserId → company
   * mapping, cùng cách Screen 2A/Queries.sql đã verify.
   */
  async commissionByLevel(query: {
    from: string;
    to: string;
    companyId: string;
    timezone?: string;
  }): Promise<CommissionByLevelRow[]> {
    const companyId = parseCompanyId(query.companyId);
    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);

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
        AND EXISTS (
              SELECT 1 FROM dbo."UserLogin_Company_Mapping" m
              WHERE m."UserLoginId" = c."SellUserId" AND m."IsDeleted" = false
                AND m."CompanyId" = ${companyId})
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
  async commissionDetail(query: {
    from: string;
    to: string;
    companyId?: string;
    affiliateLevelId?: string;
    affiliateUserId?: string;
    msnv?: string;
    statusBill?: number;
    productType?: 'PHYSICAL' | 'NON_PHYSICAL';
    keyword?: string;
    page?: number;
    pageSize?: number;
    timezone?: string;
  }): Promise<CommissionDetailResult> {
    if (!query.from || !query.to) {
      throw new BadRequestException('from/to are required for Screen 3 (Báo cáo đơn hàng)');
    }

    const timezone = normalizeTimezone(query.timezone);
    const { gte, lte } = toUtcDateRange(query.from, query.to, timezone);
    const page = query.page && query.page > 0 ? Math.floor(query.page) : 1;
    const pageSize = query.pageSize && query.pageSize > 0 ? Math.floor(query.pageSize) : 50;
    const offset = (page - 1) * pageSize;

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
      conditions.push(Prisma.sql`buyer_staff."StaffCode" = ${query.msnv}`);
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
        b."OrderNumber" ILIKE ${kw}
        OR buyer."DisplayName" ILIKE ${kw}
        OR ca.beneficiary_name ILIKE ${kw}
        OR ca.referrer_name ILIKE ${kw}
      )`);
    }

    const whereClause = Prisma.join(conditions, ' AND ');

    const rows = await this.prisma.$queryRaw<CommissionDetailRawRow[]>(Prisma.sql`
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
          b."OrderNumber"                                        AS order_code,
          b."BillDate"                                           AS order_date,
          COALESCE(buyer."DisplayName", b."RenterReceiverName")  AS buyer_name,
          buyer_staff."StaffCode"                                AS msnv,
          ca.referrer_name                                       AS referrer_name,
          ca.beneficiary_name                                    AS beneficiary_name,
          b."TotalMoney"                                         AS order_total,
          COALESCE(ca.total_commission, 0)                       AS commission_amount,
          b."StatusBill"                                         AS order_status
        FROM dbo."MerchantBill" b
        LEFT JOIN commission_agg ca      ON ca.bill_id = b."Id"
        LEFT JOIN dbo."UserLogin" buyer  ON buyer."ID_GUID" = b."RenterGUID"
        LEFT JOIN dbo."Staff" buyer_staff ON buyer_staff."Id" = buyer."Id"
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
      LIMIT ${pageSize} OFFSET ${offset}
    `);

    const first = rows[0];

    return {
      rows: rows.map((r) => ({
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
      })),
      summary: {
        totalOrders: first ? Number(first.total_count) : 0,
        successOrders: first ? Number(first.success_orders) : 0,
        cancelledOrders: first ? Number(first.cancelled_orders) : 0,
        sumOrderTotal: first ? String(first.sum_order_total) : '0',
        sumCommission: first ? String(first.sum_commission) : '0',
      },
      pagination: {
        page,
        pageSize,
        totalCount: first ? Number(first.total_count) : 0,
      },
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
}
