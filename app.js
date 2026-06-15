/* =============================================
   のみログ — app.js
   ============================================= */

// ============================================================
//  CONSTANTS
// ============================================================
const BUILT_IN_DRINKS = [
  { id:'beer350',  icon:'🍺', name:'ビール',       sub:'350ml · 5%',           ml:350, pct:5,   kcal:140, price:230 },
  { id:'beer500',  icon:'🍺', name:'ビール大',      sub:'500ml · 5%',           ml:500, pct:5,   kcal:200, price:310 },
  { id:'sake',     icon:'🍶', name:'日本酒',        sub:'1合 180ml · 15%',      ml:180, pct:15,  kcal:185, price:300 },
  { id:'wine',     icon:'🍷', name:'ワイン',        sub:'グラス 120ml · 12%',   ml:120, pct:12,  kcal:88,  price:400 },
  { id:'lemonsour',icon:'🍋', name:'レモンサワー',  sub:'350ml · 5%',           ml:350, pct:5,   kcal:165, price:170 },
  { id:'cassis',   icon:'🍷', name:'カシスオレンジ',sub:'180ml · 8%',           ml:180, pct:8,   kcal:165, price:450 },
  { id:'highball', icon:'🥃', name:'ハイボール',    sub:'350ml · 7%',           ml:350, pct:7,   kcal:175, price:190 },
  { id:'whisky',   icon:'🥃', name:'ウイスキー',    sub:'シングル 30ml · 40%',  ml:30,  pct:40,  kcal:71,  price:250 },
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
// 色に依存せず形で識別できるアイコン（ユニバーサルデザイン）
const RISK_ICONS  = ['－','☘️','◎','△','⚠️','☠️'];
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
  pendingDeleteId: null,     // 削除確認中のテンプレートID
  qtyDrink: null,            // 数量選択中のドリンク
  usualSet: null,            // いつものセット（直近の組み合わせ）
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
// price が無い過去ログにテンプレート価格を逆算で補完する
function resolveItemPrice(item) {
  // 既に price があればそれを使う
  if (typeof item.price === 'number' && item.price > 0) return item.price;
  // 定番テンプレートから名前一致で価格を引く
  const builtin = BUILT_IN_DRINKS.find(d => d.name === item.name);
  if (builtin && builtin.price) return builtin.price;
  // マイテンプレートから名前一致で引く
  const custom = state.customDrinks.find(d => d.name === item.name);
  if (custom && custom.price) return custom.price;
  // detail（"350ml · 5%"）一致でも試す
  const byDetail = BUILT_IN_DRINKS.find(d => d.sub === item.detail);
  if (byDetail && byDetail.price) return byDetail.price;
  return 0;
}

function getDayPrice(key) {
  return getLogForKey(key).reduce((s,i)=>s+resolveItemPrice(i),0);
}

// 全履歴を集計（localStorageの全ログキーをスキャン）
function getAllHistoryStats() {
  let totalPrice=0, totalGram=0, totalKcal=0, recordDays=0;
  let firstDate=null;
  for (let i=0; i<localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('nomi_log_')) continue;
    let log;
    try { log = JSON.parse(localStorage.getItem(k)); } catch(e) { continue; }
    if (!Array.isArray(log) || log.length===0) continue;

    recordDays++;
    log.forEach(item => {
      totalPrice += resolveItemPrice(item);
      totalGram  += (item.gram ||0);
      totalKcal  += (item.kcal ||0);
    });

    // 最初の記録日を特定
    const dateKey = k.replace('nomi_log_','');
    const d = keyToDate(dateKey);
    if (!firstDate || d < firstDate) firstDate = d;
  }
  return { totalPrice, totalGram, totalKcal, recordDays, firstDate };
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
  // プロフィール読み込み後に編集モードの初期値を決定
  // （設定済みなら確定ビュー、未設定なら入力フォーム）
  state.profileEditing = !state.profile;
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

// 危険度の凡例を生成（色＋アイコン＋ラベルの三重表現でユニバーサルデザイン）
function renderLegend() {
  const el=document.getElementById('legend-list');
  if(!el) return;
  const ranges=['','〜50%','〜100%','〜200%','〜300%','300%超'];
  el.innerHTML=RISK_LABELS.map((label,i)=>{
    const cls=i===0?'risk-none':`risk-${i}`;
    const range=ranges[i]?`（${ranges[i]}）`:'';
    return `
      <div class="legend-item">
        <span class="legend-icon ${cls}">${RISK_ICONS[i]}</span>
        <span class="legend-text">${label}${range}</span>
      </div>`;
  }).join('');
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
// 実際の初期値は loadState() 内でプロフィール読み込み後に決定される
state.profileEditing = false;

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
  if (age < 20) { showToast('⚠️ 20歳以上で入力してください'); return; }
  if (weight && (weight < 20 || weight > 200)) { showToast('⚠️ 体重は20〜200kgで入力してください'); return; }
  if (height && (height < 100 || height > 250)) { showToast('⚠️ 身長は100〜250cmで入力してください'); return; }

  const isNew = !state.profile;
  state.profile = { name, gender, age, height, weight };
  localStorage.setItem('nomi_profile', JSON.stringify(state.profile));

  // クラウド同期（ログイン中のみ）
  if (window.Sync) Sync.mirrorProfile(state.profile);

  renderProfileView();   // 確定ビューを更新
  renderHomeProfileBar(); // ホームのプロフィールバーを更新
  renderGauge();
  renderCharacter();

  showProfileViewMode(); // フォームを隠してビューモードへ
  window.scrollTo({ top: 0, behavior: 'smooth' }); // 確定ビューを確実に表示
  showToast(isNew ? '✅ プロフィールを設定しました！' : '✅ プロフィールを更新しました');
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

  // 翌日リソース消費を更新
  renderResourceImpact(totalGram);

  // お金の可視化を更新
  renderMoney();

  const eq=document.getElementById('kcal-equiv');
  if(totalKcal===0){ eq.innerHTML=''; return; }
  eq.innerHTML=`
    <div class="kcal-chip">🍚 ご飯 ${(totalKcal/252).toFixed(1)} 杯分</div>
    <div class="kcal-chip">🏃 ジョギング ${Math.round(totalKcal/7)} 分</div>
    <div class="kcal-chip">🚶 ウォーク ${Math.round(totalKcal/4)} 分</div>
  `;
}

// ============================================================
//  RESOURCE IMPACT (翌日のリソース消費に変換)
// ============================================================
function renderResourceImpact(totalGram) {
  const el = document.getElementById('resource-impact');
  const lead = document.getElementById('resource-lead');
  if (!el) return;

  // ── 飲んでいない場合：ポジティブ表示 ──
  if (totalGram <= 0) {
    if (lead) lead.style.display = 'none';
    el.innerHTML = `
      <div class="resource-clean">
        <div class="resource-clean-emoji">🌅</div>
        <div class="resource-clean-title">今日はノーアルコール！</div>
        <div class="resource-clean-sub">明日のあなたのリソースは満タンです</div>
        <div class="resource-clean-list">
          <span class="resource-clean-chip">💧 体重 むくみなし</span>
          <span class="resource-clean-chip">💪 筋肉 回復力フル</span>
          <span class="resource-clean-chip">✨ 肌 絶好調</span>
        </div>
      </div>`;
    return;
  }

  if (lead) lead.style.display = 'block';

  const g = totalGram;
  const weightKg = state.profile && state.profile.weight ? state.profile.weight : 60;

  // ── ① 体重（むくみ・水分貯留） ──
  // 翌朝のむくみ・水分貯留の目安（kg）
  const bloatKg = Math.round(g * 0.02 * 100) / 100;
  const waterCups = Math.ceil(g / 10); // 対策に必要な水分（コップ杯）
  const bloatPct = Math.min((bloatKg / 1.0) * 100, 100); // 1.0kgで100%

  // ── ② 筋肉（タンパク質合成・回復力） ──
  // 体格を考慮した筋肉回復力の低下率
  const muscleRaw = (g / weightKg) * 28; // 体重比でMPS低下を近似
  const musclePct = Math.min(Math.round(muscleRaw), 45);
  const workoutsLost = Math.max(1, Math.round(g / 12)); // 無駄になる筋トレ換算
  const muscleBar = Math.min((musclePct / 45) * 100, 100);

  // ── ③ 肌（水分・ハリ・コンディション） ──
  const skinPct = Math.min(Math.round(g * 1.0), 50);
  const skinAgeEquiv = Math.round(g * 0.04 * 10) / 10; // 一時的な肌年齢への影響（歳相当）
  const skinBar = Math.min((skinPct / 50) * 100, 100);

  // 重症度レベル判定（0:軽 〜 3:重）
  const sevLevel = (ratio) => ratio < 0.25 ? 0 : ratio < 0.5 ? 1 : ratio < 0.75 ? 2 : 3;
  const wLv = sevLevel(bloatPct / 100);
  const mLv = sevLevel(muscleBar / 100);
  const sLv = sevLevel(skinBar / 100);

  el.innerHTML = `
    <!-- 体重 -->
    <div class="resource-item res-weight res-level-${wLv}">
      <div class="resource-head">
        <span class="resource-icon">💧</span>
        <span class="resource-name">体重<small>翌朝のむくみ・水分貯留</small></span>
        <span class="resource-value">+${bloatKg}<small>kg</small></span>
      </div>
      <div class="resource-bar-track"><div class="resource-bar-fill" style="width:${bloatPct}%"></div></div>
      <div class="resource-desc">アルコールの利尿作用で脱水→反動でむくみが発生。<strong>水コップ${waterCups}杯</strong>の補給で軽減できます。</div>
    </div>

    <!-- 筋肉 -->
    <div class="resource-item res-muscle res-level-${mLv}">
      <div class="resource-head">
        <span class="resource-icon">💪</span>
        <span class="resource-name">筋肉<small>タンパク質合成・回復力</small></span>
        <span class="resource-value">-${musclePct}<small>%</small></span>
      </div>
      <div class="resource-bar-track"><div class="resource-bar-fill" style="width:${muscleBar}%"></div></div>
      <div class="resource-desc">飲酒は筋タンパク質の合成を抑制します。今夜のトレ効果は <strong>筋トレ${workoutsLost}セット分</strong>が目減りする計算です。</div>
    </div>

    <!-- 肌 -->
    <div class="resource-item res-skin res-level-${sLv}">
      <div class="resource-head">
        <span class="resource-icon">✨</span>
        <span class="resource-name">肌<small>水分・ハリ・コンディション</small></span>
        <span class="resource-value">-${skinPct}<small>%</small></span>
      </div>
      <div class="resource-bar-track"><div class="resource-bar-fill" style="width:${skinBar}%"></div></div>
      <div class="resource-desc">脱水と睡眠の質低下でハリ・水分がダウン。明日の肌は <strong>一時的に約+${skinAgeEquiv}歳</strong>の見た目に。</div>
    </div>`;
}

// ============================================================
//  MONEY (お金の可視化) — 全履歴から集計
// ============================================================
function renderMoney() {
  const todayEl = document.getElementById('money-today');
  if (!todayEl) return;

  const now = new Date();
  const year = now.getFullYear();
  const mon  = now.getMonth();

  // 今日の金額
  const todayPrice = getDayPrice(todayKey());

  // 今月の合計金額
  let monthPrice = 0;
  for (let d = 1; d <= now.getDate(); d++) {
    monthPrice += getDayPrice(`${year}-${mon+1}-${d}`);
  }

  // 全履歴の集計
  const hist = getAllHistoryStats();
  const totalPrice = hist.totalPrice;

  // 年間ペース：最初の記録日〜今日の経過日数で日割り × 365
  let yearPace = 0;
  if (hist.firstDate && totalPrice > 0) {
    const todayMid = new Date(); todayMid.setHours(0,0,0,0);
    const elapsedDays = Math.max(1, Math.round((todayMid - hist.firstDate) / 86400000) + 1);
    yearPace = Math.round((totalPrice / elapsedDays) * 365);
  }

  todayEl.textContent = `¥${todayPrice.toLocaleString()}`;
  document.getElementById('money-month').textContent = `¥${monthPrice.toLocaleString()}`;
  document.getElementById('money-total').textContent = `¥${totalPrice.toLocaleString()}`;
  document.getElementById('money-year').textContent  = `¥${yearPace.toLocaleString()}`;

  // 累計額を「何が買えるか」に換算（削減モチベの演出）
  const equivEl = document.getElementById('money-equiv');
  if (totalPrice === 0) {
    equivEl.innerHTML = `<div class="money-zero">🎉 記録上の支出はまだ ¥0！この調子で節約できています</div>`;
    return;
  }
  const pickEquiv = (v) => {
    if (v >= 700000) return `🏠 家賃 ${Math.floor(v/70000)}ヶ月分（月7万換算）`;
    if (v >= 70000)  return `🏠 ひと月の家賃 約${(v/70000).toFixed(1)}回分`;
    if (v >= 30000)  return `📱 スマホ代 ${Math.floor(v/8000)}ヶ月分`;
    if (v >= 10000)  return `🛒 1週間の食費 約${(v/10000).toFixed(1)}回分`;
    if (v >= 3000)   return `🍱 お昼ごはん ${Math.floor(v/700)}回分`;
    if (v >= 1000)   return `🍙 コンビニ弁当 ${Math.floor(v/600)}個分`;
    return `☕ コーヒー ${Math.max(1, Math.round(v/500))}杯分`;
  };
  equivEl.innerHTML = `
    <div class="money-equiv-row">
      <span class="money-equiv-label">これまでの合計で換算すると…</span>
      <span class="money-equiv-chip">${pickEquiv(totalPrice)}</span>
    </div>
    <div class="money-equiv-row" style="margin-top:6px">
      <span class="money-equiv-label">年間ペースで換算すると…</span>
      <span class="money-equiv-chip">${pickEquiv(yearPace)}</span>
    </div>`;
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
  listEl.innerHTML=log.map((item,i)=>{
    const price=resolveItemPrice(item);
    return `
    <div class="log-item">
      <span class="li-icon">${item.icon}</span>
      <div style="flex:1;min-width:0">
        <div class="li-name">${item.name}</div>
        <div class="li-detail">${item.detail}</div>
        <div class="li-meta-row">
          <span class="li-gram">🍶 ${item.gram}g</span>
          <span class="li-kcal">🔥 ${item.kcal}kcal</span>
          ${price?`<span class="li-price">💰 ¥${price}</span>`:''}
          <span class="li-time">${item.time}</span>
        </div>
      </div>
      ${allowDelete?`<button class="li-del" onclick="removeLogItem('${key}',${i})">✕</button>`:''}
    </div>`;
  }).join('');
}

function addDrink(drink, targetKey, qty, noSwitch) {
  const key = targetKey || state.addDate || todayKey();
  const count = qty && qty > 0 ? qty : 1;
  const gram=calcGram(drink.ml,drink.pct);
  const kcal=drink.kcal!==undefined?drink.kcal:calcKcalAlc(drink.ml,drink.pct);
  const price=drink.price!==undefined?drink.price:0;
  const now=new Date();
  const time=`${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  const log=getLogForKey(key);
  const entry={icon:drink.icon,name:drink.name,detail:drink.sub,gram,kcal,price,time};
  for (let n=0; n<count; n++) {
    log.unshift({...entry});
  }
  saveLogForKey(key,log);

  // クラウド同期（ログイン中のみ・バックグラウンド）
  if (window.Sync) { for (let n=0; n<count; n++) Sync.mirrorAddLog(key, entry); }

  const isToday=(key===todayKey());
  if(isToday){ renderGauge(); renderLog(); renderCharacter(); }
  else { renderMoney(); } // 過去日追加でも今月金額を更新
  renderCalendar();
  if(state.selectedCalDay===key) renderDayDetail(key);
  const qtyLabel = count>1 ? ` ×${count}` : '';
  showToast(`${drink.icon} ${drink.name}${qtyLabel} を追加（${isToday?'今日':formatDateJP(key)}）`);
  if(!noSwitch) switchTab('home');
}

// 数量選択シート用：選択中のドリンク
function openQtySheet(drink) {
  state.qtyDrink = drink;
  document.getElementById('qty-drink-name').textContent = `${drink.icon} ${drink.name}`;
  document.getElementById('qty-modal').style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeQtySheet() {
  document.getElementById('qty-modal').style.display = 'none';
  document.body.style.overflow = '';
  state.qtyDrink = null;
}
function handleQtyOverlayClick(e) {
  if (e.target === e.currentTarget) closeQtySheet();
}
function addQty(n) {
  if (!state.qtyDrink) return;
  const d = state.qtyDrink;
  closeQtySheet();
  addDrink(d, null, n);
}

// ============================================================
//  USUAL SET（いつものセット復元）
// ============================================================
// 直近で記録がある「過去の日」を探してその組み合わせを返す
function getUsualSet() {
  const today = todayKey();
  // 過去90日を新しい順にスキャン（今日は除く）
  for (let i=1; i<=90; i++) {
    const d=new Date(); d.setDate(d.getDate()-i);
    const key=dateToKey(d);
    const log=getLogForKey(key);
    if (log.length>0) {
      // 名前ごとに集計
      const counts={};
      log.forEach(it=>{ counts[it.name]=(counts[it.name]||0)+1; });
      return { key, log, counts };
    }
  }
  return null;
}

function renderUsualSet() {
  const card=document.getElementById('usual-set-card');
  if(!card) return;
  const usual=getUsualSet();
  if(!usual){ card.style.display='none'; return; }
  // "ビール×3, ハイボール×2" のような表記
  const parts=Object.entries(usual.counts).map(([name,c])=> c>1?`${name}×${c}`:name);
  document.getElementById('usual-set-detail').textContent=parts.join('・');
  state.usualSet=usual;
  card.style.display='flex';
}

function addUsualSet() {
  if(!state.usualSet) return;
  const key=state.addDate||todayKey();
  const srcLog=state.usualSet.log;
  const now=new Date();
  const time=`${now.getHours()}:${String(now.getMinutes()).padStart(2,'0')}`;
  const log=getLogForKey(key);
  // 過去ログの各項目を新しい時刻で複製して追加
  srcLog.forEach(it=>{
    log.unshift({icon:it.icon,name:it.name,detail:it.detail,gram:it.gram,kcal:it.kcal,price:it.price||0,time});
  });
  saveLogForKey(key,log);
  const isToday=(key===todayKey());
  if(isToday){ renderGauge(); renderLog(); renderCharacter(); }
  else { renderMoney(); }
  renderCalendar();
  if(state.selectedCalDay===key) renderDayDetail(key);
  showToast(`🔁 いつものセット ${srcLog.length}杯を追加`);
  switchTab('home');
}

function addCustom() {
  const ml =parseFloat(document.getElementById('custom-ml').value);
  const pct=parseFloat(document.getElementById('custom-pct').value);
  const name=document.getElementById('custom-name').value.trim()||'カスタム';
  const price=parseInt(document.getElementById('custom-price').value)||0;
  if(!ml||!pct){ showToast('⚠️ 量と度数を入力してください'); return; }
  addDrink({icon:'🥂',name,sub:`${ml}ml · ${pct}%`,ml,pct,price});
  document.getElementById('custom-ml').value='';
  document.getElementById('custom-pct').value='';
  document.getElementById('custom-name').value='';
  document.getElementById('custom-price').value='';
  document.getElementById('custom-preview').innerHTML='';
}

function removeLogItem(key, i) {
  const log=getLogForKey(key);
  const removed=log.splice(i,1)[0];
  saveLogForKey(key,log);
  const isToday=(key===todayKey());
  if(isToday){ renderGauge(); renderLog(); renderCharacter(); }
  else { renderMoney(); } // 過去日削除でも今月金額を更新
  renderCalendar();
  if(state.selectedCalDay===key) renderDayDetail(key);
  renderPeriodStats();
  showToast(`🗑 ${removed.name} を削除しました`);
}

// リセット確認モーダルを開く
function resetLog() {
  const todayTotal = getDayTotal(todayKey());
  const count = getLogForKey(todayKey()).length;
  if (count === 0) { showToast('記録がありません'); return; }
  document.getElementById('reset-target').textContent =
    `${count}件の記録（${Math.round(todayTotal*10)/10}g）`;
  const modal = document.getElementById('reset-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
function closeResetModal() {
  document.getElementById('reset-modal').style.display = 'none';
  document.body.style.overflow = '';
}
function handleResetOverlayClick(event) {
  if (event.target === event.currentTarget) closeResetModal();
}
function confirmResetLog() {
  const tk = todayKey();
  saveLogForKey(tk, []);
  if (window.Sync) Sync.mirrorResetDay(tk); // クラウドの今日分も削除
  renderGauge(); renderLog(); renderCharacter(); renderCalendar();
  // 履歴の日別詳細パネルが今日を表示中なら更新（古いログが残るのを防ぐ）
  if (state.selectedCalDay === tk) renderDayDetail(tk);
  renderPeriodStats();
  closeResetModal();
  showToast('🗑 今日のログをリセットしました');
}

// ============================================================
//  DRINKS GRID (Built-in)
// ============================================================
// 全履歴からお酒の名前ごとの出現回数を集計
function getDrinkFrequency() {
  const freq = {};
  for (let i=0; i<localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('nomi_log_')) continue;
    let log;
    try { log = JSON.parse(localStorage.getItem(k)); } catch(e) { continue; }
    if (!Array.isArray(log)) continue;
    log.forEach(item => { freq[item.name] = (freq[item.name]||0) + 1; });
  }
  return freq;
}

function renderDrinksGrid() {
  const freq = getDrinkFrequency();
  // よく飲む順にソート（頻度0は元の順序を維持）
  const sorted = [...BUILT_IN_DRINKS].sort((a,b) => (freq[b.name]||0) - (freq[a.name]||0));
  document.getElementById('drinks-grid').innerHTML=sorted.map(d=>{
    const g=calcGram(d.ml,d.pct);
    const count = freq[d.name]||0;
    const popular = count>0 ? `<span class="freq-badge">${count}回</span>` : '';
    return `
      <div class="drink-wrap">
        <button class="drink-btn" onclick='addDrink(${JSON.stringify(d)})'>
          ${popular}
          <span class="drink-icon">${d.icon}</span>
          <span class="drink-name">${d.name}</span>
          <span class="drink-detail">${d.sub}</span>
          <div class="drink-tags">
            <span class="tag alc">🍶 ${g}g</span>
            <span class="tag cal">🔥 ${d.kcal}kcal</span>
            ${d.price?`<span class="tag yen">💰 ¥${d.price}</span>`:''}
          </div>
        </button>
        <button class="qty-btn" onclick='openQtySheet(${JSON.stringify(d)})'>×2,×3…</button>
      </div>`;
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
        <button class="drink-btn my-drink-btn" onclick='addDrink(${JSON.stringify(d)})'>
          <span class="drink-icon">${d.icon}</span>
          <span class="drink-name">${d.name}</span>
          <span class="drink-detail">${d.sub}</span>
          <div class="drink-tags">
            <span class="tag alc">🍶 ${g}g</span>
            <span class="tag cal">🔥 ${d.kcal}kcal</span>
            ${d.price?`<span class="tag yen">💰 ¥${d.price}</span>`:''}
          </div>
        </button>
        <div class="my-drink-actions">
          <button class="btn-qty-tpl" onclick='openQtySheet(${JSON.stringify(d)})'>×2,3</button>
          <button class="btn-edit-tpl" onclick="showTemplateForm('${d.id}')">✏️</button>
          <button class="btn-del-tpl"  onclick="deleteTemplate('${d.id}')">🗑</button>
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
      document.getElementById('tpl-price').value=d.price||'';
    }
  } else {
    document.getElementById('tpl-name').value='';
    document.getElementById('tpl-icon').value='🥂';
    document.getElementById('tpl-ml').value='';
    document.getElementById('tpl-pct').value='';
    document.getElementById('tpl-kcal').value='';
    document.getElementById('tpl-price').value='';
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
  const price=parseInt(document.getElementById('tpl-price').value)||0;
  if(!name||!ml||!pct){ showToast('⚠️ 名前・量・度数は必須です'); return; }
  const sub=`${ml}ml · ${pct}%`;
  const editId=document.getElementById('tpl-edit-id').value;
  let savedTpl;
  if(editId){
    const idx=state.customDrinks.findIndex(x=>x.id===editId);
    savedTpl={id:editId,icon,name,sub,ml,pct,kcal,price};
    if(idx>=0) state.customDrinks[idx]=savedTpl;
    showToast('✏️ テンプレートを更新しました');
  } else {
    const id='custom_'+Date.now();
    savedTpl={id,icon,name,sub,ml,pct,kcal,price};
    state.customDrinks.push(savedTpl);
    showToast('✅ テンプレートを保存しました');
  }
  saveCustomDrinks();
  if (window.Sync) Sync.mirrorSaveTemplate(savedTpl); // クラウド同期
  hideTemplateForm();
  renderMyDrinksGrid();
}
// 削除確認モーダルを開く（削除対象を保持）
function deleteTemplate(id) {
  const tpl = state.customDrinks.find(d => d.id === id);
  if (!tpl) return;
  state.pendingDeleteId = id;
  document.getElementById('confirm-target').textContent = `${tpl.icon} ${tpl.name}`;
  const modal = document.getElementById('confirm-modal');
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';
}
// モーダルを閉じる
function closeConfirmModal() {
  const modal = document.getElementById('confirm-modal');
  modal.style.display = 'none';
  document.body.style.overflow = '';
  state.pendingDeleteId = null;
}
// 背景タップで閉じる
function handleConfirmOverlayClick(event) {
  if (event.target === event.currentTarget) closeConfirmModal();
}
// 実際に削除を実行
function confirmDeleteTemplate() {
  const id = state.pendingDeleteId;
  if (!id) { closeConfirmModal(); return; }
  const tpl = state.customDrinks.find(d => d.id === id);
  state.customDrinks = state.customDrinks.filter(d => d.id !== id);
  saveCustomDrinks();
  if (window.Sync) Sync.mirrorDeleteTemplate(id); // クラウド同期
  renderMyDrinksGrid();
  closeConfirmModal();
  showToast(`🗑 ${tpl ? tpl.name : 'テンプレート'} を削除しました`);
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
// ローカルタイムの YYYY-MM-DD 文字列（input[type=date]用）
function toLocalDateInput(d) {
  const y=d.getFullYear();
  const m=String(d.getMonth()+1).padStart(2,'0');
  const day=String(d.getDate()).padStart(2,'0');
  return `${y}-${m}-${day}`;
}

function initAddDate() {
  const input=document.getElementById('add-date');
  const today=new Date();
  const todayInput=toLocalDateInput(today);
  input.value=todayInput;
  input.max=todayInput; // 未来日を選択不可に
  state.addDate=todayKey();
  updateDateSelNote();
}
function onAddDateChange() {
  const val=document.getElementById('add-date').value;
  if(!val) return;
  const d=new Date(val+'T00:00:00');
  // 未来日が入力されたら今日に戻す（トーストは未来日警告のみ）
  const todayMidnight=new Date(); todayMidnight.setHours(0,0,0,0);
  if(d>todayMidnight){
    resetAddDateToToday();          // 日付だけ静かに今日へ戻す
    showToast('⚠️ 未来の日付は選択できません');
    return;
  }
  state.addDate=dateToKey(d);
  updateDateSelNote();
}
// 日付を今日に戻す（トーストなし・内部用）
function resetAddDateToToday() {
  const today=new Date();
  document.getElementById('add-date').value=toLocalDateInput(today);
  state.addDate=todayKey();
  updateDateSelNote();
}
function setAddDateToday() {
  resetAddDateToToday();
  showToast('📅 今日の日付にしました');
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

  // 今日の0時（未来判定用）
  const todayMidnight=new Date();
  todayMidnight.setHours(0,0,0,0);

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
    const riskIcon=gram>0?RISK_ICONS[risk]:'';
    const isFuture=dateObj>todayMidnight; // 未来日は選択不可

    html+=`
      <div class="cal-day ${riskClass} ${isToday} ${isSel} ${dowClass} ${isFuture?'future':''}"
           ${isFuture?'':`onclick="selectCalDay('${key}')"`}>
        <span class="cal-day-num">${d}</span>
        <span class="cal-day-icon">${riskIcon}</span>
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
  // 未来日は選択不可
  const d=keyToDate(key);
  const todayMidnight=new Date();
  todayMidnight.setHours(0,0,0,0);
  if(d>todayMidnight) return;

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

  let totalGram=0,totalKcal=0,totalPrice=0,drinkingDays=0;
  const riskCounts=[0,0,0,0,0,0]; // index 0-5

  keys.forEach(k=>{
    const g=getDayTotal(k);
    const kc=getDayKcal(k);
    const pr=getDayPrice(k);
    if(g>0){ drinkingDays++; totalGram+=g; totalKcal+=kc; totalPrice+=pr; }
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
        <div class="ps-val" style="color:var(--amber-light)">¥${totalPrice.toLocaleString()}</div>
        <div class="ps-label">総支出</div>
      </div>
      <div class="ps-item">
        <div class="ps-val" style="color:${overDays>0?'var(--red)':'var(--green)'}">${overDays}<small>日</small></div>
        <div class="ps-label">超過日数</div>
      </div>
      <div class="ps-item">
        <div class="ps-val" style="color:var(--green)">${safeDays}<small>日</small></div>
        <div class="ps-label">適量内日数</div>
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
  if(tab==='add')     { renderDrinksGrid(); renderMyDrinksGrid(); renderUsualSet(); }
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
renderUsualSet();
initAddDate();
renderCalendar();
renderPeriodStats();
renderLegend();
initInstallBanner();
initAuth();

// ============================================================
//  AUTH UI（ハイブリッド：ログインなしでも使える＋ログインで同期）
// ============================================================
let _authMode = 'login'; // 'login' | 'signup'

// Supabaseの英語エラーを日本語に変換
function jpAuthError(e) {
  const msg = (e && e.message ? e.message : String(e || '')).toLowerCase();
  if (msg.includes('invalid login credentials')) return 'メールアドレスまたはパスワードが正しくありません';
  if (msg.includes('email not confirmed'))       return 'メール確認が完了していません。受信メールのリンクを確認してください';
  if (msg.includes('user already registered') || msg.includes('already been registered'))
    return 'このメールアドレスは既に登録されています。ログインしてください';
  if (msg.includes('password should be at least')) return 'パスワードは6文字以上で入力してください';
  if (msg.includes('unable to validate email') || msg.includes('invalid email'))
    return 'メールアドレスの形式が正しくありません';
  if (msg.includes('provider is not enabled'))    return 'このログイン方法は現在無効です（管理側で有効化が必要）';
  if (msg.includes('rate limit') || msg.includes('too many'))
    return '試行回数が多すぎます。しばらく待ってからお試しください';
  if (msg.includes('network') || msg.includes('failed to fetch'))
    return 'ネットワークに接続できませんでした。通信環境を確認してください';
  if (msg.includes('signups not allowed'))        return '現在、新規登録が制限されています';
  return 'うまくいきませんでした（' + (e && e.message ? e.message : '不明なエラー') + '）';
}

function initAuth() {
  // Supabase/Sync が読み込まれていなければスキップ（ローカルのみで動作）
  if (!window.Sync || !window.sbClient) {
    console.log('クラウド同期は無効（ローカルのみで動作）');
    return;
  }
  console.log('クラウド同期が有効です');
  Sync.watchAuth((user) => {
    updateAccountUI(user);
    if (user) {
      // ログイン直後：クラウドのデータを取り込んで再描画
      setTimeout(() => {
        loadState();
        renderHomeProfileBar(); renderProfileView(); syncProfileTab();
        renderGauge(); renderLog(); renderCharacter();
        renderDrinksGrid(); renderMyDrinksGrid(); renderUsualSet();
        renderCalendar(); renderPeriodStats();
      }, 600);
    }
  });
}

function updateAccountUI(user) {
  const loggedOut = document.getElementById('account-logged-out');
  const loggedIn  = document.getElementById('account-logged-in');
  if (!loggedOut || !loggedIn) return;
  if (user) {
    loggedOut.style.display = 'none';
    loggedIn.style.display  = 'block';
    document.getElementById('account-email').textContent = user.email || 'ログイン中';
  } else {
    loggedOut.style.display = 'block';
    loggedIn.style.display  = 'none';
  }
}

function switchAuthTab(mode) {
  _authMode = mode;
  document.getElementById('auth-tab-login').classList.toggle('active', mode==='login');
  document.getElementById('auth-tab-signup').classList.toggle('active', mode==='signup');
  document.getElementById('auth-submit').textContent = mode==='login' ? 'ログイン' : '新規登録';
}

async function handleAuthSubmit() {
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  if (!email || !password) { showToast('⚠️ メールとパスワードを入力してください'); return; }
  if (password.length < 6) { showToast('⚠️ パスワードは6文字以上です'); return; }
  const btn = document.getElementById('auth-submit');
  btn.disabled = true; btn.textContent = '処理中...';
  try {
    if (_authMode === 'signup') {
      const { needsConfirm } = await signUpEmail(email, password);
      if (needsConfirm) {
        showToast('📧 確認メールを送信しました。メール内のリンクを開いてください');
      } else {
        showToast('✅ 登録しました！データを同期します');
      }
    } else {
      await signInEmail(email, password);
      showToast('✅ ログインしました！');
    }
  } catch (e) {
    showToast('⚠️ ' + jpAuthError(e));
  } finally {
    btn.disabled = false;
    btn.textContent = _authMode==='login' ? 'ログイン' : '新規登録';
  }
}

async function handleGoogleLogin() {
  try { await signInGoogle(); }
  catch (e) { showToast('⚠️ ' + jpAuthError(e)); }
}

async function handleLogout() {
  if (!confirm('ログアウトしますか？（端末内のデータは残ります）')) return;
  try {
    await signOut();
    showToast('👋 ログアウトしました');
    updateAccountUI(null);
  } catch (e) {
    showToast('⚠️ ' + jpAuthError(e));
  }
}

// ============================================================
//  INSTALL GUIDE（ホーム画面に追加の説明）
// ============================================================

// スタンドアローンモード（既にホーム画面から起動中）の判定
function isStandaloneMode() {
  return window.matchMedia('(display-mode: standalone)').matches
      || window.navigator.standalone === true;
}

// バナーの初期表示判定
function initInstallBanner() {
  if (isStandaloneMode()) return; // 既にインストール済みなら非表示
  const dismissed = localStorage.getItem('nomi_install_dismissed');
  if (dismissed) return;
  const banner = document.getElementById('install-banner');
  if (banner) banner.style.display = 'block';
}

// バナーを閉じる（今後表示しない）
function dismissInstallBanner() {
  const banner = document.getElementById('install-banner');
  if (banner) {
    banner.style.animation = 'none';
    banner.style.opacity = '0';
    banner.style.transition = 'opacity 0.25s';
    setTimeout(() => { banner.style.display = 'none'; }, 260);
  }
  localStorage.setItem('nomi_install_dismissed', '1');
}

// モーダルを開く
function showInstallModal() {
  const modal = document.getElementById('install-modal');
  if (!modal) return;
  modal.style.display = 'flex';
  document.body.style.overflow = 'hidden';

  // プラットフォーム自動判定
  const isIOS     = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  const isAndroid = /Android/.test(navigator.userAgent);
  if (isAndroid) {
    switchPlatformTab('android');
  } else {
    switchPlatformTab('ios'); // iOS またはその他は iOS タブをデフォルト表示
  }
}

// モーダルを閉じる
function closeInstallModal() {
  const modal = document.getElementById('install-modal');
  if (!modal) return;
  const sheet = modal.querySelector('.modal-sheet');
  if (sheet) {
    sheet.style.animation = 'none';
    sheet.style.transform = 'translateY(60px)';
    sheet.style.opacity   = '0';
    sheet.style.transition = 'transform 0.25s ease, opacity 0.25s';
  }
  setTimeout(() => {
    modal.style.display = 'none';
    document.body.style.overflow = '';
    if (sheet) {
      sheet.style.transform = '';
      sheet.style.opacity   = '';
      sheet.style.transition = '';
    }
  }, 260);
}

// オーバーレイ（背景）タップで閉じる
function handleModalOverlayClick(event) {
  if (event.target === event.currentTarget) closeInstallModal();
}

// プラットフォームタブ切り替え
function switchPlatformTab(platform) {
  const iosBtn     = document.getElementById('tab-ios');
  const androidBtn = document.getElementById('tab-android');
  const iosCont    = document.getElementById('platform-ios');
  const androidCont= document.getElementById('platform-android');
  if (!iosBtn) return;

  if (platform === 'ios') {
    iosBtn.classList.add('active');
    androidBtn.classList.remove('active');
    iosCont.style.display     = 'block';
    androidCont.style.display = 'none';
  } else {
    androidBtn.classList.add('active');
    iosBtn.classList.remove('active');
    androidCont.style.display = 'block';
    iosCont.style.display     = 'none';
  }
}

