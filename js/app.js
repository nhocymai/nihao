/* =============================================
   HANZIHOC - APP.JS
   Dữ liệu từ /data/hsk_vocab.json (local)
   ============================================= */

const App = (() => {

  // ─────────────────────────────
  //  STATE
  // ─────────────────────────────
  let vocabData = null;          // loaded from JSON
  let currentUser = null;        // { email, name, data: {...} }
  let currentTopic = null;       // topic id studying
  let studyQueue = [];           // words not yet learned in current topic
  let studyIdx = 0;
  let quizWords = [];
  let quizIdx = 0;
  let quizScore = 0;
  let activeHskFilter = 0;       // 0 = all
  let learnedTopicFilter = null;
  let visState = { hz: true, py: true, vn: true };

  // HSK level colors
  const HSK_COLORS = {
    1: { bg:'#E1F5EE', text:'#085041', label:'HSK 1' },
    2: { bg:'#EAF3DE', text:'#27500A', label:'HSK 2' },
    3: { bg:'#FAEEDA', text:'#633806', label:'HSK 3' },
    4: { bg:'#FCEBEB', text:'#791F1F', label:'HSK 4' },
    5: { bg:'#FEF0F0', text:'#A32D2D', label:'HSK 5' },
    6: { bg:'#F1EFE8', text:'#2C2C2A', label:'HSK 6' },
  };

  // ─────────────────────────────
  //  INIT
  // ─────────────────────────────
  async function init() {
    try {
      const res = await fetch('data/hsk_vocab.json');
      vocabData = await res.json();
    } catch(e) {
      alert('Không tải được dữ liệu từ vựng. Hãy chạy qua server HTTP!');
      return;
    }
    // Check saved session
    const saved = localStorage.getItem('hanzihoc_session');
    if (saved) {
      try {
        currentUser = JSON.parse(saved);
        showApp();
        return;
      } catch(e) {}
    }
    document.getElementById('login-screen').style.display = 'flex';
  }

  // ─────────────────────────────
  //  AUTH
  // ─────────────────────────────
  function getUsers() {
    try { return JSON.parse(localStorage.getItem('hanzihoc_users') || '{}'); } catch(e) { return {}; }
  }
  function saveUsers(u) { localStorage.setItem('hanzihoc_users', JSON.stringify(u)); }

  function login() {
    const email = document.getElementById('login-email').value.trim();
    const pass  = document.getElementById('login-pass').value;
    const errEl = document.getElementById('login-error');
    errEl.style.display = 'none';
    if (!email || !pass) { showErr(errEl, 'Vui lòng nhập đầy đủ thông tin'); return; }
    const users = getUsers();
    if (!users[email]) { showErr(errEl, 'Email chưa được đăng ký'); return; }
    if (users[email].pass !== btoa(pass)) { showErr(errEl, 'Mật khẩu không đúng'); return; }
    currentUser = { email, name: users[email].name, data: users[email].userData || defaultUserData() };
    localStorage.setItem('hanzihoc_session', JSON.stringify(currentUser));
    showApp();
  }

  function register() {
    const name  = document.getElementById('reg-name').value.trim();
    const email = document.getElementById('reg-email').value.trim();
    const pass  = document.getElementById('reg-pass').value;
    const errEl = document.getElementById('reg-error');
    errEl.style.display = 'none';
    if (!name || !email || !pass) { showErr(errEl, 'Vui lòng nhập đầy đủ thông tin'); return; }
    if (pass.length < 6) { showErr(errEl, 'Mật khẩu phải có ít nhất 6 ký tự'); return; }
    const users = getUsers();
    if (users[email]) { showErr(errEl, 'Email này đã được đăng ký'); return; }
    users[email] = { name, pass: btoa(pass), userData: defaultUserData() };
    saveUsers(users);
    currentUser = { email, name, data: defaultUserData() };
    localStorage.setItem('hanzihoc_session', JSON.stringify(currentUser));
    showApp();
  }

  function logout() {
    saveUserData();
    localStorage.removeItem('hanzihoc_session');
    currentUser = null;
    document.getElementById('main-app').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('login-email').value = '';
    document.getElementById('login-pass').value = '';
  }

  function defaultUserData() {
    return { learned: {}, todayCount: 0, lastDate: today(), streak: 0, quizCount: 0 };
  }

  function saveUserData() {
    if (!currentUser) return;
    const users = getUsers();
    if (users[currentUser.email]) {
      users[currentUser.email].userData = currentUser.data;
      saveUsers(users);
      localStorage.setItem('hanzihoc_session', JSON.stringify(currentUser));
    }
  }

  function showErr(el, msg) { el.textContent = msg; el.style.display = 'block'; }
  function showLogin() {
    document.getElementById('login-form').style.display = 'block';
    document.getElementById('register-form').style.display = 'none';
  }
  function showRegister() {
    document.getElementById('login-form').style.display = 'none';
    document.getElementById('register-form').style.display = 'block';
  }

  // ─────────────────────────────
  //  APP INIT AFTER LOGIN
  // ─────────────────────────────
  function showApp() {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('main-app').style.display = 'block';
    // Check daily reset
    checkDailyReset();
    // Update nav
    document.getElementById('nav-name').textContent = currentUser.name;
    document.getElementById('nav-avatar').textContent = currentUser.name[0].toUpperCase();
    document.getElementById('home-username').textContent = currentUser.name.split(' ').pop();
    showScreen('home');
  }

  function checkDailyReset() {
    const t = today();
    const d = currentUser.data;
    if (d.lastDate !== t) {
      if (d.lastDate === yesterday()) {
        d.streak = (d.streak || 0) + 1;
      } else {
        d.streak = 1;
      }
      d.todayCount = 0;
      d.lastDate = t;
      saveUserData();
    }
  }

  function today() { return new Date().toISOString().slice(0,10); }
  function yesterday() {
    const d = new Date(); d.setDate(d.getDate()-1);
    return d.toISOString().slice(0,10);
  }

  // ─────────────────────────────
  //  SCREEN ROUTING
  // ─────────────────────────────
  const SCREEN_NAV_MAP = {
    home:         ['sb-home','bn-home'],
    topics:       ['sb-study','bn-study'],
    study:        ['sb-study','bn-study'],
    'quiz-select':['sb-quiz','bn-quiz'],
    quiz:         ['sb-quiz','bn-quiz'],
    'quiz-result':['sb-quiz','bn-quiz'],
    learned:      ['sb-learned','bn-learned'],
    progress:     ['sb-progress'],
  };

  function showScreen(name) {
    document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.sidebar-item, .bn-item').forEach(s => s.classList.remove('active'));
    const el = document.getElementById('screen-'+name);
    if (el) el.classList.add('active');
    const navIds = SCREEN_NAV_MAP[name] || [];
    navIds.forEach(id => { const e = document.getElementById(id); if(e) e.classList.add('active'); });
    // Scroll top
    document.getElementById('main-content').scrollTop = 0;
    // Render
    if (name === 'home')         renderHome();
    if (name === 'topics')       renderTopics();
    if (name === 'quiz-select')  renderQuizSelect();
    if (name === 'learned')      renderLearnedList();
    if (name === 'progress')     renderProgress();
  }

  // ─────────────────────────────
  //  HELPERS
  // ─────────────────────────────
  function isLearned(wordKey) { return !!currentUser.data.learned[wordKey]; }
  function wordKey(w) { return w.h + '_' + w.t + '_' + w.l; }

  function getLearnedWords() { return Object.values(currentUser.data.learned); }

  function getTopicWords(topicId) {
    return vocabData.words.filter(w => w.t === topicId);
  }

  function getUnlearnedTopicWords(topicId) {
    return getTopicWords(topicId).filter(w => !isLearned(wordKey(w)));
  }

  function getTopicInfo(topicId) {
    return vocabData.topics[topicId] || { name: topicId, icon: '📚' };
  }

  function speak(text) {
    if (!('speechSynthesis' in window)) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'zh-CN'; u.rate = 0.82;
    window.speechSynthesis.speak(u);
  }

  function hskColor(level) {
    return HSK_COLORS[level] || { bg:'#F1EFE8', text:'#2C2C2A', label:'HSK '+level };
  }

  // ─────────────────────────────
  //  HOME
  // ─────────────────────────────
  function renderHome() {
    const learned = getLearnedWords();
    const d = currentUser.data;
    document.getElementById('stat-total').textContent = learned.length;
    document.getElementById('stat-today').textContent = d.todayCount || 0;
    document.getElementById('stat-streak').textContent = (d.streak || 0) + ' 🔥';
    document.getElementById('home-quiz-count').textContent = learned.length;

    // Show first 6 topics
    const container = document.getElementById('home-topics');
    container.innerHTML = '';
    const topics = getUniqueTopics().slice(0, 6);
    topics.forEach(tid => renderTopicCard(tid, container));
  }

  function getUniqueTopics() {
    const seen = new Set();
    const result = [];
    vocabData.words.forEach(w => { if (!seen.has(w.t)) { seen.add(w.t); result.push(w.t); }});
    return result;
  }

  // ─────────────────────────────
  //  TOPICS
  // ─────────────────────────────
  function renderTopics() {
    // Build HSK filters
    const filterWrap = document.getElementById('hsk-filters');
    filterWrap.innerHTML = '';
    const allBtn = mkBtn('hsk-btn' + (activeHskFilter===0?' active':''), 'Tất cả', () => { activeHskFilter=0; renderTopics(); });
    filterWrap.appendChild(allBtn);
    [1,2,3,4,5,6].forEach(lv => {
      const b = mkBtn('hsk-btn' + (activeHskFilter===lv?' active':''), 'HSK '+lv, () => { activeHskFilter=lv; renderTopics(); });
      filterWrap.appendChild(b);
    });

    const container = document.getElementById('all-topics');
    container.innerHTML = '';
    let topics = getUniqueTopics();

    // Filter by HSK level
    if (activeHskFilter > 0) {
      topics = topics.filter(tid =>
        vocabData.words.some(w => w.t === tid && w.l === activeHskFilter)
      );
    }
    topics.forEach(tid => renderTopicCard(tid, container, true));
  }

  function renderTopicCard(topicId, container, showHsk = false) {
    const info = getTopicInfo(topicId);
    const allWords = getTopicWords(topicId);
    const learnedCount = allWords.filter(w => isLearned(wordKey(w))).length;
    const unlearnedCount = allWords.length - learnedCount;
    const pct = allWords.length > 0 ? Math.round(learnedCount / allWords.length * 100) : 0;

    const card = document.createElement('div');
    card.className = 'topic-card';
    card.innerHTML = `
      <div class="tc-icon">${info.icon}</div>
      <div class="tc-name">
        ${info.name}
        ${unlearnedCount > 0 ? `<span class="tc-new-badge">${unlearnedCount} mới</span>` : ''}
      </div>
      <div class="tc-meta">${learnedCount}/${allWords.length} từ đã học</div>
      <div class="tc-bar"><div class="tc-bar-fill" style="width:${pct}%"></div></div>
    `;
    card.onclick = () => startStudy(topicId);
    container.appendChild(card);
  }

  // ─────────────────────────────
  //  STUDY
  // ─────────────────────────────
  function startStudy(topicId) {
    currentTopic = topicId;
    const unlearned = getUnlearnedTopicWords(topicId);
    studyQueue = [...unlearned];
    studyIdx = 0;

    showScreen('study');
    const info = getTopicInfo(topicId);
    document.getElementById('study-topic-label').textContent = info.icon + ' ' + info.name;

    // Reset visibility toggles to default
    visState = { hz: true, py: true, vn: true };
    updateVisButtons();
    updateCardVisibility();

    // Show done notice or first word
    if (studyQueue.length === 0) {
      showStudyDone(topicId);
    } else {
      hideStudyDone();
      showStudyWord();
    }
  }

  function showStudyWord() {
    if (studyIdx >= studyQueue.length) {
      showStudyDone(currentTopic);
      return;
    }
    const w = studyQueue[studyIdx];
    document.getElementById('fc-hanzi').textContent = w.h;
    document.getElementById('fc-pinyin').textContent = w.p;
    document.getElementById('fc-meaning').textContent = w.v;

    const total = studyQueue.length;
    const pct = Math.round(studyIdx / total * 100);
    document.getElementById('study-prog-fill').style.width = pct + '%';
    document.getElementById('study-count').textContent = (studyIdx+1) + ' / ' + total;

    // Auto speak
    setTimeout(() => speak(w.h), 300);
  }

  function speakCurrent() {
    if (studyIdx < studyQueue.length) speak(studyQueue[studyIdx].h);
  }

  function markWord(known) {
    if (studyIdx >= studyQueue.length) return;
    const w = studyQueue[studyIdx];
    if (known) {
      const key = wordKey(w);
      if (!isLearned(key)) {
        currentUser.data.learned[key] = {
          ...w, learnedAt: Date.now(), topicId: currentTopic
        };
        currentUser.data.todayCount = (currentUser.data.todayCount || 0) + 1;
        saveUserData();
      }
    }
    studyIdx++;
    if (studyIdx >= studyQueue.length) {
      showStudyDone(currentTopic);
    } else {
      showStudyWord();
    }
  }

  function showStudyDone(topicId) {
    const allWords = getTopicWords(topicId);
    const learnedCount = allWords.filter(w => isLearned(wordKey(w))).length;
    document.getElementById('study-prog-fill').style.width = '100%';
    document.getElementById('study-count').textContent = learnedCount + ' / ' + allWords.length;

    document.getElementById('study-done-notice').style.display = 'block';
    document.getElementById('flashcard').style.display = 'none';
    document.getElementById('card-actions') && (document.getElementById('card-actions').style.display = 'none');
    document.querySelector('.card-actions').style.display = 'none';
    document.querySelector('.visibility-toggles').style.display = 'none';

    const info = getTopicInfo(topicId);
    document.getElementById('done-sub-text').textContent =
      `Đã học ${learnedCount}/${allWords.length} từ trong chủ đề "${info.name}"`;
  }

  function hideStudyDone() {
    document.getElementById('study-done-notice').style.display = 'none';
    document.getElementById('flashcard').style.display = 'flex';
    document.querySelector('.card-actions').style.display = 'flex';
    document.querySelector('.visibility-toggles').style.display = 'flex';
  }

  // ─────────────────────────────
  //  VISIBILITY TOGGLES
  // ─────────────────────────────
  function toggleVis(key) {
    visState[key] = !visState[key];
    updateVisButtons();
    updateCardVisibility();
  }

  function updateVisButtons() {
    ['hz','py','vn'].forEach(k => {
      const btn = document.getElementById('vis-'+k);
      if (btn) btn.classList.toggle('active', visState[k]);
    });
  }

  function updateCardVisibility() {
    const hanziEl   = document.getElementById('fc-hanzi');
    const pinyinEl  = document.getElementById('fc-pinyin');
    const meaningEl = document.getElementById('fc-meaning');
    if (hanziEl)   hanziEl.classList.toggle('fc-hidden', !visState.hz);
    if (pinyinEl)  pinyinEl.classList.toggle('fc-hidden', !visState.py);
    if (meaningEl) meaningEl.classList.toggle('fc-hidden', !visState.vn);
  }

  // ─────────────────────────────
  //  QUIZ
  // ─────────────────────────────
  function renderQuizSelect() {
    const learned = getLearnedWords();
    const noWordsEl = document.getElementById('quiz-no-words');
    const modeList  = document.getElementById('quiz-mode-list');
    modeList.innerHTML = '';

    if (learned.length < 4) {
      noWordsEl.style.display = 'block';
      return;
    }
    noWordsEl.style.display = 'none';

    const modes = [
      {
        icon: '🎯',
        name: 'Trắc nghiệm (tất cả)',
        desc: `Kiểm tra toàn bộ ${learned.length} từ đã học`,
        fn: () => startQuiz('all')
      },
      {
        icon: '⚡',
        name: 'Kiểm tra nhanh (20 từ)',
        desc: '20 từ ngẫu nhiên từ danh sách đã học',
        fn: () => startQuiz('quick20')
      },
      {
        icon: '🔥',
        name: 'Kiểm tra siêu nhanh (10 từ)',
        desc: '10 từ, luyện phản xạ',
        fn: () => startQuiz('quick10')
      },
      {
        icon: '📚',
        name: 'Theo chủ đề',
        desc: 'Chọn chủ đề cụ thể để kiểm tra',
        fn: () => startQuizTopicPick()
      },
    ];

    modes.forEach(m => {
      const card = document.createElement('div');
      card.className = 'quiz-mode-card';
      card.innerHTML = `
        <span class="qmc-icon">${m.icon}</span>
        <div>
          <div class="qmc-name">${m.name}</div>
          <div class="qmc-desc">${m.desc}</div>
        </div>
      `;
      card.onclick = m.fn;
      modeList.appendChild(card);
    });
  }

  function startQuizTopicPick() {
    // Show topic picker - simplified: pick first topic with learned words
    const learned = getLearnedWords();
    const topicIds = [...new Set(learned.map(w => w.topicId || w.t))];
    if (topicIds.length === 0) { alert('Chưa có từ nào!'); return; }

    const modeList = document.getElementById('quiz-mode-list');
    modeList.innerHTML = '<div class="screen-title" style="margin-bottom:1rem;font-size:14px;color:#6B6B6B;">Chọn chủ đề:</div>';
    topicIds.forEach(tid => {
      const info = getTopicInfo(tid);
      const count = learned.filter(w => (w.topicId||w.t) === tid).length;
      if (count < 4) return;
      const card = document.createElement('div');
      card.className = 'quiz-mode-card';
      card.innerHTML = `<span class="qmc-icon">${info.icon}</span><div><div class="qmc-name">${info.name}</div><div class="qmc-desc">${count} từ đã học trong chủ đề</div></div>`;
      card.onclick = () => startQuiz('topic', tid);
      modeList.appendChild(card);
    });
    const backBtn = document.createElement('button');
    backBtn.className = 'btn-secondary'; backBtn.style.marginTop = '1rem';
    backBtn.textContent = '← Quay lại';
    backBtn.onclick = renderQuizSelect;
    modeList.appendChild(backBtn);
  }

  function startQuiz(mode, topicId) {
    let pool = getLearnedWords();
    if (mode === 'topic' && topicId) {
      pool = pool.filter(w => (w.topicId||w.t) === topicId);
    }
    pool = pool.sort(() => Math.random() - 0.5);
    if (mode === 'quick20') pool = pool.slice(0, 20);
    if (mode === 'quick10') pool = pool.slice(0, 10);

    if (pool.length < 4) { alert('Cần ít nhất 4 từ để kiểm tra!'); return; }

    quizWords = pool;
    quizIdx = 0;
    quizScore = 0;
    showScreen('quiz');
    renderQuizQuestion();
  }

  function renderQuizQuestion() {
    if (quizIdx >= quizWords.length) { showQuizResult(); return; }

    const w = quizWords[quizIdx];
    document.getElementById('q-hanzi').textContent = w.h;
    document.getElementById('q-pinyin').textContent = w.p;

    const pct = Math.round(quizIdx / quizWords.length * 100);
    document.getElementById('quiz-prog-fill').style.width = pct + '%';
    document.getElementById('quiz-count-text').textContent = (quizIdx+1) + ' / ' + quizWords.length;

    // Build options: 1 correct + 3 wrong
    const allLearned = getLearnedWords();
    const wrong = allLearned.filter(x => x.h !== w.h).sort(() => Math.random()-0.5).slice(0, 3);
    const options = [w, ...wrong].sort(() => Math.random()-0.5);

    const optContainer = document.getElementById('quiz-options');
    optContainer.innerHTML = '';
    options.forEach(opt => {
      const btn = document.createElement('button');
      btn.className = 'quiz-opt';
      btn.textContent = opt.v;
      btn.onclick = () => checkQuizAnswer(btn, opt.h === w.h, w.h);
      optContainer.appendChild(btn);
    });

    // Auto-speak
    setTimeout(() => speak(w.h), 400);
  }

  function checkQuizAnswer(btn, correct, correctHanzi) {
    document.querySelectorAll('.quiz-opt').forEach(b => { b.onclick = null; });
    if (correct) {
      btn.classList.add('correct');
      quizScore++;
    } else {
      btn.classList.add('wrong');
      // Highlight correct
      document.querySelectorAll('.quiz-opt').forEach(b => {
        if (b.textContent === quizWords[quizIdx].v) b.classList.add('correct');
      });
    }
    setTimeout(() => { quizIdx++; renderQuizQuestion(); }, 900);
  }

  function showQuizResult() {
    currentUser.data.quizCount = (currentUser.data.quizCount || 0) + 1;
    saveUserData();

    const total = quizWords.length;
    const pct = Math.round(quizScore / total * 100);
    let emoji = '😅', msg = 'Cần ôn luyện thêm!';
    if (pct >= 90) { emoji = '🏆'; msg = 'Xuất sắc! Tuyệt vời!'; }
    else if (pct >= 75) { emoji = '🌟'; msg = 'Giỏi lắm! Tiếp tục nhé!'; }
    else if (pct >= 50) { emoji = '👍'; msg = 'Khá tốt, còn cải thiện được!'; }

    document.getElementById('res-emoji').textContent = emoji;
    document.getElementById('res-score').textContent = quizScore + '/' + total;
    document.getElementById('res-msg').textContent = msg;
    document.getElementById('res-correct').textContent = quizScore;
    document.getElementById('res-wrong').textContent = total - quizScore;
    document.getElementById('res-pct').textContent = pct + '%';
    showScreen('quiz-result');
  }

  // ─────────────────────────────
  //  LEARNED LIST
  // ─────────────────────────────
  function renderLearnedList() {
    const learned = getLearnedWords();
    const search = (document.getElementById('learned-search')?.value || '').toLowerCase();
    document.getElementById('learned-total').textContent = learned.length;

    // Filter bar (topics)
    const filterBar = document.getElementById('learned-filters');
    filterBar.innerHTML = '';
    const allTopics = [...new Set(learned.map(w => w.topicId || w.t))];

    const allBtn = mkBtn('filter-btn' + (!learnedTopicFilter ? ' active' : ''), 'Tất cả', () => { learnedTopicFilter = null; renderLearnedList(); });
    filterBar.appendChild(allBtn);
    allTopics.forEach(tid => {
      const info = getTopicInfo(tid);
      const b = mkBtn('filter-btn' + (learnedTopicFilter===tid?' active':''), info.icon+' '+info.name, () => { learnedTopicFilter = tid; renderLearnedList(); });
      filterBar.appendChild(b);
    });

    // Filter words
    let filtered = learned;
    if (learnedTopicFilter) filtered = filtered.filter(w => (w.topicId||w.t) === learnedTopicFilter);
    if (search) {
      filtered = filtered.filter(w =>
        w.h.includes(search) ||
        w.p.toLowerCase().includes(search) ||
        w.v.toLowerCase().includes(search)
      );
    }

    const wrap = document.getElementById('learned-list-wrap');
    if (filtered.length === 0) {
      wrap.innerHTML = `<div class="empty-state"><div class="empty-state-icon">${learned.length===0?'📭':'🔍'}</div><div>${learned.length===0?'Chưa có từ nào đã học':'Không tìm thấy từ phù hợp'}</div></div>`;
      return;
    }

    const list = document.createElement('div');
    list.className = 'word-list';
    filtered.sort((a,b) => (b.learnedAt||0) - (a.learnedAt||0)).forEach(w => {
      const info = getTopicInfo(w.topicId || w.t);
      const hsk = hskColor(w.l);
      const item = document.createElement('div');
      item.className = 'word-item';
      item.innerHTML = `
        <div class="wi-hanzi" title="Nhấn để nghe">${w.h}</div>
        <div class="wi-info">
          <div class="wi-pinyin">${w.p}</div>
          <div class="wi-meaning">${w.v}</div>
        </div>
        <span class="wi-level" style="background:${hsk.bg};color:${hsk.text}">${hsk.label}</span>
        <span class="wi-tag">${info.icon} ${info.name}</span>
      `;
      item.querySelector('.wi-hanzi').onclick = () => speak(w.h);
      list.appendChild(item);
    });
    wrap.innerHTML = '';
    wrap.appendChild(list);
  }

  // ─────────────────────────────
  //  PROGRESS
  // ─────────────────────────────
  function renderProgress() {
    const learned = getLearnedWords();
    const d = currentUser.data;
    document.getElementById('prog-total').textContent = learned.length;
    document.getElementById('prog-today').textContent = d.todayCount || 0;
    document.getElementById('prog-quizzes').textContent = d.quizCount || 0;

    // Topic progress
    const topicWrap = document.getElementById('topic-progress-wrap');
    topicWrap.innerHTML = '';
    const topics = getUniqueTopics();
    topics.forEach(tid => {
      const info = getTopicInfo(tid);
      const all = getTopicWords(tid);
      const lc = all.filter(w => isLearned(wordKey(w))).length;
      if (lc === 0) return;
      const pct = Math.round(lc / all.length * 100);
      const row = document.createElement('div');
      row.className = 'topic-prog-item';
      row.innerHTML = `
        <span class="tpi-icon">${info.icon}</span>
        <div class="tpi-info">
          <div class="tpi-row"><span>${info.name}</span><span class="tpi-count">${lc}/${all.length} (${pct}%)</span></div>
          <div class="tpi-bar"><div class="tpi-fill" style="width:${pct}%"></div></div>
        </div>
      `;
      topicWrap.appendChild(row);
    });
    if (!topicWrap.children.length) {
      topicWrap.innerHTML = '<div style="color:var(--text-muted);font-size:13px;">Chưa học chủ đề nào.</div>';
    }

    // HSK level progress
    const hskWrap = document.getElementById('hsk-progress-wrap');
    hskWrap.innerHTML = '';
    [1,2,3,4,5,6].forEach(lv => {
      const all = vocabData.words.filter(w => w.l === lv);
      const lc = learned.filter(w => w.l === lv).length;
      if (all.length === 0) return;
      const hsk = hskColor(lv);
      const row = document.createElement('div');
      row.className = 'hsk-level-row';
      row.innerHTML = `
        <span class="hsk-badge" style="background:${hsk.bg};color:${hsk.text}">${hsk.label}</span>
        <div style="flex:1">
          <div class="hsk-num">${lc} / ${all.length} từ</div>
          <div class="hsk-sub">${vocabData.meta.levels[lv]?.name || ''}</div>
        </div>
        <div style="font-size:13px;font-weight:500;color:var(--text-muted)">${Math.round(lc/all.length*100)}%</div>
      `;
      hskWrap.appendChild(row);
    });
  }

  // ─────────────────────────────
  //  UTILS
  // ─────────────────────────────
  function mkBtn(className, text, fn) {
    const b = document.createElement('button');
    b.className = className; b.textContent = text; b.onclick = fn;
    return b;
  }

  // ─────────────────────────────
  //  PUBLIC API
  // ─────────────────────────────
  return {
    init, login, register, logout, showLogin, showRegister,
    showScreen, startStudy, speakCurrent, markWord, toggleVis,
    renderLearnedList,
  };

})();

// Boot
window.addEventListener('DOMContentLoaded', App.init);
