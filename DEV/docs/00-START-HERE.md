# START HERE — bản đồ cho dev mới

> Đọc file này đầu tiên. CoShareReport là app **read-only** đọc thẳng Postgres CoShare để xuất
> báo cáo. Rủi ro lớn nhất **không** phải "code chạy hay không" mà là **số sai mà trông vẫn hợp
> lý** → dự án chạy **TDD** và đối soát số nghiêm ngặt.

## 4 cây tài liệu — mỗi cây trả lời 1 câu hỏi

| Nơi | Trả lời câu hỏi | Vào khi |
|---|---|---|
| [`../CLAUDE.md`](../CLAUDE.md) | *Dự án là gì? Luật cứng?* (readonly, kiến trúc, TDD) | đầu tiên |
| [`../principles/`](../principles/) | *Viết code thế nào?* (style, **TDD** ở [`testing.md`](../principles/testing.md)) | trước khi code |
| [`../standards/`](../standards/) | *Report thế nào là đạt chuẩn?* (số đúng, format, **đối soát**) | trước khi làm report |
| [`./`](.) (docs) | *Dữ liệu CoShare nghĩa là gì?* (bảng, quy ước, golden numbers) | tra khi viết query |

**Khi mâu thuẫn:** `docs/` quyết định **nghĩa nghiệp vụ** → `standards/` quyết định **chất lượng
report** → `principles/` quyết định **cách code**. Luật **READONLY** đứng trên tất cả. Và khi
docs mâu thuẫn nhau → **query DB thật quyết định** (xem `standards/08 §7`).

## Thứ tự đọc cho dev mới

1. [`../CLAUDE.md`](../CLAUDE.md) — dự án + luật readonly + **rule TDD**.
2. [`./ROADMAP.md`](./ROADMAP.md) — đang ở đâu, làm gì tiếp, cái gì đang chặn (❓ CoShare).
3. [`./db/conventions.md`](./db/conventions.md) + [`./db/table-dictionary.md`](./db/table-dictionary.md) — quy ước + golden numbers + bảng/cột đã chắt lọc.
4. [`../standards/README.md`](../standards/README.md) → [`01-data-accuracy.md`](../standards/01-data-accuracy.md) + [`08-verification.md`](../standards/08-verification.md) — số đúng & đối soát.
5. [`../principles/testing.md`](../principles/testing.md) — cách viết test (TDD 2 tầng).

## Thêm 1 report (đường tắt, theo TDD)

1. Copy [`./reports/_TEMPLATE.md`](./reports/_TEMPLATE.md) → `docs/reports/<ten-report>.md`, điền spec.
2. **Viết test trước** (RED): 1 invariant + 1 golden (`standards/08` cách đối soát, `principles/testing.md` cách viết).
   - ⚠️ **Thiếu golden / định nghĩa còn `❓` / data không đủ phủ case → DỪNG, hỏi HUMAN.** Không bịa số cho "test xanh".
3. Viết query readonly cho test xanh (GREEN) → refactor.
4. Endpoint sau `JwtAuthGuard` → frontend → export.
5. Đối soát khớp golden mới ký "xong" (Definition of Done ở `standards/README.md`).

## Report đầu tiên: Commission Report

Spec đầy đủ nằm ở [`./requirements/commission-report/`](./requirements/commission-report/) (00 yêu
cầu · 01 data model · 02 SQL đã kiểm chứng · 03 hướng dẫn · 04 findings + golden numbers).

> Phân biệt: `docs/requirements/commission-report/` = **spec chi tiết của report ĐẦU TIÊN**;
> `docs/reports/_TEMPLATE.md` = **mẫu cho các report SAU**.

## Luật không được quên
- **READONLY** — chỉ `find*/aggregate/count/$queryRaw`. Cần view/index → viết SQL vào
  [`../sql-scripts/`](../sql-scripts/) và giao HUMAN chạy (xem `CLAUDE.md`).
- **TDD** — test trước, code sau. Report: test đầu = đối soát số.
- **Thiếu cơ sở test → hỏi HUMAN**, không đoán.
