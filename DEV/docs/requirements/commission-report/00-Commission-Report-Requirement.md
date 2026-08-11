# Yêu cầu — Báo cáo Hoa hồng (Commission Report)

> **Nguồn gốc:** chuyển thể từ 2 ảnh chụp bản vẽ tay của nghiệp vụ:
> - `Commission - Tab1 - Tab2.jpg`
> - `Commission - Tab3.jpg`
>
> File này là **bản text chính thức** của yêu cầu. Nếu ảnh và text lệch nhau → tin ảnh, sửa text.
> Các chỗ suy đoán / cần chốt với CoShare được đánh dấu ❓.
>
> **Lịch sử:** bản cũ (mô hình 3 tab) lưu ở
> [`00-Commission-Report-Requirement_old_version.md`](./00-Commission-Report-Requirement_old_version.md).
> Bản này tổ chức lại thành **3 màn hình (screen)** riêng biệt.

---

## 0. Tổng thể

Báo cáo **Hoa hồng** cho phép Admin/CoShare theo dõi hoa hồng affiliate phát sinh theo
đơn hàng (MerchantBill). Chia thành **3 màn hình (screen)** riêng biệt:

| Screen | Tên | Mục đích | Dạng dữ liệu |
|--------|-----|----------|--------------|
| **Screen 1** | Hoa hồng tổng quan | Bảng tổng hợp gom theo Công ty, mỗi công ty 1 dòng | Số liệu tổng hợp (aggregate) |
| **Screen 2** | Hoa hồng theo công ty | Chọn 1 công ty → drill-down hoa hồng theo người + biểu đồ | Số liệu tổng hợp (aggregate) |
| **Screen 3** | Báo cáo đơn hàng | Danh sách đơn hàng chi tiết, có expander xem chi tiết mặt hàng | Danh sách (1 đơn = 1 dòng) |

---

## 1. Screen 1 — Hoa hồng tổng quan

> Bảng **tổng hợp gom theo Công ty**, mỗi công ty 1 dòng. **Không** có bộ lọc công ty —
> luôn hiển thị tất cả công ty trong khoảng thời gian.

### 1.1. Bộ lọc
1. **Thời gian** (khoảng ngày, theo ngày đặt hàng).

### 1.2. Cột hiển thị
Bảng tổng hợp **gom theo Công ty**, mỗi Cty 1 dòng:

| Cột | Ý nghĩa |
|-----|---------|
| **Cty** | Tên công ty |
| **Doanh thu** | Tổng doanh thu các đơn của Cty trong khoảng |
| **Tổng đơn** | Tổng số đơn |
| **Thành công** | Số đơn ở trạng thái hoàn tất/thành công (`StatusBill = 2`) |
| **Huỷ** | Số đơn ở trạng thái huỷ (`StatusBill = 3`) |
| **Hoa hồng** | Tổng tiền hoa hồng phát sinh |

_Ví dụ trong bản vẽ:_ dòng `1. Freetrend`.

> **Điều hướng:** click 1 dòng công ty có thể mở nhanh **Screen 2** với công ty đó đã chọn sẵn ❓ (tuỳ chọn UX).

---

## 2. Screen 2 — Hoa hồng theo công ty

> Bảng **drill-down theo người** trong 1 công ty. **Bắt buộc chọn 1 công ty** thì mới có data —
> khi mới vào màn hình (chưa chọn công ty) **không hiển thị dữ liệu**.

### 2.1. Bộ lọc
1. **Cty** (Công ty) — **bắt buộc**. Chưa chọn → bảng trống, hiện gợi ý "Chọn 1 công ty để xem dữ liệu".
2. **Thời gian** (khoảng ngày, theo ngày đặt hàng).

### 2.2. Cột hiển thị (khi đã chọn công ty)
Bảng **drill-down theo người** (người hưởng hoa hồng trong công ty đó), mỗi người 1 dòng:

| Cột | Ý nghĩa |
|-----|---------|
| **Tên** | Tên thành viên thuộc công ty (người bán) |
| **Tổng doanh thu** | Tổng tiền các đơn hàng của thành viên đó (mỗi đơn tính 1 lần) |
| **Tổng đơn** | Tổng số đơn hàng phát sinh của thành viên đó |
| **Thành công** | Số đơn thành công |
| **Huỷ** | Số đơn huỷ |
| **Hoa hồng** | Tổng hoa hồng người đó nhận |

_Ví dụ trong bản vẽ:_ `c.Vinh`, `c.Sen`, `c.Thu`.

### 2.3. Biểu đồ
- **Biểu đồ tròn (pie chart)** thể hiện **mức hoa hồng giữa các cấp** (phân bổ tổng hoa hồng
  theo **cấp hệ hoa hồng** — `AffiliateLevel`).

---

## 3. Screen 3 — Báo cáo đơn hàng

> Danh sách đơn hàng chi tiết, **mỗi đơn hàng là 1 dòng**, có **1 dòng summary ở đầu**.
> Chi tiết mặt hàng của từng đơn đặt trong **expander (mũi tên)**: nhấn mũi tên ở đầu dòng
> thì bung ra danh sách mặt hàng (line-item) của đơn đó.

### 3.1. Bộ lọc
1. **Cty**
2. **Thời gian**
3. **Cấp hệ hoa hồng** (`AffiliateLevel` / `ConfigAffiliateLevel`)
4. **Người hưởng hoa hồng**
5. **Tên** — *tìm chung, khi muốn tìm nhanh*
6. **MSNV** (Mã số nhân viên)
7. **Loại sp** → **vật lý** / **phi vật lý** — phân loại theo mã sản phẩm chứa `"ZALOOA"` (xem §4.5).
8. **Trạng thái đơn** (`StatusBill`)
9. **Mã đơn** — *(ô tìm nhanh gộp mã đơn)*

### 3.2. Cột hiển thị
| # | Cột | Ý nghĩa |
|---|-----|---------|
| — | **▸ (expander)** | Mũi tên bung/thu chi tiết đơn hàng (line-item) |
| 1 | **Mã đơn** | Mã/số đơn hàng = `MerchantBill.OrderNumber` |
| 2 | **Ngày đặt hàng** | Ngày tạo đơn |
| 3 | **Người mua hàng** | Khách mua |
| 4 | **MSNV** | Mã số nhân viên |
| 5 | **Người giới thiệu** | Referrer |
| 6 | **Người hưởng h.h** | Người hưởng hoa hồng |
| 7 | **Tổng tiền đơn** | Tổng tiền đơn |
| 8 | **Tổng tiền hoa hồng** | Tổng hoa hồng |
| 9 | **Trạng thái** | Trạng thái đơn ❓ |

- Dòng **summary** ở đầu: tổng của các cột số (Tổng tiền đơn, Tổng tiền hoa hồng, số đơn...).

### 3.3. Chi tiết đơn hàng (trong expander)
Khi nhấn mũi tên **▸** ở đầu 1 dòng đơn, bung ra **danh sách mặt hàng đã mua** của đơn đó
(line-item). Mỗi mặt hàng gồm ❓ (cần chốt cột chi tiết với CoShare):

| Cột | Ý nghĩa |
|-----|---------|
| **Mặt hàng** | Tên sản phẩm/mặt hàng |
| **SL** | Số lượng |
| **Đơn giá** | Giá 1 đơn vị |
| **Thành tiền** | SL × đơn giá |

---

## 4. Trạng thái các câu hỏi (đã kiểm chứng DB — xem `04-DB-Verification-Findings.md`)

> ✅ = đã chốt (query DB 2026-08-10 hoặc CoShare trả lời 2026-08-11) · ❓ = còn cần CoShare xác nhận.

1. ✅ **"Cty" = `Company`** (Freetrend = Company Id 14). Bill nối Company qua **người bán**:
   `SellUserId → UserLogin_Company_Mapping.CompanyId`. (KHÔNG phải Merchant.)
2. ✅ **StatusBill:** `2=Finished`=**Thành công**, `3=Cancel`=**Huỷ**, `1=Approve`, `0=New`.
   ⚠️ Dữ liệu hiện 100% = 1 (chưa có Finished/Cancel) → báo CoShare.
3. ✅ **Cột "Trạng thái"** = **trạng thái đơn hàng** (`MerchantBill.StatusBill`), đúng bằng giá trị
   ở bộ lọc "Trạng thái đơn". (KHÔNG dùng trạng thái thanh toán hoa hồng cho cột này.)
4. ✅ **MSNV = mã nhân viên của KHÁCH MUA** = `Staff.StaffCode` (qua `RenterGUID→UserLogin→Staff`).
5. ✅ **"Loại sp" vật lý/phi vật lý** — phân loại theo **mã sản phẩm** (`MerchantProduct.Code`):
   - **Phi vật lý:** sản phẩm Zalo OA — mã sản phẩm **chứa chuỗi `"ZALOOA"`** (không phân biệt hoa/thường).
   - **Vật lý:** tất cả sản phẩm còn lại (loại trừ phi vật lý).
   ✅ **Cơ chế hiện tại: 1 đơn hàng chỉ chứa TOÀN sản phẩm vật lý, HOẶC đúng 1 sản phẩm phi vật lý**
   → không có đơn trộn ⇒ lọc/thống kê **theo đơn** không bị nhập nhằng. Lọc bằng `EXISTS`
   trên `MerchantBillDetail`. (Bỏ hướng cũ dùng `MaterialCommGroupId` — cột này NULL 100%.)
6. ✅ **Người giới thiệu = `SellUserId`** (người bán, luôn có trên dòng hoa hồng).
   Cây giới thiệu đầy đủ ở `AffiliatePartnerClosure` nếu cần "giới thiệu trực tiếp của khách" ❓.
   ⚠️ `AffiliatePartner.ReferredByUserId` rỗng toàn bộ — KHÔNG dùng.
7. ✅ **Doanh thu = `SUM(TotalMoney)` trên đơn DUY NHẤT** (coi chừng bẫy fan-out multi-seller).
   Drill-down Screen 2 theo **người bán (SellUser)** ❓ cách quy hoa hồng (tạo ra vs nhận).
8. ✅ **Timezone:** DB lưu `timestamptz` ở **UTC+00**. Report hiển thị & lọc theo **UTC+7**
   (Asia/Ho_Chi_Minh). ⇒ biên ngày người dùng chọn (UTC+7) phải quy về UTC trước khi query;
   giá trị ngày/giờ trả ra đổi sang UTC+7 khi hiển thị. Xem `docs/db/conventions.md §1`.
9. ✅ **Soft-delete:** loại `IsDeleted = true` ở mọi bảng — **đúng**.
10. ✅ **Chi tiết đơn hàng (line-item)** trong expander Screen 3: theo **§3.3** —
    `MerchantBillDetail` (Mặt hàng=`ProductName`, SL=`Quantity`, Đơn giá=`ProductPrice`, Thành tiền=`TotalMoney`).

---

## 5. Tài liệu liên quan
- Cấu trúc DB + ánh xạ cột → bảng.cột: [`01-Commission-Report-DataModel.md`](./01-Commission-Report-DataModel.md)
- SQL nháp (readonly) cho từng màn hình: [`02-Commission-Report-Queries.sql`](./02-Commission-Report-Queries.sql)
- Hướng dẫn triển khai cho AI/dev: [`03-Commission-Report-ImplementationGuide.md`](./03-Commission-Report-ImplementationGuide.md)
- Bản yêu cầu cũ (mô hình 3 tab): [`00-Commission-Report-Requirement_old_version.md`](./00-Commission-Report-Requirement_old_version.md)
