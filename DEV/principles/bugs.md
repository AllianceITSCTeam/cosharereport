# Bug Process Principles

Every reported bug must produce a permanent, machine-verifiable record.

## Pipeline

```
Bug reported
  → QC/bugs/BUG-NNN/README.md created (from template)
  → Reproduce test written (Playwright / Bruno / SQL data-check)
  → Test runs RED  → confirms bug exists
  → Dev fixes code
  → Test runs GREEN → confirms bug is gone
  → BUG-LOG.md Registry row updated to ✅ Fixed
```

**No reproduce test = bug is not formally filed.** A description alone is insufficient.

---

## Folder structure

```
QC/
├── BUG-LOG.md                          # Index table only — one row per bug
├── bugs/
│   ├── _TEMPLATE/
│   │   └── README.md                   # Copy this for every new bug
│   ├── BUG-NNN/
│   │   ├── README.md                   # Full description, root cause, fix, fix proof
│   │   └── data-check.sql              # SQL: returns rows when bug present, 0 when fixed
│   └── archive-BUG-LOG-legacy.md       # BUG-001 to BUG-014 (pre-new-process)
└── Playwright/
    └── tests/
        └── bugs/
            └── BUG-NNN-slug.spec.ts    # Playwright regression test
```

Bruno tests go in: `QC/Bruno/scenarios/bugs/BUG-NNN-slug.bru`

---

## Mandatory fields in README.md

| Field | Required | Notes |
|-------|----------|-------|
| Status | ✅ | 🔴 Open / ✅ Fixed |
| Opened date | ✅ | YYYY-MM-DD |
| Reproduce test path | ✅ | Path or "pending" — must not stay "pending" past 1 day |
| Description | ✅ | What user sees vs what should happen |
| Manual reproduce steps | ✅ | Exact steps, not vague |
| Verify command | ✅ | How to prove bug is present |
| Root cause | ✅ | "UNCONFIRMED" is OK while investigating |
| Fix | required on close | What changed, which file(s) |
| Fix proof | required on close | Test output showing pass + commit hash |
| Prevention | required on close | What pattern to avoid in future code |

---

## Reproduce test rules

### Playwright (`tests/bugs/BUG-NNN-slug.spec.ts`)

- While bug is **open**: add `test.fail()` before the assertion — test file is committed, CI sees it fail as expected
- After bug is **fixed**: remove `test.fail()`, test must pass cleanly
- Test name format: `BUG-NNN: [one-line description of what should be true when fixed]`

```ts
test('BUG-NNN: logout button is always visible in StatusPicker', async ({ page }) => {
  test.fail(); // remove this line when BUG-NNN is fixed
  // ... test body
});
```

### Bruno (`Bruno/scenarios/bugs/BUG-NNN-slug.bru`)

- Write an assertion that **fails** when the bug is present
- The assertion should **pass** after the fix
- Add a comment in the `.bru` file with the bug number and what the assertion proves

### SQL data-check (`QC/bugs/BUG-NNN/data-check.sql`)

- Query must return **rows** when the bug condition exists in the database
- Query must return **0 rows** when the database is clean
- Include a comment explaining what "rows present" means

```sql
-- BUG-NNN: detect [condition]
-- Returns rows when bug is present; 0 rows when fixed.
SELECT ... FROM ... WHERE <bug condition>;
```

---

## Commit conventions

```
bug(BUG-NNN): open — <short title>         ← when filing the bug + reproduce test
bug(BUG-NNN): fixed — <short title>        ← when fix + green test are committed together
```

---

## Fix proof format

Paste actual terminal output into `README.md → Fix proof`:

```
Fixed: 2026-04-21, commit abc1234
$ cd QC/Playwright && pnpm exec playwright test tests/bugs/BUG-NNN-slug.spec.ts --reporter=list
✓  BUG-NNN: [test description] (1.2s)
1 passed (3.1s)
```

---

## QC clock-change protocol (added after BUG-015)

Advancing the system clock is a **destructive test condition** that can corrupt timestamps in the shared database.

Before advancing system clock:
1. Record the current time
2. Note in the test case that clock is being advanced by X hours
3. After the test: **restore the clock immediately**
4. If the test left anomalous DB records, run `QC/bugs/BUG-015/data-check.sql` and clean up manually

Advancing the clock while connected to the shared staging/prod DB is **not allowed** without peer approval.
