# 问卷分析与论文推荐接入说明

联调入口是问卷提交 API。需要直接调用 Node.js 模块的成员也可以复用同一套分析、模型和推荐函数。以下路径以 `lun-path/` 为根目录。

## HTTP 接口

本机执行 `npm start`，服务默认监听 `127.0.0.1:5180`。`GET /api/health` 可检查服务是否就绪。

| 接口 | 参数 | 返回 |
| --- | --- | --- |
| `POST /api/questionnaire/analyze` | `Content-Type: application/json`，正文为 `{answers, evidence}` | `{reportId, modelStatus}` |
| `POST /api/questionnaire/analyze?include=report&lang=zh` | 同上。用 `lang=en` 生成英文报告，默认中文 | `{reportId, modelStatus, report}` |
| `GET /papers/<id>` | `id` 取自报告中的 `paper.id` | 仅含标题的本地 HTML 样例。未知编号返回 404 |

题目 ID、选项和顺序见 [题库](../shared/journal-questions.json)。选项编号从 0 起算，未选的分组选项用 `null`。单选和多选用 `{source:"self",values:[…],other:""}`。自检用 `source:"check"`，该题的历次答案放在 `evidence.foundation` 数组。跳过用 `{source:"unknown"}`，未填写可省略整个字段。`evidence` 可省略。补充文字用 `other`，自由输入和封底修正用 `{source:"self",text:"…"}`，封底修正可带 `edited:true`。已有浏览器草稿结构见 [状态模块](../src/journal-state.js)。

请求上限为 256 KiB。错误响应格式为 `{error:{code,message}}`。无效问卷返回 400，超出上限返回 413，正文类型错误返回 415。模型失败时仍可取得规则报告。

### 最小请求

在 `lun-path/` 的 PowerShell 中启动离线测试服务。

```powershell
$env:QUESTIONNAIRE_MODEL_PROVIDER = 'none'
npm start
```

在另一个终端提交示例问卷。以下示例选择计算机视觉和自然语言处理，目标为读懂论文大意。

```powershell
$payload = @{
  answers = @{
    direction = @{ source = 'self'; values = @(3, 4) }
    outcome = @{ source = 'self'; values = @(0) }
  }
  evidence = @{}
} | ConvertTo-Json -Depth 8
$reply = Invoke-RestMethod -Method Post `
  -Uri 'http://127.0.0.1:5180/api/questionnaire/analyze?include=report&lang=zh' `
  -ContentType 'application/json' -Body $payload
$reply.report.readingPlan.directions | ForEach-Object { $_.paper }
```

要在修改端口后复用请求，只需替换 URL 中的端口。将 `paper.sampleUrl` 拼到服务地址后即可查看标题页，例如 `http://127.0.0.1:5180/papers/alexnet`。弹窗中的论文标题也直接打开此页。样例覆盖 [书目](../server/paper-catalog.mjs) 中全部十篇论文，标题用原语言，页面无外部资源。

## 报告字段与持久化变量

| 字段或变量 | 用法 |
| --- | --- |
| `reportId` / `report.id` | 同一个 64 位小写十六进制编号。对等价生成内容复用文件 |
| `report.locale` / `report.generatedAt` | 报告语言和首次落盘的 ISO 时间 |
| `report.readingPlan` | 弹窗数据，包含 `directions[]`、`advice[]` 和可空的 `clarification` |
| `readingPlan.directions[]` | `{category,title,paper,guide}`，每方向一篇。 `paper` 包含 `id,title,year,sampleUrl,url`，分别用 `sampleUrl` 打开本地标题页、用 `url` 打开在线原文 |
| `report.analysis` | 完整的规则分析，包含作答来源、自检记录和规则选文建议 |
| `report.model` / `modelStatus` | 模型分析与状态。状态为 `available`、`disabled` 或 `unavailable` |
| `defaultDirectory` | [保存模块](../server/questionnaire-api.mjs) 默认目录 `.local/questionnaire-reports/`，每份报告为 `<reportId>.json` |
| `reportDirectory` | Node 侧可用 `createServer({reportDirectory})` 指定绝对目录。用私有目录存放作答；默认目录由 Git 忽略 |
| `lunjing-intake-v1` | 浏览器本地存储键。草稿保存在 `answers`、`drafts` 和 `evidence`，最近成功提交的编号在 `submitted.reportId` |

旧报告可能没有 `readingPlan` 或 `paper.sampleUrl`，可让用户更新报告后拿到新字段。本机可用 `npm run report:read -- <reportId>` 阅读默认目录中的报告。跨进程拿取报告时，生成请求直接带 `include=report`。

## 大模型接口与扩展点

分析顺序为 `analyzeQuestionnaire → enrichQuestionnaire → recommendPapers → 保存并返回报告`。模型根据问卷字段生成补充分析、简短阅读建议，以及必要时的兴趣分类。每条分析或建议用 `evidenceIds` 引用实际出现的问卷字段。选文函数使用已有目录的条目。

| Node 入口 | 使用方式 |
| --- | --- |
| [analyzeQuestionnaire](../server/questionnaire-report.mjs) | `analyzeQuestionnaire(snapshot, {locale})`，校验并生成规则分析 |
| [enrichQuestionnaire](../server/questionnaire-model.mjs) | `await enrichQuestionnaire(analysis, {locale, env, fetchImpl, runCodex})`。可注入 `fetchImpl` 或 `runCodex` 做测试 |
| [runQuestionnaireCodex](../server/questionnaire-codex.mjs) | `await runQuestionnaireCodex({prompt, schema, env, signal})`，调用已登录的本机 Codex CLI，返回结构化 JSON |
| [recommendPapers](../server/recommend-papers.mjs) | `recommendPapers(analysis, model, locale)`，返回简版阅读计划 |

| 环境变量 | 作用 |
| --- | --- |
| `PORT` | 主服务端口，默认 `5180` |
| `QUESTIONNAIRE_MODEL_PROVIDER` | `codex` 调用本机 CLI，`http` 走兼容 Chat Completions 接口，`none` 仅执行规则。省略时按已有 HTTP 配置或默认 Codex 选择 |
| `QUESTIONNAIRE_CODEX_BIN` | CLI 路径或命令名，默认 `codex` |
| `QUESTIONNAIRE_CODEX_MODEL` | 模型名称覆盖项。省略时读取本机 Codex 顶层模型设置或 CLI 默认值 |
| `QUESTIONNAIRE_MODEL_BASE_URL` | HTTP 服务根地址，例如 `https://provider.example/v1`，也可填完整的 `/chat/completions` 地址 |
| `QUESTIONNAIRE_MODEL_NAME` | HTTP 服务使用的模型名 |
| `QUESTIONNAIRE_MODEL_API_KEY` | HTTP 服务的可选鉴权密钥，仅在服务端配置 |
| `QUESTIONNAIRE_MODEL_TIMEOUT_MS` | Codex 默认 90000，封顶 120000。HTTP 默认 5000，封顶 15000 |

Codex 模式需要运行服务的账户已登录 CLI。使用 Codex 或 HTTP 模式时，模型服务会收到用于分析的答案和自检字段。用 `none` 可离线跑通提交、推荐、报告保存和本地标题页。运行 `npm run test:questionnaire` 可检查接口和推荐逻辑。
