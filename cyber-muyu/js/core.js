/* ============================================================
 * GameCore · 主循环 / 调度 / 渲染（背景·玩家·木鱼）/ 失败闭环
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;
  const G = CM.GameState;
  const GM = CM.GhostManager;
  const PS = CM.PetSystem;
  const SH = CM.ShieldSystem;
  const Fx = CM.Fx;
  const T = CM.TapSystem;
  const HUD = CM.HUD;

  const C = {
    canvas: null, ctx: null, screen: 'boot',
    stats: { merit: 0, kills: 0, level: 1 },
    _lastT: 0, _saveT: 0, _ambT: 0, _drainLock: false,
    _scale: 1, _offX: 0, _offY: 0
  };

  C.init = function () {
    C.canvas = document.getElementById('game');
    C.ctx = C.canvas.getContext('2d');
    C.resize();
    window.addEventListener('resize', function () { C.resize(); });
    CM.Sprites.preload();            // 立绘异步加载，未就绪时自动用矢量兜底

    // 加载存档 + 离线惩罚
    const res = CM.SaveManager.load();
    const pen = res.fresh ? null : CM.SaveManager.applyOfflinePenalty();
    C._offlinePenalty = pen;

    GM.cycleScale = 1 + (G.getData().cycle - 1) * 0.6;

    T.init(C.canvas);
    T.onKnock = function () {
      if (C.screen !== 'play') return false;
      C.stats.merit += G.tapGain();
      C._checkLevelUp();
      return true;
    };

    // 鬼物啃罩
    GM.events.onDrain = function (dmg, ghost) {
      if (C.screen !== 'play') return;
      SH.drain(dmg);
      if (G.getData().merit <= 0 && !SH.broken && !C._drainLock) {
        C._drainLock = true;
        setTimeout(function () { C._drainLock = false; C.shieldBreak(); }, 60);
      }
    };
    // 鬼物击杀统计 + 宠物击杀灵魂归顺
    GM.events.onKill = function (ghost, src) {
      C.stats.kills++;
      if (src === 'pulse') return;
      PS.addSoul(ghost.x, ghost.y);
    };

    HUD.init(document.getElementById('ui'));

    // 性别选择
    if (G.getData().gender) { C.screen = 'play'; }
    else {
      C.screen = 'gender';
      HUD.showGender(function (g) {
        G.getData().gender = g;
        G.setDirty();
        C.screen = 'play';
      });
    }
    // 离线结算卡（新鲜档不弹）
    if (C._offlinePenalty && C._offlinePenalty.hours >= 1) {
      HUD.showOffline(C._offlinePenalty);
    }

    requestAnimationFrame(function loop(t) {
      const dt = Math.min(0.05, (t - C._lastT) / 1000 || 0.016);
      C._lastT = t;
      C.update(dt);
      C.draw();
      // 自动存档
      C._saveT += dt;
      if (C._saveT > 3) { C._saveT = 0; if (G.isDirty()) CM.SaveManager.save(); }
      requestAnimationFrame(loop);
    });

    // 切后台存档
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) CM.SaveManager.save();
    });
  };

  C.resize = function () {
    const vw = CM.VIEW.W, vh = CM.VIEW.H;
    const w = window.innerWidth, h = window.innerHeight;
    const scale = Math.min(w / vw, h / vh);
    C.canvas.width = vw * scale;
    C.canvas.height = vh * scale;
    C.canvas.style.width = (vw * scale) + 'px';
    C.canvas.style.height = (vh * scale) + 'px';
    // 画布已由 CSS translate(-50%,-50%) 居中，坐标系内只需缩放，不可再加偏移（否则宽屏时内容被推偏半屏）
    C.ctx.setTransform(scale, 0, 0, scale, 0, 0);
    // 顶栏按钮跟随画布：放在功德条下方（画布逻辑 y≈96）
    const btns = document.getElementById('topBtns');
    if (btns) {
      const r = C.canvas.getBoundingClientRect();
      btns.style.left = (r.left + r.width / 2) + 'px';
      btns.style.top = (r.top + r.height * (96 / vh)) + 'px';
    }
  };

  // ---------- 升级 ----------
  C._checkLevelUp = function () {
    const d = G.getData();
    if (d.merit >= G.meritCap()) {
      d.merit = 0;
      PS.clearSouls();                       // 友方鬼灵本级结束消散
      if (d.muyuLevel >= 9) {
        // 通关周目
        d.cycle += 1;
        d.muyuLevel = 1;
        C.stats = { merit: 0, kills: C.stats.kills, level: 1 };
        GM.cycleScale = 1 + (d.cycle - 1) * 0.6;
        Fx.levelUpBurst();
        CM.Audio.levelUp();
        HUD.toast('通关第 ' + (d.cycle - 1) + ' 周目！ 赛博鬼佛挑战开启', 3600);
      } else {
        d.muyuLevel += 1;
        C.stats.level = d.muyuLevel;
        Fx.levelUpBurst();
        CM.Audio.levelUp();
        HUD.levelUpFx();
      }
      G.setDirty();
    }
  };

  // ---------- 失败闭环：替死 → 结算 ----------
  C.shieldBreak = function () {
    if (C.screen !== 'play') return;
    const liv = PS.living();
    const nextParrot = liv.parrots[0] && liv.parrots[0].id;
    const nextCat = liv.cats[0] && liv.cats[0].id;
    const nextId = nextParrot || nextCat;
    if (nextId) {
      G.killPet(nextId);
      CM.Audio.petDown();
      Fx.poof(CM.SHIELD.cx, CM.SHIELD.cy, '#b39dff');
      // 罩子重亮：恢复功德 = 容量 25%
      G.getData().merit = Math.max(1, Math.round(G.meritCap() * CM.SHIELD.restoreOnPet));
      SH.broken = false;
      HUD.toast('伙伴替你挡下致命一击（剩 ' + G.existingPets() + ' 位）');
    } else {
      // 全灭
      C.gameOver();
    }
  };

  C.gameOver = function () {
    G.getData().petGhostUnlocked = true;     // 猫鬼/鹦鹉鬼入池
    G.setDirty();
    CM.Audio.gameOver();
    C.screen = 'over';
    HUD.showSettle(C.stats,
      function () {   // 看广告复活
        G._adRevive = true;
        const d = G.getData();
        d.petAlive = { cat1: true, cat2: true, p1: true, p2: true, p3: true, p4: true };
        d.merit = Math.max(1, Math.round(G.meritCap() * CM.SHIELD.restoreOnPet));
        SH.broken = false;
        G.setDirty();
        C.stats = { merit: 0, kills: 0, level: G.getData().muyuLevel };
        C.screen = 'play';
      },
      function () {   // 重开：宠物复活满编、木鱼回 1 级、图鉴保留
        G.revivePets();
        GM.clear();
        SH.broken = false;
        C.stats = { merit: 0, kills: 0, level: 1 };
        C.screen = 'play';
      }
    );
  };

  // ---------- 更新 ----------
  C.update = function (dt) {
    Fx.update(dt);
    T.update(dt);
    if (C.screen === 'play') {
      GM.update(dt);
      PS.update(dt, G.getData().muyuLevel);
      // 环境金尘
      C._ambT -= dt;
      if (C._ambT <= 0) {
        C._ambT = 0.5;
        Fx.ambient(Math.random() * CM.VIEW.W, CM.VIEW.H * 0.7 + Math.random() * 100, 1.5 + Math.random() * 2);
      }
    }
  };

  // ---------- 渲染 ----------
  C.draw = function () {
    const ctx = C.ctx;
    drawBackground(ctx);
    if (C.screen === 'gender' || C.screen === 'boot') { drawTitleScreen(ctx); return; }
    drawAltar(ctx);
    SH.draw(ctx);
    drawPlayer(ctx);
    PS.draw(ctx, G.getData().muyuLevel);
    GM.draw(ctx);
    drawMuyu(ctx);
    Fx.draw(ctx);
    HUD.drawBar(ctx);
  };

  // ===== 背景：8 张赛博地狱（L1~8）+ 赛博灵山（L9+）=====
  function drawBackground(ctx) {
    const lv = Math.min(9, G.getData().muyuLevel);
    const W = CM.VIEW.W, H = CM.VIEW.H;
    if (lv >= 9) return drawMountain(ctx, W, H);
    drawHell(ctx, W, H, lv);
  }

  function drawHell(ctx, W, H, lv) {
    // 每层地狱一套氛围色调
    const hues = [
      { a: '#0a0e17', b: '#14233a', lava: '#ff5e2b' },
      { a: '#0d0a17', b: '#2a1433', lava: '#ff7a3d' },
      { a: '#120a14', b: '#33122a', lava: '#ff8a4d' },
      { a: '#0c0a1c', b: '#1c1440', lava: '#ff5e5e' },
      { a: '#0d0717', b: '#241047', lava: '#c45eff' },
      { a: '#120819', b: '#330f33', lava: '#ff47c8' },
      { a: '#0a0718', b: '#1b0f45', lava: '#a04dff' },
      { a: '#150712', b: '#400821', lava: '#ff2b2b' }
    ];
    const pal = hues[lv - 1];
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, pal.a);
    sky.addColorStop(0.6, pal.b);
    sky.addColorStop(1, '#050308');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);

    // 霓虹城市剪影（中景）
    ctx.fillStyle = 'rgba(10,14,26,0.9)';
    for (let i = 0; i < 12; i++) {
      const bx = (i * 41 + lv * 13) % W;
      const bh = 70 + ((i * 7 + lv * 5) % 50);
      ctx.fillRect(bx, H * 0.52 - bh, 26, bh);
      // 窗光
      ctx.fillStyle = 'rgba(0,240,255,0.25)';
      for (let j = 0; j < 4; j++) {
        ctx.fillRect(bx + 5 + (j % 2) * 10, H * 0.52 - bh + 8 + j * 12, 4, 4);
      }
      ctx.fillStyle = 'rgba(10,14,26,0.9)';
    }
    // 地狱之门轮廓
    ctx.strokeStyle = 'rgba(255,47,200,0.35)';
    ctx.lineWidth = 3;
    ctx.shadowColor = '#ff2bd6'; ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(W / 2, H * 0.56, 70 + Math.sin(Date.now() / 900) * 4, Math.PI, 0);
    ctx.stroke();
    ctx.shadowBlur = 0;
    // 垂吊锁链
    ctx.strokeStyle = 'rgba(0,240,255,0.22)';
    ctx.lineWidth = 2.5;
    for (let i = 0; i < 3; i++) {
      const cx = (W * (i + 1)) / 4;
      ctx.beginPath(); ctx.moveTo(cx, 0);
      for (let yy = 0; yy < 130; yy += 14) ctx.lineTo(cx + Math.sin(yy / 12 + i) * 7, yy);
      ctx.stroke();
    }
    // 底部熔岩
    const lava = ctx.createLinearGradient(0, H * 0.78, 0, H);
    lava.addColorStop(0, 'rgba(122,31,14,0)');
    lava.addColorStop(1, pal.lava);
    ctx.fillStyle = lava;
    ctx.fillRect(0, H * 0.78, W, H * 0.22);
    ctx.fillStyle = 'rgba(255,160,80,0.28)';
    for (let i = 0; i < 8; i++) {
      ctx.beginPath();
      ctx.arc((i * 63 + Date.now() / 40) % W, H * 0.88 + Math.sin(i * 2 + Date.now() / 500) * 6, 3, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  function drawMountain(ctx, W, H) {
    // 赛博灵山：暖金圣境
    const sky = ctx.createLinearGradient(0, 0, 0, H);
    sky.addColorStop(0, '#1a0f33');
    sky.addColorStop(0.5, '#3a1f55');
    sky.addColorStop(1, '#140a26');
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, H);
    // 佛光顶轮
    ctx.shadowColor = CM.COLORS.gold;
    ctx.shadowBlur = 40;
    ctx.fillStyle = 'rgba(255,215,94,0.28)';
    ctx.beginPath(); ctx.arc(W / 2, H * 0.42, 120 + Math.sin(Date.now() / 700) * 8, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
    // 灵山山体
    ctx.fillStyle = '#24163e';
    ctx.beginPath();
    ctx.moveTo(0, H * 0.75);
    ctx.lineTo(W * 0.26, H * 0.55);
    ctx.lineTo(W * 0.4, H * 0.34);
    ctx.lineTo(W * 0.5, H * 0.2);
    ctx.lineTo(W * 0.6, H * 0.34);
    ctx.lineTo(W * 0.74, H * 0.55);
    ctx.lineTo(W, H * 0.75);
    ctx.lineTo(W, H);
    ctx.lineTo(0, H);
    ctx.closePath(); ctx.fill();
    // 山顶宝刹
    ctx.fillStyle = '#3a2a5e';
    ctx.fillRect(W / 2 - 18, H * 0.2 - 30, 36, 30);
    ctx.fillStyle = '#4d3a78';
    for (let i = 0; i < 3; i++) {
      ctx.fillRect(W / 2 - 26 + i * 16, H * 0.2 - 44 + (i % 2) * 8, 12, 14);
    }
    // 祥云（赛博电路云）
    ctx.strokeStyle = 'rgba(0,240,255,0.3)';
    ctx.lineWidth = 2;
    for (let i = 0; i < 4; i++) {
      const cx = W * (0.15 + i * 0.24);
      const cy = H * (0.5 + (i % 2) * 0.1);
      ctx.beginPath();
      for (let a = 0; a <= Math.PI * 2; a += 0.3) {
        const r = 16 + Math.sin(a * 3 + i) * 6;
        const px = cx + Math.cos(a) * r;
        const py = cy + Math.sin(a) * r * 0.4;
        if (a === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.stroke();
    }
    // 金色粒子
    ctx.fillStyle = 'rgba(255,215,94,0.5)';
    for (let i = 0; i < 18; i++) {
      const px = ((i * 97 + Date.now() / 60) % (W + 40)) - 20;
      const py = ((i * 53) % (H * 0.5)) + 60;
      ctx.beginPath(); ctx.arc(px, py + Math.sin(Date.now() / 400 + i) * 8, 1.6, 0, Math.PI * 2); ctx.fill();
    }
  }

  // ===== 祭台（仅脚下微光，无实体长条）=====
  function drawAltar(ctx) {
    // 罩下地面光斑（模拟金光映照的地面，无实体条块）
    ctx.save();
    const g = ctx.createRadialGradient(CM.SHIELD.cx, CM.PET_SPOTS.cat1.y + 40, 10, CM.SHIELD.cx, CM.PET_SPOTS.cat1.y + 40, 130);
    g.addColorStop(0, 'rgba(255,215,94,0.10)');
    g.addColorStop(1, 'rgba(255,215,94,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(CM.SHIELD.cx, CM.PET_SPOTS.cat1.y + 40, 130, 26, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ===== 玩家（金光下） =====
  function drawPlayer(ctx) {
    const g = G.getData().gender || 'f';
    const x = CM.PET_SPOTS.player.x, y = CM.PET_SPOTS.player.y;
    ctx.save();
    ctx.translate(x, y);
    // 脚/腿
    ctx.fillStyle = '#1c2333';
    ctx.fillRect(-12, 8, 10, 18);
    ctx.fillRect(4, 8, 10, 18);
    // 躯干
    ctx.fillStyle = g === 'f' ? '#ff8fb8' : '#00d8d0';
    ctx.fillRect(-14, -18, 28, 28);
    // 头
    ctx.beginPath(); ctx.arc(0, -30, 12, 0, Math.PI * 2);
    ctx.fillStyle = '#f0d8b8'; ctx.fill();
    // 头发
    ctx.fillStyle = g === 'f' ? '#2b1a3a' : '#16233a';
    ctx.beginPath(); ctx.arc(0, -33, 12.5, Math.PI, 0); ctx.fill();
    if (g === 'f') {
      ctx.fillRect(-12.5, -34, 6, 22);
      ctx.fillRect(7, -34, 6, 22);   // 长发
    }
    ctx.restore();
  }

  // ===== 木鱼 =====
  function drawMuyu(ctx) {
    const M = CM.MUYU;
    const sink = T.anm * M.sink;
    const x = M.x, y = M.y + sink;

    if (CM.Sprites.has('muyu')) {
      // 立绘：敲击时轻微下沉 + 弹起微缩放
      const squash = 1 + T.anm * 0.08;
      ctx.save();
      ctx.translate(x, y + sink * 0.6);
      ctx.scale(1 / squash, squash * 0.94);
      ctx.shadowColor = CM.COLORS.gold;
      ctx.shadowBlur = 12 + T.anm * 22;
      CM.Sprites.draw(ctx, 'muyu', 0, 0, { w: M.w * 0.96 });
      ctx.shadowBlur = 0;
      // 敲击金光环
      if (T.anm > 0.4) {
        ctx.strokeStyle = 'rgba(255,215,94,' + T.anm * 0.9 + ')';
        ctx.lineWidth = 2.5;
        ctx.beginPath(); ctx.arc(0, 0, M.w * 0.55 + (1 - T.anm) * 34, 0, Math.PI * 2); ctx.stroke();
      }
      ctx.restore();
      return;
    }

    // 矢量兜底
    const skin = G.woodStyle();
    ctx.save();
    ctx.translate(x, y);
    // 本体（圆鼓鱼身 + 鱼嘴开口 + 鱼尾）
    ctx.fillStyle = skin.body;
    ctx.strokeStyle = skin.edge;
    ctx.lineWidth = 2.5;
    ctx.shadowColor = CM.COLORS.gold;
    ctx.shadowBlur = 12 + T.anm * 20;
    ctx.beginPath();
    ctx.moveTo(-M.w / 2, -M.h / 2);
    ctx.quadraticCurveTo(0, -M.h / 2 - 12, M.w / 2, -M.h / 2);
    ctx.quadraticCurveTo(M.w / 2 + 8, 0, M.w / 2, M.h / 2);
    ctx.quadraticCurveTo(0, M.h / 2 + 10, -M.w / 2, M.h / 2);
    ctx.quadraticCurveTo(-M.w / 2 - 8, 0, -M.w / 2, -M.h / 2);
    ctx.closePath();
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;

    // 鱼嘴开槽（共鸣腔）
    ctx.fillStyle = '#0a0705';
    roundRect(ctx, -M.w * 0.28, -M.h * 0.42, M.w * 0.56, M.h * 0.5, M.w * 0.14);
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // 金色电路纹（曼陀罗式）
    ctx.strokeStyle = skin.edge;
    ctx.lineWidth = 1.6;
    ctx.shadowColor = skin.edge;
    ctx.shadowBlur = 5;
    ctx.beginPath();
    ctx.moveTo(-M.w * 0.42, -M.h * 0.28);
    ctx.lineTo(-M.w * 0.12, -M.h * 0.28);
    ctx.lineTo(-M.w * 0.02, -M.h * 0.16);
    ctx.moveTo(-M.w * 0.02, -M.h * 0.28);
    ctx.lineTo(M.w * 0.14, -M.h * 0.28);
    ctx.lineTo(M.w * 0.24, -M.h * 0.14);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 青色能量缝
    ctx.strokeStyle = skin.seam;
    ctx.lineWidth = 2;
    ctx.shadowColor = skin.seam;
    ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(-M.w * 0.3, M.h * 0.3);
    ctx.quadraticCurveTo(0, M.h * 0.46, M.w * 0.3, M.h * 0.3);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 敲击下沉微光
    if (T.anm > 0.4) {
      ctx.strokeStyle = 'rgba(255,215,94,' + T.anm + ')';
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, M.w * 0.5 + (1 - T.anm) * 30, 0, Math.PI * 2); ctx.stroke();
    }
    ctx.restore();
  }

  function drawTitleScreen(ctx) {
    ctx.fillStyle = CM.COLORS.gold;
    ctx.font = 'bold 30px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.textAlign = 'center';
    ctx.shadowColor = CM.COLORS.cyan;
    ctx.shadowBlur = 16;
    ctx.fillText('赛 博 木 鱼', CM.VIEW.W / 2, CM.VIEW.H / 2);
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,240,255,0.8)';
    ctx.font = '13px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('点击下方面板选择形象开始', CM.VIEW.W / 2, CM.VIEW.H / 2 + 34);
  }

  CM.GameCore = C;
})(typeof window !== 'undefined' ? window : this);