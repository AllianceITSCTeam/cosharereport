# Cấu trúc dữ liệu — Báo cáo Hoa hồng

> Ánh xạ **yêu cầu → schema thật** của CoShare (`apps/api/prisma/schema.prisma`, schema Postgres `dbo`).
> Mọi tên bảng/cột dưới đây **trích từ schema.prisma đã introspect** — dùng đúng tên (PascalCase,
> phân biệt hoa/thường, phải bọc `"..."` trong SQL).
> Chỗ chưa chắc = ❓ (cần chốt với CoShare trước khi tin số).

> ⚠️ **ĐÃ KIỂM CHỨNG DB THẬT** — vài mục dưới đây được cập nhật, chi tiết + bằng chứng ở
> [`04-DB-Verification-Findings.md`](./04-DB-Verification-Findings.md). Chốt nhanh:
> - **"Cty" = `Company`** (KHÔNG phải Merchant), nối qua **người bán**:
>   `MerchantBillCommission.SellUserId → UserLogin_Company_Mapping.CompanyId → Company`.
> - **MSNV = `Staff.StaffCode` của KHÁCH MUA** (`MerchantBill.RenterGUID → UserLogin → Staff`).
> - **Người giới thiệu = `SellUserId`** ; **Người mua = `RenterGUID`** ; **Người hưởng = `AffiliateUserId`**.
> - **StatusBill**: 2=Thành công, 3=Huỷ (dữ liệu hiện toàn = 1).
> - **"Loại sp" vật lý/phi vật lý**: chưa có cột chuẩn → tạm bỏ filter.

---

## 1. Sơ đồ quan hệ (ER — rút gọn cho báo cáo này)

```
                         ┌────────────────────────┐
                         │ Merchant  (= "Cty" ❓)  │
                         │ ID_GUID, Name, Code     │
                         └───────────▲────────────┘
                                     │ MerchantGUID = Merchant.ID_GUID
                                     │
┌───────────────────────┐   1     ┌──┴───────────────────────────┐   1     ┌──────────────────────────┐
│ MerchantBillDetail    │◄────────┤ MerchantBill  (ĐƠN HÀNG)     ├────────►│ MerchantBillCommission   │
│ (line-item: mua gì)   │  N      │ Id, Code/OrderNumber,        │  N      │ (HOA HỒNG — 1 dòng/người │
│ ProductId, ProductName│         │ BillDate, TotalMoney,        │         │  hưởng /đơn)             │
│ Quantity, TotalMoney  │         │ StatusBill, RenterGUID,      │         │ AffiliateUserId,SellUserId│
└──────────┬────────────┘         │ CustomerCode, MerchantGUID   │         │ AffiliateLevel(Id),       │
           │ ProductId            └──────────────────────────────┘         │ CommisionPercent/Amount,  │
           ▼                                                               │ CommPaymentStatusId       │
┌───────────────────────┐                                                 └───────┬──────────┬────────┘
│ MerchantProduct       │                                        AffiliateUserId │          │ AffiliateLevelId
│ MaterialCommGroupId   │──► vật lý/phi vật lý ❓                  SellUserId      ▼          ▼
└───────────────────────┘                                        ┌──────────────────┐  ┌──────────────────────┐
                                                                 │ UserLogin        │  │ ConfigAffiliateLevel │
                                                                 │ DisplayName,     │  │ Level, Name,         │
                                                                 │ Username         │  │ NameInCommision      │
                                                                 └────────┬─────────┘  └──────────────────────┘
                        MSNV ❓                                           │ 1–1 (Id = Id)
                                                                          ▼
                                                                 ┌──────────────────┐
                                                                 │ Staff            │
                                                                 │ StaffCode (=MSNV?)│
                                                                 └──────────────────┘

Người giới thiệu ❓:  AffiliatePartner (UserLoginId, ReferredByUserId, ReferralCode)
                      AffiliatePartnerClosure (AncestorUserId, DescendantUserId, Level)  ← cây affiliate
Trạng thái hoa hồng:  ConfigCommPaymentStatus (Name)  ←  MerchantBillCommission.CommPaymentStatusId
```

---

## 2. Bảng lõi

### 2.1. `MerchantBillCommission` — **bảng trung tâm của báo cáo**
1 dòng = 1 khoản hoa hồng cho **1 người hưởng** trên **1 đơn**. Đây là hạt (grain) của Tab 2/3.

| Cột | Kiểu | Ý nghĩa trong report |
|---|---|---|
| `Id` | bigint (PK) | khoá |
| `MerchantBillId` | bigint (FK→MerchantBill.Id) | nối tới đơn |
| `MerchantBillID_GUID` | uuid | (bản GUID của FK) |
| `SellUserId` | bigint (FK→UserLogin.Id) | **người bán** |
| `AffiliateUserId` | bigint (FK→UserLogin.Id) | **người hưởng hoa hồng** (cột 6 Tab2 / cột 6 Tab3) |
| `AffiliateLevelId` | bigint (FK→ConfigAffiliateLevel.Id) | **cấp hệ hoa hồng** (lọc Tab2/3, biểu đồ Tab1) |
| `AffiliateLevel` | int | số cấp (denormalized) |
| `MerchantBillTotalMoney` | numeric | tổng tiền đơn (denormalized tại thời điểm tính) |
| `MerchantBillDate` | timestamptz | ngày đơn (denormalized) — tiện lọc theo ngày |
| `CommisionPercent` | numeric | % hoa hồng |
| `CommisionAmount` | numeric | **tiền hoa hồng** (Tổng hoa hồng) |
| `CommPaymentStatusId` | bigint (FK→ConfigCommPaymentStatus.Id) | trạng thái thanh toán hoa hồng ❓ |
| `IsApproved` / `ApprovedDate` | bool / ts | đã duyệt hoa hồng chưa |
| `IsRequested` | bool | đã yêu cầu chi chưa |
| `CommisionDetails` | varchar | mô tả cách tính (JSON/text) |
| `IsDeleted` | bool | soft-delete → **loại khi report** ❓ |

> **Lưu ý grain:** 1 đơn có thể sinh **nhiều dòng** hoa hồng (nhiều cấp/nhiều người). Khi tính
> "Tổng hoa hồng của đơn" = `SUM(CommisionAmount)` theo `MerchantBillId`. Khi tính "Doanh thu"
> **đừng** SUM `TotalMoney` sau khi JOIN commission (bị nhân bản) — xem SQL §pitfall.

### 2.2. `MerchantBill` — Đơn hàng (header)
| Cột | Kiểu | Ý nghĩa trong report |
|---|---|---|
| `Id` | bigint (PK) | khoá |
| `Code` / `OrderNumber` / `BillNumber` | varchar | **Mã đơn** (chốt dùng cột nào ❓, đoán `OrderNumber` hiển thị) |
| `BillDate` | timestamptz | **Ngày đặt hàng** (lọc theo khoảng) |
| `TotalMoney` | numeric | **Tổng tiền đơn** / Doanh thu |
| `StatusBill` | int | **Trạng thái đơn** (Thành công/Huỷ ❓ — cần bảng ánh xạ giá trị) |
| `MerchantGUID` | uuid (→Merchant.ID_GUID) | **Cty** ❓ |
| `RenterGUID` | uuid | khách thuê/mua (→ UserLogin.ID_GUID ❓) |
| `CustomerCode` | varchar | mã khách |
| `RenterReceiverName` | varchar | **Người mua/KH đặt** (tên người nhận) |
| `RenterReceiverPhone` | varchar | SĐT người nhận |
| `IsDeleted` | bool | soft-delete |

### 2.3. `MerchantBillDetail` — Line-item (Tab 3 cột "Chi tiết đơn hàng")
| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `MerchantBillId` | bigint (FK) | thuộc đơn nào |
| `ProductId` | bigint (FK→MerchantProduct.Id) | sản phẩm |
| `ProductName` | varchar | tên sản phẩm |
| `Quantity` | numeric | số lượng |
| `TotalMoney` | numeric | thành tiền dòng |
| `MaterialCommisionTiers` | varchar | cấu hình bậc hoa hồng vật lý (JSON) — liên quan "Loại sp" ❓ |

### 2.4. `UserLogin` — Người (giới thiệu / hưởng hoa hồng / bán / mua)
| Cột | Ý nghĩa |
|---|---|
| `Id` (PK) | khoá; nối từ `AffiliateUserId`, `SellUserId`, ... |
| `DisplayName` | **Tên** hiển thị (dùng cho cột Người hưởng/Người giới thiệu/Người mua) |
| `Username` | tên đăng nhập (fallback tìm kiếm) |
| `ID_GUID` | nối với `MerchantBill.RenterGUID` ❓ |
| `IsDeleted` | soft-delete |

### 2.5. `Staff` — nhân viên (MSNV)
| Cột | Ý nghĩa |
|---|---|
| `Id` (PK, = `UserLogin.Id`, quan hệ 1–1) | nối tới UserLogin |
| `StaffCode` | **MSNV** ❓ (Mã số nhân viên) |

### 2.6. Bảng cấu hình / phân loại
| Bảng | Cột chính | Dùng cho |
|---|---|---|
| `ConfigAffiliateLevel` | `Level`, `Name`, `NameInCommision` | **Cấp hệ hoa hồng** (lọc + nhãn biểu đồ Tab1) |
| `ConfigCommPaymentStatus` | `Name`, `DisplayName` | Trạng thái **thanh toán hoa hồng** ❓ |
| `Merchant` | `ID_GUID`, `Name`, `Code` | **Cty** (ứng viên 1) |
| `Company` | `Id`, `Name`, `Code`, `HiddenAffiliateIncomeLevels` | **Cty** (ứng viên 2) ❓ |
| `MerchantProduct` | `MaterialCommGroupId` | **Loại sp** vật lý/phi vật lý ❓ |
| `ConfigMaterialCommGroup` | `Name` | nhóm hoa hồng **vật lý** (material) |
| `ConfigMaterialCommisionTier` | `MaterialCommGroupId`, `AffiliateLevelId`, `CommPercent` | bậc % hoa hồng theo nhóm vật lý × cấp |
| `ConfigGoodsType` | `Name`, `Code` | loại hàng hoá (ứng viên khác cho "Loại sp") ❓ |
| `AffiliatePartner` | `UserLoginId`, `ReferredByUserId`, `ReferralCode` | **Người giới thiệu** (quan hệ trực tiếp) |
| `AffiliatePartnerClosure` | `AncestorUserId`, `DescendantUserId`, `Level` | cây affiliate (giới thiệu nhiều cấp) |

---

## 3. Ánh xạ CỘT REPORT → BẢNG.CỘT (bảng tra nhanh)

### Tab 1 — Tổng quan (gom theo Cty)
| Cột report | Nguồn | Công thức |
|---|---|---|
| Cty | `Merchant.Name` ❓ | GROUP BY Merchant |
| Doanh thu | `MerchantBill.TotalMoney` | `SUM` (không JOIN commission trực tiếp) |
| Tổng đơn | `MerchantBill.Id` | `COUNT(DISTINCT)` |
| Thành công | `MerchantBill.StatusBill` | `COUNT FILTER (StatusBill = :SUCCESS❓)` |
| Huỷ | `MerchantBill.StatusBill` | `COUNT FILTER (StatusBill = :CANCELLED❓)` |
| Hoa hồng | `MerchantBillCommission.CommisionAmount` | `SUM` (subquery riêng) |

### Tab 1 — drill-down theo người (đã chọn 1 Cty)
| Cột | Nguồn | Ghi chú |
|---|---|---|
| Tên | `UserLogin.DisplayName` qua `AffiliateUserId` | GROUP BY người hưởng |
| Tổng doanh thu / Tổng đơn / Thành công / Huỷ | như trên | quy cho người thế nào ❓ |
| Hoa hồng | `SUM(CommisionAmount)` theo `AffiliateUserId` | |

### Tab 2 & Tab 3 — chi tiết (grain = 1 dòng `MerchantBillCommission`)
| Cột report | Nguồn |
|---|---|
| Mã đơn | `MerchantBill.OrderNumber` / `Code` ❓ |
| Ngày đặt hàng | `MerchantBill.BillDate` |
| KH đặt / Người mua hàng | `MerchantBill.RenterReceiverName` (hoặc `UserLogin` qua `RenterGUID` ❓) |
| MSNV | `Staff.StaffCode` qua người ❓ (hưởng/bán?) |
| Người giới thiệu | `UserLogin.DisplayName` qua `AffiliatePartner.ReferredByUserId` ❓ |
| Người hưởng hoa hồng | `UserLogin.DisplayName` qua `MerchantBillCommission.AffiliateUserId` |
| Chi tiết đơn hàng (Tab3) | danh sách `MerchantBillDetail.ProductName × Quantity` |
| Tổng tiền đơn | `MerchantBill.TotalMoney` (hoặc `MerchantBillTotalMoney`) |
| Tổng hoa hồng | `MerchantBillCommission.CommisionAmount` |
| Trạng thái | `MerchantBill.StatusBill` ❓ (hoặc `ConfigCommPaymentStatus.Name`) |
| Cấp hệ hoa hồng (lọc) | `MerchantBillCommission.AffiliateLevelId` → `ConfigAffiliateLevel` |
| Loại sp (lọc) | `MerchantProduct.MaterialCommGroupId` (vật lý) vs null (phi vật lý) ❓ |

---

## 4. Chỉ mục (index) nên có để report chạy nhanh
> Report là **readonly**; nếu cần index CoShare phải tự tạo (xem `conventions.md`). Đề xuất:
- `MerchantBill (BillDate, MerchantGUID, StatusBill)` — lọc chính Tab1/2/3.
- `MerchantBillCommission (MerchantBillId)` — đã có FK; kiểm tra có index.
- `MerchantBillCommission (AffiliateUserId, AffiliateLevelId)` — lọc theo người/cấp.
- `MerchantBillDetail (MerchantBillId)` — đã có FK `FK_MerchantBillDetail_BillId`.

---

## 5. Việc cần chốt (tóm tắt, xem đầy đủ §4 file yêu cầu)
`StatusBill` enum · Cty=Merchant/Company · MSNV của ai · Loại sp mapping · cột Trạng thái ·
Người giới thiệu định nghĩa · timezone · soft-delete.
