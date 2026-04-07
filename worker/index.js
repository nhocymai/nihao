/**
 * HANZIHOC - Cloudflare Worker API
 * Routes:
 *   POST /api/auth/register
 *   POST /api/auth/login
 *   GET  /api/user/progress          [auth]
 *   POST /api/user/progress          [auth]  bulk save learned words
 *   GET  /api/vocab?topic=&level=    [auth]
 *   POST /api/admin/vocab            [admin] add single word
 *   POST /api/admin/vocab/bulk       [admin] bulk import
 *   PUT  /api/admin/vocab/:id        [admin] update word
 *   DELETE /api/admin/vocab/:id      [admin] delete word
 *   GET  /api/admin/users            [admin] list users
 *   POST /api/admin/promote          [admin] promote user to admin
 */

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
};

// ─── helpers ───────────────────────────────────────────
function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...CORS },
  });
}
function err(msg, status = 400) { return json({ error: msg }, status); }

async function hashPassword(pass) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pass + 'hanzihoc_salt'));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
}

async function makeToken(userId) {
  const payload = btoa(JSON.stringify({ uid: userId, exp: Date.now() + 30*24*60*60*1000 }));
  const sig = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(payload + 'hanzihoc_jwt_secret'));
  const sigHex = Array.from(new Uint8Array(sig)).map(b=>b.toString(16).padStart(2,'0')).join('');
  return payload + '.' + sigHex;
}

async function verifyToken(token, db) {
  if (!token) return null;
  try {
    const [payload] = token.split('.');
    const data = JSON.parse(atob(payload));
    if (data.exp < Date.now()) return null;
    const user = await db.prepare('SELECT * FROM users WHERE id=?').bind(data.uid).first();
    return user || null;
  } catch { return null; }
}

function getToken(request) {
  const auth = request.headers.get('Authorization') || '';
  return auth.startsWith('Bearer ') ? auth.slice(7) : null;
}

async function requireAuth(request, db) {
  const user = await verifyToken(getToken(request), db);
  if (!user) throw { status: 401, message: 'Unauthorized' };
  return user;
}

async function requireAdmin(request, db) {
  const user = await requireAuth(request, db);
  if (user.role !== 'admin') throw { status: 403, message: 'Admin only' };
  return user;
}

// ─── router ────────────────────────────────────────────
export default {
  async fetch(request, env) {
    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: CORS });
    }

    const url = new URL(request.url);
    const path = url.pathname;
    const db = env.DB;

    try {
      // ── AUTH ──
      if (path === '/api/auth/register' && request.method === 'POST') {
        const { email, name, password } = await request.json();
        if (!email || !name || !password) return err('Thiếu thông tin');
        if (password.length < 6) return err('Mật khẩu phải có ít nhất 6 ký tự');
        const exists = await db.prepare('SELECT id FROM users WHERE email=?').bind(email.toLowerCase()).first();
        if (exists) return err('Email đã được đăng ký');
        const hash = await hashPassword(password);
        // First user becomes admin
        const count = await db.prepare('SELECT COUNT(*) as c FROM users').first();
        const role = count.c === 0 ? 'admin' : 'user';
        const result = await db.prepare(
          'INSERT INTO users (email, name, password_hash, role, created_at) VALUES (?,?,?,?,?) RETURNING id'
        ).bind(email.toLowerCase(), name, hash, role, Date.now()).first();
        const token = await makeToken(result.id);
        return json({ token, user: { id: result.id, email, name, role } });
      }

      if (path === '/api/auth/login' && request.method === 'POST') {
        const { email, password } = await request.json();
        if (!email || !password) return err('Thiếu thông tin');
        const user = await db.prepare('SELECT * FROM users WHERE email=?').bind(email.toLowerCase()).first();
        if (!user) return err('Email chưa được đăng ký');
        const hash = await hashPassword(password);
        if (user.password_hash !== hash) return err('Mật khẩu không đúng');
        const token = await makeToken(user.id);
        return json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role } });
      }

      // ── USER PROGRESS ──
      if (path === '/api/user/progress' && request.method === 'GET') {
        const user = await requireAuth(request, db);
        const rows = await db.prepare(
          'SELECT word_key, hanzi, pinyin, meaning, topic_id, hsk_level, learned_at FROM learned_words WHERE user_id=?'
        ).bind(user.id).all();
        const stats = await db.prepare(
          'SELECT today_count, streak, last_date, quiz_count FROM user_stats WHERE user_id=?'
        ).bind(user.id).first();
        return json({ learned: rows.results, stats: stats || {} });
      }

      if (path === '/api/user/progress' && request.method === 'POST') {
        const user = await requireAuth(request, db);
        const { learned, stats } = await request.json();

        // Bulk upsert learned words
        if (learned && learned.length > 0) {
          const stmt = db.prepare(
            `INSERT OR IGNORE INTO learned_words
             (user_id, word_key, hanzi, pinyin, meaning, topic_id, hsk_level, learned_at)
             VALUES (?,?,?,?,?,?,?,?)`
          );
          const batch = learned.map(w => stmt.bind(
            user.id, w.word_key, w.hanzi, w.pinyin, w.meaning, w.topic_id, w.hsk_level, w.learned_at
          ));
          await db.batch(batch);
        }

        // Upsert stats
        if (stats) {
          await db.prepare(
            `INSERT INTO user_stats (user_id, today_count, streak, last_date, quiz_count)
             VALUES (?,?,?,?,?)
             ON CONFLICT(user_id) DO UPDATE SET
               today_count=excluded.today_count,
               streak=excluded.streak,
               last_date=excluded.last_date,
               quiz_count=excluded.quiz_count`
          ).bind(user.id, stats.todayCount||0, stats.streak||0, stats.lastDate||'', stats.quizCount||0).run();
        }

        return json({ ok: true });
      }

      // ── VOCAB (read) ──
      if (path === '/api/vocab' && request.method === 'GET') {
        await requireAuth(request, db);
        const topic = url.searchParams.get('topic');
        const level = url.searchParams.get('level');
        let query = 'SELECT * FROM vocabulary WHERE 1=1';
        const params = [];
        if (topic) { query += ' AND topic_id=?'; params.push(topic); }
        if (level) { query += ' AND hsk_level=?'; params.push(parseInt(level)); }
        query += ' ORDER BY hsk_level, id';
        const rows = await db.prepare(query).bind(...params).all();
        return json({ words: rows.results });
      }

      // ── ADMIN: VOCAB MANAGEMENT ──
      if (path === '/api/admin/vocab' && request.method === 'POST') {
        await requireAdmin(request, db);
        const { hanzi, pinyin, meaning, topic_id, hsk_level } = await request.json();
        if (!hanzi || !pinyin || !meaning || !topic_id || !hsk_level) return err('Thiếu thông tin từ vựng');
        const exists = await db.prepare('SELECT id FROM vocabulary WHERE hanzi=? AND topic_id=?').bind(hanzi, topic_id).first();
        if (exists) return err('Từ này đã tồn tại trong chủ đề');
        const result = await db.prepare(
          'INSERT INTO vocabulary (hanzi, pinyin, meaning, topic_id, hsk_level, created_at) VALUES (?,?,?,?,?,?) RETURNING id'
        ).bind(hanzi, pinyin, meaning, topic_id, parseInt(hsk_level), Date.now()).first();
        return json({ ok: true, id: result.id });
      }

      if (path === '/api/admin/vocab/bulk' && request.method === 'POST') {
        await requireAdmin(request, db);
        const { words } = await request.json();
        if (!Array.isArray(words) || words.length === 0) return err('Danh sách trống');
        let added = 0, skipped = 0;
        const stmt = db.prepare(
          'INSERT OR IGNORE INTO vocabulary (hanzi, pinyin, meaning, topic_id, hsk_level, created_at) VALUES (?,?,?,?,?,?)'
        );
        const batch = words.map(w => {
          if (!w.hanzi || !w.pinyin || !w.meaning || !w.topic_id || !w.hsk_level) { skipped++; return null; }
          added++;
          return stmt.bind(w.hanzi, w.pinyin, w.meaning, w.topic_id, parseInt(w.hsk_level)||1, Date.now());
        }).filter(Boolean);
        if (batch.length > 0) await db.batch(batch);
        return json({ ok: true, added: batch.length, skipped: words.length - batch.length });
      }

      // PUT /api/admin/vocab/:id
      if (path.startsWith('/api/admin/vocab/') && request.method === 'PUT') {
        await requireAdmin(request, db);
        const id = path.split('/').pop();
        const { hanzi, pinyin, meaning, topic_id, hsk_level } = await request.json();
        await db.prepare(
          'UPDATE vocabulary SET hanzi=?, pinyin=?, meaning=?, topic_id=?, hsk_level=? WHERE id=?'
        ).bind(hanzi, pinyin, meaning, topic_id, parseInt(hsk_level), parseInt(id)).run();
        return json({ ok: true });
      }

      // DELETE /api/admin/vocab/:id
      if (path.startsWith('/api/admin/vocab/') && request.method === 'DELETE') {
        await requireAdmin(request, db);
        const id = path.split('/').pop();
        await db.prepare('DELETE FROM vocabulary WHERE id=?').bind(parseInt(id)).run();
        return json({ ok: true });
      }

      // ── ADMIN: USER MANAGEMENT ──
      if (path === '/api/admin/users' && request.method === 'GET') {
        await requireAdmin(request, db);
        const users = await db.prepare(
          `SELECT u.id, u.email, u.name, u.role, u.created_at,
           COUNT(lw.id) as learned_count
           FROM users u
           LEFT JOIN learned_words lw ON lw.user_id=u.id
           GROUP BY u.id ORDER BY u.created_at DESC`
        ).all();
        return json({ users: users.results });
      }

      if (path === '/api/admin/promote' && request.method === 'POST') {
        await requireAdmin(request, db);
        const { email, role } = await request.json();
        await db.prepare('UPDATE users SET role=? WHERE email=?').bind(role||'admin', email).run();
        return json({ ok: true });
      }

      // ── ADMIN: STATS ──
      if (path === '/api/admin/stats' && request.method === 'GET') {
        await requireAdmin(request, db);
        const vocabCount = await db.prepare('SELECT COUNT(*) as c FROM vocabulary').first();
        const userCount  = await db.prepare('SELECT COUNT(*) as c FROM users').first();
        const learnedCount = await db.prepare('SELECT COUNT(*) as c FROM learned_words').first();
        const topicCount = await db.prepare('SELECT COUNT(DISTINCT topic_id) as c FROM vocabulary').first();
        return json({
          vocab: vocabCount.c,
          users: userCount.c,
          learned: learnedCount.c,
          topics: topicCount.c,
        });
      }

      return err('Not found', 404);

    } catch (e) {
      if (e.status) return err(e.message, e.status);
      console.error(e);
      return err('Internal server error', 500);
    }
  }
};
