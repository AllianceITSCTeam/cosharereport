# 06 — Formatting & Localization (vi-VN) 🟠 P1

> Report cho người Việt đọc: tiền VND, ngày kiểu Việt, phân tách nghìn kiểu Việt. Format **sai một
> chỗ lặp lại khắp nơi** → gom về **helper dùng chung**, cấm format thủ công rải rác.

---

## 1. Nguyên tắc gốc

**MUST:**
- **Tính** giữ giá trị gốc/`Decimal`; **chỉ format khi hiển thị** (xem [01](./01-data-accuracy.md) §6).
- Mọi format qua **helper tập trung** ở FE (vd `apps/web/src/lib/format.ts` — tạo nếu chưa có), không gọi `toLocaleString` rải rác mỗi component.
- Locale chuẩn: **`vi-VN`**. Timezone hiển thị: **`Asia/Ho_Chi_Minh`** ❓ (khớp tz nghiệp vụ đã chốt).

## 2. Số

| Loại | Quy tắc | Ví dụ |
|---|---|---|
| Nguyên (đếm) | phân tách nghìn bằng dấu chấm | `1.218` |
| Thập phân | dấu phẩy thập phân, cố định số chữ số nếu là tỷ lệ | `12,5` |
| Số lớn (KPI) | có thể rút gọn ở thẻ tổng: `1,2 tr` / `160,2 tr` — nhưng tooltip/bảng hiện **đủ số** | `160.191.779` |

```ts
export const nf = new Intl.NumberFormat('vi-VN');
nf.format(1218);           // "1.218"
```

## 3. Tiền tệ (VND)

**MUST:**
- VND **không có phần lẻ** → 0 chữ số thập phân.
- Ký hiệu `₫` đặt **sau** số theo kiểu Việt, hoặc dùng `currency` formatter.
- Cột tiền trong bảng: căn phải, tabular.

```ts
export const vnd = new Intl.NumberFormat('vi-VN', {
  style: 'currency', currency: 'VND', maximumFractionDigits: 0,
});
vnd.format(160191779);     // "160.191.779 ₫"
```

## 4. Ngày & giờ

**MUST:**
- Ngày: `dd/MM/yyyy` (`09/04/2026`). Ngày+giờ: `dd/MM/yyyy HH:mm` (24h).
- **Luôn** hiển thị theo **tz nghiệp vụ**, không theo tz trình duyệt (dữ liệu DB là UTC — convert khi hiển thị).
- Khoảng ngày ghi rõ hai biên + tz: `09/04/2026 – 15/04/2026 (giờ VN)`.
- Với chuỗi thời gian theo ngày, nhãn trục dùng `dd/MM`.

```ts
export const fmtDate = (d: Date) =>
  new Intl.DateTimeFormat('vi-VN', {
    dateStyle: 'short', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(d);
```

## 5. Null / rỗng / 0 (nhất quán toàn app)

| Giá trị | Hiển thị |
|---|---|
| `null` / `undefined` (chưa có) | `—` (em dash) |
| `0` (có dữ liệu, bằng 0) | `0` (hoặc `0 ₫`) |
| chuỗi rỗng | `—` |
| chia cho 0 khi tính % | `—` (không `NaN`/`Infinity`) |

**MUST:** một hàm duy nhất quyết định "giá trị trống hiển thị gì" — đừng để mỗi nơi một kiểu (`-`, `N/A`, ô trống).

## 6. Phần trăm

- `%` = tỷ lệ × 100, cố định 1 chữ số thập phân mặc định (`12,5%`), làm tròn ở hiển thị.
- Tổng các % nhóm nên = 100% (±0,1 do làm tròn) — nếu lệch nhiều, kiểm lại grain ([01](./01-data-accuracy.md)).

## 7. Xuất dữ liệu (CSV/Excel — khi có)

**SHOULD:**
- CSV: encode **UTF-8 có BOM** để Excel VN không lỗi dấu; phân tách theo `,` hoặc `;` (Excel VN thường mong `;`) — chọn 1 và ghi rõ.
- Trong file xuất: số để **dạng số thô** (không format nghìn) để Excel tính được; format chỉ ở màn hình.
- Ngày xuất dạng ISO `yyyy-MM-dd` để sort đúng, hoặc dd/MM/yyyy kèm cột phụ ISO.
- Tên file: `report-<slug>-<from>_<to>.csv`.

---

## Checklist Formatting

- [ ] Mọi format qua helper chung (`format.ts`), không `toLocaleString` rải rác.
- [ ] Số: `vi-VN`, phân tách nghìn dấu chấm; tiền VND 0 thập phân, ký hiệu ₫.
- [ ] Ngày theo **tz nghiệp vụ** dạng `dd/MM/yyyy`; khoảng ngày ghi kèm tz.
- [ ] `null → —`, `0 → 0`, chia 0 → `—`; nhất quán một hàm quyết định.
- [ ] `%` cố định số thập phân; tổng nhóm ≈ 100%.
- [ ] Xuất CSV: UTF-8 BOM, số thô, tên file chuẩn (nếu có tính năng xuất).

> **Why:** con số đúng nhưng đọc là "160191779đ" hay lệch múi giờ 1 ngày sẽ bị người dùng coi là
> sai — format nhất quán bảo vệ chính uy tín của số liệu đúng.
