// ============================================================
//  のみログ ── ハイブリッド同期レイヤー (sync.js)
//  ・localStorage を「正」として維持（未ログイン/オフラインでも動く）
//  ・ログイン中は保存のたびにバックグラウンドで Supabase にも反映
//  ・別端末でログインしたら起動時にクラウド→localStorage へ取り込み
//
//  読み込み順：supabase.js → sync.js → app.js
// ============================================================

const Sync = (() => {
  let _user = null;          // ログイン中のユーザー（未ログインは null）
  let _ready = false;        // 認証状態の初期判定が済んだか

  // ── ログイン状態 ───────────────────────────────
  function isLoggedIn() { return !!_user; }

  // 認証状態を監視して保持。変化時に onChange を呼ぶ
  function watchAuth(onChange) {
    onAuthChange(async (user) => {
      _user = user;
      _ready = true;
      if (user) {
        // ログインした：初回なら移行、以降はクラウドから取り込み
        try {
          await migrateLocalToCloud();   // 二重移行は内部で防止
          await pullAllFromCloud();      // クラウド→localStorage
        } catch (e) { console.warn('同期エラー', e); }
      }
      if (onChange) onChange(user);
    });
  }

  // ── クラウド → localStorage（全取り込み）─────────
  async function pullAllFromCloud() {
    if (!_user) return;

    // プロフィール
    try {
      const p = await fetchProfile();
      if (p && p.name) {
        const local = {
          name: p.name, gender: p.gender,
          age: p.age, height: p.height, weight: p.weight,
        };
        localStorage.setItem('nomi_profile', JSON.stringify(local));
      }
    } catch (e) { console.warn('profile取込失敗', e); }

    // 飲酒ログ（全件 → 日付キーごとに再構築）
    try {
      const logs = await fetchAllLogs();
      // 既存の nomi_log_* をクリアしてから入れ直す
      const toRemove = [];
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (k && k.startsWith('nomi_log_')) toRemove.push(k);
      }
      toRemove.forEach(k => localStorage.removeItem(k));

      const byDate = {};
      logs.forEach(row => {
        // '2025-06-10' → 'nomi_log_2025-6-10'（アプリのキー形式に戻す）
        const [y, m, d] = row.drank_on.split('-');
        const key = `nomi_log_${y}-${parseInt(m)}-${parseInt(d)}`;
        if (!byDate[key]) byDate[key] = [];
        byDate[key].push({
          icon: row.icon, name: row.name, detail: row.detail,
          gram: Number(row.gram), kcal: row.kcal, price: row.price,
          time: row.logged_at ? new Date(row.logged_at).toTimeString().slice(0,5) : '',
          _cloudId: row.id,   // クラウド側のIDを保持（削除同期用）
        });
      });
      Object.entries(byDate).forEach(([k, arr]) => {
        localStorage.setItem(k, JSON.stringify(arr));
      });
    } catch (e) { console.warn('logs取込失敗', e); }

    // マイテンプレート
    try {
      const tpls = await fetchTemplates();
      const local = tpls.map(t => ({
        id: t.id, icon: t.icon, name: t.name, sub: t.sub,
        ml: t.ml, pct: Number(t.pct), kcal: t.kcal, price: t.price,
      }));
      localStorage.setItem('nomi_custom_drinks', JSON.stringify(local));
    } catch (e) { console.warn('templates取込失敗', e); }
  }

  // ── 以下、app.js の保存時に呼ぶ「片方向ミラー」関数 ──
  // いずれもログイン中のみ動作。失敗してもアプリは止めない（fire-and-forget）

  // プロフィール保存をミラー
  async function mirrorProfile(profile) {
    if (!(await getCurrentUser())) return;
    saveProfileCloud(profile).catch(e => console.warn('profile同期失敗', e));
  }

  // 1杯追加をミラー（drank_on は 'YYYY-MM-DD'）
  async function mirrorAddLog(dateKey, entry) {
    if (!(await getCurrentUser())) return;
    const [y, m, d] = dateKey.split('-');
    const drank_on = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    try {
      await addLogCloud({
        drank_on,
        icon: entry.icon, name: entry.name, detail: entry.detail,
        gram: entry.gram, kcal: entry.kcal, price: entry.price || 0,
      });
    } catch (e) { console.warn('log追加同期失敗', e); }
  }

  // 指定日を一括削除（リセット）をミラー
  async function mirrorResetDay(dateKey) {
    if (!(await getCurrentUser())) return;
    const [y, m, d] = dateKey.split('-');
    const drank_on = `${y}-${String(m).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
    deleteLogsByDate(drank_on).catch(e => console.warn('日付リセット同期失敗', e));
  }

  // テンプレ保存・削除をミラー
  async function mirrorSaveTemplate(tpl) {
    if (!(await getCurrentUser())) return;
    // localStorage の custom_xxx という文字列IDはDB(uuid)に渡せないので除外
    const { id, ...rest } = tpl;
    saveTemplateCloud(rest).catch(e => console.warn('テンプレ同期失敗', e));
  }
  async function mirrorDeleteTemplate(tplId) {
    if (!(await getCurrentUser())) return;
    // uuid 形式のときだけクラウド削除（localStorage専用IDは無視）
    if (/^[0-9a-f]{8}-/.test(tplId)) {
      deleteTemplateCloud(tplId).catch(e => console.warn('テンプレ削除同期失敗', e));
    }
  }

  return {
    isLoggedIn, watchAuth, pullAllFromCloud,
    mirrorProfile, mirrorAddLog, mirrorResetDay,
    mirrorSaveTemplate, mirrorDeleteTemplate,
  };
})();
