/* のみログ — 純粋計算関数 (ブラウザ・Node.js 両対応 UMD) */
(function (root, factory) {
  'use strict';
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = factory();
  } else {
    var exp = factory();
    Object.keys(exp).forEach(function (k) { root[k] = exp[k]; });
    root.NomiCalc = exp;
  }
}(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  'use strict';

  var DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

  function dateToKey(d) {
    return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate();
  }

  function keyToDate(k) {
    var parts = k.split('-').map(Number);
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }

  function formatDateJP(key) {
    var d = keyToDate(key);
    return (d.getMonth() + 1) + '月' + d.getDate() + '日(' + DAY_NAMES[d.getDay()] + ')';
  }

  function toLocalDateInput(d) {
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    return y + '-' + m + '-' + day;
  }

  function getKeysInRange(startDate, endDate) {
    var keys = [];
    var cur = new Date(startDate);
    while (cur <= endDate) {
      keys.push(dateToKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
    return keys;
  }

  var calcGram = function (ml, pct) {
    return Math.round(ml * (pct / 100) * 0.8 * 10) / 10;
  };

  var calcKcalAlc = function (ml, pct) {
    return Math.round(ml * (pct / 100) * 0.8 * 7.1);
  };

  /* getRiskLevel の純粋版 — limit を引数で受け取る */
  function calcRiskLevel(gram, limit) {
    if (gram <= 0) return 0;
    if (gram <= limit * 0.5) return 1;
    if (gram <= limit) return 2;
    if (gram <= limit * 2) return 3;
    if (gram <= limit * 3) return 4;
    return 5;
  }

  return {
    DAY_NAMES: DAY_NAMES,
    dateToKey: dateToKey,
    keyToDate: keyToDate,
    formatDateJP: formatDateJP,
    toLocalDateInput: toLocalDateInput,
    getKeysInRange: getKeysInRange,
    calcGram: calcGram,
    calcKcalAlc: calcKcalAlc,
    calcRiskLevel: calcRiskLevel,
  };
}));
