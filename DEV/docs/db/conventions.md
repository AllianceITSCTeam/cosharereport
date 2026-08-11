# Conventions — quy ước nghiệp vụ CoShare (phải chốt trước khi tin số liệu)

Những quy ước dưới đây quyết định report **đúng hay sai**. Mục nào chưa xác nhận với CoShare
thì đánh dấu ❓ và **không coi số liệu là đúng** cho tới khi chốt.

## 1. Timezone ❓ (đoán: Asia/Ho_Chi_Minh / UTC+7)

- DB lưu datetime theo **UTC** (giả định). Lọc "theo ngày" phải quy đổi biên ngày theo múi giờ nghiệp vụ.
- Đã có sẵn helper: `common/utils/date-range.ts::toUtcDateRange(start, end, tz)` và
  `common/utils/timezone.util.ts::normalizeTimezone(tz)`.
- Ví dụ (từ code): ngày `2026-04-09` ở `Asia/Ho_Chi_Minh` →
  `gte = 2026-04-08T17:00:00Z`, `lte = 2026-04-09T16:59:59.999Z`.
- **Cần chốt:** DB lưu UTC hay giờ địa phương? Múi giờ nghiệp vụ chuẩn là gì?

## 2. Soft-delete ❓

- Principles (kế thừa từ Vibe365) nhắc tới cột kiểu `Log_*` / `Log_IsDeleted`.
- **Cần chốt:** schema CoShare dùng cột nào để đánh dấu bản ghi đã xoá? Report có phải loại chúng ra không?
- Cho tới khi chốt: mỗi query ghi rõ giả định (loại hay không loại soft-deleted) trong spec.

## 3. Trạng thái / enum

- Các bảng có "trạng thái" (đơn hàng, giao dịch, rút tiền...) thường dùng số/enum.
- **Cần chốt cho từng report:** giá trị nào = hoàn tất / huỷ / chờ? Report tính trên trạng thái nào?
- Ghi bảng ánh xạ giá trị → ý nghĩa vào `table-dictionary.md` cho bảng tương ứng.

### ✅ `MerchantBill.StatusBill` (từ code `eMerchantBillStatus`, đã kiểm chứng)
| Giá trị | Nghĩa | Report |
|---|---|---|
| 0 | New — phiếu nháp | (bỏ) |
| 1 | Approve — đã xác nhận đặt hàng | đang xử lý |
| 2 | Finished — hoàn thành/đã giao | **Thành công** |
| 3 | Cancel — huỷ | **Huỷ** |
> ⚠️ Dữ liệu 2026-08-10: 100% đơn = `1`. Chưa có Finished/Cancel.

### ✅ `ConfigCommPaymentStatus` (trạng thái thanh toán hoa hồng)
`1 REJECTED (Đã hủy) · 2 PAID (Đã thanh toán) · 3 INPROGRESS (Yêu cầu đang xử lý) ·
4 NOTREQUEST (Chưa yêu cầu) · 5 RECONCILING (Đang đối soát) · 6 ORDERNOTCOMPLETED (Đơn chưa hoàn tất)`.

## 4. Định nghĩa metric ❓

- "Active user", "doanh thu", "hoa hồng"... mỗi cái phải khớp **đúng công thức CoShare** đang dùng.
- Nguồn sự thật: `../coshare-backend/` (ck:doc). Chắt lọc công thức về đây khi tìm được.

## 5. Con số vàng (golden numbers) để đối soát

Xin CoShare vài con số tham chiếu đã biết đúng để so với report:

| Metric | Điều kiện (ngày/phạm vi) | Giá trị đúng | Nguồn |
|---|---|---|---|
| _(ví dụ) tổng user tạo trong T4/2026_ | _2026-04_ | _?_ | _admin panel CoShare_ |
| Tổng đơn (MerchantBill, IsDeleted=false) | toàn kỳ, 2026-08-10 | ~~1.218~~ ⚠️ stale, xem §5.1 | query readonly |
| Tổng doanh thu (SUM TotalMoney, DISTINCT bill) | toàn kỳ | ~~160.191.779~~ ⚠️ stale | query readonly |
| Tổng dòng hoa hồng | toàn kỳ | ~~2.611~~ ⚠️ stale | query readonly |
| Tổng tiền hoa hồng | toàn kỳ | ~~13.621.482~~ ⚠️ stale | query readonly |
| Hoa hồng theo cấp L1/L2/L3 | toàn kỳ | ~~2.682.494 / 10.936.588 / 2.400~~ ⚠️ stale | query readonly |

> Chi tiết + cách tính (số cũ, 2026-08-10): `../requirements/commission-report/04-DB-Verification-Findings.md`.

### 5.1. ⚠️ Golden numbers cũ đã STALE (phát hiện 2026-08-11 khi code Screen 1)

Khi code Screen 1 (Hoa hồng tổng quan) và chạy test đối soát trên DB `CoShareTest` thật,
phát hiện **DB test đã bị reset/reseed** — không chỉ đơn giản là có thêm dữ liệu mới:
- `Company Id=14` (Freetrend trong findings 2026-08-10) giờ có `Code=null, Name=null,
  ShortName=null` — không còn là Freetrend nữa.
- Tổng số đơn (`MerchantBill.IsDeleted=false`) giờ là **142.400** (thay vì 1.218).

⇒ Toàn bộ ví dụ/số liệu dựa trên "Freetrend" trong `00/01/04-Commission-Report-*.md` chỉ còn
giá trị **tham khảo cách tính** (công thức, cách tránh fan-out...), **không dùng để đối soát
số** trên DB hiện tại nữa. Golden numbers **mới** (query lại 2026-08-11, toàn kỳ không lọc
ngày, dùng range `[2000-01-01, 2030-01-01]` làm đại diện cho "toàn kỳ"):

| Metric | Giá trị mới (2026-08-11) | Ghi chú |
|---|---|---|
| Tổng đơn (MerchantBill, IsDeleted=false) | **142.400** | |
| Tổng doanh thu (SUM TotalMoney, gom theo Cty, không fan-out) | **6.151.893.571.500** | |
| Tổng tiền hoa hồng (gom theo Cty) | **74.412.265.906** | |
| Đơn không map được Company (seller không có `UserLogin_Company_Mapping`) | **13.400 đơn** / doanh thu **3.624.334.279.000** / hoa hồng **54.000** | xem §5.2 |
| Company hiện có dữ liệu | `CoShare(1)`, `Alliance(4)`, `Id=5` (Parkerizing, không có ShortName), `Id=9` (Daily Full Intl, không có ShortName), `AllianceITSC(12)` | `Id=14` không còn dữ liệu tên |

Test đối soát tương ứng: `apps/api/src/reports/reports.service.recon.spec.ts` (opt-in `RECON_DB=1`).

### 5.2. Quyết định khi code Screen 1 (2026-08-11)

- **Company display name:** fallback `COALESCE(ShortName, Name, Code)` — vài công ty
  (Id 5, 9) không có `ShortName`, phải rơi về `Name` mới hiển thị được.
- **Đơn không map được Company:** vẫn giữ 1 dòng `companyId/companyName = null` trong kết
  quả (LEFT JOIN, không loại bỏ) — vì spec Screen 1 nói "luôn hiển thị tất cả" nên không nên
  âm thầm làm mất doanh thu/đơn khỏi tổng. Frontend tự quyết định label hiển thị (vd "Không
  xác định") — chưa chốt với CoShare nên **để nguyên `null` ở tầng backend** ❓.
- **Hiệu năng:** SQL gốc ở `02-Commission-Report-Queries.sql` dùng correlated subquery
  (`LIMIT 1`) để chọn 1 company/đơn — đúng logic nhưng **không scale** ở quy mô 142k đơn (test
  treo >10 phút khi chạy thật). Đã đổi sang `DISTINCT ON` + `LEFT JOIN` (không cần index mới),
  chạy được **~850ms** cho toàn bộ dữ liệu không lọc ngày. Nên áp dụng cùng cách cho Screen
  2/3 khi tới lượt, thay vì copy nguyên `LIMIT 1` từ file SQL nháp.

---

> **Nguyên tắc cứng — connection READONLY, chỉ đọc.** Không ghi bất cứ gì vào DB (không
> create/update/delete/migrate/CREATE/ALTER/DROP/INSERT/UPDATE/DELETE). Chỉ dùng
> `findMany/findUnique/aggregate/count/$queryRaw`. Middleware trong `prisma.service.ts` chặn ghi
> như lớp phòng vệ cuối — nhưng đừng dựa vào nó.
>
> **Cần view/function?** Claude không tự tạo — viết SQL vào `sql-scripts/` và **giao task cho HUMAN**
> chạy. Mọi SQL script lưu ở `sql-scripts/` với tên `yyyy-MM-dd HH:mm <mô tả>.sql`.
