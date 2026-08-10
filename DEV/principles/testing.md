# Testing Principles

## Rule: Every backend function MUST have a unit test

No exceptions. If a function exists, a test file exists alongside it.

---

## Unit Test Template

File naming: `<name>.service.spec.ts` lives next to `<name>.service.ts`.

```typescript
// department/department.service.spec.ts
import { Test, TestingModule } from '@nestjs/testing';
import { DepartmentService } from './department.service';
import { PrismaService } from '../prisma/prisma.service';

// ── Prisma mock ───────────────────────────────────────────────────────────────
const prismaMock = {
  department: {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  },
  staff: {
    count: jest.fn(),
  },
};

// ── Test setup ────────────────────────────────────────────────────────────────
describe('DepartmentService', () => {
  let service: DepartmentService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        DepartmentService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get<DepartmentService>(DepartmentService);
    jest.clearAllMocks();
  });

  // ── findAll ─────────────────────────────────────────────────────────────────
  describe('findAll', () => {
    it('returns paginated data', async () => {
      prismaMock.department.findMany.mockResolvedValue([{ id: '1', name: 'Engineering' }]);
      prismaMock.department.count.mockResolvedValue(1);

      const result = await service.findAll({ page: 1, limit: 10 });

      expect(result.data).toHaveLength(1);
      expect(result.pagination.total).toBe(1);
      expect(prismaMock.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
    });

    it('filters by companyId when provided', async () => {
      prismaMock.department.findMany.mockResolvedValue([]);
      prismaMock.department.count.mockResolvedValue(0);

      await service.findAll({ companyId: 'company-uuid' });

      expect(prismaMock.department.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ companyId: 'company-uuid' }) }),
      );
    });
  });

  // ── findOne ─────────────────────────────────────────────────────────────────
  describe('findOne', () => {
    it('returns the department when found', async () => {
      prismaMock.department.findFirst.mockResolvedValue({ id: 'uuid', name: 'HR' });

      const result = await service.findOne('uuid');

      expect(result.name).toBe('HR');
    });

    it('throws NotFoundException when not found', async () => {
      prismaMock.department.findFirst.mockResolvedValue(null);

      await expect(service.findOne('missing')).rejects.toThrow('not found');
    });
  });

  // ── create ──────────────────────────────────────────────────────────────────
  describe('create', () => {
    it('creates a department with a GUID v7 id', async () => {
      prismaMock.department.create.mockResolvedValue({ id: 'new-uuid' });

      const dto = { departmentCode: 'ENG', departmentName: 'Engineering', companyId: 'c-uuid' };
      await service.create(dto, 'creator-id');

      expect(prismaMock.department.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ code: 'ENG', logCreatedBy: 'creator-id' }),
        }),
      );
    });
  });

  // ── remove ──────────────────────────────────────────────────────────────────
  describe('remove', () => {
    it('soft-deletes (sets isDeleted = true)', async () => {
      prismaMock.department.findFirst.mockResolvedValue({ id: 'uuid' });
      prismaMock.staff.count.mockResolvedValue(0);
      prismaMock.department.update.mockResolvedValue({ id: 'uuid', isDeleted: true });

      await service.remove('uuid');

      expect(prismaMock.department.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isDeleted: true } }),
      );
    });

    it('throws BadRequestException when department has staff', async () => {
      prismaMock.department.findFirst.mockResolvedValue({ id: 'uuid' });
      prismaMock.staff.count.mockResolvedValue(3);

      await expect(service.remove('uuid')).rejects.toThrow('3 staff');
    });
  });
});
```

---

## Naming Rules

| Pattern | Example |
|---------|---------|
| Describe block = class name | `describe('DepartmentService', ...)` |
| Inner block = method name | `describe('findAll', ...)` |
| `it` = plain english, state what happens | `it('throws NotFoundException when not found', ...)` |

## Coverage Requirements

Every service method needs at minimum:
1. **Happy path** — correct input → expected output
2. **Not found** — missing entity → `NotFoundException`
3. **Guard condition** — business rule violation → `BadRequestException`

## Mock Pattern

- Mock `PrismaService` entirely via `useValue` — never hit the real DB in unit tests
- `jest.clearAllMocks()` in `beforeEach` — no state leaks between tests
- Assert on **what was called** (`toHaveBeenCalledWith`) not just return value

## Running Tests

```bash
# All unit tests
pnpm --filter api test

# Single file
pnpm --filter api test -- --testPathPattern department

# Watch mode
pnpm --filter api test:watch
```

---

## ⚠️ HUMAN WARNING: Missing Test Coverage

### Rule: Missing spec file → warn HUMAN before shipping

If a service file (`*.service.ts`) exists without a matching `*.service.spec.ts`:

> **HUMAN — ACTION REQUIRED:** `{service}.service.ts` has no unit test file.
> Every business-logic method must be covered before this feature is merged.
> Please discuss which cases to add or explicitly acknowledge the gap.

Known services currently missing specs (update this list as tests are added):

| Service | Missing | Priority |
|---|---|---|
| `auth/auth.service.ts` | unit tests | HIGH — login, password change, refresh |
| `employees/employees.service.ts` | unit tests | HIGH — create, update, role mapping |
| `system/settings/settings.service.ts` | unit tests | MEDIUM |
| `system/warnings/warnings.service.ts` | unit tests | MEDIUM |
| `notifications/notifications.service.ts` | unit tests | LOW |

---

### Rule: No integration test → warn HUMAN before shipping

If a controller (`*.controller.ts`) exists without a matching `*.controller.spec.ts`:

> **HUMAN — ACTION REQUIRED:** `{controller}.controller.ts` has no integration test.
> Integration tests verify: auth guards, DTO validation, HTTP response shape, and error codes.
> These cannot be caught by service-level unit tests alone.

Known controllers currently missing integration tests (update as tests are added):

| Controller | Missing | Priority |
|---|---|---|
| `auth/auth.controller.ts` | integration | HIGH — login/logout HTTP contract |
| `employees/employees.controller.ts` | integration | HIGH |
| `reports/reports.controller.ts` | integration | MEDIUM |
| `system/*` controllers | integration | LOW |

> Integration test file: `{name}.controller.spec.ts` alongside the controller.
> Pattern: NestJS `createNestApplication` + `supertest` — see `attendance.controller.spec.ts`.

---

## Integration Test Pattern

Integration tests mount the full NestJS application (real DI chain, real pipes, real guards)
with Prisma overridden. They test the **HTTP contract**: status codes, response shapes, error codes.

```typescript
// attendance.controller.spec.ts — see file for full example
import * as request from 'supertest';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';

describe('AttendanceController (integration)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ ... })
      .overrideGuard(JwtAuthGuard).useValue({ canActivate: () => true })
      .overrideProvider(PrismaService).useValue(prismaMock)
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
    await app.init();
  });

  it('POST /attendance — 403 when statusId out of scope', () => {
    return request(app.getHttpServer())
      .post('/attendance')
      .send({ statusId: 'not-allowed' })
      .expect(403)
      .expect(res => expect(res.body.code).toBe('E201'));
  });
});
```
