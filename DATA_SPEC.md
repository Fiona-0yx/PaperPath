# PaperPath 数据规范

版本：`0.1.0`　更新日期：2026-11-01　状态：首轮联调契约，业务代码尚未实现

本规范约定队员和开发 agent 之间交换什么数据、由谁产生、怎样校验。先统一字段，再各自开发，避免检索、智能体、分析与界面在联调时使用不同格式。

配套文件：[JSON Schema](schemas/data.schema.json) · [完整模拟会话](examples/demo_session.json) · [协作说明](AGENTS.md)

## 1. 依据与适用范围

业务范围以本仓库 [README](README.md) 的“面向本科生的自适应文献学习”闭环为准。职责划分参考用户提供的[GitHub 团队协作对话](chatgpt-conversation://6ae70694-fb38-83e9-84e2-55e183a27146)：**A 统一数据与分析规范，B 组织 Agent 工作流，C 提供检索解析、存储与界面。** A/B/C 是职责标签，尚不据此推断具体队员对应关系。

引用对话中的 ChipLit-Agent、GaN HEMT、旧时间表及功能分支命名不作为本项目新约束。规范保留通用的参数证据扩展，但不限定学科，也不在此决定模型供应商、前端框架、数据库或智能体框架。

本文规定的是新建的数据契约，并不表示检索、带读、校验或导出功能已经完成。逻辑接口名称也不是已经部署的 HTTP 地址。

## 2. 三人如何对接

| 职责 | 负责产生或维护 | 主要读取 | 交付边界 |
| --- | --- | --- | --- |
| A：规范与分析 | 字段规则、证据与校验标准、能力画像规则；维护本规范和 Schema | PDF 页文本、证据、作答记录 | 数据含义、证据依据和分析结果可核对；规则变化同步通知 B/C |
| B：Agent 工作流 | 会话状态、动态测评、阅读路径、工具请求和结果归档；调度带读、校验与画像更新 | 用户目标、C 的论文数据、A 的规则 | 每一步都有结构化输入输出；错误、重试和阶段转移有记录 |
| C：数据与应用 | 论文元数据、PDF 页文本、持久化和界面展示；按契约适配检索与解析工具 | 会话快照、路径、校验结论、画像与图谱 | 返回稳定 ID、真实页码和原文；界面不自行重算或改写结论 |

典型流向：C 提供 `Paper / ParsedPaper` → B 调度生成 `Evidence / LearningContent` → 按 A 的规则得到 `ValidationResult` → B 更新路径和画像 → C 保存并展示。具体代码归属由团队再分配，接口含义以本文件为共同依据。

## 3. 通用规则

| 项目 | 统一约定 |
| --- | --- |
| 序列化 | UTF-8 JSON；键名使用 `snake_case`；禁止 NaN、Infinity 和 JSON 中的注释 |
| 契约版本 | 三种顶层消息都必须带 `schema_version: "0.1.0"`；内嵌业务对象继承该版本 |
| 顶层消息 | `kind` 只能是 `session_snapshot`、`tool_request`、`tool_result` |
| ID | 不透明字符串，匹配 `^[a-z][a-z0-9_-]{0,127}$`，例如 `paper_demo_001`；不得使用标题或列表下标作为 ID |
| 稳定性 | 同一实体保留 ID。重新规划递增 `path.revision`，画像变化递增 `profile.revision`；不要给同一实体每次生成新 ID |
| 时间 | UTC，格式固定为 `YYYY-MM-DDTHH:mm:ssZ`；按时间先后比较，界面可转换为用户时区 |
| 必填与空值 | Schema 的 `required` 为准。必填字段不能省略；未知标量使用 `null`，已知为空的列表使用 `[]`；两者不能互换 |
| 禁止伪值 | 不用 `0`、`"N/A"`、`"unknown"` 或空字符串代替未知的数值、页码、年份、引用或评分 |
| 扩展 | 核心对象拒绝未声明字段；仅三种顶层消息允许可选的 `extensions` 对象，键用团队约定的命名空间，如 `ui.layout` |
| 本地路径 | `pdf_path` 使用项目数据根目录下的相对路径和 `/`；禁止绝对路径、反斜杠、盘符及 `..` 路径段。解析时仍须检查符号链接后的实际路径在数据根内 |
| 模拟数据 | 顶层 `is_mock: true`；模拟论文 `source.kind: "mock"`，模拟页 `method: "mock"`。正式会话禁止混入模拟来源 |
| 信息边界 | 契约不承载 API Key、认证头、环境变量值或原始模型内部思考；调用面板使用可读的步骤摘要 |

数据根目录由应用显式配置，不跟随进程的当前工作目录变化。Schema 中的空值或示例值不会自动填充缺失字段，生产者须自行提供完整对象。

无单位的测评分数与掌握度范围都是 `[0, 1]`，但不是同一个概念：`score` 表示一次作答的评分，`mastery` 表示画像对一个概念的阶段性估计。未测评的掌握度必须为 `null`。

## 4. 业务对象字段

本节中的字段均为必填，除非明确写为可选；`T?` 表示值可以为 `null`，不表示可以缺少该键。完整类型、范围和枚举以配套 Schema 为准。

### 4.1 LearningGoal 需求采集

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `topic` | string | 想学习的方向或主题 |
| `purpose` | string | 学习目的，例如完成课程调研、理解某类方法 |
| `paper_requirements` | object | `min_year / max_year: integer?`，`max_papers: integer 1–50`，`languages: string[]`，至少一种论文语言 |
| `explanation_language` | string | 讲解语言，如 `zh-CN`；不与论文语言混用 |

有年份上下限时必须满足 `min_year <= max_year`。`languages` 为本项目使用的语言标签，接入外部服务时由适配器映射，不将它原样当作供应商 API 参数。

### 4.2 Paper 论文信息

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `paper_id` | ID | 本项目的稳定标识；跨模块引用用它，不直接使用 DOI 或供应商 ID |
| `title` | string | 原始论文标题 |
| `authors` | string[] | 已知作者；未知为 `[]` |
| `year` | integer? | 发表年份；未知为 `null` |
| `doi` | string? | 去掉 `https://doi.org/` 等前缀后的 DOI；未知为 `null` |
| `language` | string? | 论文语言 |
| `source` | object | `kind: uploaded / retrieved / mock`，`provider: string?`，`source_id: string?`；后两者保留来源平台和外部 ID |
| `landing_url / pdf_url` | string? | HTTP(S) 页面或 PDF 地址；不知道或没有访问来源时为 `null` |
| `pdf_path` | string? | 本地相对文件路径；尚未下载或纯模拟数据为 `null` |
| `parse_status` | enum | `pending / ready / failed` |

DOI 比较时去除已知 DOI URL 前缀、首尾空白并忽略大小写；供应商 ID 按 `(provider, source_id)` 比较。由 C 维护到 `paper_id` 的映射。均无稳定来源标识时不要仅凭近似标题自动合并。`ready` 仅在成功生成对应 `ParsedPaper` 后写入。

### 4.3 ParsedPaper 与 PageText 原文

`ParsedPaper` 包含：`paper_id`、`page_count`、`content_sha256`、`pages`。

- `content_sha256`：原始 PDF 文件字节的 SHA-256，小写十六进制；纯模拟数据没有 PDF 时为 `null`，不得把文本摘要当作 PDF 指纹。
- `pages` 中每项为 `PageText`：`page`、`text`、`method`。`method` 为 `native_text / ocr / mock`。
- `page` 从 **1** 开始，对应 PDF 文件中的实际页序，不是论文印刷页码。调用从 0 开始的解析库时，由 C 的适配器加 1。
- `page_count == len(pages)`，页号必须完整且恰为 `1..page_count`，不允许重复。空白页允许 `text: ""`，不能因此跳页。
- OCR 文字不等于已经验证。扫描页无法提取时返回可解释错误，不能伪造正文；正式解析完成时必须保存文件指纹。

### 4.4 Evidence 原文证据

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `evidence_id` | ID | 稳定证据标识 |
| `paper_id` | ID | 对应 `Paper` 与 `ParsedPaper` |
| `page` | integer >= 1 | PDF 实际页序 |
| `quote` | string | 该页中的原文片段，禁止填入模型改写或摘要 |
| `confidence` | number? | 生成端给出的可信度估计，范围 `[0,1]`；不是 Critic 的校验结果 |
| `measurement` | object? | 可选的通用科研参数扩展；没有参数数据时为 `null` |

`measurement` 非空时包含 `parameter: string`、`value: number`、`unit: string`、`condition: string?`。无量纲参数使用单位 `"1"`；条件未知为 `null`，不臆测温度、数据集、实验设置或样本量。找不到参数时不生成该条参数证据，也不填 `value: 0`。

证据必须能在对应页的文本中定位。匹配时仅可折叠空白，不可删除或改写数字、符号、单位。跨页结论使用多条证据；单条 `Evidence` 不跨页。单位不同或实验条件不明时，不直接参与参数排序、均值等比较；如需换算或判断可比性，另行扩展契约并记录依据。

### 4.5 AssessmentTurn 一问一答测评或阅读作答

字段：`turn_id`、`question_id`、`concept_id`、`question`、`difficulty`、`answer`、`score`、`feedback`、`next_difficulty`。

- `difficulty / next_difficulty` 使用整数 `1..5`，仅是首轮联调的统一难度刻度，不是现有教学效果结论。
- 新问题尚未作答时，`answer / score / feedback / next_difficulty` 均为 `null`。
- 已作答但尚未评分时，`answer` 为字符串，其余可为 `null`；评分完成后填写 `score / feedback`。只有评分完成后才能写入 `next_difficulty`。
- 同一会话至多存在一条 `answer == null` 的待答回合；评分与后续问题难度调整由 B 调度、按 A 约定的规则完成。
- 阅读题使用 `LearningContent.questions[].question_id` 关联同一个问题，不能仅凭题目文本匹配。基础诊断题可尚无论文证据；阅读题必须带证据。

### 4.6 LearningPath 阅读路径

字段：`path_id`、`revision`、`replan_reason`、`steps`。

每个步骤包含 `step_id`、`paper_id`、`order`、`concept_ids`、`prerequisite_step_ids`、`goal`、`rationale`、`status`。状态为 `todo / active / completed / blocked`。

`order` 从 1 连续递增；步骤与前置引用不能重复、悬空或形成循环，同一时刻最多一个 `active` 步骤。`revision` 从 1 开始；重规划保留 `path_id`、递增版本，并填写非空 `replan_reason`。保留已有步骤的 ID，新增步骤使用新 ID。后续存储应保留旧版本，快照中的 `path` 仅为当前版本。

### 4.7 LearningContent 带读、术语与题目

| 字段 | 类型 | 含义 |
| --- | --- | --- |
| `content_id` | ID | 一次生成内容的标识；重做时产生新 ID，不覆盖失败版本 |
| `step_id / paper_id` | ID | 关联路径步骤和对应论文 |
| `explanations` | GroundedText[] | 至少一段带读讲解 |
| `terms` | object[] | 术语项：`term_id / name / explanation`；`explanation` 为 GroundedText |
| `questions` | object[] | 至少一道阅读题：`question_id / concept_id / prompt / difficulty / evidence_ids` |

`GroundedText` 为 `{ "text": "…", "evidence_ids": ["evidence_…"] }`。每段讲解、每个术语解释和每道阅读题至少引用一条证据，且所有引用必须存在。用于当前论文带读的证据必须属于同一 `paper_id`；跨论文内容在后续版本另定。

模型生成后先保存为待校验内容。只有获得 `passed` 的 `ValidationResult` 才能作为正式带读显示或用于更新学习成果；不能因存在证据 ID 或置信度较高而直接通过。

### 4.8 ValidationResult 原文校验

字段：`validation_id`、`content_id`、`status`、`reviewer`、`checks`、`summary`、`created_at`。

- `reviewer`：`rule_engine / llm / human`。
- `status`：`passed / failed / needs_review`。
- 每个检查项包含 `check_id`、`rule`、`evidence_id: ID?`、`target_path`、`status`、`message`。
- `rule`：`reference_integrity`（引用完整）、`quote_exists`（原文可定位）、`citation_relevance`（引用是否支持相应讲解或题目）。
- 必须至少检查一次引用完整性，并对每条证据完成原文定位；相关性检查必须逐一覆盖每段讲解、每个术语解释、每道题目及其每条证据，不能因某处引用正确而放行整份内容。
- `target_path` 指向当前内容中的位置，如 `/explanations/0`、`/terms/0/explanation`、`/questions/0`，数组位置从 0 开始。全局引用检查或证据原文定位可用空路径 `""`；相关性检查须填写非空路径及对应 `evidence_id`。路径对应不可变的 `content_id`，不是 PDF 页码。
- `passed` 要求所有必要检查均通过；`failed` 至少包含一项失败；`needs_review` 含待复核项且没有已失败项。Schema 检查状态形状，逐条覆盖和语义支持还需要业务校验。
- `failed` 进入重新生成；`needs_review` 等待进一步复核。只要有失败或待复核项，就不进入正式带读和成果更新。

### 4.9 Profile 能力画像

字段：`profile_id`、`learner_id`、`revision`、`updated_at`、`competencies`、`completed_paper_ids`、`pending_concept_ids`。

每项能力为 `{ "concept_id": "…", "mastery": null, "assessment_turn_ids": [] }`。`mastery` 可为 `[0,1]` 数值或 `null`；非空数值必须指向至少一条已经评分的作答记录，具体估计公式由 A 定义，当前未指定。不得把 `confidence`、一次 `score` 和 `mastery` 不加区分地复制。

`learner_id` 使用匿名标识，不要求姓名或学号。画像引用的回合与论文必须在同一快照中可解析。尚未阅读的论文不能因为被推荐就列入 `completed_paper_ids`。

### 4.10 Concept 与 Trajectory 学习概念和轨迹图谱

快照中的 `concepts` 是概念字典，每项包含 `concept_id / name / description`。路径、测评、画像、题目和图谱使用同一字典；界面通过它显示概念名称，不各自猜测 ID 的含义。

`trajectory` 包含 `nodes` 和 `edges`。

- 节点：`node_id / concept_id / status / paper_ids`；状态为 `unexplored / learning / mastered`。
- 边：`edge_id / from_node_id / to_node_id / kind`；类型为 `prerequisite / explored / suggested`。
- `suggested` 对应界面的虚线方向提示；其余样式由界面决定。边的两个节点必须存在，不允许自环；前置依赖边不能构成循环。
- 分支探索通过新增节点与边表达，不覆盖已记录的探索分支。图谱节点的 `mastered` 由画像规则决定，不由界面点击自行赋值。

### 4.11 Event 面板记录

字段：`event_id / at / role / kind / summary / tool_call_id`。`role` 为 `planner / tutor / critic / profiler / tool / system`；`kind` 为 `plan / tool_call / validation / replan / profile_updated`。

`summary` 记录可读的步骤、工具调用、校验结论或重规划原因。`tool_call` 事件必须关联一个存在的 `tool_call_id`，其他事件可为 `null`。不在这里输出模型内部思考、系统提示词或凭据。

## 5. 逻辑工具接口与消息

### 5.1 输入输出对照

所有接口使用同一 `ToolRequest / ToolResult` 包装。以下参数和返回值都在 Schema 中有对应定义，供队员实现适配器和 agent 构造调用；它们不依赖某个 LLM 的 function calling 格式。

| `operation` | `arguments` | 成功时 `data` | 主要对接 |
| --- | --- | --- | --- |
| `search_papers` | `{ goal }` | `{ papers }` | B 调度，C 提供检索 |
| `parse_pdf` | `{ paper }` | `{ parsed_paper }` | B 调度，C 提供解析 |
| `next_assessment` | `{ goal, turns, profile }` | `{ turn }` | B 调度，A 约定测评规则；`profile` 可为空 |
| `plan_path` | `{ goal, assessment_turns, profile, papers }` | `{ path }` | B 规划，A/C 提供规则和数据；`profile` 可为空 |
| `generate_content` | `{ step, parsed_paper, profile }` | `{ content, evidence }` | B 调度生成，A 规定依据与校验；`profile` 可为空 |
| `validate_content` | `{ content, evidence, parsed_paper }` | `{ validation }` | B 调度，按 A 的校验规则执行 |
| `update_profile` | `{ profile, assessment_turns, validation, path, trajectory }` | `{ profile, trajectory }` | B 调度，按 A 的能力规则更新；必须传已有画像，允许其中能力为空 |

初次画像可由应用创建空 `Profile`：版本 1、能力与完成列表均为空。`next_assessment` 遇到未答或未评分回合时不得生成下一题；先返回 `INVALID_INPUT` 并说明需要继续的步骤。检索零结果是成功的 `{ "papers": [] }`，由规划环节要求调整条件，不伪造成网络故障。通用参数提取暂通过 `Evidence.measurement` 表达，跨论文参数比较的调用接口不在 v0.1 中预设。

`next_assessment` 的成功输出必须是尚未作答的新题；`update_profile` 至少需要一条已评分作答和一条 `passed` 校验结果。未满足条件时应返回明确错误，不提前更新成果。

### 5.2 ToolRequest

必填字段：`schema_version / kind / call_id / request_id / session_id / operation / attempt / timeout_ms / is_mock / arguments`。`kind` 固定为 `tool_request`。

- `request_id` 标识一次逻辑请求；失败后使用相同参数重试时保留它。
- `call_id` 标识一次实际执行，每次重试生成新 ID。
- `attempt` 从 1 开始，v0.1 最多 3 次；`timeout_ms` 为本次执行的总时限，范围 `1..120000` 毫秒，由调用方明确指定。
- 调整论文、问题或提示后重新生成属于新的逻辑请求，不冒充对相同参数的网络重试。生成失败后的业务修订需要另有阶段预算，不能无限循环。
- 重复收到同一 `call_id` 时应复用已有执行结果，避免重复写库和累加画像版本。

### 5.3 ToolResult 与错误

必填字段：`schema_version / kind / call_id / request_id / session_id / operation / attempt / is_mock / status / data / error / started_at / finished_at`。`kind` 固定为 `tool_result`，关联字段必须与请求相同，且结束时间不早于开始时间。

| `status` | `data` | `error` | 消费规则 |
| --- | --- | --- | --- |
| `succeeded` | 对应 operation 的完整返回对象 | `null` | 合并前仍须做引用与业务校验 |
| `partial` | 当前已获得且结构完整的返回对象 | 非空 | v0.1 仅用于 `search_papers`；保留结果并显式告知未检索完整 |
| `failed` | `null` | 非空 | 不向后传递伪造的默认结果 |

`ToolError` 包含 `code / message / retryable / retry_after_seconds`。等待时间为非负秒数或 `null`；`retryable == false` 时等待时间必须为 `null`。

| 错误类别 | `code` | 重试处理 |
| --- | --- | --- |
| 输入或契约问题 | `INVALID_INPUT / UNSUPPORTED_SCHEMA_VERSION` | 不自动重试，先修改输入或适配版本 |
| 认证或权限 | `AUTH_FAILED / PERMISSION_DENIED` | 不自动重试，需要处理凭据或访问权限 |
| 资源与解析 | `NOT_FOUND / PDF_PARSE_FAILED / OCR_REQUIRED` | 不原样重试，选择其他来源、解析方式或人工处理 |
| 证据与校验 | `EVIDENCE_NOT_FOUND / VALIDATION_FAILED` | 不原样重试，回到选文、生成或人工复核阶段 |
| 写入冲突 | `CONFLICT` | 先重新读取当前版本，不能覆盖队友或其他会话的更新 |
| 临时故障 | `NETWORK_ERROR / TIMEOUT / RATE_LIMITED / INTERNAL_ERROR` | 仅在 `retryable == true` 且预算未耗尽时重试 |

有服务端等待时间时按 `retry_after_seconds` 等待，超过调用方剩余预算则停止并报告；否则可采用 1、2 秒退避并增加随机抖动。本规范只约定可重试条件与上限，不声称当前已有重试实现。Critic 返回检查失败时，工具本身可以是 `succeeded` 且 `validation.status == "failed"`；这与工具无法执行而返回 `ToolResult.status == "failed"` 不同。

## 6. SessionSnapshot 与阶段转移

`SessionSnapshot` 是跨模块读写、恢复会话和 v0.1 画像迁移的完整交换包。必填字段：

| 类别 | 字段 |
| --- | --- |
| 元信息 | `schema_version / kind / session_id / learner_id / is_mock / created_at / updated_at / stage`；`kind` 为 `session_snapshot` |
| 输入与诊断 | `goal: LearningGoal? / concepts: Concept[] / assessment_turns: AssessmentTurn[]` |
| 原始资料 | `papers: Paper[] / parsed_papers: ParsedPaper[] / evidence: Evidence[]` |
| 学习过程 | `path: LearningPath? / contents: LearningContent[] / validations: ValidationResult[]` |
| 学习沉淀 | `profile: Profile? / trajectory: Trajectory` |
| 执行记录 | `events: Event[] / tool_calls: ToolRequest[] / tool_results: ToolResult[] / last_error: ToolError?` |

导出或导入时保留整包与稳定 ID，以便画像中的回合、论文和证据引用仍能解析；这是一种项目内的迁移契约，不代表第三方工具已经支持导入。数据根目录或论文文件不随 JSON 自动传输；无本地 PDF 时可以依原文页文本核对，但不能宣称文件已恢复。跨设备导入后由适配器检查 `pdf_path` 是否有效，不能直接当作本机现存路径。

| `stage` | 进入条件与下一步 |
| --- | --- |
| `requirements` | 尚在采集需求，`goal` 允许为 `null` |
| `assessment` | 已有完整目标；一问一答进行测评 |
| `retrieval` | 使用需求及已有测评结果检索论文 |
| `planning` | 有可规划的论文；零结果则留在检索并调整条件 |
| `generating` | 已有路径、当前步骤及其解析文本，生成带读内容 |
| `validating` | 已生成带读及证据，尚未通过原文校验 |
| `reading` | 当前步骤内容的最新校验为 `passed`，才展示为正式带读 |
| `profiling` | 使用已评分作答及通过校验的学习内容，更新画像和轨迹 |
| `completed` | 本轮目标完成，当前路径所有步骤均完成 |
| `failed` | 流程无法继续，`last_error` 必须非空；修复后再恢复相应阶段 |

通常按表格顺序推进。测评可自循环；校验失败回到 `generating`，待复核留在 `validating`；阶段反馈触发 `planning` 并递增路径版本。重规划和内容重做保留历史记录。已完成一篇论文不等于整个路径已完成。

## 7. Schema 之外必须检查的规则

JSON Schema 负责字段、类型、范围、枚举、消息分支及部分状态约束；它不执行 PDF 读取、跨对象关联、时间先后比较或教学判断。实现方合并数据前还必须检查：

1. ID 在各自实体集合中唯一，所有 `paper_id / step_id / question_id / evidence_id / turn_id / node_id / call_id / concept_id` 引用存在且对应实体一致。相同 `question_id` 必须对应同一题目，改写题目应使用新 ID。
2. `ParsedPaper` 页数和页号完整；正式解析具有真实 PDF 指纹，`ready` 状态存在对应解析对象；证据页号不超界且原文可定位。
3. 当前带读的步骤与论文一致；每个引用都属于该论文；Critic 必要检查覆盖完整，引用确实支持讲解或题目。
4. 学习阶段满足第 6 节条件；最新校验失败不能使用旧的通过记录放行同一内容。画像更新和图谱“掌握”必须有可说明的规则及作答依据。
5. 路径顺序、前置依赖和图谱边合法；画像中的完成论文和已完成路径一致；画像与会话的 `learner_id` 相同。
6. 同一 `request_id` 的重试保持 operation 和 arguments 不变，attempt 连续递增；每次执行使用新 `call_id`。请求和结果逐项匹配；执行中允许暂时没有结果，归档完成后不能缺结果。
7. `created_at <= updated_at`、`started_at <= finished_at`，并维护重规划、重做及画像版本的历史，不用旧版本覆盖新版本。
8. `is_mock == false` 时，论文、页文本、工具调用和结果均不得混入 mock；不把样例中的分数、文献或校验结论写成实测结果。

## 8. 队友与 agent 的最小接入步骤

1. 先阅读本规范，按自己的输入输出边界读取 Schema 中对应的 `$defs`，不要各自重命名公共字段。
2. 先读取 [demo_session.json](examples/demo_session.json)，确认能显示论文、证据页码、测评、路径、带读、校验、画像及轨迹。
3. 使用兼容 JSON Schema Draft 2020-12 的校验器。PowerShell 7 可在仓库根目录执行：

   ```powershell
   Test-Json -LiteralPath ./examples/demo_session.json -SchemaFile ./schemas/data.schema.json
   ```

4. 校验单个工具请求或结果时，仍使用完整包装和同一根 Schema；校验单个业务对象时，可选择相应 `$defs`，但保留原文件的引用解析上下文。
5. 按第 7 节补做引用、原文和业务规则检查，再接入自己的模块。通过 Schema 不等于内容真实或学习闭环已经跑通。
6. 模拟模式先从一篇虚构论文跑通；真实联调替换为可访问、有来源的论文和实际解析文本，并改为 `is_mock: false`。

样例全文与数值均为人工构造，只用于字段和关联检查；其中的 `passed` 是模拟校验记录。样例没有真实 PDF，也不证明检索、模型推理、原文语义校验或画像算法已经实现。

## 9. 版本与变更

v0.1 首次统一上述契约。字段重命名、类型变化、删字段或调整已有字段含义均属于不兼容变更；当前 Schema 严格拒绝陌生核心字段，新增核心字段也需要双方升级。顶层 `extensions` 中的非核心信息不得改变已有字段语义，也不能成为其他模块运行的隐性必填项。

变更由 A 维护、B/C 共同核对，**同一次修改中更新本文、Schema 和样例**，说明影响范围；接收方遇到未支持的 `schema_version` 应明确拒绝并返回 `UNSUPPORTED_SCHEMA_VERSION`，不猜测兼容。该错误的回包使用接收方支持的版本说明限制。

本规范与配套起步文件按用户要求在本地 `main` 分支提交；日常开发默认使用 `fzy`，用户另行指定分支时以最新指示为准。修改完成后提交本地，是否 push 由用户决定。
