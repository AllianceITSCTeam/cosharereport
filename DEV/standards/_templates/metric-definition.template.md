# Metric: <TÊN METRIC>

> Copy thành `docs/db/metrics/<slug>.md` (hoặc thêm 1 dòng vào registry `standards/02-metric-definitions.md`)
> khi công thức đủ dài cần file riêng. Điền đủ 7 phần — thiếu phần nào để `❓`.

- **Slug:** `<snake_case>`  ·  **Trạng thái:** ☐ ✅ đã chốt ☐ ❓ giả định ☐ 🚧 đang làm
- **Owner / người chốt nghiệp vụ:** _(ai bên CoShare/nội bộ xác nhận)_

## 1. Câu hỏi metric trả lời
_(vd: "Tổng tiền các đơn hợp lệ trong kỳ là bao nhiêu?")_

## 2. Công thức chính xác
```
_(mô tả rõ: hàm tổng hợp gì, trên cột nào, DISTINCT theo khóa nào, grain gì)_
vd: SUM(TotalMoney) theo DISTINCT MerchantBill.Id
```

## 3. Nguồn dữ liệu
- **Bảng.cột chính:** `...`
- **Bảng join (nếu có):** `...` — ⚠️ kiểm fan-out (xem standards/01 §2)

## 4. Bộ lọc áp dụng
- Soft-delete: ☐ loại ☐ giữ — cột `...` ❓
- Status: chỉ tính `...` (ánh xạ ở `conventions.md`) ❓
- Mốc thời gian: cột `...` · timezone `Asia/Ho_Chi_Minh` ❓
- Khác: `...`

## 5. Đơn vị & grain
- Đơn vị: `VND / đơn / dòng / % / user` · Grain 1 dòng = `...`

## 6. Golden number đối soát
| Điều kiện (kỳ/phạm vi) | Giá trị đúng | Nguồn |
|---|---|---|
| _..._ | _..._ | _..._ |

## 7. Ghi chú / giả định `❓`
_(chỗ nào chưa chốt với CoShare, ảnh hưởng gì tới độ tin của số)_

---
### Changelog
| Ngày | Thay đổi | Lý do | Duyệt |
|---|---|---|---|
| yyyy-MM-dd | tạo mới | — | — |
