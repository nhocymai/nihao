-- =============================================
-- HANZIHOC - D1 Database Schema
-- Chạy file này để khởi tạo database
-- =============================================

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  email         TEXT    UNIQUE NOT NULL,
  name          TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  role          TEXT    NOT NULL DEFAULT 'user',  -- 'user' | 'admin'
  created_at    INTEGER NOT NULL
);

-- Vocabulary table (managed by admin)
CREATE TABLE IF NOT EXISTS vocabulary (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  hanzi      TEXT    NOT NULL,
  pinyin     TEXT    NOT NULL,
  meaning    TEXT    NOT NULL,
  topic_id   TEXT    NOT NULL,
  hsk_level  INTEGER NOT NULL DEFAULT 1,
  created_at INTEGER NOT NULL
);

-- Topics metadata
CREATE TABLE IF NOT EXISTS topics (
  id   TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  icon TEXT NOT NULL DEFAULT '📚'
);

-- Learned words per user
CREATE TABLE IF NOT EXISTS learned_words (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  word_key   TEXT    NOT NULL,
  hanzi      TEXT    NOT NULL,
  pinyin     TEXT    NOT NULL,
  meaning    TEXT    NOT NULL,
  topic_id   TEXT    NOT NULL,
  hsk_level  INTEGER NOT NULL DEFAULT 1,
  learned_at INTEGER NOT NULL,
  UNIQUE(user_id, word_key)
);

-- User statistics
CREATE TABLE IF NOT EXISTS user_stats (
  user_id     INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  today_count INTEGER NOT NULL DEFAULT 0,
  streak      INTEGER NOT NULL DEFAULT 0,
  last_date   TEXT    NOT NULL DEFAULT '',
  quiz_count  INTEGER NOT NULL DEFAULT 0
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_vocab_topic    ON vocabulary(topic_id);
CREATE INDEX IF NOT EXISTS idx_vocab_level    ON vocabulary(hsk_level);
CREATE INDEX IF NOT EXISTS idx_learned_user   ON learned_words(user_id);
CREATE INDEX IF NOT EXISTS idx_learned_key    ON learned_words(user_id, word_key);

-- =============================================
-- Seed: Topics metadata
-- =============================================
INSERT OR IGNORE INTO topics VALUES ('chao_hoi',    'Chào hỏi & Giao tiếp',    '👋');
INSERT OR IGNORE INTO topics VALUES ('so_dem',      'Số đếm',                  '🔢');
INSERT OR IGNORE INTO topics VALUES ('thoi_gian',   'Thời gian',               '🕐');
INSERT OR IGNORE INTO topics VALUES ('gia_dinh',    'Gia đình',                '👨‍👩‍👧');
INSERT OR IGNORE INTO topics VALUES ('am_thuc',     'Ẩm thực',                 '🍜');
INSERT OR IGNORE INTO topics VALUES ('dia_diem',    'Địa điểm & Di chuyển',    '📍');
INSERT OR IGNORE INTO topics VALUES ('hoc_tap',     'Học tập',                 '📚');
INSERT OR IGNORE INTO topics VALUES ('dong_tu',     'Động từ cơ bản',          '⚡');
INSERT OR IGNORE INTO topics VALUES ('tinh_tu',     'Tính từ cơ bản',          '✨');
INSERT OR IGNORE INTO topics VALUES ('ngu_phap',    'Ngữ pháp & Liên từ',      '📝');
INSERT OR IGNORE INTO topics VALUES ('cong_viec',   'Công việc & Văn phòng',   '💼');
INSERT OR IGNORE INTO topics VALUES ('suc_khoe',    'Sức khỏe',                '💊');
INSERT OR IGNORE INTO topics VALUES ('mua_sam',     'Mua sắm',                 '🛍️');
INSERT OR IGNORE INTO topics VALUES ('thoi_tiet',   'Thời tiết & Mùa',        '🌤️');
INSERT OR IGNORE INTO topics VALUES ('giai_tri',    'Giải trí',                '🎵');
INSERT OR IGNORE INTO topics VALUES ('kinh_doanh',  'Kinh doanh',              '📊');
INSERT OR IGNORE INTO topics VALUES ('du_lich',     'Du lịch & Giao thông',    '✈️');
INSERT OR IGNORE INTO topics VALUES ('giao_duc',    'Giáo dục',                '🎓');
INSERT OR IGNORE INTO topics VALUES ('cam_xuc',     'Cảm xúc & Tâm lý',       '❤️');
INSERT OR IGNORE INTO topics VALUES ('thien_nhien', 'Thiên nhiên & Môi trường','🌿');
INSERT OR IGNORE INTO topics VALUES ('xa_hoi',      'Xã hội & Chính trị',      '🏛️');
INSERT OR IGNORE INTO topics VALUES ('cong_nghe',   'Khoa học & Công nghệ',    '💻');
INSERT OR IGNORE INTO topics VALUES ('y_hoc',       'Y học',                   '🏥');
INSERT OR IGNORE INTO topics VALUES ('quan_he',     'Quan hệ xã hội',          '🤝');
INSERT OR IGNORE INTO topics VALUES ('van_hoc',     'Nghệ thuật & Văn học',    '🎨');
INSERT OR IGNORE INTO topics VALUES ('hoc_thuat',   'Học thuật & Triết học',   '🔬');
INSERT OR IGNORE INTO topics VALUES ('kinh_te',     'Kinh tế & Tài chính',     '💰');
INSERT OR IGNORE INTO topics VALUES ('khoa_hoc',    'Khoa học tự nhiên',       '⚗️');
INSERT OR IGNORE INTO topics VALUES ('chinh_tri',   'Chính trị & Quốc tế',     '🌐');
INSERT OR IGNORE INTO topics VALUES ('tam_ly',      'Tâm lý học',              '🧠');
INSERT OR IGNORE INTO topics VALUES ('thanh_ngu',   'Thành ngữ & Tục ngữ',     '📜');
INSERT OR IGNORE INTO topics VALUES ('nha_cua',     'Nhà cửa & Đồ dùng',       '🏠');
INSERT OR IGNORE INTO topics VALUES ('kien_truc',   'Đô thị & Kiến trúc',      '🏙️');
INSERT OR IGNORE INTO topics VALUES ('quan_ly',     'Quản trị & Lãnh đạo',     '👔');
