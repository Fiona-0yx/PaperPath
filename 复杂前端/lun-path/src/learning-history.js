import { findPaper } from '../shared/papers.js';
import { escape as h } from './components.js';
import { paperRoute } from './paper-route.js';
import { readLocal } from './reader-api.js';

const names={
  open_paper:'打开论文',view_section:'阅读章节',highlight:'划线',unhighlight:'取消划线',
  bookmark:'收藏',ask_ai:'向 AI 提问',save_answer:'保存回答',mark_resolved:'更新解决状态',
  view_source:'返回原文',finish_test:'完成读前测试',note_delete:'删除笔记',finish_review:'读后回顾',
  note_question:'记录疑问',portrait_saved:'更新学习画像',
};
const legacyTypes={
  'reader-open':'open_paper','note-jump':'view_source','position-jump':'view_source',
  'note-resolve':'mark_resolved','question-saved':'note_question','ai-question-sent':'ask_ai',
};
const evidenceTypes=new Set(['highlight','note_question','ask_ai','mark_resolved']);

function previousActivity() {
  const events=[];
  for(let i=0;i<localStorage.length;i++){
    const key=localStorage.key(i);
    if(!key?.startsWith('lunjing.activity.'))continue;
    const event=readLocal(key,null);
    const paper=event && findPaper(event.paperId), type=legacyTypes[event?.kind];
    if(!paper || !type || !Number.isFinite(event.at))continue;
    const anchor=event.range?.start || event.to;
    events.push({id:event.eventId,paperId:paper.id,categoryId:paper.categoryId,title:paper.title,
      time:new Date(event.at).toISOString(),type,pid:anchor?.paragraphId,section:anchor?.sectionId,resolved:event.resolved});
  }
  return events;
}

function historyEvents() {
  const saved=readLocal('lunjing-journal-v1',{})?.events;
  const events=Array.isArray(saved) ? saved.filter(e=>names[e?.type]) : [];
  try {events.push(...previousActivity());} catch {}
  return events.sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
}

function progressRows(events) {
  const papers=new Map();
  let portrait;
  for(const event of events){
    if(event.type==='portrait_saved'){portrait ||= event;continue;}
    if(!event.paperId)continue;
    if(!papers.has(event.paperId))papers.set(event.paperId,[]);
    papers.get(event.paperId).push(event);
  }
  const rows=portrait ? [portrait] : [];
  for(const events of papers.values()){
    const latest=events[0];
    const anchor=events.find(event=>event.pid || event.section);
    const review=events.find(event=>event.type==='finish_review');
    const test=events.find(event=>event.type==='finish_test');
    const testStatus=test ? (test.status==='skipped'?'已跳过读前测试':'已完成读前测试') : '';
    const read=events.some(event=>event.type!=='finish_test'&&event.type!=='finish_review');
    const label=read?'阅读进度':review?'读后回顾':testStatus;
    const summary=[read && testStatus, review && '读后自述：'+review.text].filter(Boolean).join('\n');
    rows.push({...latest,label,summary,section:anchor?.section,pid:anchor?.pid,sourceLabel:review?'来源 · 用户自述':''});
  }
  return rows.sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
}

export function mountHistory(root) {
  root.classList.add('learning-history');
  function render(tab) {
    const activity=tab==='history';
    root.innerHTML='<nav aria-label="学习记录"><button data-tab="history" aria-pressed="'+activity+'">学习时间轴</button> <button data-tab="evidence" aria-pressed="'+!activity+'">行为证据</button></nav>';
    const groups=new Map();
    for(const event of historyEvents()){
      if(!activity&&!evidenceTypes.has(event.type))continue;
      const time=new Date(event.time);
      if(!Number.isFinite(time.getTime()))continue;
      const day=time.toLocaleDateString('zh-CN');
      if(!groups.has(day))groups.set(day,[]);
      groups.get(day).push(event);
    }
    for(const [day,events] of groups){
      const rows=(activity ? progressRows(events) : events).map(event=>historyRow(event,activity));
      if(!rows.length)continue;
      root.insertAdjacentHTML('beforeend','<section><h3>'+h(day)+'</h3><ul>'+rows.join('')+'</ul></section>');
    }
    if(!groups.size)root.insertAdjacentHTML('beforeend','<p>还没有'+(activity?'学习记录':'行为证据')+'。</p>');
    root.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>render(button.dataset.tab));
  }
  render('history');
}

function historyRow(event,activity) {
  const {paperId,categoryId,id,pid,section,type}=event;
  const time=new Date(event.time);
  const title=event.title||paperId;
  const paper=findPaper(paperId);
  const paragraph=pid || (section ? section+'-p1' : null);
  const link=paperId && paperRoute(paperId,{categoryId:categoryId||paper?.categoryId,paragraph,source:'history'});
  const target=link?.startsWith('http') ? ' target="_top"' : '';
  const detail=activity ? event.summary : event.question||event.text;
  const action=type==='mark_resolved'?(event.resolved?'已解决':'重新打开'):names[type];
  const status=event.label || action;
  const source=event.sourceLabel || (type==='portrait_saved'?'已保存手账答案':activity?'':'来源 · 行为 · 低把握度');
  const heading=paper?.sections.find(entry=>entry.id===section)?.heading || section || '';
  return '<li data-event="'+h(id)+'"><time datetime="'+h(time.toISOString())+'">'+
    h(time.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit'}))+'</time><div><strong>'+h(status)+'</strong>'+
    (title ? ' · '+(link?'<a href="'+h(link)+'"'+target+'>'+h(title)+'</a>':h(title)) : '')+
    (heading ? '<small>'+h(heading)+'</small>' : '')+
    (detail?'<p>'+h(detail)+'</p>':'')+(source?'<small>'+h(source)+'</small>':'')+'</div></li>';
}
