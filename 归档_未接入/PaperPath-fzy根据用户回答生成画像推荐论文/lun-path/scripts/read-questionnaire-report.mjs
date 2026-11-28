import { readdir, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const directory = fileURLToPath(new URL('../.local/questionnaire-reports/', import.meta.url));
const statuses = {
  unknown: '未知', self_reported: '自述', inferred: '由首句推测，待确认',
  correct: '本题答对', incorrect: '本题答错', unconfirmed: '开放作答，待确认'
};
const modelStatuses = { disabled: '未配置', available: '已生成建议', unavailable: '本次未取得建议' };

async function openReport(id) {
  if (id && !/^[a-f0-9]{64}$/.test(id)) throw Error('报告编号应为 64 位小写十六进制字符串。');
  let filename = id && id + '.json';
  if (!filename) {
    const names = (await readdir(directory)).filter(name => /^[a-f0-9]{64}\.json$/.test(name));
    const entries = await Promise.all(names.map(async name => ({ name, time: (await stat(path.join(directory, name))).mtimeMs })));
    filename = entries.sort((a, b) => b.time - a.time)[0]?.name;
    if (!filename) throw Error('还没有内部报告。请先提交手账封底的画像。');
  }
  return JSON.parse(await readFile(path.join(directory, filename), 'utf8'));
}

try {
  const { id, generatedAt, analysis, model, readingPlan } = await openReport(process.argv[2]);
  const labels = Object.fromEntries(analysis.fields.map(f => [f.id, f.label[0]]));
  const references = (ids = []) => ids.map(id => labels[id] ?? id).join('、');
  const showDirections = (title, entries) => {
    if (!entries?.length) return;
    console.log('\n' + title);
    for (const entry of entries) {
      console.log(`  ${entry.topic} 〔${references(entry.evidenceIds)}〕`);
      console.log('    ' + entry.reason);
      console.log('    试读问题  ' + entry.readingQuestion);
    }
  };
  console.log('问卷内部分析报告\n' + generatedAt + '\n' + id);
  if (readingPlan) {
    console.log('\n推荐阅读');
    if (readingPlan.clarification) console.log('  ' + readingPlan.clarification);
    for (const {title, paper, guide} of readingPlan.directions) {
      if (readingPlan.directions.length > 1 && readingPlan.primaryRecommendation?.paperId === paper.id) {
        console.log('  建议先读 · ' + readingPlan.primaryRecommendation.reason);
      }
      console.log(`  ${title} · ${paper.title} (${paper.year})\n    ${paper.url}\n    ${guide}`);
    }
    for (const tip of readingPlan.advice) console.log('  ' + tip);
  }
  console.log('\n当前画像与证据');
  for (const f of analysis.fields) {
    console.log(`  ${f.label[0]}（${statuses[f.status]}${f.edited || f.answer?.edited ? '，封底修改' : ''}）  ${f.value[0]}`);
    if (f.answer?.quote) console.log('    首句原话  ' + f.answer.quote);
    if (f.attempts.length) console.log('    自检原题  ' + f.question[0]);
    for (const a of f.attempts) console.log(`    ${a.value[0]}（${statuses[a.status]}）`);
  }
  console.log('\n待确认');
  for (const item of analysis.unknowns) console.log(`  ${labels[item.id]}  ${item.reason[0]}`);
  console.log('\n试读与带读建议');
  for (const r of analysis.recommendations) console.log(`  ${r.message[0]} 〔${references(r.basedOn)}〕`);
  showDirections('问卷选文方向', analysis.paperDirections);
  console.log('\n模型补充（' + (modelStatuses[model?.status] ?? '未记录') + '）');
  if (model?.provider) console.log('  服务  ' + model.provider);
  if (model?.reason) console.log('  原因  ' + model.reason);
  if (model?.answerAnalysis) {
    const { text, evidenceIds } = model.answerAnalysis;
    console.log(`  问卷解读  ${text} 〔${references(evidenceIds)}〕`);
  }
  showDirections('模型补充的选文方向', model?.paperDirections);
  for (const s of model?.suggestions ?? []) console.log(`  ${s.text} 〔${references(s.evidenceIds)}〕`);
  console.log('\n解释范围');
  for (const item of analysis.limitations) console.log('  ' + item[0]);
} catch (error) {
  console.error(error.code === 'ENOENT' ? '未找到内部报告。请先提交问卷或核对报告编号。' : error.message);
  process.exitCode = 1;
}
