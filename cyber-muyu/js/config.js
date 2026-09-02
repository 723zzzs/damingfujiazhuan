/* ============================================================
 * 赛博木鱼 · 数值配置表（所有可调参数集中于此，便于后续移植 Cocos）
 * ============================================================ */
(function (global) {
  'use strict';

  const CM = global.CM = global.CM || {};

  // --- 视口（基准逻辑分辨率，竖屏 9:16）---
  CM.VIEW = { W: 432, H: 768 };

  // --- 赛博色板 ---
  CM.COLORS = {
    bg:        '#0a0e17',   // 深墨蓝底
    cyan:      '#00f0ff',
    pink:      '#ff2bd6',
    gold:      '#ffd75e',
    goldDim:   '#b8860b',
    ghost:     'rgba(235,235,255,0.85)',
    ghostDark: 'rgba(150,150,190,0.55)',
    lava:      '#ff5e2b',
    lavaDim:   '#7a1f0e',
    soul:      '#8dffe0',
    wood:      '#241a12',
    woodEdge:  '#ffd75e'
  };

  // --- 木鱼（底部中央主交互位）---
  CM.MUYU = {
    x: 216, y: 648,           // 中心点
    w: 150, h: 96,            // 本体宽高
    tapRadius: 88,            // 判定半径（点击任意处亦可敲击）
    sink: 7,                  // 敲击下沉像素
    pulseRadius: 270,         // 单敲金光脉冲作用半径
    pulseDamage: 50
  };

  // --- 金光罩 ---
  CM.SHIELD = {
    cx: 216, cy: 336,         // 罩心（木鱼上方）
    r: 152,                   // 罩半径
    ghostAttackRadius: 165,   // 鬼物开始啃罩的距离（稍大于罩半径）
    restoreOnPet: 0.25        // 宠物替死后恢复功德 = 容量 x 此比例
  };

  // --- 功德成长 ---
  CM.MERIT = {
    tapBase: 10,              // 单敲基础功德
    tapPerLevel: 1,           // 每级增量
    capBase: 1000,            // 1 级容量
    capGrowth: 1.8,           // 每级容量倍率
    killMuyu: 5,              // 木鱼金光击杀鬼物奖励功德
    killPet: 2,               // 宠物击杀奖励功德
    offlinePerHour: 0.12,     // 离线每小时扣当前功德 12%
    offlineLevelEvery: 3,     // 每离线 3 小时掉 1 级
    floor: 1                  // 功德锁死下限
  };

  // --- 鬼物 9 级：孤魂→野鬼→厉鬼→鬼将→鬼仙→鬼王→判官→阎罗→鬼佛 ---
  const TIERS = [
    { name: '孤魂', hp: 100,  speed: 26, atkDps: 6,  size: 30, glow: '#9fd8ff' },
    { name: '野鬼', hp: 250,  speed: 30, atkDps: 10, size: 34, glow: '#9fd8ff' },
    { name: '厉鬼', hp: 640,  speed: 35, atkDps: 16, size: 38, glow: '#ff6a9a' },
    { name: '鬼将', hp: 1600, speed: 41, atkDps: 26, size: 43, glow: '#ff6a9a' },
    { name: '鬼仙', hp: 4000, speed: 48, atkDps: 42, size: 48, glow: '#c084ff' },
    { name: '鬼王', hp: 10000, speed: 56, atkDps: 66, size: 54, glow: '#c084ff' },
    { name: '判官', hp: 26000, speed: 66, atkDps: 100, size: 60, glow: '#ff2bd6' },
    { name: '阎罗', hp: 68000, speed: 78, atkDps: 150, size: 66, glow: '#ff2bd6' },
    { name: '鬼佛', hp: 180000, speed: 95, atkDps: 220, size: 74, glow: '#ffd75e' }
  ];
  CM.GHOST = {
    tiers: TIERS,
    spawnInterval: 3.2,       // 基础出怪间隔（秒），逐级缩短
    spawnIntervalPerLevel: 0.18,
    attackTick: 0.5,          // 啃罩间隔（秒）
    cyberTint: '#4dffd8',     // 赛博进化电路色
    petGhost: [               // 宠物亡灵鬼（首次全灭后解锁入池）
      { name: '猫鬼', hp: 900, speed: 72, atkDps: 40, size: 34, glow: '#b39dff' },
      { name: '鹦鹉鬼', hp: 600, speed: 95, atkDps: 30, size: 26, glow: '#b39dff' }
    ]
  };

  // --- 宠物 ---
  CM.PETS = {
    cats: [{ id: 'cat1', x: 168, label: '阿金' }, { id: 'cat2', x: 264, label: '阿银' }],
    catDps: 36, catRange: 280, catAtkCD: 0.8,
    parrots: [ { id: 'p1', level: 2 }, { id: 'p2', level: 3 }, { id: 'p3', level: 4 }, { id: 'p4', level: 5 } ],
    parrotDps: 20, parrotRange: 300, parrotAtkCD: 1.0,
    soulDps: 8, soulRange: 320, soulAtkCD: 1.2
  };

  // --- 皮肤与签到 ---
  CM.SKIN = {
    woodPool: [              // 木鱼皮肤池（签到（1,4,7...）天领取）
      { name: '素木·原初', body: '#241a12', seam: '#00f0ff', edge: '#ffd75e' },
      { name: '霓虹鱼',    body: '#1a0f2e', seam: '#ff2bd6', edge: '#00f0ff' },
      { name: '熔金',      body: '#2e1f05', seam: '#ff5e2b', edge: '#ffd75e' },
      { name: '翡翠',      body: '#06241d', seam: '#8dffe0', edge: '#4dffd8' },
      { name: '寒冰',      body: '#0b1c33', seam: '#9fd8ff', edge: '#ffffff' },
      { name: '紫电',      body: '#200a2e', seam: '#c084ff', edge: '#ff2bd6' },
      { name: '鎏金',      body: '#3a2408', seam: '#ffd75e', edge: '#fff3c4' },
      { name: '至尊·佛光', body: '#3a2a5e', seam: '#ffd75e', edge: '#ffffff' }
    ],
    checkinFirstDay: 1,
    checkinStep: 3,          // 之后每 3 天领一个
    ghostTrialDays: 1,       // 鬼物皮试用天数
    ghostPermanentAds: 3,    // 永久 = 3N 次广告
    ghostPermanentStreak: 1  //      + 连签 N 天（倍数为等级）
  };

  // --- 广告（原型模拟）---
  CM.AD = { mockSeconds: 3, revivePetCount: 6 };

  CM.ghostTier = function (level) {
    return Math.min(9, level);
  };

  // 每级刷怪表：level L => 刷 L 级新鬼 + 低级赛博化
  CM.spawnTable = function (level) {
    const table = [];
    const top = CM.ghostTier(level);
    table.push({ tier: top, cyber: false, weight: 3 });
    for (let t = 1; t < top; t++) {
      table.push({ tier: t, cyber: true, weight: 1.5 });
    }
    // 宠物亡灵鬼：首次全灭后低概率混入
    if (CM.GameState && CM.GameState.getData().petGhostUnlocked) {
      table.push({ petGhost: 0, weight: 0.6 });
      table.push({ petGhost: 1, weight: 0.6 });
    }
    return table;
  };

})(typeof window !== 'undefined' ? window : this);