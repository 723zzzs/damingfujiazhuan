/* ============================================================
 * AudioEngine · WebAudio 实时合成音效（零素材）
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;

  const A = { _ctx: null, _master: null, _enabled: true };

  A.init = function () {
    if (A._ctx) { if (A._ctx.state === 'suspended') A._ctx.resume(); return; }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      A._ctx = new AC();
      A._master = A._ctx.createGain();
      A._master.gain.value = 0.5;
      A._master.connect(A._ctx.destination);
    } catch (e) { A._enabled = false; }
  };

  A.setEnabled = function (v) { A._enabled = v; };

  // 简易包络：振荡器 + 噪声
  function tone(freq, type, t0, dur, vol, slideTo) {
    if (!A._ctx) return;
    const t = A._ctx.currentTime + t0;
    const osc = A._ctx.createOscillator();
    const g = A._ctx.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, slideTo), t + dur);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    osc.connect(g); g.connect(A._master);
    osc.start(t); osc.stop(t + dur + 0.05);
  }
  function noise(t0, dur, vol, filterFreq) {
    if (!A._ctx) return;
    const t = A._ctx.currentTime + t0;
    const len = Math.floor(A._ctx.sampleRate * dur);
    const buf = A._ctx.createBuffer(1, len, A._ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    const src = A._ctx.createBufferSource();
    src.buffer = buf;
    const f = A._ctx.createBiquadFilter();
    f.type = 'lowpass'; f.frequency.value = filterFreq || 1200;
    const g = A._ctx.createGain();
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(f); f.connect(g); g.connect(A._master);
    src.start(t);
  }

  // 木鱼"咚"：木质共鸣 + 赛博金属尾音
  A.knock = function () {
    if (!A._enabled) return;
    tone(220, 'triangle', 0, 0.32, 0.55, 120);
    tone(880, 'sine', 0, 0.16, 0.22);
    tone(1760, 'sine', 0.005, 0.1, 0.08);
  };
  // 电弧滋啦
  A.spark = function () {
    if (!A._enabled) return;
    noise(0, 0.12, 0.25, 3800);
    tone(3000, 'sawtooth', 0, 0.08, 0.06, 200);
  };
  // 飘字上行音
  A.up = function () {
    if (!A._enabled) return;
    tone(660, 'sine', 0, 0.09, 0.16);
    tone(990, 'sine', 0.07, 0.1, 0.14);
  };
  // 鬼物死亡：小爆 + 烟花飞升
  A.kill = function (big) {
    if (!A._enabled) return;
    noise(0, 0.25, big ? 0.4 : 0.25, big ? 2600 : 1600);
    tone(140, 'sine', 0, 0.3, 0.3, 60);
    if (big) { tone(880, 'sine', 0.18, 0.5, 0.16); tone(1320, 'sine', 0.26, 0.6, 0.12); }
  };
  // 升级轰鸣
  A.levelUp = function () {
    if (!A._enabled) return;
    tone(392, 'sine', 0, 0.7, 0.35, 784);
    tone(587, 'sine', 0.1, 0.7, 0.28, 1175);
    tone(784, 'sine', 0.2, 0.8, 0.24, 1568);
    noise(0, 0.7, 0.25, 900);
  };
  // 宠物受伤/牺牲
  A.petDown = function () {
    if (!A._enabled) return;
    tone(500, 'triangle', 0, 0.35, 0.3, 180);
    tone(900, 'sine', 0.05, 0.2, 0.12, 300);
  };
  // 失败结算
  A.gameOver = function () {
    if (!A._enabled) return;
    tone(330, 'sawtooth', 0, 0.5, 0.2, 165);
    tone(165, 'sine', 0.1, 0.8, 0.25, 82);
  };
  // 广告完成/奖励
  A.reward = function () {
    if (!A._enabled) return;
    tone(523, 'sine', 0, 0.12, 0.2);
    tone(784, 'sine', 0.1, 0.14, 0.2);
    tone(1046, 'sine', 0.2, 0.3, 0.22);
  };
  // UI 点击
  A.ui = function () {
    if (!A._enabled) return;
    tone(1200, 'sine', 0, 0.05, 0.1);
  };

  CM.Audio = A;
})(typeof window !== 'undefined' ? window : this);