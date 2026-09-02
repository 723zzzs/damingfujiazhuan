/* ============================================================
 * ShieldSystem · 半圆金钟罩（金光亮度随功德，碰撞裂痕）
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;
  const G = CM.GameState;

  const SH = { broken: false, _cracks: [] };

  // 鬼物啃罩：扣除功德
  SH.drain = function (dmg) {
    const d = G.getData();
    d.merit = Math.max(0, d.merit - dmg);
    return d.merit;
  };

  // 罩强度比例（0~1）
  SH.ratio = function () {
    return Math.max(0, Math.min(1, G.getData().merit / G.meritCap()));
  };

  // 表面上某 x 处的罩面高度
  SH.surfaceY = function (x) {
    const dx = x - CM.SHIELD.cx;
    if (Math.abs(dx) > CM.SHIELD.r) return CM.SHIELD.baseY;
    return CM.SHIELD.baseY - Math.sqrt(Math.max(0, CM.SHIELD.r * CM.SHIELD.r - dx * dx));
  };

  // 碰撞点生成裂痕（每条裂痕由中心向四周放射的 4~6 道裂纹组成）
  SH.addCrack = function (x, y) {
    if (SH._cracks.length >= CM.SHIELD.crackMax) SH._cracks.shift();
    const lines = [];
    const n = 4 + Math.floor(Math.random() * 3);
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * 2;
      lines.push({
        x1: 0, y1: 0,
        x2: Math.cos(a) * (14 + Math.random() * 22),
        y2: Math.sin(a) * (14 + Math.random() * 22),
        bx: Math.cos(a + 0.5) * 22, by: Math.sin(a + 0.5) * 22
      });
    }
    SH._cracks.push({ x: x, y: y, lines: lines, life: 1, max: 1, fade: 0.0016 + Math.random() * 0.001 });
  };

  SH.update = function (dt) {
    for (let i = SH._cracks.length - 1; i >= 0; i--) {
      const c = SH._cracks[i];
      c.life -= c.fade;
      if (c.life <= 0) { SH._cracks.splice(i, 1); }
    }
    // 罩破损时旧裂痕逐渐消退
    if (SH.broken) SH._cracks = [];
  };

  SH.draw = function (ctx) {
    const ratio = SH.ratio();
    if (ratio <= 0 && SH.broken) return;

    const cx = CM.SHIELD.cx, baseY = CM.SHIELD.baseY, r = CM.SHIELD.r;

    ctx.save();

    // 内部暖光：亮度随功德，上限 glowMax（不遮人物）
    const glow = 0.08 + ratio * (CM.SHIELD.glowMax - 0.08);
    const grad = ctx.createRadialGradient(cx, baseY - r * 0.55, r * 0.1, cx, baseY - r * 0.5, r);
    grad.addColorStop(0, 'rgba(255,220,120,' + glow + ')');
    grad.addColorStop(0.75, 'rgba(255,180,80,' + glow * 0.7 + ')');
    grad.addColorStop(1, 'rgba(255,140,40,' + glow * 0.35 + ')');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, baseY, r, Math.PI, 0);   // 上半圆
    ctx.lineTo(cx + r, baseY);
    ctx.lineTo(cx - r, baseY);
    ctx.closePath();
    ctx.fill();

    // 钟罩边缘光（弧 + 两侧直边）
    ctx.strokeStyle = 'rgba(255,215,94,' + (0.30 + ratio * 0.45) + ')';
    ctx.lineWidth = 2.5 + ratio * 2;
    ctx.shadowColor = CM.COLORS.gold;
    ctx.shadowBlur = 12 + ratio * 14;
    ctx.beginPath(); ctx.arc(cx, baseY, r, Math.PI, 0); ctx.stroke();
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(cx - r, baseY); ctx.lineTo(cx - r, baseY - 4);
    ctx.moveTo(cx + r, baseY); ctx.lineTo(cx + r, baseY - 4);
    ctx.stroke();
    ctx.shadowBlur = 0;

    // 内圈细纹
    ctx.strokeStyle = 'rgba(255,240,180,' + (0.12 + ratio * 0.18) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, baseY, r * 0.88, Math.PI, 0); ctx.stroke();

    // 罩顶上升光柱（弱）
    const beam = ctx.createLinearGradient(cx, baseY - r, cx, baseY - r - 56);
    beam.addColorStop(0, 'rgba(255,215,94,' + (0.10 + ratio * 0.15) + ')');
    beam.addColorStop(1, 'rgba(255,215,94,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(cx - 13, baseY - r - 56, 26, 56);

    ctx.restore();

    // 裂痕（画在罩体之上）
    for (let i = 0; i < SH._cracks.length; i++) {
      const c = SH._cracks[i];
      ctx.save();
      ctx.translate(c.x, c.y);
      ctx.globalAlpha = Math.min(1, c.life * 1.2);
      ctx.strokeStyle = 'rgba(255,255,255,0.88)';
      ctx.lineWidth = 1.5;
      ctx.shadowColor = '#ffffff';
      ctx.shadowBlur = 5;
      for (let j = 0; j < c.lines.length; j++) {
        const L = c.lines[j];
        ctx.beginPath();
        ctx.moveTo(L.x1, L.y1);
        ctx.quadraticCurveTo(L.bx, L.by, L.x2, L.y2);
        ctx.stroke();
      }
      // 碰撞高光点
      ctx.fillStyle = 'rgba(255,240,200,0.9)';
      ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  };

  CM.ShieldSystem = SH;
})(typeof window !== 'undefined' ? window : this);