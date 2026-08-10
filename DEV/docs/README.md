# CoShareReport — Docs

Tài liệu để **hiểu nghiệp vụ CoShare** và **làm report cho đúng**. Đây là app read-only
đọc thẳng Postgres của CoShare (504 model đã introspect), nên rủi ro lớn nhất không phải
"code chạy hay không" mà là **con số có đúng nghiệp vụ hay không**.

> 👉 **Dev mới đọc trước:** [`00-START-HERE.md`](./00-START-HERE.md) (bản đồ) ·
> [`ROADMAP.md`](./ROADMAP.md) (đang ở đâu, làm gì tiếp, ❓ đang chặn).

## Cấu trúc

| Folder | Chứa gì | Khi nào đọc/ghi |
|---|---|---|
| `coshare-backend/` | Output **thô** của `ck:doc` từ repo backend chính (module, business logic) | Nguồn tra cứu khi cần đào sâu 1 logic |
| `db/` | Tài liệu **chắt lọc**: từ điển bảng/cột quan trọng + quy ước chung | Đọc trước mỗi report; cập nhật khi phát hiện bảng/quy ước mới |
| `reports/` | 1 file **spec cho mỗi report** (yêu cầu, nguồn dữ liệu, cách kiểm tra) | Tạo mới mỗi khi bắt đầu 1 report, copy từ `_TEMPLATE.md` |

## Tại sao tách `coshare-backend/` (thô) và `db/` (chắt lọc)?

504 model là quá nhiều để nạp hết mỗi lần làm việc. Cái thực sự cần khi viết report là:
- **Đúng bảng/cột nào** → `db/table-dictionary.md`
- **Định nghĩa nghiệp vụ** (vd: "active user" tính sao, đơn có trạng thái gì) → `db/conventions.md`

`coshare-backend/` giữ nguyên bản gốc để tra khi hai file trên chưa đủ.

## Quy trình làm 1 report

Xem `reports/_TEMPLATE.md` — 6 bước: Spec → Tìm nguồn → Query → Endpoint → Frontend → Kiểm tra.
Trọng tâm là bước **Kiểm tra** (đối soát số liệu), không chỉ "chạy được".
