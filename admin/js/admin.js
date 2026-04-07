/* =============================================
   HANZIHOC - ADMIN PANEL JS
   ============================================= */

// ── CONFIG ──────────────────────────────────────
// Đổi thành URL Worker của bạn sau khi deploy
const API = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
  ? 'http://localhost:8787'
  : 'https://hanzihoc-api.YOUR_SUBDOMAIN.workers.dev'; // ← SỬA THÀNH URL WORKER CỦA BẠN

const TOPICS = {
  chao_hoi:'Chào hỏi',so_dem:'Số đếm',thoi_gian:'Thời gian',gia_dinh:'Gia đình',
  am_thuc:'Ẩm thực',dia_diem:'Địa điểm',hoc_tap:'Học tập',dong_tu:'Động từ',
  tinh_tu:'Tính từ',ngu_phap:'Ngữ pháp',cong_viec:'Công việc',suc_khoe:'Sức khỏe',
  mua_sam:'Mua sắm',thoi_tiet:'Thời tiết',giai_tri:'Giải trí',kinh_doanh:'Kinh doanh',
  du_lich:'Du lịch',giao_duc:'Giáo dục',cam_xuc:'Cảm xúc',thien_nhien:'Thiên nhiên',
  xa_hoi:'Xã hội',cong_nghe:'Công nghệ',y_hoc:'Y học',quan_he:'Quan hệ',
  van_hoc:'Văn học',hoc_thuat:'Học thuật',kinh_te:'Kinh tế',khoa_hoc:'Khoa học',
  chinh_tri:'Chính trị',tam_ly:'Tâm lý',thanh_ngu:'Thành ngữ',nha_cua:'Nhà cửa',
  kien_truc:'Kiến trúc',quan_ly:'Quản trị',
};
const HSK_COLORS = {
  1:{bg:'#E1F5EE',text:'#085041'},2:{bg:'#EAF3DE',text:'#27500A'},
  3:{bg:'#FAEEDA',text:'#633806'},4:{bg:'#FCEBEB',text:'#791F1F'},
  5:{bg:'#FEF0F0',text:'#A32D2D'},6:{bg:'#F1EFE8',text:'#2C2C2A'},
};

// ── STATE ────────────────────────────────────────
let token = localStorage.getItem('admin_token');
let currentAdmin = JSON.parse(localStorage.getItem('admin_user') || 'null');
let allVocab = [];
let filteredVocab = [];
let currentPage = 1;
const PAGE_SIZE = 50;
let pendingImport = [];

// ── INIT ─────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  populateTopicSelects();
  setupDragDrop();
  if (token && currentAdmin) {
    showApp();
  }
});

function populateTopicSelects() {
  const selects = ['add-topic','edit-topic','vocab-filter-topic'];
  selects.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === 'vocab-filter-topic') el.innerHTML = '<option value="">Tất cả chủ đề</option>';
    else el.innerHTML = '';
    Object.entries(TOPICS).forEach(([k,v]) => {
      el.innerHTML += `<option value="${k}">${v}</option>`;
    });
  });
}

// ── AUTH ─────────────────────────────────────────
const Admin = {
  async login() {
    const email = document.getElementById('al-email').value.trim();
    const pass  = document.getElementById('al-pass').value;
    const errEl = document.getElementById('al-error');
    errEl.style.display = 'none';
    try {
      const data = await apiFetch('/api/auth/login', 'POST', { email, password: pass });
      if (data.user.role !== 'admin') {
        errEl.textContent = 'Tài khoản này không có quyền admin';
        errEl.style.display = 'block';
        return;
      }
      token = data.token;
      currentAdmin = data.user;
      localStorage.setItem('admin_token', token);
      localStorage.setItem('admin_user', JSON.stringify(currentAdmin));
      showApp();
    } catch(e) {
      errEl.textContent = e.message || 'Đăng nhập thất bại';
      errEl.style.display = 'block';
    }
  },

  logout() {
    localStorage.removeItem('admin_token');
    localStorage.removeItem('admin_user');
    token = null; currentAdmin = null;
    document.getElementById('admin-app').style.display = 'none';
    document.getElementById('admin-login').style.display = 'flex';
  },

  tab(name) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.asb-item').forEach(t => t.classList.remove('active'));
    document.getElementById('tab-'+name).classList.add('active');
    document.getElementById('asb-'+name).classList.add('active');
    if (name === 'dashboard') loadDashboard();
    if (name === 'vocab')     loadVocab();
    if (name === 'users')     loadUsers();
  },

  // ── VOCAB LIST ──────────────────────────────────
  filterVocab() {
    const search = document.getElementById('vocab-search').value.toLowerCase();
    const level  = document.getElementById('vocab-filter-level').value;
    const topic  = document.getElementById('vocab-filter-topic').value;
    filteredVocab = allVocab.filter(w => {
      const matchSearch = !search || w.hanzi.includes(search) || w.pinyin.toLowerCase().includes(search) || w.meaning.toLowerCase().includes(search);
      const matchLevel  = !level || String(w.hsk_level) === level;
      const matchTopic  = !topic || w.topic_id === topic;
      return matchSearch && matchLevel && matchTopic;
    });
    currentPage = 1;
    renderVocabTable();
  },

  // ── ADD WORD ────────────────────────────────────
  async addWord() {
    const hanzi    = document.getElementById('add-hanzi').value.trim();
    const pinyin   = document.getElementById('add-pinyin').value.trim();
    const meaning  = document.getElementById('add-meaning').value.trim();
    const topic_id = document.getElementById('add-topic').value;
    const hsk_level= document.getElementById('add-level').value;
    const msgEl = document.getElementById('add-msg');
    if (!hanzi||!pinyin||!meaning||!topic_id) {
      showMsg(msgEl,'Vui lòng điền đầy đủ thông tin','error'); return;
    }
    try {
      await apiFetch('/api/admin/vocab','POST',{hanzi,pinyin,meaning,topic_id,hsk_level});
      showMsg(msgEl,`✅ Đã thêm "${hanzi}" thành công!`,'success');
      document.getElementById('add-hanzi').value='';
      document.getElementById('add-pinyin').value='';
      document.getElementById('add-meaning').value='';
    } catch(e) { showMsg(msgEl,'❌ '+e.message,'error'); }
  },

  // ── EDIT MODAL ──────────────────────────────────
  openEdit(id) {
    const w = allVocab.find(x => x.id === id);
    if (!w) return;
    document.getElementById('edit-id').value = w.id;
    document.getElementById('edit-hanzi').value = w.hanzi;
    document.getElementById('edit-pinyin').value = w.pinyin;
    document.getElementById('edit-meaning').value = w.meaning;
    document.getElementById('edit-topic').value = w.topic_id;
    document.getElementById('edit-level').value = w.hsk_level;
    document.getElementById('edit-msg').style.display = 'none';
    document.getElementById('edit-modal').style.display = 'flex';
  },

  closeEdit() { document.getElementById('edit-modal').style.display = 'none'; },

  async saveEdit() {
    const id      = document.getElementById('edit-id').value;
    const hanzi   = document.getElementById('edit-hanzi').value.trim();
    const pinyin  = document.getElementById('edit-pinyin').value.trim();
    const meaning = document.getElementById('edit-meaning').value.trim();
    const topic_id= document.getElementById('edit-topic').value;
    const hsk_level= document.getElementById('edit-level').value;
    const msgEl = document.getElementById('edit-msg');
    try {
      await apiFetch('/api/admin/vocab/'+id,'PUT',{hanzi,pinyin,meaning,topic_id,hsk_level});
      showMsg(msgEl,'✅ Đã cập nhật!','success');
      await loadVocab();
      setTimeout(() => this.closeEdit(), 800);
    } catch(e) { showMsg(msgEl,'❌ '+e.message,'error'); }
  },

  async deleteWord(id, hanzi) {
    if (!confirm(`Xóa từ "${hanzi}"? Hành động này không thể hoàn tác.`)) return;
    try {
      await apiFetch('/api/admin/vocab/'+id,'DELETE');
      allVocab = allVocab.filter(w => w.id !== id);
      this.filterVocab();
    } catch(e) { alert('Lỗi: '+e.message); }
  },

  // ── IMPORT ──────────────────────────────────────
  handleFile(input) {
    const file = input.files[0];
    if (!file) return;
    processFile(file);
    input.value = '';
  },

  downloadTemplate() {
    if (typeof XLSX === 'undefined') { alert('Thư viện chưa tải, thử lại sau!'); return; }
    const sample = [
      { hanzi:'你好', pinyin:'nǐ hǎo', meaning:'Xin chào', topic_id:'chao_hoi', hsk_level:1 },
      { hanzi:'谢谢', pinyin:'xiè xie', meaning:'Cảm ơn', topic_id:'chao_hoi', hsk_level:1 },
      { hanzi:'学习', pinyin:'xué xí', meaning:'Học tập', topic_id:'hoc_tap', hsk_level:2 },
    ];
    const ws = XLSX.utils.json_to_sheet(sample);
    ws['!cols'] = [16,18,24,16,10].map(w=>({wch:w}));
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Từ vựng');
    XLSX.writeFile(wb, 'hanzihoc_template.xlsx');
  },

  async confirmImport() {
    if (pendingImport.length === 0) return;
    const valid = pendingImport.filter(w => w._status !== 'error');
    const msgEl = document.getElementById('import-msg');
    try {
      const res = await apiFetch('/api/admin/vocab/bulk','POST',{ words: valid });
      showMsg(msgEl, `✅ Import thành công! Đã thêm ${res.added} từ. Bỏ qua ${res.skipped} từ trùng lặp.`, 'success');
      pendingImport = [];
      setTimeout(() => { document.getElementById('import-preview').style.display='none'; }, 1500);
    } catch(e) { showMsg(msgEl,'❌ '+e.message,'error'); }
  },

  cancelImport() {
    pendingImport = [];
    document.getElementById('import-preview').style.display = 'none';
  },

  // ── USERS ───────────────────────────────────────
  async promoteUser(email) {
    const role = confirm(`Promote "${email}" lên admin?`) ? 'admin' : null;
    if (!role) return;
    try {
      await apiFetch('/api/admin/promote','POST',{ email, role });
      loadUsers();
    } catch(e) { alert('Lỗi: '+e.message); }
  },
};

// ── API ──────────────────────────────────────────
async function apiFetch(path, method='GET', body=null) {
  const opts = {
    method,
    headers: { 'Content-Type':'application/json', ...(token?{'Authorization':'Bearer '+token}:{}) },
  };
  if (body) opts.body = JSON.stringify(body);
  const res = await fetch(API+path, opts);
  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Lỗi không xác định');
  return data;
}

// ── SHOW APP ─────────────────────────────────────
function showApp() {
  document.getElementById('admin-login').style.display = 'none';
  document.getElementById('admin-app').style.display = 'block';
  document.getElementById('admin-nav-name').textContent = currentAdmin?.name || '';
  Admin.tab('dashboard');
}

// ── DASHBOARD ────────────────────────────────────
async function loadDashboard() {
  try {
    const data = await apiFetch('/api/admin/stats');
    document.getElementById('ds-vocab').textContent   = data.vocab.toLocaleString();
    document.getElementById('ds-users').textContent   = data.users.toLocaleString();
    document.getElementById('ds-learned').textContent = data.learned.toLocaleString();
    document.getElementById('ds-topics').textContent  = data.topics.toLocaleString();
  } catch(e) { console.error(e); }
}

// ── VOCAB TABLE ──────────────────────────────────
async function loadVocab() {
  try {
    const data = await apiFetch('/api/vocab');
    allVocab = data.words;
    Admin.filterVocab();
  } catch(e) { console.error('Load vocab error:', e); }
}

function renderVocabTable() {
  const total = filteredVocab.length;
  const pages = Math.ceil(total / PAGE_SIZE);
  const start = (currentPage-1)*PAGE_SIZE;
  const slice = filteredVocab.slice(start, start+PAGE_SIZE);

  document.getElementById('vocab-count').textContent =
    `Hiển thị ${start+1}–${Math.min(start+PAGE_SIZE, total)} / ${total} từ`;

  const tbody = document.getElementById('vocab-tbody');
  tbody.innerHTML = '';
  slice.forEach(w => {
    const hsk = HSK_COLORS[w.hsk_level] || {};
    const topicName = TOPICS[w.topic_id] || w.topic_id;
    tbody.innerHTML += `
      <tr>
        <td style="color:var(--text-muted)">${w.id}</td>
        <td class="hanzi-cell">${w.hanzi}</td>
        <td style="color:#E24B4A">${w.pinyin}</td>
        <td>${w.meaning}</td>
        <td>${topicName}</td>
        <td><span class="hsk-pill" style="background:${hsk.bg};color:${hsk.text}">HSK ${w.hsk_level}</span></td>
        <td>
          <button class="btn-sm-edit" onclick="Admin.openEdit(${w.id})">Sửa</button>
          <button class="btn-sm-del"  onclick="Admin.deleteWord(${w.id},'${w.hanzi}')">Xóa</button>
        </td>
      </tr>`;
  });

  // Pagination
  const pg = document.getElementById('vocab-pagination');
  pg.innerHTML = '';
  if (pages <= 1) return;
  const range = [];
  for (let i=1;i<=pages;i++) {
    if (i===1||i===pages||Math.abs(i-currentPage)<=2) range.push(i);
    else if (range[range.length-1]!=='…') range.push('…');
  }
  range.forEach(p => {
    if (p==='…') { const s=document.createElement('span');s.textContent='…';s.style.padding='6px 4px';pg.appendChild(s);return;}
    const btn = document.createElement('button');
    btn.className='pg-btn'+(currentPage===p?' active':'');
    btn.textContent=p;
    btn.onclick=()=>{ currentPage=p; renderVocabTable(); };
    pg.appendChild(btn);
  });
}

// ── USERS ────────────────────────────────────────
async function loadUsers() {
  try {
    const data = await apiFetch('/api/admin/users');
    const tbody = document.getElementById('users-tbody');
    tbody.innerHTML = '';
    data.users.forEach(u => {
      const date = new Date(u.created_at).toLocaleDateString('vi-VN');
      tbody.innerHTML += `
        <tr>
          <td style="color:var(--text-muted)">${u.id}</td>
          <td>${u.name}</td>
          <td>${u.email}</td>
          <td><span class="role-${u.role}">${u.role==='admin'?'Admin':'User'}</span></td>
          <td>${u.learned_count}</td>
          <td>${date}</td>
          <td>${u.role!=='admin'?`<button class="btn-sm-edit" onclick="Admin.promoteUser('${u.email}')">→ Admin</button>`:''}</td>
        </tr>`;
    });
  } catch(e) { console.error(e); }
}

// ── FILE IMPORT ──────────────────────────────────
function processFile(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'csv') {
    const reader = new FileReader();
    reader.onload = e => parseCSV(e.target.result);
    reader.readAsText(file, 'UTF-8');
  } else {
    const reader = new FileReader();
    reader.onload = e => {
      const wb = XLSX.read(e.target.result, { type:'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { defval:'' });
      processRows(rows);
    };
    reader.readAsArrayBuffer(file);
  }
}

function parseCSV(text) {
  const lines = text.split('\n').filter(l=>l.trim());
  const headers = lines[0].split(',').map(h=>h.trim().toLowerCase().replace(/"/g,''));
  const rows = lines.slice(1).map(line => {
    const vals = line.split(',').map(v=>v.trim().replace(/"/g,''));
    const obj = {};
    headers.forEach((h,i) => obj[h] = vals[i]||'');
    return obj;
  });
  processRows(rows);
}

function processRows(rows) {
  const REQUIRED = ['hanzi','pinyin','meaning','topic_id','hsk_level'];
  pendingImport = rows.map(r => {
    // Normalize column names (handle Vietnamese headers)
    const w = {
      hanzi:    r.hanzi    || r['chữ hán'] || r['chu han'] || '',
      pinyin:   r.pinyin   || r['pinyin']  || '',
      meaning:  r.meaning  || r['nghĩa']   || r['nghia']   || '',
      topic_id: r.topic_id || r['chủ đề']  || r['chu de']  || '',
      hsk_level:parseInt(r.hsk_level || r['cấp hsk'] || r['cap hsk'] || 1),
    };
    // Validate
    const missing = REQUIRED.filter(k => !w[k]);
    if (missing.length > 0) { w._status = 'error'; w._note = 'Thiếu: '+missing.join(', '); }
    else if (!TOPICS[w.topic_id]) { w._status = 'warn'; w._note = 'topic_id lạ: '+w.topic_id; }
    else { w._status = 'ok'; w._note = 'Hợp lệ'; }
    return w;
  }).filter(w => w.hanzi); // skip completely empty rows

  showImportPreview();
}

function showImportPreview() {
  if (pendingImport.length === 0) return;
  const ok   = pendingImport.filter(w=>w._status==='ok').length;
  const warn = pendingImport.filter(w=>w._status==='warn').length;
  const err  = pendingImport.filter(w=>w._status==='error').length;

  document.getElementById('preview-info').textContent =
    `Tổng ${pendingImport.length} từ: ${ok} hợp lệ, ${warn} cảnh báo, ${err} lỗi`;

  const tbody = document.getElementById('preview-tbody');
  tbody.innerHTML = '';
  pendingImport.slice(0, 100).forEach(w => {
    const hsk = HSK_COLORS[w.hsk_level]||{};
    const cls = w._status==='ok'?'status-ok':w._status==='warn'?'status-dup':'status-err';
    tbody.innerHTML += `
      <tr>
        <td style="font-size:18px">${w.hanzi}</td>
        <td style="color:#E24B4A">${w.pinyin}</td>
        <td>${w.meaning}</td>
        <td>${TOPICS[w.topic_id]||w.topic_id}</td>
        <td><span class="hsk-pill" style="background:${hsk.bg||'#eee'};color:${hsk.text||'#333'}">HSK ${w.hsk_level}</span></td>
        <td class="${cls}">${w._note}</td>
      </tr>`;
  });
  if (pendingImport.length > 100) {
    tbody.innerHTML += `<tr><td colspan="6" style="text-align:center;color:var(--text-muted)">...và ${pendingImport.length-100} từ khác</td></tr>`;
  }

  document.getElementById('import-msg').style.display = 'none';
  document.getElementById('import-preview').style.display = 'block';
}

// ── DRAG & DROP ──────────────────────────────────
function setupDragDrop() {
  const zone = document.getElementById('drop-zone');
  if (!zone) return;
  zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('dragging'); });
  zone.addEventListener('dragleave', () => zone.classList.remove('dragging'));
  zone.addEventListener('drop', e => {
    e.preventDefault(); zone.classList.remove('dragging');
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  });
}

// ── UTILS ─────────────────────────────────────────
function showMsg(el, msg, type) {
  el.textContent = msg;
  el.className = 'form-msg ' + type;
  el.style.display = 'block';
}
