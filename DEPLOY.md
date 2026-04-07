# 汉字学 — Hướng dẫn Deploy đầy đủ
## Cloudflare Pages + Worker + D1 Database

---

## Tổng quan kiến trúc

```
Người dùng (browser)
    │
    ├─► Cloudflare Pages (hanzihoc.pages.dev)
    │     ├── index.html         ← App học từ vựng
    │     ├── admin/index.html   ← Trang quản trị (admin)
    │     └── data/hsk_vocab.json ← Data backup (offline)
    │
    └─► Cloudflare Worker (hanzihoc-api.*.workers.dev)
          └─► D1 Database (hanzihoc-db)
                ├── users          ← Tài khoản người dùng
                ├── vocabulary     ← Từ vựng (do admin quản lý)
                ├── learned_words  ← Từ đã học của mỗi user
                └── user_stats     ← Streak, điểm...
```

---

## PHẦN 1: Tạo D1 Database & Worker

### Bước 1: Cài đặt Wrangler CLI

```bash
npm install -g wrangler

# Đăng nhập vào Cloudflare
wrangler login
```

### Bước 2: Tạo D1 Database

```bash
# Tạo database
wrangler d1 create hanzihoc-db

# Lệnh này sẽ in ra:
# ✅ Successfully created DB 'hanzihoc-db'
# database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
# ← Copy database_id này!
```

### Bước 3: Cập nhật wrangler.toml

Mở file `worker/wrangler.toml`, thay `REPLACE_WITH_YOUR_D1_DATABASE_ID`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "hanzihoc-db"
database_id = "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"  # ← Dán ID vào đây
```

### Bước 4: Khởi tạo Database Schema

```bash
cd worker

# Chạy schema để tạo bảng
wrangler d1 execute hanzihoc-db --file=./schema.sql
```

### Bước 5: Import từ vựng vào D1

```bash
# Tạo file import-vocab.js để seed data từ hsk_vocab.json
node -e "
const fs = require('fs');
const data = JSON.parse(fs.readFileSync('../data/hsk_vocab.json', 'utf8'));
const sqls = data.words.map(w =>
  \`INSERT OR IGNORE INTO vocabulary (hanzi,pinyin,meaning,topic_id,hsk_level,created_at) VALUES ('\${w.h.replace(/'/g,\"''\")}','\${w.p.replace(/'/g,\"''\")}','\${w.v.replace(/'/g,\"''\")}','\${w.t}',\${w.l},\${Date.now()});\`
);
fs.writeFileSync('seed_vocab.sql', sqls.join('\n'));
console.log('Generated', sqls.length, 'INSERT statements');
"

wrangler d1 execute hanzihoc-db --file=./seed_vocab.sql
```

### Bước 6: Deploy Worker

```bash
cd worker
wrangler deploy

# Output:
# ✅ Deployed to: hanzihoc-api.YOURNAME.workers.dev
# ← Copy URL này!
```

---

## PHẦN 2: Cập nhật URL API trong code

Sau khi có URL Worker, cập nhật 2 file:

**1. `js/config.js`** — đổi URL Worker:
```javascript
const CONFIG = {
  API_URL: 'https://hanzihoc-api.YOURNAME.workers.dev',
};
```

**2. `admin/js/admin.js`** — dòng đầu, đổi URL:
```javascript
const API = 'https://hanzihoc-api.YOURNAME.workers.dev';
```

---

## PHẦN 3: Deploy Frontend lên Cloudflare Pages

### Bước 1: Push lên GitHub

```bash
git init
git add .
git commit -m "Initial commit - HanziHoc"
git remote add origin https://github.com/USERNAME/hanzihoc.git
git push -u origin main
```

### Bước 2: Kết nối Cloudflare Pages

1. Vào https://dash.cloudflare.com
2. **Workers & Pages** → **Pages** → **Connect to Git**
3. Chọn GitHub → Authorize → Chọn repo `hanzihoc`
4. Cài đặt build:
   - Framework preset: **None**
   - Build command: *(để trống)*
   - Build output directory: *(để trống)*
5. **Save and Deploy**

→ URL: `https://hanzihoc.pages.dev`

---

## PHẦN 4: Tạo tài khoản Admin đầu tiên

Tài khoản đầu tiên đăng ký sẽ tự động là **admin**.

1. Mở `https://hanzihoc.pages.dev`
2. Nhấn "Đăng ký" → điền thông tin
3. Tài khoản này = admin

Để vào trang quản trị:
- `https://hanzihoc.pages.dev/admin/`

---

## PHẦN 5: Sử dụng Admin Panel

### Thêm từng từ thủ công
1. Vào `/admin/` → đăng nhập
2. Menu **"Thêm từ"**
3. Điền Chữ Hán, Pinyin, Nghĩa, Chủ đề, Cấp HSK
4. Nhấn "Thêm từ vựng"

### Import từ Excel
1. Menu **"Import Excel"**
2. Tải file mẫu `.xlsx`
3. Điền theo format:

| hanzi | pinyin | meaning | topic_id | hsk_level |
|-------|--------|---------|----------|-----------|
| 你好 | nǐ hǎo | Xin chào | chao_hoi | 1 |
| 谢谢 | xiè xie | Cảm ơn | chao_hoi | 1 |

4. Upload file → Xem trước → Xác nhận

### Danh sách topic_id hợp lệ
```
chao_hoi, so_dem, thoi_gian, gia_dinh, am_thuc, dia_diem,
hoc_tap, dong_tu, tinh_tu, ngu_phap, cong_viec, suc_khoe,
mua_sam, thoi_tiet, giai_tri, kinh_doanh, du_lich, giao_duc,
cam_xuc, thien_nhien, xa_hoi, cong_nghe, y_hoc, quan_he,
van_hoc, hoc_thuat, kinh_te, khoa_hoc, chinh_tri, tam_ly,
thanh_ngu, nha_cua, kien_truc, quan_ly
```

---

## PHẦN 6: Test local trước khi deploy

```bash
# Terminal 1: Chạy Worker local
cd worker
wrangler dev --local

# Terminal 2: Chạy frontend
cd ..   # quay về thư mục gốc hanzihoc/
python3 -m http.server 8080

# Mở browser: http://localhost:8080
```

---

## PHẦN 7: Phân quyền Admin cho user khác

Trong Admin Panel → **Người dùng** → Nhấn **"→ Admin"** bên cạnh user cần phân quyền.

Hoặc qua Wrangler:
```bash
wrangler d1 execute hanzihoc-db --command="UPDATE users SET role='admin' WHERE email='user@example.com';"
```

---

## Tóm tắt nhanh (5 lệnh deploy)

```bash
# 1. Cài wrangler
npm install -g wrangler && wrangler login

# 2. Tạo D1
wrangler d1 create hanzihoc-db
# → Copy database_id vào worker/wrangler.toml

# 3. Khởi tạo DB
cd worker && wrangler d1 execute hanzihoc-db --file=./schema.sql

# 4. Deploy Worker
wrangler deploy
# → Copy URL Worker vào js/config.js và admin/js/admin.js

# 5. Push GitHub → Cloudflare Pages tự deploy
git add . && git commit -m "deploy" && git push
```
