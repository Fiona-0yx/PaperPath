import { readFileSync } from 'node:fs';
import { introInferences } from './journal-intro-rules.mjs';
import { groveCategories } from '../../复杂前端/lun-path/shared/grove-categories.js';

const questions = JSON.parse(readFileSync(new URL('../../复杂前端/lun-path/shared/journal-questions.json', import.meta.url), 'utf8'));
const byId = new Map(questions.map(question => [question.id, question]));
const readingTopics = {
  'machine-learning': [
    ['训练集、验证集与过拟合', 'Training sets, validation sets, and overfitting'],
    ['训练误差和验证误差的变化如何帮助判断过拟合？', 'How do changes in training and validation error help identify overfitting?']
  ],
  'neural-networks': [
    ['损失函数与梯度下降', 'Loss functions and gradient descent'],
    ['作者怎样把预测误差转成一次参数更新？', 'How do the authors turn prediction error into a parameter update?']
  ],
  'deep-learning': [
    ['残差连接与深层网络训练', 'Residual connections in deep network training'],
    ['增加残差连接后，作者用什么对照实验说明训练发生了变化？', 'What controlled experiment shows how residual connections change training?']
  ],
  'computer-vision': [
    ['图像分类与数据增强', 'Image classification and data augmentation'],
    ['论文如何比较数据增强前后的分类表现，实验中固定了哪些条件？', 'How does the paper compare classification performance with and without augmentation, and what stays fixed?']
  ],
  'natural-language': [
    ['词向量与上下文表征', 'Word embeddings and contextual representations'],
    ['同一个词出现在不同句子里时，方法如何表示它，作者又如何验证这种区别？', 'How does the method represent the same word in different sentences, and how do the authors test that distinction?']
  ]
};
const reproductionTopics = {
  'machine-learning': [
    ['逻辑回归的基线复现', 'Reproducing a logistic regression baseline'],
    ['固定数据划分与评价指标后，能否复现论文中的逻辑回归基线？', 'Can you reproduce the logistic regression baseline using the same data split and evaluation metric?']
  ],
  'computer-vision': [
    ['图像分类的数据增强消融', 'Data augmentation ablation in image classification'],
    ['沿用同一数据划分和训练设置，启用一项增强后，验证集指标如何变化？', 'How does adding one augmentation affect the validation metric with the data split and training settings held fixed?']
  ],
  'natural-language': [
    ['词袋分类与文本预处理', 'Bag-of-words classification and text preprocessing'],
    ['只改一项分词或词频特征设置时，基线分类指标如何变化？', 'How does changing one tokenization or word-frequency feature setting affect the baseline metric?']
  ]
};

function requireValid(condition, field) {
  if (!condition) {
    throw Object.assign(new Error('Invalid questionnaire field: ' + field), {
      status: 400,
      code: 'INVALID_QUESTIONNAIRE'
    });
  }
}

function isRecord(value) {
  return value !== null && typeof value === 'object' &&
    [Object.prototype, null].includes(Object.getPrototypeOf(value));
}

function hasOnly(record, keys) {
  return Object.keys(record).every(key => keys.includes(key));
}

function isText(text, maxLength) {
  return typeof text === 'string' && text.length <= maxLength && Boolean(text.trim());
}

function readAnswer(question, answer, intro, path) {
  requireValid(isRecord(answer), path);
  const { source, text, edited, quote, values, other = '' } = answer;
  if (source === 'unknown') {
    requireValid(hasOnly(answer, ['source']), path);
    return { source };
  }
  if (source === 'self' && Object.hasOwn(answer, 'text')) {
    requireValid(hasOnly(answer, ['source', 'text', 'edited']) && isText(text, 1500) &&
      (edited === undefined || edited === true), path);
    return { source, text, ...(edited && { edited }) };
  }
  if (source === 'intro') {
    requireValid(hasOnly(answer, ['source', 'values', 'quote']) && typeof quote === 'string' && quote.length <= 1500 &&
      Array.isArray(values) && values.length === 1 && introInferences(quote).some(rule =>
        rule.quote === quote && rule.id === question.id && rule.option === values[0]) &&
      intro?.source === 'self' && intro.text.includes(quote), path);
    const supported = introInferences(intro.text).some(rule => rule.quote === quote);
    // Some older closing-page edits retained quotes inside a longer, changed clause.
    if (intro.edited && !supported) return { source: 'unknown' };
    requireValid(supported, path);
    return { source, values: [...values], quote };
  }
  requireValid(question.type !== 'text' && source === (question.type === 'check' ? 'check' : 'self') &&
    hasOnly(answer, ['source', 'values', 'other']) && Array.isArray(values) &&
    typeof other === 'string' && other.length <= 180, path);
  if (question.groups) {
    requireValid(values.length === question.groups.length && question.groups.every(({ options }, index) =>
      values[index] === null || (Number.isInteger(values[index]) &&
        values[index] >= 0 && values[index] < options.length)), path + '.values');
  } else {
    const maxChoices = question.type === 'multi' ? question.options.length : 1;
    requireValid(values.length <= maxChoices && new Set(values).size === values.length &&
      [...values].every(value => Number.isInteger(value) && value >= 0 && value < question.options.length),
    path + '.values');
  }
  requireValid(values.some(value => value !== null) || other.trim(), path);
  return { source, values: [...values], other: other.trim() };
}

function readSnapshot(snapshot) {
  requireValid(isRecord(snapshot) && hasOnly(snapshot, ['answers', 'evidence']), 'snapshot');
  const { answers, evidence = {} } = snapshot;
  requireValid(isRecord(answers) && Object.keys(answers).every(id => byId.has(id)), 'answers');
  requireValid(isRecord(evidence) && Object.keys(evidence).every(id => byId.get(id)?.type === 'check'), 'evidence');
  const intro = Object.hasOwn(answers, 'intro') ? readAnswer(byId.get('intro'), answers.intro, null, 'answers.intro') : null;
  return {
    answers: Object.fromEntries(Object.entries(answers).map(([id, answer]) => [
      id, readAnswer(byId.get(id), answer, intro, 'answers.' + id)
    ])),
    evidence: Object.fromEntries(Object.entries(evidence).map(([id, attempts]) => {
      const path = 'evidence.' + id;
      requireValid(Array.isArray(attempts), path);
      return [id, [...attempts].map((attempt, index) => {
        const result = readAnswer(byId.get(id), attempt, intro, path + '[' + index + ']');
        requireValid(result.source === 'check', path);
        return result;
      })];
    }))
  };
}

function describe(question, answer) {
  if (!answer || answer.source === 'unknown') return ['未知', 'Unknown'];
  if (answer.text !== undefined) return [answer.text, answer.text];
  return ['、', ', '].map((separator, language) => {
    const options = answer.values.map((value, index) => {
      const group = question.groups?.[index];
      const option = (group?.options ?? question.options)[value]?.[language];
      if (group) return group.label[language] + (language ? ' – ' : '：') +
        (option ?? ['未知', 'Unknown'][language]);
      return option;
    });
    return [...options, answer.other].filter(Boolean).join(separator);
  });
}

function answerStatus(question, answer) {
  if (!answer || answer.source === 'unknown') return 'unknown';
  if (answer.source === 'self') return 'self_reported';
  if (answer.source === 'intro') return 'inferred';
  if (answer.other) return 'unconfirmed';
  return answer.values[0] === question.correct ? 'correct' : 'incorrect';
}

function fieldReport(question, answer, history = []) {
  const attempts = [...history];
  if (answer?.source === 'check' && JSON.stringify(attempts.at(-1)) !== JSON.stringify(answer)) {
    attempts.push(answer);
  }
  const source = answer?.source ?? 'unknown';
  const edited = Boolean(answer?.edited || (question.type !== 'text' && answer?.text !== undefined));
  return {
    id: question.id,
    page: question.page,
    label: question.label,
    question: question.title,
    source,
    sourcePage: source === 'intro' ? 1 : edited || source === 'unknown' ? null : question.page,
    edited,
    status: answerStatus(question, answer),
    value: describe(question, answer),
    answer: answer ?? null,
    attempts: attempts.map(attempt => ({
      answer: attempt,
      value: describe(question, attempt),
      status: answerStatus(question, attempt)
    }))
  };
}

function findUnknowns(fields) {
  return fields.flatMap(({ id, status, answer }) => {
    const unknowns = [];
    if (status === 'unknown') unknowns.push({ id, reason: ['本项未填写或已跳过。', 'This item was left blank or skipped.'] });
    if (status === 'inferred') unknowns.push({ id, reason: ['来自自述的线索，有待确认。', 'This inference from the introduction still needs confirmation.'] });
    if (answer?.values?.includes(null)) {
      unknowns.push({ id, reason: ['本项部分信息缺失。', 'Part of this answer is missing.'] });
    }
    if (id === 'foundation') {
      const reason = status === 'unconfirmed'
        ? ['已记录开放作答，概念理解有待核对。', 'The open response is recorded and understanding remains to be checked.']
        : ['梯度下降能否应用到新例子，以及更广泛的数学基础，仍需通过试读确认。',
          'A reading exercise can verify application to a new example and explore broader mathematical preparation.'];
      unknowns.push({ id, reason });
    }
    return unknowns;
  });
}

function recommend(fields) {
  const field = Object.fromEntries(fields.map(item => [item.id, item]));
  const recommendations = [];
  const add = (basedOn, zh, en) => recommendations.push({ basedOn, message: [zh, en] });
  const selection = (id, value) => field[id].source === 'self' && field[id].answer?.values?.includes(value);
  if (['unknown', 'inferred'].includes(field.direction.status)) {
    add(['direction'], '在选文前确认本次最想了解的主题。', 'Confirm the topic of interest before choosing a paper.');
  } else {
    add(['direction'], '围绕已填写的方向，先挑一段摘要或引言试读。', 'Choose a short abstract or introduction in the stated area for a trial reading.');
  }
  const newReader = field.reading.source === 'self' && [0, 1].includes(field.reading.answer?.values?.[0]);
  if (newReader || selection('difficulty', 3)) {
    const basedOn = [];
    if (newReader) basedOn.push('reading');
    if (selection('difficulty', 3)) basedOn.push('difficulty');
    add(basedOn, '试读时先用一句话说出论文研究的问题，再看作者用了什么方法。', 'Start by stating the research question in one sentence, then identify the method.');
  }
  if (selection('english', 0) || selection('english', 1)) {
    add(['english'], '试读英文摘要时附上关键词释义，并用一句话核对大意。', 'Pair the English abstract with key-term glosses and check the main idea in one sentence.');
  }
  if (selection('difficulty', 1)) {
    add(['difficulty'], '遇到第一个关键公式时，先找出各符号指代的量，再看公式连接了哪些量。', 'At the first key equation, identify the quantities its symbols represent and how the equation relates them.');
  }
  if (selection('difficulty', 0) || selection('difficulty', 2)) {
    add(['difficulty'], '在试读段落中标出难懂的术语，并用一句话概括这段在论文中的作用。', 'Mark unfamiliar terms in the excerpt and summarize its role in the paper in one sentence.');
  }
  if (selection('outcome', 2)) {
    const needsCodingSupport = selection('python', 0) || selection('python', 1);
    add(needsCodingSupport ? ['outcome', 'python'] : ['outcome'],
      needsCodingSupport ? '先用最小可运行示例复现一个步骤，附上代码和运行提示。' : '试着复现方法中的一个关键步骤，记录输入、运行条件和预期输出。',
      needsCodingSupport ? 'Reproduce one step with a minimal runnable example and setup guidance.' : 'Reproduce one key step and record the inputs, run conditions, and expected output.');
  } else if (selection('outcome', 1)) {
    add(['outcome'], '读完用自己的话说明研究问题、方法和一条结果。', 'After reading, explain the research question, method, and one result in your own words.');
  }
  if (field.foundation.status === 'incorrect') {
    add(['foundation'], '用一条损失曲线说明导数的符号与参数更新方向，再试一道相同概念的新题。', 'Use a loss curve to connect the derivative’s sign to the update direction, then try a new question on the same concept.');
  } else {
    add(['foundation'], '试读涉及优化时，用一个具体例子核对参数更新方向与理由。', 'If the reading discusses optimization, use a concrete example to check the update direction and its rationale.');
  }
  return recommendations;
}

function paperDirections(fields, locale) {
  const english = locale === 'en';
  const L = (zh, en) => english ? en : zh;
  const { direction, outcome, reading, foundation } = Object.fromEntries(fields.map(field => [field.id, field]));
  const answer = direction.answer;
  const categoryAnswers = byId.get('direction').options;
  const labelsByLanguage = categoryAnswers.flat().map(label => label.toLowerCase());
  const correction = (answer?.text ?? answer?.other)?.split(/[、，,；;\n]/).map(part => part.trim().toLowerCase()).filter(Boolean);
  const correctedLabels = correction?.every(label => labelsByLanguage.includes(label)) ? correction : [];
  const selected = categoryAnswers.flatMap((labels, index) => {
    const chosen = answer?.values?.includes(index) ||
      labels.some(label => correctedLabels.includes(label.toLowerCase()));
    if (!chosen) return [];
    return groveCategories.filter(category => category.title.zh === labels[0]);
  });
  if (!selected.length) {
    return [{
      topic: L('确认一个优先选文方向', 'Choose a topic to read about first'),
      reason: L('问卷尚未提供可对应到主题分类的明确选项。', 'The questionnaire has no clear match for a reading category yet.'),
      readingQuestion: L(
        '这次最想先读机器学习基础、神经网络、深度学习、计算机视觉或自然语言处理中哪个方向？也可以写下具体问题。',
        'Would you like to start with machine learning foundations, neural networks, deep learning, computer vision, or natural language processing? You can also share a specific question.'
      ),
      evidenceIds: ['direction']
    }];
  }

  const target = outcome.answer?.values?.[0];
  const inexperienced = [0, 1].includes(reading.answer?.values?.[0]);
  return selected.map(category => {
    const [subtopic, question] = (target === 2 && reproductionTopics[category.id]) || readingTopics[category.id];
    const evidenceIds = ['direction'];
    const notes = [direction.source === 'intro'
      ? L('首句提供了这一兴趣线索，确认后再选文。', 'Your introduction suggests this topic. Confirm it before choosing a paper.')
      : L('问卷记录了对这一方向的兴趣。', 'You indicated an interest in this topic.')];
    let readingQuestion = L(...question);
    if (target !== undefined) {
      evidenceIds.push('outcome');
      notes.push([
        L('先用摘要和一张关键图理解问题与主要发现。', 'Use the abstract and one key figure to identify the research question and main finding.'),
        L('读摘要、方法概览和一条结果，再用自己的话解释三者的关系。', 'Read the abstract, methods overview, and one result, then explain how they connect in your own words.'),
        L('选有方法细节和实验设置的论文，先尝试复现一个步骤。', 'Choose a paper that documents its methods and experimental setup, then try reproducing one step.')
      ][target]);
    }
    if (inexperienced) {
      evidenceIds.push('reading');
      notes.push(L('从一段短材料开始，读通后再扩展到下一节。', 'Start with a short excerpt and move on once you can explain it.'));
    }
    if (category.id === 'neural-networks' && foundation.status === 'incorrect') {
      evidenceIds.push('foundation');
      notes.push(L('本次梯度下降自检答错，可在试读中核对这一概念。', 'Use the reading exercise to revisit the gradient descent question you missed.'));
      readingQuestion += L(' 梯度指向哪边，参数为什么通常沿相反方向更新？',
        ' Which direction does the gradient point, and why is the update usually in the opposite direction?');
    }
    return {
      category: category.id,
      topic: L(category.title.zh, category.title.en) + ' · ' + L(...subtopic),
      reason: notes.join(L('', ' ')),
      readingQuestion,
      evidenceIds
    };
  });
}

export function analyzeQuestionnaire(snapshot, { locale = 'zh' } = {}) {
  const { answers, evidence } = readSnapshot(snapshot);
  const fields = questions.map(question => fieldReport(
    question, answers[question.id], evidence[question.id]
  ));
  return {
    version: 1,
    fields,
    unknowns: findUnknowns(fields),
    recommendations: recommend(fields),
    paperDirections: paperDirections(fields, locale),
    limitations: [
      ['年级、阅读经历、英文阅读和 Python 实践来自用户自述。', 'Year of study, reading history, reading in English, and Python practice are self-reported.'],
      ['梯度下降自检的对错仅对应一道题。开放作答、迁移应用和整体水平需要进一步核对。', 'Correctness applies to the single gradient descent item. Open responses, transfer, and overall proficiency require further evidence.'],
      ['封底修正用于呈现当前画像，历史自检作答仍可追溯。', 'Last-page corrections describe the current portrait, while previous self-check attempts remain available.']
    ]
  };
}
