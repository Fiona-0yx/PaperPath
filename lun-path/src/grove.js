import { escape as h, leaf } from './components.js';
import { groveCategories } from '../shared/grove-categories.js';

export function groveState(c){
  return {
    language:c.s.language,
    view:c.route.name,
    hasProgress:false,
    categories:groveCategories,
  };
}

export function grove(c){
  const {L,s}=c;
  const state=encodeURIComponent(JSON.stringify(groveState(c)));
  return `<section class="grove-shell" data-view="${h(c.route.name)}" aria-label="${L('向下滚动，沿藤蔓探索学习分支','Scroll down to follow the vine through the learning branches')}"><div class="grove-viewport"><a class="grove-brand" href="#/home" aria-label="${L('论径首页','Lun Jing home')}">${leaf}<span>${L('论径','Lun Jing')}</span></a><div class="grove-language"><div class="language-toggle" aria-label="${L('界面语言','Interface language')}"><button data-lang="zh" class="${s.language==='zh'?'active':''}" aria-pressed="${s.language==='zh'}">中文</button><span>/</span><button data-lang="en" class="${s.language==='en'?'active':''}" aria-pressed="${s.language==='en'}">EN</button></div></div><iframe id="grove-frame" title="${L('论径学习花园：藤蔓场景与方向分支','Lun Jing learning grove and reading branches')}" src="/scenes/grove.html?state=${state}"></iframe></div></section>`;
}
