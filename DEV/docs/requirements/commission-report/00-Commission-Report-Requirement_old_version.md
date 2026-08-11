# Yêu cầu — Báo cáo Hoa hồng (Commission Report)

> **Nguồn gốc:** chuyển thể từ 2 ảnh chụp bản vẽ tay của nghiệp vụ:
> - `Commission - Tab1 - Tab2.jpg`
> - `Commission - Tab3.jpg`
>
> File này là **bản text chính thức** của yêu cầu. Nếu ảnh và text lệch nhau → tin ảnh, sửa text.
> Các chỗ suy đoán / cần chốt với CoShare được đánh dấu ❓.

---

## 0. Tổng thể

Báo cáo **Hoa hồng** cho phép Admin/CoShare theo dõi hoa hồng affiliate phát sinh theo
đơn hàng (MerchantBill). Màn hình gồm **3 tab**:

| Tab | Tên | Mục đích | Dạng dữ liệu |
|-----|-----|----------|--------------|
| **Tab 1** | Tổng quan | Nhìn nhanh theo Công ty, có drill-down theo người + biểu đồ | Số liệu tổng hợp (aggregate) |
| **Tab 2** | Chi tiết hoa hồng | Dữ liệu chi tiết **để export** làm báo cáo | Danh sách (1 đơn = 1 dòng) |
| **Tab 3** | Chi tiết hoa hồng (bản đầy đủ) | Như Tab 2 nhưng thêm chi tiết mặt hàng đã mua + tìm nhanh | Danh sách (1 đơn = 1 dòng) |

> **Ghi chú:** Tab 2 và Tab 3 gần như trùng nhau. Tab 3 là bản hoàn chỉnh hơn (thêm cột
> "Chi tiết đơn hàng" và bộ lọc tìm nhanh). Khi làm nên **dùng chung 1 query chi tiết**,
> Tab 3 bật thêm cột line-item. Xem `03-Commission-Report-ImplementationGuide.md`.

---

## 1. Tab 1 — Tổng quan

### 1.1. Bộ lọc
1. **Cty** (Công ty) ❓ — xem `01-...DataModel.md §Cty` để chốt Cty = `Merchant` hay `Company`.
2. **Thời gian** (khoảng ngày, theo ngày đặt hàng).

### 1.2. Chế độ hiển thị mặc định (KHÔNG áp dụng lọc Cty)
Bảng tổng hợp **gom theo Công ty**, mỗi Cty 1 dòng:

| Cột | Ý nghĩa |
|-----|---------|
| **Cty** | Tên công ty |
| **Doanh thu** | Tổng doanh thu các đơn của Cty trong khoảng |
| **Tổng đơn** | Tổng số đơn |
| **Thành công** | Số đơn ở trạng thái hoàn tất/thành công ❓ (giá trị `StatusBill` = ?) |
| **Huỷ** | Số đơn ở trạng thái huỷ ❓ (giá trị `StatusBill` = ?) |
| **Hoa hồng** | Tổng tiền hoa hồng phát sinh |

_Ví dụ trong bản vẽ:_ dòng `1. Freetrend`.

### 1.3. Khi ĐÃ chọn 1 Cty (Freetrend) + khoảng thời gian
Bảng **drill-down theo người** (người hưởng hoa hồng trong công ty đó), mỗi người 1 dòng:

| Cột | Ý nghĩa |
|-----|---------|
| **Tên** | Tên người (người hưởng hoa hồng) |
| **Tổng doanh thu** | Doanh thu quy cho người đó ❓ (đóng góp/được ghi nhận thế nào — cần chốt) |
| **Tổng đơn** | Số đơn liên quan tới người đó |
| **Thành công** | Số đơn thành công |
| **Huỷ** | Số đơn huỷ |
| **Hoa hồng** | Tổng hoa hồng người đó nhận |

_Ví dụ trong bản vẽ:_ `c.Vinh`, `c.Sen`, `c.Thu`.

### 1.4. Biểu đồ
- **Biểu đồ tròn (pie chart)** thể hiện **mức hoa hồng giữa các cấp** (phân bổ tổng hoa hồng
  theo **cấp hệ hoa hồng** — `AffiliateLevel`).

---

## 2. Tab 2 — Chi tiết hoa hồng (để export)

> "data chi tiết dùng export để làm báo cáo" — **mỗi đơn hàng là 1 dòng**, có **1 dòng summary
> ở đầu** để tiện theo dõi.

### 2.1. Bộ lọc
1. **Cty**
2. **Thời gian**
3. **Cấp hệ hoa hồng** (`AffiliateLevel` / `ConfigAffiliateLevel`)
4. **Tên**
5. **MSNV** (Mã số nhân viên) ❓ — MSNV của người hưởng hoa hồng hay người bán? cần chốt.
6. **Loại sp** → **vật lý** / **phi vật lý** ❓ — xem `01-...DataModel.md §Loại sp`.
7. **Trạng thái đơn** (`StatusBill`)

### 2.2. Cột hiển thị
| # | Cột | Ý nghĩa |
|---|-----|---------|
| 1 | **Mã đơn** | Mã/số đơn hàng |
| 2 | **Ngày đặt hàng** | Ngày tạo đơn |
| 3 | **KH đặt** (Khách đặt) | Khách hàng đặt đơn |
| 4 | **MSNV** | Mã số nhân viên ❓ |
| 5 | **Người giới thiệu** | Người giới thiệu (referrer) |
| 6 | **Người hưởng hoa hồng** | Người nhận hoa hồng của dòng này |
| 7 | **Tổng tiền đơn** | Tổng tiền của đơn |
| 8 | **Tổng hoa hồng** | Tổng hoa hồng của đơn |
| 9 | **Trạng thái** | Trạng thái đơn ❓ (hay trạng thái thanh toán hoa hồng? cần chốt) |

- Dòng **summary** ở đầu: tổng của các cột số (Tổng tiền đơn, Tổng hoa hồng, số đơn...).

---

## 3. Tab 3 — Chi tiết hoa hồng (bản đầy đủ)

### 3.1. Bộ lọc
1. **Cty**
2. **Thời gian**
3. **Người hưởng hoa hồng**
4. **Tên** — *tìm chung, khi muốn tìm nhanh*
5. **MSNV**
6. **Loại sp** → **vật lý** / **phi vật lý**
7. **Trạng thái đơn**
8. **Mã đơn** — *(= trường "tên"; ô tìm nhanh gộp mã đơn)*

### 3.2. Cột hiển thị
| # | Cột | Ý nghĩa |
|---|-----|---------|
| 1 | **Mã đơn** | Mã/số đơn hàng |
| 2 | **Ngày đặt hàng** | Ngày tạo đơn |
| 3 | **Người mua hàng** | Khách mua |
| 4 | **MSNV** | Mã số nhân viên |
| 5 | **Người giới thiệu** | Referrer |
| 6 | **Người hưởng h.h** | Người hưởng hoa hồng |
| 7 | **Chi tiết đơn hàng** | Đơn đó **đã mua những gì** (danh sách mặt hàng/line-item) |
| 8 | **Tổng tiền đơn** | Tổng tiền đơn |
| 9 | **Tổng tiền hoa hồng** | Tổng hoa hồng |
| 10 | **Trạng thái** | Trạng thái đơn ❓ |

---

## 4. Trạng thái các câu hỏi (đã kiểm chứng DB — xem `04-DB-Verification-Findings.md`)

> ✅ = đã chốt bằng query DB thật ngày 2026-08-10 · ❓ = còn cần CoShare xác nhận.

1. ✅ **"Cty" = `Company`** (Freetrend = Company Id 14). Bill nối Company qua **người bán**:
   `SellUserId → UserLogin_Company_Mapping.CompanyId`. (KHÔNG phải Merchant.)
2. ✅ **StatusBill:** `2=Finished`=**Thành công**, `3=Cancel`=**Huỷ**, `1=Approve`, `0=New`.
   ⚠️ Dữ liệu hiện 100% = 1 (chưa có Finished/Cancel) → báo CoShare.
3. ❓ **Cột "Trạng thái"** Tab2/3 = đơn (`StatusBill`) hay TT thanh toán hoa hồng
   (`ConfigCommPaymentStatus`)? Đoán: đơn cho lưới, TT hoa hồng là cột phụ.
4. ✅ **MSNV = mã nhân viên của KHÁCH MUA** = `Staff.StaffCode` (qua `RenterGUID→UserLogin→Staff`).
5. ❓ **"Loại sp" vật lý/phi vật lý:** CHƯA có cột chuẩn (`MaterialCommGroupId` NULL 100%).
   Filter để **disabled** tới khi CoShare chốt cách phân loại.
6. ✅ **Người giới thiệu = `SellUserId`** (người bán, luôn có trên dòng hoa hồng).
   Cây giới thiệu đầy đủ ở `AffiliatePartnerClosure` nếu cần "giới thiệu trực tiếp của khách" ❓.
   ⚠️ `AffiliatePartner.ReferredByUserId` rỗng toàn bộ — KHÔNG dùng.
7. ✅ **Doanh thu = `SUM(TotalMoney)` trên đơn DUY NHẤT** (coi chừng bẫy fan-out multi-seller).
   Drill-down Tab1 theo **người bán (SellUser)** ❓ cách quy hoa hồng (tạo ra vs nhận).
8. ❓ **Timezone** biên ngày (xem `docs/db/conventions.md §1`).
9. ❓ **Soft-delete:** đang loại `IsDeleted = true` ở mọi bảng (xác nhận đúng).

---

## 5. Tài liệu liên quan
- Cấu trúc DB + ánh xạ cột → bảng.cột: [`01-Commission-Report-DataModel.md`](./01-Commission-Report-DataModel.md)
- SQL nháp (readonly) cho từng tab: [`02-Commission-Report-Queries.sql`](./02-Commission-Report-Queries.sql)
- Hướng dẫn triển khai cho AI/dev: [`03-Commission-Report-ImplementationGuide.md`](./03-Commission-Report-ImplementationGuide.md)
