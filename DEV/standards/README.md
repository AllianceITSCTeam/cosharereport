# Standards — chuẩn xây dựng web report (CoShareReport)

> **Trạng thái: DRAFT — chờ HUMAN review.** Bộ chuẩn này do Claude soạn theo bối cảnh project;
> mọi con số / quy ước nghiệp vụ còn `❓` phải được CoShare chốt trước khi tin.

Đây là bộ **tiêu chuẩn cho *sản phẩm report*** — trả lời câu hỏi *"thế nào là một report đúng và tốt?"*.
Nó **khác** và **bổ sung** cho 2 thứ đã có:

| Thư mục | Trả lời câu hỏi | Ví dụ |
|---|---|---|
| `principles/` | *Viết code thế nào?* (kỹ thuật chung, kế thừa Vibe365) | naming, safeArray, response envelope |
| `docs/` | *Dữ liệu CoShare nghĩa là gì?* (kiến thức miền + quy ước) | `table-dictionary.md`, `conventions.md`, golden numbers |
| **`standards/`** | ***Report thế nào là đạt chuẩn?*** (chất lượng sản phẩm report) | số liệu đúng, format tiền tệ, đối soát |

Khi 3 thứ mâu thuẫn: **`docs/` quyết định nghĩa nghiệp vụ** → **`standards/` quyết định chất lượng report** → `principles/` quyết định cách code. Quy tắc READONLY (dưới) **đứng trên tất cả**.

---

## Nguyên tắc cứng #0 — READONLY (không được vi phạm)

Connection string là **READONLY**. App (và Claude) **chỉ đọc**.

- ❌ Không `create/update/delete/upsert/$executeRaw*`, không `migrate`, không `CREATE/ALTER/DROP/INSERT/UPDATE/DELETE`.
- ✅ Chỉ `findMany / findUnique / aggregate / count / groupBy / $queryRaw`.
- Cần **view / function / index**? Claude **KHÔNG tự tạo** → viết SQL vào `sql-scripts/` tên `yyyy-MM-dd HH:mm <mô tả>.sql` và **giao task cho HUMAN** chạy.

---

## Các chuẩn (đọc theo thứ tự khi làm report mới)

| # | File | Tóm tắt | Ưu tiên |
|---|------|---------|:---:|
| 01 | [data-accuracy.md](./01-data-accuracy.md) | Số liệu đúng nghiệp vụ — grain, dedup, null, làm tròn, biên ngày | 🔴 P0 |
| 02 | [metric-definitions.md](./02-metric-definitions.md) | Định nghĩa 1 metric không mơ hồ + registry công thức | 🔴 P0 |
| 03 | [query-performance.md](./03-query-performance.md) | Chuẩn Prisma/SQL readonly + hiệu năng, phân trang, EXPLAIN | 🟠 P1 |
| 04 | [report-api.md](./04-report-api.md) | Contract endpoint report: envelope, params, lỗi, đặt tên | 🟠 P1 |
| 05 | [report-ui-ux.md](./05-report-ui-ux.md) | Bảng, filter, trạng thái loading/empty/error, biểu đồ, a11y | 🟠 P1 |
| 06 | [formatting-localization.md](./06-formatting-localization.md) | Format số / VND / ngày / % / null theo vi-VN | 🟠 P1 |
| 07 | [security-privacy.md](./07-security-privacy.md) | PII trong report, phân quyền ai xem gì, không rò rỉ | 🟠 P1 |
| 08 | [verification.md](./08-verification.md) | Đối soát trước khi tin số + chống hồi quy (regression) | 🔴 P0 |

**Mẫu điền sẵn** trong [`_templates/`](./_templates/):
- [metric-definition.template.md](./_templates/metric-definition.template.md) — khai báo 1 metric.
- [report-qa-checklist.template.md](./_templates/report-qa-checklist.template.md) — checklist QA cho mỗi report.

---

## Definition of Done — một report chỉ "xong" khi đủ hết mục dưới

> Copy khối này vào PR / task khi hoàn thành report. Không tick đủ = chưa xong.

**Spec & nghĩa nghiệp vụ**
- [ ] Có file spec theo `docs/reports/_TEMPLATE.md`, mọi cột & con số có định nghĩa rõ.
- [ ] Mọi metric dùng đã có trong registry [02](./02-metric-definitions.md) (hoặc được thêm vào).
- [ ] Không còn `❓` nào ảnh hưởng con số (timezone, soft-delete, status enum đã chốt).

**Số liệu đúng ([01](./01-data-accuracy.md) + [08](./08-verification.md))**
- [ ] Đối soát 1 lát nhỏ đã biết bằng SQL độc lập → **khớp**.
- [ ] So với ≥1 golden number của CoShare → **khớp** (hoặc giải thích được chênh lệch).
- [ ] Grain rõ ràng; đã kiểm dedup / fan-out do JOIN; null & zero xử lý đúng; làm tròn đúng chỗ.
- [ ] Biên ngày + timezone đúng múi giờ nghiệp vụ.

**Kỹ thuật ([03](./03-query-performance.md) + [04](./04-report-api.md))**
- [ ] Query **readonly**; có `limit`/phân trang; `EXPLAIN` nếu bảng lớn.
- [ ] Endpoint đúng contract (envelope, params, mã lỗi, đặt tên) và sau `JwtAuthGuard`.

**Trình bày ([05](./05-report-ui-ux.md) + [06](./06-formatting-localization.md))**
- [ ] Có đủ trạng thái loading / empty / error; số & tiền & ngày format theo vi-VN.
- [ ] Mọi phần tử tương tác có `data-testid`; bảng đọc được bằng bàn phím & screen reader.

**An toàn ([07](./07-security-privacy.md))**
- [ ] Đúng người mới xem được report; không rò rỉ PII ngoài phạm vi; không PII trong URL/log.

**Ghi vết**
- [ ] Golden numbers & quyết định nghiệp vụ đã cập nhật vào `docs/`.
- [ ] Mọi SQL phụ (view/reconcile) đã lưu ở `sql-scripts/` đúng định dạng tên.

---

## Ghi chú cho HUMAN review

Các điểm cần bạn xác nhận khi review bộ chuẩn này (đánh dấu `❓` trong từng file):
- Múi giờ nghiệp vụ chuẩn, quy ước soft-delete, danh sách status enum.
- Ngưỡng hiệu năng (timeout query, page size tối đa) — mình đề xuất mặc định, chỉnh nếu cần.
- Quy tắc phân quyền theo report (ai xem được gì) — hiện mọi report chỉ chung 1 `JwtAuthGuard`.
