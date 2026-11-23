/* Product bindings on the unabridged Sylva page. No new scene is rendered here. */
(()=>{
  let state={language:'zh',view:'home',branches:[],completed:0};
  const read=()=>{try{return JSON.parse(new URLSearchParams(location.search).get('state')||'{}');}catch{return {};}};
  const L=(zh,en)=>state.language==='en'?en:zh;
  const text=(selector,value)=>{const el=document.querySelector(selector);if(el)el.textContent=value;};
  const navigate=path=>{if(parent===window)location.href='/#/'+path;else parent.postMessage({type:'grove-go',path},location.origin);};
  const bind=(el,path,label)=>{
    if(!el)return;el.dataset.grovePath=path;
    if(label)el.setAttribute('aria-label',label);
    if(el.tagName==='ARTICLE'){el.setAttribute('role','link');el.tabIndex=0;}
  };
  const branch=(id)=>state.branches.find(b=>b.id===id)||{title:{zh:'',en:''},count:0,done:0};
  const name=b=>b.title?.[state.language]||b.title?.en||'';
  const progress=b=>state.language==='en'?`${b.count} papers · ${b.done} completed`:`${b.count} 篇论文 · ${b.done} 篇完成`;
  const foundation=document.createElement('button');foundation.className='foundation-caption';foundation.type='button';
  document.querySelector('.play-wrap').append(foundation);
  const sprout=document.querySelector('.knob--about svg')?.cloneNode(true);
  if(sprout){sprout.setAttribute('class','ico');document.querySelector('.liquid-button--play .ico')?.replaceWith(sprout);}
  const hint=document.createElement('p');hint.className='branch-hint';document.querySelector('#stage').append(hint);
  const cue=document.querySelector('.scroll');
  cue.href='#next-branch';
  let pose={progress:0,phase:0};
  function updateJourneyLabels(){
    const labels=[L('沿藤蔓向下探索','Scroll down to follow the vine'),name(branch('foundations')),name(branch('methods')),name(branch('practice'))];
    text('.branch-hint',pose.phase?`${String(pose.phase).padStart(2,'0')} / ${labels[pose.phase]} · ${L('点开分支进入书架','Open the branch to visit its shelf')}`:labels[0]);
    cue.firstChild.textContent=pose.progress>.98?L('回到藤蔓起点','Return to the beginning'):L('沿藤蔓向下探索','Follow the vine down');
    cue.setAttribute('aria-label',cue.firstChild.textContent);
  }
  function sendScroll(delta){
    if(parent===window){window.__groveTravel?.setProgress((window.__groveTravel.getState().target||0)+delta/(innerHeight*3));return;}
    parent.postMessage({type:'grove-wheel',delta},location.origin);
  }
  window.addEventListener('grove-travel-frame',e=>{pose=e.detail;updateJourneyLabels();});
  cue.addEventListener('click',e=>{e.preventDefault();parent.postMessage({type:'grove-advance'},location.origin);});
  document.addEventListener('wheel',e=>{if(e.ctrlKey||!e.deltaY)return;e.preventDefault();sendScroll(e.deltaY*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1));},{passive:false});
  let lastTouch=null;
  document.addEventListener('touchstart',e=>{lastTouch=e.touches.length===1?e.touches[0].clientY:null;},{passive:true});
  document.addEventListener('touchmove',e=>{if(lastTouch===null||e.touches.length!==1)return;const next=e.touches[0].clientY,delta=lastTouch-next;lastTouch=next;if(e.cancelable)e.preventDefault();sendScroll(delta);},{passive:false});
  document.addEventListener('touchend',()=>lastTouch=null,{passive:true});
  document.addEventListener('keydown',e=>{
    if(e.target.closest('input,textarea,select'))return;
    const delta={ArrowDown:90,ArrowUp:-90,PageDown:innerHeight*.8,PageUp:-innerHeight*.8};
    if(delta[e.key]){e.preventDefault();sendScroll(delta[e.key]);}
    else if(e.key==='Home'||e.key==='End'){e.preventDefault();parent.postMessage({type:'grove-jump',progress:e.key==='Home'?0:1},location.origin);}
    else if(e.key===' '&&!e.target.closest('button,a,[role="link"]')){e.preventDefault();sendScroll(innerHeight*.8);}
  });
  function apply(next){
    state={...state,...next};document.documentElement.lang=state.language==='en'?'en':'zh-CN';
    document.title=L('论径 · 学习花园','Lun Jing · The learning grove');
    const title=state.view==='garden'?L(['沿着枝蔓，','找到下一步。'],['Follow a branch.','Find your next paper.']):L(['循着好奇，','走进学习花园。'],['Step into','your learning grove.']);
    const lines=document.querySelectorAll('.headline i');lines.forEach((line,i)=>line.textContent=title[i]||'');
    text('.lede',L('向下滚动，沿藤蔓走过几个学习分支。到感兴趣的地方停下，去书架挑一篇论文。','Scroll down along the vine through the learning branches. Stop at a direction that interests you and choose a paper.'));
    const primaryPath=state.view==='garden'&&state.onboarded?'confirm':state.onboarded?(state.lastPaper?'paper/'+state.lastPaper:'journal'):'journal';
    text('.liquid-button--explore .lbl',state.view==='garden'&&state.onboarded?L('调整学习目标','Edit my learning goal'):state.onboarded?L('继续我的学习','Continue my journey'):L('翻开学习手记','Begin my journal'));
    bind(document.querySelector('.liquid-button--explore'),primaryPath);
    text('.ghost','LUN JING');
    const links=document.querySelectorAll('.dock-item');
    const nav=[['home',L('论径首页','Lun Jing home')],['garden',L('学习花园','The grove')],['shelf/foundations',L('论文书架','Paper shelf')],['journal',L('学习手记','My journal')],['profile',L('我的成长','My growth')]];
    links.forEach((el,i)=>{
      const item=nav[i];if(!item)return;bind(el,item[0],item[1]);
      const label=el.querySelector('span:not(.glyph)');if(label)label.textContent=item[1];
      el.classList.toggle('is-active',item[0]===state.view);el.setAttribute('aria-current',item[0]===state.view?'page':'false');
    });
    const base=branch('foundations');
    foundation.replaceChildren();
    const strong=document.createElement('span');strong.textContent=name(base);foundation.append(strong);
    if(state.language==='zh'){const small=document.createElement('small');small.textContent=base.title.en;foundation.append(small);}
    const count=document.createElement('small');count.className='branch-progress';count.textContent=progress(base);foundation.append(count);
    bind(foundation,'shelf/foundations');
    bind(document.querySelector('.liquid-button--play'),'shelf/foundations',name(base));
    for(const [id,selector,label] of [['methods','.card--about','02'],['practice','.card--stove','03']]){
      const b=branch(id),card=document.querySelector(selector);
      text(selector+' .label',label+' / '+(state.language==='zh'?b.title.en:progress(b)));
      text(selector+' h2',name(b));bind(card,'shelf/'+id,name(b));
      bind(card.querySelector('.knob'),'shelf/'+id,name(b));
    }
    bind(document.querySelector('.knob--about'),'shelf/methods',name(branch('methods')));
    text('.stat--a dt',L('当前方向','Your direction'));
    text('.stat--a dd',state.direction||L('一次新的探索','A new exploration'));
    text('.stat--b dt',L('我的学习记录','Field notes collected'));
    text('.stat--b dd',L(`${state.completed||0} 篇已完成`,`${state.completed||0} completed`));
    updateJourneyLabels();
    document.querySelectorAll('.grove-recommended').forEach(el=>el.classList.remove('grove-recommended'));
    const selected=state.recommended==='methods'?document.querySelector('.card--about'):state.recommended==='practice'?document.querySelector('.card--stove'):document.querySelector('.play-wrap');
    if(state.onboarded&&selected){selected.classList.add('grove-recommended');selected.dataset.recommendation=L('建议从这里开始','A suggested next step');}
    requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
  }
  document.addEventListener('click',e=>{const target=e.target.closest('[data-grove-path]');if(!target)return;e.preventDefault();e.stopPropagation();navigate(target.dataset.grovePath);},true);
  document.addEventListener('keydown',e=>{const target=e.target.closest('article[data-grove-path]');if(target&&(e.key==='Enter'||e.key===' ')){e.preventDefault();navigate(target.dataset.grovePath);}});
  window.addEventListener('message',e=>{if(e.origin!==location.origin||e.source!==parent)return;if(e.data?.type==='grove-state')apply(e.data.state);if(e.data?.type==='grove-travel')window.__groveTravel?.setProgress(e.data.progress);});
  apply(read());
  parent.postMessage({type:'grove-mounted'},location.origin);
})();
