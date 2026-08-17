# Report: Báo cáo đơn hàng (Screen 3)

## 1. Spec — mô tả nghiệp vụ

- **Câu hỏi report trả lời:** Danh sách chi tiết TỪNG ĐƠN HÀNG trong 1 khoảng ngày, có thể lọc
  theo Cty/Cấp hệ hoa hồng/Người hưởng hoa hồng/Tên/MSNV/Loại sp/Trạng thái đơn/Mã đơn, xem được
  line-item (mặt hàng) của từng đơn qua expander.
- **Ai được xem:** mọi user đã qua `JwtAuthGuard` (giống Screen 1/2, chưa có phân quyền riêng).
- **Cột output** (`commissionDetail`, 1 dòng = 1 `MerchantBill`):
  - `billId`, `orderCode` (Mã đơn), `orderDate` (Ngày đặt hàng, ISO UTC), `buyerName` (Người mua
    hàng), `msnv` (MSNV của người mua), `referrerName` (Người giới thiệu — gộp nếu nhiều),
    `beneficiaryName` (Người hưởng hoa hồng — gộp nếu nhiều), `orderTotal` (Tổng tiền đơn),
    `commissionAmount` (Tổng tiền hoa hồng — **toàn đơn**, xem quyết định grain dưới),
    `orderStatus` (Trạng thái, số — FE map ra tên theo `conventions.md §3`).
  - `summary`: `totalOrders`, `successOrders`, `cancelledOrders`, `sumOrderTotal`, `sumCommission`
    — tính trên TOÀN BỘ tập đã lọc (trước phân trang), không phải chỉ trang hiện tại.
  - `pagination`: `page`, `pageSize`, `totalCount`.
  - `commissionDetailItems(billId)`: `itemName` (Mặt hàng), `quantity` (SL), `unitPrice` (Đơn giá),
    `lineTotal` (Thành tiền) — cho expander.
- **Filter đầu vào:** `from`, `to` (bắt buộc), `companyId`/`affiliateLevelId`/`affiliateUserId`
  (optional — **khác Screen 2**, Screen 3 hiện TẤT CẢ đơn theo mặc định, filter chỉ thu hẹp),
  `msnv`, `statusBill`, `productType` (`PHYSICAL`|`NON_PHYSICAL`), `keyword` (tìm mã đơn / tên
  người mua / tên người hưởng / tên người giới thiệu), `page`/`pageSize` (default 1/50, áp trong
  service — không trong DTO để tránh lệch giữa validate và default), `timezone`.
- **Định nghĩa từng con số:**
  - **Grain — chốt 2026-08-12 (hỏi & user quyết định trực tiếp):** 1 dòng lưới = 1 `MerchantBill`
    (đúng nghĩa đen §3.2 Requirement "mỗi đơn hàng là 1 dòng"), **KHÔNG** theo gợi ý trong
    `01-Commission-Report-DataModel.md §3` (grain = 1 dòng `MerchantBillCommission`) — vì 1 đơn có
    thể trả hoa hồng cho NHIỀU người/cấp (đã có tiền lệ ở bug Screen 2 2026-08-13: 1 đơn trả cả
    L1+L2+L3, nhiều `AffiliateUserId` khác nhau). Nhiều dòng hoa hồng của cùng 1 đơn được GỘP
    (`SUM`/`STRING_AGG`) về 1 dòng hiển thị.
  - **⚠️ Điểm dễ hiểu nhầm nhất của report này:** "Tổng tiền hoa hồng" trên MỖI DÒNG luôn là
    **tổng toàn đơn** (`SUM(CommisionAmount)` mọi dòng `MerchantBillCommission` của đơn đó), **kể
    cả khi đang lọc theo 1 `affiliateLevelId`/`affiliateUserId`/`companyId` cụ thể**. Filter chỉ
    quyết định **đơn nào xuất hiện** trong lưới (`EXISTS` trên `MerchantBillCommission`), KHÔNG
    thu hẹp số tiền hiển thị trên dòng đơn đó xuống chỉ phần của người/cấp đang lọc. Lý do: cột
    "Tổng tiền hoa hồng" ở Requirement §3.1 không có định nghĩa nào nói "theo người/cấp đang lọc",
    và gộp theo đơn trước khi biết filter tránh phải tính lại tổng mỗi khi đổi filter theo cách có
    thể gây lệch với Screen 1/2. **❓ Chưa xác nhận với CoShare** — nếu CoShare muốn số theo đúng
    phần của người/cấp đang lọc thì cần đổi cách tính (SUM có điều kiện, không phải SUM toàn đơn).
  - "Người hưởng h.h" / "Người giới thiệu" gộp nhiều người bằng
    `STRING_AGG(DISTINCT DisplayName, ', ')` — không mất tên, không lặp tên (nhờ `DISTINCT`).
  - Đơn không có dòng hoa hồng nào vẫn hiện (LEFT JOIN `commission_agg`), `commissionAmount = 0` —
    giống cách Screen 1 giữ dòng null-company, không âm thầm làm mất đơn khỏi danh sách.
  - `orderCode` = `Order.OrderNumber` của **khách mua**, nối qua bảng cầu
    `Order_MerchantBill_Mapping` (`MerchantBill.Id → Order_MerchantBill_Mapping.BillId →
    Order_MerchantBill_Mapping.OrderId → Order.Id`) — **CoShare xác nhận trực tiếp 2026-08-12**,
    **không phải** `MerchantBill.OrderNumber` (giả định ban đầu, cột này vẫn tồn tại trên
    `MerchantBill` nhưng không phải mã đơn chính thức). Không có ràng buộc unique trên
    `Order_MerchantBill_Mapping.BillId` → lấy qua subquery tương quan `ORDER BY "Id" LIMIT 1` (không
    `LEFT JOIN` trực tiếp) để tránh nhân dòng nếu 1 bill có >1 mapping.
  - `msnv` = `ConfigEmployee.EmployeeCode` của **khách mua**, nối qua `ConfigEmployee.UserLoginId →
    UserLogin.Id` — **CoShare xác nhận trực tiếp 2026-08-12**, **không phải** `Staff.StaffCode`
    (giả định ban đầu). Không có ràng buộc unique trên `ConfigEmployee.UserLoginId` → cũng lấy qua
    subquery tương quan `ORDER BY "Id" LIMIT 1`, cùng lý do tránh nhân dòng.
  - `productType`: không có đơn trộn vật lý + phi vật lý (đã chốt) → `PHYSICAL` = `NOT EXISTS`
    dòng `MerchantBillDetail` nối `MerchantProduct.Code ILIKE '%ZALOOA%'`; `NON_PHYSICAL` = `EXISTS`.
  - Phân trang + summary tính trong **CÙNG 1 query** bằng window function (`COUNT(*) OVER()`,
    `SUM(...) OVER()`) áp trên toàn bộ tập đã lọc TRƯỚC `LIMIT/OFFSET` — tránh 2 query rows/summary
    lệch filter nhau (cảnh báo đã ghi trong `02-Commission-Report-Queries.sql`).

## 2. Nguồn dữ liệu

- **Bảng chính:** `MerchantBill` (base — đảm bảo mọi đơn đều xuất hiện, kể cả không có hoa hồng).
- **Bảng join:** `MerchantBillCommission` (gộp theo đơn trong CTE `commission_agg`), `UserLogin`
  (người mua/người bán/người hưởng), `ConfigEmployee` (MSNV người mua, qua `UserLoginId`),
  `Order` + `Order_MerchantBill_Mapping` (Mã đơn), `MerchantBillDetail` + `MerchantProduct` (lọc
  Loại sp + expander line-item), `UserLogin_Company_Mapping` (filter Cty), `ConfigAffiliateLevel`
  (danh sách Cấp cho filter dropdown).
- **Quy ước áp dụng:** soft-delete ☑ loại (`IsDeleted=false` trên `MerchantBill`,
  `MerchantBillCommission`, `MerchantBillDetail`, `UserLogin_Company_Mapping`,
  `ConfigAffiliateLevel`) · timezone: `toUtcDateRange(from, to, timezone)` trên
  `MerchantBill.BillDate` (giống Screen 1/2) · `companyId`/`affiliateLevelId`/`affiliateUserId`
  parse+validate sang `bigint` bằng `parseOptionalBigIntParam()` (tổng quát hoá `parseCompanyId()`
  theo khuyến nghị `conventions.md §5.2`) trước khi bind vào SQL.
- **Giả định chưa xác nhận:**
  - ❓ "Tổng tiền hoa hồng" hiển thị toàn đơn hay chỉ phần đang lọc — xem §1, cần CoShare xác nhận.
  - ❓ Đơn không map được `UserLogin`/`Staff` (buyer không tồn tại/không có Staff) → `buyerName`
    fallback về `RenterReceiverName`, `msnv = null` — chưa xác nhận CoShare có muốn hiển thị khác.

## 3. Query (backend)

- Vị trí: `apps/api/src/reports/reports.service.ts::commissionDetail()`,
  `::commissionDetailItems()`, `::commissionLevels()`, `::commissionBeneficiaries()`.
- Loại: ☑ `$queryRaw` cho `commissionDetail` (CTE `commission_agg` gộp theo đơn tránh fan-out +
  window function cho phân trang/summary trong 1 query) · ☑ `$queryRaw` cho các lookup còn lại
  (đơn giản, không cần Prisma model tương ứng đã generate quan hệ thuận tiện).
- **Chỉ readonly.** Test unit khẳng định SQL không chứa `INSERT/UPDATE/DELETE/CREATE/ALTER/DROP`.
- `parseOptionalBigIntParam()` dùng cho 3 filter bigint optional; khác `parseCompanyId()` (Screen 2)
  ở chỗ KHÔNG bắt buộc phải có giá trị — Screen 3 không bắt buộc chọn Cty/Cấp/Người hưởng.

## 4. Endpoint

- `GET /reports/commission/detail` — danh sách chi tiết đơn + summary + phân trang.
- `GET /reports/commission/detail/:billId/items` — line-item của 1 đơn (expander).
- `GET /reports/commission/levels` — danh sách cấp hệ hoa hồng cho filter dropdown.
- `GET /reports/commission/beneficiaries` — danh sách người hưởng hoa hồng cho filter dropdown
  (optionally scoped theo `companyId`).
- Tất cả sau `JwtAuthGuard`, validate qua `CommissionDetailQueryDto` /
  `CommissionBeneficiariesQueryDto` với `ValidationPipe` toàn cục (`transform: true`).

## 4b. Xuất Excel (2026-08-13)

- **Phạm vi:** TOÀN BỘ đơn khớp filter hiện tại, **không giới hạn theo trang** — xác nhận trực tiếp
  với user qua `AskUserQuestion` (khác với chỉ xuất 50 dòng đang xem trên UI).
- **Endpoint:** `GET /reports/commission/detail/export` — cùng `CommissionDetailQueryDto`, bỏ qua
  `page`/`pageSize` nếu FE gửi kèm (export luôn full, không phân trang). Trả file nhị phân trực
  tiếp qua `@Res()` (bypass `ResponseInterceptor` toàn cục) — không phải JSON envelope.
- **Giới hạn an toàn:** `EXPORT_ROW_CAP = 50000` dòng — `LIMIT 50000` cứng ở cuối query, tránh OOM
  nếu filter quá rộng. Cờ `truncated: true` được set khi `total_count` (window function) > 50000,
  đọc qua header tuỳ chỉnh `X-Export-Truncated` (vì response là blob, không đọc được JSON field) —
  FE hiện cảnh báo "Đã xuất 50.000 dòng đầu tiên..." khi cờ này bật.
- **Đảm bảo không lệch filter với `commissionDetail`:** cả 2 method dùng chung
  `buildCommissionDetailFilter()` (build `WHERE` conditions) và `buildCommissionDetailCte()` (CTE
  `commission_agg`/`filtered` + window function), chỉ khác `LIMIT/OFFSET` ở cuối — có test riêng
  (`reports.service.commission-detail.spec.ts`) so sánh SQL text của 2 method (trừ đoạn
  LIMIT/OFFSET) để đảm bảo không bao giờ trôi lệch điều kiện lọc.
- **Cột xuất ra** (đúng thứ tự hiển thị trên UI, bỏ cột nút mũi tên expander): Mã đơn, Ngày đặt,
  Người mua, MSNV, Người hưởng h.h, Tổng tiền đơn, Tổng tiền hoa hồng, Trạng thái. Dòng cuối "Tổng
  cộng" in đậm, lấy từ `summary` (không tự cộng lại ở tầng dựng file).
- **Định dạng số tiền:** number Excel thật (`numFmt: '#,##0'`), không phải string đã format sẵn —
  để mở file ra tính tổng/lọc được ngay trong Excel.
- **File dựng:** `apps/api/src/reports/commission-detail-export.util.ts` (`buildCommissionDetailWorkbook`,
  dùng `exceljs`, hàm thuần không phụ thuộc Prisma — test độc lập không cần mock DB).
- **Frontend:** `getCommissionDetailExportApi()` trong `reports.api.ts` dùng `fetch` (không phải
  axios/react-query, vì cần đọc `Blob` + header tuỳ chỉnh) → tạo `<a download>` ẩn để trigger tải
  file trên trình duyệt. Nút "Xuất Excel" trên `CommissionOrdersPage.tsx`, disable khi đang xuất
  hoặc chưa chọn khoảng ngày.
- **Cập nhật quyết định cũ:** mục "2026-08-12: Không làm nút Export" ở dưới đã lỗi thời — user yêu
  cầu thêm tính năng này ngày 2026-08-13, xem ghi chú tương ứng.

## 5. Frontend

- `apps/web/src/pages/CommissionOrdersPage.tsx` — filter bar (khoảng ngày, Cty, Cấp hệ hoa hồng,
  Người hưởng hoa hồng, Trạng thái đơn, Loại sp, MSNV, Tên/Mã đơn), dòng summary cố định lấy từ
  API `summary` (không tự cộng ở FE vì có phân trang), phân trang Trước/Sau, mỗi dòng có nút mở
  rộng (`ChevronRight`/`ChevronDown`) hiện bảng phụ mặt hàng (`commissionDetailItems`) khi bấm.
  Route `/reports/commission-orders` + mục menu "Báo cáo đơn hàng" đã thêm.
- **Chưa kiểm tra qua browser thật** — môi trường code hiện tại không có `.env`/kết nối DB thật;
  cần HUMAN mở `/reports/commission-orders`, thử filter, phân trang, và mở expander của 1 đơn có
  nhiều mặt hàng.

## 6. Kiểm tra (bắt buộc — không chỉ "chạy được")

- [x] **Unit test:** `reports.service.commission-detail.spec.ts` — 18 test, mock `$queryRaw`,
      bao gồm grain guard (`STRING_AGG` + `GROUP BY` theo bill id), validate bigint params, phân
      trang, window function summary, mapping BigInt/Decimal → JSON-safe, nguồn `orderCode`/`msnv`
      đúng sau khi sửa (xem Ghi chú 2026-08-12 bên dưới).
- [ ] **Đối soát (RECON_DB):** `reports.service.commission-detail.recon.spec.ts` viết xong (opt-in),
      **chưa chạy được** trong phiên này (không có kết nối DB thật) — cần HUMAN chạy
      `RECON_DB=1 npx jest reports.service.commission-detail.recon.spec.ts` và báo lại kết quả.
- [ ] **Con số vàng:** chưa có — sẽ ghi vào `docs/db/conventions.md §5.4` sau khi HUMAN chạy recon.
- [ ] **Biên ngày + timezone:** có 1 test invariant trong recon spec (chưa chạy được, xem trên).
- [x] **Soft-delete / trạng thái:** `IsDeleted=false` áp dụng trên mọi bảng có cột này trong SQL.
- [ ] **Null / phân trang / performance:** logic null-safe đã viết (LEFT JOIN, COALESCE); **chưa
      đo performance thật** trên quy mô 142k+ đơn — cần HUMAN chạy `EXPLAIN ANALYZE` khi có DB thật,
      đặc biệt với CTE `commission_agg` GROUP BY toàn bộ `MerchantBillCommission` (không lọc ngày
      trước khi gộp — nếu chậm, có thể cần lọc theo ngày trước khi `GROUP BY`, đánh đổi độ đúng khi
      1 đơn có hoa hồng phát sinh ngoài khoảng ngày của chính đơn đó, cực hiếm nhưng cần lưu ý).
- [x] **Security:** readonly (`$queryRaw` chỉ `SELECT`, test khẳng định), sau `JwtAuthGuard`.

## Ghi chú / quyết định

- **2026-08-12: Quyết định grain (hỏi trực tiếp user, không tự suy đoán)** — 1 dòng lưới = 1
  `MerchantBill`, không phải 1 dòng `MerchantBillCommission` như gợi ý trong DataModel doc. Đây là
  đúng loại rủi ro "số sai mà trông vẫn hợp lý" mà dự án lo ngại nhất: 2 tài liệu nguồn (Requirement
  vs DataModel) mâu thuẫn nhau về grain, và chọn sai sẽ cho ra 1 report vẫn chạy được, vẫn có số,
  nhưng lặp đơn hoặc mất thông tin tuỳ hướng sai.
- **2026-08-12: Quyết định "Tổng tiền hoa hồng" = toàn đơn, không theo filter** — xem §1, cần
  CoShare xác nhận lại vì đây là điểm dễ hiểu nhầm nhất của report.
- **2026-08-12: Không làm nút Export** trong lần này — gợi ý UX chỉ có trong
  `03-Commission-Report-ImplementationGuide.md §5` (không normative), không có trong
  `00-...Requirement.md §3` (nguồn yêu cầu chính thức). Ghi lại là quyết định phạm vi rõ ràng, có
  thể làm sau nếu được yêu cầu — không phải bỏ sót âm thầm.
  **[Cập nhật 2026-08-13: user yêu cầu bổ sung, đã làm — xem §4b.]**
- **2026-08-13: Thêm chức năng Xuất Excel** — user yêu cầu xuất đúng dữ liệu đang hiển thị theo
  filter đã chọn; xác nhận qua `AskUserQuestion` rằng phạm vi là TOÀN BỘ đơn khớp filter (không chỉ
  trang hiện tại). Chi tiết đầy đủ ở §4b.
- **2026-08-12: Thêm 2 endpoint lookup không có tên tường minh trong bảng endpoint của
  ImplementationGuide** (`commission/levels`, `commission/beneficiaries`) — cần thiết để render
  đúng 2 filter dropdown "Cấp hệ hoa hồng" và "Người hưởng hoa hồng" mà không hardcode giá trị tĩnh
  (Cấp có thể đổi theo cấu hình CoShare) hoặc lẫn vào filter `keyword` chung (Requirement liệt kê 2
  filter này riêng biệt với "Tên").
- **2026-08-12: Chưa chạy recon test được** — môi trường code hiện tại không có `.env`/kết nối DB
  thật. Giao lại cho HUMAN chạy `RECON_DB=1` và điền số vàng vào `conventions.md §5.4`, theo đúng
  quy trình đã áp dụng cho Screen 1/2.
- **2026-08-12: CoShare sửa nguồn dữ liệu `orderCode`/`msnv` (đã code sai ban đầu, user báo trực
  tiếp)** — `orderCode` là `Order.OrderNumber` (qua `Order_MerchantBill_Mapping`), **không phải**
  `MerchantBill.OrderNumber`; `msnv` là `ConfigEmployee.EmployeeCode` (qua `UserLoginId`), **không
  phải** `Staff.StaffCode`. Cả 2 cột nguồn mới đều không có ràng buộc unique trên khoá nối → dùng
  subquery tương quan `ORDER BY "Id" LIMIT 1` thay vì `LEFT JOIN` trực tiếp, để không vi phạm quyết
  định grain "1 dòng = 1 MerchantBill" nếu phát sinh nhiều dòng khớp. Đã sửa SQL, filter `msnv`,
  filter `keyword`, và test tương ứng; test suite xanh lại sau khi sửa.
