import { grove, groveState } from './grove.js';
import { groveCategories } from '../shared/grove-categories.js';
import { intake, persistIntake, recordCheck, submitPortrait, addReadingNote, removeReadingNote, updateReadingNote } from './journal-state.js';
import { papers } from '../shared/papers.js';
import { escape } from './components.js';

const root=document.querySelector('#app');
const host=document.createElement('div');
host.id='grove-host';root.after(host);
let language='zh';
try { language=localStorage.getItem('lunjing-interface-language')==='en'?'en':'zh'; } catch {}
const L=(zh,en)=>language==='en'?en:zh;
const route=()=>({name:(location.hash.replace(/^#\/?/,'')||'home').split('/')[0]});
const segments=()=>location.hash.replace(/^#\/?/,'').split('/').filter(Boolean);
const context=()=>({s:{language,hasProgress:intake.started},L,route:route()});
let reveal=null;
function setLanguage(value){
  language=value==='en'?'en':'zh';
  try{localStorage.setItem('lunjing-interface-language',language)}catch{}
  render();
}
// The embedded book and grove use the shell's language and journal state.
window.journalShell={intake,save:persistIntake,recordCheck,submitPortrait,addReadingNote,removeReadingNote,updateReadingNote,setLanguage,get language(){return language}};
const navigation=()=>`<header class="site-header"><nav aria-label="${L('主导航','Primary navigation')}">${[['home',L('路径','Path')],['overview',L('全景','Overview')],['profile',L('画像','Profile')]].map(([path,label])=>`<a href="#/${path}" ${route().name===path?'aria-current="page"':''}>${label}</a>`).join('')}</nav>
  <button class="profile-language" data-lang="${L('en','zh')}" lang="${L('en','zh-CN')}">${L('English','中文')}</button></header>`;
function shelfContent(categoryId){
  const category=groveCategories.find(c=>c.id===categoryId);
  const list=papers.filter(p=>p.categoryId===categoryId);
  const title=category?category.title[language]:L('论文书架','Paper shelf');
  const listHtml=list.length
    ? list.map((p,i)=>'<li class="paper-card"><a class="paper-link" href="#/read/'+p.categoryId+'/'+p.id+'"><span class="paper-no">'+String(i+1).padStart(2,'0')+'</span><div class="paper-meta"><h2>'+escape(p.title)+'</h2><p class="paper-zh">'+escape(p.zhTitle)+'</p></div><span class="paper-diff" aria-label="'+L('难度','Difficulty')+' '+p.difficulty+'">'+'★'.repeat(p.difficulty)+'</span></a></li>').join('')
    : '<li class="shelf-empty">'+L('这个分类还没有论文。','No papers in this category yet.')+'</li>';
  return '<section class="shelf" aria-labelledby="shelf-title"><header class="shelf-head"><small>'+L('论文书架','Paper shelf')+'</small><h1 id="shelf-title">'+escape(title)+'</h1><p>'+L('选择一篇论文开始阅读。选中正文后右键，可收藏或记下疑问；笔记会进入右侧栏，并汇入个人画像的学习观察。','Choose a paper to read. Select text and right-click to save it or note a doubt; notes feed the sidebar and the learning observations in your portrait.')+'</p></header><ol class="paper-list">'+listHtml+'</ol></section>';
}
function render(){
  const r=route(),isGrove=['home','garden','overview'].includes(r.name);
  const seg=segments(),isReader=r.name==='read',isShelf=r.name==='shelf';
  document.documentElement.lang=language==='en'?'en':'zh-CN';
  document.body.classList.toggle('is-grove',isGrove);
  const isJournal=r.name==='journal';
  if(!isJournal)reveal=null;
  const isProfile=r.name==='profile';
  document.body.classList.toggle('is-profile',isProfile);
  document.body.classList.toggle('is-category-blank',!isGrove&&!isJournal&&!isProfile&&!isReader&&!isShelf);
  document.body.classList.toggle('is-journal',isJournal);
  document.body.classList.toggle('is-reader',isReader);
  document.body.classList.toggle('is-shelf',isShelf);
  document.title=L('论径','Lun Jing')+' · '+(r.name==='overview'?L('全景','Overview'):r.name==='profile'?L('画像','Profile'):r.name==='read'?L('论文阅读','Reading'):r.name==='shelf'?L('论文书架','Shelf'):L('循径而读，渐入佳境。','Follow the path. Read your way in.'));
  root.hidden=isGrove;host.hidden=!isGrove&&!(isJournal&&reveal);
  if(isGrove&&!host.querySelector('iframe'))host.innerHTML=`<main id="grove-main" tabindex="-1">${grove(context())}</main>`;
  const frame=host.querySelector('iframe');
  frame?.contentWindow?.postMessage({type:'grove-visibility',visible:isGrove},location.origin);
  if(isGrove){
    frame.contentWindow.postMessage({type:'grove-state',state:groveState(context())},location.origin);
    host.querySelector('.grove-shell').dataset.view=r.name;
    host.querySelector('.grove-brand > span').textContent=L('论径','Lun Jing');
    host.querySelectorAll('[data-lang]').forEach(button=>{
      button.classList.toggle('active',button.dataset.lang===language);
      button.setAttribute('aria-pressed',String(button.dataset.lang===language));
    });
    frame.title=L('论径学习花园：藤蔓场景与方向分支','Lun Jing learning grove and reading branches');
  }else if(isJournal){
    root.innerHTML='<main id="main" tabindex="-1"><iframe class="journal-frame" title="'+L('画像采集手账','Intake sketchbook')+'" src="/scenes/journal.html"></iframe></main>';
    root.style.clipPath=reveal?'circle(0px at '+reveal.x+'px '+reveal.y+'px)':'';
  }else if(isProfile){
    const content=intake.portraitReady
      ? '<iframe class="profile-book" title="'+L('我的初始画像','My starting portrait')+'" src="/scenes/journal.html?view=portrait"></iframe>'
      : '<article class="portrait-paper"><h1>'+L('我的学习画像','My learning portrait')+'</h1><p>'+
        L('完成手账并查看初始画像后，就能在这里再次打开。','Complete your journal and view your starting portrait to see it here.')+
        '</p><a href="#/journal">'+L('打开手账','Open journal')+'</a></article>';
    root.innerHTML=navigation()+'<main id="main" class="portrait-view" tabindex="-1">'+content+'</main>';
  }else if(isReader){
    const paperId=seg[2]||'';
    root.innerHTML='<main id="main" tabindex="-1"><iframe class="reader-frame" title="'+L('论文阅读','Paper reader')+'" src="/scenes/paper-reader.html?paper='+encodeURIComponent(paperId)+'"></iframe></main>';
  }else if(isShelf){
    root.innerHTML=navigation()+'<main id="main" class="shelf-view" tabindex="-1">'+shelfContent(seg[1])+'</main>';
  }else{
    root.innerHTML='<main id="main" class="category-blank" tabindex="-1"></main>';
  }
  if(!isJournal)root.style.clipPath='';
  document.querySelector('.skip-link').href=isGrove?'#grove-main':'#main';
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-lang]');
  if(button)setLanguage(button.dataset.lang);
  if(event.target.closest('.skip-link')){event.preventDefault();document.querySelector(event.target.closest('a').getAttribute('href'))?.focus();}
});
window.addEventListener('hashchange',render);
window.addEventListener('message',event=>{
  if(event.origin!==location.origin)return;
  const journal=root.querySelector('.journal-frame');
  if(journal && event.source===journal.contentWindow && ['journal-ready','journal-error'].includes(event.data?.type)){
    const origin=reveal;
    reveal=null;root.style.clipPath='';
    if(origin&&!matchMedia('(prefers-reduced-motion: reduce)').matches){
      const at=' at '+origin.x+'px '+origin.y+'px)';
      const animation=root.animate([{clipPath:'circle(0px'+at},{clipPath:'circle('+Math.ceil(Math.hypot(innerWidth,innerHeight))+'px'+at}],{duration:760,easing:'cubic-bezier(.3,.05,.2,1)'});
      animation.onfinish=()=>{if(route().name==='journal')host.hidden=true};
    }else host.hidden=true;
    journal.focus();
    return;
  }
  const frame=host.querySelector('iframe');
  if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
  if(event.data?.type==='grove-mounted')frame.contentWindow.postMessage({type:'grove-state',state:groveState(context())},location.origin);
  if(event.data?.type==='grove-go'){
    const allowed=['home','garden','overview','profile','journal',...groveCategories.map(c=>'shelf/'+c.id)];
    if(allowed.includes(event.data.path)){
      if(event.data.path==='journal'){
        const rect=frame.contentDocument.querySelector('.liquid-button--explore').getBoundingClientRect();
        const outer=frame.getBoundingClientRect();
        reveal={x:outer.x+rect.x+rect.width/2,y:outer.y+rect.y+rect.height/2};
      }
      location.hash='#/'+event.data.path;
    }
  }
});
render();
