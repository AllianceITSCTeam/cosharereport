# Report: Hàng hóa trên website

## 1. Spec — mô tả nghiệp vụ

- **Câu hỏi report trả lời:** Danh sách TOÀN BỘ sản phẩm merchant, lọc theo mã/tên/nhóm hàng/trạng
  thái bán trên website.
- **Ai được xem:** mọi user đã qua `JwtAuthGuard` (giống các report khác, chưa có phân quyền riêng).
- **Cột output** (`merchantProducts`, 1 dòng = 1 `MerchantProduct`):
  - `code` (Mã sản phẩm), `groupCode`/`groupName` (Nhóm sản phẩm — ưu tiên hiển thị `groupName`,
    FE fallback `groupCode` rồi `—`), `name` (Tên sản phẩm), `status` (Trạng thái —
    `SELLING`|`OUT_OF_STOCK`|`HIDDEN`, FE map tên tiếng Việt), `link` (Link sản phẩm trên website —
    `https://coshare.vn/product/{ID_GUID}`, build sẵn ở backend từ `MerchantProduct.ID_GUID`).
  - `pagination`: `page`, `pageSize`, `totalCount`.
- **Filter đầu vào:** `code`, `name` (ILIKE, optional), `groupProductId` (optional, bigint),
  `status` (optional, 1 trong 3 giá trị trên), `page`/`pageSize` (default 1/50, áp trong service —
  không trong DTO, giống pattern Screen 3). Không có khoảng ngày (khác các report hoa hồng/lượt bán).
- **Định nghĩa "Trạng thái" — ⚠️ ĐÃ SỬA 3 LẦN sau khi chốt ban đầu (xem Ghi chú bên dưới để hiểu vì
  sao), bản hiện tại (2026-10-02, bản thứ 4):**
  - **`HIDDEN` (Đã ẩn)** — ưu tiên cao nhất: `IsHideOnWeb OR IsSuspended OR IsDisable = true`.
    `IsDisable` đã bị bỏ RỒI ĐƯA LẠI vào rule này theo yêu cầu trực tiếp của user (lần 2) — dù có
    bằng chứng 12/2238 sản phẩm `IsDisable=true` từng phát sinh đơn hàng thật (xem §2), user xác
    nhận muốn coi `IsDisable=true` là "Đã ẩn" trên report này.
  - **`OUT_OF_STOCK` (Hết hàng)** — còn lại, `COALESCE(InventoryMoment.StockBooked, 0) <= 0` (sản
    phẩm không có dòng `InventoryMoment` cũng coi là hết hàng). **⚠️ Đây là proxy tạm, không chính
    xác về ngữ nghĩa** — `StockBooked` là số lượng đang đặt/giữ chỗ, không phải số lượng còn lại để
    bán. Dùng tạm vì không có cột tồn kho nào khác khả dụng trong DB hiện tại (xem §2).
  - **`SELLING` (Đang bán)** — còn lại.
  - **Snapshot DB hiện tại (2026-10-02, sau khi đưa lại `IsDisable`):** 2096 `HIDDEN`, **0**
    `OUT_OF_STOCK`, 142 `SELLING` (tổng 2238 sản phẩm chưa xoá) — đã xác nhận khớp giữa SQL trực
    tiếp, API, và UI thật. Trùng hợp toán học: 142 sản phẩm KHÔNG bị `IsDisable`/`IsHideOnWeb`/
    `IsSuspended` đều có `StockBooked > 0`, nên không còn sản phẩm nào rơi vào "Hết hàng" ở snapshot
    dữ liệu hiện tại — không phải bug, chỉ là đặc điểm của tập 142 sản phẩm "còn hoạt động" này.

## 2. Nguồn dữ liệu

- **Bảng chính:** `MerchantProduct` (`code`, `name`, `MerchantGroupProductId`, `IsHideOnWeb`,
  `IsSuspended`, `IsDisable`, `IsDeleted`, `ID_GUID`) — ☐ chưa có trong `docs/db/table-dictionary.md`.
- **Bảng join:** `MerchantGroupProduct` (nhóm hàng — `Code` luôn `null` trong dữ liệu thực tế đã
  kiểm tra, chỉ `Name` có giá trị), `InventoryMoment` (1 dòng/sản phẩm — chỉ 241/2238 sản phẩm có
  dòng tồn kho).
- **Quy ước áp dụng:** soft-delete ☑ loại (`IsDeleted = false` trên `MerchantProduct`) · không có
  timezone (không filter theo ngày) · `groupProductId` parse+validate sang `bigint` bằng
  `parseOptionalBigIntParam()`.
- **⚠️ Phát hiện quan trọng về chất lượng dữ liệu nguồn (2026-10-02, cần CoShare xác nhận trước khi
  coi rule trạng thái là chính thức):**
  1. **`IsDisable` không phải field riêng của `MerchantProduct`** — nó lặp lại ở gần như MỌI bảng
     trong hệ thống (250+ chỗ trong `schema.prisma`), là cờ soft-disable chung của framework, không
     mang nghĩa "ẩn trên website". 2095/2238 sản phẩm (93%) có `IsDisable = true`, và ít nhất 12
     trong số đó **vẫn từng phát sinh đơn hàng thật** — bằng chứng rõ ràng field này không đồng
     nghĩa "không bán được". Toàn bộ dữ liệu `MerchantProduct` hiện có chỉ thuộc **1 merchant duy
     nhất**, nguồn gốc từ `MoreInfo.source = "IZOLA"` (hệ thống sync bên ngoài) — `IsDisable` có thể
     phản ánh trạng thái sync từ IZOLA, không phải thao tác ẩn/hiện của người bán trên CoShare.
     **Dù vậy, user đã yêu cầu trực tiếp (2026-10-02, lần 2) đưa `IsDisable` vào rule "Đã ẩn"** —
     xem Ghi chú bên dưới — nên rule hiện tại CHỦ ĐỘNG chấp nhận rủi ro false-positive này.
  2. **`InventoryMoment.StockActual` luôn NULL** trên toàn bộ 241 dòng hiện có trong DB (kể cả bản
     live `CoShare`, không phải DB test) — không dùng được làm tín hiệu tồn kho. **Bảng `Inventory`
     rỗng hoàn toàn (0 dòng)** — không có nguồn thay thế nào khác. Chỉ `InventoryMoment.StockBooked`
     có số liệu thật (233/241 dòng > 0), nhưng đây là số lượng ĐANG ĐẶT/GIỮ CHỖ, không phải số CÒN
     LẠI ĐỂ BÁN — dùng tạm làm proxy "còn hoạt động" theo quyết định của user, chưa phải định nghĩa
     đúng về mặt nghiệp vụ.
  3. Do cả 2 điểm trên, rule trạng thái hiện tại là **best-effort tạm thời trên dữ liệu không đầy
     đủ**, không phải định nghĩa đã được CoShare xác nhận chính thức.

## 3. Query (backend)

- Vị trí: `apps/api/src/reports/reports.service.ts::merchantProducts()`,
  `::merchantProductGroups()`.
- Loại: ☑ `$queryRaw` — CTE `base` tính cột `status` bằng `CASE`, outer `SELECT` lọc theo `status`
  + window function `COUNT(*) OVER()` cho phân trang.
- **Chỉ readonly.** Test unit khẳng định SQL không chứa `INSERT/UPDATE/DELETE/CREATE/ALTER/DROP`.
- **Bẫy đã gặp và sửa (2026-10-02):** filter `code`/`name`/`groupProductId` ban đầu viết nhầm vào
  `WHERE` NGOÀI CTE `base` (tham chiếu alias `p."Code"`/`p."Name"`/`p."MerchantGroupProductId"`) —
  Postgres báo lỗi `42P01: missing FROM-clause entry for table "p"` vì alias `p` chỉ tồn tại TRONG
  phạm vi CTE, không lọt ra ngoài. Phát hiện được **qua kiểm thử UI thật** (Playwright, filter theo
  mã sản phẩm trả về 0 dòng), **không phải** qua unit test (unit test mock `$queryRaw` nên không
  chạy SQL thật, chỉ assert SQL text có chứa substring đúng — không catch được lỗi scope này). Đã
  sửa: `code`/`name`/`groupProductId` chuyển vào `WHERE` TRONG CTE `base` (cùng `IsDeleted = false`);
  chỉ `status` (cột suy ra từ `CASE`) ở lại `WHERE` ngoài. Đã bổ sung 2 test regression khẳng định vị
  trí filter nằm trước `FROM base` trong SQL text.

## 4. Endpoint

- `GET /reports/merchant-products` — danh sách sản phẩm + phân trang.
- `GET /reports/merchant-products/groups` — danh sách nhóm hàng cho filter dropdown.
- Cả 2 sau `JwtAuthGuard`, validate qua `MerchantProductQueryDto` với `ValidationPipe` toàn cục.

## 5. Frontend

- `apps/web/src/pages/MerchantProductsPage.tsx` — filter bar (Mã sản phẩm, Tên sản phẩm, Nhóm sản
  phẩm — dropdown có ô tìm kiếm lọc client-side qua `SearchableSelect` (124 nhóm, không cần tìm phía
  server), Trạng thái dropdown), bảng 5 cột (Mã sản phẩm/Nhóm sản phẩm/Tên sản phẩm/Trạng thái/
  Link — cột Link mở `row.link` ở tab mới qua `<a target="_blank" rel="noopener noreferrer">`),
  phân trang Trước/Sau. Route `/reports/merchant-products` + mục menu "Hàng hóa trên website" đã
  thêm. Không có export Excel (không được yêu cầu).
- `apps/web/src/components/filters/SearchableSelect.tsx` — component dropdown search dùng chung,
  tự viết (không có combobox nào sẵn trong dự án, chỉ có `@radix-ui/react-select` không hỗ trợ
  search), lọc option theo tên ngay trên client, đóng khi click ra ngoài/nhấn Escape. Prop
  `searchable={false}` ẩn ô tìm kiếm nhưng giữ nguyên style dropdown (dùng cho "Trạng thái" — chỉ
  3 option, không cần search nhưng đồng bộ giao diện với "Nhóm sản phẩm").
- Filter lưu `localStorage` qua `useFilterState` (giống `CommissionOrdersPage`).

## 6. Kiểm tra (bắt buộc — không chỉ "chạy được")

- [x] **Unit test (TDD):** `reports.service.merchant-products.spec.ts` — 12 test, mock `$queryRaw`,
      bao gồm 2 test regression cho bug scope CTE ở §3, status CASE (khẳng định `IsDisable` NẰM
      TRONG nhánh tính `HIDDEN`), link từ `ID_GUID`, phân trang, window function, mapping BigInt →
      JSON-safe.
- [x] **Đối soát trên DB thật (readonly, chỉ SELECT), 4 lần sau mỗi lần sửa rule:**
      1. Rule gốc (`IsDisable` trong HIDDEN + `StockActual`): 2096 HIDDEN / 142 OUT_OF_STOCK / 0
         SELLING — phát hiện bất thường (0 SELLING), dẫn tới điều tra.
      2. Sau khi bỏ `IsDisable`: 1 HIDDEN / 2237 OUT_OF_STOCK / 0 SELLING — lộ ra vấn đề thứ 2
         (`StockActual` luôn NULL).
      3. Sau khi đổi sang `StockBooked`: 1 HIDDEN / 2008 OUT_OF_STOCK / 229 SELLING — breakdown
         hợp lý, đã xác nhận qua UI thật.
      4. Sau khi đưa `IsDisable` TRỞ LẠI vào HIDDEN (yêu cầu user, lần 2): **2096 HIDDEN / 0
         OUT_OF_STOCK / 142 SELLING** — đã xác nhận khớp giữa SQL/API/UI.
      Filter `code`/`name`/`groupProductId` xác nhận đúng qua `curl` trực tiếp API sau khi sửa bug
      §3 (vd: `?code=100A5D` trả đúng 1 dòng, `?groupProductId=112` trả đúng 962 dòng khớp count SQL
      thủ công).
- [x] **Kiểm tra UI qua browser thật (Playwright + Chromium), lặp lại sau mỗi lần sửa rule:** bật
      tạm `DISABLE_AUTH=true` (cờ dev đã tài liệu hoá trong CLAUDE.md), restart dev server, xác
      nhận: bộ lọc hiển thị đúng 4 field, bảng đúng 5 cột (kể cả Link), lọc trạng thái "Hết hàng"/
      "Đã ẩn"/"Đang bán" trả về đúng số dòng khớp SQL qua từng lần sửa rule, lọc mã/tên sản phẩm
      hoạt động đúng (đã debounce 300ms, xem Ghi chú), phân trang Trước/Sau hoạt động, không có lỗi
      console. Đã revert `DISABLE_AUTH=false` + restart lại sau mỗi lần xong.
- [ ] **Con số vàng:** chưa có — **bắt buộc hỏi CoShare trước khi coi report này là chính thức**, vì
      cả 2 field cốt lõi (`IsHideOnWeb`/`IsSuspended` cho "Ẩn" và `StockBooked` cho "Hết hàng") đều
      là suy luận/proxy, không phải định nghĩa xác nhận. Xem 3 câu hỏi cụ thể ở Ghi chú bên dưới.
- [x] **Soft-delete / trạng thái:** `IsDeleted = false` áp dụng trên `MerchantProduct`; rule trạng
      thái áp dụng đúng thứ tự ưu tiên đã chốt (Ẩn > Hết hàng > Đang bán).
- [x] **Null / phân trang / performance:** `LEFT JOIN` + `COALESCE` xử lý sản phẩm không có nhóm /
      không có dòng tồn kho; `LIMIT/OFFSET` + `COUNT(*) OVER()` cùng 1 query.
- [x] **Security:** readonly (`$queryRaw` chỉ `SELECT`, test khẳng định), sau `JwtAuthGuard`, không
      rò rỉ PII (chỉ mã/tên/nhóm/trạng thái sản phẩm).

## Ghi chú / quyết định

- **2026-10-01: Chốt rule "Trạng thái" lần 1 qua `AskUserQuestion`** — Ẩn = `IsHideOnWeb OR
  IsDisable OR IsSuspended`; Hết hàng = `InventoryMoment.StockActual <= 0`. Dựa trên tên cột gợi ý,
  chưa kiểm chứng trên dữ liệu thật.
- **2026-10-02: User phát hiện bất thường** — mở report lên không thấy sản phẩm nào "Đang bán",
  nghi ngờ rule sai. Đây đúng là loại lỗi "số chạy được nhưng sai âm thầm" mà CLAUDE.md cảnh báo —
  chỉ chạy `jest` (mock) không phát hiện được, phải đối soát trên dữ liệu thật mới thấy.
- **2026-10-02: Điều tra qua agent + đối soát DB thật, phát hiện 2 vấn đề liên tiếp:**
  1. `IsDisable` là field chung toàn hệ thống (không riêng "ẩn web"), chiếm 93% sản phẩm, có sản
     phẩm `IsDisable=true` vẫn từng bán được → user quyết định bỏ khỏi rule HIDDEN.
  2. Sau khi bỏ `IsDisable`, lộ ra `InventoryMoment.StockActual` luôn NULL + bảng `Inventory` rỗng
     hoàn toàn → không có cột tồn kho khả dụng → user quyết định dùng tạm `StockBooked > 0` làm
     proxy "còn hoạt động", dù biết ngữ nghĩa không khớp hoàn toàn.
- **2026-10-02: Bug scope CTE (`p."Code"` ngoài phạm vi CTE)** — xem chi tiết kỹ thuật ở §3. Phát
  hiện qua kiểm thử UI thật (Playwright), minh chứng tại sao bước "chạy thử trên browser thật" trong
  quy trình `_TEMPLATE.md` là bắt buộc chứ không chỉ là unit test mock.
- **2026-10-02: User yêu cầu đưa `IsDisable` TRỞ LẠI vào rule "Đã ẩn" (lần 2)** — sau khi thấy trên
  UI các sản phẩm họ biết là đã tắt (`IsDisable=true`) lại hiển thị "Hết hàng" thay vì "Đã ẩn", user
  yêu cầu trực tiếp thêm lại `IsDisable` vào điều kiện `HIDDEN`. Đã thực hiện, dù bằng chứng ở §2
  (12 sản phẩm `IsDisable=true` từng bán được) vẫn còn — ghi lại rõ để tránh hiểu nhầm đây là lỗi
  nếu thấy vài sản phẩm "Đã ẩn" từng có lịch sử đơn hàng.
- **2026-10-02: Thêm cột "Link"** — `https://coshare.vn/product/{ID_GUID}`, mở tab mới trên FE.
- **2026-10-02: Fix bug ThrottlerException (429 Too Many Requests)** — input "Mã sản phẩm"/"Tên sản
  phẩm" gọi API ngay mỗi phím gõ (không debounce), gõ nhanh dồn request bị `ThrottlerGuard` chặn
  (300 req/phút/IP). Đã thêm debounce 300ms bằng hook `useDebounce` có sẵn trong dự án
  (`apps/web/src/hooks/useDebounce.ts`) — input hiển thị tức thời, nhưng chỉ gọi API sau khi ngừng
  gõ 300ms. Xác nhận qua Playwright: gõ "samsung" (7 ký tự) giờ chỉ bắn 1 request thay vì 7.
- **3 câu hỏi cần hỏi CoShare trước khi chốt chính thức:**
  1. `IsDisable` trên `MerchantProduct` nghĩa là gì — có liên quan gì đến hiển thị/bán hàng trên
     website không, hay thuần là cờ sync nội bộ từ IZOLA?
  2. Hệ thống theo dõi tồn kho thực tế (số lượng còn lại để bán) nằm ở đâu — `Inventory`/
     `InventoryMoment` hiện không có dữ liệu khả dụng, có bảng/service khác không được mirror vào
     DB readonly này không?
  3. `IsHideOnWeb`/`IsSuspended` có đúng là 2 cờ quyết định "ẩn khỏi website" theo nghĩa người dùng
     cuối hiểu không, hay còn điều kiện nào khác (vd: merchant cha bị khoá, hết hạn hợp đồng...)?
