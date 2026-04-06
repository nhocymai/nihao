# 汉字学 - Hướng dẫn Deploy lên Cloudflare Pages

## Cấu trúc thư mục

```
hanzihoc/
├── index.html          ← Trang chính
├── css/
│   └── style.css       ← Toàn bộ CSS
├── js/
│   └── app.js          ← Logic ứng dụng
├── data/
│   └── hsk_vocab.json  ← Dữ liệu từ vựng (local, không cần server)
├── _headers            ← Cloudflare cache config
├── _redirects          ← SPA routing
└── README.md
```

---

## 🚀 Cách Deploy lên Cloudflare Pages

### Bước 1: Chuẩn bị GitHub

1. Tạo tài khoản GitHub (nếu chưa có): https://github.com
2. Tạo repository mới, đặt tên ví dụ: `hanzihoc`
3. Upload toàn bộ thư mục này lên repo:
   - Cách nhanh: kéo thả file vào giao diện GitHub web
   - Hoặc dùng terminal:
     ```bash
     git init
     git add .
     git commit -m "Initial commit"
     git remote add origin https://github.com/USERNAME/hanzihoc.git
     git push -u origin main
     ```

### Bước 2: Kết nối Cloudflare Pages

1. Đăng nhập https://dash.cloudflare.com
2. Vào menu **"Workers & Pages"** → **"Pages"**
3. Nhấn **"Connect to Git"**
4. Chọn GitHub → Authorize Cloudflare Pages
5. Chọn repository `hanzihoc`
6. Cấu hình build:
   - **Framework preset**: `None`
   - **Build command**: *(để trống)*
   - **Build output directory**: `/` hoặc để trống
7. Nhấn **"Save and Deploy"**

### Bước 3: Hoàn tất

- Cloudflare tự động deploy, sau ~1 phút bạn có URL dạng:
  `https://hanzihoc.pages.dev`
- Mỗi lần bạn push code lên GitHub, Cloudflare tự động cập nhật

---

## 🌐 Custom Domain (tùy chọn)

1. Vào project trên Cloudflare Pages → **"Custom domains"**
2. Nhấn **"Set up a custom domain"**
3. Nhập domain của bạn (ví dụ: `hanzihoc.com`)
4. Cloudflare tự cấu hình DNS và HTTPS

---

## 💾 Ghi chú về dữ liệu người dùng

- Tài khoản và từ đã học được lưu trong **localStorage** của trình duyệt
- Dữ liệu không mất khi refresh trang
- Để đồng bộ đa thiết bị: cần thêm Cloudflare D1 database (bước nâng cao)

---

## ➕ Thêm từ vựng

Mở file `data/hsk_vocab.json`, thêm từ theo format:

```json
{
  "h": "汉字",
  "p": "hàn zì",
  "v": "Chữ Hán",
  "t": "hoc_tap",
  "l": 2
}
```

- `h`: Chữ Hán
- `p`: Pinyin
- `v`: Nghĩa tiếng Việt
- `t`: Mã chủ đề (xem danh sách trong `topics`)
- `l`: Cấp độ HSK (1-6)

---

## 🔧 Test local trước khi deploy

Mở terminal trong thư mục project:
```bash
# Python 3
python3 -m http.server 8080

# Hoặc Node.js (cần cài npx)
npx serve .
```
Mở trình duyệt vào: http://localhost:8080
