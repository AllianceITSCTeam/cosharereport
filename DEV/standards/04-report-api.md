# 04 — Report API Contract 🟠 P1

> Bổ sung cho `principles/api.md` (chung) — đây là phần **đặc thù cho endpoint report**.
> Mục tiêu: mọi report có cùng một hình dạng request/response để FE tái dùng và test dễ.

---

## 1. Envelope — không đổi

Toàn app đã có `ResponseInterceptor` bọc mọi response:

```jsonc
// thành công
{ "success": true, "data": <payload>, "durationMs": 123 }
// lỗi (HttpExceptionFilter)
{ "success": false, "message": "...", "code": "...", "errors": [] }
```

**MUST:** report **không tự bọc lại** envelope — chỉ `return` payload thô, interceptor lo phần vỏ.

## 2. Hình dạng `data`

| Loại report | `data` | Ghi chú |
|---|---|---|
| Một danh sách | `{ items: T[], total, page, pageSize }` | luôn phân trang ([03](./03-query-performance.md) §3) |
| Chuỗi thời gian | `{ series: Array<{ day, value }> }` | mỗi điểm 1 mốc, đã điền ngày trống nếu cần |
| Thẻ tổng (KPI) | `{ <slug>: number, ... }` | key = slug metric ([02](./02-metric-definitions.md)) |
| Bảng nhóm | `{ groups: Array<{ key, ...metrics }>, totals }` | kèm dòng tổng để cross-check |

**MUST:** tên field số dùng **slug metric** trong registry [02](./02-metric-definitions.md) — FE và BE gọi cùng tên.

## 3. Query params — chuẩn hoá

**MUST** dùng tên & kiểu thống nhất, validate qua DTO + `ValidationPipe`:

| Param | Kiểu | Mặc định | Ghi chú |
|---|---|---|---|
| `from` / `to` | ISO date `YYYY-MM-DD` | (bắt buộc với report theo kỳ) | biên ngày quy đổi theo tz nghiệp vụ ([01](./01-data-accuracy.md) §5) |
| `tz` | IANA (`Asia/Ho_Chi_Minh`) | tz nghiệp vụ mặc định | qua `normalizeTimezone()` |
| `page` | int ≥ 1 | 1 | |
| `pageSize` | int 1..100 | 20 | reject nếu vượt trần ❓ |
| `sort` | `field:asc\|desc` | tuỳ report | chỉ cho phép field trong whitelist |
| `search` | string | — | trim; escape khi vào `contains` |

- **MUST:** validate & ép kiểu — không tin query string. Ngày sai định dạng → `400` với `message` rõ.
- **MUST:** `sort`/`filter` chỉ nhận field trong **whitelist** (chống lộ cột / injection tên cột).

## 4. Đặt tên endpoint

- Base: `GET /api/reports/<report-slug>` (`kebab-case`, số nhiều khi là danh sách).
- Ví dụ theo mẫu có sẵn: `GET /api/reports/latest-users`.
- Report con / breakdown: `GET /api/reports/<slug>/by-<dimension>` (vd `/reports/commission/by-level`).
- **MUST:** tất cả sau `JwtAuthGuard`. Report giới hạn quyền → thêm `@Roles(...)` (xem [07](./07-security-privacy.md)).

## 5. Mã lỗi & trạng thái

| Tình huống | HTTP | `code` |
|---|---|---|
| Param sai/thiếu | 400 | `VALIDATION_ERROR` |
| Chưa đăng nhập / token hỏng | 401 | `UNAUTHORIZED` |
| Không đủ quyền xem report | 403 | `FORBIDDEN` |
| Report slug không tồn tại | 404 | `NOT_FOUND` |
| Query lỗi/timeout | 500/504 | `REPORT_QUERY_FAILED` |

- **MUST:** không để lộ chi tiết SQL / tên bảng trong `message` gửi client (log chi tiết ở server). Xem [07](./07-security-privacy.md).

## 6. Tính nhất quán & hợp đồng FE↔BE

- **MUST:** kiểu trả về khai báo trong `packages/shared` (hoặc interface cạnh `reports.api.ts`) để FE và BE dùng chung một định nghĩa.
- **SHOULD:** thêm ví dụ request/response mẫu vào spec report để test đối chiếu.
- `durationMs` (interceptor tự thêm) hữu ích để theo dõi report chậm — SHOULD ghi log nếu vượt ngưỡng.

---

## Checklist Report API

- [ ] Trả payload thô, để interceptor bọc envelope `{success,data,durationMs}`.
- [ ] `data` đúng hình dạng chuẩn §2; field số = slug metric registry.
- [ ] Query params theo tên chuẩn §3, validate DTO, `sort`/`filter` whitelist.
- [ ] Endpoint `GET /api/reports/<slug>` sau `JwtAuthGuard` (+`@Roles` nếu giới hạn).
- [ ] Mã lỗi đúng bảng §5; message không lộ SQL/tên bảng.
- [ ] Kiểu dữ liệu khai báo dùng chung FE↔BE.

> **Why:** contract nhất quán = mỗi report mới chỉ tốn công *logic*, không tốn công *tái phát minh
> khung request/response*; và test tự động bám được vào hình dạng ổn định.
