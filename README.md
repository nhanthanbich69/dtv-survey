# DTV Survey

Ứng dụng quản lý khảo sát khách hàng (tiếng Việt), triển khai bằng React + Vite + Supabase.

## Chạy local

Cần Node.js 20+. Sao chép `.env.example` thành `.env` nếu cần, rồi:

```bash
npm install
npm run dev
```

## Cloudflare Pages

Build command: `npm run build`  
Output directory: `dist`  
SPA fallback dùng `dist/200.html` (Cloudflare Pages tự phục vụ cho mọi đường dẫn không khớp).

Biến môi trường (nếu không dùng `.env.production`):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY` (anon/publishable, không dùng service_role)

## Thiết lập lần đầu

Khi chưa có quản trị viên, mở `/setup` để tạo admin đầu tiên. Sau đó đăng nhập tại `/login`. Không có đăng ký công khai.

Liên kết khảo sát công khai: `/s/{public_slug}`.
