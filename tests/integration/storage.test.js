'use strict';

/**
 * 結合テスト — localStorage ストレージ層
 * jsdom 環境で localStorage が利用可能。
 * app.js の getLogForKey / saveLogForKey / getDayTotal 等を再現してテスト。
 */

// ── テスト対象の関数（app.js と同じロジック） ──────────────────────────────
const { calcGram, calcKcalAlc } = require('../../lib/calc.js');

const BUILT_IN_DRINKS = [
  { id: 'beer350', icon: '🍺', name: 'ビール',    sub: '350ml · 5%',  ml: 350, pct: 5,  kcal: 140, price: 230 },
  { id: 'sake',    icon: '🍶', name: '日本酒',     sub: '1合 180ml · 15%', ml: 180, pct: 15, kcal: 185, price: 300 },
  { id: 'wine',    icon: '🍷', name: 'ワイン',     sub: 'グラス 120ml · 12%', ml: 120, pct: 12, kcal: 88,  price: 400 },
  { id: 'highball',icon: '🥃', name: 'ハイボール', sub: '350ml · 7%',  ml: 350, pct: 7,  kcal: 175, price: 190 },
];

function getLogForKey(key) {
  try {
    const d = localStorage.getItem('nomi_log_' + key);
    return d ? JSON.parse(d) : [];
  } catch (e) { return []; }
}

function saveLogForKey(key, log) {
  localStorage.setItem('nomi_log_' + key, JSON.stringify(log));
}

function resolveItemPrice(item, customDrinks = []) {
  if (typeof item.price === 'number' && item.price > 0) return item.price;
  const builtin = BUILT_IN_DRINKS.find(d => d.name === item.name);
  if (builtin && builtin.price) return builtin.price;
  const custom = customDrinks.find(d => d.name === item.name);
  if (custom && custom.price) return custom.price;
  const byDetail = BUILT_IN_DRINKS.find(d => d.sub === item.detail);
  if (byDetail && byDetail.price) return byDetail.price;
  return 0;
}

function getDayTotal(key) {
  return getLogForKey(key).reduce((s, i) => s + i.gram, 0);
}

function getDayKcal(key) {
  return getLogForKey(key).reduce((s, i) => s + i.kcal, 0);
}

function getDayPrice(key, customDrinks = []) {
  return getLogForKey(key).reduce((s, i) => s + resolveItemPrice(i, customDrinks), 0);
}

// ── helper ──────────────────────────────────────────────────────────────────
function makeEntry(name, ml, pct, price = null) {
  return {
    icon: '🍺',
    name,
    detail: `${ml}ml · ${pct}%`,
    gram: calcGram(ml, pct),
    kcal: calcKcalAlc(ml, pct),
    ...(price !== null ? { price } : {}),
    time: '20:00',
  };
}

// ── テスト ───────────────────────────────────────────────────────────────────
beforeEach(() => {
  localStorage.clear();
});

// ============================================================
//  getLogForKey / saveLogForKey
// ============================================================
describe('getLogForKey', () => {
  test('データなし → 空配列を返す', () => {
    expect(getLogForKey('2025-1-1')).toEqual([]);
  });

  test('保存したデータをそのまま取得できる', () => {
    const log = [makeEntry('ビール', 350, 5, 230)];
    saveLogForKey('2025-1-1', log);
    expect(getLogForKey('2025-1-1')).toEqual(log);
  });

  test('不正な JSON が保存されていた場合は空配列を返す', () => {
    localStorage.setItem('nomi_log_2025-1-1', '{broken json');
    expect(getLogForKey('2025-1-1')).toEqual([]);
  });
});

describe('saveLogForKey', () => {
  test('複数の記録を保存・取得できる', () => {
    const log = [
      makeEntry('ビール',   350, 5,  230),
      makeEntry('日本酒', 180, 15, 300),
    ];
    saveLogForKey('2025-6-10', log);
    const retrieved = getLogForKey('2025-6-10');
    expect(retrieved).toHaveLength(2);
    expect(retrieved[0].name).toBe('ビール');
    expect(retrieved[1].name).toBe('日本酒');
  });

  test('上書きしたデータが反映される', () => {
    saveLogForKey('2025-6-10', [makeEntry('ビール', 350, 5, 230)]);
    saveLogForKey('2025-6-10', [makeEntry('ワイン', 120, 12, 400)]);
    expect(getLogForKey('2025-6-10')[0].name).toBe('ワイン');
  });
});

// ============================================================
//  getDayTotal
// ============================================================
describe('getDayTotal', () => {
  test('データなし → 0', () => {
    expect(getDayTotal('2025-1-1')).toBe(0);
  });

  test('ビール350ml 5% の gram が正しく集計される', () => {
    saveLogForKey('2025-1-1', [makeEntry('ビール', 350, 5)]);
    expect(getDayTotal('2025-1-1')).toBeCloseTo(14, 1);
  });

  test('複数エントリーの合計が正しい', () => {
    saveLogForKey('2025-1-1', [
      makeEntry('ビール',   350, 5),   // 14g
      makeEntry('ワイン',   120, 12),  // 11.5g
    ]);
    expect(getDayTotal('2025-1-1')).toBeCloseTo(25.5, 1);
  });
});

// ============================================================
//  getDayKcal
// ============================================================
describe('getDayKcal', () => {
  test('データなし → 0', () => {
    expect(getDayKcal('2025-1-1')).toBe(0);
  });

  test('ビール350ml 5% のカロリーが集計される', () => {
    saveLogForKey('2025-1-1', [makeEntry('ビール', 350, 5)]);
    expect(getDayKcal('2025-1-1')).toBe(calcKcalAlc(350, 5));
  });
});

// ============================================================
//  resolveItemPrice
// ============================================================
describe('resolveItemPrice', () => {
  test('item.price が設定済みならそれを返す', () => {
    expect(resolveItemPrice({ price: 500, name: 'ビール', detail: '350ml · 5%' })).toBe(500);
  });

  test('item.price が 0 なら定番テンプレートから名前で引く', () => {
    expect(resolveItemPrice({ price: 0, name: 'ビール', detail: '' })).toBe(230);
  });

  test('item.price がない場合も定番テンプレートから名前で引く', () => {
    expect(resolveItemPrice({ name: '日本酒', detail: '' })).toBe(300);
  });

  test('名前が一致しなくても detail が一致すれば引く', () => {
    // "350ml · 5%" は BUILT_IN_DRINKS のビールと一致
    expect(resolveItemPrice({ name: '謎のビール', detail: '350ml · 5%' })).toBe(230);
  });

  test('マイテンプレートから引く', () => {
    const customDrinks = [{ id: 'c1', name: '手作り梅酒', price: 150 }];
    expect(resolveItemPrice({ name: '手作り梅酒', detail: '' }, customDrinks)).toBe(150);
  });

  test('どこにも一致しない → 0 を返す', () => {
    expect(resolveItemPrice({ name: '謎のお酒', detail: '99ml · 99%' })).toBe(0);
  });
});

// ============================================================
//  getDayPrice
// ============================================================
describe('getDayPrice', () => {
  test('データなし → 0', () => {
    expect(getDayPrice('2025-1-1')).toBe(0);
  });

  test('price 付きエントリーの合計が正しい', () => {
    saveLogForKey('2025-1-1', [
      makeEntry('ビール', 350, 5, 230),
      makeEntry('ワイン', 120, 12, 400),
    ]);
    expect(getDayPrice('2025-1-1')).toBe(630);
  });

  test('price なしのエントリーは定番テンプレートから補完される', () => {
    saveLogForKey('2025-1-1', [makeEntry('ハイボール', 350, 7)]);
    expect(getDayPrice('2025-1-1')).toBe(190);
  });
});

// ============================================================
//  状態管理: プロフィールと customDrinks の localStorage 保存
// ============================================================
describe('profile localStorage', () => {
  test('プロフィールを保存・取得できる', () => {
    const profile = { name: 'テスト太郎', gender: 'male', age: 30, height: 175, weight: 70 };
    localStorage.setItem('nomi_profile', JSON.stringify(profile));
    const retrieved = JSON.parse(localStorage.getItem('nomi_profile'));
    expect(retrieved.name).toBe('テスト太郎');
    expect(retrieved.gender).toBe('male');
  });

  test('プロフィール削除で null になる', () => {
    localStorage.setItem('nomi_profile', JSON.stringify({ name: 'テスト' }));
    localStorage.removeItem('nomi_profile');
    expect(localStorage.getItem('nomi_profile')).toBeNull();
  });
});

describe('customDrinks localStorage', () => {
  test('マイテンプレートを保存・取得できる', () => {
    const drinks = [
      { id: 'custom_1', icon: '🥂', name: '手作り梅酒', sub: '150ml · 10%', ml: 150, pct: 10, kcal: 96, price: 200 },
    ];
    localStorage.setItem('nomi_custom_drinks', JSON.stringify(drinks));
    const retrieved = JSON.parse(localStorage.getItem('nomi_custom_drinks'));
    expect(retrieved).toHaveLength(1);
    expect(retrieved[0].name).toBe('手作り梅酒');
  });
});
