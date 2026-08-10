# 05 — Report UI/UX & Accessibility 🟠 P1

> Bổ sung cho `principles/ui-ux.md` (chung) — phần **đặc thù màn hình report**: bảng, filter,
> trạng thái, biểu đồ. Số đúng nhưng trình bày sai vẫn khiến người đọc hiểu sai.

---

## 1. Bốn trạng thái bắt buộc của mọi màn report

**MUST:** mỗi report xử lý đủ **4 trạng thái**, không được chỉ có "happy path":

| Trạng thái | Yêu cầu |
|---|---|
| **Loading** | skeleton/spinner có `data-testid`; không nhảy layout (giữ chỗ) |
| **Empty** | 0 dòng → thông báo rõ "Không có dữ liệu trong khoảng đã chọn", **không** bảng trống câm |
| **Error** | thông báo thân thiện + nút thử lại; **không** hiện stack trace/SQL |
| **Success** | dữ liệu đã format ([06](./06-formatting-localization.md)) |

## 2. Bảng dữ liệu

**MUST:**
- Header cột rõ nghĩa (kèm đơn vị: `Doanh thu (₫)`, `Tỷ lệ (%)`).
- **Số căn phải**, chữ căn trái, ngày căn phải/giữa nhất quán — để mắt so hàng dọc.
- Cột tiền/số dùng **font tabular** (chữ số đều bề ngang) để thẳng cột.
- Hàng **tổng** (nếu có) nổi bật (in đậm / nền nhạt) và **đặt cố định** khi cuộn nếu bảng dài.
- Sắp xếp: click header đổi `sort`; hiển thị mũi tên hướng sort hiện tại.
- Bảng rộng → cho cuộn ngang trong khung, giữ cột định danh (tên/ngày) **sticky** bên trái.

**SHOULD:** cho phép đổi khoảng ngày nhanh (Hôm nay / 7 ngày / Tháng này / Tuỳ chọn).

## 3. Filter & khoảng ngày

**MUST:**
- Khoảng ngày mặc định hợp lý (vd 30 ngày gần nhất), hiển thị rõ khoảng đang xem.
- Filter phản ánh đúng param gửi BE ([04](./04-report-api.md) §3); đổi filter → có loading, không "đơ".
- Hiển thị **timezone đang áp dụng** cạnh bộ chọn ngày (vd "Giờ VN, UTC+7") để không ai hiểu nhầm biên ngày.
- Nút "Xoá lọc" đưa về mặc định.

## 4. Con số & nhấn mạnh

**MUST:**
- KPI/thẻ tổng: số lớn, nhãn rõ, kèm đơn vị. Có thể kèm so sánh kỳ trước (▲▼ + %), nhưng **màu không phải kênh thông tin duy nhất** (xem §7).
- **Không** tự bịa "0" khi dữ liệu là `null` → hiển thị `—` ([06](./06-formatting-localization.md) §5).
- Số âm (vd hoàn tiền) hiển thị rõ dấu và/hoặc màu + ký hiệu, không chỉ dựa vào màu đỏ.

## 5. Biểu đồ (khi dùng)

**MUST/SHOULD:**
- Chọn dạng đúng mục đích: xu hướng → line; so sánh nhóm → bar; tỷ trọng → dùng bar xếp/stacked thay vì pie khi >5 lát.
- Trục có nhãn + đơn vị; không cắt trục Y gây phóng đại sai lệch (bar chart nên bắt đầu từ 0).
- Có tooltip hiện giá trị đã format; có legend; có trạng thái empty riêng.
- Bảng số liệu **đi kèm** hoặc tải được — biểu đồ không thay thế số chính xác.
- Tham chiếu skill nội bộ `dataviz` cho palette/độ tương phản khi làm chart.

## 6. Testability (bắt buộc — theo `principles/coding.md` §UI Testability)

**MUST:** mọi phần tử tương tác & vùng bố cục mang `data-testid` ổn định để Playwright bắt được, không dựa vào text/CSS class. Gợi ý đặt tên: `report-<slug>-table`, `report-<slug>-filter-from`, `report-<slug>-kpi-<metric>`, `report-<slug>-empty`.

## 7. Accessibility (a11y)

**MUST:**
- Bảng dùng `<table>` ngữ nghĩa với `<th scope>`; không "bảng" bằng div rời rạc.
- Tương phản màu ≥ WCAG AA; **không** truyền thông tin **chỉ** bằng màu (tăng/giảm phải có mũi tên/ký hiệu kèm).
- Điều hướng & thao tác được bằng **bàn phím** (focus thấy rõ, tab hợp lý).
- Ảnh/biểu đồ có mô tả thay thế (aria-label/summary) tóm tắt xu hướng chính.
- Nội dung động (đổi filter xong) thông báo cho screen reader (aria-live vùng kết quả).

## 8. Hiệu năng cảm nhận

- Bảng dài → phân trang (không render nghìn dòng một lúc); cân nhắc virtualize nếu buộc hiển thị nhiều.
- Hiển thị `durationMs`/thời điểm dữ liệu khi hữu ích để người dùng biết độ mới.

---

## Checklist Report UI/UX

- [ ] Đủ 4 trạng thái loading / empty / error / success, không lộ stack trace.
- [ ] Bảng: số căn phải + tabular, header có đơn vị, hàng tổng nổi bật, sort rõ.
- [ ] Filter ngày có mặc định hợp lý + **hiện timezone**; đổi filter có loading.
- [ ] `null` → `—`; số âm rõ ràng; không dựa **chỉ** vào màu.
- [ ] Biểu đồ đúng dạng, trục từ 0, có tooltip/legend/empty, kèm số liệu.
- [ ] Mọi phần tử tương tác có `data-testid`.
- [ ] Bảng ngữ nghĩa, tương phản AA, dùng được bàn phím, có aria cho vùng kết quả.

> **Why:** người đọc report ra **quyết định kinh doanh** dựa trên nó. Trình bày rõ ràng, nhất quán,
> không gây hiểu nhầm cũng quan trọng ngang việc số đúng.
