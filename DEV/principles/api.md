# API Design Principles

## Date range filter — timezone rule

**Rule:** Every API endpoint that accepts a date range filter (`startDate` / `endDate`) **must** also accept `clientTimezone` (IANA timezone string, e.g. `Asia/Ho_Chi_Minh`). The server converts the client's local dates to UTC before querying.

**Why:** Dates stored in the DB are UTC. A user in UTC+7 selecting "April 9" expects records from April 9 00:00–23:59 in their local timezone. Without timezone info, the server treats the dates as UTC, shifting the window by the UTC offset and returning data from the wrong day.

**Contract:**
- Client always sends: `clientTimezone=Asia/Ho_Chi_Minh` (or whatever `Intl.DateTimeFormat().resolvedOptions().timeZone` returns)
- Server interprets: `startDate=YYYY-MM-DD` → `YYYY-MM-DDT00:00:00` in that timezone → converted to UTC
- Server interprets: `endDate=YYYY-MM-DD` → `YYYY-MM-DDT23:59:59.999` in that timezone → converted to UTC
- If `clientTimezone` is absent or invalid, server falls back to treating dates as UTC

**Utility:** `toUtcDateRange(startDate, endDate, clientTimezone?)` in `apps/api/src/common/utils/date-range.ts`

```ts
// ❌ Wrong — treats "2026-04-09" as UTC midnight
dateFilter.gte = new Date('2026-04-09T00:00:00.000Z');

// ✅ Correct — converts April 9 in client timezone to UTC
const { gte, lte } = toUtcDateRange('2026-04-09', '2026-04-09', 'Asia/Ho_Chi_Minh');
// gte = 2026-04-08T17:00:00.000Z, lte = 2026-04-09T16:59:59.999Z
```

## Null-safety for array responses

**Rule:** `safeArray()` is the single standard for extracting arrays from API responses.
Never use `?? []` or `|| []` to extract arrays — `??` only guards `null`/`undefined`; a truthy non-array object passes through and crashes `.map()`/`.find()`/`.filter()`.

`safeArray()` is defined in `apps/web/src/lib/safeArray.ts` — if it has a bug, fix it there and every callsite is fixed automatically.

```ts
// ❌ Wrong — crashes when API returns {} object instead of null
return res.data.data ?? [];

// ✅ Correct
import { safeArray } from '@/lib/safeArray';
return safeArray(res.data.data);
```

### Where to call `safeArray()`

| Response type | Where to call |
|---------------|---------------|
| Direct array (`T[]`) | **Inside the API function** — `return safeArray(res.data.data)` so callers always receive `T[]` |
| Paginated (`IListResponse<T>`) | **At consumption site** (component or hook) — `safeArray(query.data?.data)` when iterating |

```ts
// ── Direct array endpoint ─────────────────────────────────
// system.api.ts
export async function getRoles(): Promise<ISystemRole[]> {
  const res = await apiClient.get('/system/roles');
  return safeArray(res.data.data);       // ✅ API function returns clean T[]
}

// ── Paginated endpoint ────────────────────────────────────
// org.api.ts — uses wrapList(), returns IListResponse<T> as-is
export async function getDepartments(params?): Promise<IListResponse<IDepartment>> {
  return wrapList(apiClient.get('/departments', { params }));
}
// Component/hook — safeArray guards .data when iterating
const rows = safeArray(query.data?.data);  // ✅ consumption site
```

