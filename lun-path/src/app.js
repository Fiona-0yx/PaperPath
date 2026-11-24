import { grove, groveState } from './grove.js';
import { groveCategories } from '../shared/grove-categories.js';

const root=document.querySelector('#app');
const host=document.createElement('div');
host.id='grove-host';root.after(host);
let language='zh';
try { language=localStorage.getItem('lunjing-interface-language')==='en'?'en':'zh'; } catch {}
const L=(zh,en)=>language==='en'?en:zh;
const route=()=>({name:(location.hash.replace(/^#\/?/,'')||'home').split('/')[0]});
const context=()=>({s:{language},L,route:route()});
const navigation=()=>`<header class="site-header"><nav aria-label="${L('主导航','Primary navigation')}">${[['home',L('路径','Path')],['overview',L('全景','Overview')],['profile',L('画像','Profile')]].map(([path,label])=>`<a href="#/${path}" ${route().name===path?'aria-current="page"':''}>${label}</a>`).join('')}</nav></header>`;
function render(){
  const r=route(),isGrove=['home','garden','overview'].includes(r.name);
  document.documentElement.lang=language==='en'?'en':'zh-CN';
  document.body.classList.toggle('is-grove',isGrove);
  document.body.classList.toggle('is-category-blank',!isGrove);
  document.title=L('论径','Lun Jing')+' · '+(r.name==='overview'?L('全景','Overview'):r.name==='profile'?L('画像','Profile'):L('循径而读，渐入佳境。','Follow the path. Read your way in.'));
  root.hidden=isGrove;host.hidden=!isGrove;
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
  }else{
    // Learning and profile pages will be rebuilt from the original references.
    root.innerHTML=(r.name==='profile'?navigation():'')+'<main id="main" class="category-blank" tabindex="-1"></main>';
  }
  document.querySelector('.skip-link').href=isGrove?'#grove-main':'#main';
}
document.addEventListener('click',event=>{
  const button=event.target.closest('[data-lang]');
  if(button){language=button.dataset.lang;try{localStorage.setItem('lunjing-interface-language',language);}catch{}render();}
  if(event.target.closest('.skip-link')){event.preventDefault();document.querySelector(event.target.closest('a').getAttribute('href'))?.focus();}
});
window.addEventListener('hashchange',render);
window.addEventListener('message',event=>{
  const frame=host.querySelector('iframe');
  if(event.origin!==location.origin||event.source!==frame?.contentWindow)return;
  if(event.data?.type==='grove-mounted')frame.contentWindow.postMessage({type:'grove-state',state:groveState(context())},location.origin);
  if(event.data?.type==='grove-go'){
    const allowed=['home','garden','overview','profile','journal',...groveCategories.map(c=>'shelf/'+c.id)];
    if(allowed.includes(event.data.path))location.hash='#/'+event.data.path;
  }
});
render();
