// ============================================================
//  のみログ ── Supabase 連携モジュール (supabase.js)
//  使い方：index.html の <script src="app.js"> の前に
//    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
//    <script src="supabase.js"></script>
//  を読み込む。
// ============================================================

// ── ① 接続設定（Supabaseダッシュボード > Settings > API から取得）──
const SUPABASE_URL      = 'https://xxxxxxxxxxxx.supabase.co'; // ←自分のURLに置き換え
const SUPABASE_ANON_KEY = 'eyJhbGci...';                      // ←anon public キーに置き換え

const sb = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
// 接続クライアントをグローバルに公開（app.js の判定用）
window.sbClient = sb;

// ============================================================
//  認証 (Auth)
// ============================================================

// メール＋パスワードで新規登録
// 戻り値 needsConfirm: true = メール確認が必要（セッション未発行）
async function signUpEmail(email, password) {
  const { data, error } = await sb.auth.signUp({ email, password });
  if (error) throw error;
  // session が無い = メール確認待ち。ある = 即ログイン状態
  const needsConfirm = !data.session;
  return { data, needsConfirm };
}

// メール＋パスワードでログイン
async function signInEmail(email, password) {
  const { data, error } = await sb.auth.signInWithPassword({ email, password });
  if (error) throw error;
  return data;
}

// Googleログイン（リダイレクト方式）
async function signInGoogle() {
  const { data, error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
  if (error) throw error;
  return data;
}

// ログアウト
async function signOut() {
  const { error } = await sb.auth.signOut();
  if (error) throw error;
}

// 現在のユーザーを取得（未ログインなら null）
async function getCurrentUser() {
  const { data: { user } } = await sb.auth.getUser();
  return user;
}

// ログイン状態の変化を監視（ログイン/ログアウトでUIを切り替える）
function onAuthChange(callback) {
  sb.auth.onAuthStateChange((_event, session) => {
    callback(session?.user || null);
  });
}

// ============================================================
//  プロフィール (profiles)
// ============================================================
async function fetchProfile() {
  const user = await getCurrentUser();
  if (!user) return null;
  const { data, error } = await sb
    .from('profiles').select('*').eq('id', user.id).single();
  if (error && error.code !== 'PGRST116') throw error; // PGRST116 = 行なし
  return data;
}

async function saveProfileCloud(profile) {
  const user = await getCurrentUser();
  if (!user) throw new Error('未ログイン');
  const { data, error } = await sb
    .from('profiles')
    .upsert({ id: user.id, ...profile })
    .select().single();
  if (error) throw error;
  return data;
}

// ============================================================
//  飲酒記録 (drink_logs)
// ============================================================

// 1杯追加
async function addLogCloud(entry) {
  const user = await getCurrentUser();
  if (!user) throw new Error('未ログイン');
  const { data, error } = await sb
    .from('drink_logs')
    .insert({ user_id: user.id, ...entry })
    .select().single();
  if (error) throw error;
  return data;
}

// 指定日の記録を取得（drank_on は 'YYYY-MM-DD'）
async function fetchLogsByDate(dateStr) {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await sb
    .from('drink_logs').select('*')
    .eq('user_id', user.id).eq('drank_on', dateStr)
    .order('logged_at', { ascending: false });
  if (error) throw error;
  return data;
}

// 期間の記録を取得（カレンダー・集計用）
async function fetchLogsRange(fromStr, toStr) {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await sb
    .from('drink_logs').select('*')
    .eq('user_id', user.id)
    .gte('drank_on', fromStr).lte('drank_on', toStr)
    .order('drank_on', { ascending: true });
  if (error) throw error;
  return data;
}

// 全記録を取得（累計の金額・頻度ソートなど）
async function fetchAllLogs() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await sb
    .from('drink_logs').select('*')
    .eq('user_id', user.id)
    .order('drank_on', { ascending: false });
  if (error) throw error;
  return data;
}

// 1件削除
async function deleteLogCloud(logId) {
  const { error } = await sb.from('drink_logs').delete().eq('id', logId);
  if (error) throw error;
}

// 指定日を一括削除（今日のリセット用）
async function deleteLogsByDate(dateStr) {
  const user = await getCurrentUser();
  if (!user) throw new Error('未ログイン');
  const { error } = await sb.from('drink_logs')
    .delete().eq('user_id', user.id).eq('drank_on', dateStr);
  if (error) throw error;
}

// ============================================================
//  マイテンプレート (drink_templates)
// ============================================================
async function fetchTemplates() {
  const user = await getCurrentUser();
  if (!user) return [];
  const { data, error } = await sb
    .from('drink_templates').select('*')
    .eq('user_id', user.id)
    .order('sort_order', { ascending: true });
  if (error) throw error;
  return data;
}

async function saveTemplateCloud(tpl) {
  const user = await getCurrentUser();
  if (!user) throw new Error('未ログイン');
  // id を含めずに insert（id は DB が uuid を自動採番）
  const { id, ...fields } = tpl;
  const row = { user_id: user.id, ...fields };
  const { data, error } = await sb
    .from('drink_templates').insert(row).select().single();
  if (error) throw error;
  return data;
}

async function deleteTemplateCloud(tplId) {
  const { error } = await sb.from('drink_templates').delete().eq('id', tplId);
  if (error) throw error;
}

// ============================================================
//  localStorage → Supabase 移行（初回ログイン時に一度だけ実行）
// ============================================================
async function migrateLocalToCloud() {
  const user = await getCurrentUser();
  if (!user) throw new Error('未ログイン');

  // 二重移行を防ぐフラグ
  if (localStorage.getItem('nomi_migrated')) {
    console.log('[移行] 既に移行済みのためスキップ');
    return { skipped: true };
  }
  console.log('[移行] localStorage→クラウドの移行を開始');

  let migratedLogs = 0, migratedTpls = 0;

  // ① プロフィール
  try {
    const p = JSON.parse(localStorage.getItem('nomi_profile') || 'null');
    if (p) {
      await saveProfileCloud({
        name: p.name, gender: p.gender,
        age: p.age, height: p.height, weight: p.weight,
      });
    }
  } catch (e) { console.warn('profile移行スキップ', e); }

  // ② 飲酒ログ（nomi_log_YYYY-M-D を全部）
  const logRows = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k || !k.startsWith('nomi_log_')) continue;
    let log;
    try { log = JSON.parse(localStorage.getItem(k)); } catch { continue; }
    if (!Array.isArray(log)) continue;

    // キー 'nomi_log_2025-6-10' → date '2025-06-10'
    const raw = k.replace('nomi_log_', '');
    const [y, m, d] = raw.split('-');
    const dateStr = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;

    log.forEach(it => {
      logRows.push({
        user_id: user.id,
        drank_on: dateStr,
        icon: it.icon, name: it.name, detail: it.detail,
        gram: it.gram || 0, kcal: it.kcal || 0, price: it.price || 0,
      });
    });
  }
  if (logRows.length) {
    // 大量データはバッチ投入
    for (let i = 0; i < logRows.length; i += 500) {
      const chunk = logRows.slice(i, i + 500);
      const { error } = await sb.from('drink_logs').insert(chunk);
      if (error) throw error;
      migratedLogs += chunk.length;
    }
  }

  // ③ マイテンプレート
  try {
    const tpls = JSON.parse(localStorage.getItem('nomi_custom_drinks') || '[]');
    if (Array.isArray(tpls) && tpls.length) {
      const rows = tpls.map((t, idx) => ({
        user_id: user.id,
        icon: t.icon, name: t.name, sub: t.sub,
        ml: t.ml, pct: t.pct, kcal: t.kcal || 0, price: t.price || 0,
        sort_order: idx,
      }));
      const { error } = await sb.from('drink_templates').insert(rows);
      if (error) throw error;
      migratedTpls = rows.length;
    }
  } catch (e) { console.warn('template移行スキップ', e); }

  // 移行完了フラグ（端末ごと）
  localStorage.setItem('nomi_migrated', new Date().toISOString());
  console.log(`[移行] 完了：ログ${migratedLogs}件 / テンプレ${migratedTpls}件`);
  return { migratedLogs, migratedTpls };
}
