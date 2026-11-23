# 论径基础后台与模拟领域层

使用 Node 22+ 原生 ESM，无第三方依赖。项目根目录执行 `node server/index.mjs`（或主项目的 `npm start`），默认绑定 `127.0.0.1:5180`，可用 `PORT` 环境变量修改；不读取 `.env` 或任何凭证。运行 `node --test tests/domain.test.mjs` 验证领域及 HTTP 边界。

## 文件边界

- `shared/domain.js`：浏览器可直接 `import`，不依赖 Node，导出 papers、branches、nextQuestion、analyzeIntroduction、scoreAssessment、getTutorReply、createInitialState。
- `server/index.mjs`：JSON API 与静态服务；可导入 `createServer()` 进行隔离测试。
- `server/adapters.mjs`：未来模型的 `complete({messages,context})` 和检索的 `search({query,branch,limit})` 接口骨架；未配置时抛出明确的 NOT_CONFIGURED 错误。当前演示并未调用实际模型或搜索。

## 数据合同

三个 branch id 为 foundations、methods、practice，各两篇。所有论文是虚构 fixture/demo，作者为虚构群体，不提供 DOI，不冒充检索结果；实验数字均为教学模拟。标题、摘要、章节正文和引用始终为英文原文。中文仅用于引导、术语解释和测评。

paper: `{id,coverTitle,title,authors,year,branch,level,minutes,fixture:true,demo:true,sourceType:'fixture',notice:{zh,en},abstract,sections:[{id,title,body}],terms:[{term,zh,en,quote,sectionId}],diagnostic,final}`。

每个 diagnostic/final 为一题：`{question:{zh,en},options:[{zh,en}],correct,explanation:{zh,en},sectionId,quote}`。`correct` 为零基选项索引。所有 quote 都是所属段落 body 的精确子串。

画像只包含 goal、direction、experience、deadline、output 五个字符串。标准选择值分别为 goal(project/report/explore)、direction(plants/nlp/explore)、experience(beginner/python/reproduced/trained)、deadline(week/fortnight/flexible)、output(overview/reproduce/improve)。所有问题另提供 uncertain，允许自由文本 other；这些字段接受用户自述，不按封闭枚举拒绝开放答案。

nextQuestion 返回 `{action:'ask',question}` 或 `{action:'complete',profile}`。question 为 `{id,field,title:{zh,en},why:{zh,en},options:[{value,label:{zh,en}}],allowOther:true}`。history 为 `{field,value}` 数组，`value:'skip'` 不写入画像且不再询问。同一流程至多问五个字段。报告优先澄清成果；项目先澄清经验；初学、复现、训练经验改变成果选项顺序和提示。中文自述类别同样支持主要分支匹配。

analyzeIntroduction 返回 `{profile,evidence,sources,unknowns,notes,mode:'demo',isLLM:false}`。支持明确标签及自然语句，例如“我大二，会一点Python，想参加植物病害识别竞赛，两周内复现一个模型”、英文“I know Python / want to ...”。保留原话及精确证据，不把年级推断成经验，不从 deadline 推算日期。未识别的方向或信息保留在来源中供后续澄清；明确提供的自定义方向不替换为植物主题。

NLP 与探索方向可使用通用的划分、比较、复现和证据分析流程；植物病害 fixture 不作为 NLP 主题论文推荐，不声称检索到了主题匹配文献。

createInitialState 返回独立对象，含 version、lang、profile、history、sources、evidence、unknowns、attempts、notes、completed、activeBranch、selectedPaperId。上述学习状态由前端保存 localStorage；服务器无账号、数据库或跨请求状态。

## API（成功结果直接返回，不包 data）

| 方法与路径 | 请求 | 返回 |
| --- | --- | --- |
| GET /api/health | 无 | `{ok,service,mode,isLLM,modelConfigured,retrievalConfigured}` |
| GET /api/papers?branch=foundations | 可省略 branch；只接受三个 branch id | `{papers,branches,mode:'demo',isRetrieval:false}` |
| POST /api/planner/next | `{profile,history:[],lang:'zh'}` | nextQuestion 结果 |
| POST /api/assessment | `{paperId,stage:'diagnostic'或'final',answer:零基索引或'other',other:'',confidence}` | 下述 score 结果 |
| POST /api/tutor | `{paperId,question,lang,sectionId?}` | `{reply,paperId,sectionId,quote,citations:[{paperId,sectionId,quote}],mode:'demo',isLLM:false}` |
| POST /api/critic | `{paperId,text或draft或question,lang,sectionId?}` | tutor 相同引用字段，另含 `checks:[{id,question}],inputLength`；明确规则检查并未核验草稿真实性 |
| POST /api/profile/update | `{profile,text或introduction,lang,field?,value?}` | analyzeIntroduction 结果；合并已有画像和明确新证据，可按 field/value 更新；skip 不写入 |

score 返回 `{paperId,stage,answer,other,confidence,status,correct,score,explanation:{zh,en},sectionId,quote,mode:'demo',isLLM:false}`。status 为 correct/incorrect/uncertain/reflection。开放文本或 other 为 reflection；“不确定”选项为 uncertain，两者 correct/score 都为 null，不判错。普通选择 correct 为布尔、score 为 0 或 1。confidence 可用 low/medium/high/uncertain，或 0–100 数值；默认 uncertain，不参与自动判分。

所有 POST 使用 application/json，body 限制 64 KiB。JSON 格式、对象类型、字段长度、history、paperId、sectionId、branch、stage、lang、confidence 和选项索引均验证。错误为 `{error:{code,message,details?}}`，使用 400/404/405/413/415；内部错误不暴露堆栈。

静态路由 `/` 对应 public/index.html，其他资源默认映射 public/，`/src/` 和 `/shared/` 分别映射同名目录。只支持 GET/HEAD，按扩展名返回 MIME；拒绝隐藏段、反斜杠、越界路径与指向挂载目录外的符号链接。server/、项目配置和凭证目录不挂载。缺失文件返回 JSON 404，不回退 SPA 页面。

## 后续接入

真实检索应实现 LiteratureAdapter，保留出处、合法原文与稳定文献标识，将真实来源与 fixture 明确区分。真实模型应实现 ModelAdapter，并在路由中注入；不要仅通过环境变量存在就声称已启用模型。当前 tutor 提供所选段落的中文要点和术语解释，保留英文原文引用及 mode/isLLM 元数据，不在每次回复重复实现说明。critic 为可追溯检查提示，不进行开放式语义评判或事实核验。
