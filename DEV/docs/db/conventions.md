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
| Tổng đơn (MerchantBill, IsDeleted=false) | toàn kỳ, 2026-08-10 | **1.218** | query readonly |
| Tổng doanh thu (SUM TotalMoney, DISTINCT bill) | toàn kỳ | **160.191.779** | query readonly |
| Tổng dòng hoa hồng | toàn kỳ | **2.611** | query readonly |
| Tổng tiền hoa hồng | toàn kỳ | **13.621.482** | query readonly |
| Hoa hồng theo cấp L1/L2/L3 | toàn kỳ | **2.682.494 / 10.936.588 / 2.400** | query readonly |

> Chi tiết + cách tính: `../requirements/commission-report/04-DB-Verification-Findings.md`.

---

> **Nguyên tắc cứng — connection READONLY, chỉ đọc.** Không ghi bất cứ gì vào DB (không
> create/update/delete/migrate/CREATE/ALTER/DROP/INSERT/UPDATE/DELETE). Chỉ dùng
> `findMany/findUnique/aggregate/count/$queryRaw`. Middleware trong `prisma.service.ts` chặn ghi
> như lớp phòng vệ cuối — nhưng đừng dựa vào nó.
>
> **Cần view/function?** Claude không tự tạo — viết SQL vào `sql-scripts/` và **giao task cho HUMAN**
> chạy. Mọi SQL script lưu ở `sql-scripts/` với tên `yyyy-MM-dd HH:mm <mô tả>.sql`.
