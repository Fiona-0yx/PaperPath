const article = document.querySelector('article');
const radiation = new URLSearchParams(location.search).get('paper') === 'radiation';
if (radiation) {
  article.querySelector('.paper').replaceChildren(document.querySelector('#radiation-paper').content.cloneNode(true));
}
document.title = article.querySelector('h1').textContent + ' · 论径';
const headline = document.querySelector('.headline');
headline.append(article.querySelector('h1'), article.querySelector('.meta'), article.querySelector('.subtitle'));
const related = document.querySelector('#recommend');
related.href = radiation ? 'read.html' : 'read.html?paper=radiation';
related.querySelector('.thumb').textContent = radiation ? 'Q·K' : 'Rₙ';
document.querySelector('#related-title').textContent = radiation ? '理解自注意力机制' : '净辐射模拟与参考作物蒸散量估算';
function switchPane(id) {
  document.body.dataset.pane = id;
  for (const button of document.querySelectorAll('[data-pane]:is(button)')) {
    button.setAttribute('aria-pressed', String(button.dataset.pane === id));
  }
}
document.querySelectorAll('.switcher button').forEach(button => {
  button.onclick = () => switchPane(button.dataset.pane);
});
switchPane('paper');
const sections = [...article.querySelectorAll('section')];
const contents = document.querySelector('#contents');
const input = document.querySelector('#question');
const statusText = document.querySelector('#status');
const storageKey = radiation ? 'lunjing.radiation.demo.v1' : 'lunjing.attention.demo.v1';
let records = [];
try {
  const stored = JSON.parse(localStorage.getItem(storageKey));
  if (Array.isArray(stored)) records = stored;
} catch { /* The page also works in memory. */ }
let active = sections[0];
let draftSection = null;

function record(type, section, question) {
  records.push({ type, section: section.id, time: Date.now(), question });
  try {
    localStorage.setItem(storageKey, JSON.stringify(records));
    return true;
  } catch { return false; }
}
function jump(section, type) {
  switchPane('paper');
  record(type, section);
  article.scrollTop += section.getBoundingClientRect().top - article.getBoundingClientRect().top - 24;
  updateSection();
}
const links = sections.map(section => {
  const link = document.createElement('a');
  link.href = '#' + section.id;
  link.textContent = section.querySelector('h2').textContent;
  link.addEventListener('click', event => {
    event.preventDefault();
    jump(section, 'contents_click');
  });
  contents.append(link);
  return link;
});
function labelQuestion() {
  document.querySelector('#anchor').textContent = '关于「' + (draftSection || active).querySelector('h2').textContent + '」';
}
function updateSection() {
  if (!article.clientHeight) return;
  const marker = article.getBoundingClientRect().top + Math.min(110, article.clientHeight / 3);
  const current = sections.filter(section => section.getBoundingClientRect().top <= marker).pop() || sections[0];
  if (active !== current) record('section_visible', current);
  active = current;
  links.forEach((link, i) => {
    if (sections[i] === active) link.setAttribute('aria-current', 'location');
    else link.removeAttribute('aria-current');
  });
  labelQuestion();
}
function showNotes() {
  const list = document.querySelector('#notes');
  list.replaceChildren();
  const notes = records.filter(item => item?.type === 'question');
  document.querySelector('#count').textContent = notes.length;
  notes.reverse().forEach(note => {
    const section = sections.find(item => item.id === note.section);
    if (!section) return;
    const row = document.createElement('li');
    const button = document.createElement('button');
    button.textContent = section.querySelector('h2').textContent + ' · ' + note.question;
    button.onclick = () => jump(section, 'question_return');
    row.append(button);
    list.append(row);
  });
  if (!notes.length) list.textContent = '还没有记下问题。';
}
input.addEventListener('input', () => {
  draftSection = input.value.trim() ? draftSection || active : null;
  input.setCustomValidity('');
  statusText.textContent = '';
  labelQuestion();
});
document.querySelector('form').addEventListener('submit', event => {
  event.preventDefault();
  const question = input.value.trim();
  if (!question) {
    input.setCustomValidity('请先写下问题。');
    input.reportValidity();
    return;
  }
  const context = draftSection || active;
  const persisted = record('question', context, question);
  if (event.submitter?.value === 'ask') answerQuestion(question, context);
  input.value = '';
  draftSection = null;
  statusText.textContent = persisted ? '已记下，可在下方回看。' : '已暂存于本页，刷新后会消失。';
  labelQuestion();
  showNotes();
});
article.addEventListener('scroll', updateSection, { passive: true });
window.addEventListener('resize', updateSection);
updateSection();
record('reader_open', active);
const requested = sections.find(section => '#' + section.id === location.hash);
if (requested) requestAnimationFrame(() => jump(requested, 'question_return'));
showNotes();

const modelOptions = {
  expectedInputs: [{ type: 'text', languages: ['zh'] }],
  expectedOutputs: [{ type: 'text', languages: ['zh'] }]
};
let localAI = false;
async function checkModel() {
  try {
    localAI = await window.LanguageModel?.availability(modelOptions) === 'available';
    if (localAI) document.querySelector('#mode').textContent = '本机 AI · 结合本文回答';
  } catch { /* A browser without a Chinese model uses local passage lookup. */ }
}
checkModel();
const suggestion = document.querySelector('#suggest');
suggestion.textContent = radiation ? '训练集和测试集的峰值分别在哪个月？' : '查询、键和值各有什么作用？';
suggestion.onclick = () => {
  input.value = suggestion.textContent;
  input.dispatchEvent(new Event('input'));
  document.querySelector('#questions').requestSubmit(document.querySelector('.send'));
};
function relevantPassage(question, context) {
  const terms = new Set(question.toLowerCase().match(/[a-z0-9]+/g) || []);
  for (const run of question.match(/[\u3400-\u9fff]+/g) || []) {
    for (let i = 1; i < run.length; i++) terms.add(run.slice(i - 1, i + 1));
  }
  let best = null;
  for (const section of sections) {
    for (const paragraph of section.querySelectorAll('p')) {
      const body = paragraph.textContent.toLowerCase();
      let score = 0;
      for (const term of terms) if (body.includes(term)) score += term.length;
      if (score && section === context) score += 0.5;
      if (score && (!best || score > best.score)) best = { score, section, paragraph };
    }
  }
  return best;
}
async function answerQuestion(question, context) {
  const feed = document.querySelector('#messages');
  const prompt = document.createElement('p');
  prompt.className = 'message prompt';
  prompt.textContent = question;
  const reply = document.createElement('p');
  reply.className = 'message';
  reply.textContent = '正在查阅本文…';
  feed.append(prompt, reply);
  const match = relevantPassage(question, context);
  const send = document.querySelector('.send');
  send.disabled = true;
  suggestion.disabled = true;
  let session;
  try {
    if (localAI) {
      session = await window.LanguageModel.create(modelOptions);
      const result = await session.prompt('请用简体中文，根据下列文章回答问题。材料不足时说明原因。\n文章：' + article.innerText + '\n当前章节：' + context.querySelector('h2').textContent + '\n问题：' + question);
      reply.textContent = result;
    } else {
      reply.textContent = match ? '原文摘录 · ' + match.paragraph.textContent : '本文没有检索到相关段落。可以试试章节标题或文中的术语。';
    }
  } catch {
    reply.textContent = match ? '本机模型暂时不可用。原文摘录 · ' + match.paragraph.textContent : '本机模型暂时不可用，本文也没有检索到相关段落。';
  } finally {
    session?.destroy();
    send.disabled = false;
    suggestion.disabled = false;
  }
  if (match) {
    const source = document.createElement('button');
    source.className = 'source-link';
    source.textContent = '查看原文 · ' + match.section.querySelector('h2').textContent;
    source.onclick = () => jump(match.section, 'answer_source');
    reply.after(source);
  }
  feed.scrollTop = feed.scrollHeight;
}
