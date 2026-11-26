import { grove, groveState } from './grove.js';
import { groveCategories } from '../shared/grove-categories.js';
import { intake, openQuestionnaire, persistIntake, recordCheck, submitPortrait } from './journal-state.js';
import { openReportDialog } from './report-dialog.js';

const root=document.querySelector('#app');
const host=document.createElement('div');
host.id='grove-host';root.after(host);
let language='zh';
try { language=localStorage.getItem('lunjing-interface-language')==='en'?'en':'zh'; } catch {}
const L=(zh,en)=>language==='en'?en:zh;
const route=()=>({name:(location.hash.replace(/^#\/?/,'')||'home').split('/')[0]});
const context=()=>({s:{language,hasProgress:intake.started},L,route:route()});
let reveal=null;
function setLanguage(value){
  language=value==='en'?'en':'zh';
  try{localStorage.setItem('lunjing-interface-language',language)}catch{}
  render();
}
// The embedded book and grove use the shell's language and journal state.
let lastReport;
async function submitAndShowReport() {
  const frame = root.querySelector('.journal-frame, .profile-book');
  const dialog = openReportDialog(language);
  const result = await submitPortrait(language);
  if (result.status === 'saved' && frame?.isConnected && ['journal','profile'].includes(route().name)) {
    lastReport = result.report;
    if (route().name === 'profile') root.querySelector('[data-show-report]').hidden = false;
    else location.hash = '#/profile';
    dialog.display(lastReport);
  } else {
    dialog.close();
  }
  return result.status;
}
window.journalShell={intake,save:persistIntake,recordCheck,submitPortrait:submitAndShowReport,setLanguage,get language(){return language}};
const navigation=()=>`<header class="site-header"><nav aria-label="${L('主导航','Primary navigation')}">${[['home',L('路径','Path')],['overview',L('全景','Overview')],['profile',L('画像','Profile')]].map(([path,label])=>`<a href="#/${path}" ${route().name===path?'aria-current="page"':''}>${label}</a>`).join('')}</nav>
  <button class="profile-language" data-lang="${L('en','zh')}" lang="${L('en','zh-CN')}">${L('English','中文')}</button></header>`;
function render(){
  const r=route(),isGrove=['home','garden','overview'].includes(r.name);
  document.documentElement.lang=language==='en'?'en':'zh-CN';
  document.body.classList.toggle('is-grove',isGrove);
  const isJournal=r.name==='journal';
  if(!isJournal)reveal=null;
  const isProfile=r.name==='profile';
  document.body.classList.toggle('is-profile',isProfile);
  document.body.classList.toggle('is-category-blank',!isGrove&&!isJournal&&!isProfile);
  document.body.classList.toggle('is-journal',isJournal);
  document.title=L('论径','Lun Jing')+' · '+(r.name==='overview'?L('全景','Overview'):r.name==='profile'?L('画像','Profile'):L('循径而读，渐入佳境。','Follow the path. Read your way in.'));
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
    const hasReport = lastReport && lastReport.id === intake.submitted?.reportId;
    const controls = intake.portraitReady ? `<div class="profile-actions">
      <button data-update-report>${L('提交并更新报告','Submit and update report')}</button>
      <button data-edit-questions>${L('修改原问卷','Edit questionnaire')}</button>
      <button data-restart-questions>${L('重新填写','Start over')}</button>
      <button data-show-report ${hasReport ? '' : 'hidden'}>${L('查看本次报告','View submitted report')}</button>
      </div><p class="profile-notice" role="status"></p>
      <dialog class="restart-dialog"><form method="dialog">
        <h2>${L('重新填写问卷？','Start a new questionnaire?')}</h2>
        <p>${L('将清空当前草稿和自检记录，从第一题开始。已提交的报告会保留。','Your draft and self-check answers will be cleared. Previously submitted reports are kept.')}</p>
        <button autofocus>${L('取消','Cancel')}</button>
        <button value="restart">${L('重新填写','Start over')}</button>
      </form></dialog>` : '';
    root.innerHTML=navigation()+'<main id="main" class="portrait-view" tabindex="-1">'+controls+content+'</main>';
    const restart = root.querySelector('.restart-dialog');
    restart?.addEventListener('close', () => {
      if (restart.returnValue === 'restart') enterQuestionnaire(true);
    });
  }else{
    root.innerHTML='<main id="main" class="category-blank" tabindex="-1"></main>';
  }
  if(!isJournal)root.style.clipPath='';
  document.querySelector('.skip-link').href=isGrove?'#grove-main':'#main';
}
function enterQuestionnaire(fresh) {
  openQuestionnaire(fresh);
  location.hash = '#/journal';
}
document.addEventListener('click',async event=>{
  if (event.target.closest('[data-edit-questions]')) enterQuestionnaire(false);
  if (event.target.closest('[data-restart-questions]')) root.querySelector('.restart-dialog').showModal();
  const update = event.target.closest('[data-update-report]');
  if (update) {
    update.disabled = true;
    root.querySelector('.profile-notice').textContent = '';
    const result = await submitAndShowReport();
    if (update.isConnected) {
      update.disabled = false;
      const notice = root.querySelector('.profile-notice');
      if (result === 'changed') notice.textContent = L('作答已修改，请再次提交。','Your answers changed. Please submit again.');
      else if (result === 'storage-error') notice.textContent = L('浏览器未能保存作答，请重试。','Your browser could not save your answers. Please try again.');
      else if (result === 'report-error') notice.textContent = L('当前修改已保存，报告生成失败，请重试。','Your edits were saved. Please try generating the report again.');
    }
    return;
  }
  if (event.target.closest('[data-show-report]') && lastReport) openReportDialog(lastReport.locale).display(lastReport);
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
