/* ============================================================
 * PetSystem · 猫 / 鹦鹉 / 友方鬼灵（灵魂归顺）
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;
  const G = CM.GameState;
  const GM = CM.GhostManager;

  const PS = { _souls: [], _time: 0, _cd: {} };

  PS.addSoul = function (x, y) {
    if (PS._souls.length >= 14) return;
    PS._souls.push({
      x: x, y: y,
      tx: CM.SHIELD.cx + (Math.random() - 0.5) * 120,
      ty: CM.SHIELD.baseY - 60 + (Math.random() - 0.5) * 90,
      phase: Math.random() * Math.PI * 2,
      atkT: 1.2, ttl: 60
    });
  };
  PS.clearSouls = function () { PS._souls = []; };   // 升级消散

  // 宠物攻击（猫+鹦鹉）：冷却跨帧持久
  function petAttack(id, x, y, dps, cd, range, atkCb) {
    let c = (PS._cd[id] || 0);
    if (c > 0) { PS._cd[id] = c - PS._dt; return; }
    const target = GM.nearest(x, y, range);
    if (!target) { PS._cd[id] = 0.25; return; }
    PS._cd[id] = cd;
    GM.hurt(target, dps * cd, 'pet', target.x, target.y);
    if (atkCb) atkCb(target);
  }

  PS.update = function (dt, muyuLevel) {
    PS._time += dt;
    PS._dt = dt;

    // 猫：平台两侧，存活即可自动索敌攻击
    for (let i = 0; i < CM.PETS.cats.length; i++) {
      const pc = CM.PETS.cats[i];
      if (!G.petAlive(pc.id)) continue;
      const pos = CM.PET_SPOTS[pc.id === 'cat1' ? 'cat1' : 'cat2'];
      petAttack(pc.id, pos.x, pos.y,
        CM.PETS.catDps * (0.85 + muyuLevel * 0.10),
        CM.PETS.catAtkCD, CM.PETS.catRange,
        function (t) {
          CM.Fx.bolt(pos.x, pos.y, t.x, t.y - 24, 0.18, CM.COLORS.gold, 5);
        });
    }

    // 鹦鹉：随木鱼等级解锁，绕玩家头顶环形飞行
    for (let i = 0; i < CM.PETS.parrots.length; i++) {
      const pp = CM.PETS.parrots[i];
      const id = pp.id;
      const on = G.petAlive(id) && muyuLevel >= pp.level;
      if (!on) continue;
      const ang = PS._time * 1.4 + i * Math.PI / 2;
      const px = CM.SHIELD.cx + Math.cos(ang) * 54;
      const py = 556 + Math.sin(ang * 0.8) * 26 - 8;
      petAttack(id, px, py,
        CM.PETS.parrotDps * (0.9 + muyuLevel * 0.08),
        CM.PETS.parrotAtkCD, CM.PETS.parrotRange,
        function (t) {
          CM.Fx.bolt(px, py, t.x, t.y - 20, 0.16, CM.COLORS.cyan, 4);
          CM.Audio.spark();
        });
    }

    // 友方鬼灵：飘向罩内并攻击鬼物
    for (let i = PS._souls.length - 1; i >= 0; i--) {
      const s = PS._souls[i];
      s.ttl -= dt;
      s.atkT -= dt;
      if (s.ttl <= 0) { PS._souls.splice(i, 1); continue; }
      // 归位漂移
      s.x += (s.tx - s.x) * 1.6 * dt;
      s.y += (s.ty - s.y) * 1.6 * dt;
      s.phase += dt * 2.4;
      s.y += Math.sin(s.phase) * 0.5;
      if (s.atkT <= 0) {
        s.atkT = CM.PETS.soulAtkCD;
        const t2 = GM.nearest(s.x, s.y, CM.PETS.soulRange);
        if (t2) {
          GM.hurt(t2, CM.PETS.soulDps * CM.PETS.soulAtkCD * (0.9 + muyuLevel * 0.06), 'soul', t2.x, t2.y);
          CM.Fx.bolt(s.x, s.y, t2.x, t2.y - 18, 0.12, '#8dffe0', 3);
        }
      }
    }
  };

  // 谁在罩内：返回存活宠物坐标集合（供替死逻辑使用）
  PS.living = function () {
    const d = G.getData();
    return {
      parrots: CM.PETS.parrots.filter(function (p) { return d.petAlive[p.id]; }),
      cats: CM.PETS.cats.filter(function (c) { return d.petAlive[c.id]; })
    };
  };

  PS.draw = function (ctx, muyuLevel) {
    const cyber = Math.min(1, (muyuLevel - 1) / 8);   // 赛博改造度 0~1

    // 猫（立绘优先，玩家前方）
    const Sp = CM.Sprites;
    for (let i = 0; i < CM.PETS.cats.length; i++) {
      const pc = CM.PETS.cats[i];
      if (!G.petAlive(pc.id)) continue;
      const spot = CM.PET_SPOTS[pc.id === 'cat1' ? 'cat1' : 'cat2'];
      const x = spot.x, y = spot.y + Math.sin(PS._time * 3 + i) * 2;
      const key = i === 0 ? 'cat' : 'cat2';
      if (Sp.has(key)) {
        const bob = Math.sin(PS._time * 4 + i) * 1.5;
        Sp.draw(ctx, key, x, y + bob, { w: 72, alpha: 1 });
        // 赛博改造度光效
        if (cyber > 0.25 && Sp.has(key)) {
          Sp.draw(ctx, key, x, y + bob, { w: 72, v: 'saturate(1.4) brightness(1.12)', alpha: cyber * 0.8 });
        }
      } else {
        // 兜底矢量造型
        const flip = i === 0 ? -1 : 1;
        ctx.save(); ctx.translate(x, y);
        ctx.fillStyle = i === 0 ? '#f5e6c8' : '#cfd8e3';
        ctx.beginPath(); ctx.ellipse(0, 6, 24, 17, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(flip * 11, -7, 13, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.moveTo(flip * 1, -19); ctx.lineTo(flip * 6, -31); ctx.lineTo(flip * 12, -17); ctx.fill();
        ctx.fillStyle = '#2e2410';
        ctx.beginPath(); ctx.arc(flip * 14, -10, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(flip * 7, -10, 2.8, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // 鹦鹉（绕玩家头顶飞，立绘优先）
    for (let i = 0; i < CM.PETS.parrots.length; i++) {
      const pp = CM.PETS.parrots[i];
      if (!G.petAlive(pp.id) || muyuLevel < pp.level) continue;
      const ang = PS._time * 1.4 + i * Math.PI / 2;
      const x = CM.SHIELD.cx + Math.cos(ang) * 54;
      const y = 556 + Math.sin(ang * 0.8) * 26 - 8;
      if (Sp.has('parrot')) {
        const flap = Math.sin(PS._time * 12 + i * 2) * 12;
        Sp.draw(ctx, 'parrot', x, y + flap * 0.3, {
          w: 44,
          flip: Math.cos(ang) < 0,
          v: 'saturate(1.25) brightness(1.05)'
        });
      } else {
        const flap = Math.sin(PS._time * 12 + i * 2) * 5;
        ctx.save(); ctx.translate(x, y);
        ctx.scale(Math.cos(ang) > 0 ? 1 : -1, 1);
        ctx.fillStyle = i % 2 ? '#ff6a9a' : '#ff2bd6';
        ctx.beginPath(); ctx.ellipse(0, 2, 10, 14, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#8dffe0';
        ctx.beginPath(); ctx.moveTo(-2, 0); ctx.quadraticCurveTo(-16, -9 - flap, -11, 4); ctx.quadraticCurveTo(-8, -2, -2, 0); ctx.fill();
        ctx.fillStyle = i % 2 ? '#ff2bd6' : '#ff6a9a';
        ctx.beginPath(); ctx.arc(0, -12, 8, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = CM.COLORS.gold;
        ctx.beginPath(); ctx.moveTo(4, -14); ctx.lineTo(13, -12); ctx.lineTo(4, -10); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(3, -14, 2.6, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
      }
    }

    // 友方鬼灵（发光小魂体）
    for (let i = 0; i < PS._souls.length; i++) {
      const s = PS._souls[i];
      const pulse = 0.6 + Math.sin(s.phase) * 0.3;
      ctx.save();
      ctx.translate(s.x, s.y + Math.sin(s.phase) * 3);
      ctx.shadowColor = CM.COLORS.soul;
      ctx.shadowBlur = 10;
      ctx.globalAlpha = Math.min(1, s.ttl / 1.5);
      ctx.fillStyle = CM.COLORS.soul;
      ctx.beginPath(); ctx.arc(0, 0, 4.5 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha = 1; ctx.shadowBlur = 0;
      ctx.restore();
    }
  };

  CM.PetSystem = PS;
})(typeof window !== 'undefined' ? window : this);