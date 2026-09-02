/* ============================================================
 * FxSystem · 粒子特效（金光圈 / 电弧 / 飘字 / 赛博烟花）
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;

  const Fx = { _list: [] };

  // ---------- 生成 ----------
  // 径向金光圈
  Fx.ring = function (x, y, r0, r1, dur, color, lw) {
    Fx._list.push({ t: 'ring', x: x, y: y, r0: r0, r1: r1, life: dur, max: dur, color: color || CM.COLORS.gold, lw: lw || 5 });
  };
  // 电弧（随机折线，青+金）
  Fx.bolt = function (x1, y1, x2, y2, dur, color, segs) {
    const n = segs || 7;
    const pts = [{ x: x1, y: y1 }];
    for (let i = 1; i < n; i++) {
      const t = i / n;
      const jx = (Math.random() - 0.5) * 26;
      const jy = (Math.random() - 0.5) * 26;
      pts.push({ x: x1 + (x2 - x1) * t + jx, y: y1 + (y2 - y1) * t + jy });
    }
    pts.push({ x: x2, y: y2 });
    Fx._list.push({ t: 'bolt2', pts: pts, life: dur, max: dur, color: color || CM.COLORS.cyan, w: 2 });
    // 双层电光：更亮内核
    Fx._list.push({ t: 'bolt2', pts: pts, life: dur * 0.5, max: dur * 0.5, color: 'rgba(255,255,255,0.9)', w: 1 });
  };
  // 功德飘字（附电弧闪烁）
  Fx.meritText = function (x, y, text, color, size) {
    Fx._list.push({ t: 'mtext', x: x, y: y, text: text, life: 0.9, max: 0.9, color: color || CM.COLORS.gold, size: size || 26 });
    for (let i = 0; i < 3; i++) {
      Fx.bolt(x + (Math.random() - 0.5) * 30, y + (Math.random() - 0.5) * 16,
        x + (Math.random() - 0.5) * 34, y - 14, 0.25, CM.COLORS.cyan, 4);
    }
  };
  // 赛博烟花（约 1/3 屏）：多彩粒子 + 冲击环
  Fx.firework = function (x, y, size) {
    const s = size || 1;
    const colors = [CM.COLORS.gold, CM.COLORS.cyan, CM.COLORS.pink, '#c084ff', '#ff6a9a', '#8dffe0'];
    const parts = [];
    const n = 46;
    const spread = 130 * s;
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2 + Math.random() * 0.15;
      const sp = spread * (0.55 + Math.random() * 0.45);
      parts.push({
        x: x, y: y,
        vx: Math.cos(a) * sp, vy: Math.sin(a) * sp,
        c: colors[Math.floor(Math.random() * colors.length)],
        r: 1.6 + Math.random() * 2.2
      });
    }
    Fx._list.push({ t: 'firework', x: x, y: y, life: 0.9, max: 0.9, parts: parts, s: s });
    Fx.ring(x, y, 6, 150 * s, 0.5, CM.COLORS.gold, Math.max(2, 6 * s));
    Fx.ring(x, y, 6, 120 * s, 0.35, 'rgba(255,255,255,0.8)', 3);
    // 升空拖尾
    Fx._list.push({ t: 'trail', x: x, y: y, life: 0.25, max: 0.25, color: 'rgba(255,215,94,0.9)' });
  };
  // 鬼物被宠物击杀的小爆
  Fx.poof = function (x, y, color) {
    Fx._list.push({ t: 'puffs', x: x, y: y, life: 0.5, max: 0.5, color: color || 'rgba(235,235,255,0.9)', n: 10 });
  };
  // 冲击波
  Fx.shockwave = function (x, y, r, dur, color) {
    Fx.ring(x, y, r * 0.2, r, dur, color || CM.COLORS.gold, 4);
    Fx.ring(x, y, r * 0.2, r * 0.7, dur * 0.7, 'rgba(255,255,255,0.6)', 2);
  };
  // 升级全屏金波
  Fx.levelUpBurst = function () {
    Fx.shockwave(CM.VIEW.W / 2, CM.VIEW.H / 2, CM.VIEW.W * 0.7, 1.1, CM.COLORS.gold);
    for (let i = 0; i < 10; i++) {
      Fx.firework(Math.random() * CM.VIEW.W, 120 + Math.random() * 300, 0.5 + Math.random() * 0.6);
    }
  };
  // 敲击木鱼：金环 + 电弧 + 微光
  Fx.knockFx = function (x, y) {
    Fx.ring(x, y, 12, 70, 0.4, CM.COLORS.gold, 4);
    for (let i = 0; i < 4; i++) {
      Fx.bolt(x, y, x + (Math.random() - 0.5) * 110, y - 40 - Math.random() * 90, 0.22, i % 2 ? CM.COLORS.cyan : CM.COLORS.gold, 6);
    }
  };
  // 背景环境金尘（常驻，极少量）
  Fx.ambient = function (x, y, r, color) {
    Fx._list.push({ t: 'ambient', x: x, y: y, r: r || 2, life: 1.4, max: 1.4, color: color || 'rgba(255,215,94,0.55)', vx: (Math.random() - 0.5) * 10, vy: -8 - Math.random() * 10 });
  };

  // ---------- 更新 / 绘制 ----------
  Fx.update = function (dt) {
    const list = Fx._list;
    for (let i = list.length - 1; i >= 0; i--) {
      const p = list[i];
      p.life -= dt;
      if (p.life <= 0) { list.splice(i, 1); continue; }
      if (p.t === 'firework') {
        for (let j = 0; j < p.parts.length; j++) {
          const pt = p.parts[j];
          pt.x += pt.vx * dt; pt.y += pt.vy * dt;
          pt.vx *= 0.94; pt.vy *= 0.94; pt.vy += 120 * dt; // 重力回落
        }
      } else if (p.t === 'ambient') {
        p.x += p.vx * dt; p.y += p.vy * dt;
      } else if (p.t === 'mtext') {
        p.y -= 42 * dt;
      } else if (p.t === 'trail') {
        p.y -= 160 * dt;
      }
    }
    // 控制数量上限
    if (list.length > 600) list.splice(0, list.length - 600);
  };

  Fx.draw = function (ctx) {
    for (let i = 0; i < Fx._list.length; i++) {
      const p = Fx._list[i];
      const k = p.life / p.max;
      switch (p.t) {
        case 'ring': {
          const r = p.r0 + (p.r1 - p.r0) * (1 - k);
          ctx.globalAlpha = k * 0.9;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.lw * k + 0.5;
          ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(1, r), 0, Math.PI * 2); ctx.stroke();
          break;
        }
        case 'bolt2': {
          ctx.globalAlpha = k;
          ctx.strokeStyle = p.color;
          ctx.lineWidth = p.w;
          ctx.beginPath();
          ctx.moveTo(p.pts[0].x, p.pts[0].y);
          for (let j = 1; j < p.pts.length; j++) ctx.lineTo(p.pts[j].x, p.pts[j].y);
          ctx.stroke();
          break;
        }
        case 'mtext': {
          ctx.globalAlpha = Math.min(1, k * 1.6);
          ctx.font = 'bold ' + p.size + 'px "PingFang SC", "Microsoft YaHei", sans-serif';
          ctx.textAlign = 'center';
          ctx.shadowColor = CM.COLORS.cyan;
          ctx.shadowBlur = 8 + k * 6;
          ctx.fillStyle = p.color;
          ctx.fillText(p.text, p.x + (Math.random() - 0.5) * 2, p.y);
          ctx.shadowBlur = 0;
          break;
        }
        case 'firework': {
          ctx.globalAlpha = k;
          for (let j = 0; j < p.parts.length; j++) {
            const pt = p.parts[j];
            ctx.fillStyle = pt.c;
            ctx.globalAlpha = k * 0.9;
            ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.r * k + 0.3, 0, Math.PI * 2); ctx.fill();
          }
          break;
        }
        case 'puffs': {
          ctx.globalAlpha = k;
          for (let j = 0; j < p.n; j++) {
            const a = j / p.n * Math.PI * 2;
            const r = 20 + (1 - k) * 46;
            ctx.fillStyle = p.color;
            ctx.globalAlpha = k * 0.8;
            ctx.beginPath();
            ctx.arc(p.x + Math.cos(a) * r, p.y + Math.sin(a) * r, 3 * k + 0.5, 0, Math.PI * 2);
            ctx.fill();
          }
          break;
        }
        case 'trail': {
          ctx.globalAlpha = k;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, 3, 0, Math.PI * 2); ctx.fill();
          break;
        }
        case 'ambient': {
          ctx.globalAlpha = k * 0.7;
          ctx.fillStyle = p.color;
          ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
          break;
        }
      }
    }
    ctx.globalAlpha = 1;
  };

  CM.Fx = Fx;
})(typeof window !== 'undefined' ? window : this);