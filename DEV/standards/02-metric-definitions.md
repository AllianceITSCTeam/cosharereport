# 02 — Metric Definitions (định nghĩa metric & registry) 🔴 P0

> Một metric mơ hồ = mỗi report tính một kiểu = số không đối chiếu được.
> Chuẩn này bắt mọi con số phải có **một định nghĩa duy nhất, viết ra được, tái dùng được**.

---

## 1. Một metric hợp lệ phải trả lời đủ 7 câu

**MUST** — trước khi code, mỗi metric có đủ:

| # | Thành phần | Ví dụ (`Tổng doanh thu`) |
|---|---|---|
| 1 | **Tên + slug** | Tổng doanh thu · `total_revenue` |
| 2 | **Câu hỏi trả lời** | "Tổng tiền các đơn hợp lệ trong kỳ?" |
| 3 | **Công thức chính xác** | `SUM(TotalMoney)` theo **DISTINCT** `MerchantBill.Id` |
| 4 | **Nguồn (bảng.cột)** | `MerchantBill.TotalMoney` |
| 5 | **Bộ lọc** | `IsDeleted=false` · status ❓ · mốc thời gian = `CreatedAt` (❓) |
| 6 | **Đơn vị + grain** | VND · grain = 1 đơn hàng |
| 7 | **Golden number đối soát** | 160.191.779 (toàn kỳ, 2026-08-10) |

Thiếu 1 trong 7 → metric **chưa dùng được**, đánh dấu `❓`.

## 2. Registry — một nguồn sự thật cho mọi metric

**MUST:** mọi metric xuất hiện trong bất kỳ report nào phải có mặt trong bảng dưới (hoặc file riêng
`_templates/metric-definition.template.md` nếu công thức dài). Report **tham chiếu** metric theo slug,
không tự định nghĩa lại.

**SHOULD:** khi công thức đã kiểm chứng, đưa nó thành **1 hàm/1 helper dùng chung** ở backend để
tất cả report gọi cùng một chỗ (vd `reports.service.ts` private method), tránh copy công thức.

### Registry (điền dần — trạng thái: `✅ đã chốt` / `❓ giả định` / `🚧 đang làm`)

| Slug | Tên | Công thức (tóm tắt) | Nguồn | Lọc | Đơn vị | Golden | TT |
|---|---|---|---|---|---|---|:--:|
| `total_orders` | Tổng đơn | `COUNT(DISTINCT Id)` | `MerchantBill` | `IsDeleted=false` | đơn | 1.218 | ❓ |
| `total_revenue` | Tổng doanh thu | `SUM(TotalMoney)` distinct bill | `MerchantBill.TotalMoney` | `IsDeleted=false`, status❓ | VND | 160.191.779 | ❓ |
| `commission_rows` | Số dòng hoa hồng | `COUNT(*)` | `Commission` | ❓ | dòng | 2.611 | ❓ |
| `commission_total` | Tổng tiền hoa hồng | `SUM(<cột tiền>)` | `Commission` | ❓ | VND | 13.621.482 | ❓ |
| `commission_by_level` | Hoa hồng theo cấp | `SUM ... GROUP BY level` | `Commission` | ❓ | VND | L1 2.682.494 / L2 10.936.588 / L3 2.400 | ❓ |

> Nguồn số: `docs/db/conventions.md` §5 + `docs/requirements/commission-report/04-DB-Verification-Findings.md`.
> ⚠️ Cột tiền/level của `Commission` và bộ lọc status còn `❓` — **HUMAN xác nhận** rồi cập nhật.

## 3. Quy tắc đặt tên metric

- Slug `snake_case`, danh từ, không kèm khoảng thời gian (`total_revenue`, **không** `revenue_2026`).
- Prefix theo loại khi cần: `count_*`, `sum_*`, `rate_*`, `avg_*`.
- Metric phái sinh nêu rõ nguồn: `rate_success = total_orders_finished / total_orders`.

## 4. Khi định nghĩa thay đổi → versioning

**MUST:** đổi công thức một metric đã phát hành = **breaking change** cho số liệu.
- Ghi vào phần "Changelog" cuối file: ngày, slug, công thức cũ → mới, lý do, ai duyệt.
- Cập nhật lại golden number tương ứng; chạy lại đối soát ([08](./08-verification.md)).

## 5. Ranh giới với `docs/`

- **Nghĩa nghiệp vụ thô** (status enum, soft-delete, timezone) sống ở `docs/conventions.md`.
- **Công thức metric tổng hợp** (kết hợp các quy ước đó thành 1 con số) sống ở registry này.
- Metric tham chiếu quy ước bằng cách trỏ tới `conventions.md`, không chép lại.

---

## Checklist khi thêm/sửa metric

- [ ] Đủ 7 thành phần ở §1; không còn `❓` chặn con số (hoặc đã ghi rõ giả định).
- [ ] Đã vào registry §2 với trạng thái đúng; report chỉ tham chiếu theo slug.
- [ ] Công thức chung hoá thành helper backend nếu ≥2 report dùng.
- [ ] Có ≥1 golden number để đối soát.
- [ ] Nếu sửa công thức cũ → ghi Changelog + cập nhật golden + chạy lại đối soát.

---

## Changelog

| Ngày | Slug | Thay đổi | Lý do | Duyệt |
|---|---|---|---|---|
| 2026-08-10 | — | Khởi tạo registry từ `conventions.md` §5 | — | (chờ HUMAN) |
