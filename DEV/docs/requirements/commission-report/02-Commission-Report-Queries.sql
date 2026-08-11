-- =============================================================================
-- Báo cáo Hoa hồng (Commission Report) — SQL ĐÃ KIỂM CHỨNG TRÊN DB THẬT
-- =============================================================================
-- Nguồn: query trực tiếp DB CoShare 2026-08-10 (xem 04-DB-Verification-Findings.md).
-- Postgres schema "dbo"; identifier PascalCase phải bọc "...".
-- READONLY: chỉ SELECT. Cần view/function → viết vào sql-scripts/, giao HUMAN chạy.
--
-- MÔ HÌNH 3 MÀN HÌNH (screen) — xem 00-...Requirement.md:
--   • SCREEN 1 "Hoa hồng tổng quan"  → query "SCREEN 1" bên dưới (gom theo Cty)
--   • SCREEN 2 "Hoa hồng theo công ty" → query "SCREEN 2A/2B" (drill-down + pie); BẮT BUỘC :companyId
--   • SCREEN 3 "Báo cáo đơn hàng"     → query "SCREEN 3" (chi tiết + summary + expander line-item)
--
-- ĐÃ CHỐT (04-Findings + CoShare trả lời 2026-08-11):
--   • "Cty" = Company, nối qua SellUserId → UserLogin_Company_Mapping.CompanyId
--   • StatusBill: 2=Thành công(Finished), 3=Huỷ(Cancel), 1=Approve, 0=New
--       (⚠ dữ liệu hiện 100% = 1)
--   • MSNV = Staff.StaffCode của KHÁCH MUA (RenterGUID → UserLogin → Staff)
--   • Người mua = RenterGUID→UserLogin ; Người giới thiệu = SellUserId→UserLogin ;
--     Người hưởng hoa hồng = AffiliateUserId→UserLogin
--   • Cột "Trạng thái" = MerchantBill.StatusBill (đúng bằng bộ lọc "Trạng thái đơn")
--   • "Loại sp": PHI VẬT LÝ = MerchantProduct.Code ILIKE '%ZALOOA%' (Zalo OA); VẬT LÝ = còn lại
--   • Soft-delete: loại IsDeleted = true ở mọi bảng
--
-- TIMEZONE: cột thời gian là timestamptz lưu UTC+00; nghiệp vụ theo UTC+7 (Asia/Ho_Chi_Minh).
--   :from/:to phải là mốc UTC đã quy đổi từ ngày người dùng chọn ở UTC+7 (dùng toUtcDateRange).
--
-- PARAM chung:  :from, :to (UTC), :companyId (NULL=tất cả; SCREEN 2 bắt buộc)
-- =============================================================================


-- =============================================================================
-- SCREEN 1 — HOA HỒNG TỔNG QUAN, GOM THEO CTY (Company)
-- =============================================================================
-- Tránh fan-out: xác định company của MỖI ĐƠN đúng 1 lần (bill_company),
-- rồi mới SUM doanh thu trên đơn duy nhất; hoa hồng tính ở CTE riêng theo đơn.
WITH bill_company AS (   -- mỗi đơn -> 1 company (lấy company của 1 seller bất kỳ trên đơn)
    SELECT b."Id"        AS bill_id,
           b."TotalMoney" AS total_money,
           b."StatusBill" AS status_bill,
           (SELECT cmap."CompanyId"
              FROM dbo."MerchantBillCommission" c
              JOIN dbo."UserLogin_Company_Mapping" cmap
                   ON cmap."UserLoginId" = c."SellUserId" AND cmap."IsDeleted" = false
             WHERE c."MerchantBillId" = b."Id" AND c."IsDeleted" = false
             LIMIT 1)    AS company_id
    FROM dbo."MerchantBill" b
    WHERE b."IsDeleted" = false
      AND b."BillDate" >= :from AND b."BillDate" < :to
),
comm_per_bill AS (       -- tổng hoa hồng theo từng đơn
    SELECT c."MerchantBillId" AS bill_id, SUM(c."CommisionAmount") AS commission
    FROM dbo."MerchantBillCommission" c
    WHERE c."IsDeleted" = false
    GROUP BY c."MerchantBillId"
)
SELECT
    co."Id"                                                   AS company_id,     -- Cty
    co."ShortName"                                            AS company_name,
    COALESCE(SUM(bc.total_money), 0)                          AS revenue,        -- Doanh thu (1 lần/đơn)
    COUNT(*)                                                  AS total_orders,   -- Tổng đơn
    COUNT(*) FILTER (WHERE bc.status_bill = 2)                AS success_orders, -- Thành công (Finished)
    COUNT(*) FILTER (WHERE bc.status_bill = 3)                AS cancelled_orders,-- Huỷ (Cancel)
    COALESCE(SUM(cpb.commission), 0)                          AS total_commission-- Hoa hồng
FROM bill_company bc
LEFT JOIN dbo."Company" co        ON co."Id" = bc.company_id
LEFT JOIN comm_per_bill cpb       ON cpb.bill_id = bc.bill_id
WHERE (:companyId IS NULL OR bc.company_id = :companyId)
GROUP BY co."Id", co."ShortName"
ORDER BY total_commission DESC;
-- Đối soát toàn kỳ (không lọc): Freetrend ~1119 đơn, hoa hồng ~13,567,242 (xem golden numbers).


-- =============================================================================
-- SCREEN 2A — HOA HỒNG THEO CÔNG TY: DRILL-DOWN THEO NGƯỜI BÁN (SellUser)
-- =============================================================================
-- BẮT BUỘC :companyId (màn hình chưa chọn công ty → KHÔNG chạy query, hiện bảng trống).
-- Grain = thành viên/người bán của Cty (SellUser). CoShare chốt:
--   • Tổng doanh thu = SUM(TotalMoney) các đơn của thành viên (mỗi đơn 1 lần, tránh fan-out)
--   • Tổng đơn      = COUNT(DISTINCT MerchantBillId) — số đơn phát sinh của thành viên
-- Hoa hồng còn 2 cách hiểu (chốt sau):
--   (a) hoa hồng người đó tạo ra khi bán (theo SellUserId) — dùng bên dưới, hay
--   (b) hoa hồng người đó NHẬN (theo AffiliateUserId) ❓ — chốt với CoShare.
SELECT
    seller."DisplayName"                                     AS person_name,     -- Tên
    COUNT(DISTINCT c."MerchantBillId")                      AS total_orders,    -- Tổng đơn (bán)
    COUNT(DISTINCT c."MerchantBillId")
        FILTER (WHERE b."StatusBill" = 2)                   AS success_orders,  -- Thành công
    COUNT(DISTINCT c."MerchantBillId")
        FILTER (WHERE b."StatusBill" = 3)                   AS cancelled_orders,-- Huỷ
    COALESCE(SUM(sub.total_money), 0)                       AS revenue,         -- Doanh thu (1 lần/đơn)
    COALESCE(SUM(c."CommisionAmount"), 0)                  AS total_commission -- Hoa hồng (tạo ra)
FROM dbo."MerchantBillCommission" c
JOIN dbo."UserLogin" seller ON seller."Id" = c."SellUserId"
JOIN dbo."UserLogin_Company_Mapping" cmap
     ON cmap."UserLoginId" = c."SellUserId" AND cmap."IsDeleted" = false
JOIN dbo."MerchantBill" b ON b."Id" = c."MerchantBillId" AND b."IsDeleted" = false
-- lấy TotalMoney 1 lần/đơn để không nhân bản doanh thu khi 1 đơn có nhiều dòng hoa hồng:
JOIN LATERAL (
    SELECT MAX(b2."TotalMoney") AS total_money
    FROM dbo."MerchantBill" b2 WHERE b2."Id" = c."MerchantBillId"
) sub ON true
WHERE c."IsDeleted" = false
  AND cmap."CompanyId" = :companyId
  AND b."BillDate" >= :from AND b."BillDate" < :to
GROUP BY seller."DisplayName"
ORDER BY total_commission DESC;


-- =============================================================================
-- SCREEN 2B — BIỂU ĐỒ: HOA HỒNG THEO CẤP (pie theo AffiliateLevel), trong 1 Cty
-- =============================================================================
-- Thuộc Screen 2 (theo công ty). :companyId bắt buộc như Screen 2A.
SELECT
    c."AffiliateLevel"                              AS level_no,
    COALESCE(lvl."NameInCommision", lvl."Name",
             'Cấp ' || c."AffiliateLevel")          AS level_name,
    COALESCE(SUM(c."CommisionAmount"), 0)           AS total_commission
FROM dbo."MerchantBillCommission" c
JOIN dbo."MerchantBill" b ON b."Id" = c."MerchantBillId" AND b."IsDeleted" = false
LEFT JOIN dbo."ConfigAffiliateLevel" lvl ON lvl."Id" = c."AffiliateLevelId"
WHERE c."IsDeleted" = false
  AND b."BillDate" >= :from AND b."BillDate" < :to
  AND (:companyId IS NULL OR EXISTS (
        SELECT 1 FROM dbo."UserLogin_Company_Mapping" m
        WHERE m."UserLoginId" = c."SellUserId" AND m."IsDeleted" = false
          AND m."CompanyId" = :companyId))
GROUP BY c."AffiliateLevel", lvl."NameInCommision", lvl."Name"
ORDER BY level_no;
-- Đối soát toàn kỳ: L1≈2,682,494 · L2≈10,936,588 · L3≈2,400.


-- =============================================================================
-- SCREEN 3 — BÁO CÁO ĐƠN HÀNG: CHI TIẾT (grain = 1 dòng MerchantBillCommission)
-- =============================================================================
-- PARAM thêm (NULL = bỏ qua):
--   :affiliateLevel(int)  :affiliateUserId  :msnv  :statusBill  :keyword
--   :productType ('NON_PHYSICAL' | 'PHYSICAL' | NULL)  ← lọc theo mã sp chứa 'ZALOOA'
SELECT
    b."OrderNumber"                                  AS order_code,        -- Mã đơn
    b."BillDate"                                     AS order_date,        -- Ngày đặt hàng
    buyer."DisplayName"                              AS buyer_name,        -- Người mua / KH đặt
    buyer_staff."StaffCode"                          AS msnv,              -- MSNV (của khách mua)
    seller."DisplayName"                             AS referrer_name,     -- Người giới thiệu (=SellUser)
    ben."DisplayName"                                AS beneficiary_name,  -- Người hưởng hoa hồng
    b."TotalMoney"                                   AS order_total,       -- Tổng tiền đơn
    c."CommisionAmount"                              AS commission_amount, -- Tổng hoa hồng (dòng)
    c."AffiliateLevel"                               AS level_no,          -- Cấp
    COALESCE(lvl."NameInCommision", lvl."Name")      AS level_name,
    b."StatusBill"                                   AS order_status,      -- Trạng thái đơn
    cps."Name"                                       AS comm_payment_status-- (phụ) trạng thái TT hoa hồng
FROM dbo."MerchantBillCommission" c
JOIN      dbo."MerchantBill" b     ON b."Id" = c."MerchantBillId" AND b."IsDeleted" = false
LEFT JOIN dbo."UserLogin" ben      ON ben."Id" = c."AffiliateUserId"          -- người hưởng
LEFT JOIN dbo."UserLogin" seller   ON seller."Id" = c."SellUserId"            -- người bán/giới thiệu
LEFT JOIN dbo."UserLogin" buyer    ON buyer."ID_GUID" = b."RenterGUID"        -- khách mua
LEFT JOIN dbo."Staff"     buyer_staff ON buyer_staff."Id" = buyer."Id"        -- MSNV của khách mua
LEFT JOIN dbo."ConfigAffiliateLevel" lvl ON lvl."Id" = c."AffiliateLevelId"
LEFT JOIN dbo."ConfigCommPaymentStatus" cps ON cps."Id" = c."CommPaymentStatusId"
WHERE c."IsDeleted" = false
  AND b."BillDate" >= :from AND b."BillDate" < :to
  AND (:companyId       IS NULL OR EXISTS (
        SELECT 1 FROM dbo."UserLogin_Company_Mapping" m
        WHERE m."UserLoginId" = c."SellUserId" AND m."IsDeleted" = false
          AND m."CompanyId" = :companyId))
  AND (:affiliateLevel  IS NULL OR c."AffiliateLevel"   = :affiliateLevel)
  AND (:affiliateUserId IS NULL OR c."AffiliateUserId"  = :affiliateUserId)
  AND (:statusBill      IS NULL OR b."StatusBill"       = :statusBill)
  AND (:msnv            IS NULL OR buyer_staff."StaffCode" = :msnv)
  -- Loại sp: PHI VẬT LÝ = đơn CÓ mặt hàng Zalo OA (Code chứa 'ZALOOA'); VẬT LÝ = đơn KHÔNG có.
  -- Cơ chế nghiệp vụ: 1 đơn hoặc toàn vật lý, hoặc đúng 1 sp phi vật lý ⇒ 2 nhánh loại trừ nhau (không đơn trộn).
  AND (:productType IS NULL
       OR (:productType = 'NON_PHYSICAL' AND EXISTS (
             SELECT 1 FROM dbo."MerchantBillDetail" d
             JOIN dbo."MerchantProduct" p ON p."Id" = d."ProductId"
             WHERE d."MerchantBillId" = b."Id" AND d."IsDeleted" = false
               AND p."Code" ILIKE '%ZALOOA%'))
       OR (:productType = 'PHYSICAL' AND EXISTS (
             SELECT 1 FROM dbo."MerchantBillDetail" d
             LEFT JOIN dbo."MerchantProduct" p ON p."Id" = d."ProductId"
             WHERE d."MerchantBillId" = b."Id" AND d."IsDeleted" = false
               AND (p."Code" IS NULL OR p."Code" NOT ILIKE '%ZALOOA%'))))
  AND (:keyword IS NULL OR
       b."OrderNumber"  ILIKE '%' || :keyword || '%' OR
       buyer."DisplayName" ILIKE '%' || :keyword || '%' OR
       ben."DisplayName"   ILIKE '%' || :keyword || '%')
ORDER BY b."BillDate" DESC, b."Id", c."AffiliateLevel";
-- Phân loại dựa MerchantProduct.Code ILIKE '%ZALOOA%' (nên verify golden 1 lần khi code).
-- Vì không có đơn trộn, PHYSICAL ⇔ NOT EXISTS(ZALOOA); nhánh EXISTS non-ZALOOA cho cùng kết quả.


-- =============================================================================
-- SCREEN 3 — DÒNG SUMMARY (đầu bảng)
-- =============================================================================
-- ⚠️ Để summary khớp lưới: CTE detail dưới đây phải áp CÙNG bộ lọc như query chi tiết
--    (:affiliateLevel, :affiliateUserId, :msnv, :statusBill, :productType, :keyword) —
--    ví dụ chỉ minh hoạ lọc theo công ty; khi code bổ sung đủ các filter còn lại.
WITH detail AS (
    SELECT DISTINCT c."Id" AS comm_id, c."MerchantBillId", c."CommisionAmount", b."TotalMoney"
    FROM dbo."MerchantBillCommission" c
    JOIN dbo."MerchantBill" b ON b."Id" = c."MerchantBillId" AND b."IsDeleted" = false
    WHERE c."IsDeleted" = false
      AND b."BillDate" >= :from AND b."BillDate" < :to
      AND (:companyId IS NULL OR EXISTS (
            SELECT 1 FROM dbo."UserLogin_Company_Mapping" m
            WHERE m."UserLoginId" = c."SellUserId" AND m."IsDeleted" = false
              AND m."CompanyId" = :companyId))
)
SELECT
    COUNT(DISTINCT "MerchantBillId")                          AS total_orders,
    COUNT(*)                                                  AS total_commission_rows,
    COALESCE(SUM("CommisionAmount"), 0)                       AS sum_commission,
    (SELECT COALESCE(SUM(t."TotalMoney"), 0)
       FROM (SELECT DISTINCT "MerchantBillId", "TotalMoney" FROM detail) t) AS sum_order_total
FROM detail;


-- =============================================================================
-- SCREEN 3 — CHI TIẾT MẶT HÀNG CỦA 1 ĐƠN (expander "▸ Chi tiết đơn hàng")
-- =============================================================================
-- Gọi khi user bung mũi tên ▸ ở 1 dòng đơn. Cột: Mặt hàng / SL / Đơn giá / Thành tiền (xem §3.3).
SELECT
    d."ProductName"  AS item_name,     -- Mặt hàng
    d."Quantity"     AS quantity,      -- SL
    d."ProductPrice" AS unit_price,    -- Đơn giá
    d."TotalMoney"   AS line_total     -- Thành tiền
FROM dbo."MerchantBillDetail" d
WHERE d."MerchantBillId" = :billId AND d."IsDeleted" = false
ORDER BY d."OrderNo";


-- =============================================================================
-- (GỢI Ý) Dùng view có sẵn làm nền cho SCREEN 3 (chi tiết)
-- =============================================================================
-- dbo."ViewMerchantBill_BillComm" đã có: BillNumber, MerchantBillDate, MerchantBillTotalMoney,
--   SellUserId/Username/DisplayName, StatusBill, AffiliateUserId, AffiliateLevel(Id),
--   CommisionAmount/Percent, CommPaymentStatusName.
-- Thiếu (phải join thêm): tên người HƯỞNG (AffiliateUserId→UserLogin), tên KHÁCH MUA + MSNV
--   (MerchantBill.RenterGUID→UserLogin→Staff). Cân nhắc join view thay vì bảng gốc để bớt code.
