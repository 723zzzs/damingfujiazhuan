/* ============================================================
 * GhostManager · 鬼物生成 / AI / 双维进化 / 击杀
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;
  const G = CM.GameState;
  const Fx = CM.Fx;

  const GM = { _list: [], _spawnT: 0, _id: 0, cycleScale: 1 };

  // 挂接外部回调（由 GameCore 在 init 时注入）
  GM.events = { onDrain: null, onKill: null };

  GM.clear = function () { GM._list = []; };

  GM.spawnInterval = function () {
    return Math.max(0.7, CM.GHOST.spawnInterval - (G.getData().muyuLevel - 1) * CM.GHOST.spawnIntervalPerLevel);
  };

  // 从罩外随机方位生成
  GM._spawnTable = function () {
    return CM.spawnTable(G.getData().muyuLevel);
  };

  GM._spawn = function (def) {
    const cfg = def.petGhost != null ? CM.GHOST.petGhost[def.petGhost] : CM.GHOST.tiers[def.tier - 1];
    const scale = (GM.cycleScale || 1);
    const a = Math.random() * Math.PI * 2;
    const R = CM.SHIELD.r + 150 + Math.random() * 90;
    const cx = CM.SHIELD.cx + Math.cos(a) * R;
    const cy = CM.SHIELD.cy + Math.sin(a) * R;
    GM._list.push({
      id: ++GM._id,
      tier: def.tier || 0,
      petGhost: def.petGhost != null ? def.petGhost : null,
      cyber: !!def.cyber,
      hp: Math.round(cfg.hp * scale), maxHp: Math.round(cfg.hp * scale),
      speed: cfg.speed * (0.85 + Math.random() * 0.3),
      atkDps: cfg.atkDps,
      size: cfg.size,
      glow: cfg.glow,
      name: cfg.name,
      x: cx, y: cy,
      state: 'approach',
      atkT: 0,
      wob: Math.random() * Math.PI * 2,
      wobSpeed: 2 + Math.random() * 2
    });
  };

  GM.update = function (dt) {
    // 出怪
    GM._spawnT -= dt;
    if (GM._spawnT <= 0 && GM._list.length < 26) {
      const table = GM._spawnTable();
      // 按权重随机
      let total = 0; for (let i = 0; i < table.length; i++) total += table[i].weight;
      let r = Math.random() * total;
      let pick = table[0];
      for (let i = 0; i < table.length; i++) {
        r -= table[i].weight;
        if (r <= 0) { pick = table[i]; break; }
      }
      GM._spawn(pick);
      GM._spawnT = GM.spawnInterval();
    }

    // 移动 / 啃罩
    for (let i = GM._list.length - 1; i >= 0; i--) {
      const h = GM._list[i];
      h.wob += h.wobSpeed * dt;
      const dx = CM.SHIELD.cx - h.x;
      const dy = CM.SHIELD.cy - h.y;
      const dist = Math.hypot(dx, dy);
      if (dist > CM.SHIELD.ghostAttackRadius) {
        h.state = 'approach';
        const wob = Math.sin(h.wob) * 6;
        const n = dist || 1;
        h.x += (dx / n) * h.speed * dt + wob * dt;
        h.y += (dy / n) * h.speed * dt - wob * 0.4 * dt;
      } else {
        h.state = 'attack';
        if (GM.events.onDrain) {
          h.atkT -= dt;
          if (h.atkT <= 0) {
            h.atkT = CM.GHOST.attackTick;
            GM.events.onDrain(h.atkDps * CM.GHOST.attackTick, h);
          }
        }
      }
    }
  };

  // 受击：src = 'pulse' | 'pet' | 'soul'
  GM.hurt = function (h, dmg, src, x, y) {
    if (!h || h.hp <= 0) return;
    h.hp -= dmg;
    if (h.hp <= 0) {
      GM._kill(h, src, x, y);
      return true;
    }
    // 受击反馈：微白闪
    h._flash = 0.1;
    return false;
  };

  GM._kill = function (h, src, x, y) {
    const i = GM._list.indexOf(h);
    if (i >= 0) GM._list.splice(i, 1);

    // 图鉴点亮（含赛博化形态）
    if (h.petGhost != null) {
      G.collect(null, null, h.petGhost === 0 ? 'cat' : 'parrot');
    } else {
      G.collect(h.tier, h.cyber, null);
    }

    if (src === 'pulse') {
      Fx.firework(x || h.x, y || h.y, 0.9);
      Fx.meritText(h.x, h.y - 14, '+' + CM.MERIT.killMuyu, CM.COLORS.gold, 22);
      G.getData().merit = Math.min(G.meritCap(), G.getData().merit + CM.MERIT.killMuyu);
      CM.Audio.kill(true);
    } else {
      // 宠物/友方击杀 => 灵魂净化归顺
      Fx.poof(h.x, h.y, h.glow);
      CM.Audio.kill(false);
      G.getData().merit = Math.min(G.meritCap(), G.getData().merit + CM.MERIT.killPet);
    }
    // 统计 / 灵魂归顺回调（src=pulse 时不产生友方魂）
    if (GM.events.onKill) GM.events.onKill(h, src, x, y);
  };

  // 攻击木鱼金光脉冲范围内的鬼物（返回击杀数）
  GM.pulseDamage = function (cx, cy, radius, dmg) {
    let kills = 0;
    for (let i = GM._list.length - 1; i >= 0; i--) {
      const h = GM._list[i];
      if (Math.hypot(h.x - cx, h.y - cy) <= radius) {
        if (GM.hurt(h, dmg, 'pulse', h.x, h.y)) kills++;
      }
    }
    return kills;
  };

  // 宠物索敌：返回范围内最近鬼物
  GM.nearest = function (x, y, range) {
    let best = null, bd = range;
    for (let i = 0; i < GM._list.length; i++) {
      const h = GM._list[i];
      const d = Math.hypot(h.x - x, h.y - y);
      if (d < bd) { bd = d; best = h; }
    }
    return best;
  };

  GM.draw = function (ctx) {
    for (let i = 0; i < GM._list.length; i++) {
      const h = GM._list[i];
      // 躯体：半透明白雾
      ctx.save();
      ctx.translate(h.x, h.y);
      const s = h.size;
      const wob = Math.sin(h.wob) * 2;
      ctx.globalAlpha = 0.82;
      const grad = ctx.createRadialGradient(0, -s * 0.15, s * 0.1, 0, s * 0.2, s);
      if (h.petGhost != null) {
        grad.addColorStop(0, 'rgba(179,157,255,0.4)');
        grad.addColorStop(1, 'rgba(60,30,90,0)');
      } else {
        grad.addColorStop(0, h.cyber ? 'rgba(160,255,225,0.5)' : 'rgba(235,235,255,0.5)');
        grad.addColorStop(1, 'rgba(120,120,180,0)');
      }
      // 鬼形轮廓：上圆下散
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.85);
      ctx.quadraticCurveTo(-s * 0.7 + wob, s * 0.2, -s * 0.55, -s * 0.3);
      ctx.quadraticCurveTo(-s * 0.3, -s * 0.72, 0, -s * 0.55);
      ctx.quadraticCurveTo(s * 0.3, -s * 0.72, s * 0.55, -s * 0.3);
      ctx.quadraticCurveTo(s * 0.7 + wob, s * 0.2, 0, s * 0.85);
      ctx.fill();
      // 底部飘散
      ctx.globalAlpha = 0.5;
      ctx.beginPath();
      for (let j = 0; j < 3; j++) {
        const px = (j - 1) * s * 0.5 + wob * 0.5;
        ctx.moveTo(px, s * 0.7);
        ctx.quadraticCurveTo(px + 6, s * 0.75, px + 3, s * 0.35);
      }
      ctx.strokeStyle = h.petGhost != null ? 'rgba(179,157,255,0.7)' : h.cyber ? 'rgba(77,255,216,0.7)' : 'rgba(200,200,235,0.6)';
      ctx.lineWidth = 2;
      ctx.stroke();

      // 赛博化电路纹
      if (h.cyber) {
        ctx.globalAlpha = 0.85;
        ctx.strokeStyle = CM.GHOST.cyberTint;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = CM.GHOST.cyberTint;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let j = 0; j < 3; j++) {
          const yy = -s * 0.3 + j * s * 0.28;
          ctx.moveTo(-s * 0.5 + wob * 0.4, yy);
          ctx.lineTo(-s * 0.2 + wob * 0.4, yy);
          ctx.lineTo(-s * 0.1, yy - 6);
          ctx.moveTo(-s * 0.1, yy);
          ctx.lineTo(s * 0.15, yy);
          ctx.lineTo(s * 0.25, yy - 4);
          ctx.moveTo(s * 0.25, yy);
          ctx.lineTo(s * 0.5, yy);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 眼睛（发光）
      const eyes = h.petGhost != null ? 2 : 2;
      ctx.shadowColor = h.glow;
      ctx.shadowBlur = 9;
      ctx.fillStyle = h.petGhost != null ? '#d9c6ff' : '#ffffff';
      const ex = 6 * (eyes === 2 ? 1 : 0);
      const ey = -s * 0.12;
      for (let j = 0; j < eyes; j++) {
        const ox = j === 0 ? -ex : ex;
        ctx.beginPath();
        ctx.ellipse(ox, ey, 4, 5.5 + Math.sin(h.wob * 1.3) * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.shadowBlur = 0;

      // 受伤闪白
      if (h._flash) { h._flash -= 1 / 60; ctx.globalAlpha = h._flash * 8; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(0, 0, s * 0.6, 0, Math.PI * 2); ctx.fill(); }

      // 血条
      if (h.hp < h.maxHp) {
        ctx.globalAlpha = 0.85;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-s * 0.7, -s * 0.95, s * 1.4, 5);
        ctx.fillStyle = h.cyber ? CM.GHOST.cyberTint : CM.COLORS.pink;
        ctx.fillRect(-s * 0.7, -s * 0.95, s * 1.4 * Math.max(0, h.hp / h.maxHp), 5);
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  };

  CM.GhostManager = GM;
})(typeof window !== 'undefined' ? window : this);