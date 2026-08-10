# 07 — Security & Privacy 🟠 P1

> Bổ sung cho `principles/security.md` (chung) — phần **đặc thù report đọc DB thật của CoShare**.
> App này chạm dữ liệu người dùng thật; rò rỉ = sự cố với đối tác, không chỉ bug.

---

## 1. READONLY là ranh giới an toàn số 1

- Đã nêu ở [README](./README.md) & [03](./03-query-performance.md): **chỉ đọc**, mọi ghi bị cấm.
- Middleware `prisma.service.ts` chặn ghi = phòng vệ cuối; DB role readonly = phòng vệ chính. **Không tự ý** dùng connection khác/role khác để lách.

## 2. Xác thực & phiên

- Vào qua **one-way SSO**: token CoShare trên URL → `GET /sso` verify (`COSHARE_JWT_SECRET`) → mint session JWT của app (`SESSION_JWT_SECRET`) trong cookie **httpOnly**.
- **MUST:** mọi endpoint report sau `JwtAuthGuard`. Không có report public.
- **MUST:** token/`❓` claim chưa chốt (format, thuật toán, TTL, single-use) → xem `auth.types.ts`; **không nới lỏng** verify để "cho chạy". Thà chặn còn hơn cho qua nhầm.
- Token CoShare **không** được log, không đẩy sang FE store, không nhét lại vào URL sau khi verify.

## 3. Phân quyền theo report (ai xem được gì)

**MUST:**
- Xác định **đối tượng xem** cho từng report trong spec (`docs/reports/_TEMPLATE.md` §1). Không phải mọi user thấy mọi report.
- Nếu report giới hạn theo `role` → thêm `@Roles(...)` + RolesGuard; kiểm quyền ở **backend**, không chỉ ẩn nút ở FE.
- ⚠️ Nếu report chỉ nên xem dữ liệu **của chính user** (row-level) → filter theo `sub` từ session **ở query**, không tin id gửi từ client.
- `role` claim hiện là giả định ❓ — HUMAN chốt danh sách role & ma trận report×role.

## 4. PII — dữ liệu cá nhân

Report dễ vô tình phơi bày PII (tên, email, phone, địa chỉ, số dư, giao dịch).

**MUST:**
- Chỉ `select` **cột thật sự cần** cho report — không kéo cả bảng user "cho tiện".
- Không hiển thị PII vượt mục đích report; cân nhắc **mask** khi đủ (email `a***@x.com`, phone `09****123`).
- **Không PII trong URL** (query param bị log ở proxy/lịch sử trình duyệt) — lọc nhạy cảm qua body/param định danh, không phải tên/email.
- **Không PII trong log**: log id thay vì tên/email; không log toàn bộ row.
- Export CSV chứa PII → coi như hành động nhạy cảm: chỉ role được phép, và cân nhắc ghi vết ai xuất (nếu policy CoShare yêu cầu).

## 5. Không rò rỉ qua thông báo lỗi

**MUST:**
- Lỗi trả client: message chung + `code` ([04](./04-report-api.md) §5). **Không** đưa SQL, tên bảng/cột, stack trace, connection string ra client.
- Chi tiết lỗi chỉ ở log server. Kiểm `HttpExceptionFilter` không lộ internal.

## 6. Injection & input

- `$queryRaw` **luôn** tham số hoá (tagged template) — [03](./03-query-performance.md) §5.
- `sort`/`filter`/tên cột từ client → **whitelist**, không nội suy trực tiếp vào SQL/Prisma orderBy.
- `search` → dùng Prisma `contains` (đã escape), không ghép vào raw.

## 7. Bí mật & môi trường

- Bí mật (`DATABASE_URL`, `*_JWT_SECRET`) chỉ trong env, **không commit**; xem `.env.example`.
- Không in secret ra log/response, kể cả khi debug. Không đưa `DATABASE_URL` vào thông báo lỗi.
- CORS/cookie: cookie session `httpOnly`, `secure` ở production, `sameSite` phù hợp.

## 8. Caching & rò rỉ chéo người dùng

- Cache report ([03](./03-query-performance.md) §7) phải **gắn khoá theo phạm vi quyền** — không để user A nhận cache dữ liệu của user B / role khác.

---

## Checklist Security & Privacy

- [ ] Query readonly; không lách role/connection.
- [ ] Endpoint sau `JwtAuthGuard`; report giới hạn có `@Roles` kiểm ở backend.
- [ ] Row-level (nếu có) filter theo `sub` từ session, không tin id client.
- [ ] Chỉ `select` cột cần; PII được mask khi đủ; không PII trong URL/log.
- [ ] Lỗi trả client không lộ SQL/tên bảng/stack/secret.
- [ ] `$queryRaw` tham số hoá; `sort/filter` whitelist; `search` escape.
- [ ] Secret chỉ trong env; cookie session httpOnly/secure; cache gắn khoá theo quyền.

> **Why:** đây là app cắm thẳng vào DB người dùng thật của một đối tác. Một rò rỉ PII hoặc một lệnh
> ghi lọt qua là sự cố niềm tin ở mức hợp tác, không sửa bằng hotfix được.
