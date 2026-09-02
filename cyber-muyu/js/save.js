/* ============================================================
 * SaveManager · localStorage 存档 + 离线惩罚 + 损坏兜底
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;
  const G = CM.GameState;
  const KEY = 'cyber_muyu_save_v1';

  const S = {};

  S.save = function () {
    G.getData().lastSeen = Date.now();
    try {
      localStorage.setItem(KEY, JSON.stringify(G.getData()));
    } catch (e) { /* 存储失败静默 */ }
    G.clearDirty();
  };

  S.load = function () {
    let raw = null;
    try { raw = localStorage.getItem(KEY); } catch (e) { raw = null; }
    if (!raw) { G.load(null); return { fresh: true, penalty: null }; }

    // 损坏检测：JSON 解析失败或关键字段异常 => 重置但保留图鉴
    try {
      const data = JSON.parse(raw);
      if (!data || typeof data !== 'object' || typeof data.muyuLevel !== 'number') {
        throw new Error('corrupt');
      }
      G.load(data);
    } catch (e) {
      G.resetKeepPokedex();
      return { fresh: true, penalty: null, corrupted: true };
    }
    return { fresh: false, penalty: null };
  };

  // 离线惩罚：每小时扣当前功德 12%、每 3 小时掉 1 级、功德锁死 1 点
  S.applyOfflinePenalty = function () {
    const d = G.getData();
    if (!d.lastSeen) { d.lastSeen = Date.now(); return null; }
    const hours = (Date.now() - d.lastSeen) / 3600000;
    if (hours < 1) { d.lastSeen = Date.now(); return null; }

    const lostMeritAcc = [];
    let lostMerit = 0;
    for (let h = 1; h <= Math.floor(hours); h++) {
      const before = d.merit;
      d.merit = Math.max(0, d.merit - Math.round(d.merit * CM.MERIT.offlinePerHour));
      lostMerit += before - d.merit;
      // 每 3 小时掉 1 级
      if (h % CM.MERIT.offlineLevelEvery === 0 && d.muyuLevel > 1) {
        lostMeritAcc.push(d.muyuLevel);
        d.muyuLevel -= 1;
        if (d.merit > G.meritCap()) d.merit = G.meritCap();
      }
      if (d.merit <= 0) break;
    }
    // 功德锁死下限
    const wasFloor = d.merit < CM.MERIT.floor;
    d.merit = Math.max(CM.MERIT.floor, d.merit);
    d.lastSeen = Date.now();
    G.setDirty();
    S.save();
    return {
      hours: Math.floor(hours),
      lostMerit: Math.round(lostMerit),
      levelLosts: lostMeritAcc,
      floorLocked: wasFloor || d.merit === CM.MERIT.floor
    };
  };

  CM.SaveManager = S;
})(typeof window !== 'undefined' ? window : this);