import {escape as h} from './components.js';
const names={open_paper:'打开论文',view_section:'阅读章节',highlight:'划线',unhighlight:'取消划线',bookmark:'收藏',ask_ai:'向 AI 提问',save_answer:'保存回答',mark_resolved:'更新解决状态',view_source:'返回原文',finish_test:'完成读前测试',note_delete:'删除笔记'};
export function mountHistory(root){
  function render(tab){
    let events=[];
    try{events=(JSON.parse(localStorage.getItem('lunjing-journal-v1'))?.events||[]).filter(e=>names[e.type]);}catch{}
    events.sort((a,b)=>Date.parse(b.time)-Date.parse(a.time));
    const activity=tab==='history';
    root.innerHTML='<nav aria-label="学习记录"><button data-tab="history" aria-pressed="'+activity+'">学习时间轴</button> <button data-tab="evidence" aria-pressed="'+!activity+'">行为证据</button></nav>';
    let day='';
    for(const e of events){
      if(!activity&&!['highlight','ask_ai','mark_resolved'].includes(e.type))continue;
      const date=new Date(e.time),label=date.toLocaleDateString('zh-CN');
      if(day!==label){root.insertAdjacentHTML('beforeend','<h3>'+h(label)+'</h3>');day=label;}
      const title=e.title||e.paperId;
      const link='../index.html#/article?paper='+encodeURIComponent(e.paperId)+(e.pid?'&paragraph='+encodeURIComponent(e.pid):'');
      const detail=e.question||e.text||(e.durationMs?Math.round(e.durationMs/1000)+' 秒':'');
      const status=e.type==='mark_resolved'?(e.resolved?'已解决':'重新打开'):names[e.type];
      root.insertAdjacentHTML('beforeend','<p data-event="'+h(e.id)+'"><time>'+h(date.toLocaleTimeString('zh-CN'))+'</time> · '+h(status)+' · '+(window.name==='blog-home-grove'?'<a target="_parent" href="'+h(link)+'">'+h(title)+'</a>':h(title))+' '+h(e.section||'')+' '+h(detail)+(activity?'':' · 来源：行为 · 低把握度')+'</p>');
    }
    if(!day)root.insertAdjacentHTML('beforeend','<p>还没有'+(activity?'学习记录':'行为证据')+'。</p>');
    root.querySelectorAll('[data-tab]').forEach(button=>button.onclick=()=>render(button.dataset.tab));
  }
  render('history');
}
