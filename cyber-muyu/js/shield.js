/* ============================================================
 * ShieldSystem · 金光罩（强度=功德，被啃食，消失→替死→重开）
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;
  const G = CM.GameState;

  const SH = { broken: false };

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

  SH.draw = function (ctx) {
    const ratio = SH.ratio();
    if (ratio <= 0 && SH.broken) return;   // 罩已破裂不再绘制

    const cx = CM.SHIELD.cx, cy = CM.SHIELD.cy, r = CM.SHIELD.r;
    const baseA = 0.16 + ratio * 0.30;
    ctx.save();
    // 内部暖光
    const grad = ctx.createRadialGradient(cx, cy - r * 0.3, r * 0.15, cx, cy, r);
    grad.addColorStop(0, 'rgba(255,215,94,' + (baseA + 0.08) + ')');
    grad.addColorStop(0.75, 'rgba(255,180,60,' + (baseA * 0.7) + ')');
    grad.addColorStop(1, 'rgba(255,140,40,' + (baseA * 0.35) + ')');
    ctx.fillStyle = grad;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.fill();

    // 环纹 + 边缘光
    ctx.strokeStyle = 'rgba(255,215,94,' + (0.35 + ratio * 0.5) + ')';
    ctx.lineWidth = 2 + ratio * 2;
    ctx.shadowColor = CM.COLORS.gold;
    ctx.shadowBlur = 14 + ratio * 12;
    ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI * 2); ctx.stroke();
    ctx.shadowBlur = 0;
    // 内圈细纹
    ctx.strokeStyle = 'rgba(255,240,180,' + (0.15 + ratio * 0.2) + ')';
    ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, r * 0.86, 0, Math.PI * 2); ctx.stroke();
    // 顶部向上升光柱（弱）
    const beam = ctx.createLinearGradient(cx, cy - r, cx, cy - r - 60);
    beam.addColorStop(0, 'rgba(255,215,94,0.20)');
    beam.addColorStop(1, 'rgba(255,215,94,0)');
    ctx.fillStyle = beam;
    ctx.fillRect(cx - 14, cy - r - 60, 28, 60);
    ctx.restore();
  };

  CM.ShieldSystem = SH;
})(typeof window !== 'undefined' ? window : this);