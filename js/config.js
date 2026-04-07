/* ─────────────────────────────────────────────
   CONFIG - Chỉnh sửa URL API sau khi deploy
   ───────────────────────────────────────────── */
const CONFIG = {
  // Đổi thành URL Worker của bạn sau khi deploy lên Cloudflare
  // Ví dụ: 'https://hanzihoc-api.tenban.workers.dev'
  API_URL: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
    ? 'http://localhost:8787'
    : 'https://hanzihoc-api.YOUR_SUBDOMAIN.workers.dev',
};
