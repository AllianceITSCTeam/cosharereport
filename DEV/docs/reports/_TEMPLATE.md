# Report: <TÊN REPORT>

> Copy file này thành `<ten-report>.md` khi bắt đầu 1 report mới. Điền từ trên xuống.
> Endpoint đặt sau `JwtAuthGuard` trong `reports.controller.ts`.

## 1. Spec — mô tả nghiệp vụ

- **Câu hỏi report trả lời:** _(vd: "Có bao nhiêu user mới mỗi ngày trong khoảng?")_
- **Ai được xem:** _(role nào? → có cần `@Roles`/RolesGuard không)_
- **Cột output:** _(liệt kê cột + kiểu + ý nghĩa)_
- **Filter đầu vào:** _(khoảng ngày? timezone? phân trang? search?)_
- **Định nghĩa từng con số:** _(công thức chính xác — khớp với `docs/db/conventions.md`)_

## 2. Nguồn dữ liệu

- **Bảng chính:** `...` (đã lập tài liệu trong `docs/db/table-dictionary.md`? ☐)
- **Bảng join:** `...`
- **Quy ước áp dụng:** soft-delete ☐ loại / ☐ giữ · trạng thái lọc: `...` · timezone: `...`
- **Giả định chưa xác nhận:** _(đánh dấu ❓ chỗ nào chưa chốt với CoShare)_

## 3. Query (backend)

- Vị trí: `apps/api/src/reports/reports.service.ts::<methodName>()`
- Loại: ☐ Prisma `findMany/aggregate/count` · ☐ `$queryRaw` (aggregate phức tạp)
- **Chỉ readonly.** Không create/update/delete/$executeRaw.

## 4. Endpoint

- `@Get('<path>')` trong `reports.controller.ts` (sau `JwtAuthGuard`).
- DTO validate query params (nếu có) qua ValidationPipe.

## 5. Frontend

- API: `apps/web/src/api/reports.api.ts::<fn>()` + interface kết quả.
- Page: `apps/web/src/pages/<Name>Page.tsx` + route trong `routes/index.tsx`.

## 6. Kiểm tra (bắt buộc — không chỉ "chạy được")

- [ ] **Đối soát:** chọn 1 lát nhỏ đã biết (1 ngày / 1 user), tự đếm bằng SQL → khớp số report.
- [ ] **Con số vàng:** so với giá trị tham chiếu của CoShare (ghi vào `docs/db/conventions.md`).
- [ ] **Biên ngày + timezone:** ngày đầu/cuối khoảng đúng múi giờ nghiệp vụ.
- [ ] **Soft-delete / trạng thái:** loại/giữ đúng theo quy ước đã chốt.
- [ ] **Null / phân trang / performance:** null handling; `EXPLAIN` nếu bảng lớn; có limit.
- [ ] **Security:** readonly, không rò rỉ PII ngoài phạm vi, đúng role.

## Ghi chú / quyết định

_(log các quyết định + câu hỏi đã gửi CoShare + câu trả lời nhận được)_
