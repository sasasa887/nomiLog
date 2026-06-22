'use strict';

const {
  dateToKey,
  keyToDate,
  formatDateJP,
  toLocalDateInput,
  getKeysInRange,
  calcGram,
  calcKcalAlc,
  calcRiskLevel,
} = require('../../lib/calc.js');

// ============================================================
//  dateToKey / keyToDate
// ============================================================
describe('dateToKey', () => {
  test('Date オブジェクトを "YYYY-M-D" 文字列に変換する', () => {
    expect(dateToKey(new Date(2024, 0, 5))).toBe('2024-1-5');
    expect(dateToKey(new Date(2024, 11, 31))).toBe('2024-12-31');
    expect(dateToKey(new Date(2025, 5, 1))).toBe('2025-6-1');
  });

  test('月・日はゼロパディングしない', () => {
    expect(dateToKey(new Date(2024, 0, 1))).toBe('2024-1-1');
  });
});

describe('keyToDate', () => {
  test('"YYYY-M-D" 文字列を Date オブジェクトに変換する', () => {
    const d = keyToDate('2024-6-15');
    expect(d.getFullYear()).toBe(2024);
    expect(d.getMonth()).toBe(5); // 0-indexed
    expect(d.getDate()).toBe(15);
  });

  test('dateToKey との往復変換が一致する', () => {
    const original = new Date(2025, 3, 20);
    const roundTripped = keyToDate(dateToKey(original));
    expect(roundTripped.getFullYear()).toBe(original.getFullYear());
    expect(roundTripped.getMonth()).toBe(original.getMonth());
    expect(roundTripped.getDate()).toBe(original.getDate());
  });
});

// ============================================================
//  formatDateJP
// ============================================================
describe('formatDateJP', () => {
  test('日本語形式 "M月D日(曜)" に変換する', () => {
    // 2024-01-07 は日曜
    expect(formatDateJP('2024-1-7')).toBe('1月7日(日)');
    // 2024-01-08 は月曜
    expect(formatDateJP('2024-1-8')).toBe('1月8日(月)');
    // 2024-12-31 は火曜
    expect(formatDateJP('2024-12-31')).toBe('12月31日(火)');
  });
});

// ============================================================
//  toLocalDateInput
// ============================================================
describe('toLocalDateInput', () => {
  test('input[type=date] 用の "YYYY-MM-DD" を返す', () => {
    expect(toLocalDateInput(new Date(2025, 0, 5))).toBe('2025-01-05');
    expect(toLocalDateInput(new Date(2025, 11, 31))).toBe('2025-12-31');
    expect(toLocalDateInput(new Date(2025, 5, 1))).toBe('2025-06-01');
  });

  test('月・日を 2 桁にゼロパディングする', () => {
    expect(toLocalDateInput(new Date(2025, 0, 1))).toBe('2025-01-01');
  });
});

// ============================================================
//  getKeysInRange
// ============================================================
describe('getKeysInRange', () => {
  test('startDate から endDate までの日付キーを配列で返す', () => {
    const keys = getKeysInRange(new Date(2025, 0, 1), new Date(2025, 0, 3));
    expect(keys).toEqual(['2025-1-1', '2025-1-2', '2025-1-3']);
  });

  test('同じ日を指定した場合は要素数 1', () => {
    const keys = getKeysInRange(new Date(2025, 5, 10), new Date(2025, 5, 10));
    expect(keys).toHaveLength(1);
    expect(keys[0]).toBe('2025-6-10');
  });

  test('月をまたいだ範囲も正しく生成する', () => {
    const keys = getKeysInRange(new Date(2025, 0, 30), new Date(2025, 1, 1));
    expect(keys).toEqual(['2025-1-30', '2025-1-31', '2025-2-1']);
  });
});

// ============================================================
//  calcGram（純アルコール量）
// ============================================================
describe('calcGram', () => {
  test('ビール350ml 5% → 14g', () => {
    expect(calcGram(350, 5)).toBe(14);
  });

  test('日本酒180ml 15% → 21.6g', () => {
    expect(calcGram(180, 15)).toBe(21.6);
  });

  test('ウイスキー30ml 40% → 9.6g', () => {
    expect(calcGram(30, 40)).toBe(9.6);
  });

  test('0ml → 0g', () => {
    expect(calcGram(0, 5)).toBe(0);
  });

  test('0% → 0g', () => {
    expect(calcGram(350, 0)).toBe(0);
  });

  test('小数点第1位で四捨五入される', () => {
    // 100ml × 3% × 0.8 = 2.4g (ぴったり)
    expect(calcGram(100, 3)).toBe(2.4);
  });
});

// ============================================================
//  calcKcalAlc（カロリー）
// ============================================================
describe('calcKcalAlc', () => {
  test('ビール350ml 5% → 約99kcal（アルコール由来カロリーのみ）', () => {
    // 350 * 0.05 * 0.8 * 7.1 = 99.4 → 99
    expect(calcKcalAlc(350, 5)).toBe(99);
  });

  test('日本酒180ml 15% → 約154kcal', () => {
    // 180 * 0.15 * 0.8 * 7.1 = 153.36 → 153
    expect(calcKcalAlc(180, 15)).toBe(153);
  });

  test('ウイスキー30ml 40% → 約68kcal', () => {
    // 30 * 0.4 * 0.8 * 7.1 = 68.16 → 68
    expect(calcKcalAlc(30, 40)).toBe(68);
  });

  test('0ml → 0kcal', () => {
    expect(calcKcalAlc(0, 5)).toBe(0);
  });

  test('0% → 0kcal', () => {
    expect(calcKcalAlc(350, 0)).toBe(0);
  });
});

// ============================================================
//  calcRiskLevel（リスクレベル）
// ============================================================
describe('calcRiskLevel', () => {
  describe('limit=20（男性デフォルト）', () => {
    test('0g → レベル 0（記録なし）', () => {
      expect(calcRiskLevel(0, 20)).toBe(0);
    });
    test('負数 → レベル 0', () => {
      expect(calcRiskLevel(-1, 20)).toBe(0);
    });
    test('1g → レベル 1（〜50%）', () => {
      expect(calcRiskLevel(1, 20)).toBe(1);
    });
    test('10g（50%ぴったり）→ レベル 1', () => {
      expect(calcRiskLevel(10, 20)).toBe(1);
    });
    test('11g（50%超）→ レベル 2', () => {
      expect(calcRiskLevel(11, 20)).toBe(2);
    });
    test('20g（100%ぴったり）→ レベル 2', () => {
      expect(calcRiskLevel(20, 20)).toBe(2);
    });
    test('21g（100%超）→ レベル 3', () => {
      expect(calcRiskLevel(21, 20)).toBe(3);
    });
    test('40g（200%ぴったり）→ レベル 3', () => {
      expect(calcRiskLevel(40, 20)).toBe(3);
    });
    test('41g → レベル 4', () => {
      expect(calcRiskLevel(41, 20)).toBe(4);
    });
    test('60g（300%ぴったり）→ レベル 4', () => {
      expect(calcRiskLevel(60, 20)).toBe(4);
    });
    test('61g → レベル 5（深刻）', () => {
      expect(calcRiskLevel(61, 20)).toBe(5);
    });
  });

  describe('limit=10（女性）', () => {
    test('5g（50%ぴったり）→ レベル 1', () => {
      expect(calcRiskLevel(5, 10)).toBe(1);
    });
    test('10g（100%ぴったり）→ レベル 2', () => {
      expect(calcRiskLevel(10, 10)).toBe(2);
    });
    test('11g → レベル 3', () => {
      expect(calcRiskLevel(11, 10)).toBe(3);
    });
    test('31g → レベル 5', () => {
      expect(calcRiskLevel(31, 10)).toBe(5);
    });
  });
});
