# Hướng dẫn triển khai — Báo cáo Hoa hồng

> Dành cho **AI/dev** thực hiện report này trong project `cosharereport` (app read-only:
> NestJS + Prisma đọc Postgres CoShare, frontend React). Bám theo `docs/reports/_TEMPLATE.md`.
> Đọc trước: [`00-...Requirement.md`](./00-Commission-Report-Requirement.md) ·
> [`01-...DataModel.md`](./01-Commission-Report-DataModel.md) ·
> [`02-...Queries.sql`](./02-Commission-Report-Queries.sql).

---

## 0. TRƯỚC KHI CODE — trạng thái giả định
Report này rủi ro **số sai nghiệp vụ**, không phải "chạy hay không". Phần lớn câu hỏi ở
`00-...Requirement.md §4` **đã chốt** (query DB 2026-08-10 + CoShare trả lời 2026-08-11):
`StatusBill` (2=Thành công/3=Huỷ) · **Cty = `Company`** · **MSNV = khách mua** ·
**cột Trạng thái = `StatusBill`** · **Loại sp**: phi vật lý = `MerchantProduct.Code` chứa `"ZALOOA"`,
vật lý = còn lại · **timezone UTC+7** · soft-delete loại `IsDeleted`.
**Mã đơn = `OrderNumber`** · **không có đơn trộn** vật lý/phi vật lý (1 đơn hoặc toàn vật lý,
hoặc đúng 1 sp phi vật lý) · **Screen 2**: doanh thu = tổng tiền đơn, tổng đơn = số đơn của thành viên.
Còn ❓ duy nhất: hoa hồng Screen 2 quy theo *tạo ra* (`SellUserId`) hay *nhận* (`AffiliateUserId`).
Ghi các chốt vào `docs/db/conventions.md` + cập nhật
`docs/db/table-dictionary.md` cho các bảng ở §2 file DataModel.

---

## 1. Kiến trúc đề xuất
1 report, **3 màn hình (screen)** ⇒ tách **các endpoint** theo screen, dùng chung DTO filter.

```
apps/api/src/reports/
  reports.controller.ts   ← thêm các @Get (sau JwtAuthGuard)
  reports.service.ts      ← commissionOverview() (S1) / commissionByPerson() + byLevel() (S2) / commissionDetail() + items() (S3)
  dto/commission-report.dto.ts  ← validate query params
apps/web/src/
  api/reports.api.ts      ← fn gọi API + interface kết quả
  pages/
    CommissionOverviewPage.tsx   ← Screen 1: Hoa hồng tổng quan
    CommissionByCompanyPage.tsx  ← Screen 2: Hoa hồng theo công ty (bắt buộc chọn Cty)
    CommissionOrdersPage.tsx     ← Screen 3: Báo cáo đơn hàng (expander line-item)
  routes/index.tsx        ← thêm 3 route
```

> **3 screen = 3 trang riêng** (không phải 3 tab trong 1 trang như bản cũ). Điều hướng qua menu/route.

## 2. Endpoint
| Screen | Method | Path | Query |
|---|---|---|---|
| S1 tổng quan | GET | `/reports/commission/overview` | `from,to` |
| S2 theo người | GET | `/reports/commission/by-person` | `from,to,companyId` (**bắt buộc** companyId) |
| S2 biểu đồ | GET | `/reports/commission/by-level` | `from,to,companyId` (bắt buộc) |
| S3 chi tiết | GET | `/reports/commission/detail` | `from,to,companyId?,affiliateLevelId?,affiliateUserId?,msnv?,statusBill?,productType?,keyword?,page,pageSize` |
| S3 line-item | GET | `/reports/commission/detail/:billId/items` | — |

- Đặt sau `JwtAuthGuard`. Cân nhắc `@Roles` (chỉ admin/kế toán xem hoa hồng — hỏi role nào).
- **Screen 1** KHÔNG có filter công ty (luôn gom tất cả Cty).
- **Screen 2** yêu cầu `companyId`: nếu thiếu → trả rỗng/`400` (frontend chưa chọn Cty thì đừng gọi API).
- Endpoint `detail` trả cả **summary** (dòng đầu) + **rows** (phân trang).
- `productType` ∈ `NON_PHYSICAL` (mã sp chứa `ZALOOA`) / `PHYSICAL` (còn lại).

## 3. Query (backend)
- Copy SQL từ `02-...Queries.sql`. Với aggregate phức tạp (CTE, FILTER, LATERAL) → dù
  **`prisma.$queryRaw`** (readonly). Query đơn giản có thể dùng `findMany/aggregate`.
- **CHỈ readonly** — không `$executeRaw`, không create/update/delete. Middleware trong
  `prisma.service.ts` chặn ghi, nhưng đừng dựa vào nó.
- Áp `IsDeleted = false` ở mọi bảng (đã chốt).
- **Timezone (đã chốt):** cột thời gian là `timestamptz` lưu UTC+00; nghiệp vụ theo **UTC+7**.
  Ngày người dùng chọn (UTC+7) → quy về UTC bằng `common/utils/date-range.ts::toUtcDateRange(from, to, 'Asia/Ho_Chi_Minh')`
  trước khi query; giá trị ngày trả ra đổi sang UTC+7 khi hiển thị (xem `docs/db/conventions.md §1`).
- **Loại sp (đã chốt):** lọc bằng `EXISTS` trên `MerchantBillDetail → MerchantProduct.Code ILIKE '%ZALOOA%'`
  (phi vật lý) / ngược lại (vật lý). SQL sẵn ở `02-...Queries.sql` (Screen 3). Không có đơn trộn nên
  2 nhánh loại trừ nhau (PHYSICAL ⇔ NOT EXISTS ZALOOA).
- **Bẫy nhân bản (fan-out):** 1 đơn có nhiều dòng hoa hồng. KHÔNG `SUM(TotalMoney)` sau khi
  JOIN commission. Tính hoa hồng ở CTE/subquery theo `MerchantBillId` (SQL đã làm sẵn).

## 4. DTO / validate
```ts
// dto/commission-report.dto.ts (phác thảo)
class CommissionDetailQuery {           // Screen 3
  @IsDateString() from: string;
  @IsDateString() to: string;
  @IsOptional() companyId?: string;          // Company.Id (BigInt → string). S2 thì bắt buộc.
  @IsOptional() affiliateLevelId?: string;   // BigInt → string
  @IsOptional() affiliateUserId?: string;
  @IsOptional() @IsString() msnv?: string;
  @IsOptional() statusBill?: number;         // = MerchantBill.StatusBill (2=Thành công, 3=Huỷ)
  @IsOptional() @IsIn(['PHYSICAL','NON_PHYSICAL']) productType?: string; // ZALOOA = NON_PHYSICAL
  @IsOptional() @IsString() keyword?: string;
  @IsOptional() page = 1;  @IsOptional() pageSize = 50;
}
```
> **BigInt & Decimal:** Prisma trả `BigInt`/`Decimal` — serialize sang string trước khi trả JSON
> (BigInt không JSON.stringify được). Tiền để string để không mất chính xác.

## 5. Frontend — 3 trang riêng
- **Screen 1 — Hoa hồng tổng quan:** bảng gom theo Cty (mỗi Cty 1 dòng). Filter chỉ có **date range**.
  (Tuỳ chọn UX: click 1 dòng Cty → mở Screen 2 với Cty đó đã chọn sẵn.)
- **Screen 2 — Hoa hồng theo công ty:** **bắt buộc chọn 1 Cty** mới có data. Chưa chọn → bảng trống
  + gợi ý "Chọn 1 công ty để xem dữ liệu" (đừng gọi API). Bảng drill-down theo người + **pie chart**
  (từ `by-level`, thư viện chart sẵn có). Filter: select Cty (bắt buộc) + date range.
- **Screen 3 — Báo cáo đơn hàng:** bảng phân trang + dòng **summary** trên cùng + nút **Export** (Excel/CSV).
  Mỗi dòng đơn có **expander (▸)**: bung ra gọi `.../items` hiện Mặt hàng / SL / Đơn giá / Thành tiền.
  Filter: date range, select Cty, select Cấp, ô người hưởng, input MSNV, select Trạng thái đơn,
  **radio Loại sp** (vật lý/phi vật lý), ô tìm nhanh (keyword: mã đơn/tên).

## 6. Kiểm tra (bắt buộc — theo `_TEMPLATE.md §6`)
- [ ] **Đối soát:** chọn 1 đơn cụ thể → tự cộng `CommisionAmount` các dòng → khớp "Tổng hoa hồng".
- [ ] **Fan-out:** so "Doanh thu" Screen 1 với `SUM(TotalMoney)` đếm tay trên vài Cty (không bị nhân bản).
- [ ] **Con số vàng:** đối soát golden numbers ở `04-...Findings §C` (toàn kỳ, không lọc).
- [ ] **Biên ngày + timezone**: đúng **UTC+7** (kiểm 1 đơn quanh nửa đêm không rớt sai ngày).
- [ ] **Loại sp**: đếm đơn có `MerchantProduct.Code ILIKE '%ZALOOA%'` → khớp bộ lọc phi vật lý; verify golden.
- [ ] **StatusBill / soft-delete** đúng quy ước đã chốt.
- [ ] **Null / phân trang / performance:** `EXPLAIN` query detail (bảng lớn); có `LIMIT`.
- [ ] **Security:** readonly; đúng role; không rò rỉ PII ngoài phạm vi.

## 7. Thứ tự làm gợi ý
1. Ghi các chốt §0 → `conventions.md` + `table-dictionary.md`.
2. Backend Screen 1 (overview) → verify số (golden `04 §C`).
3. Backend Screen 2 (by-person + by-level) → verify; ép `companyId` bắt buộc.
4. Backend Screen 3 (detail + summary + phân trang + line-item + filter productType).
5. Frontend 3 trang + export.
6. Đối soát §6 → chỉ ký "xong" khi số khớp con số vàng.
