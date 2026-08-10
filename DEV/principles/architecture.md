# Architecture Principles

## Data Standards

### ID
- Mọi entity đều dùng **GUID v7** làm primary key (không dùng BIGINT auto-increment).
- GUID v7 sortable theo thời gian → an toàn để dùng làm clustered index.

### Datetime & Timezone
- DB luôn lưu **TIMESTAMPTZ (UTC)** — không bao giờ lưu local time.
- Khi client gửi datetime lên server: server nhận và lưu đúng timezone đi kèm, convert sang UTC trước khi persist.
- Khi UI hiển thị datetime: **convert sang timezone của máy user** (dùng `Intl.DateTimeFormat` hoặc `date-fns-tz`).
- Khi user chọn ngày/giờ trên UI (date picker, time input): **hiểu là giờ máy user**, FE convert sang UTC trước khi gửi API.
- Không bao giờ assume timezone trên server.

### Soft Delete
- Mọi table đều có cột `IsDeleted BOOLEAN NOT NULL DEFAULT false`.
- Xóa = set `IsDeleted = true`, không bao giờ `DELETE` row.
- Mọi query mặc định phải filter `WHERE IsDeleted = false`.
- ORM/query builder phải có global filter để tự động exclude deleted rows.

### Standard Columns
Mọi entity đều có đầy đủ các cột sau:

| Cột | Kiểu | Mô tả |
|-----|------|-------|
| `Id` | UUID (GUID v7) | Primary key |
| `Note` | TEXT | Ghi chú tự do, nullable |
| `IsDeleted` | BOOLEAN | Soft delete flag |
| `IsDisabled` | BOOLEAN | Tạm vô hiệu hoá (không xoá) |
| `OrderNo` | INTEGER | Thứ tự hiển thị / sort |
| `Log_CreatedAt` | TIMESTAMPTZ | Auto-set khi insert |
| `Log_CreatedBy` | VARCHAR | User ID/name thực hiện |
| `Log_UpdatedAt` | TIMESTAMPTZ | Auto-set khi update |
| `Log_UpdatedBy` | VARCHAR | User ID/name thực hiện |
