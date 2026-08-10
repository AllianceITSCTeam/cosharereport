# Proposed Rules — Discussion Draft
> Ngày tạo: 2026-04-09 | Tác giả: Copilot review
> 
> Mỗi rule có status: **[PROPOSE]** = đề xuất mới, **[CONFLICT]** = mâu thuẫn cần thống nhất, **[GAP]** = thiếu coverage.

---

## 🔴 CONFLICT — Cần thống nhất ngay

### C01 — `safeArray()` vs `?? []` cho mảng từ API ✅ RESOLVED

**Quyết định:** Dùng `safeArray()` là chuẩn duy nhất. `?? []` bị xóa khỏi `api.md`.

**Đã thực hiện (2026-04-09):**
- `api.md` — rewrite toàn bộ, nêu rõ placement rule (API function cho direct array, consumption site cho paginated)
- `coding.md` — cập nhật placement rule cho nhất quán với `api.md`
- `RolesPage.tsx` — `roles ?? []` → `safeArray(roles)` + thêm import
- `EmployeeDetailPage.tsx` — `rolesData ?? []` → `safeArray(rolesData)` + thêm import
- `AddEmployeePage.tsx` — `rolesData ?? []` → `safeArray(rolesData)` + thêm import
- `ImportEmployeePage.tsx` — `valid ?? []`, `invalid ?? []` → `safeArray(...)` + thêm import

**Single source of truth:** `apps/web/src/lib/safeArray.ts` — có bug thì sửa 1 chỗ là xong.

---

### C02 — `PaginationParams` type đang sống trong `company.service.ts`

**Vấn đề:** `department.controller.ts` import `PaginationParams` từ `../company/company.service`. Đây là cross-module dependency vào implementation của feature khác — nguy hiểm.

**Phân tích:**
```ts
// department.controller.ts — SAI
import { PaginationParams } from '../company/company.service';
```

Nếu `company.service.ts` thay đổi, `department.controller.ts` bị broken. Type dùng chung phải ở `common/`.

**Đề xuất:** Move `PaginationParams` sang `apps/api/src/common/types/pagination.types.ts`.

**Kết luận chờ thống nhất:** ☐

---

## 🟡 GAP — Các file principles đang trống/thiếu

### G01 — `security.md` hoàn toàn trống

Codebase đang dùng nhiều pattern security quan trọng nhưng không được document:

**Đề xuất thêm vào `security.md`:**

1. **JWT phải lưu trong httpOnly cookie** — tuyệt đối không dùng `localStorage` hay cookie thường
2. **Mật khẩu phải hash bằng `bcryptjs`** — không dùng MD5/SHA trực tiếp
3. **Mọi write endpoint (POST/PUT/DELETE) phải có `@UseGuards(RolesGuard)` + `@Roles(...)`** — guard phải explicit, không assume từ module-level guard
4. **Auth endpoints phải có ThrottlerGuard** — rate-limit login/OTP để chống brute-force
5. **Input validation phải dùng class-validator DTO** — không validate thủ công trong service
6. **`@CurrentUser()` trả về từ JWT payload (server-signed)** — không tin client-sent user ID trong body
7. **Khi log error, không log JWT token, password, hay cookie value**

**Kết luận chờ thống nhất:** ☐

---

### G02 — `git.md` hoàn toàn trống

**Đề xuất thêm vào `git.md`:**

1. **Branch naming:**
   - `feature/<kebab-name>` — tính năng mới
   - `fix/<kebab-name>` — bug fix
   - `chore/<kebab-name>` — tooling, deps, config
   - `docs/<kebab-name>` — chỉ tài liệu

2. **Commit message format (Conventional Commits):**
   ```
   feat(scope): mô tả ngắn gọn
   fix(scope): mô tả ngắn gọn
   chore(scope): mô tả ngắn gọn
   ```
   Ví dụ: `feat(department): add pagination to findAll`, `fix(attendance): guard null staff on team view`

3. **Commit scope = tên module** — `auth`, `attendance`, `employee`, `department`, v.v.

4. **Không push thẳng lên `main`** — luôn qua `dev` → PR → review

5. **BUG-LOG entry phải được commit cùng bug fix** — không tách commit

**Kết luận chờ thống nhất:** ☐

---

## 🟢 PROPOSE — Rules mới từ thực tế codebase

### P01 — Logger bắt buộc cho service phức tạp

**Vấn đề:** `attendance.service.ts` có `Logger` với timing, `department.service.ts` thì không có.

**Đề xuất rule:**
- Service nào có thao tác async (DB, external call) phải khai báo `private readonly logger = new Logger(ClassName.name)`
- Log timing cho operation phức tạp (>2 DB calls): `this.logger.log(\`[methodName] ms=\${Date.now() - t0}\`)`
- Service đơn giản (CRUD 1 table) có thể bỏ qua

**Kết luận chờ thống nhất:** ☐

---

### P02 — Error code registry (Structured Error Codes)

**Vấn đề:** `attendance.service.ts` dùng `{ code: 'E201', message: '...' }` nhưng không có registry hay convention.

**Đề xuất:**
```
E1xx — Authentication/Authorization
  E101: Unauthorized (hết session, chưa login)
  E102: Forbidden (không đủ role)
  E103: First login password change required

E2xx — Business rule violations  
  E201: Status not in allowed scope
  E202: Break duration exceeded (cần điền note)
  E203: Cannot logout without mood icon

E4xx — Data / input errors
  E401: Entity not found
  E402: Duplicate (code/name đã tồn tại)
  E403: Dependency conflict (xóa nhưng có data liên quan)
```

**Nơi lưu registry:** `apps/api/src/common/constants/error-codes.ts`

**Kết luận chờ thống nhất:** ☐

---

### P03 — Soft-delete relation null-guard là bắt buộc

**Vấn đề:** BUG-002 — Prisma middleware tự filter `isDeleted=true` ra khỏi `include`, khiến relation trở thành `null` thay vì object.

**Rule:**
```ts
// ❌ SAI — record.staff có thể null nếu staff bị soft-delete
record.staff.firstName

// ✅ ĐÚNG — luôn optional chain khi access relation
record.staff?.firstName ?? '(deleted)'
```

**Áp dụng cho:** mọi `include` relation trong response xử lý ở FE (component) và trong service khi aggregate data.

**Kết luận chờ thống nhất:** ☐

---

### P04 — Mutation error handling: try/catch + toast trong handler (không dùng `onError`)

**Vấn đề:** pattern hiện tại trong codebase là try/catch trong handler function. Nếu ai đó dùng `onError` callback của useMutation, sẽ có 2 nơi xử lý lỗi, gây trùng toast.

**Rule:**
```ts
// ✅ Pattern chuẩn — xử lý lỗi trong handler
async function handleDelete(row: IDepartment) {
  try {
    await deleteMutation.mutateAsync(row.id);
    toast({ title: 'Deleted successfully' });
  } catch (err: unknown) {
    toast({ title: 'Error', description: getApiErrorMessage(err), variant: 'destructive' });
  }
}

// ❌ Không dùng onError trong useMutation definition
const deleteMutation = useMutation({
  mutationFn: ...,
  onError: (err) => toast(...),  // không làm thế này
});
```

**Lý do:** `mutateAsync` throw error khi fail → try/catch trong handler là điểm control duy nhất. `onError` + try/catch cùng lúc = toast hiện 2 lần.

**Kết luận chờ thống nhất:** ☐

---

### P05 — `@CurrentUser()` fallback `'system'` là mùi code xấu

**Vấn đề:** `user?.sub ?? 'system'` trong controller — nếu auth guard đang hoạt động đúng, `user` không bao giờ null. Nếu `user` null, là bug trong guard, không nên silently fallback về `'system'`.

**Rule:**
```ts
// ❌ Hiện tại — mask auth guard failure
create(@CurrentUser() user: CurrentUserPayload) {
  return this.service.create(dto, user?.sub ?? 'system');
}

// ✅ Đề xuất — để lỗi hiện rõ
create(@CurrentUser() user: CurrentUserPayload) {
  return this.service.create(dto, user.sub); // nếu user null → runtime error rõ ràng
}
```

**Ngoại lệ:** nếu endpoint cho phép anonymous access có chủ đích, dùng comment giải thích.

**Kết luận chờ thống nhất:** ☐

---

### P06 — Prisma model mới không có `isDeleted` phải đăng ký vào `MODELS_WITHOUT_SOFT_DELETE`

**Vấn đề:** `prisma.service.ts` có hard-coded list `MODELS_WITHOUT_SOFT_DELETE`. Nếu tạo model mới không có `isDeleted` mà quên add vào list, Prisma sẽ throw error runtime.

**Rule:**
> Khi thêm Prisma model mới **không có** cột `isDeleted`, BẮT BUỘC add tên model vào `MODELS_WITHOUT_SOFT_DELETE` set trong `prisma.service.ts` ngay trong cùng commit tạo migration.

**Kết luận chờ thống nhất:** ☐

---

### P07 — Query key constants phải được export từ hook file

**Pattern hiện tại:**
```ts
// useDepartment.ts
const DEPARTMENTS_KEY = 'departments'; // private constant
```

**Vấn đề:** Khi component khác cần invalidate query của department, không có cách import key.

**Đề xuất:**
```ts
// ✅ Export key để reuse
export const DEPARTMENTS_QUERY_KEY = 'departments';
```

**Kết luận chờ thống nhất:** ☐

---

### P08 — Form validation: Zod schema + react-hook-form là bộ chuẩn duy nhất

**Pattern đang dùng nhất quán trong codebase:**
```ts
const schema = z.object({ ... });
type FormValues = z.infer<typeof schema>;
useForm<FormValues>({ resolver: zodResolver(schema) });
```

**Rule:** Bất kỳ form nào (create/edit/filter) đều phải dùng Zod + react-hook-form. Không dùng `useState` để track từng field, không validate thủ công trong submit handler.

**Kết luận chờ thống nhất:** ☐

---

## 📊 Tóm tắt — Ưu tiên xử lý

| ID | Loại | Tóm tắt | Mức độ |
|----|------|---------|--------|
| C01 | CONFLICT | safeArray vs `?? []` | 🔴 Critical — đã có bug |
| C02 | CONFLICT | PaginationParams phải ở common/ | 🟡 High |
| G01 | GAP | security.md trống | 🔴 Critical |
| G02 | GAP | git.md trống | 🟡 High |
| P01 | PROPOSE | Logger bắt buộc cho service phức tạp | 🟢 Medium |
| P02 | PROPOSE | Error code registry | 🟢 Medium |
| P03 | PROPOSE | Soft-delete null-guard | 🟡 High — đã có bug |
| P04 | PROPOSE | Mutation error: try/catch trong handler | 🟡 High |
| P05 | PROPOSE | Bỏ fallback `'system'` trong @CurrentUser | 🟢 Medium |
| P06 | PROPOSE | Đăng ký model không có isDeleted | 🟡 High |
| P07 | PROPOSE | Export query key constant | 🟢 Low |
| P08 | PROPOSE | Zod + react-hook-form là form standard | 🟢 Medium |
