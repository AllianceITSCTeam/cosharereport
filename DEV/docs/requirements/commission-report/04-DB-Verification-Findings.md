# Kết quả kiểm chứng trên DB thật — Báo cáo Hoa hồng

> **Đã query trực tiếp** DB CoShare (readonly `readonly_khanh`@160.22.122.239) ngày 2026-08-10
> để chốt các giả định ❓ trong `00`/`01`. File này là **nguồn sự thật đã xác minh** — ưu tiên hơn
> phần suy đoán ở các file khác. Con số dưới đây là **golden numbers** để đối soát report.

---

## A. Các câu hỏi đã CHỐT (có bằng chứng)

### 1. ✅ StatusBill — enum từ code + dữ liệu
Từ code `MerchantBillModel.cs::eMerchantBillStatus`:
| Giá trị | Nghĩa | Report |
|---|---|---|
| 0 | New — phiếu nháp (chưa trừ kho) | (bỏ / nháp) |
| 1 | Approve — đã xác nhận đặt hàng | đang xử lý |
| 2 | **Finished** — hoàn thành, đã giao | **Thành công** |
| 3 | **Cancel** — huỷ | **Huỷ** |

> ⚠️ **Thực tế dữ liệu hiện tại: 100% đơn đang ở `StatusBill = 1` (1218/1218).** Chưa có đơn nào
> Finished/Cancel. ⇒ cột "Thành công/Huỷ" ở Screen 1 hiện sẽ = 0. Vẫn code theo enum 2/3 nhưng **báo
> CoShare biết** dữ liệu chưa có trạng thái này (có thể quy trình chưa đóng đơn, hoặc dùng cột khác).

### 2. ✅ "Cty" = bảng `Company` (KHÔNG phải `Merchant`)
- `Freetrend` nằm trong **`Company`**: `Id=14`, `Code='Freetrend'`,
  `Name='CÔNG TY TNHH FREETREND INDUSTRIAL (VIỆT NAM)'`. (`Merchant` chỉ có "O Metro", "Co Share"...
  — tìm '%free%' = 0 kết quả.)
- **Đơn nối tới Company qua NGƯỜI BÁN:**
  `MerchantBillCommission.SellUserId` → `UserLogin_Company_Mapping.UserLoginId` → `.CompanyId` → `Company`.
- **Độ phủ 100%**: 2611/2611 dòng hoa hồng có seller map được ra company. ✔

### 3. ✅ MSNV = mã nhân viên của **KHÁCH MUA** (đúng như bạn nói)
- Khách mua = `MerchantBill.RenterGUID` → `UserLogin` (khớp qua `ID_GUID`).
- MSNV = `Staff.StaffCode` của khách mua đó. Ví dụ thật: khách "Nhanh" → StaffCode `08111065`,
  "Ngan" → `11080528` (mã nhân viên Freetrend, dạng số).
- **Độ phủ**: 726/1218 đơn có khách gắn StaffCode; 768/1218 có mã affiliate (`ReferralCode`).
  ⇒ dùng `Staff.StaffCode` cho MSNV; nếu null có thể fallback `AffiliatePartner.ReferralCode` ❓.

### 4. ✅ Người mua / Người giới thiệu / Người hưởng hoa hồng
Trên **1 đơn**, hoa hồng chia cho **cả cây tuyến trên (upline) của người mua**, mỗi người 1 dòng:
| Vai trò | Nguồn |
|---|---|
| **Người mua hàng** | `MerchantBill.RenterGUID` → `UserLogin.DisplayName` |
| **Người bán / giới thiệu** | `MerchantBillCommission.SellUserId` → `UserLogin.DisplayName` (người bán, thường trùng tuyến trên trực tiếp) |
| **Người hưởng hoa hồng** | `MerchantBillCommission.AffiliateUserId` → `UserLogin.DisplayName` |

- Cây giới thiệu đầy đủ ở `AffiliatePartnerClosure` (`DescendantUserId`, `AncestorUserId`, `Level` 1/2/3).
  Ví dụ khách 7560 (Thái Thị Hảo): L1=Nguyễn Thị Hoài (giới thiệu trực tiếp), L2=Hoàng Thị Ngân,
  L3=Liêu Quang Vinh.
- ⇒ **"Người giới thiệu"** dùng `SellUserId` (luôn có sẵn trên dòng hoa hồng). Nếu CoShare muốn
  "người giới thiệu trực tiếp của khách mua" thì lấy `AffiliatePartnerClosure.AncestorUserId WHERE Level=1
  AND DescendantUserId = buyer` ❓ — chốt lại.
- ⚠️ `AffiliatePartner.ReferredByUserId` **rỗng toàn bộ** — KHÔNG dùng cột này cho referrer.

### 5. ✅ Drill-down "theo người" (Screen 2) = theo **NGƯỜI BÁN (SellUser)**
Tên `c.Vinh / c.Sen / c.Thu` trong bản vẽ khớp seller thật của Freetrend: **Liêu Quang Vinh,
Phan Thị Sen, Võ Thị Kiều Thu**. ⇒ drill-down 1 Cty = liệt kê người bán trong công ty đó.

### 6. ✅ "Loại sp: vật lý / phi vật lý" — CoShare CHỐT (2026-08-11): theo mã sản phẩm chứa `"ZALOOA"`
> **Quy tắc chốt:** **Phi vật lý** = `MerchantProduct.Code ILIKE '%ZALOOA%'` (sản phẩm Zalo OA);
> **Vật lý** = tất cả sản phẩm còn lại. Lọc ở mức đơn bằng `EXISTS` trên `MerchantBillDetail`
> (xem `02-...Queries.sql` Screen 3). ✅ **Cơ chế nghiệp vụ: 1 đơn hoặc TOÀN vật lý, hoặc đúng 1 sp
> phi vật lý** → không có đơn trộn, 2 nhánh filter loại trừ nhau, thống kê theo đơn sạch.
> ⚠️ Nên verify golden 1 lần khi code (đếm đơn có mã ZALOOA).
>
> _Ghi chú điều tra ban đầu (trước khi có quyết định — giữ để tham khảo):_
- `MerchantProduct.MaterialCommGroupId` **NULL 100%** (2238/2238) ⇒ không dùng được để phân loại.
- Sản phẩm bán chủ yếu là **dịch vụ** "Zalo sức khỏe dành cho công ty Freetrend" (1191/~1250 dòng)
  = **phi vật lý**; còn lại là **hàng hoá** (nước giặt, quạt, tivi, mì, cà phê... nguồn `IZOLA`) = vật lý.
- Bậc hoa hồng lưu trong JSON `MerchantBillDetail.MaterialCommisionTiers` (tham chiếu `MaterialCommGroupId`)
  — có cho cả dịch vụ Zalo (group 66), nên **không phải cờ vật lý/phi vật lý sạch**.
- 👉 **Chưa đủ cơ sở tự động.** Đề nghị chốt với CoShare: phân loại theo `ConfigMaterialCommGroup`,
  theo `MerchantGroupProduct`, hay có 1 cờ riêng (vd trong `MoreExtensionJson`)? Tạm để filter này
  **disabled** cho tới khi chốt.

### 7. ✅ Cột "Trạng thái"
- Lọc **"Trạng thái đơn"** = `MerchantBill.StatusBill` (enum §1).
- Ngoài ra có **trạng thái thanh toán hoa hồng** riêng: `MerchantBillCommission.CommPaymentStatusId`
  → `ConfigCommPaymentStatus`. Phân bố thật: `4=NOTREQUEST (Chưa yêu cầu)` chiếm 2576/2611,
  `6=ORDERNOTCOMPLETED`=34, `5=RECONCILING`=1.
- ✅ **CoShare chốt (2026-08-11):** cột "Trạng thái" trên lưới = **`MerchantBill.StatusBill`**
  (đúng bằng bộ lọc "Trạng thái đơn"). Trạng thái TT hoa hồng KHÔNG dùng cho cột này.

---

## B. Bảng tra giá trị (lookup thật)

### `ConfigAffiliateLevel` (cấp hệ hoa hồng — dùng cho lọc + nhãn biểu đồ)
| Id | Level | Code | Name / NameInCommision |
|---|---|---|---|
| 3 | 1 | Level1 | **Đại sứ** |
| 2 | 2 | Level2 | **Đồng hành** |
| 1 | 3 | Level3 | **Lan tỏa** |

> Lưu ý: `MerchantBillCommission.AffiliateLevel` (int 1/2/3) là **bậc theo độ sâu tuyến**; map sang
> tên qua `AffiliateLevelId` → `ConfigAffiliateLevel`. Kiểm tra lại chiều map Level↔Id khi hiển thị.

### `ConfigCommPaymentStatus` (trạng thái thanh toán hoa hồng)
| Id | Code | Name |
|---|---|---|
| 1 | REJECTED | Đã hủy |
| 2 | PAID | Đã thanh toán |
| 3 | INPROGRESS | Yêu cầu đang xử lý |
| 4 | NOTREQUEST | Chưa yêu cầu |
| 5 | RECONCILING | Đang đối soát |
| 6 | ORDERNOTCOMPLETED | Đơn chưa hoàn tất |

### `Company` (một số dòng — "Cty")
| Id | Code | ShortName |
|---|---|---|
| 14 | Freetrend | Freetrend |
| 1 | CoShare | CoShare |
| 4 | Alliance | Alliance |
| 15 | TRIAL | KHÁCH HÀNG TRẢI NGHIỆM |

---

## ⚠️ CẬP NHẬT 2026-08-11 — golden numbers dưới đây (mục C) đã STALE

Khi code Screen 1 và chạy test đối soát trên DB `CoShareTest`, phát hiện DB có vẻ đã bị
**reset/reseed** so với ngày 2026-08-10 ghi trong file này — không phải chỉ tăng thêm dữ liệu:
`Company Id=14` (Freetrend) giờ có `Code=null, Name=null, ShortName=null`, và tổng số đơn tăng
từ 1.218 lên **142.400**. Toàn bộ mục **C** (golden numbers) và mục **B** (`Company` Id=14=Freetrend)
dưới đây chỉ còn giá trị **tham khảo cách tính** (công thức, cách tránh fan-out ở mục C) — **không
dùng để đối soát số** trên DB hiện tại. Golden numbers mới: `../../db/conventions.md` §5.1.

## C. GOLDEN NUMBERS (để đối soát report — toàn bộ dữ liệu, không lọc ngày) — ⚠️ STALE, xem trên

| Metric | Giá trị | Ghi chú |
|---|---|---|
| Tổng số đơn (bill, IsDeleted=false) | **1.218** | |
| Tổng doanh thu (SUM TotalMoney, DISTINCT bill) | **160.191.779** | tính trên đơn **duy nhất** |
| Tổng dòng hoa hồng | **2.611** | avg 2,31 dòng/đơn, max 3 |
| Tổng tiền hoa hồng | **13.621.482** | |
| Hoa hồng theo cấp — L1 (Đại sứ) | **2.682.494** (1004 dòng) | dùng cho pie Screen 2 |
| Hoa hồng theo cấp — L2 (Đồng hành) | **10.936.588** (1063 dòng) | lớn nhất |
| Hoa hồng theo cấp — L3 (Lan tỏa) | **2.400** (544 dòng) | gần như 0 |

> Đơn vị: VND (giả định). Report **phải khớp** các số này khi lấy toàn kỳ, không lọc.

### ⚠️ BẪY FAN-OUT (đã tự bắt được khi query)
Query gom doanh thu theo Company mà JOIN qua `SellUserId` bị **thổi phồng**: 1 đơn có thể có
**nhiều người bán** (vd đơn 37781 có seller `[6797,6799,6988]`), nên `SUM(TotalMoney)` đếm lại
nhiều lần → Freetrend ra 167,5tr > tổng 160,2tr. **Cách đúng:** xác định company của đơn **một lần**
(mỗi đơn 1 company), rồi mới `SUM` doanh thu trên đơn duy nhất. Xem `02-...Queries.sql` (bản đã sửa).

---

## D. Tài nguyên có sẵn nên tận dụng
- **View `dbo."ViewMerchantBill_BillComm"`** đã join sẵn: MerchantBill × Commission × SellUser
  (Id/Username/DisplayName) × StatusBill × AffiliateLevel × CommisionAmount/Percent × CommPaymentStatusName.
  Thiếu: tên người **hưởng** (AffiliateUser), tên **khách mua**, **MSNV**. ⇒ dùng view làm **nền**,
  join bổ sung `UserLogin`(AffiliateUserId), `UserLogin`+`Staff`(RenterGUID) cho phần còn thiếu.
