# UI/UX Principles

## 1. Testability — Playwright-First Selectors

> **Rule:** Every interactive element and key layout region MUST be identifiable by Playwright without relying on CSS classes, text content, or DOM structure.

This is a hard requirement, not optional. Playwright tests break when CSS changes or text is translated. `data-testid` attributes are immune to both.

---

### 1.1 `data-testid` Naming Convention

Format: **`kebab-case`**, scoped from broad → specific.

```
[page-or-section]-[component]-[variant?]
```

| Pattern | Example |
|---------|---------|
| Layout regions | `app-nav`, `app-header`, `app-sidebar` |
| Page containers | `employee-list-page`, `settings-company-page` |
| Data tables | `employee-table`, `client-table` |
| Table rows | `employee-row` (on `<tr>`) |
| Forms | `create-employee-form`, `login-form` |
| Inputs | `input-email`, `input-password`, `input-search` |
| Buttons (primary action) | `btn-submit`, `btn-save`, `btn-delete` |
| Buttons (secondary) | `btn-cancel`, `btn-edit-{id}` |
| Modals / Dialogs | `modal-create-employee`, `modal-confirm-delete` |
| Status/badge chips | `status-badge`, `attendance-status` |
| Loading states | `skeleton-employee-list`, `spinner-page` |
| Empty states | `empty-state-employees`, `empty-state-clients` |
| Error messages | `error-message-form`, `toast-error` |
| Success feedback | `toast-success` |
| Pagination | `pagination-controls` |
| Dropdown menus | `dropdown-user-menu`, `dropdown-status-picker` |

---

### 1.2 Required `data-testid` by Component Type

These are **mandatory** — add them when building or modifying components:

#### Layout Shells
```tsx
<nav data-testid="app-nav">               {/* AppLayout sidebar nav */}
<header data-testid="app-header">         {/* AppLayout top header */}
<main data-testid="page-content">         {/* main content area */}
```

#### Pages
```tsx
// Every page component's root div
<div data-testid="employee-list-page">
<div data-testid="settings-company-page">
```

#### Tables
```tsx
<table data-testid="employee-table">
  <tbody>
    {employees.map(emp => (
      <tr key={emp.id} data-testid="employee-row">
```

#### Forms
```tsx
<form data-testid="create-employee-form">
  <input data-testid="input-first-name" />
  <button type="submit" data-testid="btn-submit">
```

#### Buttons (any button with a meaningful action)
```tsx
<button data-testid="btn-save">Save</button>
<button data-testid="btn-delete">Delete</button>
<button data-testid="btn-edit-{id}">Edit</button>  {/* dynamic */}
```

#### Modals
```tsx
<div data-testid="modal-confirm-delete">
  <button data-testid="btn-confirm-delete">Confirm</button>
  <button data-testid="btn-cancel">Cancel</button>
```

#### Status Indicators
```tsx
<span data-testid="attendance-status">{status.name}</span>
<div data-testid="status-badge" data-status={status.code}>
```

#### Loading & Empty States
```tsx
<div data-testid="skeleton-employee-list">   {/* skeleton loader */}
<div data-testid="empty-state-employees">    {/* no data */}
<div data-testid="spinner-page">             {/* full-page loading */}
```

---

### 1.3 ARIA Rules (Required for Accessibility + Playwright)

Playwright can target by ARIA role — this doubles as a11y compliance:

| Element | Required Attribute |
|---------|-------------------|
| Icon-only buttons | `aria-label="Delete employee"` |
| Toggle buttons | `aria-pressed={isActive}` |
| Modal dialogs | `role="dialog"` + `aria-labelledby` |
| Alert/Toast | `role="alert"` (errors), `aria-live="polite"` (info) |
| Nav links | `aria-current="page"` on active item |
| Loading spinners | `aria-label="Loading..."` + `aria-busy={true}` |
| Form inputs | `id` matching `htmlFor` on `<label>` |

---

### 1.4 Do NOT Use for Selectors

These change over time and break tests:

| Avoid | Why |
|-------|-----|
| CSS class (`.btn-primary`) | Refactored away any time |
| Text content (`getByText('Save')`) | Breaks on copy changes |
| DOM position (`nth-child(3)`) | Breaks on reorder |
| `id` attribute for Playwright | Reserved for form labels; classes can conflict |

---

### 1.5 Enforcement Checklist

Before submitting any UI component or page, verify:

- [ ] Every page root has `data-testid="[page-name]-page"`
- [ ] Every table has `data-testid="[entity]-table"` and rows have `data-testid="[entity]-row"`
- [ ] Every form has `data-testid="[action]-[entity]-form"`
- [ ] All CTA buttons have `data-testid="btn-[action]"`
- [ ] Modals have `data-testid="modal-[name]"`
- [ ] Empty states have `data-testid="empty-state-[entity]"`
- [ ] Loading skeletons/spinners have `data-testid`
- [ ] Icon-only buttons have `aria-label`

---

## 2. Error Feedback — Toast Rules

**Rule:** Every mutation (create/update/delete) MUST show a visible toast notification — success AND failure. Silent failures are bugs.

### 2.1 Always mount `<Toaster />`

`<Toaster />` from `@/components/ui/toaster` MUST be rendered inside `AppLayout` (and any layout that hosts authenticated pages). Without it, `useToast()` calls queue internally but nothing renders.

```tsx
// AppLayout.tsx — required
import { Toaster } from '@/components/ui/toaster';
// ...
return (
  <div>
    ...
    <Toaster />
  </div>
);
```

### 2.2 Use `getApiErrorMessage` in every catch block

**Never** use `err instanceof Error ? err.message : 'fallback'` — `AxiosError.message` returns the generic HTTP string (e.g., `"Request failed with status code 409"`), not the backend error message.

**Always** use the shared utility:

```ts
import { getApiErrorMessage } from '@/lib/apiError';

} catch (err: unknown) {
  toast({
    title: 'Error',
    description: getApiErrorMessage(err, 'Descriptive fallback here'),
    variant: 'destructive',
  });
}
```

`getApiErrorMessage` extracts `err.response.data.message` first (NestJS format), then falls back to `err.message`, then to the provided fallback string. It also handles `string[]` validation arrays by joining them.

### 2.3 Toast import — use the canonical hook

All pages import from `@/hooks/use-toast`. Never import from `@/components/hooks/use-toast` (duplicate file — Toaster is wired to the canonical one).

```ts
// ✅ Correct
import { useToast } from '@/hooks/use-toast';

// ❌ Wrong — different store, toast will not appear
import { useToast } from '@/components/hooks/use-toast';
```

### 2.4 Toast checklist

Before submitting any form or action handler:
- [ ] Success path: `toast({ title: 'Entity saved' })`
- [ ] Error path: `toast({ title: 'Error', description: getApiErrorMessage(err, '...'), variant: 'destructive' })`
- [ ] `<Toaster />` is mounted in the active layout

---

## 3. UI Language

**Rule:** All visible text in the UI MUST be in English — labels, placeholders, error messages, button text, tooltips, ARIA labels, section headings, and empty state messages.

Vietnamese text anywhere in the UI is a bug.

**Rationale:** The application serves a multi-national audience. English is the single, consistent display language.

---

## 3. CRUD Form Interaction Pattern

### 2.1 Rule: Add/Edit actions open a Dialog (popup), NOT a Sheet (sidebar)

All "Add" and "Edit" buttons on list/table pages MUST open a centered `Dialog` component. `Sheet` (right-side drawer) is reserved for contextual side panels only (e.g., detail previews, filters).

**Rationale:** Dialogs keep focus, are easier to dismiss, and scale better on smaller screens than a right-side sheet that covers content.

**Required component:** `Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter` from `@/components/ui/dialog`

```tsx
// ✅ Correct — scrollable form content, buttons always visible
<Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
  <DialogContent className="sm:max-w-lg">
    <DialogHeader>
      <DialogTitle>{editTarget ? 'Edit' : 'Add'}</DialogTitle>
    </DialogHeader>
    <form id="entity-form" onSubmit={handleSubmit(onSubmit)}
          className="flex-1 min-h-0 overflow-y-auto px-6 py-4 space-y-4">
      {/* fields only — no buttons here */}
    </form>
    <DialogFooter>
      <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Cancel</Button>
      <Button type="submit" form="entity-form" disabled={isSubmitting}>Save</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>

// ❌ Wrong — Do NOT use Sheet for Add/Edit forms
<Sheet open={sheetOpen} onOpenChange={setSheetOpen}>
  <SheetContent>...</SheetContent>
</Sheet>

// ❌ Wrong — buttons inside the scrollable area can be scrolled off-screen
<DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
  <form>
    {/* fields and buttons all together — buttons can disappear on scroll */}
    <div className="flex justify-end gap-2 pt-4">...</div>
  </form>
</DialogContent>
```

**State naming convention:**
- `dialogOpen` / `setDialogOpen` — open state
- `editTarget` — `null` for create, entity object for edit

**Size guidance:**
- Simple forms (≤5 fields): `sm:max-w-md`
- Standard forms: `sm:max-w-lg`
- Complex forms (many fields): `sm:max-w-xl`

### 2.2 Rule: Popup buttons must always be visible (sticky footer)

> **Rule:** Any popup/dialog with action buttons at the bottom MUST use a sticky footer so buttons are always visible regardless of content height.

**Pattern for Dialog-based popups (`DialogContent` from `@/components/ui/dialog`):**
- `DialogContent` is already `flex flex-col max-h-[90vh]` — do NOT add `overflow-y-auto` to it.
- Put scrollable content in a form (or `DialogBody`) with `flex-1 min-h-0 overflow-y-auto px-6 py-4`.
- Put action buttons in `DialogFooter` — it has `shrink-0` so it never scrolls away.

**Pattern for custom modals (manual `fixed inset-0` layout):**
```tsx
// ✅ Correct — inner container is flex-col with max-height
<div className="relative z-10 w-full max-w-md bg-card ... flex flex-col max-h-[90vh]">
  {/* Header */}
  <div className="shrink-0 flex items-center justify-between px-6 pt-6 pb-4">...</div>

  {/* Scrollable content */}
  <div className="flex-1 min-h-0 overflow-y-auto px-6 pb-4">
    {/* content here */}
  </div>

  {/* Sticky footer */}
  <div className="shrink-0 flex gap-3 px-6 pb-6 pt-4 border-t border-border">
    <Button>Cancel</Button>
    <Button>Save</Button>
  </div>
</div>
```

**Key CSS rules:**
- Container: `flex flex-col max-h-[90vh]`
- Header/footer: `shrink-0` — never shrinks, always visible
- Content area: `flex-1 min-h-0 overflow-y-auto` — takes remaining space, scrolls

---

## 3. Playwright Smoke Test Contract

Every route in the app MUST satisfy this contract for the smoke tests to pass:

1. **App shell loads** — `[data-testid="app-nav"]` is visible within 20s
2. **No crash phrases** in page body (TypeError, undefined is not, etc.)
3. **No full-page 404**
4. For list pages: either `[data-testid="[entity]-table"]` exists OR `[data-testid="empty-state-[entity]"]` is visible
5. For form pages: at least one `input, select, textarea` is present

When adding a new route, **update `QC/Playwright/tests/smoke.spec.ts`** to include it.

---

## 4. Selector Priority Order (for writing tests)

Prefer selectors in this order:

```
1. data-testid          → page.locator('[data-testid="employee-table"]')
2. ARIA role + name     → page.getByRole('button', { name: /save/i })
3. ARIA label           → page.getByLabel(/employee name/i)
4. Placeholder          → page.getByPlaceholder(/search/i)
5. Text (last resort)   → page.getByText(/dashboard/i)  -- only for headings/static text
```

Never use CSS classes or XPath in Playwright tests.

---

## 5. Dynamic IDs

For lists where multiple instances of a component exist, append the entity ID:

```tsx
// Good
<button data-testid={`btn-edit-${employee.id}`}>Edit</button>
<tr data-testid={`employee-row-${employee.id}`}>

// Bad — not unique
<button data-testid="btn-edit">Edit</button>
```

Playwright can then target: `page.locator('[data-testid^="employee-row-"]')` or a specific row by ID.
