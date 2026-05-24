/* =============================================
   のみログ — app.js
   ============================================= */

// ---------- Drink Templates ----------
// kcal = total calories per serving (alcohol + carbs/sugar)
const DRINKS = [
  { id: 'beer350',  icon: '🍺', name: 'ビール',      sub: '350ml · 5%',          ml: 350, pct: 5,   kcal: 140 },
  { id: 'beer500',  icon: '🍺', name: 'ビール大',     sub: '500ml · 5%',          ml: 500, pct: 5,   kcal: 200 },
  { id: 'sake',     icon: '🍶', name: '日本酒',       sub: '1合 180ml · 15%',     ml: 180, pct: 15,  kcal: 185 },
  { id: 'wine',     icon: '🍷', name: 'ワイン',       sub: 'グラス 120ml · 12%',  ml: 120, pct: 12,  kcal: 88  },
  { id: 'chuhai',   icon: '🥤', name: 'チューハイ',   sub: '350ml · 5%',          ml: 350, pct: 5,   kcal: 158 },
  { id: 'highball', icon: '🥃', name: 'ハイボール',   sub: '350ml · 7%',          ml: 350, pct: 7,   kcal: 175 },
  { id: 'shochu',   icon: '🫗', name: '焼酎',         sub: '1杯 90ml · 25%',      ml: 90,  pct: 25,  kcal: 131 },
  { id: 'whisky',   icon: '🥃', name: 'ウイスキー',   sub: 'シングル 30ml · 40%', ml: 30,  pct: 40,  kcal: 71  },
];

// ---------- State ----------
const state = {
  profile: null,
  log: [],
};

// ---------- Storage Keys ----------
const KEY_PROFILE = 'nomi_profile';
const todayKey = () => {
  const d = new Date();
  return `nomi_log_${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`;
};

// ---------- Helpers ----------
const calcGram = (ml, pct) =>
  Math.round(ml * (pct / 100) * 0.8 * 10) / 10;

// Alcohol-only kcal (used for custom drinks without known sugar content)
const calcKcalAlcohol = (ml, pct) =>
  Math.round(ml * (pct / 100) * 0.8 * 7.1);

const getLimit = () =>
  (state.profile && state.profile.gender === 'female') ? 10 : 20;

const dayNames = ['日', '月', '火', '水', '木', '金', '土'];

// ---------- Toast ----------
let toastTimer = null;

function showToast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2500);
}

// ---------- Load / Save ----------
function loadState() {
  try {
    const p = localStorage.getItem(KEY_PROFILE);
    if (p) state.profile = JSON.parse(p);

    const l = localStorage.getItem(todayKey());
    if (l) state.log = JSON.parse(l);
  } catch (e) {
    console.warn('loadState error:', e);
  }
}

function saveLog() {
  localStorage.setItem(todayKey(), JSON.stringify(state.log));
}

// ---------- Profile ----------
function saveProfile() {
  const name   = document.getElementById('p-name').value.trim();
  const gender = document.getElementById('p-gender').value;
  const age    = parseInt(document.getElementById('p-age').value)    || 0;
  const height = parseFloat(document.getElementById('p-height').value) || 0;
  const weight = parseFloat(document.getElementById('p-weight').value) || 0;

  if (!name)    { showToast('⚠️ お名前を入力してください'); return; }
  if (age < 20) { showToast('⚠️ 20歳未満の方はご利用になれません'); return; }

  state.profile = { name, gender, age, height, weight };
  localStorage.setItem(KEY_PROFILE, JSON.stringify(state.profile));

  renderProfile();
  renderGauge();
  showToast('✅ プロフィールを保存しました');

  // Show delete button once a profile exists
  document.getElementById('btn-clear-profile').style.display = 'block';

  switchTab('home');
}

function clearProfile() {
  if (!confirm('プロフィールを削除しますか？')) return;
  state.profile = null;
  localStorage.removeItem(KEY_PROFILE);
  document.getElementById('btn-clear-profile').style.display = 'none';

  // Reset form fields
  ['p-name', 'p-age', 'p-height', 'p-weight'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('p-gender').value = 'male';
  document.getElementById('widmark-preview').style.display = 'none';

  renderProfile();
  renderGauge();
  showToast('🗑 プロフィールを削除しました');
}

function renderProfile() {
  const p = state.profile;

  if (!p) {
    document.getElementById('no-profile').style.display = 'block';
    document.getElementById('has-profile').style.display = 'none';
    document.getElementById('btn-clear-profile').style.display = 'none';
    return;
  }

  document.getElementById('no-profile').style.display = 'none';
  document.getElementById('has-profile').style.display = 'block';
  document.getElementById('btn-clear-profile').style.display = 'block';

  document.getElementById('display-name').textContent = p.name;
  document.getElementById('display-meta').textContent =
    `${p.gender === 'female' ? '女性' : '男性'} · ${p.age}歳 · ${p.height}cm · ${p.weight}kg`;
  document.getElementById('avatar-emoji').textContent =
    p.gender === 'female' ? '👩' : '👨';

  // Populate form for editing
  document.getElementById('p-name').value   = p.name;
  document.getElementById('p-gender').value = p.gender;
  document.getElementById('p-age').value    = p.age;
  document.getElementById('p-height').value = p.height;
  document.getElementById('p-weight').value = p.weight;

  renderWidmark();
}

function renderWidmark() {
  const gender = document.getElementById('p-gender').value;
  const weight = document.getElementById('p-weight').value;
  const age    = document.getElementById('p-age').value;

  if (!age || !weight) return;

  const r     = gender === 'female' ? 0.55 : 0.68;
  const limit = gender === 'female' ? 10   : 20;
  const bac   = ((limit / (parseFloat(weight) * r)) * 100).toFixed(3);

  document.getElementById('widmark-preview').style.display = 'block';
  document.getElementById('widmark-text').innerHTML =
    `適量(${limit}g)摂取時の推定血中アルコール濃度: <strong style="color:var(--amber-light)">${bac}%</strong><br>
     一般的に0.05%以上で酔いを感じ始めます`;
}

// Live update Widmark when profile form changes
['p-gender', 'p-age', 'p-weight'].forEach(id => {
  document.getElementById(id)?.addEventListener('change', renderWidmark);
  document.getElementById(id)?.addEventListener('input',  renderWidmark);
});

// ---------- Gauge ----------
function renderGauge() {
  const totalGram = state.log.reduce((s, i) => s + i.gram, 0);
  const totalKcal = state.log.reduce((s, i) => s + i.kcal, 0);
  const limit     = getLimit();

  // ---- Stat cards ----
  document.getElementById('stat-gram').innerHTML =
    `${Math.round(totalGram * 10) / 10}<small>g</small>`;
  document.getElementById('stat-gram-sub').textContent = `適量: ${limit}g`;
  document.getElementById('stat-kcal').innerHTML =
    `${totalKcal}<small>kcal</small>`;
  document.getElementById('stat-kcal-sub').textContent =
    totalKcal > 0 ? `ご飯 ${(totalKcal / 252).toFixed(1)} 杯分` : '—';

  // ---- Alcohol gauge ----
  const now = new Date();
  document.getElementById('total-gram').innerHTML =
    `${Math.round(totalGram * 10) / 10}<span>g</span>`;
  document.getElementById('limit-label').textContent = `適量: ${limit}g`;
  document.getElementById('date-label').textContent =
    `${now.getMonth() + 1}/${now.getDate()}(${dayNames[now.getDay()]})`;

  const alcPct  = Math.min((totalGram / limit) * 100, 100);
  const fillEl  = document.getElementById('gauge-fill');
  fillEl.style.width = alcPct + '%';
  fillEl.className   = 'gauge-fill ' +
    (totalGram <= limit ? 'safe' : totalGram <= limit * 1.5 ? 'warn' : 'over');

  // ---- Status badge ----
  const badge = document.getElementById('status-badge');
  if (totalGram === 0) {
    badge.className = 'status-badge safe';
    badge.textContent = '📝 まだ飲んでいません';
  } else if (totalGram <= limit * 0.5) {
    badge.className = 'status-badge safe';
    badge.textContent = '😊 まだ余裕があります';
  } else if (totalGram <= limit) {
    badge.className = 'status-badge warn';
    badge.textContent = '⚠️ 適量に近づいています';
  } else if (totalGram <= limit * 1.5) {
    badge.className = 'status-badge over';
    badge.textContent = '🚨 適量を超えています！水を飲みましょう';
  } else {
    badge.className = 'status-badge over';
    badge.textContent = '🛑 かなり飲みすぎです。お水を！';
  }

  // ---- Calorie gauge (400 kcal = 100%) ----
  document.getElementById('total-kcal').innerHTML =
    `${totalKcal}<span>kcal</span>`;
  document.getElementById('kcal-fill').style.width =
    Math.min((totalKcal / 400) * 100, 100) + '%';

  // ---- Calorie equivalents ----
  const equivEl = document.getElementById('kcal-equiv');
  if (totalKcal === 0) {
    equivEl.innerHTML = '';
    return;
  }
  equivEl.innerHTML = `
    <div class="kcal-chip">🍚 ご飯 ${(totalKcal / 252).toFixed(1)} 杯分</div>
    <div class="kcal-chip">🏃 ジョギング ${Math.round(totalKcal / 7)} 分</div>
    <div class="kcal-chip">🚶 ウォーク ${Math.round(totalKcal / 4)} 分</div>
  `;
}

// ---------- Log ----------
function renderLog() {
  const list     = document.getElementById('log-list');
  const resetBtn = document.getElementById('reset-btn');

  if (state.log.length === 0) {
    list.innerHTML =
      '<div class="empty-log">🍵 まだ記録がありません<br>「追加」タブからお酒を追加しよう</div>';
    resetBtn.style.display = 'none';
    return;
  }

  resetBtn.style.display = 'block';
  list.innerHTML = state.log.map((item, i) => `
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
      <button class="li-del" onclick="removeLog(${i})">✕</button>
    </div>
  `).join('');
}

function addDrink(drink) {
  const gram = calcGram(drink.ml, drink.pct);
  const kcal = drink.kcal !== undefined
    ? drink.kcal
    : calcKcalAlcohol(drink.ml, drink.pct);

  const now  = new Date();
  const time = `${now.getHours()}:${String(now.getMinutes()).padStart(2, '0')}`;

  state.log.unshift({
    icon: drink.icon, name: drink.name,
    detail: drink.sub, gram, kcal, time,
  });

  saveLog();
  renderLog();
  renderGauge();
  showToast(`${drink.icon} ${drink.name} を追加しました`);
  switchTab('home');
}

function addCustom() {
  const ml   = parseFloat(document.getElementById('custom-ml').value);
  const pct  = parseFloat(document.getElementById('custom-pct').value);
  const name = document.getElementById('custom-name').value.trim() || 'カスタム';

  if (!ml || !pct) { showToast('⚠️ 量と度数を入力してください'); return; }

  addDrink({ icon: '🥂', name, sub: `${ml}ml · ${pct}%`, ml, pct });

  document.getElementById('custom-ml').value    = '';
  document.getElementById('custom-pct').value   = '';
  document.getElementById('custom-name').value  = '';
  document.getElementById('custom-preview').innerHTML = '';
}

function removeLog(i) {
  const removed = state.log.splice(i, 1)[0];
  saveLog();
  renderLog();
  renderGauge();
  showToast(`🗑 ${removed.name} を削除しました`);
}

function resetLog() {
  if (!confirm('今日の記録をリセットしますか？')) return;
  state.log = [];
  saveLog();
  renderLog();
  renderGauge();
  showToast('🗑 今日のログをリセットしました');
}

// ---------- Drinks Grid ----------
function renderDrinksGrid() {
  document.getElementById('drinks-grid').innerHTML = DRINKS.map(d => {
    const g = calcGram(d.ml, d.pct);
    return `
      <button class="drink-btn" onclick='addDrink(${JSON.stringify(d)})'>
        <span class="drink-icon">${d.icon}</span>
        <span class="drink-name">${d.name}</span>
        <span class="drink-detail">${d.sub}</span>
        <div class="drink-tags">
          <span class="tag alc">🍶 ${g}g</span>
          <span class="tag cal">🔥 ${d.kcal}kcal</span>
        </div>
      </button>
    `;
  }).join('');
}

// Live preview for custom input
['custom-ml', 'custom-pct'].forEach(id => {
  document.getElementById(id).addEventListener('input', () => {
    const ml  = parseFloat(document.getElementById('custom-ml').value);
    const pct = parseFloat(document.getElementById('custom-pct').value);
    const el  = document.getElementById('custom-preview');

    if (ml && pct) {
      const g    = calcGram(ml, pct);
      const kcal = calcKcalAlcohol(ml, pct);
      el.innerHTML =
        `<span style="color:var(--amber)">🍶 純アルコール ${g}g</span>　` +
        `<span style="color:var(--pink)">🔥 約 ${kcal}kcal</span>` +
        `<div style="font-size:0.6rem;margin-top:2px;color:var(--muted)">※糖質・添加物カロリーは含まず</div>`;
    } else {
      el.innerHTML = '';
    }
  });
});

// ---------- Tab Switching ----------
function switchTab(tab) {
  ['home', 'add', 'profile'].forEach(t => {
    document.getElementById(`page-${t}`).classList.toggle('active', t === tab);
    document.getElementById(`tab-${t}`)?.classList.toggle('active', t === tab);
  });
}

// ---------- Init ----------
loadState();
renderProfile();
renderGauge();
renderLog();
renderDrinksGrid();
