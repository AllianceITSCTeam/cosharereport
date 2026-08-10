# QA Checklist — Report: <TÊN REPORT> (`<slug>`)

> Copy thành `docs/reports/<slug>.qa.md` (hoặc dán vào PR) khi review một report.
> Gate: **chưa tick đủ P0 thì chưa được phát hành.** Tham chiếu `standards/`.

- **Người làm:** ___  · **Người review (HUMAN):** ___  · **Ngày:** yyyy-MM-dd
- **Spec:** `docs/reports/<slug>.md`  · **Endpoint:** `GET /api/reports/<slug>`

---

## 🔴 P0 — Số liệu đúng (bắt buộc)

**Data accuracy — [standards/01](../01-data-accuracy.md)**
- [ ] Grain mỗi dòng khai báo rõ trong spec.
- [ ] Đã kiểm fan-out do JOIN; `SUM/COUNT` đúng grain (DISTINCT/subquery khi cần).
- [ ] null vs 0 vs rỗng xử lý & hiển thị đúng; `COALESCE` đúng chỗ.
- [ ] 3 bộ lọc soft-delete / status / thời gian ghi rõ, khớp registry metric.
- [ ] Timezone & biên ngày đúng; test mốc 00:00 và 23:59:59.
- [ ] Làm tròn chỉ ở hiển thị; tiền tính trên gốc/Decimal; chặn chia 0.

**Metric — [standards/02](../02-metric-definitions.md)**
- [ ] Mọi metric có trong registry theo slug; không định nghĩa lại tại chỗ.
- [ ] Không còn `❓` chặn con số (hoặc đã ghi rõ giả định + ảnh hưởng).

**Verification — [standards/08](../08-verification.md)**
- [ ] Tầng A: đối soát ≥1 lát nhỏ bằng query độc lập → khớp (query ở `sql-scripts/`).
- [ ] Tầng B: so ≥1 golden number CoShare → khớp / giải thích được.
- [ ] Tầng C: ≥1 bất biến (tổng nhóm = tổng tổng) đúng.
- [ ] Edge cases chạy thử: rỗng / biên ngày / null / phân trang / input sai.
- [ ] Có snapshot regression trên khoảng thời gian đã đóng.

---

## 🟠 P1 — Kỹ thuật, trình bày, an toàn

**Query & Performance — [standards/03](../03-query-performance.md)**
- [ ] Readonly hoàn toàn (kể cả `$queryRaw`); aggregate/filter đẩy xuống DB.
- [ ] Có phân trang + `total`; `pageSize` có trần; `EXPLAIN` nếu bảng lớn; có `limit`.
- [ ] Không N+1; `$queryRaw` tham số hoá; index/view cần thì giao HUMAN qua `sql-scripts/`.

**API — [standards/04](../04-report-api.md)**
- [ ] Payload thô để interceptor bọc `{success,data,durationMs}`; `data` đúng hình dạng chuẩn.
- [ ] Query params theo tên chuẩn, validate DTO, `sort/filter` whitelist.
- [ ] Endpoint sau `JwtAuthGuard` (+`@Roles` nếu giới hạn); mã lỗi đúng; message không lộ SQL.

**UI/UX — [standards/05](../05-report-ui-ux.md)**
- [ ] Đủ 4 trạng thái loading/empty/error/success; không lộ stack trace.
- [ ] Bảng: số căn phải + tabular, header có đơn vị, hàng tổng nổi bật, sort rõ.
- [ ] Filter ngày mặc định hợp lý + hiện timezone; `null → —`; không chỉ dựa vào màu.
- [ ] Mọi phần tử tương tác có `data-testid`; bảng ngữ nghĩa; tương phản AA; dùng được bàn phím.

**Formatting — [standards/06](../06-formatting-localization.md)**
- [ ] Format qua helper chung; số/tiền `vi-VN` (VND 0 thập phân, ₫); ngày `dd/MM/yyyy` theo tz.
- [ ] `null → —`, chia 0 → `—`; `%` cố định thập phân; CSV UTF-8 BOM (nếu có xuất).

**Security & Privacy — [standards/07](../07-security-privacy.md)**
- [ ] Đúng người mới xem được (kiểm quyền ở backend); row-level filter theo `sub` nếu cần.
- [ ] Chỉ `select` cột cần; PII mask khi đủ; không PII trong URL/log; lỗi không lộ nội bộ.

---

## Ghi vết
- [ ] Golden numbers & quyết định nghiệp vụ đã cập nhật vào `docs/`.
- [ ] SQL phụ (reconcile/view) đã lưu `sql-scripts/` đúng định dạng tên.

## `❓` còn mở gửi CoShare
| Câu hỏi | Ảnh hưởng số liệu | Trạng thái |
|---|---|---|
| _..._ | _..._ | ☐ chờ trả lời |
