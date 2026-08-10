# Hướng dẫn triển khai — Báo cáo Hoa hồng

> Dành cho **AI/dev** thực hiện report này trong project `cosharereport` (app read-only:
> NestJS + Prisma đọc Postgres CoShare, frontend React). Bám theo `docs/reports/_TEMPLATE.md`.
> Đọc trước: [`00-...Requirement.md`](./00-Commission-Report-Requirement.md) ·
> [`01-...DataModel.md`](./01-Commission-Report-DataModel.md) ·
> [`02-...Queries.sql`](./02-Commission-Report-Queries.sql).

---

## 0. TRƯỚC KHI CODE — chốt giả định (bắt buộc)
Report này rủi ro **số sai nghiệp vụ**, không phải "chạy hay không". Gửi CoShare 9 câu ở
`00-...Requirement.md §4`. Ưu tiên chốt: `StatusBill` (Thành công/Huỷ), **Cty = Merchant?**,
**MSNV của ai**, **Loại sp** mapping. Ghi câu trả lời vào `docs/db/conventions.md` + cập nhật
`docs/db/table-dictionary.md` cho các bảng ở §2 file DataModel.

---

## 1. Kiến trúc đề xuất
1 report, 3 tab ⇒ nên tách **3 endpoint** (mỗi tab 1 query), dùng chung DTO filter.

```
apps/api/src/reports/
  reports.controller.ts   ← thêm 3 @Get (sau JwtAuthGuard)
  reports.service.ts      ← commissionOverview() / commissionByPerson() / commissionDetail()
  dto/commission-report.dto.ts  ← validate query params
apps/web/src/
  api/reports.api.ts      ← 3 fn gọi API + interface kết quả
  pages/CommissionReportPage.tsx  ← 3 tab (Ant/MUI Tabs) + bộ lọc + bảng + pie chart
  routes/index.tsx        ← thêm route
```

## 2. Endpoint
| Tab | Method | Path | Query |
|---|---|---|---|
| 1 tổng quan | GET | `/reports/commission/overview` | `from,to,merchantGuid?` |
| 1 theo người | GET | `/reports/commission/by-person` | `from,to,merchantGuid` (bắt buộc) |
| 1 biểu đồ | GET | `/reports/commission/by-level` | `from,to,merchantGuid?` |
| 2 & 3 chi tiết | GET | `/reports/commission/detail` | `from,to,merchantGuid?,affiliateLevelId?,affiliateUserId?,msnv?,statusBill?,productType?,keyword?,page,pageSize` |
| 3 line-item | GET | `/reports/commission/detail/:billId/items` | — |

- Đặt sau `JwtAuthGuard`. Cân nhắc `@Roles` (chỉ admin/kế toán xem hoa hồng — hỏi role nào).
- Endpoint `detail` trả cả **summary** (dòng đầu) + **rows** (phân trang).

## 3. Query (backend)
- Copy SQL từ `02-...Queries.sql`. Với aggregate phức tạp (CTE, FILTER, LATERAL) → dù
  **`prisma.$queryRaw`** (readonly). Query đơn giản có thể dùng `findMany/aggregate`.
- **CHỈ readonly** — không `$executeRaw`, không create/update/delete. Middleware trong
  `prisma.service.ts` chặn ghi, nhưng đừng dựa vào nó.
- Áp `IsDeleted = false` ở mọi bảng cho tới khi chốt khác.
- Biên ngày: dùng helper `common/utils/date-range.ts::toUtcDateRange(from, to, tz)` +
  `timezone.util.ts::normalizeTimezone(tz)` (xem `docs/db/conventions.md §1`).
- **Bẫy nhân bản (fan-out):** 1 đơn có nhiều dòng hoa hồng. KHÔNG `SUM(TotalMoney)` sau khi
  JOIN commission. Tính hoa hồng ở CTE/subquery theo `MerchantBillId` (SQL đã làm sẵn).

## 4. DTO / validate
```ts
// dto/commission-report.dto.ts (phác thảo)
class CommissionDetailQuery {
  @IsDateString() from: string;
  @IsDateString() to: string;
  @IsOptional() @IsUUID() merchantGuid?: string;
  @IsOptional() affiliateLevelId?: string;   // BigInt → string
  @IsOptional() affiliateUserId?: string;
  @IsOptional() @IsString() msnv?: string;
  @IsOptional() statusBill?: number;
  @IsOptional() @IsIn(['PHYSICAL','NON_PHYSICAL']) productType?: string;
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() page = 1;  @IsOptional() pageSize = 50;
}
```
> **BigInt & Decimal:** Prisma trả `BigInt`/`Decimal` — serialize sang string trước khi trả JSON
> (BigInt không JSON.stringify được). Tiền để string để không mất chính xác.

## 5. Frontend
- **Tabs:** Tổng quan / Chi tiết hoa hồng / (Tab3 nếu tách riêng — hoặc gộp Tab2+Tab3 bằng cờ
  "hiện chi tiết mặt hàng").
- **Tab 1:** bảng tổng hợp; click 1 dòng Cty → gọi `by-person` (drill-down). Pie chart từ
  `by-level` (thư viện chart sẵn có của web).
- **Tab 2/3:** bảng phân trang + dòng summary trên cùng + nút **Export** (Excel/CSV). Tab 3 thêm
  cột "Chi tiết đơn hàng" (mở rộng dòng → gọi `.../items`, hoặc dùng `string_agg` inline).
- Bộ lọc: date range picker, select Cty, select Cấp, input MSNV, select Trạng thái, radio
  Loại sp (vật lý/phi vật lý), ô tìm nhanh (keyword).

## 6. Kiểm tra (bắt buộc — theo `_TEMPLATE.md §6`)
- [ ] **Đối soát:** chọn 1 đơn cụ thể → tự cộng `CommisionAmount` các dòng → khớp "Tổng hoa hồng".
- [ ] **Fan-out:** so "Doanh thu" Tab1 với `SUM(TotalMoney)` đếm tay trên vài Cty (không bị nhân bản).
- [ ] **Con số vàng:** xin CoShare 1 con số hoa hồng đã biết đúng (1 tháng/1 người) → so.
- [ ] **Biên ngày + timezone** đúng múi giờ nghiệp vụ.
- [ ] **StatusBill / soft-delete** đúng quy ước đã chốt.
- [ ] **Null / phân trang / performance:** `EXPLAIN` query detail (bảng lớn); có `LIMIT`.
- [ ] **Security:** readonly; đúng role; không rò rỉ PII ngoài phạm vi.

## 7. Thứ tự làm gợi ý
1. Chốt giả định §0 → cập nhật `conventions.md` + `table-dictionary.md`.
2. Backend Tab 1 (overview + by-level) → verify số.
3. Backend detail (Tab 2/3) + summary + phân trang.
4. Frontend 3 tab + export.
5. Đối soát §6 → chỉ ký "xong" khi số khớp con số vàng.
