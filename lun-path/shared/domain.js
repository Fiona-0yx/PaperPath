/** Synthetic educational fixtures. No real publications, authors, DOI or retrieval. */
export const branches = [
  { id: 'foundations', title: { zh: '研究基础', en: 'Foundations' }, subtitle: '01 · foundations', description: { zh: '理解问题、数据划分与证据边界。', en: 'Understand questions, data splits and evidence limits.' } },
  { id: 'methods', title: { zh: '方法与实验', en: 'Methods' }, subtitle: '02 · methods', description: { zh: '比较基线、迁移学习与消融实验。', en: 'Compare baselines, transfer learning and ablations.' } },
  { id: 'practice', title: { zh: '实践与复现', en: 'Practice' }, subtitle: '03 · practice', description: { zh: '复现结果，检验跨场景泛化与部署成本。', en: 'Reproduce results and inspect generalization and deployment cost.' } },
];
const pair = (zh, en) => ({ zh, en });
const fixture = (id, title, branch, level, minutes, abstract, bodies, term, termZh, termEn, quiz) => {
  const sections = bodies.map(([title, body], i) => ({ id: `${id}-s${i + 1}`, title, body }));
  const assessment = (q, options, correct, explanation, sectionIndex, quote) => ({
    question: pair(...q), options: options.map(x => pair(...x)), correct,
    explanation: pair(...explanation), sectionId: sections[sectionIndex].id, quote,
  });
  return { id, title, coverTitle: title.replace('Demo: ', '').split(' ').slice(0, 4).join(' '), authors: ['Lun Path Demo Research Group (fictional)'], year: 2026,
    branch, level, minutes, fixture: true, demo: true, sourceType: 'fixture',
    notice: pair('虚构教学论文，非真实检索结果；所有实验数字均为模拟。', 'Fictional teaching paper, not a retrieval result; all experiment numbers are simulated.'),
    abstract, sections,
    terms: [{ term, zh: termZh, en: termEn, quote: quiz[0][5], sectionId: sections[quiz[0][4]].id }],
    diagnostic: assessment(...quiz[0]), final: assessment(...quiz[1]),
  };
};
export const papers = [
  fixture('leaf-splits', 'Demo: Plant-Level Splits for Leaf Disease Classification', 'foundations', 'beginner', 12,
    'This fictional study examines leakage in leaf disease classification. A synthetic collection contains repeated views of the same plants. Plant-level partitions produce a more demanding evaluation than random image partitions.',
    [['Research Question', 'Can a classifier recognize disease on previously unseen plants? The synthetic dataset contains 240 plants and four disease labels. Multiple images may depict the same plant.'],
     ['Partition Protocol', 'All images from one plant belong to exactly one partition. A random image split can place nearly identical leaves in both training and test sets. The demo holds out 48 plants for testing.'],
     ['Results and Limits', 'Random image splitting yields 94 percent accuracy, while plant-level splitting yields 76 percent in this simulation. These values are invented teaching examples. The comparison does not establish performance on real farms.']],
    'plant-level split', '按植株划分', 'Assign every image of one plant to the same partition.',
    [ [['为何按植株划分？', 'Why split by plant?'], [['减少同株图像泄漏', 'Reduce same-plant leakage'], ['增加标签数', 'Increase label count'], ['不确定', 'Not sure']], 0, ['同一植株不能跨训练与测试集。', 'A plant must not span training and test partitions.'], 1, 'All images from one plant belong to exactly one partition.'],
      [['94% 能证明真实农场表现吗？', 'Does 94 percent establish farm performance?'], [['能', 'Yes'], ['不能，还需外部验证', 'No, external validation is needed'], ['不确定', 'Not sure']], 1, ['模拟且存在划分差异，不能外推真实场景。', 'Simulated split-dependent results cannot establish farm performance.'], 2, 'The comparison does not establish performance on real farms.'] ]),
  fixture('leaf-metrics', 'Demo: Reading Class-Wise Evidence in Imbalanced Leaf Data', 'foundations', 'beginner', 14,
    'This fictional study compares accuracy and macro recall on imbalanced synthetic leaf labels. A majority predictor obtains high accuracy while missing rare diseases. Class-wise reporting exposes that failure.',
    [['Dataset', 'The synthetic test set has 80 healthy leaves, 10 rust leaves and 10 blight leaves. All class counts are invented for this demo.'],
     ['Metrics', 'Macro recall is the unweighted mean of per-class recall. A predictor that always chooses healthy obtains 80 percent accuracy and one third macro recall.'],
     ['Interpretation', 'A confusion matrix identifies which disease classes are missed. A single accuracy value cannot show every class-specific failure. No clinical or agricultural intervention is evaluated.']],
    'macro recall', '宏平均召回率', 'The arithmetic mean of recall across classes, with equal class weights.',
    [ [['宏召回如何加权？', 'How does macro recall weight classes?'], [['按样本数', 'By sample count'], ['每类相同权重', 'Equal weight per class'], ['不确定', 'Not sure']], 1, ['宏平均对每一类等权。', 'Macro averaging weights each class equally.'], 1, 'Macro recall is the unweighted mean of per-class recall.'],
      [['80% 准确率是否排除漏检？', 'Does 80 percent accuracy rule out missed diseases?'], [['是', 'Yes'], ['否，需看每类结果', 'No, inspect class-wise results'], ['不确定', 'Not sure']], 1, ['多数类预测仍可能完全漏掉病害。', 'A majority predictor can miss all disease examples.'], 2, 'A single accuracy value cannot show every class-specific failure.'] ]),
  fixture('leaf-transfer', 'Demo: Frozen Features and Fine-Tuning on Synthetic Leaves', 'methods', 'intermediate', 18,
    'This fictional experiment compares a frozen feature encoder and partial fine-tuning for plant disease classification. Identical plant-level partitions and training budgets support a controlled comparison. Reported scores are simulated.',
    [['Baseline', 'The baseline trains a linear classifier on frozen encoder features. The encoder uses synthetic pretraining data in this fictional experiment.'],
     ['Controlled Comparison', 'Both methods use identical plant-level partitions and training budgets. Partial fine-tuning updates only the last encoder block. Five seeded runs report mean macro recall and its spread.'],
     ['Limitations', 'The simulated mean macro recall is 0.71 for frozen features and 0.75 for partial fine-tuning. These invented numbers do not identify a universally better method.']],
    'controlled comparison', '受控比较', 'Compare methods while holding the evaluation protocol and budget fixed.',
    [ [['公平比较应固定什么？', 'What should a fair comparison hold fixed?'], [['划分与预算', 'Partitions and budgets'], ['只固定标题', 'Only the title'], ['不确定', 'Not sure']], 0, ['相同协议减少混杂因素。', 'A shared protocol reduces confounding.'], 1, 'Both methods use identical plant-level partitions and training budgets.'],
      [['0.75 足以证明普遍更好吗？', 'Does 0.75 prove universal superiority?'], [['是', 'Yes'], ['否，证据限于本模拟', 'No, evidence is limited to this simulation'], ['不确定', 'Not sure']], 1, ['结论受数据、预算和模拟限制。', 'The conclusion depends on the data, budget and simulation.'], 2, 'These invented numbers do not identify a universally better method.'] ]),
  fixture('leaf-ablation', 'Demo: Ablating Background Augmentation for Leaf Recognition', 'methods', 'intermediate', 16,
    'This fictional study isolates background augmentation in a synthetic leaf recognition pipeline. Paired training runs change one factor at a time. The example illustrates how ablations support bounded causal interpretations.',
    [['Hypothesis', 'A model may rely on background color instead of disease texture. The demo tests whether background augmentation reduces this shortcut.'],
     ['Ablation Design', 'The paired runs differ only in background augmentation. Plant-level partitions, initialization seeds and optimization budgets are shared. The simulated evaluation includes unseen background colors.'],
     ['Evidence', 'On unseen colors, simulated macro recall changes from 0.58 to 0.69. The intervention supports a claim about this augmentation under this protocol. It does not isolate the effect of every pipeline component.']],
    'ablation', '消融实验', 'Change one component while keeping other relevant conditions fixed.',
    [ [['这项消融改变了什么？', 'What changes in this ablation?'], [['全部组件', 'Every component'], ['背景增强', 'Background augmentation'], ['不确定', 'Not sure']], 1, ['配对运行只改变背景增强。', 'The paired runs change background augmentation only.'], 1, 'The paired runs differ only in background augmentation.'],
      [['可将增益归因于全部组件吗？', 'Can the gain be attributed to all components?'], [['不可', 'No'], ['可以', 'Yes'], ['不确定', 'Not sure']], 0, ['消融仅支持对被干预组件的有限解释。', 'The ablation supports a bounded interpretation of the manipulated component.'], 2, 'It does not isolate the effect of every pipeline component.'] ]),
  fixture('leaf-shift', 'Demo: Auditing a Leaf Classifier Across Synthetic Farms', 'practice', 'intermediate', 20,
    'This fictional reproduction evaluates a leaf classifier on two synthetic farms with different lighting. The study separates in-domain validation from held-out farm evaluation and records uncertainty under distribution shift.',
    [['Reproduction Record', 'The demo records the split manifest, seed, preprocessing steps and model configuration. Every record refers to simulated data and can be inspected as a teaching protocol.'],
     ['External Evaluation', 'Farm B is excluded from training and hyperparameter selection. Simulated macro recall is 0.81 on Farm A and 0.60 on Farm B. Lighting and cultivar both change, so their separate effects remain unknown.'],
     ['Follow-up', 'Collecting labeled examples under matched lighting could test one proposed cause. The observed gap alone does not identify which changed factor caused the failure.']],
    'distribution shift', '分布偏移', 'A change between the training distribution and the evaluation distribution.',
    [ [['外部测试农场何时使用？', 'When is the external farm used?'], [['用于调参', 'For tuning'], ['训练调参结束后评估', 'For evaluation after training and tuning'], ['不确定', 'Not sure']], 1, ['外部测试不能参与训练或调参。', 'The external test must not enter training or hyperparameter selection.'], 1, 'Farm B is excluded from training and hyperparameter selection.'],
      [['差距能确定是光照导致的吗？', 'Does the gap identify lighting as the cause?'], [['能', 'Yes'], ['不能，多个因素同时改变', 'No, several factors change together'], ['不确定', 'Not sure']], 1, ['光照与品种同时变化，单独效应未知。', 'Lighting and cultivar change together; separate effects are unknown.'], 1, 'Lighting and cultivar both change, so their separate effects remain unknown.'] ]),
  fixture('leaf-budget', 'Demo: Reproducing a Leaf Model Under a Device Budget', 'practice', 'advanced', 22,
    'This fictional deployment exercise compares a reference model with a compact model under a synthetic device budget. It reports repeated latency measurements alongside class-wise quality and a reproducibility record.',
    [['Protocol', 'Both models use the same held-out plant set. The fictional device budget is 40 milliseconds per image and 32 megabytes of model storage.'],
     ['Measurements', 'Latency is measured after warm-up on the same device with batch size one. The simulated compact model has a median latency of 28 milliseconds and a 95th percentile latency of 46 milliseconds.'],
     ['Decision', 'A median below the budget does not guarantee that tail latency meets it. The demo retains class-wise recall, device details and measurement settings for review. These measurements are invented and are not hardware benchmarks.']],
    'tail latency', '尾部延迟', 'Latency near the slow end of the measured request distribution.',
    [ [['延迟比较需要固定什么？', 'What must be fixed for latency comparison?'], [['设备与批大小', 'Device and batch size'], ['只固定文件名', 'Only the file name'], ['不确定', 'Not sure']], 0, ['测量条件影响延迟。', 'Measurement conditions affect latency.'], 1, 'Latency is measured after warm-up on the same device with batch size one.'],
      [['中位数28ms能保证所有请求低于40ms吗？', 'Does a 28 ms median guarantee all requests meet 40 ms?'], [['能', 'Yes'], ['不能', 'No'], ['不确定', 'Not sure']], 1, ['95分位46ms已超过预算。', 'The 46 ms 95th percentile exceeds the budget.'], 2, 'A median below the budget does not guarantee that tail latency meets it.'] ]),
];

const fields = ['goal', 'direction', 'experience', 'deadline', 'output'];
const choice = (value, zh, en) => ({ value, label: pair(zh, en) });
const unsure = choice('uncertain', '不确定', 'Not sure');
function question(field, profile) {
  const project = /competition|project|竞赛|项目/i.test(profile.goal || '');
  const report = /report|报告/i.test(profile.goal || '');
  const trained = /trained|有训练经验/i.test(profile.experience || '');
  const reproduction = /reproduced|reproduction|复现/i.test(profile.experience || '');
  const spec = {
    goal: ['这次希望完成什么？', 'What would you like to accomplish?', '目标决定后续问题与阅读路径。', 'Your goal guides the next questions and reading path.', [choice('project', '完成竞赛或项目', 'Competition or project'), choice('report', '撰写报告', 'Report'), choice('explore', '先探索方向', 'Explore'), unsure]],
    direction: ['你想研究哪个方向？', 'Which direction interests you?', '现有论文为植物病害图像分类演示；NLP与探索仅映射通用研究流程。', 'The papers demonstrate plant disease image classification; NLP and exploration map only to general research workflows.', [choice('plants', '植物病害图像分类', 'Plant disease image classification'), choice('nlp', '自然语言处理（通用流程示例）', 'NLP (general workflow examples)'), choice('explore', '尚在探索', 'Still exploring'), unsure]],
    experience: [project ? '做这个竞赛或项目，你已有哪类经验？' : report ? '阅读和撰写研究报告，你已有哪类经验？' : '你目前的研究经验如何？', project ? 'What experience do you bring to this competition or project?' : report ? 'What experience do you bring to reading and reporting research?' : 'What is your research experience?', '经验只用于调整路线，不评价能力。', 'Experience adjusts the route; it is not an ability judgment.', [choice('beginner', '初学', 'Beginner'), choice('python', '会使用 Python', 'Python experience'), choice('reproduced', '有复现经验', 'Reproduction experience'), choice('trained', '有模型训练经验', 'Model training experience'), unsure]],
    deadline: [report ? '报告何时需要完成？' : project ? '竞赛或项目何时需要交付？' : '你有明确的完成时间吗？', report ? 'When is the report due?' : project ? 'When is the competition or project due?' : 'Do you have a target date?', '时间用于安排阅读节奏，不推断具体日期。', 'Time guides reading pace; no exact date is inferred.', [choice('week', '一周内', 'Within a week'), choice('fortnight', '两周内', 'Within two weeks'), choice('flexible', '时间灵活', 'Flexible'), unsure]],
    output: [report ? '你希望报告重点产出什么？' : trained ? '已有训练经验，下一步希望交付什么？' : reproduction ? '复现之后希望留下什么成果？' : '这次希望留下什么成果？', report ? 'What should the report focus on?' : trained ? 'With training experience, what would you deliver next?' : reproduction ? 'What artifact should reproduction produce?' : 'What artifact would you like to produce?', '成果形式帮助选择阅读重点。', 'The artifact determines reading priorities.', (report ? [choice('overview', '文献综述与证据对比', 'Literature and evidence overview'), choice('reproduce', '复现报告', 'Reproduction report'), choice('improve', '改进方案', 'Improvement proposal')] : trained || reproduction ? [choice('improve', '改进、消融与泛化实验', 'Improvement, ablation and generalization'), choice('reproduce', '可复现实验', 'Reproducible experiment'), choice('overview', '研究概览', 'Research overview')] : [choice('overview', '结构化阅读概览', 'Structured reading overview'), choice('reproduce', '复现基线', 'Reproduce a baseline'), choice('improve', '提出改进方案', 'Propose improvements')]).concat(unsure)],
  }[field];
  return { id: `profile-${field}`, field, title: pair(spec[0], spec[1]), why: pair(spec[2], spec[3]), options: spec[4], allowOther: true };
}
export function nextQuestion(profile = {}, history = [], lang = 'zh') {
  const clean = Object.fromEntries(fields.map(f => [f, typeof profile[f] === 'string' ? profile[f] : '']));
  const asked = new Set();
  for (const item of history) {
    if (!fields.includes(item.field)) continue;
    asked.add(item.field);
    if (!clean[item.field] && typeof item.value === 'string' && item.value !== 'skip') clean[item.field] = item.value;
  }
  const order = /report|报告/i.test(clean.goal) ? ['goal', 'direction', 'output', 'experience', 'deadline'] : fields;
  const field = order.find(f => !clean[f].trim() && !asked.has(f));
  return field ? { action: 'ask', question: question(field, clean) } : { action: 'complete', profile: clean };
}

export function analyzeIntroduction(text = '', lang = 'zh') {
  const profile = Object.fromEntries(fields.map(f => [f, '']));
  const evidence = [];
  // Preserve explicit wording and source spans; never derive education, ability or dates.
  const patterns = {
    goal: /(?:目标|goal)\s*[:：]\s*([^\n;；。]+)/i,
    direction: /(?:方向|direction)\s*[:：]\s*([^\n;；。]+)/i,
    experience: /(?:经验|experience)\s*[:：]\s*([^\n;；。]+)/i,
    deadline: /(?:截止时间|截止|deadline)\s*[:：]\s*([^\n;；。]+)/i,
    output: /(?:成果|产出|output)\s*[:：]\s*([^\n;；。]+)/i,
  };
  for (const field of fields) {
    const match = String(text).match(patterns[field]);
    if (match) { profile[field] = match[1].trim(); evidence.push({ field, value: profile[field], quote: match[0], source: 'self-introduction' }); }
  }
  const naturalPatterns = {
    goal: [/(?<!不)(?:想|希望|计划|打算)(?:要)?(?:参加|参与|完成|做|写|探索)[^\n，,；;。.!?！？]*/u, /(?:用来|用于)(?:参加|参与)[^\n，,；;。.!?！？]*/u, /(?:需要|要)(?:在[^\n，,；;。]{0,8})?(?:写|完成|撰写)[^\n，,；;。.!?！？]*(?:报告|综述)/u, /\b(?:I\s+)?(?:want to|plan to|hope to|would like to)\s+[^\n,;.!?]+/i],
    direction: [/(?:研究方向|方向|研究主题)(?:是|为|想做|想研究)\s*([^\n，,；;。.!?！？]+)/u, /\b(?:my (?:research )?(?:direction|topic|field) is|I (?:study|work on))\s+([^\n,;.!?]+)/i, /(植物病害(?:图像)?(?:识别|分类)?|自然语言处理|计算机视觉|医学影像|推荐系统|\bNLP\b|\bnatural language processing\b|\bplant disease (?:classification|recognition)\b)/i],
    experience: [/(?<!不)(?:会|学过|用过|掌握)(?:一点|一些|使用|基础)?\s*Python\b/i, /(?:我是|目前是)?(?:初学者|零基础)/u, /(?<![没未])(?:有模型训练经验|有训练经验|有复现经验|复现过[^\n，,；;。.!?！？]*)/u, /\bI\s+(?:know|use|have (?:some )?experience (?:with|in))\s+Python\b/i, /\bI (?:am|'m) (?:a )?beginner\b/i, /\bI have (?:trained|reproduced) [^\n,;.!?]+/i],
    deadline: [/(?:一|两|二|三|四|\d+)\s*(?:天|周|个?月)(?:之内|以内|内)/u, /\b(?:within|in)\s+(?:one|two|three|four|a|an|\d+)\s+(?:days?|weeks?|months?)\b/i, /(?:截止到|截止于)\s*[^\n，,；;。.!?！？]+/u],
    output: [/(?<![不没未])(?:复现|训练|改进)(?:一[个份套])?[^\n，,；;。.!?！？]{0,20}?(?:模型|基线|实验|项目)/u, /(?<!不)(?:撰写|写|完成)(?:一[份篇个])?(?:报告|综述|阅读笔记)/u, /\b(?:reproduce|replicate|improve|train)\s+(?:(?:a|an|one|the)\s+)?(?:\w+\s+){0,3}(?:model|baseline|experiment)\b/i, /\b(?:write|produce)\s+(?:(?:a|an|one|the)\s+)?(?:report|review|prototype)\b/i],
  };
  for (const field of fields) {
    if (profile[field]) continue;
    for (const pattern of naturalPatterns[field]) {
      const match = String(text).match(pattern);
      if (!match) continue;
      profile[field] = (match[1] ?? match[0]).trim();
      evidence.push({ field, value: profile[field], quote: match[0], source: 'self-introduction' });
      break;
    }
  }
  return { profile, evidence, sources: text ? [{ id: 'self-introduction', type: 'user', text: String(text) }] : [],
    unknowns: fields.filter(f => !profile[f]), notes: [lang === 'en' ? 'Only explicitly stated information is recorded; other details remain unknown.' : '仅记录明确表达的信息；其余信息保持未知。'], mode: 'demo', isLLM: false };
}
export function scoreAssessment({ paperId, stage = 'diagnostic', answer, other = '', confidence = 'uncertain' } = {}) {
  const paper = papers.find(p => p.id === paperId);
  if (!paper) throw new RangeError('Unknown paperId');
  if (!['diagnostic', 'final'].includes(stage)) throw new RangeError('Unknown stage');
  const item = paper[stage];
  const open = Boolean(String(other).trim()) || answer === 'other';
  const index = typeof answer === 'number' ? answer : /^\d+$/.test(String(answer)) ? Number(answer) : -1;
  if (!open && (!Number.isInteger(index) || index < 0 || index >= item.options.length)) throw new RangeError('answer must be an option index or other');
  const uncertain = !open && item.options[index].en === 'Not sure';
  return { paperId, stage, answer, other, confidence, status: open ? 'reflection' : uncertain ? 'uncertain' : index === item.correct ? 'correct' : 'incorrect',
    correct: open || uncertain ? null : index === item.correct, score: open || uncertain ? null : Number(index === item.correct),
    explanation: item.explanation, sectionId: item.sectionId, quote: item.quote, mode: 'demo', isLLM: false };
}
export function getTutorReply({ paperId, question: input = '', lang = 'zh', sectionId } = {}) {
  const paper = papers.find(p => p.id === paperId);
  if (!paper) throw new RangeError('Unknown paperId');
  if (sectionId && !paper.sections.some(s => s.id === sectionId)) throw new RangeError('Unknown sectionId');
  const lower = input.toLowerCase();
  const term = paper.terms.find(t => lower.includes(t.term.toLowerCase()) || input.includes(t.zh));
  const section = /limitation|limits|局限|边界/i.test(input)
    ? paper.sections.at(-1)
    : paper.sections.find(s => s.id === term?.sectionId) || paper.sections.find(s => s.id === sectionId) || paper.sections[0];
  const quote = section.body;
  const termDefinitions = {
    'plant-level split': '同一株植物的所有图像只能放在同一个数据子集，避免模型在测试时遇到训练中见过的近似叶片。',
    'macro recall': '先分别计算每类样本被正确识别的比例，再对各类等权求平均，避免多数类掩盖少数病害的漏检。',
    'controlled comparison': '固定数据划分和训练预算，再比较方法，才能减少把条件差异误当成方法收益的风险。',
    ablation: '每次只改变一个组件，其他条件保持一致，观察指标变化，从而判断这个组件在当前协议下的作用。',
    'distribution shift': '训练和测试的数据条件发生变化，例如农场、光照或品种改变；原来的好成绩不保证新场景表现。',
    'tail latency': '关注较慢请求的耗时，而不只看中位数；少量很慢的预测也可能超过设备预算。',
  };
  const summaries = {
    'leaf-splits': ['问题是识别未见过的植株，而不是记住相似叶片。每株有多张图像，因此划分单位会直接影响评估可信度。', '同株图像必须留在同一集合。随机按图像划分可能泄漏近似叶片，使测试成绩虚高。', '94% 与 76% 来自不同划分协议的模拟结果，说明协议影响很大；这些数字不能证明真实农场表现。'],
    'leaf-metrics': ['健康样本占八成，类别不均衡会让只猜多数类的模型看起来成绩很好。', '始终猜健康即可得到80%准确率，但两种病害的召回率为零，宏召回只有三分之一。', '混淆矩阵能揭示漏掉了哪种病害；只看总准确率会隐藏这些具体失败。'],
    'leaf-transfer': ['基线冻结编码器，只训练线性分类器，便于先建立简单、可比较的参照。', '两种方法共享按植株划分和训练预算；只微调最后一个编码块，并用多个随机种子观察波动。', '宏召回0.71与0.75是模拟均值。优势受当前数据和预算限制，不能直接推广成普遍结论。'],
    'leaf-ablation': ['要检验的假设是模型可能依赖背景颜色，而不是病害纹理。', '配对运行只改变背景增强，划分、随机种子与优化预算保持一致，帮助隔离该组件的影响。', '未见背景下的模拟提升支持背景增强在本协议中的作用，不能同时证明其他组件有效。'],
    'leaf-shift': ['复现需要记录划分清单、随机种子、预处理和模型配置，使别人能检查实验条件。', '农场B完全不参与训练调参；跨农场下降提示泛化问题，但光照和品种同时变化，无法分清各自影响。', '可以通过匹配光照的标注数据继续检验原因；仅凭成绩下降，还不能确定哪个因素造成失败。'],
    'leaf-budget': ['两种模型要在同一测试集比较，同时满足每张40毫秒与存储32兆字节的模拟预算。', '热身后固定设备、批大小为一；中位数28毫秒，但95分位46毫秒，说明慢请求可能超时。', '中位数达标不等于所有请求达标；还应保留每类召回率、设备信息与测量设置供复查。'],
  };
  const sectionIndex = paper.sections.indexOf(section);
  const reply = lang === 'en'
    ? `${term ? term.en + ' ' : ''}${section.body}`
    : `${term ? term.zh + '：' + termDefinitions[term.term] + '\n' : ''}${summaries[paper.id][sectionIndex]}`;
  return { reply, paperId, sectionId: section.id, quote, citations: [{ paperId, sectionId: section.id, quote }], mode: 'demo', isLLM: false };
}
export function createInitialState() {
  return { version: 1, lang: 'zh', profile: Object.fromEntries(fields.map(f => [f, ''])), history: [], sources: [], evidence: [], unknowns: [...fields], attempts: [], notes: [], completed: [], activeBranch: 'foundations', selectedPaperId: null };
}
