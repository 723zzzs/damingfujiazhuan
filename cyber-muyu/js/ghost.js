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
    // 统一从屏幕顶部外缘出现，向下侵袭，保证进入视野后才可被攻击
    const cx = 60 + Math.random() * (CM.VIEW.W - 120);
    const cy = -80 - Math.random() * 60;
    // 精英鬼物：体型更大、浑身血气
    const isElite = Math.random() < CM.GHOST.eliteChance;
    const eliteScale = isElite ? CM.GHOST.eliteSize : 1;
    GM._list.push({
      id: ++GM._id,
      tier: def.tier || 0,
      petGhost: def.petGhost != null ? def.petGhost : null,
      cyber: !!def.cyber,
      elite: isElite,
      hp: Math.round(cfg.hp * scale * (isElite ? CM.GHOST.eliteHp : 1)),
      maxHp: Math.round(cfg.hp * scale * (isElite ? CM.GHOST.eliteHp : 1)),
      speed: cfg.speed * (0.85 + Math.random() * 0.3),
      atkDps: cfg.atkDps * (isElite ? CM.GHOST.eliteAtk : 1),
      size: cfg.size * eliteScale,
      glow: isElite ? '#ff3b3b' : cfg.glow,
      name: (isElite ? '精英·' : '') + cfg.name,
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

    // 移动 / 啃罩：鬼物从上方落下，沿半圆钟罩弧面贴附啃咬
    for (let i = GM._list.length - 1; i >= 0; i--) {
      const h = GM._list[i];
      h.wob += h.wobSpeed * dt;
      const surfaceY = CM.ShieldSystem.surfaceY(h.x);
      if (h.y < surfaceY - 14) {
        // 未到罩面：向下侵袭（轻微左右游移）
        h.state = 'approach';
        h.y += h.speed * dt * 0.9;
        h.x += Math.sin(h.wob) * 9 * dt;
      } else {
        // 贴在罩面上啃
        h.state = 'attack';
        h.y = surfaceY - 12 + Math.sin(h.wob) * 3;
        if (GM.events.onDrain) {
          h.atkT -= dt;
          if (h.atkT <= 0) {
            h.atkT = CM.GHOST.attackTick;
            GM.events.onDrain(h.atkDps * CM.GHOST.attackTick, h, surfaceY);
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

    const rewardMul = h.elite ? CM.GHOST.eliteReward : 1;

    // 图鉴点亮（含赛博化形态；精英同形态共用图鉴）
    if (h.petGhost != null) {
      G.collect(null, null, h.petGhost === 0 ? 'cat' : 'parrot');
    } else {
      G.collect(h.tier, h.cyber, null);
    }

    if (src === 'pulse') {
      const gain = CM.MERIT.killMuyu * rewardMul;
      Fx.firework(x || h.x, y || h.y, h.elite ? 1.3 : 0.9);
      Fx.meritText(h.x, h.y - 14, '+' + gain, CM.COLORS.gold, h.elite ? 30 : 22);
      G.getData().merit = Math.min(G.meritCap(), G.getData().merit + gain);
      CM.Audio.kill(true);
    } else {
      // 宠物/友方击杀 => 灵魂净化归顺
      Fx.poof(h.x, h.y, h.glow);
      CM.Audio.kill(false);
      const gain = CM.MERIT.killPet * rewardMul;
      G.getData().merit = Math.min(G.meritCap(), G.getData().merit + gain);
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
    if (CM.Sprites.has('ghost')) return GM._drawSprite(ctx);
    // 立绘未加载时的矢量兜底：半透明白雾
    for (let i = 0; i < GM._list.length; i++) {
      const h = GM._list[i];
      const s = h.size;
      const wob = Math.sin(h.wob) * 2;
      ctx.save();
      ctx.translate(h.x, h.y);
      ctx.globalAlpha = 0.82;
      const grad = ctx.createRadialGradient(0, -s * 0.15, s * 0.1, 0, s * 0.2, s);
      grad.addColorStop(0, h.petGhost != null ? 'rgba(179,157,255,0.5)' : h.cyber ? 'rgba(160,255,225,0.5)' : 'rgba(235,235,255,0.5)');
      grad.addColorStop(1, 'rgba(120,120,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.moveTo(0, s * 0.85);
      ctx.quadraticCurveTo(-s * 0.7 + wob, s * 0.2, -s * 0.55, -s * 0.3);
      ctx.quadraticCurveTo(-s * 0.3, -s * 0.72, 0, -s * 0.55);
      ctx.quadraticCurveTo(s * 0.3, -s * 0.72, s * 0.55, -s * 0.3);
      ctx.quadraticCurveTo(s * 0.7 + wob, s * 0.2, 0, s * 0.85);
      ctx.fill();
      ctx.globalAlpha = 0.85;
      ctx.fillStyle = '#fff';
      for (let j = 0; j < 2; j++) {
        ctx.beginPath();
        ctx.ellipse(j === 0 ? -6 : 6, -s * 0.12, 4, 5.5 + Math.sin(h.wob * 1.3) * 1.2, 0, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  };

  // ===== 立绘渲染：按等级染色 + 赛博化电路光 =====
  const TIER_FILTERS = [
    null,
    null,                                            // 1 孤魂 原色（银发蓝焰女仆）
    'saturate(1.3) brightness(1.03)',                // 2 野鬼
    'hue-rotate(55deg) saturate(1.35)',              // 3 厉鬼 桃粉
    'hue-rotate(100deg) saturate(1.4) brightness(1.05)', // 4 鬼将 橙红
    'hue-rotate(150deg) saturate(1.45)',             // 5 鬼仙 紫
    'hue-rotate(195deg) saturate(1.5) brightness(1.05)', // 6 鬼王
    'hue-rotate(245deg) saturate(1.55)',             // 7 判官 品红
    'hue-rotate(295deg) saturate(1.6) brightness(1.1)',  // 8 阎罗
    'hue-rotate(335deg) saturate(1.6) brightness(1.15)' // 9 鬼佛 鎏金
  ];
  const CYBER_ADD = ' saturate(1.4) brightness(1.12) hue-rotate(-18deg)';
  const PET_FILTER = 'grayscale(0.35) hue-rotate(230deg) brightness(1.08)';

  GM._ghostFilter = function (h) {
    if (h.petGhost != null) return PET_FILTER;
    const base = TIER_FILTERS[h.tier] || null;
    if (h.cyber) return (base ? base + CYBER_ADD : CYBER_ADD.trim());
    return base;
  };

  // 出战立绘：拥有对应等级鬼物皮肤时用皮肤立绘，否则原皮
  GM._ghostSpriteKey = function (h) {
    if (h.petGhost != null) return h.petGhost === 0 ? 'cat' : 'parrot';
    if (CM.GameState.ghostSkinOwned(h.tier)) return 'ghost_skin';
    return 'ghost';
  };

  GM._drawSprite = function (ctx) {
    const Sp = CM.Sprites;
    for (let i = 0; i < GM._list.length; i++) {
      const h = GM._list[i];
      const s = h.size;
      const wob = Math.sin(h.wob) * 2.4;
      const x = h.x + wob;
      const deep = h.tier >= 7;              // 高层鬼物更突出
      // 立绘放大：看清细节；精英再乘体型倍率
      const w = s * (2.3 + (deep ? 0.6 : 0)) * (h.elite ? 1.15 : 1);
      const spr = Sp.variant(GM._ghostSpriteKey(h), GM._ghostFilter(h));
      if (!spr) continue;
      const ratio = spr.height / spr.width;
      const hh = w * ratio;

      // 光晕（精英为血色）
      ctx.save();
      ctx.translate(x, h.y + hh * 0.06);
      const glowC = h.elite ? '#ff2b2b' : (h.cyber ? CM.GHOST.cyberTint : h.glow);
      ctx.globalAlpha = h.elite ? 0.5 : 0.32 + (h.cyber ? 0.15 : 0);
      ctx.shadowColor = glowC;
      ctx.shadowBlur = h.elite ? 30 : 22;
      ctx.fillStyle = glowC;
      ctx.beginPath(); ctx.arc(0, 0, w * 0.55, 0, Math.PI * 2); ctx.fill();
      ctx.shadowBlur = 0;
      ctx.globalAlpha = 1;

      // 精英：血色环绕（旋转血雾粒子环）
      if (h.elite) {
        ctx.globalAlpha = 0.65;
        const t = Date.now() / 420;
        for (let j = 0; j < 9; j++) {
          const a = t + (j / 9) * Math.PI * 2;
          const rx = Math.cos(a) * w * 0.62;
          const ry = Math.sin(a) * w * 0.30 - hh * 0.1;
          ctx.fillStyle = j % 2 ? '#ff3b3b' : '#a01010';
          ctx.beginPath(); ctx.arc(rx, ry, 3.4 + Math.sin(t * 2 + j) * 1.2, 0, Math.PI * 2); ctx.fill();
        }
        ctx.globalAlpha = 1;
      }

      // 立绘本体
      ctx.drawImage(spr, -w / 2, -hh * 0.5, w, hh);

      // 赛博化：青绿电路光覆盖
      if (h.cyber) {
        ctx.globalAlpha = 0.75;
        ctx.strokeStyle = CYBER_TINT;
        ctx.lineWidth = 1.6;
        ctx.shadowColor = CYBER_TINT;
        ctx.shadowBlur = 6;
        ctx.beginPath();
        for (let j = 0; j < 3; j++) {
          const yy = -hh * 0.2 + j * hh * 0.22;
          ctx.moveTo(-w * 0.34 + wob * 0.3, yy);
          ctx.lineTo(-w * 0.12, yy);
          ctx.lineTo(-w * 0.02, yy - 7);
          ctx.moveTo(-w * 0.02, yy);
          ctx.lineTo(w * 0.14, yy);
          ctx.lineTo(w * 0.24, yy - 5);
        }
        ctx.stroke();
        ctx.shadowBlur = 0;
      }

      // 受伤闪白
      if (h._flash) {
        h._flash -= 1 / 60;
        ctx.globalAlpha = Math.max(0, h._flash * 7);
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(0, 0, w * 0.6, 0, Math.PI * 2); ctx.fill();
      }

      // 血条（精英为红色边框+冠字）
      if (h.hp < h.maxHp) {
        ctx.globalAlpha = 0.88;
        ctx.fillStyle = 'rgba(0,0,0,0.5)';
        ctx.fillRect(-w * 0.45, -hh * 0.56, w * 0.9, 5);
        ctx.fillStyle = h.elite ? '#ff3b3b' : (h.cyber ? CYBER_TINT : h.glow);
        ctx.fillRect(-w * 0.45, -hh * 0.56, w * 0.9 * Math.max(0, h.hp / h.maxHp), 5);
        if (h.elite) {
          ctx.globalAlpha = 0.95;
          ctx.font = 'bold 12px "PingFang SC","Microsoft YaHei",sans-serif';
          ctx.textAlign = 'center';
          ctx.fillStyle = '#ff3b3b';
          ctx.shadowColor = '#ff3b3b';
          ctx.shadowBlur = 6;
          ctx.fillText('精英', 0, -hh * 0.56 - 6);
          ctx.shadowBlur = 0;
        }
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }
  };
  const CYBER_TINT = CM.GHOST.cyberTint;

  CM.GhostManager = GM;
})(typeof window !== 'undefined' ? window : this);