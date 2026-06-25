'use strict';

const { test, expect } = require('@playwright/test');

// ============================================================
//  外部リソースモック（テスト環境ではタイムアウトするため）
// ============================================================
// Supabase CDN と Google Fonts をインターセプトして即返却。
// page.reload() が外部リソース待ちでタイムアウトするのを防ぐ。
// app.js は window.sbClient が未定義の場合はローカルのみモードで動作する。
test.beforeEach(async ({ page }) => {
  // Google Fonts を空レスポンスで返す
  await page.route('https://fonts.googleapis.com/**', route =>
    route.fulfill({ status: 200, contentType: 'text/css', body: '' })
  );
  await page.route('https://fonts.gstatic.com/**', route =>
    route.fulfill({ status: 200, contentType: 'font/woff2', body: '' })
  );

  // Supabase CDN を最小スタブで返す
  await page.route('https://cdn.jsdelivr.net/**', route => {
    route.fulfill({
      status: 200,
      contentType: 'application/javascript',
      body: [
        '(function(){',
        '  const noop = async () => ({ data: null, error: null });',
        '  const chain = () => ({',
        '    select: chain, eq: chain, gte: chain, lte: chain,',
        '    order: noop, single: noop,',
        '    insert: () => ({ select: () => ({ single: noop }) }),',
        '    upsert: () => ({ select: () => ({ single: noop }) }),',
        '    delete: () => ({ eq: () => noop() }),',
        '  });',
        '  window.supabase = {',
        '    createClient: () => ({',
        '      auth: {',
        '        getUser: async () => ({ data: { user: null } }),',
        '        signUp: noop,',
        '        signInWithPassword: noop,',
        '        signInWithOAuth: noop,',
        '        signOut: noop,',
        '        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),',
        '      },',
        '      from: () => chain(),',
        '      functions: { invoke: async () => ({ data: null, error: new Error("CDN stub") }) },',
        '    }),',
        '  };',
        '})();',
      ].join('\n'),
    });
  });
});

// ============================================================
//  ヘルパー
// ============================================================
async function clearAppStorage(page) {
  await page.evaluate(() => {
    Object.keys(localStorage)
      .filter(k => k.startsWith('nomi_'))
      .forEach(k => localStorage.removeItem(k));
  });
}

async function setProfile(page, opts = {}) {
  const p = { name: 'テスト太郎', gender: 'male', age: 30, height: 175, weight: 70, ...opts };
  await page.evaluate((profile) => {
    localStorage.setItem('nomi_profile', JSON.stringify(profile));
  }, p);
}

// ============================================================
//  基本レンダリング
// ============================================================
test.describe('ページ読み込み', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await page.reload();
  });

  test('タイトルが "のみログ" である', async ({ page }) => {
    await expect(page).toHaveTitle(/のみログ/);
  });

  test('ボトムナビが 4 タブ表示される', async ({ page }) => {
    const tabs = page.locator('.tab-btn');
    await expect(tabs).toHaveCount(4);
  });

  test('プロフィール未設定時に入力フォームが表示される', async ({ page }) => {
    await page.locator('#tab-profile').click();
    await expect(page.locator('#profile-edit-section')).toBeVisible();
  });
});

// ============================================================
//  タブナビゲーション
// ============================================================
test.describe('タブナビゲーション', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await page.reload();
  });

  test('追加タブに切り替えると飲み物グリッドが表示される', async ({ page }) => {
    await page.locator('#tab-add').click();
    await expect(page.locator('#drinks-grid')).toBeVisible();
  });

  test('履歴タブに切り替えるとカレンダーが表示される', async ({ page }) => {
    await page.locator('#tab-history').click();
    await expect(page.locator('#cal-grid')).toBeVisible();
  });

  test('プロフィールタブに切り替えるとプロフィールセクションが表示される', async ({ page }) => {
    await page.locator('#tab-profile').click();
    await expect(page.locator('#page-profile')).toBeVisible();
  });
});

// ============================================================
//  飲み物追加フロー
// ============================================================
test.describe('飲み物追加', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await setProfile(page);
    await page.reload();
    await page.locator('#tab-add').click();
  });

  test('ビールボタンをクリックするとログに追加されホームに戻る', async ({ page }) => {
    const beerBtn = page.locator('.drink-btn').filter({ hasText: 'ビール' }).first();
    await beerBtn.click();

    // ホームタブに自動遷移する
    await expect(page.locator('#page-home')).toHaveClass(/active/);
    // ログリストに記録が表示される
    await expect(page.locator('#log-list .log-item')).toHaveCount(1);
  });

  test('ゲージが 0 より大きくなる', async ({ page }) => {
    const beerBtn = page.locator('.drink-btn').filter({ hasText: 'ビール' }).first();
    await beerBtn.click();
    const gauge = page.locator('#gauge-fill');
    const width = await gauge.evaluate(el => parseFloat(el.style.width));
    expect(width).toBeGreaterThan(0);
  });

  test('同じ飲み物を 2 回追加するとログが 2 件になる', async ({ page }) => {
    const beerBtn = page.locator('.drink-btn').filter({ hasText: 'ビール' }).first();
    await beerBtn.click();
    await page.locator('#tab-add').click();
    await beerBtn.click();
    await expect(page.locator('#log-list .log-item')).toHaveCount(2);
  });
});

// ============================================================
//  マイテンプレート CRUD
// ============================================================
test.describe('マイテンプレート', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await page.reload();
    await page.locator('#tab-add').click();
    await page.locator('.btn-add-template').click();
  });

  test('テンプレートフォームが表示される', async ({ page }) => {
    await expect(page.locator('#template-form')).toBeVisible();
  });

  test('必須項目を入力して保存するとグリッドに追加される', async ({ page }) => {
    await page.locator('#tpl-name').fill('梅酒');
    await page.locator('#tpl-icon').fill('🍹');
    await page.locator('#tpl-ml').fill('150');
    await page.locator('#tpl-pct').fill('8');
    await page.locator('#tpl-kcal').fill('120');
    await page.getByRole('button', { name: '保存' }).click();

    await expect(page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: '梅酒' })).toBeVisible();
  });

  test('必須項目が空のまま保存するとトーストエラーが出る', async ({ page }) => {
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('#toast')).toHaveClass(/show/);
  });

  test('テンプレートをクリックするとホームに遷移して記録に追加される', async ({ page }) => {
    await page.locator('#tpl-name').fill('梅酒');
    await page.locator('#tpl-icon').fill('🍹');
    await page.locator('#tpl-ml').fill('150');
    await page.locator('#tpl-pct').fill('8');
    await page.locator('#tpl-kcal').fill('120');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: '梅酒' })).toBeVisible();

    await page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: '梅酒' }).click();

    await expect(page.locator('#page-home')).toHaveClass(/active/);
    await expect(page.locator('#log-list .log-item')).toHaveCount(1);
  });

  test('✏️ 編集ボタンをクリックすると既存データがフォームに読み込まれる', async ({ page }) => {
    await page.locator('#tpl-name').fill('梅酒');
    await page.locator('#tpl-icon').fill('🍹');
    await page.locator('#tpl-ml').fill('150');
    await page.locator('#tpl-pct').fill('8');
    await page.locator('#tpl-kcal').fill('120');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: '梅酒' })).toBeVisible();

    await page.locator('#my-drinks-grid .btn-edit-tpl').click();

    await expect(page.locator('#template-form')).toBeVisible();
    await expect(page.locator('#tpl-name')).toHaveValue('梅酒');
    await expect(page.locator('#tpl-ml')).toHaveValue('150');
    await expect(page.locator('#tpl-pct')).toHaveValue('8');
  });

  test('🗑 削除ボタンをクリックすると確認モーダルが開く', async ({ page }) => {
    await page.locator('#tpl-name').fill('梅酒');
    await page.locator('#tpl-icon').fill('🍹');
    await page.locator('#tpl-ml').fill('150');
    await page.locator('#tpl-pct').fill('8');
    await page.locator('#tpl-kcal').fill('120');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: '梅酒' })).toBeVisible();

    await page.locator('#my-drinks-grid .btn-del-tpl').click();

    await expect(page.locator('#confirm-modal')).toBeVisible();
    await expect(page.locator('#confirm-target')).toContainText('梅酒');
  });

  test('削除確認で「削除する」をクリックするとグリッドから消える', async ({ page }) => {
    await page.locator('#tpl-name').fill('梅酒');
    await page.locator('#tpl-icon').fill('🍹');
    await page.locator('#tpl-ml').fill('150');
    await page.locator('#tpl-pct').fill('8');
    await page.locator('#tpl-kcal').fill('120');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: '梅酒' })).toBeVisible();

    await page.locator('#my-drinks-grid .btn-del-tpl').click();
    await page.locator('#confirm-modal .confirm-btn-delete').click();

    await expect(page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: '梅酒' })).toHaveCount(0);
  });

  test('×2,3 ボタンで数量モーダルが開き ×2 を選ぶと 2件記録される', async ({ page }) => {
    await page.locator('#tpl-name').fill('梅酒');
    await page.locator('#tpl-icon').fill('🍹');
    await page.locator('#tpl-ml').fill('150');
    await page.locator('#tpl-pct').fill('8');
    await page.locator('#tpl-kcal').fill('120');
    await page.getByRole('button', { name: '保存' }).click();
    await expect(page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: '梅酒' })).toBeVisible();

    await page.locator('#my-drinks-grid .btn-qty-tpl').click();
    await expect(page.locator('#qty-modal')).toBeVisible();

    await page.locator('.qty-num-btn').filter({ hasText: '×2' }).click();

    await expect(page.locator('#page-home')).toHaveClass(/active/);
    await expect(page.locator('#log-list .log-item')).toHaveCount(2);
  });
});

// ============================================================
//  プロフィール設定フロー
// ============================================================
test.describe('プロフィール設定', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await page.reload();
    await page.locator('#tab-profile').click();
  });

  test('プロフィールを入力して確定するとプロフィールビューに切り替わる', async ({ page }) => {
    await page.locator('#p-name').fill('テスト次郎');
    await page.locator('#p-age').fill('25');
    await page.locator('#p-height').fill('170');
    await page.locator('#p-weight').fill('65');
    await page.locator('#btn-save-profile').click();

    await expect(page.locator('#profile-view-section')).toBeVisible();
    await expect(page.locator('#pv-name')).toHaveText('テスト次郎');
  });

  test('プロフィール保存後に編集ボタンで編集モードに戻れる', async ({ page }) => {
    await setProfile(page);
    await page.reload();
    await page.locator('#tab-profile').click();
    await page.getByRole('button', { name: '✏️ 編集する' }).click();
    await expect(page.locator('#profile-edit-section')).toBeVisible();
  });
});

// ============================================================
//  Googleログインボタン（準備中）
// ============================================================
test.describe('Googleログインボタン', () => {
  test('Googleログインボタンが「準備中」で disabled になっている', async ({ page }) => {
    await page.goto('/');
    await page.locator('#tab-profile').click();
    const googleBtn = page.locator('.btn-google');
    await expect(googleBtn).toBeVisible();
    await expect(googleBtn).toBeDisabled();
    await expect(googleBtn).toContainText('準備中');
  });
});

// ============================================================
//  AI クイック追加
// ============================================================
test.describe('AIクイック追加', () => {
  const MOCK_SAKE = { icon: '🍶', ml: 180, pct: 15, kcal: 153, price: 300 };

  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await clearAppStorage(page);
    await page.reload();
    // ページロード後に sbClient.functions.invoke をモック
    await page.evaluate((mockData) => {
      if (!window.sbClient) window.sbClient = {};
      if (!window.sbClient.functions) window.sbClient.functions = {};
      window.sbClient.functions.invoke = async (name) => {
        if (name === 'sake-lookup') return { data: mockData, error: null };
        return { data: null, error: new Error('unexpected function: ' + name) };
      };
    }, MOCK_SAKE);
    await page.locator('#tab-add').click();
  });

  test('クイック追加カードが表示される', async ({ page }) => {
    await expect(page.locator('.ai-quick-add-card')).toBeVisible();
    await expect(page.locator('#quick-add-name')).toBeVisible();
    await expect(page.locator('#btn-quick-add')).toBeVisible();
  });

  test('名前を入力してAIで追加するとグリッドに追加される', async ({ page }) => {
    await page.locator('#quick-add-name').fill('テスト日本酒');
    await page.locator('#btn-quick-add').click();

    await expect(
      page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: 'テスト日本酒' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('追加後に名前欄がクリアされる', async ({ page }) => {
    await page.locator('#quick-add-name').fill('テスト日本酒');
    await page.locator('#btn-quick-add').click();

    await expect(
      page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: 'テスト日本酒' })
    ).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#quick-add-name')).toHaveValue('');
  });

  test('Enter キーでも追加できる', async ({ page }) => {
    await page.locator('#quick-add-name').fill('テスト梅酒');
    await page.locator('#quick-add-name').press('Enter');

    await expect(
      page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: 'テスト梅酒' })
    ).toBeVisible({ timeout: 10000 });
  });

  test('名前が空のまま追加するとトーストが出る', async ({ page }) => {
    await page.locator('#btn-quick-add').click();
    await expect(page.locator('#toast')).toHaveClass(/show/);
  });

  test('追加したテンプレートをクリックすると記録に追加される', async ({ page }) => {
    await setProfile(page);
    await page.reload();
    await page.evaluate((mockData) => {
      if (!window.sbClient) window.sbClient = {};
      if (!window.sbClient.functions) window.sbClient.functions = {};
      window.sbClient.functions.invoke = async (name) => {
        if (name === 'sake-lookup') return { data: mockData, error: null };
        return { data: null, error: new Error('unexpected function: ' + name) };
      };
    }, MOCK_SAKE);
    await page.locator('#tab-add').click();

    await page.locator('#quick-add-name').fill('テスト日本酒');
    await page.locator('#btn-quick-add').click();

    const btn = page.locator('#my-drinks-grid .my-drink-btn').filter({ hasText: 'テスト日本酒' });
    await expect(btn).toBeVisible({ timeout: 10000 });
    await btn.click();

    await expect(page.locator('#page-home')).toHaveClass(/active/);
    await expect(page.locator('#log-list .log-item')).toHaveCount(1);
  });
});
