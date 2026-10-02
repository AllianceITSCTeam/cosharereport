# Yêu cầu — Báo cáo CTV & Số người đã giới thiệu

> **Trạng thái:** bản nháp yêu cầu (chưa đối soát DB). Các chỗ suy đoán / cần chốt với
> CoShare được đánh dấu ❓. Sau khi chốt, cập nhật thêm `01-...-DataModel.md` +
> `02-...-Queries.sql` (đối soát) theo mẫu của `commission-report/`.

---

## 0. Mục đích

Báo cáo cho phép Admin/CoShare xem **danh sách CTV (cộng tác viên / Affiliate)** cùng
**số người mỗi CTV đã giới thiệu vào hệ thống**, dựa trên cây giới thiệu đa cấp hiện có
(`AffiliatePartner` + `AffiliatePartnerClosure` — xem
[docs/coshare-backend/.../02-NghiepVu-HoaHong.md](../../coshare-backend/BusinessReports/DonHang-HoaHong/02-NghiepVu-HoaHong.md)).

Đây là báo cáo **độc lập với Báo cáo Hoa hồng** (`commission-report/`) — tập trung vào
**số lượng người được giới thiệu**, không phải tiền hoa hồng. Có thể tái dùng cùng khái
niệm Công ty (`Cty`) đã chốt ở Commission Report để lọc/gom nhóm.

---

## 1. Định nghĩa đã chốt với người dùng (2026-09-09)

1. **Số người đã giới thiệu** hiển thị **2 cột riêng**:
   - **Trực tiếp** — số người CTV đó giới thiệu ngay bên dưới (Level = 2 trong
     `AffiliatePartnerClosure`, `AncestorUserId` = CTV đó).
   - **Tổng cả hệ thống** — tổng số hậu duệ ở **mọi cấp** (Level = 2..N) mà CTV đó là
     tổ tiên (`AncestorUserId` = CTV đó, không giới hạn cứng ở Level Cap hiện tại = 3 —
     đếm theo dữ liệu thực có trong bảng).
2. **Bộ lọc "Thời gian"** áp dụng theo **ngày người được giới thiệu tham gia**
   (`JoinDate` của **Descendant**, tức người bị giới thiệu) — trả lời câu hỏi
   "trong khoảng ngày X, CTV này giới thiệu được bao nhiêu người mới". Không lọc theo
   ngày CTV tham gia.

---

## 2. Bộ lọc

1. **Thời gian** (khoảng ngày) — theo `JoinDate` của người được giới thiệu (Descendant),
   như mục 1.2 ở trên.
2. **Cty** — lọc theo công ty của CTV, cùng cơ chế đã chốt ở Commission Report
   (`UserLoginId → UserLogin_Company_Mapping.CompanyId`). Không bắt buộc chọn (khác với
   Commission Screen 2) — mặc định hiển thị tất cả công ty.
3. **Tên / Mã CTV** — ô tìm nhanh theo `DisplayName` hoặc `ReferralCode`.

---

## 3. Cột hiển thị — Bảng CTV (mỗi CTV 1 dòng)

| Cột | Ý nghĩa | Nguồn |
|-----|---------|-------|
| **Tên CTV** | Tên hiển thị | `UserLogin.DisplayName` (qua `AffiliatePartner.UserLoginId`) |
| **Mã giới thiệu** | Mã CTV dùng để giới thiệu người khác | `AffiliatePartner.ReferralCode` |
| **Cty** | Công ty của CTV | `UserLogin_Company_Mapping.CompanyId → Company.Name` |
| **Ngày tham gia** | Ngày CTV gia nhập chương trình | `AffiliatePartner.JoinDate` |
| **Trực tiếp** | Số người giới thiệu trực tiếp (Level 2) | đếm `AffiliatePartnerClosure` |
| **Tổng cả hệ thống** | Tổng số hậu duệ mọi cấp | đếm `AffiliatePartnerClosure` |

- Dòng **summary** ở đầu bảng: tổng số CTV đang hiển thị, tổng "Trực tiếp", tổng
  "Tổng cả hệ thống" ❓ (tuỳ UX, tham khảo mẫu Screen 3 Commission Report).

## 4. Chi tiết drill-down (expander) — danh sách người đã giới thiệu

Nhấn vào 1 dòng CTV (hoặc mũi tên expander) để xem **danh sách người mà CTV đó đã giới
thiệu** (mặc định: trực tiếp; có thể có toggle "xem cả tuyến dưới" để hiện toàn bộ cây ❓):

| Cột | Ý nghĩa | Nguồn |
|-----|---------|-------|
| **Tên** | Tên người được giới thiệu | `UserLogin.DisplayName` (Descendant) |
| **Ngày tham gia** | Ngày người này gia nhập | `AffiliatePartnerClosure.JoinDate` hoặc `AffiliatePartner.JoinDate` của Descendant ❓ (2 nguồn có thể lệch — cần đối soát) |
| **Cấp (Level)** | 2 = trực tiếp, 3+ = gián tiếp | `AffiliatePartnerClosure.Level` |
| **Cty** | Công ty của người được giới thiệu ❓ (có cần hiển thị không, hay chỉ Cty của CTV gốc là đủ) |

---

## 5. Trạng thái các câu hỏi cần CoShare xác nhận (❓)

1. ❓ **"CTV"** trong danh sách = **tất cả** bản ghi `AffiliatePartner` (kể cả người chưa
   giới thiệu được ai — "Trực tiếp" = 0), hay chỉ những người **đã có ít nhất 1 người
   giới thiệu**? Mặc định giả định: hiển thị tất cả, để CoShare tự lọc bằng cột số liệu.
2. ❓ **Loại trừ soft-delete / disable:** loại `IsDeleted = true` ở `AffiliatePartner`,
   `AffiliatePartnerClosure`, `UserLogin` — có cần loại thêm `AffiliatePartner.IsDisable`
   hoặc `UserLogin.IsDeleted` của người được giới thiệu không?
3. ❓ **"Tổng cả hệ thống"** có nên giới hạn theo `SYSTEM_AFFILIATE_PARTNER_SETTING`
   (Level Cap, mặc định 3, theo
   [02-NghiepVu-HoaHong.md §1](../../coshare-backend/BusinessReports/DonHang-HoaHong/02-NghiepVu-HoaHong.md))
   hay đếm theo **dữ liệu thực tế** trong `AffiliatePartnerClosure` (có thể vượt quá cap
   nếu cấu hình từng thay đổi theo thời gian)? Giả định hiện tại: đếm theo dữ liệu thực.
4. ❓ **Bảng `Log_AffiliateReferralActivity`** (có `ActionType`, `MappingResult`,
   `ErrorMessage`) ghi log các lần thử map giới thiệu — có cần dùng để hiển thị số lần
   giới thiệu **thất bại** (VD: mã giới thiệu sai) không, hay chỉ dùng
   `AffiliatePartnerClosure` (nguồn "đã map thành công") làm số liệu chính thức?
5. ❓ **"Cty" của CTV khi 1 UserLogin thuộc nhiều Company** (nếu có) — lấy Cty nào? Theo
   cơ chế đã chốt ở Commission Report hay cần quy tắc riêng?
6. ❓ **Quyền xem:** Admin/CoShare xem toàn bộ, hay từng CTV/Cty chỉ xem được số liệu
   của chính mình/công ty mình (cần `@Roles`/RolesGuard)?
7. ❓ **Timezone** cho `JoinDate` — áp dụng cùng quy ước UTC+7 (Asia/Ho_Chi_Minh) như
   Commission Report (`docs/db/conventions.md §1`)? Giả định: có.

---

## 6. Tài liệu tham khảo

- Nghiệp vụ CTV / cây giới thiệu đa cấp:
  [`02-NghiepVu-HoaHong.md`](../../coshare-backend/BusinessReports/DonHang-HoaHong/02-NghiepVu-HoaHong.md)
- Các bảng & quan hệ (`AffiliatePartner`, `AffiliatePartnerClosure`, ...):
  [`03-CacBang-VaQuanHe.md`](../../coshare-backend/BusinessReports/DonHang-HoaHong/03-CacBang-VaQuanHe.md)
- Mẫu yêu cầu tham khảo (cùng khái niệm Cty, cùng dạng tổng quan/drill-down):
  [`commission-report/00-Commission-Report-Requirement.md`](../commission-report/00-Commission-Report-Requirement.md)
- Sau khi chốt với CoShare: viết spec report theo mẫu
  [`docs/reports/_TEMPLATE.md`](../../reports/_TEMPLATE.md), lưu SQL đối soát vào
  `sql-scripts/` theo quy ước trong `CLAUDE.md`.
