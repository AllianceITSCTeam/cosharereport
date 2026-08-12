# Yêu cầu tích hợp SSO — gửi team Admin.CoShare

> **Mục đích tài liệu:** liệt kê chính xác những gì **phía Admin.CoShare** cần làm để user
> đã đăng nhập `admin.coshare.vn` mở **app Báo cáo CoShare** mà **không phải đăng nhập lại**
> (auto-SSO). Các mục cần CoShare xác nhận đánh dấu ❓.
>
> **Bối cảnh:** App Báo cáo là site **standalone, chỉ đọc** DB CoShare, deploy ở domain riêng
> (không phải `*.coshare.vn`). Vì khác domain nên app **không thể tự đọc session của Admin**
> (chính sách same-origin của trình duyệt). Do đó auto-SSO **bắt buộc** Admin.CoShare chủ động
> *chuyển token sang cho app Báo cáo*.

---

## 0. Hiện trạng (phía app Báo cáo đã sẵn sàng gì)

- App đã có sẵn endpoint tiếp nhận SSO: **`GET /sso?token=<access_token>`** — verify token →
  phát session cookie httpOnly của app → điều hướng vào dashboard.
- App đã tích hợp được **login trực tiếp** bằng tài khoản CoShare qua
  `POST https://api-adm.coshare.vn/oauth2/token` (password grant) — dùng cho trường hợp user
  đăng nhập thủ công trên app Báo cáo. **Auto-SSO là phần còn thiếu và phụ thuộc CoShare.**
- Token CoShare (từ `oauth2/token`) hiện là **JWT ký HS256**, claims quan sát được:
  `sub`, `role`, `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name`, `exp`, `iss`, `aud`.

---

## 1. Cơ chế đề xuất: redirect kèm token

Khi user bấm vào mục "Báo cáo" trong Admin.CoShare, Admin điều hướng trình duyệt sang:

```
https://<report-app-domain>/sso?token=<access_token hiện có của phiên Admin>
```

App Báo cáo nhận token, xác thực, tạo phiên riêng và đưa user vào thẳng — không hỏi login.

> `<report-app-domain>` sẽ được cung cấp sau khi chốt hạ tầng deploy.

---

## 2. Việc CoShare cần làm

### 2.1. Thêm điểm vào (entry point) từ Admin
- [ ] Thêm **link/nút/menu** trong Admin.CoShare mở URL `/sso?token=...` như mục 1.
- [ ] ❓ Xác nhận **cách truyền token**: query param `?token=` (đơn giản nhất) hay cơ chế khác.
      Lưu ý: token trên URL **bị lộ** qua lịch sử trình duyệt, header `Referer`, log server →
      **khuyến nghị** dùng **token TTL ngắn** riêng cho SSO, hoặc **one-time exchange code**
      (app đổi code → token ở backend, code chỉ dùng 1 lần).

### 2.2. Cho phép app Báo cáo XÁC THỰC token (bắt buộc chọn 1)

Vì token đến qua trình duyệt (kênh **không tin cậy**), app **phải verify** trước khi tin. Chọn 1:

| Phương án | CoShare cung cấp | Ưu | Nhược |
|-----------|------------------|-----|-------|
| **(a) Chia secret HS256** | Secret dùng ký `access_token` | Đơn giản, verify offline | Phải chia secret bí mật; xoay vòng (rotate) phải phối hợp; không thu hồi được token lẻ |
| **(b) Endpoint introspection / userinfo** ⭐ | 1 API `GET /oauth2/userinfo` (hoặc `/introspect`) nhận `Authorization: Bearer <token>`, trả 200 + claims nếu token hợp lệ | Không cần chia secret; **thu hồi được**; chuẩn OAuth2 | App phải gọi thêm 1 request mỗi lần SSO |
| **(c) OIDC / JWKS** | Chuyển token sang **RS256** + publish `/.well-known/openid-configuration` và `jwks_uri` | Chuẩn công nghiệp, verify bằng public key | Thay đổi lớn phía CoShare |

- [ ] ❓ CoShare chọn phương án: **(a) / (b) / (c)** — *app Báo cáo khuyến nghị (b)*.

### 2.3. Chốt hợp đồng claims (dữ liệu trong token)
App cần map các trường sau vào phiên. Xác nhận trường nào **ổn định, được đảm bảo**:
- [ ] `sub` — id user (hiện = `user_id`, vd `"1"`).
- [ ] Claim tên user: `http://schemas.xmlsoap.org/ws/2005/05/identity/claims/name` (vd `admin.alliance`).
      ❓ Có claim `name`/`email` "sạch" hơn không, hay app lấy từ body response?
- [ ] `role` — vai trò (hiện thấy `"user"`). ❓ Tập giá trị role đầy đủ? Dùng để phân quyền report.
- [ ] `exp` — thời hạn token. ❓ TTL thực tế bao lâu? (token quan sát được có `exp` ~ năm 2027 — dài bất thường).
- [ ] `user_type` (vd `"admin;renter"`) — ❓ ý nghĩa, có dùng để phân quyền không.

### 2.4. Các điểm vận hành / bảo mật cần xác nhận
- [ ] ❓ **2FA**: response login có cờ `fa2_needverify` / `fa2_needenable`. Khi user bật 2FA thì
      luồng SSO xử lý ra sao? (App hiện chưa xử lý 2FA.)
- [ ] ❓ **Refresh token**: response `oauth2/token` hiện **không** trả `refresh_token`. Khi token
      hết hạn, cơ chế gia hạn là gì (login lại / refresh endpoint)?
- [ ] ❓ Cấp **`app_name` / `client_id` riêng** cho app Báo cáo thay vì dùng chung `CoShareAdmin`
      — để tách quyền, tách rate-limit, và audit riêng.
- [ ] ❓ Nên tạo **tài khoản/role read-only riêng** cho app Báo cáo? (App chỉ đọc, không cần quyền ghi.)
- [ ] Xác nhận **HTTPS-only** cho toàn bộ luồng; nếu chạy OAuth **authorization code flow** thì
      **whitelist redirect URI** của app Báo cáo.

---

## 3. Checklist tổng (để CoShare tick)

- [ ] Thêm link `/sso?token=...` trong Admin (mục 2.1)
- [ ] Chốt cách truyền token + TTL/one-time code (mục 2.1)
- [ ] Chọn & cung cấp phương án verify: (a) secret / (b) introspection / (c) JWKS (mục 2.2)
- [ ] Xác nhận hợp đồng claims (mục 2.3)
- [ ] Trả lời các mục vận hành/bảo mật: 2FA, refresh, app_name riêng, HTTPS/redirect whitelist (mục 2.4)

## 4. Nhắc lại 4 câu hỏi mở (từ `CLAUDE.md`)
1. Token format: JWT hay opaque? Thuật toán ký? → *đã biết: JWT HS256 — cần secret/introspection để verify.*
2. Tên claim chính xác (mục 2.3).
3. Token transport (query vs header) + single-use / TTL ngắn (mục 2.1).
4. Danh sách report cần + ai (role nào) xem report nào — ma trận report × role.
