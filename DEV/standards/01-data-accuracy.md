# 01 — Data Accuracy (số liệu đúng nghiệp vụ) 🔴 P0

> Rủi ro lớn nhất của app report **không phải** "chạy được" mà là **số sai mà trông vẫn hợp lý**.
> Số sai còn tệ hơn báo lỗi: không ai biết để sửa. Đây là chuẩn quan trọng nhất trong bộ này.

Mọi report **PHẢI** đạt hết mục dưới trước khi được coi là đúng. Bổ trợ bằng
[08-verification.md](./08-verification.md) (cách đối soát) và [02](./02-metric-definitions.md) (định nghĩa metric).

---

## 1. Grain — xác định "1 dòng nghĩa là gì" trước khi viết query

**MUST:** mỗi report/query khai báo rõ **grain** (đơn vị của 1 dòng kết quả) ngay trong spec.
Sai grain là nguồn sai số phổ biến nhất.

- Ví dụ đúng: *"1 dòng = 1 đơn hàng (`MerchantBill`)"* · *"1 dòng = 1 user / ngày"* · *"1 dòng = 1 dòng hoa hồng (`Commission`)"*.
- Khi `SUM`/`COUNT`, luôn tự hỏi: *đang cộng trên grain nào?* Cộng nhầm grain sau JOIN → phóng đại số.

## 2. JOIN fan-out & dedup (bẫy số bị nhân lên)

JOIN 1-nhiều làm bản ghi bên "1" **lặp lại** theo số bản ghi bên "nhiều" → `SUM`/`COUNT` bị phồng.

**MUST:**
- Khi `SUM` một cột ở bảng cha mà có JOIN tới bảng con → dùng `COUNT(DISTINCT ...)` / `SUM(DISTINCT ...)` **theo khóa cha**, hoặc aggregate bảng con ở subquery **trước** khi JOIN.
- ⚠️ Bài học có thật của project (xem `conventions.md` §5): *doanh thu = `SUM(TotalMoney)` theo **DISTINCT bill**, không cộng lặp qua các dòng hoa hồng*. Cộng thẳng sau join hoa hồng → sai gấp nhiều lần.

```sql
-- ❌ SAI: TotalMoney bị nhân theo số dòng commission
SELECT SUM(b."TotalMoney") FROM "MerchantBill" b
JOIN "Commission" c ON c."BillId" = b."Id";

-- ✅ ĐÚNG: gộp về grain đơn hàng trước
SELECT SUM(b."TotalMoney") FROM (
  SELECT DISTINCT "Id", "TotalMoney" FROM "MerchantBill"
) b;
```

## 3. Null, zero, và "không có dữ liệu" — ba thứ khác nhau

**MUST:** phân biệt rõ và xử lý nhất quán:

| Tình huống | Ý nghĩa | Hiển thị (xem [06](./06-formatting-localization.md)) |
|---|---|---|
| `NULL` | chưa có / chưa biết | `—` (dash), **không** hiển thị `0` |
| `0` | có dữ liệu, giá trị bằng 0 | `0` |
| 0 dòng trả về | không có bản ghi khớp filter | empty state, **không** để crash |

- `SUM` trên tập rỗng trả `NULL` (không phải 0) — dùng `COALESCE(SUM(x), 0)` khi muốn 0.
- `COUNT(col)` bỏ qua `NULL`; `COUNT(*)` thì không → chọn đúng ý định.
- `AVG` bỏ qua `NULL` → nếu muốn tính null như 0, phải `COALESCE` trước.
- FE: dùng `safeArray()` (xem `principles/coding.md`) — không để một object lọt vào `.map()`.

## 4. Bộ lọc mặc định phải nhất quán mọi report

Cùng một khái niệm phải **lọc giống nhau** ở mọi report, nếu không hai report sẽ "đá" nhau.

**MUST — mỗi query ghi rõ 3 bộ lọc sau trong spec (giá trị lấy từ `docs/conventions.md`):**
1. **Soft-delete** ❓ — loại hay giữ bản ghi đã xoá? (project nhắc cột kiểu `IsDeleted` / `Log_*` — **chốt với CoShare**). Ví dụ đã dùng: `MerchantBill.IsDeleted = false`.
2. **Trạng thái / status** — chỉ tính status nào? (vd `MerchantBill.StatusBill`: `2=Finished` mới là "thành công" — bảng ánh xạ trong `conventions.md` §3).
3. **Phạm vi thời gian** — cột mốc thời gian nào (created? completed? paid?) và múi giờ nào.

> ⚠️ Cùng "đơn thành công" nhưng report A lọc `StatusBill=2` còn report B lọc `IsDeleted=false` → hai con số khác nhau, không đối chiếu được. **Định nghĩa 1 lần trong registry [02](./02-metric-definitions.md), tái dùng.**

## 5. Timezone & biên ngày (bẫy lệch 1 ngày)

DB giả định lưu **UTC**; nghiệp vụ theo **Asia/Ho_Chi_Minh (UTC+7)** ❓ — **phải chốt**.

**MUST:**
- "Theo ngày" phải quy đổi **biên ngày** theo múi giờ nghiệp vụ, không so trực tiếp cột UTC.
- Dùng helper có sẵn: `common/utils/date-range.ts::toUtcDateRange(start, end, tz)`.
- Ví dụ (từ code): ngày `2026-04-09` @ `Asia/Ho_Chi_Minh` → `gte = 2026-04-08T17:00:00Z`, `lte = 2026-04-09T16:59:59.999Z`.
- Khoảng ngày: quy ước **`[gte, lte]` inclusive** hai đầu, hay `[start, end)` nửa mở — **chọn 1 và dùng nhất quán**; ghi rõ trong spec. (Nửa mở `[start, nextDay)` an toàn hơn với mili-giây.)
- Kiểm: dữ liệu lúc `00:00` và `23:59:59` của ngày biên phải rơi đúng phía.

## 6. Làm tròn & tiền tệ — làm tròn ở bước cuối cùng

**MUST:**
- Tính toán giữ **đủ độ chính xác**; chỉ làm tròn khi **hiển thị** (xem [06](./06-formatting-localization.md)).
- Tiền VND: xử lý như **số nguyên đồng**; tránh `float` cho phép cộng dồn lớn. Với Prisma `Decimal`, giữ nguyên `Decimal`, **không** ép `Number()` giữa chừng.
- `%` = `phần / tổng`: chặn chia 0 (`tổng = 0 → hiển thị —`, không phải `NaN`/`Infinity`).
- Tổng các dòng đã làm tròn **có thể ≠** tổng làm tròn một lần → luôn tính tổng từ giá trị gốc, không cộng các số đã làm tròn.

## 7. Nhất quán chéo (cross-check bắt buộc)

**MUST:** trước khi tin, kiểm ít nhất một quan hệ bất biến:
- Tổng của các nhóm (`groupBy`) **=** tổng toàn cục.
- Ví dụ project: `L1 + L2 + L3 = tổng hoa hồng` (2.682.494 + 10.936.588 + 2.400 ≈ tổng — xem `conventions.md`).
- Số dòng sau filter ≤ số dòng thô; tỷ lệ % các nhóm cộng lại = 100% (±sai số làm tròn).

## 8. Nguồn của sự thật & giả định

**MUST:**
- Công thức metric lấy từ backend CoShare (`docs/coshare-backend/`) khi có; nếu tự suy luận → đánh dấu `❓` và ghi giả định vào spec + `conventions.md`.
- **Không** hardcode con số kỳ vọng trong code. Golden numbers sống ở `docs/conventions.md` §5.

---

## Checklist Data Accuracy (copy vào QA từng report)

- [ ] **Grain** của mỗi dòng đã khai báo rõ trong spec.
- [ ] Kiểm **fan-out do JOIN**; `SUM/COUNT` đúng grain (DISTINCT / subquery khi cần).
- [ ] **Null vs 0 vs rỗng** xử lý & hiển thị đúng; `COALESCE` ở nơi cần.
- [ ] 3 bộ lọc **soft-delete / status / thời gian** ghi rõ và khớp registry metric.
- [ ] **Timezone & biên ngày** đúng múi giờ nghiệp vụ; test mốc `00:00` và `23:59:59`.
- [ ] **Làm tròn** chỉ ở hiển thị; tiền tính trên giá trị gốc/`Decimal`; chặn chia 0.
- [ ] **Cross-check** ≥1 bất biến (tổng nhóm = tổng tổng).
- [ ] **Đối soát** 1 lát nhỏ bằng SQL độc lập + ≥1 golden number → khớp ([08](./08-verification.md)).

> **Why:** báo cáo sai một lần được phát hiện sẽ làm mất niềm tin vào *toàn bộ* hệ thống report.
> Chi phí kiểm số bây giờ rẻ hơn nhiều chi phí sửa niềm tin sau này.
