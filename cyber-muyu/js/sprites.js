/* ============================================================
 * Sprites · AI 立绘资源：纯黑底抠除 + 右下角水印裁剪 + 染色变体
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;

  // 资源表：key -> 路径
  const SRCS = [
    { key: 'muyu',   path: 'assets/sprites/spr_muyu.jpg' },
    { key: 'ghost',  path: 'assets/sprites/spr_ghost_base.jpg' },   // 原皮幽灵（简洁）
    { key: 'ghost_skin', path: 'assets/sprites/spr_ghost.jpg' },    // 孤魂皮肤（女仆提灯）
    { key: 'cat',    path: 'assets/sprites/spr_cat.jpg' },
    { key: 'cat2',   path: 'assets/sprites/spr_cat2.jpg' },
    { key: 'parrot', path: 'assets/sprites/spr_parrot.jpg' }
  ];

  const S = { _imgs: {}, _variants: {}, _ready: {}, _failed: {} };

  // ---- 抠底：黑像素透明化，右下角水印区裁剪 ----
  function keySprite(img) {
    const w = img.width, h = img.height;
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    const cx = c.getContext('2d');
    cx.drawImage(img, 0, 0);
    let data;
    try { data = cx.getImageData(0, 0, w, h); } catch (e) {
      // 跨域/file:// 等限制：无法抠底，标记失败走矢量兜底
      throw e;
    }
    const px = data.data;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i = (y * w + x) * 4;
        // 水印裁剪：右下角 8%
        if (x > w * 0.92 && y > h * 0.86) { px[i + 3] = 0; continue; }
        const lum = 0.299 * px[i] + 0.587 * px[i + 1] + 0.114 * px[i + 2];
        if (lum < 46) {
          px[i + 3] = 0;                    // 黑底挖空
        } else if (lum < 74) {
          px[i + 3] = Math.round(((lum - 46) / 28) * 0.45) * 255;  // 柔边半透明
        }
      }
    }
    cx.putImageData(data, 0, 0);
    return c;
  }

  S.preload = function () {
    SRCS.forEach(function (src) {
      const img = new Image();
      img.onload = function () {
        try {
          S._imgs[src.key] = keySprite(img);
          S._ready[src.key] = true;
        } catch (e) {
          S._failed[src.key] = true;   // 安全降级：该资源用矢量兜底
        }
        CM.GameCore && CM.GameCore.onSpritesReady && CM.GameCore.onSpritesReady();
      };
      img.onerror = function () { S._failed[src.key] = true; };
      img.src = src.path;
    });
  };

  S.has = function (key) { return !!S._imgs[key] && !S._failed[key]; };

  // 染色变体（缓存）
  S.variant = function (key, filterStr) {
    const tag = key + '|' + filterStr;
    if (S._variants[tag]) return S._variants[tag];
    const base = S._imgs[key];
    if (!base) return null;
    const c = document.createElement('canvas');
    c.width = base.width; c.height = base.height;
    const cx = c.getContext('2d');
    cx.filter = filterStr || 'none';
    cx.drawImage(base, 0, 0);
    S._variants[tag] = c;
    return c;
  };

  // 尺寸（逻辑像素）
  S.size = function (key, variant) {
    const c = S.variant(key, variant);
    return c ? { w: c.width / 4, h: c.height / 4 } : null;   // 4x 超采样折半，接近屏幕比例
  };

  // 绘制：x,y 中心点；opts = {v(ariant), w, h, flip, alpha, rot}
  S.draw = function (ctx, key, x, y, opts) {
    const o = opts || {};
    const c = S.variant(key, o.v);
    if (!c) return;
    let w = o.w, h = o.h;
    if (!w || !h) {
      const ratio = c.height / c.width;
      w = o.w || 64;
      h = o.h || w * ratio;
    }
    ctx.save();
    ctx.translate(x, y);
    if (o.flip) ctx.scale(-1, 1);
    if (o.rot) ctx.rotate(o.rot);
    ctx.globalAlpha = o.alpha != null ? o.alpha : 1;
    ctx.drawImage(c, -w / 2, -h / 2, w, h);
    ctx.restore();
    ctx.globalAlpha = 1;
  };

  CM.Sprites = S;
})(typeof window !== 'undefined' ? window : this);