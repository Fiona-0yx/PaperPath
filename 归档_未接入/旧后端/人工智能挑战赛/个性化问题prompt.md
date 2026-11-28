# 任务：为「论径」实现后端的"动态出题 + 下一步建议"引擎

## 0. 先做什么
开始写代码前，先阅读仓库中的这些文件并理解现状，不要凭空重写：
- README.md、论径需求清单_合并版.md、网页需求与开发记录.md
- lun-path/server/index.mjs、adapters.mjs、model-plan.mjs
- lun-path/shared/domain.js、lun-path/docs/architecture.md
- lun-path/tests/ 下现有测试

## 1. 项目背景（简述）
论径是面向本科生的自适应文献学习产品。前端已有演示版（原生 JS + Node 原生 HTTP 服务，无 npm 依赖）。
现在要做的是后端核心：根据"主画像"和"用户读某篇论文时的行为与作答"，输出
(a) 动态问题；(b) 读完后用户下一步该做什么。

## 2. 硬性约束
1. 只改后端：server/、shared/、tests/、docs/。不要修改 public/、scenes/、references/、各 *-preview 目录。
2. 保持现有技术栈：Node.js 原生 HTTP、ES Modules（.mjs），不引入 Express 等框架；非必要不加 npm 依赖。
3. 必须有"无模型模式"：没有任何 API Key 时，整条流程也能跑通（用规则/模板兜底）。
4. 模型提供方未定。通过 adapters.mjs 里的统一接口调用，用环境变量配置（如 LLM_PROVIDER、LLM_MODEL、LLM_API_KEY）。不要写死某一家。
5. 现有接口（/api/health、/api/papers、/api/profile/update、/api/planner/next、/api/assessment、/api/tutor、/api/critic）保持兼容，新接口在其基础上增加，不要破坏前端当前调用。
6. 论文原文永远保持原语言，不翻译、不改写。界面辅助内容（题干、解析、建议）按请求的 lang（zh/en）输出。
7. 不得编造论文、DOI、课程名或链接。"下一步"里的资源只输出"建议补的概念名/主题名"，不输出具体课程或网址。
8. 不要提交到 main。在当前分支上工作，改动按功能拆成几个清晰的提交。

## 3. 核心设计原则
- 主画像（目的、方向、基础自述、期限、期望成果）在入口阶段确定，读论文过程中**只读，永不被修改**。
- 每篇论文维护一份独立的"本篇记录"（PaperSession）。读完后，把"主画像 + 本篇记录"一起作为输入产生建议，**不回写主画像**。
- 算法决定"问什么、问多难、何时停、下一步是什么"；大模型只负责"怎么问"和"把理由说清楚"。决策层必须是确定性的、可单测的。
- 行为信号（划词提问、停留、回看）是弱证据：只提高某个概念被检测的**优先级**，**不直接改变掌握度**。只有检测题的作答结果才更新掌握度。
- "不确定/跳过/开放回答"不更新掌握度，不判错。未知≠不会。

## 4. 数据结构（放 shared/ 并导出，写好校验函数）

**MainProfile（只读）**
```json
{ "goal": "", "direction": "", "background_self_report": "", "deadline": "", "expected_output": "", "lang": "zh" }
```

**PaperSession**
```json
{
  "paper_id": "", "started_at": "", "lang": "zh",
  "events": [],
  "concepts": { "<concept>": { "mastery": 0.5, "evidence": [{ "source": "", "at": "" }], "asked_count": 0, "stuck_score": 0 } },
  "tests": { "pre": [], "post": [] },
  "asked_question_ids": []
}
```

**ReadingEvent**（type 为下列之一）
- `select_ask`：{ selected_text, paragraph_id, page, question_text, question_type: "term|sentence|formula|why|other" }
- `follow_up`：{ concept }（对同一概念追问）
- `not_understood`：{ question_id }（对解释点"没懂"）
- `highlight` / `note` / `bookmark`：{ paragraph_id, text? }
- `dwell`：{ page_or_paragraph_id, seconds }
- `revisit`：{ paragraph_id }

**Question**（模型输出与模板输出必须是同一结构，用 JSON Schema 校验）
```json
{
  "id": "", "concept": "", "difficulty": 3,
  "type": "single_choice|multi_choice|open",
  "stem": "", "options": [{ "id": "a", "text": "" }], "answer": ["a"],
  "explanation": "",
  "source_quote": "必须是论文原文中的原句，原样截取",
  "paragraph_id": "", "lang": "zh"
}
```

**NextAction**
```json
{
  "primary": { "action": "", "reason": "", "items": [{ "type": "concept|paper|section", "name": "" }] },
  "alternatives": [{ "action": "", "reason": "" }, { "action": "", "reason": "" }],
  "evidence_summary": ""
}
```
`action` 取值只有这 7 个（枚举）：
`补基础知识点` | `看网课或系统资料` | `重读本篇` | `读下一篇` | `换更易读的论文` | `换更深的论文` | `进入实践或复现`

## 5. 需要实现的模块（建议放 server/engine/）

1. **mastery.mjs**：简化 BKT 或类 Elo 更新。先验由主画像的基础自述给出一个温和的初值（不是确定评分）。答对上调、答错下调，skip/uncertain 不更新。参数放 config，写明默认值与含义。
2. **signals.mjs**：把 ReadingEvent 聚合成每个概念的 stuck_score。停留时间用"相对本人平均值的比例"，过滤失焦/异常过长的值；划词提问、追问、"没懂"加权。输出只影响优先级。
3. **selector.mjs**（决策层，确定性）：
   - 选概念：优先 stuck_score 高、mastery 不确定（接近 0.5）、与当前段落相关的概念；避开已问过的题。
   - 选难度：上一题答对升一档，答错降一档，范围 1..5，初始难度由主画像基础自述决定。
   - 停止条件：题数达到上限，或关键概念置信度足够。上限、阈值均放 config。
4. **question-generator.mjs**：输入 {concept, difficulty, source_span, lang, type}，通过 adapter 调用大模型生成 Question JSON；严格要求 JSON 输出；校验失败重试最多 2 次；仍失败则回退到模板题（shared/domain.js 已有的预设题或模板）。
5. **critic.mjs**：确定性检查——source_quote 必须逐字存在于该论文原文；选项数量、answer 合法、字段齐全；通不过则驱动重试。另保留语义校验的接口占位（暂不接模型）。
6. **next-action.mjs**：规则判断下一步（见第 6 节），再让模型（或无模型时用模板）把 reason 写成自然语言。必须输出 1 个 primary + 2 个 alternatives。
7. **接入 server/index.mjs**，新增接口：
   - `POST /api/session/event`：记录阅读事件
   - `POST /api/question/next`：返回下一题（含 stop 标志）
   - `POST /api/answer`：提交作答，返回反馈并更新掌握度
   - `POST /api/next-action`：读完后返回 NextAction

   服务端无账号，会话状态由前端随请求带上，或服务端按 session_id 暂存于内存（需有过期清理），二选一。说明你的选择与原因。

## 6. 下一步判断规则
阈值全部放 config，先给默认值，写注释说明可调。

| 条件 | action |
| --- | --- |
| 读前检测大面积答错 | 换更易读的论文 |
| 读前全对、读得快、几乎没提问 | 换更深的论文 |
| 同一前置概念读后答错，或划词提问集中在 ≤2 个概念 | 补基础知识点 |
| 卡住的概念较多（默认 ≥4）且彼此相关 | 看网课或系统资料 |
| 概念基本没问题，但方法/实验设计类题答错 | 重读本篇 |
| 读后正确率高、卡住概念少、主画像目的未达成 | 读下一篇 |
| 主画像目的是复现/项目，且方法部分已掌握 | 进入实践或复现 |

多条同时满足时给出优先级顺序，并在测试里固定下来。items 里只放概念名/章节名。

## 7. 测试（node:test，tests/ 下新增）
至少覆盖：
- mastery：答对/答错/skip/uncertain 的更新；主画像对象在整个流程后深度相等（证明未被修改）
- signals：行为信号只改变优先级，不改变 mastery
- critic：source_quote 不在原文时拒绝；合法题通过
- generator：模型返回坏 JSON → 重试 → 回退模板；无 API Key 时全流程可跑
- next-action：每个 action 至少一个触发用例，且恰好 1 个 primary + 2 个 alternatives
- 3 个"模拟学生"端到端脚本：①新手（读前大面积不会）②基础不错（读前全对）③模型跑通但效果差、卡在评估指标概念。三者应得到不同的问题序列和不同的 primary action。

## 8. 验收标准
- `npm test`（或 `node --test`）全绿，且无需任何网络或 API Key。
- 现有前端不改也能正常运行，旧接口行为不变。
- 用 curl 或脚本能走通：记录事件 → 取题 → 作答 → 取下一题 → 读完 → 得到 NextAction。
- docs/architecture.md 补充：新接口的请求/响应示例、数据结构、config 参数说明。
- 最后给出一份简短说明：做了什么、哪些是占位（如语义 Critic）、已知限制。

## 9. 工作方式
先给出你的实现计划（模块与文件清单，不超过一屏），然后直接开始实现，不要停下来等确认。遇到现有代码与本文冲突时，以不破坏现有功能为准，并在最后说明冲突点。
