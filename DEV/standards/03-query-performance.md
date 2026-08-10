# 03 — Query & Performance (Prisma/SQL readonly) 🟠 P1

> Report chạy trên **DB production của CoShare**. Một query nặng của app này có thể làm chậm hệ
> thống của họ. Chuẩn readonly + nhẹ tải là **bắt buộc**, không phải tối ưu "cho vui".

---

## 1. READONLY — tuyệt đối (nhắc lại vì quan trọng)

- ✅ Chỉ: `findMany / findUnique / findFirst / aggregate / count / groupBy / $queryRaw`.
- ❌ Cấm: `create / update / delete / upsert / createMany / $executeRaw*` / `migrate`.
- Middleware trong `prisma.service.ts` chặn ghi như lớp phòng vệ cuối — **đừng dựa vào nó, đừng viết lệnh ghi ngay từ đầu**.
- Cần **view / index / function** để tối ưu? Claude **không tự tạo** → viết SQL vào `sql-scripts/` (`yyyy-MM-dd HH:mm <mô tả>.sql`) và giao HUMAN chạy.

## 2. Đẩy việc xuống DB — đừng bê hết về Node

**MUST:**
- Aggregate (`SUM/COUNT/AVG/GROUP BY`) làm ở **DB**, không `findMany` toàn bảng rồi cộng bằng JS.
- Chỉ `SELECT` cột cần (Prisma `select`), không lấy cả row nếu chỉ cần vài cột.
- Lọc bằng `where` ở DB, **không** lọc bằng `.filter()` sau khi kéo cả bảng về.

```ts
// ❌ SAI: kéo cả bảng về Node rồi cộng
const all = await prisma.merchantBill.findMany();
const revenue = all.reduce((s, b) => s + Number(b.TotalMoney), 0);

// ✅ ĐÚNG: aggregate ở DB
const { _sum } = await prisma.merchantBill.aggregate({
  _sum: { TotalMoney: true },
  where: { IsDeleted: false },
});
```

## 3. Phân trang — bắt buộc cho danh sách

**MUST:**
- Mọi endpoint trả **danh sách** phải phân trang; **không bao giờ** trả unbounded.
- Mặc định `pageSize = 20`, **tối đa 100** ❓ (chốt ngưỡng với HUMAN). Reject `pageSize` vượt max.
- Trả kèm `total` (qua `count`) để FE hiển thị phân trang.
- Bảng lớn: ưu tiên **keyset/cursor** (`where id > lastId`) thay vì `OFFSET` lớn (OFFSET quét bỏ hàng, chậm dần).

## 4. Tránh N+1

**MUST:** không query trong vòng lặp. Dùng Prisma `include`/`select` (join) hoặc gom id rồi query 1 lần (`where: { id: { in: [...] } }`).

## 5. `$queryRaw` — chỉ khi aggregate quá phức tạp cho Prisma API

**MUST:**
- Dùng **tagged template** `prisma.$queryRaw\`...${value}\`` để tham số hoá — **không** nối chuỗi (chống SQL injection dù chỉ readonly).
- Vẫn phải readonly (chỉ `SELECT`/CTE). Không `INSERT/UPDATE/...` kể cả trong raw.
- Map kết quả về type rõ ràng; `BigInt` từ `COUNT()` phải ép `Number()` cẩn thận (chú ý tràn số với count cực lớn — hiếm nhưng lưu ý).

```ts
const rows = await prisma.$queryRaw<Array<{ day: Date; total: bigint }>>`
  SELECT date_trunc('day', "CreatedAt") AS day, COUNT(*) AS total
  FROM "MerchantBill"
  WHERE "IsDeleted" = false AND "CreatedAt" >= ${gte} AND "CreatedAt" <= ${lte}
  GROUP BY 1 ORDER BY 1`;
```

## 6. Chi phí & an toàn tải

**MUST / SHOULD:**
- **`EXPLAIN` (SHOULD)** với bảng lớn / query mới trước khi phát hành — nhìn có seq scan trên bảng lớn không. Chạy `EXPLAIN` (không `ANALYZE` gây ghi/khoá) và lưu vào `sql-scripts/` nếu đáng lưu.
- **Đặt `limit` phòng hờ** ngay cả khi kỳ vọng ít dòng.
- Cân nhắc **timeout** ở tầng query cho report nặng (❓ chốt ngưỡng, vd 10s) để không giữ kết nối lâu trên DB CoShare.
- Query theo khoảng thời gian → dựa trên cột đã có **index** nếu có (thường cột thời gian tạo). Nếu thiếu index và query chậm → đề xuất index qua `sql-scripts/` cho HUMAN, **không tự tạo**.

## 7. Caching (SHOULD, khi cần)

- Report tổng hợp nặng, ít đổi → cân nhắc cache ngắn hạn ở tầng API (in-memory TTL) thay vì bắt DB tính lại mỗi request. Ghi rõ TTL & rủi ro "số hơi cũ" trong spec.
- **Không** cache dữ liệu nhạy cảm/PII ở nơi chia sẻ giữa user khác quyền (xem [07](./07-security-privacy.md)).

---

## Checklist Query & Performance

- [ ] Query **readonly** hoàn toàn; không có lệnh ghi kể cả trong `$queryRaw`.
- [ ] Aggregate/filter đẩy xuống **DB**; chỉ `select` cột cần.
- [ ] Danh sách có **phân trang** + `total`; `pageSize` có trần; bảng lớn dùng cursor.
- [ ] Không **N+1**; `$queryRaw` tham số hoá bằng tagged template.
- [ ] Bảng lớn: đã xem `EXPLAIN`; có `limit`; cân nhắc timeout.
- [ ] Index/view cần thiết → viết `sql-scripts/` giao HUMAN, không tự tạo.

> **Why:** app này là khách mời trên DB của CoShare. Nhẹ tải + readonly là điều kiện để được tin
> tưởng cho cắm thẳng vào production của họ.
