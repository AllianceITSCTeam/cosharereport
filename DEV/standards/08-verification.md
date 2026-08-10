# 08 — Verification & Regression (đối soát trước khi tin) 🔴 P0

> "Chạy không lỗi" **không** phải bằng chứng số đúng. Chuẩn này định nghĩa *bằng chứng* cần có
> trước khi phát hành một report, và cách giữ cho nó không hỏng về sau. Đi kèm [01](./01-data-accuracy.md).

---

## 1. Ba tầng bằng chứng (làm đủ mới được coi là "đã kiểm")

### Tầng A — Đối soát lát nhỏ (self-check độc lập)
Chọn **một lát nhỏ đã biết** (1 ngày / 1 user / 1 đơn) và **tự đếm bằng một truy vấn độc lập**
(cách viết khác với query report) → phải **khớp**.
- Query đối soát lưu vào `sql-scripts/` (`yyyy-MM-dd HH:mm reconcile <slug>.sql`) — để trace được.
- Khác đường tính mà ra cùng số → tăng độ tin. Cùng đúng một query copy 2 lần thì **không** tính.

### Tầng B — Golden numbers của CoShare
So report với **con số tham chiếu đã biết đúng** từ CoShare (admin panel / báo cáo tay).
- Golden sống ở `docs/conventions.md` §5 (đã có sẵn: tổng đơn 1.218, doanh thu 160.191.779, hoa hồng 2.611 / 13.621.482, L1/L2/L3…).
- Khớp → ✅. Lệch → **không phát hành**; điều tra tới khi giải thích được (chênh do filter? grain? timezone?).

### Tầng C — Bất biến nội tại (cross-check)
Kiểm quan hệ phải-đúng-bất-kể-dữ-liệu ([01](./01-data-accuracy.md) §7):
- Tổng các nhóm = tổng tổng (vd `L1+L2+L3 = tổng hoa hồng`).
- Số sau filter ≤ số thô; các % nhóm cộng = 100%.
- Doanh thu ≥ 0; count ≥ 0; không có ngày ngoài khoảng lọc.

## 2. Kiểm biên (edge cases) — bắt buộc chạy thử

| Biên | Kỳ vọng |
|---|---|
| Khoảng ngày **rỗng dữ liệu** | empty state, không lỗi, không "0" giả thành "—" sai |
| Bản ghi lúc **00:00** và **23:59:59** ngày biên | rơi đúng phía theo tz nghiệp vụ |
| Cột nguồn **NULL** | không crash; hiển thị `—`; không lọt vào `SUM` sai |
| **1 dòng** và **rất nhiều dòng** | phân trang đúng; tổng vẫn đúng |
| `pageSize` vượt trần, `from > to`, ngày sai định dạng | trả `400` rõ ràng, không 500 |
| Soft-deleted / status loại trừ | đúng số theo quy ước đã chốt |

## 3. Snapshot golden để chống hồi quy (regression)

**MUST:** sau khi một report được đối soát khớp, **chốt lại kết quả** làm mốc:
- Ghi bộ input cố định (khoảng ngày cố định, tz) + output kỳ vọng vào spec report và/hoặc test.
- **SHOULD:** viết test tự động (theo `principles/testing.md`) so output report với snapshot đó — đổi code mà số đổi thì test đỏ, buộc xem lại.
- ⚠️ DB CoShare là **production sống**, số quá khứ có thể đổi (bản ghi mới/sửa). → Snapshot dùng **khoảng thời gian đã đóng** (tháng đã qua) để ổn định; hoặc test trên tập cố định/độc lập, không phải "toàn kỳ" luôn trôi.

## 4. Khi số lệch — quy trình điều tra

1. Xác định lệch ở đâu: tổng lệch hay chỉ vài nhóm? → khoanh vùng.
2. Nghi grain/fan-out trước ([01](./01-data-accuracy.md) §1–2): `SUM` có nhân lên do JOIN không?
3. Kiểm filter: soft-delete / status / mốc thời gian có khớp định nghĩa metric ([02](./02-metric-definitions.md))?
4. Kiểm timezone: lệch đúng bằng số bản ghi ở vùng biên ngày? → sai biên tz.
5. Vẫn lệch → có thể **golden sai** hoặc **định nghĩa nghiệp vụ chưa chốt** → hỏi CoShare, ghi `❓`.
6. Mọi kết luận cập nhật `conventions.md` / registry [02](./02-metric-definitions.md).

> **Rule — thiếu cơ sở đối soát thì DỪNG, hỏi HUMAN.** Không có golden number, định nghĩa còn
> `❓`, hoặc dữ liệu không đủ phủ case (vd `StatusBill` toàn = 1) → **không** bịa số kỳ vọng cho
> "test xanh". Ghi cái thiếu vào spec + [`docs/ROADMAP.md`](../docs/ROADMAP.md) §❓, báo HUMAN
> (cần số/định nghĩa/dữ liệu gì), và `it.todo`/`skip` test đó kèm lý do. Xem `principles/testing.md` Rule #1.

## 5. Tài liệu hoá bằng chứng

**MUST:** trong spec report, phần "Kiểm tra" ghi rõ:
- Lát đối soát nào, query ở đâu (`sql-scripts/`), kết quả khớp.
- Golden nào đã so, khớp/không.
- Bất biến nào đã kiểm.
- `❓` còn lại (nếu có) và ảnh hưởng tới độ tin của số.

---

## 6. Sáu (6) cross-check bắt buộc cho Commission Report

Mỗi dòng = **1 phép kiểm tra chéo** (cụ thể hoá Tầng C cho report này). Đây cũng là spec cho
**Reconciliation report** (P4 trong [`docs/ROADMAP.md`](../docs/ROADMAP.md)) và — theo **TDD** —
mỗi cái nên viết thành **1 test Tier B** *trước* khi code (xem [`principles/testing.md`](../principles/testing.md)).

| # | Cross-check | Đường A | Đường B (độc lập) | Bắt lỗi gì |
|---|---|---|---|---|
| 1 | **Golden reconciliation** | số report (toàn kỳ) | golden §Tầng B | regression tổng thể |
| 2 | **Cross-foot** | Σ doanh thu/HH từng Cty (Tab1) | tổng toàn hệ | sót/trùng khi `GROUP BY` |
| 3 | **Fan-out detector** | `SUM(TotalMoney)` bill-grain | `SUM` sau JOIN commission | nhân bản multi-seller |
| 4 | **Recompute HH độc lập** | `MerchantBillCommission.CommisionAmount` (số lưu) | tính lại từ `AffiliatePartnerClosure × ConfigMaterialCommisionTier × MerchantBillDetail` | số HH lưu / công thức sai |
| 5 | **Pie = tổng** | Σ HH theo cấp (chart Tab1) | tổng HH toàn kỳ | sót cấp / double count |
| 6 | **View vs base-table** | tổng từ `ViewMerchantBill_BillComm` | tổng từ bảng gốc | view lệch định nghĩa |

> #3 và #4 giá trị nhất — verify *nghiệp vụ*, không chỉ *cộng trừ*. #1/#2/#5 gần như "free" khi
> đã có query chính.

## 7. ⚠️ Case study — đừng tin docs một chiều, DB thật thắng

Khi review, hai tài liệu **mâu thuẫn** về `MerchantBillCommission.SellUserId`:
- `docs/coshare-backend/.../02-NghiepVu-HoaHong.md §4` (đọc source .NET): "`SellUserId` = **khách
  của bill** (`bill.RenterGUID`)".
- `docs/requirements/commission-report/04-DB-Verification-Findings.md`: "`SellUserId` = **người
  bán / giới thiệu**".

Query DB thật (readonly) giải quyết dứt điểm:

| Kiểm | Kết quả |
|---|---|
| `SellUserId` = khách mua | **1 / 2611** dòng |
| `SellUserId` ≠ khách mua | **2610 / 2611** dòng |
| Số seller khác nhau | **35** |

→ `SellUserId` **là người bán** (tập nhỏ ~35 người, khớp "c.Vinh/c.Sen/c.Thu" của Freetrend),
**không** phải khách mua. Doc backend đã **cũ/sai**; doc verify-bằng-DB đúng.

**Rule rút ra:** (1) hai nguồn lệch → **query DB độc lập quyết định**, không tin phân tích tĩnh;
(2) số "có vẻ khớp" vẫn có thể do **hiểu sai ngữ nghĩa cột** — chỉ recompute độc lập (#4) mới lộ;
(3) ghi phát hiện + bằng chứng vào `docs/` để người sau không vấp lại.

---

## Checklist Verification (gate phát hành — không đủ thì chưa release)

- [ ] **Tầng A**: đối soát ≥1 lát nhỏ bằng query độc lập → khớp; query lưu `sql-scripts/`.
- [ ] **Tầng B**: so ≥1 golden number CoShare → khớp (hoặc giải thích được).
- [ ] **Tầng C**: ≥1 bất biến (tổng nhóm = tổng tổng) đúng.
- [ ] Chạy đủ **edge cases** §2 (rỗng, biên ngày, null, phân trang, input sai).
- [ ] Có **snapshot regression** trên khoảng thời gian đã đóng (+ test nếu có).
- [ ] Bằng chứng + `❓` còn lại đã ghi vào spec & cập nhật `docs/`.

> **Why:** con số không có bằng chứng chỉ là **phỏng đoán được format đẹp**. Ba tầng đối soát biến
> phỏng đoán thành số liệu có thể đứng ra bảo vệ trước CoShare.
