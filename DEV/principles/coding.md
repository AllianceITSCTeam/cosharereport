# Coding Principles

## Naming Conventions

### Files & Folders

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| React component | `PascalCase.tsx` | `EmployeeList.tsx` |
| React page | `PascalCase.tsx` trong `pages/` | `AttendancePage.tsx` |
| Custom hook | `camelCase.ts`, prefix `use` | `useAttendance.ts` |
| Utility / helper | `camelCase.ts` | `formatDate.ts` |
| Constant file | `camelCase.ts` | `apiRoutes.ts` |
| Type / interface file | `camelCase.ts` | `employee.types.ts` |
| NestJS module file | `kebab-case.suffix.ts` | `employee.service.ts`, `employee.controller.ts` |
| DTO | `kebab-case.dto.ts` | `create-employee.dto.ts` |
| Entity (ORM) | `kebab-case.entity.ts` | `staff.entity.ts` |
| Migration | `timestamp_snake_description.ts` | `1714000000000_create_staff_table.ts` |
| Test file | same name + `.spec.ts` / `.test.ts` | `employee.service.spec.ts` |
| Folder | `kebab-case` | `time-tracking/`, `business-client/` |

---

### Variables & Functions

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Variable | `camelCase` | `staffList`, `currentStatus` |
| Function | `camelCase`, động từ đầu | `getEmployee()`, `updateStatus()` |
| Boolean variable | prefix `is`, `has`, `can`, `should` | `isLoading`, `hasPermission`, `canEdit` |
| Event handler (React) | prefix `handle` | `handleSubmit`, `handleStatusChange` |
| Constant (runtime) | `camelCase` | `defaultPageSize` |
| Constant (compile-time, global) | `UPPER_SNAKE_CASE` | `MAX_BREAK_SECONDS`, `API_BASE_URL` |
| Enum value | `UPPER_SNAKE_CASE` | `UserRole.HR_ADMIN`, `StatusScope.TEAM` |

---

### Classes & Types

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Class | `PascalCase` | `EmployeeService`, `AttendanceController` |
| Interface | `PascalCase`, prefix `I` | `IStaff`, `ITimeTracking` |
| Type alias | `PascalCase`, suffix `Type` nếu cần phân biệt | `StatusPriorityType` |
| Enum | `PascalCase` | `UserRole`, `StatusScope` |
| DTO class | `PascalCase` + suffix `Dto` | `CreateStaffDto`, `UpdateStatusDto` |
| NestJS Service | `PascalCase` + suffix `Service` | `StaffService` |
| NestJS Controller | `PascalCase` + suffix `Controller` | `AttendanceController` |
| NestJS Module | `PascalCase` + suffix `Module` | `AuthModule` |
| React component | `PascalCase` | `StatusPicker`, `BreakCountdown` |

---

### Database

| Loại | Convention | Ví dụ |
|------|-----------|-------|
| Table name | `PascalCase` | `Staff`, `TimeTracking`, `BusinessClient` |
| Column name | `PascalCase` | `FirstName`, `Log_CreatedAt`, `IsDeleted` |
| Foreign key column | entity name + `Id` | `StaffId`, `ClientId`, `StatusId` |
| Junction table | entity A + entity B | `ClientStaff`, `StaffRole` |
| Index name | `idx_table_column` | `idx_staff_companyid` |

---

### UI Testability

Every interactive element and layout region MUST carry a `data-testid` attribute so Playwright can identify it without relying on CSS classes or text content.

See full convention in [ui-ux.md](./ui-ux.md) § 1 — Testability.

---

### Safe Array Extraction (MANDATORY)

**NEVER** use `value ?? []` or `value?.data ?? []` to extract arrays from API responses.
`??` only guards `null`/`undefined` — a truthy non-array object passes through and crashes `.map()`/`.find()`/`.filter()`.

**ALWAYS** use `safeArray()` from `@/lib/safeArray`:

```ts
import { safeArray } from '@/lib/safeArray';

// ✅ correct
const rows    = safeArray(queryResult?.data);   // paginated response
const items   = safeArray(rawValue);            // direct array response
const typed   = safeArray<MyType>(rawValue);    // with explicit generic

// ❌ wrong — crashes when API returns an object
const rows    = queryResult?.data ?? [];
const items   = queryResult?.data || [];
const typed   = Array.isArray(x) ? x : [];     // verbose, use safeArray instead
```

**Placement rule — see `api.md` for the full table:**
- API function returning `T[]` directly → call `safeArray()` **inside** the API function
- API function returning `IListResponse<T>` (paginated) → call `safeArray()` at the **consumption site** (component or hook) when iterating `.data`

---

### Build Version Visibility (MANDATORY)

Every deployment MUST expose build timestamps so the team can instantly verify which version is running.

**Frontend (Vite)**
- `vite.config.ts` MUST inject `__BUILD_TIME__` via `define` using `new Date().toISOString()` when `command === 'build'`, `'dev'` otherwise
- `src/vite-env.d.ts` MUST declare `const __BUILD_TIME__: string`
- The sidebar footer MUST display `FE: <build time>` and `BE: <startedAt> (<commit>)`

**Backend (NestJS)**
- `GET /api/health` MUST return `startedAt` (server process start time, captured as module-level const) and `commit` (`RAILWAY_GIT_COMMIT_SHA.slice(0, 7)` or `'local'`)
- Never hardcode version strings — derive from environment and process startup

**Why:** eliminates "is it deployed yet?" guessing by giving a timestamp anyone can compare against the Railway deploy log.

---

### API Endpoints

- Luôn dùng `kebab-case` cho URL path: `/api/time-tracking`, `/api/business-clients`
- Resource theo số nhiều: `/employees`, `/clients`, `/statuses`
- Nested resource: `/clients/:clientId/employees`
- Action không phải CRUD dùng verb rõ ràng: `POST /employees/:id/reset-password`, `POST /attendance/logout`
