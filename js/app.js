/* =============================================
   HANZIHOC - APP.JS v2
   - Sync với Cloudflare D1 qua Worker API
   - Fallback local JSON khi offline
   ============================================= */

const App = (() => {
  let vocabData=null, currentUser=null, currentTopic=null;
  let studyQueue=[],studyIdx=0,quizWords=[],quizIdx=0,quizScore=0;
  let activeHskFilter=0,learnedTopicFilter=null;
  let visState={hz:true,py:true,vn:true};
  let syncTimer=null;

  const HSK_COLORS={
    1:{bg:'#E1F5EE',text:'#085041',label:'HSK 1'},2:{bg:'#EAF3DE',text:'#27500A',label:'HSK 2'},
    3:{bg:'#FAEEDA',text:'#633806',label:'HSK 3'},4:{bg:'#FCEBEB',text:'#791F1F',label:'HSK 4'},
    5:{bg:'#FEF0F0',text:'#A32D2D',label:'HSK 5'},6:{bg:'#F1EFE8',text:'#2C2C2A',label:'HSK 6'},
  };
  const TOPIC_META={
    chao_hoi:{name:'Chào hỏi & Giao tiếp',icon:'👋'},so_dem:{name:'Số đếm',icon:'🔢'},
    thoi_gian:{name:'Thời gian',icon:'🕐'},gia_dinh:{name:'Gia đình',icon:'👨‍👩‍👧'},
    am_thuc:{name:'Ẩm thực',icon:'🍜'},dia_diem:{name:'Địa điểm & Di chuyển',icon:'📍'},
    hoc_tap:{name:'Học tập',icon:'📚'},dong_tu:{name:'Động từ cơ bản',icon:'⚡'},
    tinh_tu:{name:'Tính từ cơ bản',icon:'✨'},ngu_phap:{name:'Ngữ pháp & Liên từ',icon:'📝'},
    cong_viec:{name:'Công việc',icon:'💼'},suc_khoe:{name:'Sức khỏe',icon:'💊'},
    mua_sam:{name:'Mua sắm',icon:'🛍️'},thoi_tiet:{name:'Thời tiết & Mùa',icon:'🌤️'},
    giai_tri:{name:'Giải trí',icon:'🎵'},kinh_doanh:{name:'Kinh doanh',icon:'📊'},
    du_lich:{name:'Du lịch',icon:'✈️'},giao_duc:{name:'Giáo dục',icon:'🎓'},
    cam_xuc:{name:'Cảm xúc',icon:'❤️'},thien_nhien:{name:'Thiên nhiên',icon:'🌿'},
    xa_hoi:{name:'Xã hội',icon:'🏛️'},cong_nghe:{name:'Công nghệ',icon:'💻'},
    y_hoc:{name:'Y học',icon:'🏥'},quan_he:{name:'Quan hệ',icon:'🤝'},
    van_hoc:{name:'Văn học',icon:'🎨'},hoc_thuat:{name:'Học thuật',icon:'🔬'},
    kinh_te:{name:'Kinh tế',icon:'💰'},khoa_hoc:{name:'Khoa học',icon:'⚗️'},
    chinh_tri:{name:'Chính trị',icon:'🌐'},tam_ly:{name:'Tâm lý',icon:'🧠'},
    thanh_ngu:{name:'Thành ngữ',icon:'📜'},nha_cua:{name:'Nhà cửa',icon:'🏠'},
    kien_truc:{name:'Kiến trúc',icon:'🏙️'},quan_ly:{name:'Quản trị',icon:'👔'},
  };

  // ── API ──────────────────────────────────────
  const API=typeof CONFIG!=='undefined'?CONFIG.API_URL:'';
  async function apiFetch(path,method='GET',body=null){
    const h={'Content-Type':'application/json'};
    if(currentUser?.token)h['Authorization']='Bearer '+currentUser.token;
    const o={method,headers:h};if(body)o.body=JSON.stringify(body);
    const r=await fetch(API+path,o);const d=await r.json();
    if(!r.ok)throw new Error(d.error||'Lỗi');return d;
  }

  // ── INIT ─────────────────────────────────────
  async function init(){
    const saved=localStorage.getItem('hanzihoc_session');
    if(saved){try{currentUser=JSON.parse(saved);}catch(e){}}
    await loadVocabData();
    if(currentUser)showApp();else showLoginScreen();
  }

  async function loadVocabData(){
    if(currentUser){
      try{
        const data=await apiFetch('/api/vocab');
        const words=data.words.map(w=>({h:w.hanzi,p:w.pinyin,v:w.meaning,t:w.topic_id,l:w.hsk_level}));
        vocabData={words,topics:TOPIC_META,meta:{total:words.length}};return;
      }catch(e){}
    }
    try{const r=await fetch('data/hsk_vocab.json');vocabData=await r.json();}
    catch(e){alert('Không tải được dữ liệu từ vựng!');}
  }

  function showLoginScreen(){
    document.getElementById('login-screen').style.display='flex';
    document.getElementById('main-app').style.display='none';
  }

  // ── AUTH ─────────────────────────────────────
  async function login(){
    const email=document.getElementById('login-email').value.trim();
    const pass=document.getElementById('login-pass').value;
    const errEl=document.getElementById('login-error');errEl.style.display='none';
    if(!email||!pass){showErr(errEl,'Vui lòng nhập đầy đủ thông tin');return;}
    try{
      const data=await apiFetch('/api/auth/login','POST',{email,password:pass});
      currentUser={...data.user,token:data.token};
      localStorage.setItem('hanzihoc_session',JSON.stringify(currentUser));
      await loadVocabData();await loadProgressFromServer();showApp();
    }catch(e){
      if(e.message.includes('Failed to fetch')||e.message.includes('NetworkError')){
        tryLocalLogin(email,pass,errEl);
      }else{showErr(errEl,e.message);}
    }
  }

  async function register(){
    const name=document.getElementById('reg-name').value.trim();
    const email=document.getElementById('reg-email').value.trim();
    const pass=document.getElementById('reg-pass').value;
    const errEl=document.getElementById('reg-error');errEl.style.display='none';
    if(!name||!email||!pass){showErr(errEl,'Vui lòng nhập đầy đủ thông tin');return;}
    if(pass.length<6){showErr(errEl,'Mật khẩu phải có ít nhất 6 ký tự');return;}
    try{
      const data=await apiFetch('/api/auth/register','POST',{email,name,password:pass});
      currentUser={...data.user,token:data.token,data:defaultUserData()};
      localStorage.setItem('hanzihoc_session',JSON.stringify(currentUser));
      await loadVocabData();showApp();
    }catch(e){
      if(e.message.includes('Failed to fetch')||e.message.includes('NetworkError')){
        tryLocalRegister(name,email,pass,errEl);
      }else{showErr(errEl,e.message);}
    }
  }

  function tryLocalLogin(email,pass,errEl){
    const users=getLocalUsers();
    if(!users[email]){showErr(errEl,'Email chưa được đăng ký');return;}
    if(users[email].pass!==btoa(pass)){showErr(errEl,'Mật khẩu không đúng');return;}
    currentUser={email,name:users[email].name,role:users[email].role||'user',token:null};
    currentUser.data=users[email].userData||defaultUserData();
    localStorage.setItem('hanzihoc_session',JSON.stringify(currentUser));showApp();
  }

  function tryLocalRegister(name,email,pass,errEl){
    const users=getLocalUsers();
    if(users[email]){showErr(errEl,'Email đã được đăng ký');return;}
    const role=Object.keys(users).length===0?'admin':'user';
    users[email]={name,pass:btoa(pass),role,userData:defaultUserData()};
    saveLocalUsers(users);
    currentUser={email,name,role,token:null,data:defaultUserData()};
    localStorage.setItem('hanzihoc_session',JSON.stringify(currentUser));showApp();
  }

  function getLocalUsers(){try{return JSON.parse(localStorage.getItem('hanzihoc_users')||'{}');}catch(e){return{};}}
  function saveLocalUsers(u){localStorage.setItem('hanzihoc_users',JSON.stringify(u));}

  function logout(){
    syncToServer();localStorage.removeItem('hanzihoc_session');currentUser=null;
    document.getElementById('main-app').style.display='none';showLoginScreen();
    document.getElementById('login-email').value='';document.getElementById('login-pass').value='';
  }

  // ── SERVER SYNC ──────────────────────────────
  async function loadProgressFromServer(){
    if(!currentUser?.token)return;
    try{
      const data=await apiFetch('/api/user/progress');
      const learned={};
      data.learned.forEach(w=>{
        learned[w.word_key]={h:w.hanzi,p:w.pinyin,v:w.meaning,t:w.topic_id,l:w.hsk_level,learnedAt:w.learned_at,topicId:w.topic_id};
      });
      currentUser.data={
        learned,todayCount:data.stats.today_count||0,streak:data.stats.streak||0,
        lastDate:data.stats.last_date||today(),quizCount:data.stats.quiz_count||0,
      };
    }catch(e){if(!currentUser.data)currentUser.data=defaultUserData();}
  }

  async function syncToServer(){
    if(!currentUser?.token||!currentUser.data)return;
    try{
      const learned=Object.entries(currentUser.data.learned).map(([key,w])=>({
        word_key:key,hanzi:w.h,pinyin:w.p,meaning:w.v,topic_id:w.t||w.topicId,hsk_level:w.l,learned_at:w.learnedAt||Date.now(),
      }));
      await apiFetch('/api/user/progress','POST',{
        learned,stats:{todayCount:currentUser.data.todayCount||0,streak:currentUser.data.streak||0,lastDate:currentUser.data.lastDate||today(),quizCount:currentUser.data.quizCount||0},
      });
    }catch(e){}
  }

  function scheduleSyncToServer(){clearTimeout(syncTimer);syncTimer=setTimeout(syncToServer,3000);}

  // ── USER DATA ────────────────────────────────
  function defaultUserData(){return{learned:{},todayCount:0,lastDate:today(),streak:1,quizCount:0};}
  function saveUserData(){
    localStorage.setItem('hanzihoc_session',JSON.stringify(currentUser));
    const users=getLocalUsers();
    if(users[currentUser.email]){users[currentUser.email].userData=currentUser.data;saveLocalUsers(users);}
    scheduleSyncToServer();
  }

  function showApp(){
    document.getElementById('login-screen').style.display='none';
    document.getElementById('main-app').style.display='block';
    if(!currentUser.data)currentUser.data=defaultUserData();
    checkDailyReset();
    document.getElementById('nav-name').textContent=currentUser.name;
    document.getElementById('nav-avatar').textContent=currentUser.name[0].toUpperCase();
    document.getElementById('home-username').textContent=currentUser.name.split(' ').pop();
    showScreen('home');
  }

  function checkDailyReset(){
    const t=today(),d=currentUser.data;
    if(d.lastDate!==t){d.streak=d.lastDate===yesterday()?(d.streak||0)+1:1;d.todayCount=0;d.lastDate=t;saveUserData();}
  }
  function today(){return new Date().toISOString().slice(0,10);}
  function yesterday(){const d=new Date();d.setDate(d.getDate()-1);return d.toISOString().slice(0,10);}

  // ── AUTH HELPERS ─────────────────────────────
  function showErr(el,msg){el.textContent=msg;el.style.display='block';}
  function showLogin(){document.getElementById('login-form').style.display='block';document.getElementById('register-form').style.display='none';}
  function showRegister(){document.getElementById('login-form').style.display='none';document.getElementById('register-form').style.display='block';}

  // ── SCREEN ROUTING ────────────────────────────
  const NAV_MAP={home:['sb-home','bn-home'],topics:['sb-study','bn-study'],study:['sb-study','bn-study'],'quiz-select':['sb-quiz','bn-quiz'],quiz:['sb-quiz','bn-quiz'],'quiz-result':['sb-quiz','bn-quiz'],learned:['sb-learned','bn-learned'],progress:['sb-progress']};
  function showScreen(name){
    document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
    document.querySelectorAll('.sidebar-item,.bn-item').forEach(s=>s.classList.remove('active'));
    const el=document.getElementById('screen-'+name);if(el)el.classList.add('active');
    (NAV_MAP[name]||[]).forEach(id=>{const e=document.getElementById(id);if(e)e.classList.add('active');});
    document.getElementById('main-content').scrollTop=0;
    if(name==='home')renderHome();if(name==='topics')renderTopics();
    if(name==='quiz-select')renderQuizSelect();if(name==='learned')renderLearnedList();
    if(name==='progress')renderProgress();
  }

  // ── HELPERS ───────────────────────────────────
  function isLearned(k){return!!currentUser.data.learned[k];}
  function wordKey(w){return w.h+'_'+w.t+'_'+w.l;}
  function getLearnedWords(){return Object.values(currentUser.data.learned);}
  function getTopicWords(tid){return(vocabData?.words||[]).filter(w=>w.t===tid);}
  function getUnlearned(tid){return getTopicWords(tid).filter(w=>!isLearned(wordKey(w)));}
  function getTopicInfo(tid){return(vocabData?.topics||{})[tid]||TOPIC_META[tid]||{name:tid,icon:'📚'};}
  function hskColor(l){return HSK_COLORS[l]||{bg:'#F1EFE8',text:'#2C2C2A',label:'HSK '+l};}
  function speak(t){if(!window.speechSynthesis)return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(t);u.lang='zh-CN';u.rate=0.82;window.speechSynthesis.speak(u);}
  function getUniqueTopics(){const s=new Set(),r=[];(vocabData?.words||[]).forEach(w=>{if(!s.has(w.t)){s.add(w.t);r.push(w.t);}});return r;}
  function mkBtn(cls,txt,fn){const b=document.createElement('button');b.className=cls;b.textContent=txt;b.onclick=fn;return b;}

  // ── HOME ──────────────────────────────────────
  function renderHome(){
    const d=currentUser.data,total=getLearnedWords().length;
    document.getElementById('stat-total').textContent=total;
    document.getElementById('stat-today').textContent=d.todayCount||0;
    document.getElementById('stat-streak').textContent=(d.streak||0)+' 🔥';
    document.getElementById('home-quiz-count').textContent=total;
    const c=document.getElementById('home-topics');c.innerHTML='';
    getUniqueTopics().slice(0,6).forEach(tid=>renderTopicCard(tid,c));
  }

  // ── TOPICS ────────────────────────────────────
  function renderTopics(){
    const fw=document.getElementById('hsk-filters');fw.innerHTML='';
    const mkF=(lv,lbl)=>{fw.appendChild(mkBtn('hsk-btn'+(activeHskFilter===lv?' active':''),lbl,()=>{activeHskFilter=lv;renderTopics();}));};
    mkF(0,'Tất cả');[1,2,3,4,5,6].forEach(l=>mkF(l,'HSK '+l));
    const c=document.getElementById('all-topics');c.innerHTML='';
    let topics=getUniqueTopics();
    if(activeHskFilter>0)topics=topics.filter(tid=>(vocabData?.words||[]).some(w=>w.t===tid&&w.l===activeHskFilter));
    topics.forEach(tid=>renderTopicCard(tid,c));
  }

  function renderTopicCard(tid,container){
    const info=getTopicInfo(tid),all=getTopicWords(tid);
    const lc=all.filter(w=>isLearned(wordKey(w))).length,uc=all.length-lc;
    const pct=all.length>0?Math.round(lc/all.length*100):0;
    const card=document.createElement('div');card.className='topic-card';
    card.innerHTML=`<div class="tc-icon">${info.icon}</div><div class="tc-name">${info.name}${uc>0?`<span class="tc-new-badge">${uc} mới</span>`:''}</div><div class="tc-meta">${lc}/${all.length} từ đã học</div><div class="tc-bar"><div class="tc-bar-fill" style="width:${pct}%"></div></div>`;
    card.onclick=()=>startStudy(tid);container.appendChild(card);
  }

  // ── STUDY ─────────────────────────────────────
  function startStudy(tid){
    currentTopic=tid;studyQueue=[...getUnlearned(tid)];studyIdx=0;
    showScreen('study');
    const info=getTopicInfo(tid);
    document.getElementById('study-topic-label').textContent=info.icon+' '+info.name;
    visState={hz:true,py:true,vn:true};updateVisButtons();updateCardVisibility();
    if(studyQueue.length===0)showStudyDone(tid);else{hideStudyDone();showStudyWord();}
  }

  function showStudyWord(){
    if(studyIdx>=studyQueue.length){showStudyDone(currentTopic);return;}
    const w=studyQueue[studyIdx];
    document.getElementById('fc-hanzi').textContent=w.h;
    document.getElementById('fc-pinyin').textContent=w.p;
    document.getElementById('fc-meaning').textContent=w.v;
    const pct=Math.round(studyIdx/studyQueue.length*100);
    document.getElementById('study-prog-fill').style.width=pct+'%';
    document.getElementById('study-count').textContent=(studyIdx+1)+' / '+studyQueue.length;
    setTimeout(()=>speak(w.h),300);
  }

  function speakCurrent(){if(studyIdx<studyQueue.length)speak(studyQueue[studyIdx].h);}

  function markWord(known){
    if(studyIdx>=studyQueue.length)return;
    const w=studyQueue[studyIdx];
    if(known){
      const key=wordKey(w);
      if(!isLearned(key)){
        currentUser.data.learned[key]={...w,learnedAt:Date.now(),topicId:currentTopic};
        currentUser.data.todayCount=(currentUser.data.todayCount||0)+1;
        saveUserData();
      }
    }
    studyIdx++;studyIdx>=studyQueue.length?showStudyDone(currentTopic):showStudyWord();
  }

  function showStudyDone(tid){
    const all=getTopicWords(tid),lc=all.filter(w=>isLearned(wordKey(w))).length;
    document.getElementById('study-prog-fill').style.width='100%';
    document.getElementById('study-count').textContent=lc+' / '+all.length;
    document.getElementById('study-done-notice').style.display='block';
    document.getElementById('flashcard').style.display='none';
    document.querySelector('.card-actions').style.display='none';
    document.querySelector('.visibility-toggles').style.display='none';
    document.getElementById('done-sub-text').textContent=`Đã học ${lc}/${all.length} từ trong "${getTopicInfo(tid).name}"`;
  }

  function hideStudyDone(){
    document.getElementById('study-done-notice').style.display='none';
    document.getElementById('flashcard').style.display='flex';
    document.querySelector('.card-actions').style.display='flex';
    document.querySelector('.visibility-toggles').style.display='flex';
  }

  // ── VIS TOGGLES ───────────────────────────────
  function toggleVis(key){visState[key]=!visState[key];updateVisButtons();updateCardVisibility();}
  function updateVisButtons(){['hz','py','vn'].forEach(k=>{const b=document.getElementById('vis-'+k);if(b)b.classList.toggle('active',visState[k]);});}
  function updateCardVisibility(){const map={hz:'fc-hanzi',py:'fc-pinyin',vn:'fc-meaning'};Object.entries(map).forEach(([k,id])=>{const el=document.getElementById(id);if(el)el.classList.toggle('fc-hidden',!visState[k]);});}

  // ── QUIZ ──────────────────────────────────────
  function renderQuizSelect(){
    const learned=getLearnedWords(),noEl=document.getElementById('quiz-no-words'),ml=document.getElementById('quiz-mode-list');ml.innerHTML='';
    if(learned.length<4){noEl.style.display='block';return;}noEl.style.display='none';
    [{icon:'🎯',name:'Trắc nghiệm (tất cả)',desc:`Kiểm tra ${learned.length} từ đã học`,fn:()=>startQuiz('all')},
     {icon:'⚡',name:'Kiểm tra nhanh (20 từ)',desc:'20 từ ngẫu nhiên',fn:()=>startQuiz('quick20')},
     {icon:'🔥',name:'Siêu nhanh (10 từ)',desc:'Luyện phản xạ',fn:()=>startQuiz('quick10')},
     {icon:'📂',name:'Theo chủ đề',desc:'Chọn chủ đề cụ thể',fn:()=>startQuizTopicPick()},
    ].forEach(m=>{
      const card=document.createElement('div');card.className='quiz-mode-card';
      card.innerHTML=`<span class="qmc-icon">${m.icon}</span><div><div class="qmc-name">${m.name}</div><div class="qmc-desc">${m.desc}</div></div>`;
      card.onclick=m.fn;ml.appendChild(card);
    });
  }

  function startQuizTopicPick(){
    const learned=getLearnedWords(),tids=[...new Set(learned.map(w=>w.topicId||w.t))];
    const ml=document.getElementById('quiz-mode-list');ml.innerHTML='<div style="font-size:13px;color:var(--text-muted);margin-bottom:12px;">Chọn chủ đề:</div>';
    tids.forEach(tid=>{
      const info=getTopicInfo(tid),cnt=learned.filter(w=>(w.topicId||w.t)===tid).length;
      if(cnt<4)return;
      const card=document.createElement('div');card.className='quiz-mode-card';
      card.innerHTML=`<span class="qmc-icon">${info.icon}</span><div><div class="qmc-name">${info.name}</div><div class="qmc-desc">${cnt} từ</div></div>`;
      card.onclick=()=>startQuiz('topic',tid);ml.appendChild(card);
    });
    ml.appendChild(mkBtn('btn-secondary','← Quay lại',renderQuizSelect));
  }

  function startQuiz(mode,topicId){
    let pool=[...getLearnedWords()];
    if(mode==='topic'&&topicId)pool=pool.filter(w=>(w.topicId||w.t)===topicId);
    pool=pool.sort(()=>Math.random()-0.5);
    if(mode==='quick20')pool=pool.slice(0,20);if(mode==='quick10')pool=pool.slice(0,10);
    if(pool.length<4){alert('Cần ít nhất 4 từ!');return;}
    quizWords=pool;quizIdx=0;quizScore=0;showScreen('quiz');renderQuizQ();
  }

  function renderQuizQ(){
    if(quizIdx>=quizWords.length){showQuizResult();return;}
    const w=quizWords[quizIdx];
    document.getElementById('q-hanzi').textContent=w.h;
    document.getElementById('q-pinyin').textContent=w.p;
    const pct=Math.round(quizIdx/quizWords.length*100);
    document.getElementById('quiz-prog-fill').style.width=pct+'%';
    document.getElementById('quiz-count-text').textContent=(quizIdx+1)+'/'+quizWords.length;
    const all=getLearnedWords(),wrong=all.filter(x=>x.h!==w.h).sort(()=>Math.random()-0.5).slice(0,3);
    const opts=[w,...wrong].sort(()=>Math.random()-0.5);
    const oc=document.getElementById('quiz-options');oc.innerHTML='';
    opts.forEach(o=>{const btn=document.createElement('button');btn.className='quiz-opt';btn.textContent=o.v;btn.onclick=()=>checkQuizAns(btn,o.h===w.h);oc.appendChild(btn);});
    setTimeout(()=>speak(w.h),400);
  }

  function checkQuizAns(btn,correct){
    document.querySelectorAll('.quiz-opt').forEach(b=>b.onclick=null);
    if(correct){btn.classList.add('correct');quizScore++;}
    else{btn.classList.add('wrong');const cv=quizWords[quizIdx].v;document.querySelectorAll('.quiz-opt').forEach(b=>{if(b.textContent===cv)b.classList.add('correct');});}
    setTimeout(()=>{quizIdx++;renderQuizQ();},900);
  }

  function showQuizResult(){
    currentUser.data.quizCount=(currentUser.data.quizCount||0)+1;saveUserData();
    const t=quizWords.length,pct=Math.round(quizScore/t*100);
    let e='😅',m='Cần ôn luyện thêm!';
    if(pct>=90){e='🏆';m='Xuất sắc!';}else if(pct>=75){e='🌟';m='Giỏi lắm!';}else if(pct>=50){e='👍';m='Khá tốt!';}
    document.getElementById('res-emoji').textContent=e;document.getElementById('res-score').textContent=quizScore+'/'+t;
    document.getElementById('res-msg').textContent=m;document.getElementById('res-correct').textContent=quizScore;
    document.getElementById('res-wrong').textContent=t-quizScore;document.getElementById('res-pct').textContent=pct+'%';
    showScreen('quiz-result');
  }

  // ── LEARNED ───────────────────────────────────
  function renderLearnedList(){
    const learned=getLearnedWords(),search=(document.getElementById('learned-search')?.value||'').toLowerCase();
    document.getElementById('learned-total').textContent=learned.length;
    const fb=document.getElementById('learned-filters');fb.innerHTML='';
    const tids=[...new Set(learned.map(w=>w.topicId||w.t))];
    fb.appendChild(mkBtn('filter-btn'+(!learnedTopicFilter?' active':''),'Tất cả',()=>{learnedTopicFilter=null;renderLearnedList();}));
    tids.forEach(tid=>{const info=getTopicInfo(tid);fb.appendChild(mkBtn('filter-btn'+(learnedTopicFilter===tid?' active':''),info.icon+' '+info.name,()=>{learnedTopicFilter=tid;renderLearnedList();}));});
    let filtered=learned;
    if(learnedTopicFilter)filtered=filtered.filter(w=>(w.topicId||w.t)===learnedTopicFilter);
    if(search)filtered=filtered.filter(w=>w.h.includes(search)||w.p.toLowerCase().includes(search)||w.v.toLowerCase().includes(search));
    const wrap=document.getElementById('learned-list-wrap');
    if(!filtered.length){wrap.innerHTML=`<div class="empty-state"><div class="empty-state-icon">${learned.length?'🔍':'📭'}</div><div>${learned.length?'Không tìm thấy':'Chưa học từ nào'}</div></div>`;return;}
    const list=document.createElement('div');list.className='word-list';
    filtered.sort((a,b)=>(b.learnedAt||0)-(a.learnedAt||0)).forEach(w=>{
      const info=getTopicInfo(w.topicId||w.t),hsk=hskColor(w.l);
      const item=document.createElement('div');item.className='word-item';
      item.innerHTML=`<div class="wi-hanzi">${w.h}</div><div class="wi-info"><div class="wi-pinyin">${w.p}</div><div class="wi-meaning">${w.v}</div></div><span class="wi-level" style="background:${hsk.bg};color:${hsk.text}">${hsk.label}</span><span class="wi-tag">${info.icon} ${info.name}</span>`;
      item.querySelector('.wi-hanzi').onclick=()=>speak(w.h);list.appendChild(item);
    });
    wrap.innerHTML='';wrap.appendChild(list);
  }

  // ── PROGRESS ──────────────────────────────────
  function renderProgress(){
    const learned=getLearnedWords(),d=currentUser.data;
    document.getElementById('prog-total').textContent=learned.length;
    document.getElementById('prog-today').textContent=d.todayCount||0;
    document.getElementById('prog-quizzes').textContent=d.quizCount||0;
    const tw=document.getElementById('topic-progress-wrap');tw.innerHTML='';
    getUniqueTopics().forEach(tid=>{
      const info=getTopicInfo(tid),all=getTopicWords(tid),lc=all.filter(w=>isLearned(wordKey(w))).length;
      if(!lc)return;const pct=Math.round(lc/all.length*100);
      tw.innerHTML+=`<div class="topic-prog-item"><span class="tpi-icon">${info.icon}</span><div class="tpi-info"><div class="tpi-row"><span>${info.name}</span><span class="tpi-count">${lc}/${all.length} (${pct}%)</span></div><div class="tpi-bar"><div class="tpi-fill" style="width:${pct}%"></div></div></div></div>`;
    });
    if(!tw.children.length)tw.innerHTML='<div style="color:var(--text-muted);font-size:13px;">Chưa học chủ đề nào.</div>';
    const hw=document.getElementById('hsk-progress-wrap');hw.innerHTML='';
    [1,2,3,4,5,6].forEach(lv=>{
      const all=(vocabData?.words||[]).filter(w=>w.l===lv),lc=learned.filter(w=>w.l===lv).length;
      if(!all.length)return;const hsk=hskColor(lv);
      hw.innerHTML+=`<div class="hsk-level-row"><span class="hsk-badge" style="background:${hsk.bg};color:${hsk.text}">${hsk.label}</span><div style="flex:1"><div class="hsk-num">${lc}/${all.length} từ</div></div><div style="font-size:13px;font-weight:500;color:var(--text-muted)">${Math.round(lc/all.length*100)}%</div></div>`;
    });
  }

  return{init,login,register,logout,showLogin,showRegister,showScreen,startStudy,speakCurrent,markWord,toggleVis,renderLearnedList};
})();

window.addEventListener('DOMContentLoaded',App.init);
