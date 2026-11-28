const tasks = {
  'scikit-learn': {
    main: ['读摘要，找出库支持的两类学习任务，并各写一个生活中的例子。', 'Read the abstract. Identify the two kinds of learning the library supports and give an everyday example of each.'],
    explain: ['结合正文里的统一接口，用垃圾邮件举例，向同学讲清 fit 和 predict 分别在哪一步使用。', 'Using spam detection and the paper’s common interface, explain to a classmate when to call fit and when to call predict.'],
    practice: ['用标有类别的点 1、3（甲）和 8（乙）作训练样本，按最近邻规则预测点 4 的类别。', 'Use labeled points 1 and 3 (class A) and 8 (class B) as training data. Predict the class of point 4 using its nearest neighbor.'],
    code: ['可用 KNeighborsClassifier(n_neighbors=1) 核对分类。', 'Check the prediction with KNeighborsClassifier(n_neighbors=1).'],
    term: ['先用一组有标签和一组无标签的顾客数据解释「监督学习」和「无监督学习」。', 'Start with labeled and unlabeled sets of customer data to define supervised and unsupervised learning.'],
    math: ['先画数轴，标出距离 |x−y| 中两个位置各指什么。', 'Start on a number line and label the two positions in the distance |x−y|.'],
    section: ['先看摘要里列出的学习任务，再去正文找统一接口的用法。', 'Start with the tasks listed in the abstract, then find the common interface in the main text.'],
  },
  xgboost: {
    main: ['打开摘要，找出作者想解决的可扩展性问题，再从报告的技术中挑一种说明它处理什么情况。', 'Read the abstract for the scalability problem and pick one technique to describe the situation it handles.'],
    explain: ['找到 default direction，用一个缺少年收入字段的样本向同学演示树在分裂点怎样决定走哪边。', 'Find “default direction” and show a classmate how a tree routes a sample with missing income at a split.'],
    practice: ['找缺失值默认分支的示意，给一棵树设定「低于 5 向左、缺失向右」，再把 2、7 和缺失值分别送到叶子。', 'Find the default branch for missing values. Set up a tree that sends values below 5 left and missing values right, then route 2, 7, and a missing value.'],
    term: ['先把「默认方向」标成样本缺少分裂特征时走的分支。', 'Start by labeling the default direction as the branch used when the split feature is missing.'],
    math: ['先看目标函数，把预测损失与树复杂度惩罚分别圈出来。', 'Start with the objective and circle the prediction loss and the tree complexity penalty.'],
    section: ['先读摘要了解问题，再到稀疏感知分裂一节找默认分支。', 'Start in the abstract, then find the default branch in the sparsity-aware split section.'],
  },
  'glorot-initialization': {
    main: ['读摘要，圈出 sigmoid 饱和出现的条件，再用一句话写下它对应的训练现象。', 'Read the abstract. Circle the conditions linked to sigmoid saturation and describe the associated training behavior in one sentence.'],
    explain: ['画一条 sigmoid 曲线，在两端和中间各选一点向同学解释，同样大的输入变化为什么会带来不同的输出变化。', 'Sketch the sigmoid curve and use a tail point and a middle point to explain why the same input change can produce different output changes.'],
    practice: ['找正文提出的均匀初始化区间。设相邻两层各有 3 个单元，算出区间两端，检查 −1、0、1 是否落在区间内。', 'Find the proposed uniform initialization range. Set the two neighboring layers to 3 units each, calculate the bounds, and check whether −1, 0, and 1 lie inside.'],
    term: ['先在 sigmoid 的草图上标出平坦区，用「输入变了，输出几乎没变」解释饱和。', 'Start by marking the flat parts of a sigmoid sketch and defining saturation as very little output change when the input changes.'],
    math: ['先看初始化区间，给公式里两个 n 分别标上输入单元数、输出单元数。', 'Start with the initialization bounds and label the two n terms as the input and output unit counts.'],
    section: ['先在摘要找训练变慢的现象，再从正文定位作者建议的初始化取值。', 'Find the training slowdown in the abstract, then locate the proposed initialization range in the main text.'],
  },
  dropout: {
    main: ['读摘要和网络示意图，圈出 dropout 每轮改变的部分，再写一句它要缓解什么问题。', 'Read the abstract and network diagram. Circle what dropout changes on each training pass and state the problem it addresses.'],
    explain: ['挑四个隐藏单元画两次训练的网络，用留下的不同组合向同学解释作者所说的「变薄网络」。', 'Draw two training passes with four hidden units. Use the two different sets of retained units to explain a “thinned network” to a classmate.'],
    practice: ['给四个隐藏单元各抛一次硬币，用正面表示保留，划掉其余单元。再按论文测试规则把保留率 0.5 乘到原权重 4 上。', 'Flip one coin per hidden unit for four units. Keep heads and cross out the others. Then apply the paper’s test-time rule to a weight of 4 and a retention probability of 0.5.'],
    term: ['先在图里标出「保留」和「丢弃」的隐藏单元，说明这两个标记只针对当前训练轮。', 'Start by marking retained and dropped units in the diagram and explain that the marks apply to the current training pass.'],
    math: ['先区分保留概率 p 和丢弃概率 1−p，再把 p 对应到测试阶段的缩放。', 'Start by distinguishing retention probability p from dropout probability 1−p, then connect p to the test-time scaling.'],
    section: ['先看标准网络和 dropout 网络的图，再在正文找训练和测试的两条规则。', 'Start with the standard and dropout network diagrams, then find the training and test rules in the text.'],
  },
  'deep-learning-review': {
    main: ['读开头的图像识别例子，按从像素到物体的顺序列出各层能识别的内容。', 'Read the opening image-recognition example and list what the layers recognize in order, from pixels to objects.'],
    explain: ['画一张手写数字，把像素、笔画边缘和数字标在不同层，向同学解释各层怎样组合前一层的信息。', 'Draw a handwritten digit and label pixels, stroke edges, and the digit at different levels. Explain how each level combines information from the one below it.'],
    practice: ['在方格纸上画一段横线和一段竖线。先标出每段的方向，再把两段拼成直角，模拟文中从边缘到局部形状的一步。', 'Draw a horizontal and a vertical line on a grid. Mark each edge’s orientation, then combine the two into a corner to model the move from edges to local shapes.'],
    term: ['先把「表征」理解为一层用来描述输入的信息，比如一组边缘方向。', 'Start by defining a representation as the information a layer uses to describe its input, such as edge orientations.'],
    math: ['先对照图像例子，把输入的像素值、提取的边缘方向、分类输出分别写入三格。', 'Use the image example to place pixel values, extracted edge orientations, and the class output in three separate boxes.'],
    section: ['先读文章开头的图像例子，再到卷积网络一节寻找对应的图。', 'Start with the opening image example, then find a related illustration in the convolutional networks section.'],
  },
  'batch-normalization': {
    main: ['读摘要和算法框，圈出每批输入会计算的两个统计量，再写出作者想改善的训练环节。', 'Read the abstract and algorithm box. Circle the two statistics computed for each batch and identify the part of training the authors want to improve.'],
    explain: ['比较论文里训练和推理两栏，向同学解释为什么推理单个样本时要用训练期间估计的统计量。', 'Compare training and inference in the paper and explain why inference on one example uses statistics estimated during training.'],
    practice: ['用 1、2、3 作为一批输入，照算法框先减均值，再除以方差加 ε 后的平方根，检查中间值 2 的输出。', 'Use inputs 1, 2, and 3 as a batch. Follow the algorithm: subtract the mean, divide by the square root of variance plus ε, and check the output for 2.'],
    code: ['可用 NumPy 算出整批的归一化结果，核对均值是否为 0。', 'Use NumPy to normalize the whole batch and check that the resulting mean is zero.'],
    term: ['先用三条样本举例，解释 mini-batch 是一次送入模型的小批数据。', 'Start with three examples and define a mini-batch as the small group of data processed together.'],
    math: ['先在算法框标出 μ、σ² 和 ε，分别对应均值、方差和防止除零的小常数。', 'Start by labeling μ, σ², and ε in the algorithm as the mean, variance, and a small constant that prevents division by zero.'],
    section: ['从算法框看训练步骤，再找正文里推理阶段统计量的来源。', 'Start with the training algorithm, then find where the inference statistics come from.'],
  },
  alexnet: {
    main: ['在摘要找出模型做的任务和作者报告的一个错误率，写一句话说明该数衡量什么。', 'Find the model’s task and one reported error rate in the abstract. State what that number measures.'],
    explain: ['给同学画一张五项预测排名表，让正确类别排第三，用这个例子讲清 top-1 和 top-5 的区别。', 'Give a classmate a list of five ranked predictions with the correct class third, and use it to explain top-1 and top-5.'],
    practice: ['把三张图的正确类别分别放在预测榜第 1、第 3 和第 6 名，按论文指标分别算 top-1 与 top-5 错误率。', 'Put the correct classes for three images at ranks 1, 3, and 6. Calculate the top-1 and top-5 error rates using the paper’s metrics.'],
    term: ['先在一张预测排名表圈出 top-1 和 top-5 各检查哪些位置。', 'Start by circling the ranks that top-1 and top-5 check in a list of predictions.'],
    math: ['先把错误率写成「判错的图片数 ÷ 图片总数」，再看前 k 名条件怎样决定分子。', 'Start with the number of errors divided by the total number of images, then see how the top-k rule determines the numerator.'],
    section: ['先在摘要找到指标名称，再从结果部分选一张表找对应列。', 'Find the metric names in the abstract, then pick a table in the results and find the corresponding columns.'],
  },
  resnet: {
    main: ['找残差块示意图，圈出跳接和相加点，用一句话写下输入怎样到达输出。', 'Find the residual block diagram. Circle the shortcut and addition point, then describe how the input reaches the output.'],
    explain: ['把 x 画成两路，用 F(x)=0 的例子向同学讲清，为什么包含跳接的块仍可传递原输入。', 'Draw the two paths from x and use F(x)=0 to explain to a classmate why a block with a shortcut can pass on the original input.'],
    practice: ['给图中的残差块输入 x=(2,3)，设残差分支 F(x)=(−1,1)，逐项相加并记录输出。', 'Feed x=(2,3) to the residual block in the diagram, set F(x)=(−1,1), and record the elementwise sum.'],
    code: ['可用 NumPy 向量相加核对输出，再把残差向量置零重跑一次。', 'Check the sum with NumPy, then set the residual vector to zero and run it again.'],
    term: ['先在残差块图上标出「残差分支」和直接传递 x 的「跳接」。', 'Start by labeling the residual branch and the shortcut that carries x directly in the block diagram.'],
    math: ['先在 F(x)+x 旁分别写上「残差分支的输出」和「原输入」。', 'Start by labeling the two terms in F(x)+x as the residual branch output and the original input.'],
    section: ['先看残差块图，再读引言里更深普通网络训练误差升高的观察。', 'Start with the residual block diagram, then read the introduction’s observation about higher training error in deeper plain networks.'],
  },
  glove: {
    main: ['找正文的 ice、steam 共现例子，用一句话说明两者在 solid 和 gas 附近出现的频率透露了什么。', 'Find the co-occurrence example with ice and steam. Describe what their frequencies near solid and gas tell you.'],
    explain: ['给同学写出「ice 常和 solid 一起出现」和「steam 常和 gas 一起出现」，用论文共现表讲清两组词的区别如何显现。', 'Show a classmate that ice often appears with solid and steam with gas. Use the co-occurrence table to explain how the distinction shows up.'],
    practice: ['把三句短语「ice solid」「ice water」「steam gas」分开写，用左右各一词的窗口手填 ice、steam 的共现计数。', 'Use the separate phrases “ice solid,” “ice water,” and “steam gas.” With a window of one word on each side, fill in the co-occurrence counts for ice and steam.'],
    term: ['先查「共现」的意思，在一行文字里圈出目标词及其窗口内的词。', 'Start by defining co-occurrence and circling a target word and the words within its window in one line of text.'],
    math: ['先给 P(k|i) 标注「已看到词 i 时，词 k 出现在它附近的概率」，再对照正文的共现表。', 'First label P(k|i) as the probability of finding word k near word i, then compare it with the co-occurrence table.'],
    section: ['先看 ice 和 steam 的共现表，再回到方法一节看作者为什么比较概率比值。', 'Start with the ice and steam table, then find why the method compares ratios of probabilities.'],
  },
  transformer: {
    main: ['读摘要和整体结构图，圈出论文主要依靠的机制，写一句话说明它要解决的序列任务。', 'Read the abstract and architecture diagram. Circle the mechanism the model relies on and state the sequence task it addresses.'],
    explain: ['用两个词画一张两行两列的注意力表，向同学说明一个词怎样按权重汇合两个位置的信息。', 'Draw a two-by-two attention table for two tokens and show a classmate how one token combines information from both positions using weights.'],
    practice: ['照注意力公式取 Q=[1]、两个 K 都为 [1]、两个 V 为 [2] 和 [4]。从两项相同的分数求出权重并算出输出。', 'Use Q=[1], two keys of [1], and values [2] and [4]. Work through the attention formula to get weights from the two equal scores and calculate the output.'],
    code: ['可用 NumPy 算一遍，再只把第二个 K 改成 [2]，观察输出变化。', 'Repeat the calculation in NumPy, then change just the second key to [2] and observe the output.'],
    term: ['先在注意力图上标 Q 是发出查询的向量，K 用于匹配，V 提供被汇合的信息。', 'Start by labeling Q as the query, K as what it matches against, and V as the information to combine.'],
    math: ['先在缩放点积注意力公式里依次圈出点积、缩放、softmax、加权求和。', 'Start by circling the dot product, scaling, softmax, and weighted sum in the attention formula.'],
    section: ['先从整体结构图定位注意力模块，再到缩放点积注意力小节看计算过程。', 'Locate attention in the architecture diagram, then find the calculation in the scaled dot-product attention section.'],
  },
};

const outcomeText = [
  /(?:看懂|读懂|理解|了解)(?:论文的?)?(?:核心问题|大意)|\b(?:main idea|gist|big picture)\b/i,
  /讲(?:给|清楚|解|明白)|汇报|\b(?:explain|present|teach)\b/i,
  /复现|重现|\b(?:reproduc\w*|replicat\w*|implement\w*)\b/i,
];
const difficultyText = [
  /生词|术语|\b(?:vocabulary|terminology|unfamiliar terms?)\b/i,
  /数学公式|公式|推导|\b(?:equations?|formulas?|derivations?)\b/i,
  /文章结构|论文结构|章节|\b(?:paper structure|structure of the paper)\b/i,
  /不知道从哪篇|不知道从哪里|从哪(?:篇|儿)?开始|\b(?:choosing a first paper|where to start)\b/i,
];

function answerText(answer) {
  return (answer?.text ?? answer?.other ?? '').trim();
}

export function outcomeChoice(answer) {
  const choice = answer?.values?.[0];
  if (choice !== undefined) return choice;
  const affirmative = answerText(answer).split(/[，,。；;\n]/)
    .filter(clause => !/不(?:想|需要|打算)|无需|\b(?:no need|do not|don't|not trying)\b/i.test(clause));
  const matches = outcomeText.flatMap((pattern, index) =>
    affirmative.some(clause => pattern.test(clause)) ? [index] : []);
  return matches.length === 1 ? matches[0] : undefined;
}

function difficultyChoices(answer) {
  const affirmative = answerText(answer).split(/[、，,。；;\n]/)
    .filter(clause => !/不(?:是问题|构成困难|难|会卡|困扰|怕|用查)|没(?:有)?(?:问题|困难)|看得懂|\b(?:no (?:problem|trouble|difficulty)|not (?:a problem|an issue|difficult|hard)|(?:are|is)n't (?:a problem|an issue|difficult|hard))\b/i.test(clause));
  return new Set([
    ...(answer?.values ?? []),
    ...difficultyText.flatMap((pattern, index) => affirmative.some(clause => pattern.test(clause)) ? [index] : []),
  ]);
}

function isNewReader(answer) {
  // Reading choices are [number of papers, main language].
  const count = answer?.values?.[0];
  return [0, 1].includes(count) ||
    /还没读过|没读过|1\s*[～–~\-到]\s*3\s*篇|\bnone yet\b|\bi (?:have )?never read\b|^\s*1\s*[–~-]\s*3\b/i.test(answerText(answer));
}

export function canCode(answer) {
  return [2, 3].includes(answer?.values?.[0]) ||
    /能修改代码并运行模型|能独立实现和调试模型|^(?:modify code and run a model|implement and debug a model)[.!]?$/i.test(answerText(answer));
}

export function paperGuide(paper, fields = {}, locale = 'zh') {
  const language = locale === 'en' ? 1 : 0;
  const fallback = paper.guide[language];
  const task = tasks[paper.id];
  if (!task) return fallback;

  const outcome = outcomeChoice(fields.outcome?.answer);
  const difficulties = difficultyChoices(fields.difficulty?.answer);
  const newReader = isNewReader(fields.reading?.answer);
  const needsStructure = difficulties.has(2) || difficulties.has(3);
  const preparation = difficulties.has(1) ? task.math : difficulties.has(0) ? task.term :
    needsStructure ? task.section : null;
  const exercise = [task.main, task.explain, task.practice][outcome] ??
    (preparation || newReader ? task.main : null);
  const codeCheck = outcome === 2 && canCode(fields.python?.answer) ? task.code?.[language] : null;

  return [preparation?.[language], exercise?.[language], codeCheck].filter(Boolean).join(language ? ' ' : '') || fallback;
}
