# ROADMAP — CoShareReport

> Bản kế hoạch **để dev sau lấy code về là hiểu**: đang ở đâu, làm gì tiếp, cái gì đang chặn.
> Cập nhật trạng thái khi hoàn thành từng mục. Đọc trước: [`00-START-HERE.md`](./00-START-HERE.md).

App **read-only** đọc thẳng Postgres CoShare, xuất báo cáo. Rủi ro số 1 = **số sai nhưng trông
hợp lý** → toàn dự án chạy **TDD** (xem `principles/testing.md` + `standards/08-verification.md`).

---

## Trạng thái hiện tại (2026-08-10)

| Hạng mục | Trạng thái |
|---|---|
| Kết nối DB readonly (`readonly_khanh`) | ✅ chạy được |
| Schema introspect (`prisma db pull`) | ✅ 504 model trong `apps/api/prisma/schema.prisma` |
| Golden numbers verify trên DB thật | ✅ khớp (xem `docs/db/conventions.md §5`) |
| Chuẩn report (`standards/01–08`) | ✅ có (07, 08, `_templates/` đã tồn tại) |
| Rule TDD | ✅ chốt (CLAUDE.md + `principles/testing.md` + `standards/08`) |
| Test harness / golden fixtures | ⛔ chưa có (P1) |
| Report code (Commission) | ⛔ chưa bắt đầu (P2+) |

---

## Các phase

### P0 — Nền tảng ✅ (đợt hiện tại)
Rule TDD (3 tầng: CLAUDE.md, `principles/testing.md`, `standards/08-verification.md`) · ROADMAP
này · bản đồ docs (`00-START-HERE.md`). **Không đụng code report.**

### P1 — Test harness + đối soát (chưa làm)
- `apps/api/test/fixtures/commission.golden.ts` — golden numbers 1 chỗ, có `snapshotDate`
  (phản chiếu `docs/db/conventions.md §5` + `requirements/commission-report/04`).
- Skeleton **reconciliation suite** (`*.recon.spec.ts`, opt-in `RECON_DB=1`) cho 6 cross-check
  ở `standards/08 §6` — chạy tay/nightly, không chặn CI.
- Helper gọi `$queryRaw` readonly cho recon test.

### P2 — Commission Tab 1 (overview + by-level + pie) — TDD red→green
Endpoint: `/reports/commission/overview`, `/by-person`, `/by-level`
(SQL sẵn ở `requirements/commission-report/02-Commission-Report-Queries.sql`). Viết golden/invariant
test trước → query cho xanh → khớp golden.

### P3 — Commission Tab 2/3 (detail + summary + line-item + export)
Endpoint `/reports/commission/detail` (+ `:billId/items`). Chú ý **bẫy fan-out** (01 §2) và
serialize BigInt/Decimal → string.

### P4 — Reconciliation report (công cụ QA thường trực)
Hiện 6 cross-check (`standards/08 §6`) thành 1 màn hình admin — vừa QA vừa tái dùng golden test.

---

## ❓ Câu hỏi đang chặn "ký số đúng" (gửi CoShare)

> Code vẫn chạy được với giả định, nhưng **không ký "số đúng"** tới khi chốt. Chi tiết bằng chứng:
> `requirements/commission-report/04-DB-Verification-Findings.md`.

| # | Câu hỏi | Ảnh hưởng | Query được không |
|---|---|---|---|
| 1 | "Loại sp" vật lý/phi vật lý phân loại theo cột nào? | filter Tab2/3 | ❌ `MaterialCommGroupId` NULL 100% → tạm **disable** filter |
| 2 | Cột "Trạng thái" hiển thị đơn (`StatusBill`) hay TT thanh toán HH? | cột hiển thị | – |
| 3 | Timezone biên ngày (Asia/Ho_Chi_Minh?) | mọi filter theo ngày | – |
| 4 | "Người giới thiệu" = `SellUserId` hay `AffiliatePartnerClosure` L1? cách quy HH drill-down? | Tab1 by-person, cột referrer | ⚠️ đã bắt 1 mâu thuẫn (08 §7) |
| 5 | Soft-delete: loại `IsDeleted=true` ở mọi bảng đúng chưa? | mọi số | – |
| 6 | `StatusBill` toàn = 1 (chưa có Finished/Cancel) — quy trình chưa đóng đơn? | cột Thành công/Huỷ hiện = 0 | ✅ đã xác nhận bằng data |

---

## 6 report kiểm tra chéo
Xem bảng đầy đủ ở [`standards/08-verification.md §6`](../standards/08-verification.md). Tóm tắt:
golden reconciliation · cross-foot · fan-out detector · **recompute HH độc lập** · pie=tổng ·
view-vs-base-table.

---

## Nợ kỹ thuật / TODO
- [ ] Report `latestUsers` (mẫu) chưa có spec test → TDD-hoá hoặc gỡ khi có report thật.
- [ ] `auth.service.ts` chưa có unit test (verify token, mint session).
- [ ] Khi cần SQL deterministic trong CI: cân nhắc seed 1 lát dữ liệu nhỏ vào Postgres local
      (hiện quyết định **không** dùng Docker — dùng recon suite live thay thế).
