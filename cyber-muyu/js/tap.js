/* ============================================================
 * TapSystem · 敲击木鱼（功德 / 脉冲 / 电流反馈）
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;
  const G = CM.GameState;
  const GM = CM.GhostManager;
  const Fx = CM.Fx;

  const T = { anm: 0, onKnock: null };   // anm: 敲击下沉动画 0~1

  T.init = function (canvas) {
    let dragging = 0;
    canvas.addEventListener('pointerdown', function (e) {
      e.preventDefault();
      CM.Audio.init();                          // 首次交互解锁音频
      if (typeof canvas.setPointerCapture === 'function') canvas.setPointerCapture(e.pointerId);
      T._knock();
    });
    // 支持触摸快速连点
    canvas.addEventListener('touchstart', function (e) {
      e.preventDefault();
      CM.Audio.init();
    }, { passive: false });
  };

  T._knock = function () {
    const d = G.getData();
    if (T.onKnock && T.onKnock() === false) return;   // core 阻止（如非 play 状态）

    d.merit = Math.min(G.meritCap(), d.merit + G.tapGain());
    T.anm = 1;

    // 反馈：金环 + 电弧 + 功德飘字 + 音效
    Fx.knockFx(CM.MUYU.x, CM.MUYU.y - 30);
    Fx.meritText(CM.MUYU.x, CM.MUYU.y - 84, '+' + G.tapGain());
    CM.Audio.knock();

    // 金光脉冲：以木鱼为中心向上覆盖，攻击范围内的鬼物
    GM.pulseDamage(CM.MUYU.x, CM.MUYU.y - 40, CM.MUYU.pulseRadius, CM.MUYU.pulseDamage);
  };

  T.update = function (dt) {
    if (T.anm > 0) T.anm = Math.max(0, T.anm - dt * 6);
  };

  CM.TapSystem = T;
})(typeof window !== 'undefined' ? window : this);