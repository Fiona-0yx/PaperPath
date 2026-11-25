# 论径 · 当前前端

当前实现了藤蔓首页、五分类全景，以及从「开始」进入的原版 Sketchbook 画像采集手账。

## 运行

需要 Node.js 22 或以上；无需安装依赖。在本目录执行 `npm start`，打开 [藤蔓首页](http://localhost:5180/#/home) 或 [全景页](http://localhost:5180/#/overview)。

执行 `npm run prepare:scenes` 可从原版 Sylva 重新生成当前场景。`npm test` 使用本机无界面 Edge 检查当前页面并生成 `qa/v2-*` 验收记录。

## 当前入口

- 路径：当前藤蔓首页；向下滚轮使视角向右，内容向左。
- 全景：五张原版分类卡片，桌面三加二排列，手机两列。
- 画像：初始画像生成前提供手账入口。第一次翻到画像小结后，此处直接显示可编辑的手账封底，电脑上摊开两页，手机上单页显示。可以展开自检字段查看原题与历史作答。
- 开始：按钮中心扩散露出古树与压叶扉页。翻页后可自由介绍、回答固定题，在封底修改画像。有采集记录时显示「继续」，回到上次书页。
- 采集题自动保存。第 10 题右页提供「查看学习画像」和「进一步测试完善画像」。前者定位首道漏答题，全部完成后翻到画像小结；后者直接进入空白页。在小结点「提交」可直接打开主导航的「画像」。
- 五个分类：各有自己的书架路由，目前白屏。

## 清理说明

旧版学习页面与模拟接口已清理。当前手账沿用 Meng To 原版书本、卷页条带、光影、拖页和放大镜；旅行图集、自动快翻与个人主页导航已替换为手动采集流程。固定题库在 `shared/journal-questions.json`，当前手账进度和草稿使用独立的浏览器存储键 `lunjing-intake-v1`。首句只对少量明确表达做规则匹配。扉页题字使用霞鹜文楷 Regular 的网页子集，授权随字体放在素材目录中。

四套原版目录 `../sylva-preview`、`../complete-shelf-preview`、`../sketchbook-preview`、`../book-showcase-preview` 原样保留；`references/`、原始素材副本和 Three.js 资源也保留，供后续从原版重做。

当前代码：`src/app.js` 管理页面与共享场景；`src/grove.js` 构建场景外壳；`shared/grove-categories.js` 保存五分类；`scripts/prepare-grove.mjs` 与 `scene-travel-hook.js` 生成藤蔓场景；`public/assets/grove-*` 绑定交互和样式；`server/index.mjs` 只提供静态文件和健康检查。

原版复用与视觉变更见 [第 1 部分记录](docs/part1-vine-overview.md)。
