# Report: Hoa hồng theo công ty (Screen 2)

## 1. Spec — mô tả nghiệp vụ

- **Câu hỏi report trả lời:** Trong 1 công ty cụ thể và 1 khoảng ngày, mỗi người bán (thành viên
  của công ty) có tổng doanh thu / tổng đơn / đơn thành công / đơn huỷ / tổng hoa hồng là bao
  nhiêu? Và tổng hoa hồng của công ty đó phân bổ thế nào theo **cấp hệ hoa hồng**
  (`AffiliateLevel`)?
- **Ai được xem:** mọi user đã qua `JwtAuthGuard` (giống Screen 1, chưa có phân quyền riêng theo
  role cho report này).
- **Cột output:**
  - `commissionByPerson` (S2A — bảng): `sellerId`, `personName` (Tên), `revenue` (Tổng doanh thu),
    `totalOrders` (Tổng đơn), `successOrders` (Thành công), `cancelledOrders` (Huỷ),
    `totalCommission` (Hoa hồng).
  - `commissionByLevel` (S2B — pie chart): `levelNo`, `levelName`, `totalCommission`.
- **Filter đầu vào:** `from`, `to` (bắt buộc, `YYYY-MM-DD`, local date theo `timezone`),
  `companyId` (**bắt buộc** — khác Screen 1; thiếu/không phải số → `400 BadRequestException`,
  frontend không nên gọi API khi user chưa chọn Cty), `timezone` (optional, mặc định `UTC`).
- **Định nghĩa từng con số** (khớp `docs/db/conventions.md`):
  - Grain = **người bán** (`SellUserId` trên `MerchantBillCommission`), lọc theo công ty của
    người bán qua `UserLogin_Company_Mapping`.
  - Tổng doanh thu = `SUM(MerchantBill.TotalMoney)`, mỗi đơn 1 lần (LATERAL `MAX` theo
    `MerchantBillId`, tránh fan-out khi 1 đơn có nhiều dòng hoa hồng của cùng seller).
  - Tổng đơn / Thành công / Huỷ = `COUNT(DISTINCT MerchantBillId)` (toàn bộ / lọc `StatusBill=2` /
    `StatusBill=3`).
  - **Hoa hồng = hoa hồng người bán đó TẠO RA** — `SUM(CommisionAmount)` các dòng có
    `SellUserId` = người đó. **Chốt 2026-08-12** (người dùng xác nhận trực tiếp khi bắt đầu
    session này) — KHÔNG dùng `AffiliateUserId` (người nhận). Đây là điểm ❓ duy nhất còn lại ở
    `03-Commission-Report-ImplementationGuide.md §0`, nay đã chốt phía dev; **vẫn cần CoShare xác
    nhận lại bằng văn bản** vì đây là số tiền chính của màn hình.
  - Pie theo cấp = `SUM(CommisionAmount)` GROUP BY `AffiliateLevel` (bậc theo độ sâu tuyến), tên
    cấp lấy từ `ConfigAffiliateLevel.NameInCommision`/`Name` qua `AffiliateLevelId`, cùng công ty
    và khoảng ngày như S2A. **Không** filter theo `SellUserId` cụ thể — gom tất cả seller của công
    ty (khớp "phân bổ tổng hoa hồng theo cấp" ở Requirement §2.3).
  - **Bất biến đối soát:** tổng `totalCommission` cộng dồn từ S2A (theo người) phải **bằng hệt**
    tổng cộng dồn từ S2B (theo cấp) — cả hai đều lát cùng 1 tập dòng hoa hồng, chỉ khác chiều gom
    nhóm. Có test cross-check trong recon spec.

## 2. Nguồn dữ liệu

- **Bảng chính:** `MerchantBillCommission`, `MerchantBill` (đã lập tài liệu trong
  `docs/db/table-dictionary.md`).
- **Bảng join:** `UserLogin` (tên người bán), `UserLogin_Company_Mapping` (lọc theo công ty),
  `ConfigAffiliateLevel` (tên cấp cho pie chart).
- **Quy ước áp dụng:** soft-delete ☑ loại (`IsDeleted=false` trên `MerchantBillCommission`,
  `MerchantBill`, `UserLogin_Company_Mapping`) · timezone: `toUtcDateRange(from, to, timezone)`,
  lọc theo `MerchantBill.BillDate` · `companyId` bắt buộc — validate + parse sang `bigint` bằng
  `parseCompanyId()` trước khi bind vào SQL (xem §Ghi chú — bug đã bắt được).
- **Giả định chưa xác nhận:**
  - ❓ "Hoa hồng" = tạo ra (`SellUserId`) hay nhận (`AffiliateUserId`) — chốt tạm thời cho dev, cần
    CoShare xác nhận (xem §1).
  - ❓ Người bán không map được company nào (không có `UserLogin_Company_Mapping`) sẽ **không xuất
    hiện** trong kết quả S2A (INNER JOIN, khác Screen 1 dùng LEFT JOIN) — vì Screen 2 luôn lọc
    theo đúng 1 công ty nên đây là hành vi đúng (người ngoài công ty không nên xuất hiện), không
    cần xử lý null-company như Screen 1.

## 3. Query (backend)

- Vị trí: `apps/api/src/reports/reports.service.ts::commissionByPerson()` và `::commissionByLevel()`.
- Loại: ☑ `$queryRaw` (LATERAL để tránh fan-out doanh thu — cùng kỹ thuật Screen 1, không dùng
  correlated subquery `LIMIT 1` vì đã biết không scale ở quy mô lớn, xem `conventions.md §5.2`).
- **Chỉ readonly.** Test unit khẳng định SQL không chứa `INSERT/UPDATE/DELETE/CREATE/ALTER/DROP`.
- `companyId` được parse bằng `parseCompanyId()` (regex `^\d+$` rồi `BigInt(...)`) trước khi vào
  SQL — không truyền thẳng string vào so sánh với cột `bigint` (xem §Ghi chú).
- `ReportsService.companies()` (cho selector) — `SELECT` thẳng trên `dbo."Company"`, không filter
  ngày/công ty; test: `reports.service.companies.spec.ts`.

## 4. Endpoint

- `GET /reports/commission/by-person` — S2A, bảng drill-down theo người bán.
- `GET /reports/commission/by-level` — S2B, dữ liệu cho pie chart theo cấp.
- `GET /reports/companies` — danh sách công ty (loại soft-deleted) cho selector bắt buộc của
  Screen 2; không nhận query param.
- 2 endpoint hoa hồng dùng chung `CommissionByCompanyQueryDto` (`from`, `to` bắt buộc; `companyId`
  bắt buộc, `@IsNotEmpty`; `timezone` optional) qua `ValidationPipe` toàn cục, sau `JwtAuthGuard`.

## 5. Frontend

- **Đã làm (2026-08-12).**
  - API: `apps/web/src/api/reports.api.ts::getCommissionByPersonApi()` +
    `getCommissionByLevelApi()` + interfaces `ICommissionByPersonRow` / `ICommissionByLevelRow`
    (khớp field-by-field với `CommissionByPersonRow` / `CommissionByLevelRow` phía backend).
  - Page: `apps/web/src/pages/CommissionByCompanyPage.tsx`, route
    `/reports/commission-by-company` trong `routes/index.tsx`, mục nav "Hoa hồng theo công ty".
  - Company selector: ban đầu định dùng lại `getCommissionOverviewApi()` để suy ra danh sách công
    ty, nhưng dropdown rỗng khi công ty không phát sinh dữ liệu hoa hồng trong khoảng ngày mặc
    định — sai vì selector phải liệt kê **mọi công ty**, không phụ thuộc có dữ liệu hay không.
    **Sửa (2026-08-12):** thêm endpoint riêng `GET /reports/companies` →
    `ReportsService.companies()` — `SELECT` thẳng trên `dbo."Company"`, lọc `IsDeleted = false`,
    tên hiển thị `COALESCE(ShortName, Name, Code)` (cùng cách Screen 1), không phụ thuộc
    filter ngày/hoa hồng. Frontend gọi qua `getCompaniesApi()`.
  - UI bắt buộc: chưa chọn Cty → bảng trống + gợi ý "Chọn 1 công ty để xem dữ liệu"; các query
    `commissionByPerson`/`commissionByLevel` đều gán `enabled: hasRange && hasCompany` trong
    react-query nên **không gọi API** khi `companyId` rỗng (Requirement §2.1).
  - Pie chart: `apps/web/src/components/charts/SimplePieChart.tsx` — SVG tự viết (không thêm thư
    viện chart mới) vì `package.json` chưa cài sẵn thư viện nào và số lát bánh nhỏ (3 cấp).
  - **Chưa kiểm bằng trình duyệt thật** — môi trường code hiện tại không có `.env`/kết nối DB nên
    không dựng được backend thật để chạy thử end-to-end; chỉ xác nhận qua `tsc --noEmit` (cả
    `apps/web` và `apps/api`) và `vite build` sạch lỗi. **Cần HUMAN chạy thử trên trình duyệt**
    với `.env` thật trước khi coi UI là xong.

## 6. Kiểm tra (bắt buộc — không chỉ "chạy được")

- [x] **Đối soát:** `reports.service.commission-by-company.recon.spec.ts` (opt-in `RECON_DB=1`) —
      đối soát trên `companyId=12` (AllianceITSC), toàn kỳ `[2000-01-01, 2030-01-01]`.
- [x] **Con số vàng:** ghi vào `docs/db/conventions.md §5.3` (companyId=12: 24 sellers / 101.825
      đơn / doanh thu 2.526.988.796.800 / hoa hồng 74.386.819.469; theo cấp L1=512.770.082,
      L2=73.863.738.285, L3=10.311.102 — refresh 2026-08-12).
- [x] **Bất biến đối soát chéo:** tổng hoa hồng S2A (theo người) = tổng hoa hồng S2B (theo cấp) =
      74.386.819.469 — test riêng khẳng định 2 chiều gom nhóm không lệch nhau.
- [ ] **Biên ngày + timezone:** chưa có test riêng cho biên ngày theo timezone khác `UTC` (giống
      tình trạng còn thiếu ở Screen 1).
- [x] **Soft-delete / trạng thái:** `IsDeleted=false` áp dụng trên cả 3 bảng có cột này;
      `StatusBill` 2/3 dùng đúng enum đã chốt.
- [x] **companyId bắt buộc:** DTO `@IsNotEmpty`, service `parseCompanyId()` ném
      `BadRequestException` nếu thiếu/không phải số nguyên — có test cho cả 2 trường hợp
      (rỗng và không phải số).
- [x] **Null / phân trang / performance:** không phân trang (số dòng = số seller trong công ty,
      nhỏ); performance ~1s cho `companyId=12` (24 seller / 102k dòng hoa hồng) trên toàn kỳ không
      lọc ngày.
- [x] **Security:** readonly (`$queryRaw` chỉ `SELECT`, test khẳng định), không rò rỉ PII ngoài
      phạm vi (chỉ tên người bán, không có SĐT/email), sau `JwtAuthGuard`.

## Ghi chú / quyết định

- 2026-08-12: User xác nhận cột "Hoa hồng" ở Screen 2 tính theo **người bán tạo ra**
  (`SellUserId`), không phải người nhận (`AffiliateUserId`) — chốt điểm ❓ cuối cùng còn lại của
  report này (xem §1). Vẫn cần CoShare xác nhận lại bằng văn bản vì ảnh hưởng số tiền chính.
- 2026-08-12: Scope phiên này = chỉ backend (service + endpoint + tests), giống quyết định ở
  Screen 1 — chưa làm frontend.
- 2026-08-12: **Bug bắt được nhờ chạy recon test lần đầu** — `UserLogin_Company_Mapping.CompanyId`
  là kiểu `bigint` trong Postgres, nhưng route param `companyId` luôn là string. Bind thẳng string
  vào so sánh `= bigint` khiến Postgres báo lỗi
  `operator does not exist: bigint = text`. Sửa bằng cách thêm hàm `parseCompanyId()` trong
  `reports.service.ts`: validate `companyId` khớp `^\d+$` rồi `BigInt(...)` trước khi bind vào
  `Prisma.sql`, dùng chung cho cả `commissionByPerson` và `commissionByLevel`. Bug này **không bị
  bắt bởi unit test mock Prisma** (mock không kiểm tra kiểu dữ liệu Postgres thật) — minh chứng vì
  sao recon spec bắt buộc chạy trên DB thật trước khi ký "xong" một report, đúng tinh thần TDD của
  dự án ("số sai mà trông vẫn hợp lý" — ở đây là "chạy sai" chứ không phải "số sai", nhưng cùng
  nguyên nhân gốc: không test trên dữ liệu/kiểu thật).
- 2026-08-12: Chọn `companyId=12` (AllianceITSC) làm công ty đối soát thay vì Freetrend (Id=14,
  cũ) — vì `conventions.md §5.1` đã ghi nhận Freetrend không còn dữ liệu tên trên DB test hiện tại.
  AllianceITSC có nhiều dòng hoa hồng nhất (102.245 dòng / 24 seller) tại thời điểm kiểm tra.
- 2026-08-12: Frontend Screen 2 hoàn thành (bảng drill-down + pie chart theo cấp). Company selector
  ban đầu suy ra công ty từ `commissionOverview()` (Screen 1) → dropdown rỗng với công ty không có
  dữ liệu trong khoảng ngày mặc định (user phát hiện qua QA thủ công). Sửa bằng endpoint riêng
  `GET /reports/companies` → `ReportsService.companies()`, SELECT thẳng `dbo."Company"` lọc
  `IsDeleted = false`, không phụ thuộc ngày/dữ liệu hoa hồng — xem §5.
- **2026-08-13: Bug doanh thu Screen 2 bị nhân đôi/ba do fan-out nhiều cấp trên CÙNG 1 seller**
  (phát hiện qua QA thủ công — user đối chiếu Screen 1 vs Screen 2 cho cùng company/khoảng ngày,
  thấy doanh thu Screen 2 cao gần gấp đôi Screen 1). Root cause: 1 đơn có thể sinh nhiều dòng
  `MerchantBillCommission` cho CÙNG `SellUserId` (mỗi dòng = 1 cấp hoa hồng L1/L2/L3 trả cho seller
  đó trên đơn đó) — bản cũ dùng `LATERAL MAX(TotalMoney)` rồi SUM theo từng DÒNG hoa hồng, nên
  doanh thu của đơn đó bị cộng N lần (N = số dòng/cấp) cho seller đó. Sửa: tách CTE `seller_bills`
  = `DISTINCT (seller_id, bill_id)` TRƯỚC khi cộng doanh thu/đếm đơn (`order_stats`), tách riêng
  `commission_stats` = SUM `CommisionAmount` trên MỌI dòng (không dedup — mỗi dòng là 1 khoản hoa
  hồng thực trả). Xem code + comment đầy đủ tại `ReportsService.commissionByPerson()`.
  Test mới: `reports.service.commission-by-company.spec.ts` (regression guard trên cấu trúc SQL) +
  `reports.service.commission-by-company.recon.spec.ts` (thay assertion số cứng cho `totalRevenue`
  bằng bất biến đối soát chéo với `commissionOverview()` — Screen 1 — vì golden number cũ
  `2.526.988.796.800` hoá ra SAI, do được tính bằng cách gọi lại chính hàm đang lỗi, xem
  `conventions.md §5.3`). **Chưa xác nhận được số vàng doanh thu đúng** vì môi trường code hiện
  tại không có `.env`/kết nối DB thật — cần HUMAN chạy `RECON_DB=1 npx jest
  reports.service.commission-by-company.recon.spec.ts` để lấy số đúng và cập nhật `conventions.md
  §5.3`. `totalOrders`/`totalCommission`/`by-level` KHÔNG bị ảnh hưởng bởi bug này (đơn đã dùng
  `DISTINCT`, hoa hồng vốn cố ý SUM mọi dòng).
