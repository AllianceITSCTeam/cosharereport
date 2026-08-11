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
> - **StatusBill**: 2=Thành công, 3=Huỷ (dữ liệu hiện toàn = 1). Cột "Trạng thái" = `StatusBill`.
> - **"Loại sp" vật lý/phi vật lý**: phi vật lý = `MerchantProduct.Code` chứa `"ZALOOA"`; vật lý = còn lại.
> - **Timezone**: DB lưu `timestamptz` UTC+00 → report lọc & hiển thị theo **UTC+7**.
> - **Soft-delete**: loại `IsDeleted = true` (đã chốt).

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
1 dòng = 1 khoản hoa hồng cho **1 người hưởng** trên **1 đơn**. Đây là hạt (grain) của Screen 3.

| Cột | Kiểu | Ý nghĩa trong report |
|---|---|---|
| `Id` | bigint (PK) | khoá |
| `MerchantBillId` | bigint (FK→MerchantBill.Id) | nối tới đơn |
| `MerchantBillID_GUID` | uuid | (bản GUID của FK) |
| `SellUserId` | bigint (FK→UserLogin.Id) | **người bán** |
| `AffiliateUserId` | bigint (FK→UserLogin.Id) | **người hưởng hoa hồng** (cột Người hưởng — Screen 3) |
| `AffiliateLevelId` | bigint (FK→ConfigAffiliateLevel.Id) | **cấp hệ hoa hồng** (lọc Screen 3, biểu đồ Screen 2) |
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
| `OrderNumber` | varchar | **Mã đơn** (đã chốt dùng cột này; `Code`/`BillNumber` không dùng) |
| `BillDate` | timestamptz | **Ngày đặt hàng** (lọc theo khoảng) |
| `TotalMoney` | numeric | **Tổng tiền đơn** / Doanh thu |
| `StatusBill` | int | **Trạng thái đơn** (Thành công/Huỷ ❓ — cần bảng ánh xạ giá trị) |
| `MerchantGUID` | uuid (→Merchant.ID_GUID) | **Cty** ❓ |
| `RenterGUID` | uuid | khách thuê/mua (→ UserLogin.ID_GUID ❓) |
| `CustomerCode` | varchar | mã khách |
| `RenterReceiverName` | varchar | **Người mua/KH đặt** (tên người nhận) |
| `RenterReceiverPhone` | varchar | SĐT người nhận |
| `IsDeleted` | bool | soft-delete |

### 2.3. `MerchantBillDetail` — Line-item (Screen 3 expander "Chi tiết đơn hàng")
| Cột | Kiểu | Ý nghĩa |
|---|---|---|
| `MerchantBillId` | bigint (FK) | thuộc đơn nào |
| `ProductId` | bigint (FK→MerchantProduct.Id) | sản phẩm (join lấy `Code` để phân loại vật lý/phi vật lý) |
| `ProductName` | varchar | **Mặt hàng** (tên sản phẩm) — cột expander |
| `Quantity` | numeric | **SL** (số lượng) — cột expander |
| `ProductPrice` | numeric | **Đơn giá** (giá 1 đơn vị) — cột expander |
| `TotalMoney` | numeric | **Thành tiền** dòng — cột expander |
| `Code` | varchar | mã dòng (có thể = mã sản phẩm, denormalized) |
| `MaterialCommisionTiers` | varchar | cấu hình bậc hoa hồng vật lý (JSON) — KHÔNG dùng để phân loại "Loại sp" |

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
| `ConfigAffiliateLevel` | `Level`, `Name`, `NameInCommision` | **Cấp hệ hoa hồng** (lọc Screen 3 + nhãn biểu đồ Screen 2) |
| `ConfigCommPaymentStatus` | `Name`, `DisplayName` | Trạng thái **thanh toán hoa hồng** ❓ |
| `Merchant` | `ID_GUID`, `Name`, `Code` | **Cty** (ứng viên 1) |
| `Company` | `Id`, `Name`, `Code`, `HiddenAffiliateIncomeLevels` | **Cty** (ứng viên 2) ❓ |
| `MerchantProduct` | `Code`, `Name` | **Loại sp**: `Code` chứa `"ZALOOA"` = phi vật lý; còn lại = vật lý |
| `ConfigMaterialCommGroup` | `Name` | nhóm hoa hồng **vật lý** (material) |
| `ConfigMaterialCommisionTier` | `MaterialCommGroupId`, `AffiliateLevelId`, `CommPercent` | bậc % hoa hồng theo nhóm vật lý × cấp |
| `ConfigGoodsType` | `Name`, `Code` | loại hàng hoá (ứng viên khác cho "Loại sp") ❓ |
| `AffiliatePartner` | `UserLoginId`, `ReferredByUserId`, `ReferralCode` | **Người giới thiệu** (quan hệ trực tiếp) |
| `AffiliatePartnerClosure` | `AncestorUserId`, `DescendantUserId`, `Level` | cây affiliate (giới thiệu nhiều cấp) |

---

## 3. Ánh xạ CỘT REPORT → BẢNG.CỘT (bảng tra nhanh)

### Screen 1 — Hoa hồng tổng quan (gom theo Cty)
| Cột report | Nguồn | Công thức |
|---|---|---|
| Cty | `Merchant.Name` ❓ | GROUP BY Merchant |
| Doanh thu | `MerchantBill.TotalMoney` | `SUM` (không JOIN commission trực tiếp) |
| Tổng đơn | `MerchantBill.Id` | `COUNT(DISTINCT)` |
| Thành công | `MerchantBill.StatusBill` | `COUNT FILTER (StatusBill = :SUCCESS❓)` |
| Huỷ | `MerchantBill.StatusBill` | `COUNT FILTER (StatusBill = :CANCELLED❓)` |
| Hoa hồng | `MerchantBillCommission.CommisionAmount` | `SUM` (subquery riêng) |

### Screen 2 — Hoa hồng theo công ty (drill-down, bắt buộc chọn 1 Cty)
| Cột | Nguồn | Ghi chú |
|---|---|---|
| Tên | `UserLogin.DisplayName` qua `SellUserId` (thành viên/người bán của Cty) | GROUP BY người bán; chưa chọn Cty → không query |
| Tổng doanh thu | `SUM(MerchantBill.TotalMoney)` các đơn của thành viên (mỗi đơn 1 lần) | |
| Tổng đơn | `COUNT(DISTINCT MerchantBillId)` — số đơn phát sinh của thành viên | |
| Thành công / Huỷ | `COUNT DISTINCT ... FILTER (StatusBill = 2 / 3)` | |
| Hoa hồng | `SUM(CommisionAmount)` theo người bán (hoa hồng tạo ra) ❓ tạo ra vs nhận | |

### Screen 3 — Báo cáo đơn hàng (grain = 1 dòng `MerchantBillCommission`)
| Cột report | Nguồn |
|---|---|
| Mã đơn | `MerchantBill.OrderNumber` (đã chốt) |
| Ngày đặt hàng | `MerchantBill.BillDate` (hiển thị UTC+7) |
| Người mua hàng | `UserLogin.DisplayName` qua `RenterGUID` (fallback `RenterReceiverName`) |
| MSNV | `Staff.StaffCode` của **khách mua** (`RenterGUID → UserLogin → Staff`) |
| Người giới thiệu | `UserLogin.DisplayName` qua `MerchantBillCommission.SellUserId` |
| Người hưởng hoa hồng | `UserLogin.DisplayName` qua `MerchantBillCommission.AffiliateUserId` |
| Chi tiết đơn hàng (expander) | `MerchantBillDetail`: `ProductName` × `Quantity` × `ProductPrice` × `TotalMoney` |
| Tổng tiền đơn | `MerchantBill.TotalMoney` (hoặc `MerchantBillTotalMoney`) |
| Tổng hoa hồng | `MerchantBillCommission.CommisionAmount` |
| Trạng thái | `MerchantBill.StatusBill` (= bộ lọc "Trạng thái đơn") |
| Cấp hệ hoa hồng (lọc) | `MerchantBillCommission.AffiliateLevelId` → `ConfigAffiliateLevel` |
| Loại sp (lọc) | `EXISTS MerchantBillDetail → MerchantProduct.Code ILIKE '%ZALOOA%'` = phi vật lý; ngược lại = vật lý |

---

## 4. Chỉ mục (index) nên có để report chạy nhanh
> Report là **readonly**; nếu cần index CoShare phải tự tạo (xem `conventions.md`). Đề xuất:
- `MerchantBill (BillDate, MerchantGUID, StatusBill)` — lọc chính cả 3 screen.
- `MerchantBillCommission (MerchantBillId)` — đã có FK; kiểm tra có index.
- `MerchantBillCommission (AffiliateUserId, AffiliateLevelId)` — lọc theo người/cấp.
- `MerchantBillDetail (MerchantBillId)` — đã có FK `FK_MerchantBillDetail_BillId`.

---

## 5. Việc cần chốt (tóm tắt, xem đầy đủ §4 file yêu cầu)
**Đã chốt:** `StatusBill` enum · Cty=`Company` · MSNV=khách mua · Loại sp=`Code` chứa `"ZALOOA"`
(không có đơn trộn) · cột Trạng thái=`StatusBill` · Mã đơn=`OrderNumber` · Người giới thiệu=`SellUserId` ·
timezone=UTC+7 · soft-delete=loại `IsDeleted` · Screen 2 doanh thu/đơn = tổng tiền/số đơn của thành viên.
**Còn ❓:** hoa hồng Screen 2 quy theo *tạo ra* (`SellUserId`) hay *nhận* (`AffiliateUserId`).
