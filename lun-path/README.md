# 论径 · 当前前端

当前只保留本次重做的藤蔓首页和全景页：五个主题分类、向右探索、远近雾气、沿途蝴蝶、中英文切换。原版 Sylva 的材质、卡片照片、液态金属控件和入场动画继续使用。

## 运行

需要 Node.js 22 或以上；无需安装依赖。在本目录执行 `npm start`，打开 [藤蔓首页](http://localhost:5180/#/home) 或 [全景页](http://localhost:5180/#/overview)。

执行 `npm run prepare:scenes` 可从原版 Sylva 重新生成当前场景。`npm test` 使用本机无界面 Edge 检查当前页面并生成 `qa/v2-*` 验收记录。

## 当前入口

- 路径：当前藤蔓首页；向下滚轮使视角向右，内容向左。
- 全景：五张原版分类卡片，桌面三加二排列，手机两列。
- 画像：保留本次确认的三项导航，内容暂时留白。
- 开始：进入待重做的手账入口，目前白屏。
- 五个分类：各有自己的书架路由，目前白屏。

## 清理说明

已删除早期自制的双栏手账、采集问答、画像确认、试读、测试、论文阅读、带读、成长页面，以及旧模拟学习接口、模拟论文、旧改造书架和相应旧测试。旧的浏览器学习记录未清空，但当前页面不读取或写入它们；仅保存界面语言。

四套原版目录 `../sylva-preview`、`../complete-shelf-preview`、`../sketchbook-preview`、`../book-showcase-preview` 原样保留；`references/`、原始素材副本和 Three.js 资源也保留，供后续从原版重做。

当前代码：`src/app.js` 管理页面与共享场景；`src/grove.js` 构建场景外壳；`shared/grove-categories.js` 保存五分类；`scripts/prepare-grove.mjs` 与 `scene-travel-hook.js` 生成藤蔓场景；`public/assets/grove-*` 绑定交互和样式；`server/index.mjs` 只提供静态文件和健康检查。

原版复用与视觉变更见 [第 1 部分记录](docs/part1-vine-overview.md)。
