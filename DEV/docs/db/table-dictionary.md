# Table Dictionary — bảng/cột CoShare quan trọng (chắt lọc)

Schema đầy đủ: `apps/api/prisma/schema.prisma` (504 model). File này **chỉ** ghi những
bảng/cột thực sự dùng cho report, kèm ý nghĩa nghiệp vụ — để không phải lội 504 model mỗi lần.

Cách điền: mỗi khi làm 1 report và xác định được bảng nguồn, ghi lại vào đây.

## Mẫu 1 bảng

### `UserLogin` — tài khoản người dùng
| Cột | Kiểu | Ý nghĩa | Ghi chú |
|---|---|---|---|
| `Username` | string | tên đăng nhập | |
| `DisplayName` | string | tên hiển thị | |
| `Log_CreatedDate` | datetime | ngày tạo tài khoản (UTC) | dùng lọc theo khoảng ngày → xem conventions (timezone) |
| `Log_IsDeleted`? | bool | đã xoá mềm? | **xác nhận** cột soft-delete đúng của schema này |

> Bảng `UserLogin` đang được dùng bởi report mẫu `latest-users`
> (`reports.service.ts::latestUsers`). Các cột soft-delete/trạng thái cần **xác nhận với CoShare**.

---

## Danh sách bảng đã lập tài liệu

| Bảng | Dùng cho report | Trạng thái |
|---|---|---|
| `UserLogin` | latest-users (mẫu) | cần xác nhận cột soft-delete |
| `MerchantBillCommission` | Commission Report (bảng lõi) | ✅ đã kiểm chứng DB |
| `MerchantBill` | Commission Report (đơn) | ✅ StatusBill enum đã chốt |
| `MerchantBillDetail` | Commission Report (mặt hàng) | ✅ |
| `UserLogin_Company_Mapping` | Commission Report (map người→Cty) | ✅ |
| `Company` / `Staff` / `ConfigAffiliateLevel` / `ConfigCommPaymentStatus` | Commission Report | ✅ |

## Commission Report — bảng chi tiết
Tài liệu đầy đủ (ER, cột, ánh xạ, SQL đã kiểm chứng, golden numbers):
- `../requirements/commission-report/01-Commission-Report-DataModel.md`
- `../requirements/commission-report/04-DB-Verification-Findings.md`

Tóm tắt khoá nối quan trọng:
- **Đơn → Công ty**: `MerchantBillCommission.SellUserId` → `UserLogin_Company_Mapping.UserLoginId`
  → `.CompanyId` → `Company.Id`.
- **MSNV (khách mua)**: `MerchantBill.RenterGUID` → `UserLogin.ID_GUID` → `Staff.StaffCode`.
- **Hoa hồng**: 1 dòng `MerchantBillCommission`/người hưởng/đơn; `AffiliateUserId` = người hưởng,
  `SellUserId` = người bán/giới thiệu, `CommisionAmount` = tiền hoa hồng.

_(thêm dòng khi lập tài liệu bảng mới)_
