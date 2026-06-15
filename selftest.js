// ============================================================
//  のみログ ── セルフテスト (selftest.js)
//  使い方：アプリを開いてブラウザのConsoleで  nomiTest()  と入力
//  接続・認証・CRUD・同期を順番に自動チェックします。
//  ※ テスト専用。本番運用では読み込まなくてOK（読み込んでも無害）
// ============================================================

window.nomiTest = async function () {
  const results = [];
  const ok   = (n) => { results.push(['✅', n]); console.log('✅ ' + n); };
  const ng   = (n, e) => { results.push(['❌', n + ' → ' + (e?.message || e)]); console.error('❌ ' + n, e); };
  const info = (n) => console.log('ℹ️ ' + n);

  console.log('%c=== のみログ セルフテスト開始 ===', 'font-weight:bold;font-size:14px');

  // ── 1. ライブラリ読み込み ──
  try {
    if (window.sbClient) ok('Supabaseクライアント生成OK');
    else throw new Error('sbClient が無い（URL/キー未設定の可能性）');
  } catch (e) { ng('Supabaseクライアント', e); return finish(); }

  if (window.Sync) ok('同期レイヤー(Sync)読み込みOK');
  else ng('同期レイヤー(Sync)', '未読み込み');

  // ── 2. 接続テスト（公開エンドポイントに到達するか）──
  try {
    const u = await getCurrentUser();
    if (u) ok('ログイン中：' + u.email);
    else info('未ログイン状態（ログインしてから再テストすると同期も検証します）');
  } catch (e) { ng('セッション取得', e); }

  // ── 3. ログイン中のみ：CRUD と同期を検証 ──
  const user = await getCurrentUser();
  if (user) {
    const testDate = '2099-12-31'; // テスト専用の未来日（実データと混ざらない）
    let createdId = null;

    // 3-1. INSERT
    try {
      const row = await addLogCloud({
        drank_on: testDate, icon: '🧪', name: 'テスト酒',
        detail: 'selftest', gram: 1, kcal: 1, price: 1,
      });
      createdId = row.id;
      ok('drink_logs へのINSERT成功（id=' + row.id.slice(0,8) + '…）');
    } catch (e) { ng('INSERT', e); }

    // 3-2. SELECT（今入れた行が読めるか＝RLSが正しいか）
    try {
      const rows = await fetchLogsByDate(testDate);
      const found = rows.find(r => r.id === createdId);
      if (found) ok('SELECT成功：自分の行が読める（RLS OK）');
      else ng('SELECT', '入れた行が読めない');
    } catch (e) { ng('SELECT', e); }

    // 3-3. プロフィール取得
    try {
      const p = await fetchProfile();
      if (p) ok('profiles 取得OK（name=' + (p.name||'(空)') + '）');
      else info('profilesに行がまだ無い（プロフィール未設定）');
    } catch (e) { ng('profiles取得', e); }

    // 3-4. DELETE（後始末：テスト行を消す）
    try {
      if (createdId) {
        await deleteLogCloud(createdId);
        ok('DELETE成功（テスト行を削除して後始末）');
      }
    } catch (e) { ng('DELETE', e); }

    // 3-5. 移行フラグの状態
    const migrated = localStorage.getItem('nomi_migrated');
    info('移行フラグ: ' + (migrated ? '済み(' + migrated.slice(0,10) + ')' : '未'));

  } else {
    info('※ ログインするとCRUD・同期テストも実行されます');
  }

  return finish();

  function finish() {
    const pass = results.filter(r => r[0] === '✅').length;
    const fail = results.filter(r => r[0] === '❌').length;
    console.log('%c=== 結果: ' + pass + ' 成功 / ' + fail + ' 失敗 ===',
      'font-weight:bold;font-size:14px;color:' + (fail ? '#e05252' : '#4eca8b'));
    if (fail === 0) {
      console.log('%c🎉 すべて正常です！', 'font-size:13px;color:#4eca8b');
    } else {
      console.log('%c⚠️ 失敗した項目のエラーを確認してください', 'font-size:13px;color:#e05252');
    }
    return { pass, fail, results };
  }
};

console.log('💡 セルフテスト準備完了：Consoleで nomiTest() を実行してください');
