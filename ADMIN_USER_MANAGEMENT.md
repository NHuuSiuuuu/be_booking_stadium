# API Quản Lý Người Dùng Admin

Tài liệu này mô tả các API backend dùng cho tab quản lý người dùng ở trang
admin frontend `/admin/user`.

## Mục Tiêu

Backend cung cấp API để admin quản lý tài khoản:

- Lấy danh sách tài khoản.
- Tạo tài khoản user.
- Tạo tài khoản admin.
- Xem chi tiết tài khoản.
- Cập nhật tài khoản.
- Xóa tài khoản.

Các response quản lý user cần trả đủ `status` và `created_at` để frontend hiển
thị trạng thái và ngày tạo tài khoản.

## Field Chính

User response dùng các field chính:

```json
{
  "id": 1,
  "fullname": "Nguyen Van A",
  "email": "user@example.com",
  "phone": "0900000000",
  "isadmin": false,
  "status": true,
  "created_at": "2026-09-03T08:00:00.000Z"
}
```

Ý nghĩa:

- `isadmin = true`: tài khoản admin.
- `isadmin = false`: tài khoản user.
- `status = true`: tài khoản đang hoạt động.
- `status = false`: tài khoản dừng hoạt động.
- `created_at`: ngày tạo tài khoản trong database.

## Danh Sách User

```http
GET /api/user
```

Hỗ trợ query:

```http
GET /api/user?page=1&keyword=nguyen&filter=status:true&sort=created_at:desc
```

Filter được hỗ trợ:

- `status:true`
- `status:false`
- `isadmin:true`
- `isadmin:false`
- `email:<value>`
- `phone:<value>`

Sort được hỗ trợ:

- `fullname:asc`
- `fullname:desc`
- `created_at:asc`
- `created_at:desc`

Response:

```json
{
  "status": "OK",
  "message": "success",
  "result": [],
  "total": 0,
  "pageCurrent": 1,
  "totalPage": 0
}
```

## Tạo User

```http
POST /api/user/create
```

Payload:

```json
{
  "fullName": "Nguyen Van A",
  "email": "user@example.com",
  "password": "password",
  "phone": "0900000000"
}
```

API tạo user thường. Response trả lại user đã tạo, bao gồm `status` và
`created_at`.

## Tạo Admin

```http
POST /api/user/create-admin
```

Payload:

```json
{
  "fullName": "Admin",
  "email": "admin@example.com",
  "password": "password",
  "phone": "0900000000"
}
```

API tạo tài khoản admin và yêu cầu middleware đăng nhập admin.

## Chi Tiết User

```http
GET /api/user/detail/:id
```

Response trả về một tài khoản theo `id`, bao gồm:

- `id`
- `fullname`
- `email`
- `phone`
- `isadmin`
- `status`
- `created_at`

## Cập Nhật User

```http
PATCH /api/user/update/:id
```

Payload hỗ trợ:

```json
{
  "fullName": "Nguyen Van B",
  "email": "user-b@example.com",
  "phone": "0911111111",
  "isadmin": true,
  "status": true
}
```

Các field dùng `COALESCE`, nên field không gửi lên sẽ giữ nguyên giá trị cũ.

Lưu ý:

- `isadmin` có thể đổi quyền tài khoản giữa admin và user.
- `status` có thể bật/tắt trạng thái hoạt động.
- Nếu đổi email trùng tài khoản khác, API trả lỗi `409`.

## Xóa User

```http
DELETE /api/user/delete/:id
```

Response trả về tài khoản vừa xóa, bao gồm `status` và `created_at`.

## Quyền Truy Cập

Các API quản lý user dùng `authMiddleWare`. Service kiểm tra quyền thao tác
theo rule:

- Admin được thao tác tài khoản bất kỳ.
- User thường chỉ được thao tác tài khoản của chính mình.

Riêng API `POST /api/user/create-admin` yêu cầu thêm `adminMiddleWare`.

## Database

Backend đang đọc và ghi cột:

```sql
users.status
users.created_at
users.isadmin
```

Repo hiện không có file migration/schema SQL. Khi deploy, cần đảm bảo database
đã có cột `users.status` và `users.created_at`.

## Kiểm Tra

Các regression test liên quan nằm trong:

```bash
test/security-regression.test.js
```

Lệnh kiểm tra:

```bash
npm test
```
