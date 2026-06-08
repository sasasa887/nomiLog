/* =============================================
   のみログ — app.js
   ============================================= */

// ============================================================
//  CONSTANTS
// ============================================================
const BUILT_IN_DRINKS = [
  { id:'beer350',  icon:'🍺', name:'ビール',     sub:'350ml · 5%',           ml:350, pct:5,   kcal:140 },
  { id:'beer500',  icon:'🍺', name:'ビール大',    sub:'500ml · 5%',           ml:500, pct:5,   kcal:200 },
  { id:'sake',     icon:'🍶', name:'日本酒',      sub:'1合 180ml · 15%',      ml:180, pct:15,  kcal:185 },
  { id:'wine',     icon:'🍷', name:'ワイン',      sub:'グラス 120ml · 12%',   ml:120, pct:12,  kcal:88  },
  { id:'chuhai',   icon:'🥤', name:'チューハイ',  sub:'350ml · 5%',           ml:350, pct:5,   kcal:158 },
  { id:'highball', icon:'🥃', name:'ハイボール',  sub:'350ml · 7%',           ml:350, pct:7,   kcal:175 },
  { id:'shochu',   icon:'🫗', name:'焼酎',        sub:'1杯 90ml · 25%',       ml:90,  pct:25,  kcal:131 },
  { id:'whisky',   icon:'🥃', name:'ウイスキー',  sub:'シングル 30ml · 40%',  ml:30,  pct:40,  kcal:71  },
];

const BENEFITS = [
  { days:3,  icon:'😴', name:'睡眠改善',     desc:'睡眠の質が向上' },
  { days:7,  icon:'💆', name:'肌の回復',     desc:'肌の水分量が改善' },
  { days:14, icon:'🫀', name:'血圧安定',     desc:'血圧が正常化' },
  { days:21, icon:'⚖️', name:'体重管理',     desc:'体重が落ちやすく' },
  { days:30, icon:'🧠', name:'集中力向上',   desc:'記憶力・集中力UP' },
  { days:60, icon:'🏃', name:'運動能力UP',   desc:'持久力・体力が向上' },
  { days:90, icon:'🫁', name:'肝臓回復',     desc:'肝臓の負担が大幅軽減' },
  { days:180,icon:'✨', name:'内側から輝く', desc:'全身の細胞が若返り' },
];

const CHAR_LEVELS = [
  { threshold:0,  emoji:'😵', name:'ヘロヘロ',     next:4  },
  { threshold:4,  emoji:'😐', name:'ぼんやり',     next:10 },
  { threshold:10, emoji:'😊', name:'元気',         next:17 },
  { threshold:17, emoji:'💪', name:'スッキリ',     next:24 },
  { threshold:24, emoji:'🌟', name:'輝いてる！',   next:30 },
  { threshold:30, emoji:'✨', name:'パーフェクト', next:null },
];

const RISK_LABELS = ['記録なし','良好','適量内','注意','危険','深刻'];
const RISK_ICONS  = ['⬜','🟢','🟡','🟠','🔴','☠️'];
const DAY_NAMES   = ['日','月','火','水','木','金','土'];

// ============================================================
//  STATE
// ============================================================
const state = {
  profile:       null,
  customDrinks:  [],
  addDate:       null,       // dateKey: which day Add tab targets
  calMonth:      null,       // Date obj – 1st of displayed month
  selectedCalDay:null,       // dateKey of selected calendar day
  periodView:    '1m',
};

// ============================================================
//  DATE HELPERS
// ============================================================
function dateToKey(d) {
  return `${d.getFullYear()}-${d.getMonth()+1}-${d.getDate()}`;
}
function todayKey() { return dateToKey(new Date()); }
function keyToDate(k) {
  const [y,m,d] = k.split('-').map(Number);
  return new Date(y, m-1, d);
}
function formatDateJP(key) {
  const d = keyToDate(key);
  return `${d.getMonth()+1}月${d.getDate()}日(${DAY_NAMES[d.getDay()]})`;
}

// ============================================================
//  STORAGE — LOG
// ============================================================
function getLogForKey(key) {
  try { const d=localStorage.getItem('nomi_log_'+key); return d?JSON.parse(d):[]; }
  catch(e) { return []; }
}
function saveLogForKey(key, log) {
  localStorage.setItem('nomi_log_'+key, JSON.stringify(log));
}
function getDayTotal(key) {
  return getLogForKey(key).reduce((s,i)=>s+i.gram,0);
}
function getDayKcal(key) {
  return getLogForKey(key).reduce((s,i)=>s+i.kcal,0);
}

// Get all date keys that have log data (scan last N days + month range)
function getKeysInRange(startDate, endDate) {
  const keys=[]; const cur=new Date(startDate);
  while(cur<=endDate){ keys.push(dateToKey(cur)); cur.setDate(cur.getDate()+1); }
  return keys;
}

// ============================================================
//  STORAGE — PROFILE & CUSTOM DRINKS
// ============================================================
function loadState() {
  try {
    const p=localStorage.getItem('nomi_profile');
    if(p) state.profile=JSON.parse(p);
    const cd=localStorage.getItem('nomi_custom_drinks');
    if(cd) state.customDrinks=JSON.parse(cd);
  } catch(e){}
  state.addDate=todayKey();
  const now=new Date(); now.setDate(1);
  state.calMonth=now;
}
function saveCustomDrinks() {
  localStorage.setItem('nomi_custom_drinks',JSON.stringify(state.customDrinks));
}
function getLimit() {
  return (state.profile&&state.profile.gender==='female')?10:20;
}

// ============================================================
//  TOAST
// ============================================================
let toastTimer=null;
function showToast(msg) {
  const el=document.getElementById('toast');
  el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer=setTimeout(()=>el.classList.remove('show'),2500);
}

// ============================================================
//  RISK LEVEL
// ============================================================
function getRiskLevel(gram) {
  const lim=getLimit();
  if(gram<=0) return 0;
  if(gram<=lim*0.5) return 1;
  if(gram<=lim) return 2;
  if(gram<=lim*2) return 3;
  if(gram<=lim*3) return 4;
  return 5;
}

// ============================================================
//  CALC HELPERS
// ============================================================
const calcGram    = (ml,pct) => Math.round(ml*(pct/100)*0.8*10)/10;
const calcKcalAlc = (ml,pct) => Math.round(ml*(pct/100)*0.8*7.1);

// ============================================================
//  PROFILE  (view / edit モード管理)
// ============================================================
// state.profileEditing : true = 編集フォーム表示, false = 確定ビュー表示
state.profileEditing = !state.profile; // プロフィール未設定なら最初からフォームを開く

// ── モード切り替え ─────────────────────────────────────────
function showProfileViewMode() {
  document.getElementById('profile-view-section').style.display = 'block';
  document.getElementById('profile-edit-section').style.display = 'none';
  state.profileEditing = false;
}

function showProfileEditMode(isEditing) {
  document.getElementById('profile-view-section').style.display = 'none';
  document.getElementById('profile-edit-section').style.display = 'block';
  // 編集モードと初回入力でヘッダー表示を切り替え
  document.getElementById('profile-edit-header').style.display = isEditing ? 'block' : 'none';
  document.getElementById('profile-edit-label').textContent = isEditing ? 'プロフィールを編集' : 'プロフィール設定';
  state.profileEditing = true;
}

// 「✏️ 編集する」ボタン押下
function startProfileEdit() {
  const p = state.profile;
  if (p) {
    document.getElementById('p-name').value   = p.name;
    document.getElementById('p-gender').value = p.gender;
    document.getElementById('p-age').value    = p.age;
    document.getElementById('p-height').value = p.height;
    document.getElementById('p-weight').value = p.weight;
    renderWidmark();
  }
  showProfileEditMode(true);
}

// 「✕ キャンセル」ボタン押下（変更を破棄して確定ビューに戻る）
function cancelProfileEdit() {
  showProfileViewMode();
  showToast('編集をキャンセルしました');
}

// ── 保存（確定） ────────────────────────────────────────────
function saveProfile() {
  const name   = document.getElementById('p-name').value.trim();
  const gender = document.getElementById('p-gender').value;
  const age    = parseInt(document.getElementById('p-age').value)    || 0;
  const height = parseFloat(document.getElementById('p-height').value) || 0;
  const weight = parseFloat(document.getElementById('p-weight').value) || 0;

  if (!name)   { showToast('⚠️ お名前を入力してください'); return; }
  if (age < 20){ showToast('⚠️ 20歳未満の方はご利用になれません'); return; }

  const isNew = !state.profile;
  state.profile = { name, gender, age, height, weight };
  localStorage.setItem('nomi_profile', JSON.stringify(state.profile));

  renderProfileView();   // 確定ビューを更新
  renderHomeProfileBar(); // ホームのプロフィールバーを更新
  renderGauge();
  renderCharacter();

  showToast(isNew ? '✅ プロフィールを設定しました！' : '✅ プロフィールを更新しました');
  showProfileViewMode(); // フォームを隠してビューモードへ
}

// ── 削除 ────────────────────────────────────────────────────
function clearProfile() {
  if (!confirm('プロフィールを削除しますか？')) return;
  state.profile = null;
  localStorage.removeItem('nomi_profile');
  ['p-name','p-age','p-height','p-weight'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('p-gender').value = 'male';
  document.getElementById('widmark-preview').style.display = 'none';

  renderHomeProfileBar();
  renderGauge();
  renderCharacter();
  showToast('🗑 プロフィールを削除しました');
  showProfileEditMode(false); // 初回入力フォームを表示
}

// ── ビューの描画 ─────────────────────────────────────────────
function renderProfileView() {
  const p = state.profile;
  if (!p) return;

  const isFemale = p.gender === 'female';
  const limit    = isFemale ? 10 : 20;

  document.getElementById('pv-avatar').textContent = isFemale ? '👩' : '👨';
  document.getElementById('pv-name').textContent   = p.name;
  document.getElementById('pv-sub').textContent    = `${isFemale ? '女性' : '男性'}`;

  document.getElementById('pv-weight').innerHTML = `${p.weight}<small>kg</small>`;
  document.getElementById('pv-height').innerHTML = `${p.height}<small>cm</small>`;
  document.getElementById('pv-age').innerHTML    = `${p.age}<small>歳</small>`;
  document.getElementById('pv-limit').innerHTML  = `${limit}<small>g</small>`;

  // Widmark
  if (p.weight && p.age) {
    const r   = isFemale ? 0.55 : 0.68;
    const bac = ((limit / (p.weight * r)) * 100).toFixed(3);
    document.getElementById('pv-widmark').style.display = 'block';
    document.getElementById('pv-widmark-text').innerHTML =
      `適量(${limit}g)摂取時の推定血中アルコール濃度: <strong style="color:var(--amber-light)">${bac}%</strong><br>一般的に0.05%以上で酔いを感じ始めます`;
  }
}

// ホームのプロフィールバーを更新（以前の renderProfile を分離）
function renderHomeProfileBar() {
  const p = state.profile;
  if (!p) {
    document.getElementById('no-profile').style.display  = 'block';
    document.getElementById('has-profile').style.display = 'none';
    return;
  }
  document.getElementById('no-profile').style.display  = 'none';
  document.getElementById('has-profile').style.display = 'block';
  document.getElementById('display-name').textContent  = p.name;
  document.getElementById('display-meta').textContent  =
    `${p.gender === 'female' ? '女性' : '男性'} · ${p.age}歳 · ${p.height}cm · ${p.weight}kg`;
  document.getElementById('avatar-emoji').textContent  = p.gender === 'female' ? '👩' : '👨';
}

// ページ切り替え時にプロフィールタブの表示状態を整える
function syncProfileTab() {
  if (state.profile && !state.profileEditing) {
    showProfileViewMode();
  } else {
    showProfileEditMode(!!state.profile);
  }
}

// ── Widmark（編集フォーム用） ──────────────────────────────
function renderWidmark() {
  const g = document.getElementById('p-gender').value;
  const w = document.getElementById('p-weight').value;
  const a = document.getElementById('p-age').value;
  if (!a || !w) return;
  const r   = g === 'female' ? 0.55 : 0.68;
  const lim = g === 'female' ? 10   : 20;
  const bac = ((lim / (parseFloat(w) * r)) * 100).toFixed(3);
  document.getElementById('widmark-preview').style.display = 'block';
  document.getElementById('widmark-text').innerHTML =
    `適量(${lim}g)摂取時の推定血中アルコール濃度: <strong style="color:var(--amber-light)">${bac}%</strong><br>
     一般的に0.05%以上で酔いを感じ始めます`;
}
['p-gender','p-age','p-weight'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', renderWidmark);
  document.getElementById(id)?.addEventListener('input',  renderWidmark);
});

// ============================================================
//  GAUGE (Today)
// ============================================================
function renderGauge() {
  const key=todayKey();
  const log=getLogForKey(key);
  const totalGram=log.reduce((s,i)=>s+i.gram,0);
  const totalKcal=log.reduce((s,i)=>s+i.kcal,0);
  const limit=getLimit();

  document.getElementById('stat-gram').innerHTML=`${Math.round(totalGram*10)/10}<small>g</small>`;
  document.getElementById('stat-gram-sub').textContent=`適量: ${limit}g`;
  document.getElementById('stat-kcal').innerHTML=`${totalKcal}<small>kcal</small>`;
  document.getElementById('stat-kcal-sub').textContent=
    totalKcal>0?`ご飯 ${(totalKcal/252).toFixed(1)} 杯分`:'—';

  document.getElementById('total-gram').innerHTML=`${Math.round(totalGram*10)/10}<span>g</span>`;
  document.getElementById('limit-label').textContent=`適量: ${limit}g`;
  const now=new Date();
  document.getElementById('date-label').textContent=
    `${now.getMonth()+1}/${now.getDate()}(${DAY_NAMES[now.getDay()]})`;

  const alcPct=Math.min((totalGram/limit)*100,100);
  const fill=document.getElementById('gauge-fill');
  fill.style.width=alcPct+'%';
  fill.className='gauge-fill '+(totalGram<=limit?'safe':totalGram<=limit*1.5?'warn':'over');

  const badge=document.getElementById('status-badge');
  if(totalGram===0)          { badge.className='status-badge safe'; badge.textContent='📝 まだ飲んでいません'; }
  else if(totalGram<=limit*0.5) { badge.className='status-badge safe'; badge.textContent='😊 まだ余裕があります'; }
  else if(totalGram<=limit)  { badge.className='status-badge warn'; badge.textContent='⚠️ 適量に近づいています'; }
  else if(totalGram<=limit*1.5){ badge.className='status-badge over'; badge.textContent='🚨 適量を超えています！水を飲みましょう'; }
  else                       { badge.className='status-badge over'; badge.textContent='🛑 かなり飲みすぎです。お水を！'; }

  document.getElementById('total-kcal').innerHTML=`${totalKcal}<span>kcal</span>`;
  document.getElementById('kcal-fill').style.width=Math.min((totalKcal/400)*100,100)+'%';

  const eq=document.getElementById('kcal-equiv');
  if(totalKcal===0){ eq.innerHTML=''; return; }
  eq.innerHTML=`
    <div class="kcal-chip">🍚 ご飯 ${(totalKcal/252).toFixed(1)} 杯分</div>
    <div class="kcal-chip">🏃 ジョギング ${Math.round(totalKcal/7)} 分</div>
    <div class="kcal-chip">🚶 ウォーク ${Math.round(totalKcal/4)} 分</div>
  `;
}

// ============================================================
//  LOG (Today's home page log)
// ============================================================
function renderLog() {
  const key=todayKey();
  renderLogForKey(key, 'log-list', 'reset-btn', true);
}
function renderLogForKey(key, listId, resetBtnId, allowDelete) {
  const log=getLogForKey(key);
  const listEl=document.getElementById(listId);
  const resetBtn=resetBtnId?document.getElementById(resetBtnId):null;
  if(log.length===0){
    listEl.innerHTML='<div class="empty-log">🍵 記録がありません</div>';
    if(resetBtn) resetBtn.style.display='none';
    return;
  }
  if(resetBtn) resetBtn.style.display='block';
  listEl.innerHTML=log.map((item,i)=>`
    <div class="log-item">
      <span class="li-icon">${item.icon}</span>
      <div style="flex:1;min-width:0">
        <div class="li-name">${item.name}</div>
        <div class="li-detail">${item.detail}</div>
        <div class="li-meta-row">
          <span class="li-gram">🍶 ${item.gram}g</span>
          <span class="li-kcal">🔥 ${item.kcal}kcal</span>
          <span class="li-time">${item.time}</span>
        </div>
      </div>
      ${allowDelete?`<button class="li-del" onclick="removeLogItem('${key}',${i})">✕</button>`:''}
    </div>
  `).join('');
}

function addDrink(drink, targetKey) {
  const key = targetKey || state.addDate || todayKey();
  const gram=calcGram(drink.ml,drink.pct);
  const kcal=drink.kcal!==undefined?drink.kcal:calcKcalAlc(drink.ml,drink.pct);
  const now=new Date();
  const time=`${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  const log=getLogForKey(key);
  log.unshift({icon:drink.icon,name:drink.name,detail:drink.sub,gram,kcal,time});
  saveLogForKey(key,log);

  const isToday=(key===todayKey());
  if(isToday){ renderGauge(); renderLog(); renderCharacter(); }
  renderCalendar();
  if(state.selectedCalDay===key) renderDayDetail(key);
  showToast(`${drink.icon} ${drink.name} を追加（${isToday?'今日':formatDateJP(key)}）`);
  switchTab('home');
}

function addCustom() {
  const ml =parseFloat(document.getElementById('custom-ml').value);
  const pct=parseFloat(document.getElementById('custom-pct').value);
  const name=document.getElementById('custom-name').value.trim()||'カスタム';
  if(!ml||!pct){ showToast('⚠️ 量と度数を入力してください'); return; }
  addDrink({icon:'🥂',name,sub:`${ml}ml · ${pct}%`,ml,pct});
  document.getElementById('custom-ml').value='';
  document.getElementById('custom-pct').value='';
  document.getElementById('custom-name').value='';
  document.getElementById('custom-preview').innerHTML='';
}

function removeLogItem(key, i) {
  const log=getLogForKey(key);
  const removed=log.splice(i,1)[0];
  saveLogForKey(key,log);
  const isToday=(key===todayKey());
  if(isToday){ renderGauge(); renderLog(); renderCharacter(); }
  renderCalendar();
  if(state.selectedCalDay===key) renderDayDetail(key);
  showToast(`🗑 ${removed.name} を削除しました`);
}

function resetLog() {
  if(!confirm('今日の記録をリセットしますか？')) return;
  saveLogForKey(todayKey(),[]);
  renderGauge(); renderLog(); renderCharacter(); renderCalendar();
  showToast('🗑 今日のログをリセットしました');
}

// ============================================================
//  DRINKS GRID (Built-in)
// ============================================================
function renderDrinksGrid() {
  document.getElementById('drinks-grid').innerHTML=BUILT_IN_DRINKS.map(d=>{
    const g=calcGram(d.ml,d.pct);
    return `
      <button class="drink-btn" onclick='addDrink(${JSON.stringify(d)})'>
        <span class="drink-icon">${d.icon}</span>
        <span class="drink-name">${d.name}</span>
        <span class="drink-detail">${d.sub}</span>
        <div class="drink-tags">
          <span class="tag alc">🍶 ${g}g</span>
          <span class="tag cal">🔥 ${d.kcal}kcal</span>
        </div>
      </button>`;
  }).join('');
}

// ============================================================
//  MY TEMPLATES (Custom drinks)
// ============================================================
function renderMyDrinksGrid() {
  const grid=document.getElementById('my-drinks-grid');
  const empty=document.getElementById('my-templates-empty');
  if(state.customDrinks.length===0){
    grid.innerHTML=''; empty.style.display='block'; return;
  }
  empty.style.display='none';
  grid.innerHTML=state.customDrinks.map(d=>{
    const g=calcGram(d.ml,d.pct);
    return `
      <div class="my-drink-wrap">
        <button class="drink-btn" onclick='addDrink(${JSON.stringify(d)})'>
          <span class="drink-icon">${d.icon}</span>
          <span class="drink-name">${d.name}</span>
          <span class="drink-detail">${d.sub}</span>
          <div class="drink-tags">
            <span class="tag alc">🍶 ${g}g</span>
            <span class="tag cal">🔥 ${d.kcal}kcal</span>
          </div>
        </button>
        <div class="my-drink-actions">
          <button class="btn-edit-tpl" onclick="showTemplateForm('${d.id}');event.stopPropagation()">編集</button>
          <button class="btn-del-tpl"  onclick="deleteTemplate('${d.id}');event.stopPropagation()">削除</button>
        </div>
      </div>`;
  }).join('');
}

function showTemplateForm(editId) {
  const form=document.getElementById('template-form');
  form.style.display='block';
  document.getElementById('tpl-edit-id').value=editId||'';
  document.getElementById('tpl-form-title').textContent=editId?'テンプレートを編集':'テンプレートを追加';
  if(editId){
    const d=state.customDrinks.find(x=>x.id===editId);
    if(d){
      document.getElementById('tpl-name').value=d.name;
      document.getElementById('tpl-icon').value=d.icon;
      document.getElementById('tpl-ml').value=d.ml;
      document.getElementById('tpl-pct').value=d.pct;
      document.getElementById('tpl-kcal').value=d.kcal||'';
    }
  } else {
    document.getElementById('tpl-name').value='';
    document.getElementById('tpl-icon').value='🥂';
    document.getElementById('tpl-ml').value='';
    document.getElementById('tpl-pct').value='';
    document.getElementById('tpl-kcal').value='';
  }
  updateTplPreview();
  form.scrollIntoView({behavior:'smooth',block:'center'});
}
function hideTemplateForm() {
  document.getElementById('template-form').style.display='none';
  document.getElementById('tpl-preview').innerHTML='';
}
function saveTemplate() {
  const name=document.getElementById('tpl-name').value.trim();
  const icon=document.getElementById('tpl-icon').value.trim()||'🥂';
  const ml  =parseFloat(document.getElementById('tpl-ml').value);
  const pct =parseFloat(document.getElementById('tpl-pct').value);
  const kcalInput=document.getElementById('tpl-kcal').value;
  const kcal=kcalInput?parseInt(kcalInput):calcKcalAlc(ml,pct);
  if(!name||!ml||!pct){ showToast('⚠️ 名前・量・度数は必須です'); return; }
  const sub=`${ml}ml · ${pct}%`;
  const editId=document.getElementById('tpl-edit-id').value;
  if(editId){
    const idx=state.customDrinks.findIndex(x=>x.id===editId);
    if(idx>=0) state.customDrinks[idx]={id:editId,icon,name,sub,ml,pct,kcal};
    showToast('✏️ テンプレートを更新しました');
  } else {
    const id='custom_'+Date.now();
    state.customDrinks.push({id,icon,name,sub,ml,pct,kcal});
    showToast('✅ テンプレートを保存しました');
  }
  saveCustomDrinks();
  hideTemplateForm();
  renderMyDrinksGrid();
}
function deleteTemplate(id) {
  if(!confirm('このテンプレートを削除しますか？')) return;
  state.customDrinks=state.customDrinks.filter(d=>d.id!==id);
  saveCustomDrinks();
  renderMyDrinksGrid();
  showToast('🗑 テンプレートを削除しました');
}
function updateTplPreview() {
  const ml =parseFloat(document.getElementById('tpl-ml').value);
  const pct=parseFloat(document.getElementById('tpl-pct').value);
  const el =document.getElementById('tpl-preview');
  if(ml&&pct){
    const g=calcGram(ml,pct); const k=calcKcalAlc(ml,pct);
    el.innerHTML=`<span style="color:var(--amber)">🍶 ${g}g</span>　<span style="color:var(--pink)">🔥 約${k}kcal</span>`;
  } else el.innerHTML='';
}

// ============================================================
//  ADD DATE SELECTOR
// ============================================================
function initAddDate() {
  const input=document.getElementById('add-date');
  const today=new Date();
  input.value=today.toISOString().slice(0,10);
  input.max=today.toISOString().slice(0,10);
  state.addDate=todayKey();
  updateDateSelNote();
}
function onAddDateChange() {
  const val=document.getElementById('add-date').value;
  if(!val) return;
  const d=new Date(val+'T00:00:00');
  state.addDate=dateToKey(d);
  updateDateSelNote();
}
function setAddDateToday() {
  const today=new Date();
  document.getElementById('add-date').value=today.toISOString().slice(0,10);
  state.addDate=todayKey();
  updateDateSelNote();
}
function updateDateSelNote() {
  const el=document.getElementById('date-sel-note');
  const isToday=(state.addDate===todayKey());
  el.textContent=isToday?'今日に追加します':`${formatDateJP(state.addDate)} に追加します`;
  el.style.color=isToday?'var(--muted)':'var(--amber)';
}
function updateCustomPreview() {
  const ml =parseFloat(document.getElementById('custom-ml').value);
  const pct=parseFloat(document.getElementById('custom-pct').value);
  const el =document.getElementById('custom-preview');
  if(ml&&pct){
    const g=calcGram(ml,pct); const k=calcKcalAlc(ml,pct);
    el.innerHTML=`<span style="color:var(--amber)">🍶 純アルコール ${g}g</span>　<span style="color:var(--pink)">🔥 約${k}kcal</span><div style="font-size:0.6rem;margin-top:2px;color:var(--muted)">※糖質・添加物カロリーは含まず</div>`;
  } else el.innerHTML='';
}

// ============================================================
//  CALENDAR
// ============================================================
function renderCalendar() {
  const month=state.calMonth;
  const year=month.getFullYear();
  const mon =month.getMonth();
  const label=`${year}年${mon+1}月`;
  document.getElementById('cal-month-label').textContent=label;

  const firstDay=new Date(year,mon,1).getDay(); // 0=Sun
  const daysInMonth=new Date(year,mon+1,0).getDate();
  const todayStr=todayKey();

  let html='';
  // Empty cells before month start
  for(let i=0;i<firstDay;i++) html+='<div class="cal-day empty"></div>';

  for(let d=1;d<=daysInMonth;d++){
    const dateObj=new Date(year,mon,d);
    const key=dateToKey(dateObj);
    const gram=getDayTotal(key);
    const risk=getRiskLevel(gram);
    const riskClass=gram>0?`risk-${risk}`:'risk-none';
    const isToday=key===todayStr?'today':'';
    const isSel=key===state.selectedCalDay?'selected':'';
    const dow=dateObj.getDay();
    const dowClass=dow===0?'sun':dow===6?'sat':'';
    const gramLabel=gram>0?`${Math.round(gram)}g`:'';

    html+=`
      <div class="cal-day ${riskClass} ${isToday} ${isSel} ${dowClass}"
           onclick="selectCalDay('${key}')">
        <span class="cal-day-num">${d}</span>
        <span class="cal-day-dot"></span>
        <span class="cal-day-gram">${gramLabel}</span>
      </div>`;
  }
  document.getElementById('cal-grid').innerHTML=html;
}

function prevMonth() {
  const m=state.calMonth;
  state.calMonth=new Date(m.getFullYear(),m.getMonth()-1,1);
  renderCalendar();
}
function nextMonth() {
  const m=state.calMonth;
  const next=new Date(m.getFullYear(),m.getMonth()+1,1);
  if(next>new Date()) return; // don't go to future
  state.calMonth=next;
  renderCalendar();
}
function selectCalDay(key) {
  state.selectedCalDay=state.selectedCalDay===key?null:key;
  renderCalendar();
  if(state.selectedCalDay) renderDayDetail(state.selectedCalDay);
  else document.getElementById('day-detail').style.display='none';
}
function renderDayDetail(key) {
  const panel=document.getElementById('day-detail');
  panel.style.display='block';
  document.getElementById('day-detail-title').textContent=formatDateJP(key);
  renderLogForKey(key,'day-detail-log',null,true);
  panel.scrollIntoView({behavior:'smooth',block:'nearest'});
}
function goAddForSelectedDay() {
  if(!state.selectedCalDay) return;
  // Set the add tab date to selected day
  const d=keyToDate(state.selectedCalDay);
  document.getElementById('add-date').value=d.toISOString().slice(0,10);
  state.addDate=state.selectedCalDay;
  updateDateSelNote();
  switchTab('add');
}

// ============================================================
//  PERIOD STATS
// ============================================================
function setPeriod(p) {
  state.periodView=p;
  document.querySelectorAll('.period-btn').forEach(b=>{
    b.classList.toggle('active',b.dataset.period===p);
  });
  renderPeriodStats();
}
function renderPeriodStats() {
  const months={'1m':1,'3m':3,'6m':6}[state.periodView]||1;
  const end=new Date(); end.setHours(23,59,59,999);
  const start=new Date(); start.setMonth(start.getMonth()-months); start.setHours(0,0,0,0);
  const keys=getKeysInRange(start,end);
  const limit=getLimit();

  let totalGram=0,totalKcal=0,drinkingDays=0;
  const riskCounts=[0,0,0,0,0,0]; // index 0-5

  keys.forEach(k=>{
    const g=getDayTotal(k);
    const kc=getDayKcal(k);
    if(g>0){ drinkingDays++; totalGram+=g; totalKcal+=kc; }
    riskCounts[getRiskLevel(g)]++;
  });

  const totalDays=keys.length;
  const avgGram=drinkingDays>0?(totalGram/drinkingDays).toFixed(1):0;
  const overDays=riskCounts[3]+riskCounts[4]+riskCounts[5];
  const safeDays=riskCounts[1]+riskCounts[2];

  // Advice
  const avgAll=totalDays>0?(totalGram/totalDays).toFixed(1):0;
  let advice='',adviceStrong='';
  if(totalGram===0){
    advice='この期間は飲酒の記録がありません。';
  } else if(parseFloat(avgAll)<=limit*0.3){
    adviceStrong='素晴らしい！'; advice='飲酒量がとても少なく、肝臓・心臓への負担が最小限です。この調子を続けましょう！';
  } else if(parseFloat(avgAll)<=limit){
    adviceStrong='良好。'; advice='全体的に適量内の飲み方ができています。週2日の休肝日を意識するとさらに◎';
  } else if(parseFloat(avgAll)<=limit*1.5){
    adviceStrong='やや注意。'; advice='平均的に適量を超えています。アルコール性肝炎のリスクが高まります。休肝日を設けましょう。';
  } else {
    adviceStrong='危険な飲酒量です。'; advice='継続的な過剰摂取はアルコール依存症・肝硬変のリスクがあります。医師への相談をお勧めします。';
  }

  // Risk bar chart
  const riskConfig=[
    {label:'記録なし', cls:'rgba(136,146,164,0.3)', idx:0},
    {label:'良好',     cls:'var(--risk-1-fg)',       idx:1},
    {label:'適量内',   cls:'var(--risk-2-fg)',       idx:2},
    {label:'注意',     cls:'var(--risk-3-fg)',       idx:3},
    {label:'危険',     cls:'var(--risk-4-fg)',       idx:4},
    {label:'深刻',     cls:'var(--risk-5-fg)',       idx:5},
  ];
  const maxCount=Math.max(...riskCounts,1);
  const riskBars=riskConfig.map(r=>`
    <div class="risk-bar-row">
      <span class="risk-bar-label">${r.label}</span>
      <div class="risk-bar-track">
        <div class="risk-bar-fill" style="width:${(riskCounts[r.idx]/maxCount*100).toFixed(0)}%;background:${r.cls}"></div>
      </div>
      <span class="risk-bar-count">${riskCounts[r.idx]}</span>
    </div>`).join('');

  document.getElementById('period-stats-content').innerHTML=`
    <div class="period-stats-grid" style="margin-bottom:14px">
      <div class="ps-item">
        <div class="ps-val">${drinkingDays}<small>/${totalDays}日</small></div>
        <div class="ps-label">飲酒日数</div>
      </div>
      <div class="ps-item">
        <div class="ps-val">${avgGram}<small>g/日</small></div>
        <div class="ps-label">平均アルコール</div>
      </div>
      <div class="ps-item">
        <div class="ps-val">${totalKcal.toLocaleString()}<small>kcal</small></div>
        <div class="ps-label">総カロリー</div>
      </div>
      <div class="ps-item">
        <div class="ps-val" style="color:${overDays>0?'var(--red)':'var(--green)'}">${overDays}<small>日</small></div>
        <div class="ps-label">超過日数</div>
      </div>
    </div>
    <div class="card-title" style="margin-bottom:8px">危険度の分布（${totalDays}日間）</div>
    <div class="risk-bar-list">${riskBars}</div>
    <div class="period-advice"><strong>${adviceStrong}</strong>${advice}</div>
  `;
}

// ============================================================
//  HEALTH CHARACTER & BENEFITS
// ============================================================
function getStreak() {
  let streak=0;
  const limit=getLimit();
  // Check from yesterday backwards (today might be in progress)
  for(let i=0;i<365;i++){
    const d=new Date(); d.setDate(d.getDate()-i);
    const g=getDayTotal(dateToKey(d));
    // Count today if already within limit; skip if no data yet (i==0 and g==0 → still 0 is safe)
    if(g<=limit) streak++;
    else break;
  }
  return streak;
}
function getSafeDays30() {
  const limit=getLimit();
  let count=0;
  for(let i=0;i<30;i++){
    const d=new Date(); d.setDate(d.getDate()-i);
    const g=getDayTotal(dateToKey(d));
    if(g===0||g<=limit) count++;
  }
  return count;
}
function renderCharacter() {
  const streak=getStreak();
  const safeDays30=getSafeDays30();

  // Determine level
  let level=CHAR_LEVELS[0], levelIdx=0;
  for(let i=0;i<CHAR_LEVELS.length;i++){
    if(safeDays30>=CHAR_LEVELS[i].threshold){ level=CHAR_LEVELS[i]; levelIdx=i+1; }
  }
  const nextThreshold=level.next;
  const progressPct=nextThreshold
    ? Math.min(((safeDays30-level.threshold)/(nextThreshold-level.threshold))*100,100)
    : 100;

  document.getElementById('char-emoji').textContent=level.emoji;
  document.getElementById('char-level-badge').textContent=`Lv.${levelIdx}`;
  document.getElementById('char-name').textContent=level.name;
  document.getElementById('char-streak').textContent=`連続セーフ: ${streak}日 🔥`;
  document.getElementById('char-progress').style.width=progressPct+'%';
  document.getElementById('char-progress-label').textContent=
    nextThreshold?`次のレベルまで: あと${nextThreshold-safeDays30}日（30日間セーフ日数: ${safeDays30}/30）`:'MAX レベル達成！';

  // Benefits
  document.getElementById('benefits-grid').innerHTML=BENEFITS.map(b=>{
    const unlocked=streak>=b.days;
    return `
      <div class="benefit-item ${unlocked?'unlocked':'locked'}">
        <span class="benefit-icon">${b.icon}</span>
        <div class="benefit-text">
          <span class="benefit-name">${b.name}</span>
          <span class="benefit-days">${unlocked?'✅ 達成！':'連続'+b.days+'日で解放'}</span>
        </div>
      </div>`;
  }).join('');

  // Age improvement (needs profile)
  const p=state.profile;
  const ageRow=document.getElementById('age-improve-row');
  if(p&&p.age){
    ageRow.style.display='flex';
    const overDays30=30-safeDays30;
    const skinImprove=Math.max(0,(safeDays30*0.12-overDays30*0.3)).toFixed(1);
    const bodyImprove=Math.max(0,(safeDays30*0.08-overDays30*0.2)).toFixed(1);
    document.getElementById('skin-age-val').textContent=
      parseFloat(skinImprove)>0?`-${skinImprove}歳分改善`:'変化なし';
    document.getElementById('body-age-val').textContent=
      parseFloat(bodyImprove)>0?`-${bodyImprove}歳分改善`:'変化なし';
  } else {
    ageRow.style.display='none';
  }
}

// ============================================================
//  TABS
// ============================================================
function switchTab(tab) {
  ['home','history','add','profile'].forEach(t=>{
    document.getElementById(`page-${t}`).classList.toggle('active',t===tab);
    document.getElementById(`tab-${t}`)?.classList.toggle('active',t===tab);
  });
  if(tab==='history') { renderCalendar(); renderPeriodStats(); }
  if(tab==='profile') { syncProfileTab(); }
}

// ============================================================
//  INIT
// ============================================================
loadState();
renderHomeProfileBar();
renderProfileView();
syncProfileTab();
renderGauge();
renderLog();
renderCharacter();
renderDrinksGrid();
renderMyDrinksGrid();
initAddDate();
renderCalendar();
renderPeriodStats();
