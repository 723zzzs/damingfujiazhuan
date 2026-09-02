/* ============================================================
 * GameState · 全局单一数据源
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;

  const defaultState = function () {
    return {
      v: 1,                            // 存档版本
      gender: null,                    // 'm' | 'f'（开局选择）
      muyuLevel: 1,
      merit: 0,                        // 功德（也是金光罩强度）
      petAlive: { cat1: true, cat2: true, p1: true, p2: true, p3: true, p4: true },
      petGhostUnlocked: false,         // 是否解锁猫鬼/鹦鹉鬼
      ghosts: {},                      // 图鉴点亮集合 {key:1}
      petDeaths: { cat: 0, parrot: 0 },// 宠物牺牲统计
      ghostSkin: {},                   // 鬼物皮 {tier:{trialUntil,permanent}}
      // 签到：
      //   checkinDays: 0     累计签到天数（决定木鱼皮排期）
      //   checkinStreak: 0   连续签到天数（决定鬼物皮永久条件）
      //   lastCheckin: ts    上次签到时刻（判连续）
      //   adWatchCount: 0    累计观看广告次数（决定鬼皮 1 天试用与永久）
      // 周目：
      //   cycle: 1           通关后 +1（赛博鬼佛阶段）
      // 离线：
      //   lastSeen: ts
      woodUnlocked: [],
      woodActive: null,
      checkinDays: 0,
      checkinStreak: 0,
      lastCheckin: 0,
      adWatchCount: 0,
      cycle: 1,
      lastSeen: Date.now()
    };
  };

  const G = {};

  // ---- 图鉴 ----
  function ghostKey(tier, cyber, petKey) {
    if (petKey != null) return 'pet:' + petKey;
    return tier + (cyber ? 'c' : '');
  }

  G.isCollected = function (tier, cyber, petKey) {
    return !!G._g.ghosts[ghostKey(tier, cyber, petKey)];
  };
  G.collect = function (tier, cyber, petKey) {
    const k = ghostKey(tier, cyber, petKey);
    if (!G._g.ghosts[k]) { G._g.ghosts[k] = 1; G.setDirty(); }
  };
  // 宠物牺牲统计（猫/鹦鹉被鬼物"杀死"的次数）
  G.petDeath = function (isCat) {
    const key = isCat ? 'cat' : 'parrot';
    G._g.petDeaths[key] = (G._g.petDeaths[key] || 0) + 1;
    G.setDirty();
  };

  // ---- 皮肤 ----
  G.woodUnlocked = function (id) { return G._g.woodUnlocked.indexOf(id) >= 0; };
  G.unlockWood = function (id) {
    if (!G.woodUnlocked(id)) { G._g.woodUnlocked.push(id); G.setDirty(); }
  };
  G.setWoodActive = function (id) { G._g.woodActive = id; G.setDirty(); };
  G.woodStyle = function () {
    const id = G._g.woodActive;
    if (id != null && CM.SKIN.woodPool[id]) return CM.SKIN.woodPool[id];
    return CM.SKIN.woodPool[0];
  };
  // 鬼物皮：tier 1..9
  G.ghostSkin = function (tier) {
    return G._g.ghostSkin[tier] || { trialUntil: 0, permanent: false };
  };
  G.grantGhostSkinTrial = function (tier) {
    const s = G.ghostSkin(tier);
    s.trialUntil = Date.now() + CM.SKIN.ghostTrialDays * 86400000;
    G._g.ghostSkin[tier] = s;
    G.setDirty();
  };
  G.grantGhostSkinPerm = function (tier) {
    const s = G.ghostSkin(tier);
    s.permanent = true;
    G._g.ghostSkin[tier] = s;
    G.setDirty();
  };
  G.ghostSkinOwned = function (tier) {
    const s = G.ghostSkin(tier);
    return s.permanent || (s.trialUntil && s.trialUntil > Date.now());
  };

  // ---- 签到 ----
  G.canCheckin = function () { return !G._g.lastCheckin || Date.now() - G._g.lastCheckin > 86400000; };
  G.doCheckin = function () {
    // 连续签到判定：距上次签到 24~48h 内算连续，否则断签
    const now = Date.now();
    if (G._g.lastCheckin && (now - G._g.lastCheckin) < 48 * 3600000) {
      // 上次签到还在 24h 内外则 streak 需要看是否超 24h
      if ((now - G._g.lastCheckin) >= 24 * 3600000) {
        G._g.checkinStreak += 1;
      } else {
        G._g.checkinStreak = Math.max(1, G._g.checkinStreak);
      }
    } else {
      G._g.checkinStreak = 1;
    }
    G._g.checkinDays += 1;
    G._g.lastCheckin = now;
    // 木鱼皮排期：第 1 天领 1 个，之后每 3 天一个
    const idx = Math.floor((G._g.checkinDays - CM.SKIN.checkinFirstDay) / CM.SKIN.checkinStep);
    const newSkinId = idx >= 0 ? Math.min(idx, CM.SKIN.woodPool.length - 1) : -1;
    G.setDirty();
    if (newSkinId >= 0) G.unlockWood(newSkinId);
    return newSkinId >= 0 ? newSkinId : null;
  };

  // ---- 广告 ----
  G.onAdWatched = function () {
    G._g.adWatchCount += 1;
    const n = G._g.adWatchCount;
    // 第 N 次：第 ((N-1)%9)+1 级鬼物皮 1 天试用
    const tier = ((n - 1) % 9) + 1;
    G.grantGhostSkinTrial(tier);
    // 累计 3N 次 + 连签 N 天 => 永久
    for (let t = 1; t <= 9; t++) {
      if (n >= CM.SKIN.ghostPermanentAds * t &&
          G._g.checkinStreak >= CM.SKIN.ghostPermanentStreak * t) {
        G.grantGhostSkinPerm(t);
      }
    }
    return tier;
  };

  // ---- 数值派生 ----
  G.meritCap = function () {
    return Math.round(CM.MERIT.capBase * Math.pow(CM.MERIT.capGrowth, G._g.muyuLevel - 1));
  };
  G.tapGain = function () {
    return CM.MERIT.tapBase + (G._g.muyuLevel - 1) * CM.MERIT.tapPerLevel;
  };
  G.existingPets = function () {
    const a = G._g.petAlive;
    return (a.cat1 ? 1 : 0) + (a.cat2 ? 1 : 0) + (a.p1 ? 1 : 0) + (a.p2 ? 1 : 0) + (a.p3 ? 1 : 0) + (a.p4 ? 1 : 0);
  };
  G.petAlive = function (id) { return !!G._g.petAlive[id]; };
  G.killPet = function (id) {
    G._g.petAlive[id] = false;
    G.petDeath(id.indexOf('cat') === 0);
    G.setDirty();
  };
  G.revivePets = function () {
    G._g.petAlive = { cat1: true, cat2: true, p1: true, p2: true, p3: true, p4: true };
    G._g.muyuLevel = 1;      // 重开木鱼回 1 级
    G._g.merit = 0;
    G.setDirty();
  };

  // ---- 通用存档接口（由 SaveManager 使用）----
  G.getData = function () { return G._g; };
  G.load = function (data) {
    const d = Object.assign(defaultState(), data);
    // 字段兜底
    d.ghosts = d.ghosts || {};
    d.petDeaths = d.petDeaths || { cat: 0, parrot: 0 };
    d.woodUnlocked = d.woodUnlocked || [];
    d.ghostSkin = d.ghostSkin || {};
    if (d.muyuLevel < 1) d.muyuLevel = 1;
    if (typeof d.merit !== 'number' || isNaN(d.merit)) d.merit = 0;
    G._g = d;
  };
  G.resetKeepPokedex = function () {
    const keep = { ghosts: G._g.ghosts, petDeaths: G._g.petDeaths, petGhostUnlocked: G._g.petGhostUnlocked };
    G._g = Object.assign(defaultState(), keep);
    G.setDirty();
  };
  G.setDirty = function () { G._dirty = true; };
  G.isDirty = function () { return !!G._dirty; };
  G.clearDirty = function () { G._dirty = false; };

  G._g = defaultState();
  CM.GameState = G;
})(typeof window !== 'undefined' ? window : this);