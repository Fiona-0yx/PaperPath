import {escape as esc} from './components.js';
import {makeJournalArt} from './journal-art.js';
import {loadQuestions, answerText, provenance, evidenceDetails} from './portrait.js';

// Only exact, explicit statements are recognised in this fixed-question demo.
const explicit = [
  ['想入门神经网络','direction',1],['I want to get into neural networks','direction',1],
  ['不知道从哪篇开始','difficulty',3],['I am not sure which paper to start with','difficulty',3],
  ['为了完成课程作业','purpose',0],['我还没用过 Python','python',0]
];

export async function openJournal() {
  const shell = parent.journalShell;
  const state = shell.intake;
  const profileOnly=new URLSearchParams(location.search).get('view')==='portrait' && state.portraitReady;
  document.body.classList.toggle('profile-only',profileOnly);
  const en = shell.language === 'en';
  const L = (zh,eng)=>en?eng:zh;
  const local = pair=>pair[en?1:0];
  const [questions,art] = await Promise.all([
    loadQuestions(),
    makeJournalArt()
  ]);
  const byId = Object.fromEntries(questions.map(q=>[q.id,q]));
  const mobile = matchMedia('(max-width: 660px)');
  const pages=[];
  let index=0, step, repaint, missingId;
  const text=(id,value)=>document.getElementById(id).textContent=value;
  const setLabel=(id,value)=>document.getElementById(id).setAttribute('aria-label',value);
  document.documentElement.lang=en?'en':'zh-CN';
  document.title=L('论径 · 学习手账','Lun Jing · Field journal');
  text('home',L('‹ 回到路径','‹ Back to path'));
  text('language',L('English','中文'));
  document.getElementById('language').onclick=()=>shell.setLanguage(en?'zh':'en');
  setLabel('sbLeft',L('上一页','Previous page'));
  setLabel('sbRight',L('下一页','Next page'));
  for(const [id,zh,eng] of [['zIn','放大','Zoom in'],['zOut','缩小','Zoom out'],['loupeBtn','放大镜','Magnifier']])setLabel(id,L(zh,eng));
  text('sbHint',L('拖动书页边缘或使用两侧箭头翻页','Drag a page edge or use the arrows to turn'));
  const notice=document.createElement('p');
  notice.className='save-notice';notice.setAttribute('role','status');document.body.append(notice);
  const prompt=document.createElement('p');
  prompt.className='completion-notice';prompt.setAttribute('role','status');
  document.querySelector('.journal-nav').append(prompt);
  function save(){
    if(!shell.save())notice.textContent=L('浏览器未能保存进度，请保持本页打开。','Storage unavailable. Keep this page open.');
  }
  function rebuild(position){
    const summaryPage={key:'summary',title:L('我的初始画像','My starting portrait'),url:art.sheet};
    if(profileOnly){pages.splice(0,pages.length,summaryPage);index=0;return}
    const intro=questions[0];
    const active=questions.slice(1,-1).filter(q=>state.answers[q.id]?.source!=='intro');
    const groups=[[intro]];
    const size=mobile.matches?1:2;
    for(let i=0;i<active.length;i+=size)groups.push(active.slice(i,i+size));
    groups.push([byId.outcome]);
    pages.splice(0,pages.length,{key:'cover',title:L('用户初始画像采集','Your starting portrait'),url:art.cover},
      ...groups.map(items=>({key:items[0].id,items,url:art.sheet,title:items.map(q=>local(q.label)).join(' · ')})),
      summaryPage);
    index=Math.max(0,pages.findIndex(p=>p.key===position||p.items?.some(q=>q.id===position)));
  }
  function recordAnswer(q,d){
    if(q.type==='text'){
      if(d.text?.trim())state.answers.intro={source:'self',text:d.text};
      else delete state.answers.intro;
    }else if(d.values?.some(v=>v!==null)||d.other?.trim()){
      state.answers[q.id]={...d,source:q.type==='check'?'check':'self'};
    }else delete state.answers[q.id];
  }
  // Drafts from the former save-button flow may be newer than recorded answers.
  if(!state.autoSave){
    for(const q of questions){
      const d=state.drafts[q.id],a=state.answers[q.id];
      if(d && !a?.edited && !(a?.text!==undefined && q.type!=='text') &&
        !(q.type==='text' && a?.source==='unknown'))recordAnswer(q,d);
    }
    state.autoSave=true;save();
  }
  function complete(q){
    const a=state.answers[q.id];
    if(!a)return false;
    if(q.groups && a.source==='self' && !a.text && !a.other)
      return q.groups.every((_,i)=>Number.isInteger(a.values?.[i]));
    return true;
  }
  function summaryTarget(){
    missingId=questions.find(q=>!complete(q))?.id;
    prompt.textContent=missingId?L('请完成作答','Please complete your answer.'): '';
    return missingId?pages.findIndex(p=>p.items?.some(q=>q.id===missingId)):pages.length-1;
  }
  loadReaderStats();
  rebuild(state.position);
  if(!profileOnly && state.position==='summary')index=summaryTarget();
  const draft=q=>state.drafts[q.id]||{};
  function note(q) {
    const a=state.answers[q.id];
    if(!a)return '';
    if(a.source==='unknown')return L('已留白，记为未知。','Left open; recorded as unknown.');
    if(q.type==='check' && a.source==='check'){
      if(a.other)return L('已记录你的解释，理解程度待确认。','Explanation recorded; understanding is unconfirmed.');
      return a.values?.[0]===q.correct?L('这道题答对了：沿负梯度方向迈一小步，损失通常会减小。','Correct on this concept: a small step against the gradient usually reduces loss.'):L('这个概念还可再看看：梯度指向上升最快的方向，下降时通常取反方向。','Revisit this concept: the gradient points uphill, so descent uses the opposite direction.');
    }
    return L('已记入画像。','Saved to your portrait.');
  }
  function actions(q){
    return '<div class="actions"><button type="button" data-skip>'+L('跳过 / 不确定','Skip / unsure')+'</button></div><p class="answer-note" role="status">'+esc(note(q))+'</p>';
  }
  function question(q){
    const d=draft(q), opts=q.options;
    let fields='';
    if(q.type==='text'){
      fields='<textarea name="free" maxlength="1500" aria-label="'+esc(local(q.label))+'">'+esc(d.text||'')+'</textarea><div class="examples">'+opts.map((o,i)=>'<button type="button" data-example="'+i+'">'+esc(local(o))+'</button>').join('')+'</div>';
      return '<form data-q="intro"><h2>'+esc(local(q.title))+'</h2><p>'+esc(local(q.hint))+'</p>'+fields+'<div class="actions"><button type="submit">'+L('从这里开始','Start here')+'</button><button type="button" data-direct>'+L('直接问我几个问题','Ask me a few questions')+'</button></div></form>';
    }
    if(q.groups){
      fields=q.groups.map((g,i)=>'<label class="group">'+esc(local(g.label))+'<select name="group'+i+'"><option value="">'+L('暂未选择','Not selected')+'</option>'+g.options.map((o,j)=>'<option value="'+j+'" '+(d.values?.[i]===j?'selected':'')+'>'+esc(local(o))+'</option>').join('')+'</select></label>').join('');
    }else{
      const type=q.type==='multi'?'checkbox':'radio';
      fields=opts.map((o,i)=>'<label class="choice"><input type="'+type+'" name="choice" value="'+i+'" '+(d.values?.includes(i)?'checked':'')+'>'+esc(local(o))+'</label>').join('');
    }
    fields+='<label class="other">'+L('其他','Other')+'<input name="other" maxlength="180" value="'+esc(d.other||'')+'" placeholder="'+L('可自行补充','In your own words')+'"></label>';
    return '<form data-q="'+q.id+'"><small>'+q.page+' / 10 · '+esc(local(q.label))+'</small><h2>'+esc(local(q.title))+'</h2><p>'+esc(local(q.hint))+'</p>'+fields+actions(q)+'</form>';
  }
  function summary(group){
    return group.map(q=>{const a=state.answers[q.id];
      return '<label class="summary-row">'+esc(local(q.label))+'<input data-edit="'+q.id+'" maxlength="1500" placeholder="'+L('未知','Unknown')+'" value="'+esc(a&&a.source!=='unknown'?answerText(q,a,L):'')+'"><small>'+esc(provenance(q,a,L))+'</small></label>'+evidenceDetails(q,state.evidence[q.id],L);
    }).join('');
  }
  // Reading doubts gathered by the paper reader, shown on the portrait as
  // "observations to be analysed". No agent result is invented here.
  function readingObservations(){
    const notes=(state.readingNotes||[]).filter(n=>n.type!=='bookmark');
    if(!notes.length)return '';
    const items=notes.slice().sort((a,b)=>(b.createdAt||0)-(a.createdAt||0)).map(n=>{
      const tag=n.type==='question'?L('有疑问','Question'):L('需要解释','Explain');
      const stateText=n.type==='explain'&&n.status==='unavailable'?L('分析暂不可用，已记录待处理','analysis unavailable, recorded for later'):L('待 Agent 分析','pending agent analysis');
      return '<li class="observation"><span>'+esc(n.text)+'</span><small>'+esc(tag)+' · '+esc(stateText)+'</small></li>';
    }).join('');
    return '<section class="reading-observations"><h3>'+L('学习观察 · 待分析','Learning observations · pending')+'</h3><p class="obs-hint">'+L('来自论文阅读时记下的疑问；Agent 分析接入后，这里会补充反复出现的薄弱知识点。','Doubts recorded while reading. Weak points will appear here once the agent analysis is connected.')+'</p><ol>'+items+'</ol></section>';
  }
  // Rule-based statistics from the local interaction log. Counts only: no agent
  // conclusion is inferred here, and a failed fetch simply shows "unavailable".
  let stats = null;
  let statsLoading = true;
  function statsSnapshot(data) {
    return {
      updatedAt: data.updatedAt || Date.now(),
      total: Number(data.total) || 0,
      menuOpened: Number(data.funnel?.menuOpened) || 0,
      dismissed: Number(data.funnel?.dismissed) || 0,
      acted: Number(data.funnel?.acted) || 0,
      byAction: data.byAction || {},
      days: Number(data.span?.days) || 0,
      weakTerms: Array.isArray(data.weakTerms) ? data.weakTerms.slice(0, 5) : [],
      topSections: Array.isArray(data.topSections) ? data.topSections.slice(0, 3) : [],
      observations: Array.isArray(data.observations) ? data.observations.slice(0, 5) : [],
      lifecycle: data.lifecycle || {},
    };
  }
  async function loadReaderStats() {
    try {
      const response = await fetch('/api/reader/summary', {cache: 'no-store'});
      if (!response.ok) throw new Error('HTTP ' + response.status);
      stats = statsSnapshot(await response.json());
      state.readerStats = stats;
      save();
    } catch {
      stats = state.readerStats || null;
    } finally {
      statsLoading = false;
      if (typeof repaint === 'function') repaint();
    }
  }
  function readingStats() {
    const head = '<h3>' + L('阅读行为统计 · 系统规则统计', 'Reading activity · rule-based') + '</h3>';
    if (statsLoading && !stats) {
      return '<section class="reading-stats">' + head + '<p class="stats-hint">' + L('正在读取本机阅读记录…', 'Reading the local activity log…') + '</p></section>';
    }
    if (!stats) {
      return '<section class="reading-stats">' + head + '<p class="stats-hint">' + L('暂未取得统计（需要启动本地服务）。', 'Statistics unavailable (start the local service).') + '</p></section>';
    }
    const n = value => Number(value) || 0;
    const acts = stats.byAction || {};
    const life = stats.lifecycle || {};
    const cells = [
      [L('右键菜单', 'Context menus'), n(stats.menuOpened)],
      [L('选择操作', 'Actions'), n(stats.acted)],
      [L('收藏', 'Saved'), n(acts.bookmark)],
      [L('有疑问', 'Questions'), n(acts.question)],
      [L('需解释', 'Explain'), n(acts.explain)],
      [L('已解决', 'Resolved'), n(life.resolved)],
      [L('已删除', 'Deleted'), n(life.deleted)],
      [L('跳回原文', 'Jumped back'), n(life.jumped)],
    ];
    const grid = '<dl class="stat-grid">' + cells.map(([label, value]) =>
      '<div><dt>' + esc(label) + '</dt><dd>' + value + '</dd></div>').join('') + '</dl>';
    const dismissed = '<p class="stats-line">' + L('右键后未选择即关闭：', 'Closed without choosing: ') + n(stats.dismissed) + L(' 次', ' times') + '</p>';
    const span = '<p class="stats-line">' + L('活跃天数：', 'Active days: ') + n(stats.days) + L(' 天', ' days') + '</p>';
    const terms = (stats.weakTerms || []).map(item =>
      '<li><b>' + esc(item.term) + '</b><span>×' + n(item.count) + '</span></li>').join('');
    const termsBlock = terms
      ? '<p class="stats-label">' + L('反复关注的词句', 'Recurring focus') + '</p><ul class="stat-terms">' + terms + '</ul>'
      : '<p class="stats-line">' + L('还没有重复出现的疑问词。', 'No recurring terms yet.') + '</p>';
    const sections = (stats.topSections || []).map(item =>
      '<li>' + esc(item.section) + '<span>×' + n(item.count) + '</span></li>').join('');
    const sectionsBlock = sections
      ? '<p class="stats-label">' + L('疑问集中的章节', 'Sections with most doubts') + '</p><ul class="stat-terms">' + sections + '</ul>'
      : '';
    const obsItems = (stats.observations || []).map(item =>
      '<li><b>' + esc(item.title) + '</b>' + esc(item.text) +
      '<small>' + esc(item.evidence) + ' · ' + esc(L('规则：', 'rule: ') + (item.rule || '')) + '</small></li>').join('');
    const obsBlock = obsItems
      ? '<div class="stat-observations"><h4>' + L('学习观察 · 规则推断', 'Observations · rule-based') + '</h4>' +
        '<p class="stats-hint">' + L('由上面的统计按固定规则生成，不是 Agent 结论；留待后续 Agent 复核后补充进画像。', 'Produced from the counts above by fixed rules — not an agent conclusion. Kept for later review before extending the portrait.') + '</p>' +
        '<ul class="stat-obs">' + obsItems + '</ul></div>'
      : '<p class="stats-line">' + L('记录还太少，暂不足以形成学习观察。', 'Not enough records yet to form observations.') + '</p>';
    return '<section class="reading-stats">' + head +
      '<p class="stats-hint">' + L('根据本机记录的右键与笔记操作汇总，供后续 Agent 刻画画像使用。', 'Summarised from local right-click and note activity for later agent profiling.') + '</p>' +
      grid + dismissed + span + termsBlock + sectionsBlock + obsBlock + '</section>';
  }
  function face(side,html){
    const el=document.createElement('section');el.className='journal-face '+side;el.innerHTML=html;return el;
  }
  function display(book,i,turning,preview=false){
    index=i;
    const p=pages[i];
    document.body.dataset.spread=p.key;
    const collapsed=mobile.matches&&p.key!=='cover';
    document.body.classList.toggle('single-sheet',mobile.matches);
    if(turning)return;
    if(!preview && !profileOnly){
      if(p.key==='summary')state.portraitReady=true;
      state.position=p.key;state.started=true;save();
      prompt.hidden=Boolean(missingId && !p.items?.some(q=>q.id===missingId));
    }
    if(p.key==='cover'){
      book.append(face('cover-title',esc(p.title)));
    }else if(p.key==='summary'){
      const heading='<h2>'+L('我的初始画像','My starting portrait')+'</h2><p>'+L('点文字即可修改，留白的地方保持未知。','Edit any entry. Blank fields stay unknown.')+'</p>';
      const done=profileOnly?'':'<div class="actions portrait-actions"><button type="button" data-submit-portrait>'+L('提交','Submit')+'</button></div>';
      const observations=readingObservations();
      const statistics=readingStats();
      if(collapsed)book.append(face('full',heading+summary(questions)+observations+statistics+done));
      else book.append(face('left',heading+summary(questions.slice(0,5))),face('right',summary(questions.slice(5))+observations+statistics+done));
    }else if(p.key==='intro'&&!collapsed){
      book.append(face('left intro-art','<img src="/assets/botanical/botany-left.png" alt="">'),face('right',question(p.items[0])));
    }else{
      p.items.forEach((q,j)=>book.append(face(collapsed?'full':j?'right':'left',question(q))));
      if(p.key==='outcome'){
        const exits='<div class="portrait-actions journal-exits"><button type="button" data-view-portrait>'+L('查看学习画像','View learning portrait')+'</button><a class="done" href="/#/trial" target="_parent">'+L('进一步测试完善画像','Refine portrait with another test')+'</a></div>';
        if(collapsed)book.lastElementChild.insertAdjacentHTML('beforeend',exits);
        else book.append(face('right exit-page',exits));
      }
    }
    // Only the visible book has live fields; the loupe duplicates the picture.
    book.querySelectorAll('.sb-zone').forEach((b,j)=>{b.tabIndex=-1;b.setAttribute('aria-label',j?L('下一页','Next page'):L('上一页','Previous page'));});
  }
  function readForm(form,q){
    const data=new FormData(form);
    if(q.type==='text')return {text:String(data.get('free')||'')};
    const values=q.groups?q.groups.map((g,i)=>data.get('group'+i)===''?null:Number(data.get('group'+i))):data.getAll('choice').map(Number);
    return {values,other:String(data.get('other')||'').trim()};
  }
  function updateIntro(infer){
    for(const q of questions)if(state.answers[q.id]?.source==='intro')delete state.answers[q.id];
    if(infer){
      const value=draft(byId.intro).text||'';
      recordAnswer(byId.intro,{text:value});
      for(const clause of value.split(/[，。！？；,;.!?\n]/).map(s=>s.trim())){
        for(const [quote,id,option] of explicit){
          if(quote===clause&&!state.answers[id]&&!state.drafts[id])state.answers[id]={source:'intro',values:[option],quote};
        }
      }
    }else state.answers.intro={source:'unknown'};
    rebuild('intro');save();
  }
  function focusMissing(book){
    if(!missingId)return;
    const form=book.querySelector('form[data-q="'+missingId+'"]');
    if(!form)return;
    prompt.hidden=false;
    form.classList.add('needs-answer');
    const target=form.querySelector('select:has(option:checked[value=""])') || form.querySelector('textarea,input,select');
    target?.focus({preventScroll:true});
  }
  function clearPrompt(q){
    if(missingId!==q.id || !complete(q))return;
    missingId=null;prompt.textContent='';
    document.querySelector('#sbBook .needs-answer')?.classList.remove('needs-answer');
  }
  function bind(turn,refresh){
    step=turn;repaint=refresh;
    const book=document.getElementById('sbBook');
    book.addEventListener('input',e=>{
      const form=e.target.closest('form');
      if(form){
        const q=byId[form.dataset.q],d=readForm(form,q);
        state.drafts[q.id]=d;
        if(q.type==='text')updateIntro(true);
        else{
          recordAnswer(q,d);save();
          form.querySelector('.answer-note').textContent=note(q);
        }
        clearPrompt(q);
      }else if(e.target.dataset.edit){
        const field=e.target.dataset.edit, text=e.target.value;
        state.answers[field]=text.trim()?{source:'self',text,edited:true}:{source:'unknown'};
        if(field==='intro'){
          state.drafts.intro={text};
          for(const [id,answer] of Object.entries(state.answers)){
            if(answer.source==='intro'&&!text.includes(answer.quote)){
              delete state.answers[id];
              const related=book.querySelector('[data-edit="'+id+'"]');
              if(related){related.value='';related.nextElementSibling.textContent=provenance(byId[id],null,L)}
            }
          }
        }else state.drafts[field]={other:text};
        e.target.nextElementSibling.textContent=provenance(byId[field],state.answers[field],L);save();
      }
    });
    book.addEventListener('change',e=>{
      const id=e.target.closest('form')?.dataset.q;
      if(state.answers[id]?.source==='check'){shell.recordCheck(id,state.answers[id]);save()}
    });
    book.addEventListener('click',e=>{
      const b=e.target.closest('button'),form=b?.closest('form');
      if(b?.hasAttribute('data-view-portrait')){step('next');return}
      if(b?.hasAttribute('data-submit-portrait')){
        if(shell.submitPortrait())parent.location.hash='#/profile';
        else notice.textContent=L('画像未能保存，请重新提交。','Your portrait could not be saved. Please submit again.');
        return;
      }
      if(!form)return;
      const q=byId[form.dataset.q];
      if(b.hasAttribute('data-example')){
        form.elements.free.value=local(q.options[Number(b.dataset.example)]);
        form.elements.free.dispatchEvent(new Event('input',{bubbles:true}));form.elements.free.focus();
      }
      if(b.hasAttribute('data-direct')){updateIntro(false);clearPrompt(q);step('next')}
      if(b.hasAttribute('data-skip')){
        state.answers[q.id]={source:'unknown'};delete state.drafts[q.id];clearPrompt(q);save();repaint();
      }
    });
    book.addEventListener('submit',e=>{
      e.preventDefault();const form=e.target,q=byId[form.dataset.q],d=readForm(form,q);
      if(q.type==='text'){
        if(d.text.trim()){updateIntro(true);step('next')}else form.elements.free.focus();
      }
    });
    mobile.addEventListener('change',()=>{rebuild(state.position);repaint()});
  }
  function refreshSummaryIndex(){rebuild('summary');return index}
  return {pages,get index(){return index},bind,display,summaryTarget,focusMissing,refreshSummaryIndex};
}
