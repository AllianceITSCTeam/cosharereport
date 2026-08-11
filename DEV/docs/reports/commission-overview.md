# Report: Hoa hồng tổng quan (Commission Overview — Screen 1)

## 1. Spec — mô tả nghiệp vụ

- **Câu hỏi report trả lời:** Trong một khoảng ngày, mỗi Công ty có tổng doanh thu / tổng đơn /
  đơn thành công / đơn huỷ / tổng tiền hoa hồng là bao nhiêu?
- **Ai được xem:** mọi user đã qua `JwtAuthGuard` (chưa có phân quyền theo role riêng cho report này).
- **Cột output:** `companyId`, `companyName` (Cty), `revenue` (Doanh thu), `totalOrders` (Tổng đơn),
  `successOrders` (Thành công), `cancelledOrders` (Huỷ), `totalCommission` (Hoa hồng).
- **Filter đầu vào:** `from`, `to` (bắt buộc, `YYYY-MM-DD`, local date theo `timezone`), `timezone`
  (optional, mặc định `UTC` qua `normalizeTimezone`). **Không có filter Công ty** ở Screen 1 (đúng spec
  `00-Commission-Report-Requirement.md`).
- **Định nghĩa từng con số** (khớp `docs/db/conventions.md`):
  - Doanh thu = `SUM(MerchantBill.TotalMoney)`, mỗi **đơn** chỉ tính 1 lần (không fan-out qua nhiều seller).
  - Tổng đơn = `COUNT` bill trong khoảng ngày, `IsDeleted=false`.
  - Thành công = đơn có `StatusBill=2`; Huỷ = `StatusBill=3` (enum đã chốt, `conventions.md §3`).
  - Hoa hồng = `SUM(MerchantBillCommission.CommisionAmount)` của các dòng `IsDeleted=false` thuộc các
    bill trong khoảng ngày (không phụ thuộc company đã map được hay chưa).
  - Company của 1 đơn = company của **1 seller bất kỳ** trên đơn đó (`DISTINCT ON`, xem mục 3) — đơn có
    nhiều seller thuộc nhiều company khác nhau vẫn chỉ tính vào **1** company (chưa chốt company nào ưu
    tiên khi seller thuộc nhiều company khác nhau — hiện lấy theo `ORDER BY MerchantBillId, Id` tức
    dòng hoa hồng có `Id` nhỏ nhất) ❓.

## 2. Nguồn dữ liệu

- **Bảng chính:** `MerchantBill`, `MerchantBillCommission` (đã lập tài liệu trong
  `docs/db/table-dictionary.md` ✅).
- **Bảng join:** `UserLogin_Company_Mapping` (map seller → company), `Company` (tên hiển thị).
- **Quy ước áp dụng:** soft-delete ☑ loại (`IsDeleted=false` trên cả 3 bảng có cột này) · trạng thái lọc:
  không lọc theo `StatusBill` (Screen 1 hiển thị tất cả, chỉ đếm riêng Thành công/Huỷ) · timezone:
  `toUtcDateRange(from, to, timezone)`, lọc theo `MerchantBill.BillDate`.
- **Giả định chưa xác nhận:**
  - ❓ Đơn không map được Company (seller không có `UserLogin_Company_Mapping`) hiện hiển thị 1 dòng
    `companyId/companyName=null` — nhãn hiển thị ("Không xác định"?) chưa chốt với CoShare.
  - ❓ Khi 1 đơn có nhiều seller thuộc nhiều company khác nhau, company nào được chọn đại diện — hiện
    chọn tuỳ ý theo `Id` nhỏ nhất của dòng `MerchantBillCommission`, chưa xác nhận với CoShare đây có
    đúng quy tắc nghiệp vụ không (thực tế 2026-08-10 độ phủ seller→company là 100% nên case multi-company
    trên 1 đơn hiếm/không xảy ra, nhưng SQL vẫn xử lý được nếu có).

## 3. Query (backend)

- Vị trí: `apps/api/src/reports/reports.service.ts::commissionOverview()`.
- Loại: ☑ `$queryRaw` (CTE `seller_company` dùng `DISTINCT ON` để chọn đúng 1 company/đơn trước khi
  `SUM` doanh thu — tránh fan-out khi 1 đơn có nhiều seller; xem `conventions.md §5.2`).
- **Chỉ readonly.** Không create/update/delete/$executeRaw — test unit khẳng định SQL không chứa
  `INSERT/UPDATE/DELETE/CREATE/ALTER/DROP`.

## 4. Endpoint

- `GET /reports/commission/overview` trong `reports.controller.ts` (sau `JwtAuthGuard`).
- DTO `CommissionOverviewQueryDto` validate `from`/`to` (bắt buộc, `@IsDateString`), `timezone`
  (optional) qua `ValidationPipe` toàn cục.

## 5. Frontend

- **Chưa làm** — phiên làm việc này chốt scope "chỉ backend trước". Khi làm:
  - API: `apps/web/src/api/reports.api.ts::getCommissionOverview()` + interface kết quả (khớp
    `CommissionOverviewRow` phía backend).
  - Page: `apps/web/src/pages/CommissionOverviewPage.tsx` + route trong `routes/index.tsx`.

## 6. Kiểm tra (bắt buộc — không chỉ "chạy được")

- [x] **Đối soát:** `reports.service.recon.spec.ts` — đối soát trên toàn bộ dữ liệu thật
      (`[2000-01-01, 2030-01-01]` đại diện "toàn kỳ"), khớp golden numbers mới.
- [x] **Con số vàng:** ghi vào `docs/db/conventions.md §5.1` (142.400 đơn / 6.151.893.571.500 doanh thu /
      74.412.265.906 hoa hồng, refresh 2026-08-11).
- [ ] **Biên ngày + timezone:** chưa có test riêng cho biên ngày theo timezone khác `UTC` (vd
      `Asia/Ho_Chi_Minh`) — mới test toàn kỳ, chưa test 1 ngày cụ thể lệch UTC offset.
- [x] **Soft-delete / trạng thái:** `IsDeleted=false` áp dụng trên `MerchantBill`,
      `MerchantBillCommission`, `UserLogin_Company_Mapping`; `StatusBill` 2/3 dùng đúng enum đã chốt.
- [x] **Null / phân trang / performance:** không phân trang (Screen 1 gom theo company, số dòng nhỏ =
      số company); null company xử lý bằng `LEFT JOIN` giữ dòng thay vì loại bỏ; hiệu năng ~850ms cho
      142k đơn nhờ `DISTINCT ON` (xem `conventions.md §5.2`, tránh correlated subquery `LIMIT 1`).
- [x] **Security:** readonly (`$queryRaw` chỉ `SELECT`, có test khẳng định), không có PII (chỉ company +
      số liệu tổng hợp), sau `JwtAuthGuard`.

## Ghi chú / quyết định

- 2026-08-11: User xác nhận scope phiên này = chỉ backend (service + endpoint + tests), chưa làm frontend.
- 2026-08-11: `from`/`to` là **bắt buộc**, không mặc định — theo quyết định của user (tránh query toàn kỳ
  ngoài ý muốn trên DB lớn).
- 2026-08-11: Phát hiện DB `CoShareTest` có vẻ đã reset/reseed (Company Id=14/Freetrend mất hết dữ liệu
  tên, số đơn tăng 1.218→142.400). User quyết định: **chốt golden numbers mới trên dữ liệu hiện tại**,
  không dừng lại điều tra thêm với CoShare tại thời điểm này. Ghi chi tiết ở `conventions.md §5.1` và
  `04-DB-Verification-Findings.md` (đầu file).
- 2026-08-11: SQL gốc (`02-Commission-Report-Queries.sql`) dùng correlated subquery `LIMIT 1` — treo
  >10 phút ở quy mô 142k đơn thật. User chọn phương án sửa: đổi sang `DISTINCT ON`, đã verify chạy
  ~850ms, không cần index mới. Áp dụng cùng cách cho Screen 2/3 khi tới lượt.
