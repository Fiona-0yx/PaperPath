# 论径 · 当前前端

当前实现了藤蔓首页、五分类全景，以及从「开始」进入的原版 Sketchbook 画像采集手账。

## 运行

需要 Node.js 22 或以上；无需安装依赖。在本目录执行 `npm start`，打开 [藤蔓首页](http://localhost:5180/#/home) 或 [全景页](http://localhost:5180/#/overview)。

执行 `npm run prepare:scenes` 可从原版 Sylva 重新生成当前场景。`npm test` 使用本机无界面 Edge 检查当前页面并生成 `qa/v2-*` 验收记录。

## 当前入口

- 路径：当前藤蔓首页；向下滚轮使视角向右，内容向左。
- 全景：五张原版分类卡片，桌面三加二排列，手机两列。
- 画像：第一次翻到画像小结后，可在这里直接修改文字并点击「提交并更新报告」。点击「修改原问卷」会带着已有答案回到第一题，逐题调整选项。「重新填写」经确认后开启空白问卷，同时清空本轮自检记录。此前生成的报告仍保存在本机服务中。
- 开始：按钮中心扩散露出古树与压叶扉页。翻页后可自由介绍、回答固定题，在封底修改画像。有采集记录时显示「继续」，回到上次书页。
- 采集题自动保存。第 10 题右页提供「查看学习画像」和「进一步测试完善画像」。前者定位首道漏答题，全部完成后翻到画像小结；后者直接进入空白页。在小结点「提交」后会弹出问卷分析报告，关闭报告后进入主导航的「画像」。
- 五个分类：各有自己的书架路由，目前白屏。

## 问卷内部报告

提交后，弹窗为每个匹配方向显示一篇论文、年份和一个具体阅读任务，并按问卷最多补充两条阅读建议。点击题名可打开本地标题样例，旁边有在线原文入口。推荐算法在 `server/recommend-papers.mjs`，书目在 `server/paper-catalog.mjs`，覆盖五个方向共十篇论文。返回与保存的 JSON 中，`readingPlan` 是弹窗对应的简版结果。

团队 Agent 可查阅[问卷分析与论文推荐接入说明](docs/questionnaire-integration.md)，其中包含接口、模型配置、报告字段、存储路径及离线调用示例。

在手账封底点击「提交」后，浏览器将本次答案和自检历史发送给本机服务，并在弹窗显示生成的报告。服务将同一份 JSON 报告保存到 `.local/questionnaire-reports/`。该目录已加入 Git 忽略列表，位于静态服务目录之外。报告编号可在当前已提交画像的 `submitted.reportId` 中查到。草稿修改在下次提交时进入报告。

在本目录执行 `npm run report:read` 可阅读最近生成的中文报告。执行 `npm run report:read -- <报告编号>` 可查看指定报告。报告列出各题的答案与来源、原始自检和历次作答、仍待确认的信息，以及选文、语言辅助或读后检测的建议。每条建议附有关联字段。只有一道梯度下降自检，结论限于该题考查的概念。

程序调用入口为 `POST /api/questionnaire/analyze`，请求类型为 `application/json`，正文为已提交的 `{answers, evidence}`。落盘成功默认返回收据 `{reportId, modelStatus}`。添加 `?include=report` 会随收据返回完整 `report`，添加 `lang=en` 会为本次报告选择英文。报告中的 `analysis` 是规则分析，`model` 保存模型补充建议及其证据字段。接口回归检查可执行 `npm run test:questionnaire`。

### 用本机 Codex CLI 分析问卷

全新配置默认使用本机已登录的 Codex CLI。请在启动服务的账户下用 `codex login status` 确认登录，并让 Node 能在 PATH 中找到可执行文件。Windows 可用 `QUESTIONNAIRE_CODEX_BIN` 指定 `codex.exe` 的绝对路径。启动方式为 `npm start`。需要从 `.env` 加载配置时，运行 `node --env-file=.env server/index.mjs`。

学生提交封底后，服务将字段值、来源和最近的自检作答交给 Codex。CLI 会使用其模型服务，因此问卷原话可能发送给该服务。返回的作答分析、论文子方向、推荐理由、试读问题和行动建议仅存入内部报告，每项都引用问卷字段。答案不足以确定方向时可记录澄清问题。报告还包含独立的规则选文分析，模型调用失败时仍可查看。

| 环境变量 | 用途 |
| --- | --- |
| `QUESTIONNAIRE_MODEL_PROVIDER` | `codex` 使用本机 CLI，`http` 使用兼容接口，`none` 仅启用规则。省略时沿用已有 HTTP 配置，全新环境使用 Codex |
| `QUESTIONNAIRE_CODEX_BIN` | Codex 可执行文件路径 |
| `QUESTIONNAIRE_CODEX_MODEL` | 可选的 Codex 模型名，默认使用本机顶层模型配置或 CLI 默认值 |
| `QUESTIONNAIRE_MODEL_BASE_URL` | 服务提供方的 API 根地址（含版本路径，如 `https://<服务域名>/v1`），也可填写完整的 Chat Completions 地址 |
| `QUESTIONNAIRE_MODEL_NAME` | 服务提供方公布的具体模型名 |
| `QUESTIONNAIRE_MODEL_API_KEY` | 服务端使用的密钥，免鉴权的本地模型可留空 |
| `QUESTIONNAIRE_MODEL_TIMEOUT_MS` | Codex 默认 90000 毫秒，最长 120000 毫秒。HTTP 默认 5000 毫秒，最长 15000 毫秒 |

`modelStatus` 为 `disabled` 表示已选择纯规则模式，`available` 表示取得了通过格式及字段引用检查的结果，`unavailable` 表示本次模型分析未生成。用 `npm run report:read` 可查看模型来源和本次分析结果。

## 清理说明

旧版学习页面与模拟接口已清理。当前手账沿用 Meng To 原版书本、卷页条带、光影、拖页和放大镜；旅行图集、自动快翻与个人主页导航已替换为手动采集流程。固定题库在 `shared/journal-questions.json`，当前手账进度和草稿使用独立的浏览器存储键 `lunjing-intake-v1`。首句只对少量明确表达做规则匹配。扉页题字使用霞鹜文楷 Regular 的网页子集，授权随字体放在素材目录中。

四套原版目录 `../sylva-preview`、`../complete-shelf-preview`、`../sketchbook-preview`、`../book-showcase-preview` 原样保留；`references/`、原始素材副本和 Three.js 资源也保留，供后续从原版重做。

主应用的页面与共享场景由 `src/app.js` 管理，`src/grove.js` 构建场景外壳，`shared/grove-categories.js` 保存五分类。`scripts/prepare-grove.mjs` 与 `scene-travel-hook.js` 生成藤蔓场景，`public/assets/grove-*` 绑定交互和样式。`server/index.mjs` 提供静态文件、健康检查和问卷分析接口。

原版复用与视觉变更见 [第 1 部分记录](docs/part1-vine-overview.md)。
