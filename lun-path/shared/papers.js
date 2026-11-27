// Sample paper content for the reading workspace.
// One paper = one book. This file is the single source of truth for paper
// text, so both the shelf list and the reader can import it without a fetch.
//
// `glossary` and `translations` are offline reference material for the sidebar:
// they let 翻译 / 疑惑 provide a real answer without any model service. Every
// entry below is hand-written for this sample paper, not generated at runtime.
export const papers = [
  {
    id: 'features-labels-datasets',
    categoryId: 'machine-learning',
    title: 'Features, Labels and Datasets',
    zhTitle: '特征、标签与数据集：模型究竟看到了什么',
    difficulty: 1,
    abstract:
      'A supervised model is a function learned from examples. This note walks through the three parts every example carries — features, labels and the dataset that holds them — and shows what a model can and cannot see.',
    sections: [
      {
        id: 'introduction',
        heading: '1 · Introduction',
        paragraphs: [
          'Before a model can learn, data has to be organised into examples. In a supervised task, every example is a row with two parts: a set of features that describe the input, and a label that records the answer we want the model to predict. The dataset is simply the collection of those rows.',
          'It is tempting to treat this arrangement as bookkeeping. It is not. The choices made here decide what the model is able to learn at all. If a useful signal never becomes a feature, no amount of training will recover it.',
        ],
      },
      {
        id: 'features',
        heading: '2 · Features',
        paragraphs: [
          'A feature is a measurable property of an example. For a house-price task the features might be the floor area, the number of rooms, and the distance to the city centre. Each feature is a number the model can multiply, compare and combine.',
          'Raw observations rarely arrive in a useful form. A date, a category name or a free-text note must be encoded before a model can use it. This step — turning raw observations into numeric features — is called feature engineering, and it is where much of the practical skill of machine learning lives.',
        ],
      },
      {
        id: 'labels',
        heading: '3 · Labels',
        paragraphs: [
          'A label is the target the model is trained to predict. In a supervised task every training example carries one, and the model learns a mapping from features to labels. Without a label there is nothing to be right or wrong about, and supervised learning cannot begin.',
          'Labels must be treated as evidence about the past, not as a feature available at prediction time. A common failure is to build a feature out of information that already contains the answer — for example, using a cancelled-order flag to predict cancellations. The model then looks accurate in training and collapses in use.',
        ],
      },
      {
        id: 'datasets',
        heading: '4 · Datasets',
        paragraphs: [
          'A dataset is the set of rows used to train and evaluate a model. It is normally split into a training set, a validation set and a test set. The training set teaches the model, the validation set guides small decisions, and the test set is held back so the final score reflects unseen data.',
          'The split must respect how the model will be used. If rows from the same source appear in both training and test data, the test score can be inflated. A good dataset is not merely large; it is arranged so that the evaluation imitates the real future the model will face.',
        ],
      },
      {
        id: 'what-a-model-sees',
        heading: '5 · What a Model Actually Sees',
        paragraphs: [
          'At inference time a model sees only features. It never sees the label, because the label is exactly what it is trying to produce. Training is the process of adjusting the model so that, given features, it outputs labels close to the ones recorded in the past.',
          'The practical lesson is narrow and durable: the model can only use what is present in its features, and it can only learn what is present in its labels. A clean dataset, honest features and trustworthy labels do more for a model than a cleverer algorithm applied to a messy one.',
        ],
      },
    ],
  },
];

export const findPaper = id => papers.find(p => p.id === id) || null;
export const papersInCategory = categoryId => papers.filter(p => p.categoryId === categoryId);

// ——— offline reference material ———
// basic: for a reader who is new to machine learning.
// advanced: adds the trade-off or the failure mode behind the term.
// probes: follow-up questions the sidebar can ask to pin down understanding.
const GLOSSARY = {
  'feature engineering': {
    zh: '特征工程',
    basic: '把原始数据（日期、类别名、自由文本）加工成模型能计算的数值列，这个过程就是特征工程。',
    advanced: '特征工程决定模型「能看见什么」。同一批数据，特征构造方式不同，模型上限也不同；它通常比换算法更能提升效果。',
    probes: ['你能举一个把「日期」变成数值特征的例子吗？', '为什么说特征工程决定了模型的上限？'],
  },
  'training set': {
    zh: '训练集',
    basic: '用来训练模型的那部分数据，模型从里面学参数。',
    advanced: '训练集只负责学参数；如果拿它来判断效果，得到的分数往往偏乐观，所以要另留验证集和测试集。',
    probes: ['训练集和测试集为什么要分开？'],
  },
  'training data': {
    zh: '训练数据',
    basic: '训练模型时用的那批样本，通常就是训练集里的内容。',
    advanced: '训练数据决定了模型能学到的分布；它和测试数据是否同源，直接决定评估分数可不可信。',
    probes: ['训练数据和测试数据为什么要分开？'],
  },
  'validation set': {
    zh: '验证集',
    basic: '训练过程中用来比较几种做法、帮忙做小决定的那部分数据。',
    advanced: '验证集用于调超参数和选模型；反复在它上面调参，也会慢慢把它「用旧」，所以最终仍要靠测试集做一次干净的评估。',
    probes: ['验证集和测试集的分工差别在哪？'],
  },
  'test set': {
    zh: '测试集',
    basic: '留到最后才用的一部分数据，用来估计模型面对没见过的数据时的表现。',
    advanced: '测试集必须模拟「未来」：不能和训练数据同源泄漏，也不能被反复用来调参，否则分数不再可信。',
    probes: ['测试分数虚高最常见的原因是什么？'],
  },
  'feature': {
    zh: '特征',
    basic: '描述一个样本的可测量属性，比如房价任务里的面积、房间数、到市中心的距离。模型只能对特征做运算。',
    advanced: '特征是模型的全部输入。预测时拿不到的信息不能当特征；把「答案的痕迹」做成特征，会造成训练时很准、上线就崩。',
    probes: ['为什么预测时拿不到的信息不能当特征？', '「用取消标记预测取消」错在哪里？'],
  },
  'label': {
    zh: '标签',
    basic: '我们希望模型预测的那个答案，比如房价、是否点击。监督学习必须有标签才能训练。',
    advanced: '标签是对过去的记录，不是预测时可用的输入。标签本身有噪声或偏差时，模型学到的也是这些偏差。',
    probes: ['没有标签的监督学习会怎样？'],
  },
  'dataset': {
    zh: '数据集',
    basic: '用来训练和评估模型的全部样本行。',
    advanced: '数据集不只是「数据多」：划分方式要贴近真实使用场景，否则评估结果会失真。',
    probes: ['为什么说数据集的好坏不只是「够不够大」？'],
  },
  'supervised': {
    zh: '监督学习',
    basic: '每个训练样本都带正确答案（标签），模型学习从特征到标签的映射。',
    advanced: '监督学习的目标是泛化，而不是记住训练集；因此需要独立的评估数据来衡量它在未见样本上的表现。',
    probes: ['监督学习和「记住训练集」有什么区别？'],
  },
  'inference': {
    zh: '推理（预测）',
    basic: '模型训练完成之后，用新样本算出结果的过程。',
    advanced: '推理阶段模型只看得到特征，看不到标签——这也解释了为什么特征必须包含预测时真实可获得的信息。',
    probes: ['推理时为什么看不到标签？'],
  },
};

const EXTRAS = {
  'features-labels-datasets': {
    abstractZh:
      '监督模型是从样本中学出来的函数。本文走一遍每个样本都带着的三样东西——特征、标签，以及把它们装在一起的数据集——并说明模型能看到什么、看不到什么。',
    translations: {
      'introduction-0':
        '在模型开始学习之前，数据必须先组织成样本。在监督任务里，每个样本都是一行，含两部分：一组描述输入的特征，以及一个记录着我们希望模型预测的答案的标签。数据集就是这些行的集合。',
      'introduction-1':
        '人们很容易把这种安排当成记账式的琐事，其实不然。这里做的选择决定了模型究竟能学到什么。如果一个有用的信号从未变成特征，再多的训练也找不回来。',
      'features-0':
        '特征是一个样本的可测量属性。在房价任务中，特征可能是面积、房间数，以及到市中心的距离。每个特征都是一个模型可以相乘、比较与组合的数值。',
      'features-1':
        '原始观测很少以可用的形式出现。日期、类别名或自由文本都必须先编码，模型才能使用。把原始观测转成数值特征的这一步叫特征工程，机器学习的大量实务能力就体现在这里。',
      'labels-0':
        '标签是模型被训练来预测的目标。在监督任务中，每个训练样本都带着一个标签，模型学习从特征到标签的映射。没有标签，就无所谓对错，监督学习也无从开始。',
      'labels-1':
        '标签必须被当作关于过去的证据，而不是预测时可用的特征。一个常见的错误是用已经包含答案的信息来构造特征——例如用「取消标记」去预测取消。这样的模型在训练时看起来很准，一投入使用就崩掉。',
      'datasets-0':
        '数据集是用来训练和评估模型的那批行。它通常被划分为训练集、验证集和测试集。训练集教模型，验证集指导小决定，测试集则被留起来，让最终分数反映未见过的数据。',
      'datasets-1':
        '这种划分必须尊重模型将来会被怎样使用。如果来自同一来源的行同时出现在训练集和测试集里，测试分数就会被抬高。好的数据集不只是大，而是把评估安排得像模型将来真正面对的未来。',
      'what-a-model-sees-0':
        '在推理阶段，模型只能看到特征。它永远看不到标签，因为标签正是它要产出的东西。训练则是调整模型的过程，使其在给定特征时输出的标签尽量接近过去记录的那些。',
      'what-a-model-sees-1':
        '实务上的教训既狭窄又长久：模型只能使用特征里存在的东西，也只能学到标签里存在的东西。干净的数据集、诚实的特征与可信的标签，比在脏数据上套一个更聪明的算法更有用。',
    },
    glossary: GLOSSARY,
  },
};

export const paperExtras = paperId => EXTRAS[paperId] || {abstractZh: '', translations: {}, glossary: {}};

const normalise = text => String(text || '')
  .toLowerCase()
  .replace(/[^a-z0-9\u4e00-\u9fa5]+/g, ' ')
  .trim();

// Find the longest glossary term contained in the selection (plural tolerated).
export function termEntry(paperId, text) {
  const glossary = paperExtras(paperId).glossary || {};
  const keys = Object.keys(glossary).sort((a, b) => b.length - a.length);
  const haystack = ' ' + normalise(text) + ' ';
  for (const key of keys) {
    const needle = normalise(key);
    if (!needle) continue;
    if (haystack.includes(' ' + needle + ' ') || haystack.includes(' ' + needle + 's ')) {
      return {term: key, ...glossary[key]};
    }
  }
  return null;
}

// Paragraph-level Chinese translation, keyed by section + paragraph index.
export function paragraphTranslation(paperId, sectionId, index) {
  const extras = paperExtras(paperId);
  return extras.translations[String(sectionId) + '-' + Number(index)] || '';
}

export function abstractTranslation(paperId) {
  return paperExtras(paperId).abstractZh || '';
}
