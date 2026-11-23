import { papers, branches, nextQuestion } from '/shared/domain.js';
import { restore, persist, blankState, clearSaved, importState, download } from './state.js';
import { learning } from './services.js';
import { escape as h, leaf } from './components.js';
import * as views from './views.js';
import { groveState } from './grove.js';

let s=restore();
let ui={question:null,choice:null,other:'',stage:'diagnostic',help:'guide',mobilePane:'read',section:null,shelfPaper:null,assessmentResult:null,inQuestions:false};
let busy=false,toastTimer;
let groveScrollTick=0;
const root=document.querySelector('#app');
const L=(zh,en)=>s.language==='en'?en:zh;
const loc=value=>typeof value==='object'&&value?value[s.language]||value.en||value.zh||'':String(value??'');
const fieldLabels={goal:['学习目的','Learning goal'],direction:['研究方向','Direction'],experience:['相关经历','Experience'],deadline:['时间安排','Time frame'],output:['期望成果','Desired outcome']};
const values={project:['竞赛或科研项目','Competition or project'],report:['课程或研究报告','A research report'],explore:['探索新方向','Explore a direction'],plants:['植物病害图像分类','Plant disease image classification'],nlp:['自然语言处理','Natural language processing'],beginner:['刚刚开始','Just beginning'],python:['会使用 Python','Some Python experience'],reproduced:['复现过模型','Have reproduced a model'],trained:['有模型训练经验','Have trained a model'],week:['一周内','Within a week'],fortnight:['两周内','Within two weeks'],flexible:['按自己的节奏','At my own pace'],overview:['结构化阅读概览','A structured reading overview'],reproduce:['复现一个基线','Reproduce a baseline'],improve:['改进与比较实验','Improvement and comparison'],uncertain:['暂不确定','Not sure yet']};
const fieldLabel=k=>fieldLabels[k]?L(...fieldLabels[k]):k;
const fieldValue=(k,v)=>{const pair=values[v]||Object.values(values).find(pair=>pair.includes(v));return pair?L(...pair):String(v||'');};
function route(){try{const bits=(location.hash.replace(/^#\/?/,'')||'home').split('/').map(decodeURIComponent);return {name:bits[0],id:bits[1],stage:bits[2]};}catch{return {name:'missing'};}}
function save(){if(!persist(s))toast(L('浏览器存储空间不足，请导出手记保存。','Browser storage is unavailable. Export your journal to keep it.'));}
function record(zh,en){s.activity.push({at:new Date().toISOString(),text:{zh,en}});s.activity=s.activity.slice(-60);}
function go(path){const target='#/'+path;if(location.hash===target){render();return;}location.hash=target;}
function toast(text){clearTimeout(toastTimer);const el=document.querySelector('#toast');el.textContent=text;el.classList.add('show');toastTimer=setTimeout(()=>el.classList.remove('show'),3200);}
const ctx=()=>({s,ui,L,loc,route:route(),papers,branches,fieldLabel,fieldValue,recommended:s.evidence.some(e=>['incorrect','uncertain'].includes(e.status))?'foundations':s.completed.some(id=>papers.find(p=>p.id===id)?.branch==='methods')?'practice':s.evidence.some(e=>e.status==='correct')?'methods':'foundations'});
function header(r){const nav=[['home',L('花园入口','Welcome')],['garden',L('学习花园','My garden')],['shelf/foundations',L('论文书架','Paper shelf')],['profile',L('我的成长','My growth')]];return `<header class="site-header"><a class="brand" href="#/home" aria-label="${L('论径，回到首页','Lun Jing, home')}">${leaf}<span><span class="brand-name">${L('论径','Lun Jing')}</span><span class="brand-caption">A GROWING FIELD JOURNAL</span></span></a><nav class="main-nav" aria-label="${L('主导航','Main navigation')}">${nav.map(([path,label])=>`<a href="#/${path}" class="${r.name===path.split('/')[0]?'active':''}" ${r.name===path.split('/')[0]?'aria-current="page"':''}>${label}</a>`).join('')}</nav><div class="header-tools"><button class="demo-label" data-action="about">${L('演示手记','Demo journal')}</button><div class="language-toggle" aria-label="${L('界面语言','Interface language')}"><button data-lang="zh" class="${s.language==='zh'?'active':''}" aria-pressed="${s.language==='zh'}">中文</button><span>/</span><button data-lang="en" class="${s.language==='en'?'active':''}" aria-pressed="${s.language==='en'}">EN</button></div></div></header>`;}
function footer(){return `<footer class="site-footer"><span>© 2026 ${L('论径 · 保持好奇，允许慢慢来。','Lun Jing · Stay curious. Take your time.')}</span><span class="footer-middle">LITTLE BY LITTLE, LEAF BY LEAF.</span><button data-action="export">${L('带走我的学习手记','Take my journal with me')}</button></footer>`;}
function render(){const r=route(),c=ctx();document.documentElement.lang=s.language==='en'?'en':'zh-CN';document.title=L('论径 · 一册生长的学习手记','Lun Jing · A growing field journal');let content;
  if(r.name==='home')content=views.home(c);
  else if(r.name==='journal')content=views.journal(c);
  else if(r.name==='confirm')content=views.confirm(c);
  else if(r.name==='trial')content=`<section class="screen">${views.assessment(c,papers.find(p=>p.id===r.id)||papers[0],'diagnostic',{trial:true})}</section>`;
  else if(r.name==='garden')content=views.garden(c);
  else if(r.name==='shelf')content=views.shelf(c);
  else if(r.name==='paper')content=views.paper(c);
  else if(r.name==='profile')content=views.profile(c);
  else content=views.missing(c);
  const isGrove=['home','garden'].includes(r.name);
  document.body.classList.toggle('is-grove',isGrove);
  const existingGrove=root.querySelector('#grove-frame');
  if(isGrove&&existingGrove){
    existingGrove.contentWindow?.postMessage({type:'grove-state',state:groveState(c)},location.origin);
    root.querySelector('.grove-shell').dataset.view=r.name;
    const brand=root.querySelector('.grove-brand');brand.innerHTML=leaf+`<span>${L('论径','Lun Jing')}<small>A LIVING FIELD JOURNAL</small></span>`;
    root.querySelector('.grove-demo').textContent=L('演示手记','Demo journal');
    root.querySelectorAll('[data-lang]').forEach(el=>{el.classList.toggle('active',el.dataset.lang===s.language);el.setAttribute('aria-pressed',String(el.dataset.lang===s.language));});
  }else root.innerHTML=isGrove?`<main id="main" tabindex="-1">${content}</main>`:header(r)+`<main id="main" tabindex="-1">${content}</main>`+footer();
  if(busy)root.querySelectorAll('button[type="submit"]').forEach(el=>el.disabled=true);
}
function resetUI(){ui.choice=null;ui.other='';ui.assessmentResult=null;ui.highlight=null;}
function onRoute(){const r=route();const keepGroveScroll=r.name==='garden'&&Boolean(root.querySelector('#grove-frame'));resetUI();if(r.name==='paper'){
    const p=papers.find(p=>p.id===r.id);if(p){s.lastPaper=p.id;ui.stage=r.stage||((s.attempts.some(a=>a.paperId===p.id&&a.stage==='diagnostic'))?'read':'diagnostic');ui.section=s.lastSection[p.id]||p.sections[0].id;ui.mobilePane='read';s.visited=[...new Set([...s.visited,p.id])];save();}
  }
  if(r.name==='shelf'){ui.shelfPaper=null;}
  render();if(!keepGroveScroll)window.scrollTo({top:0,behavior:'instant'});syncGroveTravel();
}
function groveRange(){const shell=root.querySelector('.grove-shell');if(!shell)return null;const top=shell.getBoundingClientRect().top+scrollY;const range=Math.max(1,shell.offsetHeight-innerHeight);return {top,range,progress:Math.max(0,Math.min(1,(scrollY-top)/range))};}
function syncGroveTravel(){const range=groveRange(),frame=root.querySelector('#grove-frame');if(range&&frame)frame.contentWindow?.postMessage({type:'grove-travel',progress:range.progress},location.origin);}
function jumpGrove(progress){const range=groveRange();if(!range)return;window.scrollTo({top:range.top+Math.max(0,Math.min(1,progress))*range.range,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});}
window.addEventListener('scroll',()=>{if(groveScrollTick)return;groveScrollTick=requestAnimationFrame(()=>{groveScrollTick=0;syncGroveTravel();});},{passive:true});
window.addEventListener('resize',syncGroveTravel,{passive:true});
async function task(fn,button){if(busy)return;busy=true;if(button){button.disabled=true;button.dataset.original=button.textContent;button.textContent=L('正在整理…','One moment…');}try{await fn();}catch(error){console.error(error);toast(L('这一步暂时没有完成，记录仍在。请再试一次。','This step did not finish. Your notes are safe; please try again.'));}finally{busy=false;root.querySelectorAll('button[type="submit"]').forEach(el=>el.disabled=false);if(button&&button.isConnected){button.disabled=false;button.textContent=button.dataset.original||button.textContent;}}}
async function askNext(){const result=await learning.next(s.profile,s.history,s.language);resetUI();if(result.action==='complete'){ui.question=null;ui.inQuestions=false;s.profile={...s.profile,...result.profile};save();go('confirm');}else{ui.question=result.question;ui.inQuestions=true;if(route().name!=='journal')go('journal');else{render();if(!matchMedia('(prefers-reduced-motion: reduce)').matches)document.querySelector('.right-page')?.animate([{opacity:.4,transform:'rotateY(-4deg)'},{opacity:1,transform:'rotateY(0)'}],{duration:320,easing:'ease-out'});}}}
function paperNow(){return papers.find(p=>p.id===route().id)||papers[0];}
function currentStage(){return route().name==='trial'?'diagnostic':ui.stage;}
function saveAssessment(result){const p=paperNow();const entry={...result,id:crypto.randomUUID(),at:new Date().toISOString(),paperTitle:p.title.replace('Demo: ',''),label:p[result.stage]?.question,source:'assessment'};s.attempts.push(entry);s.evidence=s.evidence.filter(e=>!(e.paperId===entry.paperId&&e.stage===entry.stage));s.evidence.push(entry);record('记录了一次理解检查','Saved a reflection');save();return entry;}
function markSection(p,id){s.readSections[p.id]=[...new Set([...(s.readSections[p.id]||[]),id])];save();}
function dialog(title,body){const d=document.querySelector('#dialog');d.innerHTML=`<button class="dialog-close" data-close-dialog aria-label="${L('关闭','Close')}">×</button><h2 id="dialog-title">${title}</h2>${body}`;d.showModal();}
function statusModal(){dialog(L('这册手记的说明','About this journal'),`<p>${L('这是“论径”的完整前端演示。你可以填写目标、体验分支提问、阅读虚构论文、完成测评并保存自己的记录。','This is a complete frontend demonstration of Lun Jing. Share a goal, follow branching questions, read fictional papers, reflect and save your own notes.')}</p><p>${L('当前问题与回复由模拟规则和教学材料提供，尚未连接真实模型或学术检索。模型提供方及各步骤的选型仍待确定。','Questions and replies currently use demo rules and teaching fixtures. Live models and academic search are not connected; providers remain undecided.')}</p><p>${L('记录只保存在当前浏览器。换设备前，可以导出 JSON 手记，在另一台设备导入。界面语言切换不会翻译论文原文。','Notes are kept in this browser. Export a JSON journal to take them to another device. Changing the interface language never translates the paper text.')}</p>`);}
async function tutor(question){const p=paperNow();if(!question.trim()){toast(L('先写下一个问题吧。','Write a question first.'));return;}const result=await learning.tutor({paperId:p.id,question,lang:s.language,sectionId:ui.section});const grounded=p.sections.some(sec=>sec.id===result.sectionId&&sec.body.includes(result.quote));if(!grounded){toast(L('这条讲解缺少原文依据，暂不展示。','This explanation has no matching source passage.'));return;}s.chat[p.id]=[...(s.chat[p.id]||[]),{...result,question}].slice(-6);ui.help='guide';ui.mobilePane='help';save();render();}
root.addEventListener('submit',event=>{const form=event.target.closest('[data-form]');if(!form)return;event.preventDefault();const data=new FormData(form),button=form.querySelector('button[type="submit"]');task(async()=>{
  switch(form.dataset.form){
    case 'intro':{
      const text=String(data.get('intro')||'').trim();if(!text){toast(L('可以写几句话，或选择“直接问我几个问题”。','Write a little, or choose to be asked a few questions.'));return;}
      s.intro=text;const result=await learning.introduce(text,s.language);s.profile={...blankState().profile,...result.profile};s.introProfile={...s.profile};s.history=[];s.onboarded=false;s.diagnosed=false;record('写下了旅程的起点','Wrote a starting note');save();await askNext();break;
    }
    case 'question':{
      const q=ui.question;if(!q)return;const answer=data.get('answer');const other=String(data.get('other')||'').trim();if(!answer||(answer==='other'&&!other)){toast(L('选择一项，或写下你的补充。也可以暂时跳过。','Choose an option or write your own answer. You may also skip.'));return;}
      const value=answer==='other'?other:String(answer);s.profile[q.field]=value;s.history.push({field:q.field,value,source:'self-report',questionId:q.id,at:new Date().toISOString()});save();await askNext();break;
    }
    case 'confirm':{
      for(const key of Object.keys(fieldLabels)){const value=String(data.get(key)||'').trim();if(value!==fieldValue(key,s.profile[key]))s.profile[key]=value;}s.onboarded=true;s.diagnosed=false;record('确认了初步学习画像','Confirmed the starting portrait');save();go('trial/'+papers[0].id);break;
    }
    case 'assessment':{
      const answer=data.get('answer');const other=String(data.get('other')||'').trim();if(answer===null||(answer==='other'&&!other)){toast(L('先选择答案，或暂时跳过。','Choose an answer, or skip for now.'));return;}
      const p=paperNow(),stage=currentStage();const result=await learning.assess({paperId:p.id,stage,answer:answer==='other'?'other':Number(answer),other:answer==='other'?other:'',confidence:String(data.get('confidence')||'uncertain')});
      if(!p.sections.some(sec=>sec.id===result.sectionId&&sec.body.includes(result.quote)))throw Error('Missing assessment source');
      ui.assessmentResult=saveAssessment(result);render();break;
    }
    case 'tutor':await tutor(String(data.get('question')||''));break;
  }
},button);});

root.addEventListener('click',event=>{
  const el=event.target.closest('button,a');if(!el)return;
  if(el.dataset.go){go(el.dataset.go);return;}
  if(el.dataset.lang){s.language=el.dataset.lang;document.querySelector('#toast').classList.remove('show');save();render();return;}
  if(el.dataset.example){const texts={project:L('我会一点 Python，想在两周内复现一个植物病害识别模型，用来参加竞赛，还没有读过相关论文。','I know some Python. I want to reproduce a plant disease classification model for a competition in two weeks. I have not read research papers yet.'),report:L('我需要在一周内写一份植物病害识别方向的课程报告，想比较不同方法和实验依据，刚开始读论文。','I need a course report on plant disease classification within a week. I am new to papers and want to compare methods and experimental evidence.'),explore:L('我想了解植物病害识别这个方向，目前是初学者，没有固定期限，先建立一个研究概览。','I am a beginner exploring plant disease classification. I have no deadline and want a research overview first.')};s.intro=texts[el.dataset.example];document.querySelector('#intro').value=s.intro;save();return;}
  if(el.dataset.stage){go('paper/'+paperNow().id+'/'+el.dataset.stage);return;}
  if(el.dataset.section){if(el.dataset.readNext)markSection(paperNow(),el.dataset.readNext);ui.section=el.dataset.section;ui.highlight=null;s.lastSection[paperNow().id]=ui.section;save();render();return;}
  if(el.dataset.help){ui.help=el.dataset.help;render();return;}
  if(el.dataset.readerMobile){ui.mobilePane=el.dataset.readerMobile;render();return;}
  if(el.dataset.bookmark){const id=el.dataset.bookmark;s.bookmarks=s.bookmarks.includes(id)?s.bookmarks.filter(x=>x!==id):[...s.bookmarks,id];save();if(route().name==='shelf'){const p=papers.find(p=>p.id===ui.shelfPaper)||papers.find(p=>p.branch===(route().id||'foundations'));document.querySelector('#shelf-caption').innerHTML=views.shelfCaption(ctx(),p);}else render();toast(s.bookmarks.includes(id)?L('已放入待读。','Saved for a later reading.'):L('已从待读移除。','Removed from your reading list.'));return;}
  if(el.dataset.ask){task(()=>tutor(el.dataset.ask),el);return;}
  if(el.dataset.term){const p=paperNow(),t=p.terms.find(t=>t.term===el.dataset.term);if(t)dialog(h(t.term),`<p>${h(s.language==='zh'?t.zh:t.en)}</p><blockquote class="source-quote" lang="en">${h(t.quote)}</blockquote><button class="button secondary" data-dialog-source="${t.sectionId}" data-quote="${h(t.quote)}">${L('回到原文','Locate in the paper')}</button>`);return;}
  if(el.dataset.evidenceSection){ui.section=el.dataset.evidenceSection;ui.highlight=el.dataset.evidenceQuote;s.lastSection[paperNow().id]=ui.section;ui.mobilePane='read';save();render();document.querySelector('#source-highlight')?.scrollIntoView({block:'center',behavior:'smooth'});return;}
  const action=el.dataset.action;if(!action)return;
  switch(action){
    case 'about':statusModal();break;
    case 'direct':s.history=[];s.introProfile={...blankState().profile};s.profile={...blankState().profile};ui.inQuestions=true;save();task(askNext,el);break;
    case 'question-skip':if(ui.question){s.history.push({field:ui.question.field,value:'skip',source:'user-skip'});save();task(askNext,el);}break;
    case 'question-back':{
      const last=s.history.pop();if(!last){ui.question=null;ui.inQuestions=false;render();break;}
      s.profile={...blankState().profile,...s.introProfile};for(const item of s.history)if(item.value!=='skip')s.profile[item.field]=item.value;save();task(askNext,el);break;
    }
    case 'edit-intro':ui.question=null;ui.inQuestions=false;go('journal');break;
    case 'confirm-skip':{
      const form=document.querySelector('[data-form="confirm"]');if(form){const d=new FormData(form);for(const key of Object.keys(fieldLabels)){const value=String(d.get(key)||'').trim();if(value!==fieldValue(key,s.profile[key]))s.profile[key]=value;}}
      s.onboarded=true;save();go('garden');break;
    }
    case 'assessment-skip':{
      const p=paperNow();saveAssessment({paperId:p.id,stage:currentStage(),status:'skipped',correct:null,source:'user-skip'});
      if(route().name==='trial'){s.diagnosed=false;save();go('garden');}else go('paper/'+p.id+'/'+(ui.stage==='final'?'growth':'read'));break;
    }
    case 'assessment-continue':if(route().name==='trial'){s.diagnosed=true;save();go('garden');}else go('paper/'+paperNow().id+'/'+(ui.stage==='final'?'growth':'read'));break;
    case 'assessment-retry':resetUI();render();break;
    case 'foundation-note':{
      const p=paperNow(),term=p.terms[0];dialog(L('给这个概念一点时间','A closer look at the concept'),`<p><strong>${h(term?.term)}</strong></p><p>${h(s.language==='zh'?term?.zh:term?.en)}</p><blockquote class="source-quote" lang="en">${h(ui.assessmentResult?.quote||term?.quote)}</blockquote><p>${L('回到原文，试着用自己的话解释作者为什么采用这个做法。','Return to the passage and explain, in your own words, why the authors made this choice.')}</p><button class="button" data-dialog-retry>${L('再试一次','Try again')}</button>`);break;
    }
    case 'finish-reading':{const p=paperNow();p.sections.forEach(sec=>markSection(p,sec.id));go('paper/'+p.id+'/final');break;}
    case 'complete-paper':{
      const p=paperNow();s.completed=[...new Set([...s.completed,p.id])];record('完成了一篇论文的学习手记','Completed a paper field note');save();go('garden');toast(L('这篇手记已收好，学习路径已更新。','Field note saved. Your learning path is updated.'));break;
    }
    case 'export':download(s);toast(L('学习手记已导出。','Your journal has been exported.'));break;
    case 'import':document.querySelector('#import-file').click();break;
    case 'clear':dialog(L('重新留一张白纸？','Start with a blank page?'),`<p>${L('将清空当前浏览器里的目标、测评、旁注和阅读记录。如果还想保留，可以先导出手记。','This clears goals, answers, notes and reading history in this browser. Export your journal first if you want to keep a copy.')}</p><div class="actions"><button class="button secondary" data-dialog-export>${L('先导出','Export first')}</button><button class="button copper" data-confirm-clear>${L('清空本机记录','Clear local journal')}</button></div>`);break;
  }
});

root.addEventListener('change',event=>{const input=event.target;if(input.name==='answer'){
  ui.choice=input.value;const form=input.closest('form');form.querySelectorAll('.option').forEach(label=>label.classList.toggle('selected',label.querySelector('input')?.checked));const other=form.querySelector('[name="other"]');if(other){other.hidden=input.value!=='other';if(!other.hidden)other.focus();}
}});
root.addEventListener('input',event=>{const input=event.target;if(input.id==='intro'){s.intro=input.value;save();}if(input.name==='other')ui.other=input.value;if(input.dataset.note){s.notes[input.dataset.note]=input.value;save();}});
document.querySelector('#dialog').addEventListener('click',event=>{const el=event.target.closest('button');if(!el)return;const d=document.querySelector('#dialog');if(el.hasAttribute('data-close-dialog'))d.close();if(el.hasAttribute('data-dialog-export'))download(s);if(el.hasAttribute('data-confirm-clear')){const lang=s.language;clearSaved();s=blankState();s.language=lang;ui.question=null;d.close();save();go('home');render();}if(el.hasAttribute('data-dialog-retry')){d.close();resetUI();render();}if(el.dataset.dialogSource){ui.section=el.dataset.dialogSource;ui.highlight=el.dataset.quote;ui.mobilePane='read';d.close();render();}});
document.querySelector('#import-file').addEventListener('change',async event=>{const file=event.target.files[0];if(!file)return;try{if(file.size>2_000_000)throw Error('too large');s=importState(await file.text());save();ui.question=null;go('profile');render();toast(L('手记已带回，欢迎继续。','Your journal is back. Welcome.'));}catch{toast(L('这份文件不是有效的论径手记，现有记录未改动。','This is not a valid Lun Jing journal. Your current notes are unchanged.'));}finally{event.target.value='';}});
window.addEventListener('hashchange',onRoute);
window.addEventListener('message',event=>{
  const frame=document.querySelector('#grove-frame');
  if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
  if(event.data?.type==='grove-mounted'){frame.contentWindow.postMessage({type:'grove-state',state:groveState(ctx())},location.origin);syncGroveTravel();}
  if(event.data?.type==='grove-wheel'&&Number.isFinite(event.data.delta))window.scrollBy({top:Math.max(-innerHeight*2,Math.min(innerHeight*2,event.data.delta)),behavior:'instant'});
  if(event.data?.type==='grove-advance'){const range=groveRange();if(range)jumpGrove(range.progress>.97?0:[.30,.65,1].find(p=>p>range.progress+.04)??1);}
  if(event.data?.type==='grove-jump'&&Number.isFinite(event.data.progress))jumpGrove(event.data.progress);
  if(event.data?.type==='grove-go'){
    const path=event.data.path;
    const allowed=['home','garden','journal','profile','confirm',...branches.map(b=>'shelf/'+b.id),...papers.map(p=>'paper/'+p.id)];
    if(allowed.includes(path))go(path);
  }
});
window.addEventListener('message',event=>{const frame=document.querySelector('#shelf-frame');if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;const message=event.data;if(message?.type==='shelf-ready'){document.querySelector('.scene-wait')?.classList.add('ready');}if(message?.type==='paper-selected'&&papers.some(p=>p.id===message.paperId)){ui.shelfPaper=message.paperId;const caption=document.querySelector('#shelf-caption');if(caption)caption.innerHTML=views.shelfCaption(ctx(),papers.find(p=>p.id===message.paperId));}if(message?.type==='paper-opened'&&papers.some(p=>p.id===message.paperId))go('paper/'+message.paperId);});
onRoute();
if(route().name==='journal'&&s.history.length){ui.inQuestions=true;task(askNext);}
