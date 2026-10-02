# Report: Thống kê lượt bán

## 1. Spec — mô tả nghiệp vụ

- **Câu hỏi report trả lời:** "Trong khoảng ngày X, mỗi sản phẩm bán được bao nhiêu lượt (số lượng)?"
- **Ai được xem:** mọi user đã đăng nhập (đã qua `JwtAuthGuard`), chưa cần phân quyền theo role.
- **Cột output:** mã sản phẩm (`code`), nhóm sản phẩm (`groupName`/`groupCode`), tên sản phẩm (`name`), lượt bán (`salesCount`, số nguyên).
- **Filter đầu vào:** khoảng ngày đơn hàng (`from`/`to`, bắt buộc) + timezone (optional, mặc định UTC) + mã/tên/nhóm sản phẩm (optional) + phân trang (page/pageSize, default 1/50) + sort (`sortBy` ∈ {salesCount, code, name}, `sortDir` ∈ {asc, desc}, default salesCount/desc).
- **Định nghĩa từng con số (chốt với user 2026-10-02, SỬA LẠI cùng ngày — xem Ghi chú):**
  - **Lượt bán** = `SUM(MerchantBillDetail.Quantity)` của các dòng chi tiết thuộc sản phẩm đó, trong các đơn (`MerchantBill`) có Order liên kết (qua `Order_MerchantBill_Mapping`) ở trạng thái **ĐÃ GIAO** (`Order.OrderStatusCode = 'DELIVERED'`, tương đương `OrderStatusId = 10`), `BillDate` nằm trong khoảng lọc (theo timezone), và dòng chi tiết/đơn/mapping/order đều `IsDeleted = false`.
  - Sản phẩm **chưa bán lần nào** trong khoảng lọc vẫn xuất hiện trong danh sách với lượt bán = 0 (yêu cầu "lấy toàn bộ sản phẩm trong hệ thống").

## 2. Nguồn dữ liệu

- **Bảng chính:** `MerchantProduct` (toàn bộ sản phẩm, `IsDeleted = false`) — ☐ chưa có trong `docs/db/table-dictionary.md`.
- **Bảng join:** `MerchantGroupProduct` (nhóm sản phẩm), `MerchantBillDetail` (dòng chi tiết đơn) + `MerchantBill` (đơn hàng, để lấy `BillDate`) + `Order_MerchantBill_Mapping` + `Order` (để lấy trạng thái giao hàng thật — xem Ghi chú).
- **Quy ước áp dụng:** soft-delete ☑ loại (`IsDeleted = false` trên `MerchantProduct`, `MerchantBillDetail`, `MerchantBill`, `Order_MerchantBill_Mapping`, `Order`) · trạng thái lọc: `Order.OrderStatusCode = 'DELIVERED'` (`OrderStatusId = 10`) · timezone: tham số `timezone`, mặc định UTC nếu không truyền (giống các report hoa hồng).
- **Đã verify:** 1 `MerchantBill` chỉ map với đúng 1 `Order` qua `Order_MerchantBill_Mapping` (1233 mapping = 1233 bill riêng biệt, không có bill nào map >1 order) — JOIN không fan-out nhân đôi `Quantity`.
- **Giả định chưa xác nhận:** ❓ "lượt bán" có cần loại trừ sản phẩm `IsHideOnWeb`/`IsSuspended` (ẩn trên web) khỏi danh sách không? Hiện tại **không lọc** — hiển thị tất cả sản phẩm chưa xoá mềm, kể cả đã ẩn/ngừng bán, để không bỏ sót lịch sử bán hàng.

## 3. Query (backend)

- Vị trí: `apps/api/src/reports/reports.service.ts::salesCount()`
- Loại: ☑ `$queryRaw` (CTE `sales` aggregate theo ProductId, LEFT JOIN vào CTE `base` liệt kê toàn bộ `MerchantProduct`).
- **Chỉ readonly.** Không create/update/delete/$executeRaw.
- `ORDER BY` động theo `sortBy`/`sortDir` nhưng dùng whitelist cột (`SALES_COUNT_SORT_COLUMNS`) — không nội suy trực tiếp input người dùng vào SQL.

## 4. Endpoint

- `@Get('sales-count')` trong `reports.controller.ts` (sau `JwtAuthGuard`).
- DTO: `SalesCountQueryDto` (`dto/sales-count-query.dto.ts`) validate qua ValidationPipe.
- Dùng lại `@Get('merchant-products/groups')` sẵn có cho dropdown "Nhóm sản phẩm" (không thêm endpoint groups mới).

## 5. Frontend

- API: `apps/web/src/api/reports.api.ts::getSalesCountApi()` + interface `ISalesCountQuery`/`ISalesCountRow`/`ISalesCountResult`.
- Page: `apps/web/src/pages/SalesCountPage.tsx` + route `reports/sales-count` trong `routes/index.tsx` + mục nav trong `config/nav.config.tsx`.
- Sort theo cột: bấm header "Lượt bán"/"Mã sản phẩm"/"Tên sản phẩm" để đổi `sortBy`, bấm lại cột đang active để đảo `sortDir`. Mặc định `salesCount`/`desc`.

## 6. Kiểm tra (bắt buộc — không chỉ "chạy được")

- [x] **Unit test (TDD):** `reports.service.sales-count.spec.ts` — 11 test, mock `$queryRaw`, assert SQL readonly, LEFT JOIN (sản phẩm chưa bán vẫn hiện), `SUM(d."Quantity")`, lọc `OrderStatusCode='DELIVERED'`/`OrderStatusId=10`, whitelist `ORDER BY`, pagination/window function.
- [x] **Đối soát (chạy tay trên DB thật 2026-10-02):** `SELECT COUNT(*), SUM(Quantity) FROM MerchantBillDetail d JOIN MerchantBill b ... JOIN Order_MerchantBill_Mapping omb ... JOIN Order o ... WHERE o."OrderStatusCode"='DELIVERED' OR o."OrderStatusId"=10` → 1217 dòng, tổng 1227 — khớp logic join trong service. Chưa đối soát theo **1 sản phẩm cụ thể** — cần làm khi có use case thật.
- [ ] **Con số vàng:** chưa có — ghi vào `docs/db/conventions.md` khi có số tham chiếu từ CoShare.
- [ ] **Biên ngày + timezone:** dùng chung `toUtcDateRange()` đã verify ở các report hoa hồng — cần test thủ công 1 lần với ngày biên (00:00 / 23:59:59) theo múi giờ thực tế đang dùng.
- [x] **Soft-delete / trạng thái:** loại `IsDeleted` trên toàn bộ 5 bảng liên quan; chỉ tính đơn `OrderStatusCode='DELIVERED'` theo đúng chốt lại với user 2026-10-02.
- [x] **Null / phân trang / performance:** `LEFT JOIN` + `COALESCE(..., 0)` xử lý sản phẩm chưa bán; `LIMIT/OFFSET` + `COUNT(*) OVER()` cùng 1 query (không lệch filter giữa đếm và lấy dữ liệu); có `ORDER BY ... , id ASC` tie-break ổn định khi phân trang.
- [x] **Security:** readonly, không rò rỉ PII (chỉ trả mã/tên/nhóm sản phẩm + số lượt bán); `sortBy` được whitelist, `groupProductId` được validate là số nguyên trước khi đưa vào SQL.

## Ghi chú / quyết định

- 2026-10-02: Chốt với user lần 1 — "lượt bán" = `SUM(Quantity)` (không phải số dòng/số đơn khác nhau); chỉ tính đơn `StatusBill = 2` (Thành công).
- 2026-10-02: **Phát hiện bug số liệu** — sau khi deploy, user báo report luôn trả về 0 lượt bán cho mọi sản phẩm. Kiểm tra trực tiếp trên DB thật (readonly) phát hiện: toàn bộ 1234 `MerchantBill` hiện có đều ở `StatusBill = 1` ("Đang xử lý"), KHÔNG có đơn nào từng đạt `StatusBill = 2` hoặc `3`. Rule lọc ban đầu không sai về code, nhưng sai giả định nghiệp vụ — `MerchantBill.StatusBill` không phải là nơi theo dõi "đơn đã hoàn tất/đã giao" trong hệ thống này.
- 2026-10-02: Chốt lại với user — dùng `Order.OrderStatusCode = 'DELIVERED'` (tương đương `Order.OrderStatusId = 10`) qua `Order_MerchantBill_Mapping` để xác định đơn đã giao thành công. Verify trên DB thật: 1211 Order ở trạng thái DELIVERED, join ra 1217 dòng `MerchantBillDetail` (tổng Quantity = 1227); `Order_MerchantBill_Mapping` là quan hệ 1-1 với `MerchantBill` (1233 mapping = 1233 bill, không bill nào map nhiều hơn 1 order) nên không có rủi ro fan-out nhân đôi số lượng.
- Không có yêu cầu xuất Excel cho report này (khác với 3 báo cáo hoa hồng) — không implement export.
