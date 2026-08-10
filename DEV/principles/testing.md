# Testing Principles — TDD

> **Dự án này chạy TDD.** Viết test **trước**, code sau. Với report, "test" đầu tiên là
> **phép đối soát số** (invariant + golden number), không phải "hàm trả về gì".
> Bổ trợ: `standards/08-verification.md` (đối soát số & chống hồi quy) ·
> `standards/01-data-accuracy.md` (grain / fan-out / null).

---

## Rule #0 — TDD: red → green → refactor (bắt buộc)

Mọi function/endpoint bắt đầu bằng một **test FAIL**, rồi mới viết code cho **PASS**, rồi
**refactor** khi test vẫn xanh.

```
1. RED      — viết test mô tả hành vi mong muốn → chạy → fail (chưa có code / code sai)
2. GREEN    — viết code tối thiểu cho test pass
3. REFACTOR — dọn code, test vẫn xanh
```

**Vì sao TDD cho app report:** rủi ro lớn nhất ở đây là **số sai mà trông vẫn hợp lý**. Nếu
viết query trước rồi "nhìn thấy có số là tin", ta không bao giờ biết nó đúng. Viết **golden
test trước** biến "đúng nghiệp vụ" thành điều kiện pass/fail cụ thể — golden numbers trong
`docs/db/conventions.md §5` + `docs/requirements/04-DB-Verification-Findings.md` chính là bộ
test case red/green có sẵn.

**Rule: hàm không có test → không được merge.** Nếu `*.service.ts` tồn tại mà thiếu
`*.service.spec.ts`, cảnh báo HUMAN trước khi ship (mục cuối file).

---

## Rule #1 — Không đủ data / cơ sở để test → DỪNG, hỏi HUMAN

TDD chỉ đúng khi có **cơ sở để biết số đúng là gì**. Khi thiếu, **tuyệt đối không đoán bừa** một
con số kỳ vọng cho "test xanh" — số sai được đóng dấu "đã test" còn nguy hiểm hơn không test.

**Khi nào phải dừng và yêu cầu HUMAN cung cấp:**
- Không có **golden number** / số tham chiếu để đối soát metric.
- **Định nghĩa nghiệp vụ chưa chốt** (còn `❓`): status enum, timezone, soft-delete, "người giới
  thiệu" là gì, "loại sp" phân loại theo cột nào…
- Dữ liệu **không đủ để phủ case** (vd `StatusBill` toàn = 1 → không test được nhánh
  Finished/Cancel; `MaterialCommGroupId` NULL 100% → không test được filter loại sp).
- Cần **view / index / dữ liệu mẫu** mà connection readonly không tạo được.

**Làm gì:** ghi rõ cái đang thiếu vào spec report + `docs/ROADMAP.md §❓`, **báo HUMAN** (nêu cụ
thể cần số/định nghĩa/dữ liệu gì và vì sao), và **skip test** đó có chú thích (`it.todo(...)` /
`describe.skip` + lý do) — **không** thay bằng số bịa. Xem thêm `standards/08-verification.md §4`.

---

## Hai tầng test (đã chốt cho project này)

App đọc **prod DB readonly, dữ liệu sống** → không thể hardcode golden number vào code như
chân lý vĩnh viễn (số sẽ trôi). Nên tách 2 tầng:

| Tầng | Chạy ở đâu | Đụng DB thật? | Mục tiêu | CI gate? |
|---|---|---|---|:--:|
| **A — Unit** | mọi lúc, CI | ❌ **mock Prisma** | logic, DTO validate, guard, serialize BigInt/Decimal, xử lý null | ✅ có |
| **B — Reconciliation** | tay / nightly | ✅ `$queryRaw` live | **invariants** + **golden numbers** (as-of snapshot) | ❌ không |

- **Tier A** deterministic, nhanh, không phụ thuộc dữ liệu → là cổng chặn merge.
- **Tier B** mới thật sự verify *tính đúng nghiệp vụ của SQL*, nhưng số trôi theo dữ liệu nên
  **không** chặn CI. Bật bằng ENV, ví dụ `RECON_DB=1 pnpm --filter api test -- recon`.
  Test skip sạch khi không có ENV (không làm đỏ CI).

> **Không dựng Postgres local/Docker** trong giai đoạn này (quyết định dự án). Nếu sau cần
> deterministic cho SQL trong CI → seed 1 lát dữ liệu nhỏ vào Postgres local (ghi vào ROADMAP).

### Golden numbers sống ở 1 chỗ (hoà giải với `standards/01 §8`)

`standards/01-data-accuracy.md §8` cấm "hardcode con số kỳ vọng trong code". Cách tuân thủ mà
vẫn test được: **1 module fixture** phản chiếu docs, có comment trỏ ngược nguồn — test import
từ đó, **không** rải số lẻ khắp các test.

```typescript
// apps/api/test/fixtures/commission.golden.ts  (nguồn: docs/requirements/04-... §C)
export const COMMISSION_GOLDEN = {
  snapshotDate: '2026-08-10',            // ngày verify — cập nhật có chủ đích
  totalOrders: 1218,
  totalRevenue: 160_191_779n,           // BigInt/Decimal → giữ nguyên, không Number()
  commissionRows: 2611,
  totalCommission: 13_621_482n,
  byLevel: { 1: 2_682_494n, 2: 10_936_588n, 3: 2_400n },
} as const;
```

---

## Test tiers cho 1 report (dùng ở tầng nào)

| Tier test | Ý nghĩa | Ví dụ | Tầng |
|---|---|---|:--:|
| **Invariant** | quan hệ luôn đúng với **mọi** dữ liệu, không hardcode số | Σ doanh thu mỗi Cty = tổng; doanh thu ≤ `SUM(TotalMoney)` distinct bill (no fan-out); Σ HH theo cấp = tổng HH | B |
| **Golden / characterization** | pin số tại snapshot để chống hồi quy | `overview(toàn kỳ).totalCommission === 13_621_482n` | B |
| **Contract** | HTTP/DTO/serialize, không đụng nghiệp vụ | `from` sai định dạng → 400; ghi DB → middleware throw; Decimal → string | A |
| **Slice** (khi sau này có seed) | 1 lát nhỏ tự tính tay | 1 đơn cụ thể: Σ `CommisionAmount` = "Tổng hoa hồng" | A/B |

**Ưu tiên viết Invariant trước** — chúng bắt đúng loại bug fan-out mà
`standards/01 §2` cảnh báo, và không trôi theo thời gian.

---

## Unit test template (Tier A — mock Prisma)

File: `<name>.service.spec.ts` nằm **cạnh** `<name>.service.ts`.

```typescript
// reports/reports.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { ReportsService } from './reports.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Prisma mock: report thường dùng $queryRaw cho aggregate phức tạp ──────────
const prismaMock = {
  $queryRaw: jest.fn(),
  userLogin: { findMany: jest.fn(), count: jest.fn() },
};

describe('ReportsService', () => {
  let service: ReportsService;

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [ReportsService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();
    service = moduleRef.get(ReportsService);
    jest.clearAllMocks();
  });

  describe('commissionOverview', () => {
    it('serializes Decimal/BigInt revenue to string (no precision loss)', async () => {
      prismaMock.$queryRaw.mockResolvedValue([
        { company_id: 14n, company_name: 'Freetrend', revenue: '160191779', total_commission: '13621482' },
      ]);

      const rows = await service.commissionOverview({ from: '2020-01-01', to: '2100-01-01' });

      expect(typeof rows[0].revenue).toBe('string');   // BigInt không JSON.stringify được
      expect(rows[0].revenue).toBe('160191779');
    });
  });
});
```

**Mock rules:**
- Mock `PrismaService` hoàn toàn qua `useValue` — **không** đụng DB thật ở Tier A.
  (Prisma middleware chặn ghi ở `apps/api/src/prisma/prisma.service.ts` là backstop, không phải test target.)
- `jest.clearAllMocks()` trong `beforeEach` — không rò state.
- Assert cả **cái được gọi** (`toHaveBeenCalledWith`) lẫn **shape trả về** (đặc biệt string-hoá số).

---

## Reconciliation template (Tier B — DB live, opt-in)

```typescript
// reports/reports.recon.spec.ts   — chạy: RECON_DB=1 pnpm --filter api test -- recon
import { COMMISSION_GOLDEN as G } from '../../test/fixtures/commission.golden';

const RUN = process.env.RECON_DB === '1';
const dRun = RUN ? describe : describe.skip;   // skip sạch khi không bật ENV → CI không đỏ

dRun('Commission reconciliation (live DB)', () => {
  it('INVARIANT: Σ commission theo cấp === tổng commission', async () => {
    const { total, byLevel } = await queryCommissionTotals();  // real $queryRaw
    expect(byLevel[1] + byLevel[2] + byLevel[3]).toBe(total);
  });

  it(`GOLDEN (@${G.snapshotDate}): tổng commission === ${G.totalCommission}`, async () => {
    const { total } = await queryCommissionTotals();
    expect(total).toBe(G.totalCommission);   // trôi khi dữ liệu đổi → cập nhật snapshot có chủ đích
  });
});
```

---

## Integration test (Tier A — HTTP contract, supertest)

Mount full NestJS app (DI + pipes + guards thật), Prisma override. Test status code, response
shape, error code — thứ unit test service không bắt được.

```typescript
import * as request from 'supertest';
import { Test } from '@nestjs/testing';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PrismaService } from '../prisma/prisma.service';

describe('ReportsController (integration)', () => {
  let app;
  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ /* ReportsModule */ })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideProvider(PrismaService).useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  it('GET /reports/commission/overview — 400 khi thiếu `from`', () =>
    request(app.getHttpServer()).get('/reports/commission/overview').expect(400));
});
```

---

## Naming & coverage

| Pattern | Ví dụ |
|---|---|
| describe = tên class | `describe('ReportsService', ...)` |
| describe lồng = tên method | `describe('commissionOverview', ...)` |
| `it` = tiếng Anh, nêu rõ hành vi | `it('serializes Decimal to string', ...)` |

Mỗi service method tối thiểu: **happy path** · **null/empty** (0 dòng → không crash) · **guard**
(sai input → đúng exception). Report thêm: **≥1 invariant** + **≥1 golden** (Tier B).

## Running

```bash
pnpm --filter api test                         # tất cả unit (Tier A)
pnpm --filter api test -- --testPathPattern reports
pnpm --filter api test:watch                   # watch (dùng khi red-green)
RECON_DB=1 pnpm --filter api test -- recon     # reconciliation (Tier B, DB live)
```

---

## ⚠️ HUMAN WARNING — thiếu test coverage

Nếu `*.service.ts` tồn tại mà thiếu `*.service.spec.ts`, hoặc `*.controller.ts` thiếu integration:

> **HUMAN — ACTION REQUIRED:** `{file}` chưa có test. Dự án chạy TDD — mọi method nghiệp vụ
> phải có test **trước** khi merge. Xác nhận case cần thêm hoặc chấp nhận gap một cách tường minh.

**Trạng thái hiện tại (cập nhật khi thêm test):**

| File | Thiếu | Ưu tiên |
|---|---|---|
| `reports/reports.service.ts` (`latestUsers`, `ping`) | unit spec | báo mẫu — chưa TDD-hoá |
| `reports/reports.controller.ts` | integration spec | MEDIUM |
| `auth/auth.service.ts` | unit spec | HIGH — verify token, mint session |

> Các report mới **phải** có test viết trước (không được thêm vào bảng này).
