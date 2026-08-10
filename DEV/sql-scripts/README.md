# sql-scripts/

Lưu **mọi** SQL script để có dấu vết: định nghĩa view/function, query đối soát (reconciliation),
kiểm tra ad-hoc. Connection của app là **readonly** — nên:

## Quy tắc

1. **Claude không ghi vào DB.** App chỉ có quyền đọc. Không `CREATE`/`ALTER`/`DROP`/`INSERT`/`UPDATE`/`DELETE`, không migrate.
2. **Cần view / function?** Claude **không tự tạo** — viết SQL, lưu vào folder này, rồi
   **giao task cho HUMAN** chạy (nói rõ chạy cái gì, để làm gì, ảnh hưởng ra sao).
3. **Query đọc (SELECT) để đối soát** cũng lưu vào đây để tái sử dụng và kiểm chứng lại.

## Đặt tên file

```
yyyy-MM-dd HH:mm <mô tả ngắn>.sql
```

Ví dụ:
- `2026-08-10 14:30 create-view-daily-new-users.sql`   ← view, cần HUMAN chạy
- `2026-08-10 15:05 reconcile-new-users-april.sql`      ← query đối soát (SELECT)

## Header trong mỗi file

Mỗi script mở đầu bằng comment nêu rõ mục đích + ai chạy:

```sql
-- Purpose: <report/lý do>
-- Type: VIEW | FUNCTION | SELECT-check
-- Run by: HUMAN (needs write) | readonly-ok
-- Related report: docs/reports/<ten>.md
```
