/* ============================================================
 * HUD · 顶部功德条（Canvas）+ 面板（DOM：图鉴/皮肤/签到/广告/结算）
 * ============================================================ */
(function (global) {
  'use strict';
  const CM = global.CM;
  const G = CM.GameState;

  const HUD = { root: null, _adOpen: false };

  // ---------- Canvas 绘制：顶部功德条 ----------
  HUD.drawBar = function (ctx) {
    const W = CM.VIEW.W;
    const d = G.getData();
    const ratio = G.meritCap() > 0 ? d.merit / G.meritCap() : 0;

    ctx.save();
    // 底板
    ctx.fillStyle = 'rgba(6,10,22,0.72)';
    ctx.strokeStyle = 'rgba(0,240,255,0.55)';
    ctx.lineWidth = 1.2;
    roundRect(ctx, 16, 16, W - 32, 26, 6);
    ctx.fill(); ctx.stroke();

    // 分段容量刻度
    const segs = 10;
    for (let i = 1; i < segs; i++) {
      const x = 16 + (W - 32) * (i / segs);
      ctx.strokeStyle = 'rgba(0,240,255,0.22)';
      ctx.beginPath(); ctx.moveTo(x, 20); ctx.lineTo(x, 38); ctx.stroke();
    }
    // 金条
    const bw = (W - 32) * Math.min(1, ratio);
    if (bw > 2) {
      const gold = ctx.createLinearGradient(16, 0, W - 16, 0);
      gold.addColorStop(0, '#ffb03a');
      gold.addColorStop(0.7, '#ffd75e');
      gold.addColorStop(1, '#fff3c4');
      ctx.fillStyle = gold;
      ctx.shadowColor = CM.COLORS.gold;
      ctx.shadowBlur = 8;
      roundRect(ctx, 17, 17, Math.max(3, bw - 2), 24, 4);
      ctx.fill();
      ctx.shadowBlur = 0;
      // 电流描边
      ctx.strokeStyle = 'rgba(255,255,255,0.7)';
      ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(17, 17 + Math.sin(Date.now() / 90) * 2 + 8);
      ctx.lineTo(18 + bw * 0.3, 17 + Math.sin(Date.now() / 70) * 3 + 10);
      ctx.lineTo(18 + bw * 0.7, 17 + Math.sin(Date.now() / 100) * 2 + 7);
      ctx.lineTo(18 + bw, 17 + Math.sin(Date.now() / 60) * 2 + 9);
      ctx.stroke();
    }

    // 文本：等级 + 功德值
    ctx.textAlign = 'left';
    ctx.font = 'bold 13px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillStyle = '#eaffff';
    ctx.shadowColor = CM.COLORS.cyan;
    ctx.shadowBlur = 5;
    ctx.fillText('木鱼 LV ' + d.muyuLevel, 22, 60);
    ctx.textAlign = 'right';
    ctx.fillStyle = CM.COLORS.gold;
    ctx.shadowColor = CM.COLORS.gold;
    ctx.fillText(Math.floor(d.merit) + ' / ' + G.meritCap(), W - 22, 60);
    ctx.shadowBlur = 0;

    // 当前鬼物等级
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffd0e8';
    ctx.shadowColor = CM.COLORS.pink;
    ctx.font = 'bold 12px "PingFang SC","Microsoft YaHei",sans-serif';
    ctx.fillText('鬼物 · ' + ghostBossName(), 22, 80);
    ctx.shadowBlur = 0;
    ctx.restore();
  };

  function ghostBossName() {
    const lv = Math.min(9, G.getData().muyuLevel);
    const nm = CM.GHOST.tiers[lv - 1].name;
    return (G.getData().cycle > 1 && lv >= 9) ? '赛博' + nm : nm;
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

  // ---------- DOM 面板 ----------
  HUD.init = function (root) {
    HUD.root = root;
    root.innerHTML =
      '<div id="topBtns">' +
      '  <button data-panel="pokedex">图鉴</button>' +
      '  <button data-panel="skins">皮肤</button>' +
      '  <button data-panel="checkin" id="checkinBtn">签到</button>' +
      '</div>' +
      '<div id="modal" class="hidden"></div>';
    root.querySelector('#topBtns').addEventListener('click', function (e) {
      const b = e.target.closest('button');
      if (!b) return;
      CM.Audio.ui();
      const p = b.getAttribute('data-panel');
      if (p === 'checkin') HUD.openCheckin();
      else if (p === 'pokedex') HUD.openPokedex();
      else if (p === 'skins') HUD.openSkins();
    });
    // 收藏页刷新
    HUD.refreshCheckinBtn();
  };

  HUD.refreshCheckinBtn = function () {
    const b = HUD.root && HUD.root.querySelector('#checkinBtn');
    if (!b) return;
    b.textContent = G.canCheckin() ? '签到★' : '签到×' + G.getData().checkinStreak;
  };

  HUD._open = function (html) {
    const m = HUD.root.querySelector('#modal');
    m.innerHTML = html;
    m.classList.remove('hidden');
  };
  HUD._close = function () {
    const m = HUD.root.querySelector('#modal');
    m.classList.add('hidden');
  };
  HUD._bind = function (sel, fn) {
    const m = HUD.root.querySelector('#modal');
    const el = m.querySelector(sel);
    if (el) el.addEventListener('click', fn);
  };
  HUD._bindAll = function (sel, fn) {
    const m = HUD.root.querySelector('#modal');
    const els = m.querySelectorAll(sel);
    for (let i = 0; i < els.length; i++) els[i].addEventListener('click', fn);
  };
  HUD.toast = function (msg, dur) {
    let t = HUD.root.querySelector('#toast');
    if (!t) { t = document.createElement('div'); t.id = 'toast'; HUD.root.appendChild(t); }
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(HUD._toastT);
    HUD._toastT = setTimeout(function () { t.classList.remove('show'); }, dur || 2200);
  };

  // ---------- 性别选择 ----------
  HUD.showGender = function (cb) {
    HUD._open(
      '<div class="panel title-panel"><h2>赛博木鱼</h2><p class="sub">选择你留在金光罩内的形象</p>' +
      '<div class="row"><button class="big gender" data-g="f">♀ 长发·粉色卫衣</button>' +
      '<button class="big gender" data-g="m">♂ 短发·青色夹克</button></div>' +
      '<p class="hint">随时可在小程序设置中修改</p></div>'
    );
    HUD._bindAll('.gender', function (e) {
      const g = e.target.getAttribute('data-g');
      CM.Audio.ui();
      HUD._close();
      cb(g);
    });
  };

  // ---------- 离线结算 ----------
  HUD.showOffline = function (pen) {
    const lost = pen.levelLosts && pen.levelLosts.length ? '木鱼等级 -' + pen.levelLosts.length + ' 级' : '等级未变';
    HUD._open(
      '<div class="panel"><h2 style="color:#ff9d5e">离线结算</h2>' +
      '<p class="sub">离线 ' + pen.hours + ' 小时</p>' +
      '<p>功德 -' + pen.lostMerit + (pen.floorLocked ? '（功德锁死保留 1 点）' : '') + '</p>' +
      '<p>' + lost + '</p>' +
      '<button class="big" id="okOffline">回来了，开始敲</button></div>'
    );
    HUD._bind('#okOffline', function () { CM.Audio.ui(); HUD._close(); });
  };

  // ---------- 结算 / 重开 / 广告复活 ----------
  HUD.showSettle = function (stats, cbRevive, cbRestart) {
    HUD._open(
      '<div class="panel"><h2 style="color:#ff2bd6">金光消散</h2>' +
      '<p class="sub">六位伙伴用生命护住了你</p>' +
      '<p>本局功德 <b>' + stats.merit + '</b>　击杀 <b>' + stats.kills + '</b>　木鱼 <b>LV ' + stats.level + '</b></p>' +
      '<p class="sub" style="color:#b39dff">猫鬼 / 鹦鹉鬼 已加入鬼物图鉴</p>' +
      '<div class="row"><button class="big hot" id="adRevive">▶ 看广告复活伙伴</button>' +
      '<button class="big" id="restart">重开（保留图鉴）</button></div></div>'
    );
    HUD._bind('#adRevive', function () {
      HUD._close();
      HUD.watchAd('复活全部伙伴', cbRevive);
    });
    HUD._bind('#restart', function () { CM.Audio.ui(); HUD._close(); cbRestart(); });
  };

  // ---------- 广告模拟 ----------
  HUD.watchAd = function (label, cb) {
    if (HUD._adOpen) return;
    HUD._adOpen = true;
    let left = CM.AD.mockSeconds;
    HUD._open(
      '<div class="panel ad-panel"><h2 style="color:#00f0ff">『模拟激励视频』</h2>' +
      '<p class="sub">' + label + ' · 发布版将替换为抖音广告</p>' +
      '<div class="ad-count" id="adCount">' + left + '</div>' +
      '<p class="hint">倒计时结束后自动发放奖励</p></div>'
    );
    const iv = setInterval(function () {
      left--;
      const el = HUD.root.querySelector('#adCount');
      if (el) el.textContent = left;
      if (left <= 0) {
        clearInterval(iv);
        HUD._adOpen = false;
        HUD._close();
        CM.Audio.reward();
        cb();
      }
    }, 1000);
  };

  // ---------- 图鉴 ----------
  HUD.openPokedex = function () {
    const items = [];
    // 9 级鬼物：基础 + 赛博形态
    for (let t = 1; t <= 9; t++) {
      items.push(pokemonCell(t, false));
      items.push(pokemonCell(t, true));
    }
    // 宠物亡灵
    items.push(petCell('cat'));
    items.push(petCell('parrot'));
    // 鬼物皮肤 9 级
    for (let t = 1; t <= 9; t++) {
      items.push(skinCell(t));
    }
    HUD._open(
      '<div class="panel wide"><h2>鬼物图鉴</h2><div class="grid">' + items.join('') + '</div>' +
      '<button class="big" id="closePokedex">收起来</button></div>'
    );
    HUD._bind('#closePokedex', function () { CM.Audio.ui(); HUD._close(); });
  };

  function pokemonCell(tier, cyber) {
    const owned = G.isCollected(tier, cyber, null);
    const cfg = CM.GHOST.tiers[tier - 1];
    const name = (cyber ? '赛博·' : '') + cfg.name;
    return cellHtml(owned, cfg.glow, name, tier + (cyber ? 'c' : ''));
  }
  function petCell(key) {
    const idx = key === 'cat' ? 0 : 1;
    const cfg = CM.GHOST.petGhost[idx];
    const owned = G.isCollected(null, null, key);
    return cellHtml(owned, cfg.glow, cfg.name, 'pet' + key);
  }
  function skinCell(tier) {
    const cfg = CM.GHOST.tiers[tier - 1];
    const owned = G.ghostSkinOwned(tier);
    const tint = owned ? cfg.glow : '#000';
    const label = '皮肤·' + cfg.name + (owned ? '' : '(未拥有)');
    return cellHtml(owned, tint, label, 'skin' + tier, true);
  }
  function cellHtml(owned, color, label, key, skin) {
    const blob = skin
      ? '<div class="blob skin" style="background:' + (owned ? color : 'radial-gradient(circle at 35% 30%, #222, #000)') + '"></div>'
      : '<div class="blob" style="background:radial-gradient(circle at 35% 30%, ' + (owned ? color : '#222, #000') + ')"></div>';
    return '<div class="cell' + (owned ? '' : ' dim') + '">' + blob + '<span>' + label + '</span></div>';
  }

  // ---------- 皮肤 ----------
  HUD.openSkins = function () {
    const d = G.getData();
    const wood = [];
    for (let i = 0; i < CM.SKIN.woodPool.length; i++) {
      const sk = CM.SKIN.woodPool[i];
      const have = G.woodUnlocked(i);
      const active = d.woodActive === i;
      wood.push(
        '<div class="cell' + (have ? '' : ' dim') + '" data-wood="' + i + '">' +
        '<div class="blob" style="background:radial-gradient(circle at 35% 30%, ' + (have ? sk.seam : '#222, #000') + ')"></div>' +
        '<span>' + sk.name + (active ? ' ✅' : '') + (have ? '' : ' 未解锁') + '</span></div>'
      );
    }
    const ghost = [];
    const n = d.adWatchCount;
    for (let t = 1; t <= 9; t++) {
      const s = G.ghostSkin(t);
      const perm = s.permanent;
      const trial = !!s.trialUntil && s.trialUntil > Date.now() && !perm;
      const tint = perm || trial ? CM.GHOST.tiers[t - 1].glow : '#000';
      const needsAds = CM.SKIN.ghostPermanentAds * t;
      ghost.push(
        '<div class="cell' + (perm || trial ? '' : ' dim') + '">' +
        '<div class="blob" style="background:radial-gradient(circle at 35% 30%, ' + tint + ')"></div>' +
        '<span>鬼皮·' + CM.GHOST.tiers[t - 1].name +
        (perm ? ' 永久' : trial ? ' 试用中' : ' 广告' + needsAds + '/' + t + '天签') + '</span></div>'
      );
    }
    HUD._open(
      '<div class="panel wide"><h2>皮肤</h2>' +
      '<p class="sub">木鱼皮肤 · 点击启用</p><div class="grid">' + wood.join('') + '</div>' +
      '<p class="sub">鬼物皮肤 · 已观看广告 <b>' + n + '</b> 次 / 连签 <b>' + d.checkinStreak + '</b> 天</p>' +
      '<div class="grid">' + ghost.join('') + '</div>' +
      '<div class="row">' +
      '<button class="big hot" id="watchSkinAd">▶ 看广告（第 ' + (((n) % 9) + 1) + ' 级鬼皮 1 天）</button>' +
      '<button class="big" id="closeSkins">收起来</button></div></div>'
    );
    HUD._bindAll('[data-wood]', function (e) {
      const id = parseInt(e.target.getAttribute('data-wood'), 10);
      if (!G.woodUnlocked(id)) { CM.Audio.ui(); HUD.toast('该皮肤尚未解锁，继续签到领取吧'); return; }
      G.setWoodActive(id);
      CM.Audio.ui();
      HUD.openSkins();
    });
    HUD._bind('#watchSkinAd', function () {
      HUD._close();
      HUD.watchAd('鬼物皮肤 · 1 天使用', function () {
        const tier = G.onAdWatched();
        CM.Audio.reward();
        HUD.toast('获得「' + CM.GHOST.tiers[tier - 1].name + '皮肤」1 天使用权');
        HUD.openSkins();
      });
    });
    HUD._bind('#closeSkins', function () { CM.Audio.ui(); HUD._close(); });
  };

  // ---------- 签到 ----------
  HUD.openCheckin = function () {
    const d = G.getData();
    const can = G.canCheckin();
    HUD._open(
      '<div class="panel"><h2>每日签到</h2>' +
      '<p class="sub">累计签到 <b>' + d.checkinDays + '</b> 天 · 连续 <b>' + d.checkinStreak + '</b> 天</p>' +
      '<p>第 1 天领木鱼皮，之后每 3 天领下一个</p>' +
      (can ? '<button class="big hot" id="doCheckin">签到领取</button>' : '<p class="hint">明天再来～</p>') +
      '<button class="big" id="closeCheckin">收起来</button></div>'
    );
    HUD._bind('#doCheckin', function () {
      const newSkin = G.doCheckin();
      CM.Audio.reward();
      HUD.refreshCheckinBtn();
      HUD._close();
      if (newSkin != null) {
        HUD.toast('签到成功！解锁木鱼皮肤「' + CM.SKIN.woodPool[newSkin].name + '」', 3200);
      } else {
        HUD.toast('签到成功，功德伴身');
      }
    });
    HUD._bind('#closeCheckin', function () { CM.Audio.ui(); HUD._close(); });
  };

  // 升级提示
  HUD.levelUpFx = function () { HUD.toast('木鱼升级！' + (G.getData().muyuLevel >= 9 ? '抵达赛博灵山' : '鬼物进化'), 2800); };

  CM.HUD = HUD;
})(typeof window !== 'undefined' ? window : this);