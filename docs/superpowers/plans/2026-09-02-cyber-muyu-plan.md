# 赛博木鱼 · HTML5 原型实现计划

- 日期：2026-09-02
- 依据：docs/superpowers/specs/2026-09-02-cyber-muyu-design.md
- 交付物：单页 HTML5 可玩原型（零依赖、零构建，file:// 直接打开），后续移植 Cocos Creator 3.x

## 目录结构

```
/workspace/
  cyber-muyu/
    index.html             入口：Canvas 主屏 + HUD 覆盖层（DOM）
    css/cyber.css          赛博风 UI 主题（色板 #0a0e17 / #00f0ff / #ff2bd6 / #ffd75e）
    js/
      core.js              GameCore 主循环 + 竖屏自适应
      state.js             GameState 单一数据源
      save.js              SaveManager 存档 / 离线惩罚
      tap.js               TapSystem 点击木鱼 / 功德
      audio.js             AudioEngine WebAudio 合成音效
      fx.js                FxSystem 粒子（金光圈/电弧/烟花/飘字）
      ghost.js             GhostManager 9 级鬼物 + 赛博进化 + AI
      shield.js            ShieldSystem 金光罩 / 替死 / 重开
      pet.js               PetSystem 猫鹦鹉 / 自动索敌 / 友方鬼灵
      hud.js               HUD 功德条 / 图鉴 / 皮肤 / 签到 / 广告模拟
      config.js            数值配置表（升级曲线、鬼物表、皮肤规则）集中可调
```

## 分阶段实施（每阶段可独立运行验证）

### 阶段 1：骨架 + 主循环
- index.html + canvas 挂载、竖屏自适应（基准 432×768）
- GameCore 主循环（requestAnimationFrame，update/render 分离）
- 基础绘制：背景渐变、木鱼静态造型（Canvas 矢量绘制：机身+电路纹+能量缝）

### 阶段 2：数据与存档
- GameState：木鱼等级/功德/容量/宠物/图鉴/皮肤/签到/广告次数/周目 的单一数据源
- SaveManager：localStorage 自动存档、离线惩罚（每小时消耗功德+掉级、功德锁死 1 点）、存档损坏重置但保留图鉴

### 阶段 3：点击与音效
- TapSystem：木鱼按下/弹起动画、功德增加、触发电流与飘字
- AudioEngine：WebAudio 合成木鱼"咚"（赛博混音）、爆炸、飘字 up、升级金光轰鸣

### 阶段 4：特效系统
- FxSystem：径向金光圈、随机折线电弧（青+金）、多彩赛博烟花（约 1/3 屏）、功德飘字（附电弧）
- 粒子池复用，避免 GC 卡顿

### 阶段 5：鬼物 AI 与进化
- GhostManager：9 级配置表（血量/速度/攻速/造型）、从四边生成向金光罩移动、啃食罩子
- 赛博进化：每级刷新"本级新鬼 + 低级赛博化复出"，全部入图鉴
- 击杀判定：木鱼金光脉冲（区域伤害）、宠物攻击、血量归零 → 烟花 + 图鉴点亮

### 阶段 6：金光罩与失败闭环
- ShieldSystem：罩强度 = 功德，被啃食扣减；功德归零罩消失
- 替死链：鹦鹉×4 → 猫×2 依次牺牲、罩子重亮；全灭 → 结算卡 → 模拟广告复活 / 重开
- 重开：宠物满编、木鱼回 1 级、图鉴保留

### 阶段 7：宠物系统
- PetSystem：2 猫开局可战、4 鹦鹉木鱼 2/3/4/5 级解锁；自动索敌跌打最近鬼物
- 宠物随木鱼升级同步赛博化；猫/鹦鹉击杀的鬼魂净化归顺为友方鬼灵（本级结束时消散）

### 阶段 8：HUD 与皮肤商业化
- HUD：功德条（分段金+电流）、等级/鬼物标识、按钮（图鉴/皮肤/签到）
- 皮肤：木鱼皮签到排期（第 1/4/7…天）、鬼物皮广告递进（第 N 次=第 N 级 1 天试用，3N 次+连签 N 天=永久）
- 图鉴：9 级鬼+进化形态+猫鬼/鹦鹉鬼+9 级皮肤（持有点亮、未持有黑影）
- AdProvider 模拟：3 秒倒计时模拟激励视频（复活/皮肤）

### 阶段 9：联调打磨
- 数值平衡（功德节奏、鬼物强度曲线、鬼佛连点密度）
- 视觉/音效细节打磨、性能检查（粒子池、绘制裁剪）

## 验证方式
- 每阶段结束：浏览器打开 index.html 运行验证该阶段功能（我可启动本地静态服务供预览）
- 阶段 9 完成：端到端完整试玩（开局→升级→替死→重开→皮肤/图鉴/签到/离线）

## Cocos 移植预留
- 全部模块以类/对象形式书写，逻辑与渲染分离（update 驱动状态，render 只读状态）
- 数值全部集中在 config.js，移植时抄表即可
- AdProvider 抽象：原型模拟 = 倒计时；发布 = 抖音 tt.createRewardedVideoAd()