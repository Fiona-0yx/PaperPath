/* Business bindings; all cards, photos, controls and rendering come from Sylva. */
(()=>{
  let state={language:'zh',view:'home',categories:[]};
  try { state={...state,...JSON.parse(new URLSearchParams(location.search).get('state')||'{}')}; } catch {}
  const L=(zh,en)=>state.language==='en'?en:zh;
  const text=(selector,value)=>{const el=document.querySelector(selector);if(el)el.textContent=value;};
  const stage=document.querySelector('#stage');
  const sourceCards=[...stage.querySelectorAll('.card')];
  const knob=document.querySelector('.knob--about').cloneNode(true);
  sourceCards[0].append(knob);
  document.querySelector('.knob-float').remove();
  const cards=state.categories.map((category,i)=>{
    const card=i<2?sourceCards[i]:sourceCards[i%2].cloneNode(true);
    card.dataset.category=category.id;
    card.dataset.grovePath='shelf/'+category.id;
    card.tabIndex=0;card.setAttribute('role','link');
    card.style.setProperty('--d',(760+i*90)+'ms');
    card.querySelector('figure').dataset.delay=String(920+i*90);
    card.querySelector('.knob').tabIndex=-1;
    if(i>=2)stage.append(card);
    return card;
  });
  document.querySelectorAll('.stat,.guides,.dock-mark,.dock-item--enter').forEach(el=>el.remove());
  const direction=document.createElement('p');direction.className='direction-label';stage.append(direction);
  const overviewTitle=document.createElement('h1');overviewTitle.className='overview-title';stage.append(overviewTitle);
  const cue=document.querySelector('.scroll');
  const nav=[...document.querySelectorAll('.dock-item')];
  const navigate=path=>parent.postMessage({type:'grove-go',path},location.origin);
  const overview=()=>state.view==='overview';
  let pose={progress:0};
  function updateCue(){
    cue.firstChild.textContent=pose.progress>.98?L('回到起点','Back to start'):L('向下探索','Scroll to explore');
    cue.setAttribute('aria-label',cue.firstChild.textContent);
  }
  function apply(next){
    state={...state,...next};
    document.documentElement.lang=state.language==='en'?'en':'zh-CN';
    document.body.classList.toggle('is-overview',overview());
    document.title=L('论径 · 循径而读，渐入佳境。','Lun Jing · Follow the path. Read your way in.');
    document.querySelector('meta[name="description"]')?.setAttribute('content',L('沿藤蔓探索人工智能的五个学习分类。','Explore five fields of artificial intelligence along a living vine.'));
    document.querySelectorAll('.headline i').forEach((el,i)=>el.textContent=L(['循径而读，','渐入佳境。'],['Follow the path.','Read your way in.'])[i]);
    text('.lede',L('说说你想做什么，我来铺一条由浅入深的路。','Tell me what you want to do. Let’s build a path from foundations to deeper reading.'));
    text('.ghost',L('论径','LUN JING'));
    text('.direction-label',L('人工智能','ARTIFICIAL INTELLIGENCE'));
    text('.overview-title',L('全景','Overview'));
    const hasProgress=state.hasProgress;
    text('.liquid-button--explore .lbl',hasProgress?L('继续','Continue'):L('开始','Start'));
    document.querySelector('.liquid-button--explore').dataset.grovePath=hasProgress&&state.lastPaper?'paper/'+state.lastPaper:'journal';
    const names=[['home',L('路径','Path')],['overview',L('全景','Overview')],['profile',L('画像','Profile')]];
    nav.forEach((el,i)=>{
      const [path,label]=names[i];el.dataset.grovePath=path;el.href='/#/'+path;
      el.querySelector('span:not(.glyph)').textContent=label;
      el.setAttribute('aria-label',label);
      const active=path===(state.view==='garden'?'home':state.view);
      el.classList.toggle('is-active',active);
      if(active)el.setAttribute('aria-current','page');else el.removeAttribute('aria-current');
    });
    document.querySelector('.dock').setAttribute('aria-label',L('主导航','Primary navigation'));
    cards.forEach((card,i)=>{
      const category=state.categories[i],number=String(i+1).padStart(2,'0');
      card.querySelector('.label').textContent=state.language==='en'?number:number+' / '+category.title.en;
      card.querySelector('h2').textContent=category.title[state.language];
      card.setAttribute('aria-label',category.title[state.language]);
      card.querySelector('.knob').setAttribute('aria-label',L('打开分类：','Open category: ')+category.title[state.language]);
      card.querySelector('img').alt=L(i%2===0?'苔藓覆盖的岩石':'薄雾中的苔藓岩石',i%2===0?'Moss-covered rocks':'Mossy rocks in a misty grove');
    });
    document.querySelector('.liquid-button--play').setAttribute('aria-label',L('向左移动视角','Move the view left'));
    window.__groveTravel?.setOverview(overview());updateCue();
  }
  function scroll(delta){
    const travel=window.__groveTravel;if(!travel||overview())return;
    const current=travel.getState();travel.setProgress(current.target+delta/current.span);
  }
  document.addEventListener('wheel',e=>{
    if(overview()||e.ctrlKey)return;
    e.preventDefault();scroll((e.deltaY||e.deltaX)*(e.deltaMode===1?16:e.deltaMode===2?innerHeight:1));
  },{passive:false});
  let touch=null;
  document.addEventListener('touchstart',e=>{touch=e.touches.length===1?e.touches[0].clientY:null;},{passive:true});
  document.addEventListener('touchmove',e=>{
    if(overview()||touch===null||e.touches.length!==1)return;
    const y=e.touches[0].clientY;scroll(touch-y);touch=y;if(e.cancelable)e.preventDefault();
  },{passive:false});
  document.addEventListener('touchend',()=>touch=null,{passive:true});
  document.addEventListener('click',e=>{
    const node=e.target.closest('.liquid-button--play');
    if(node){e.preventDefault();window.__groveTravel?.moveNode();return;}
    const target=e.target.closest('[data-grove-path]');
    if(target){e.preventDefault();navigate(target.dataset.grovePath);return;}
    if(e.target.closest('.scroll')){e.preventDefault();if(pose.progress>.98)window.__groveTravel?.setProgress(0);else scroll(innerWidth*.8);}
  });
  document.addEventListener('keydown',e=>{
    const card=e.target.closest('article[data-category]');
    if(card&&(e.key==='Enter'||e.key===' ')){e.preventDefault();navigate(card.dataset.grovePath);return;}
    if(overview()||e.target.closest('button,a,input,textarea'))return;
    if(e.key==='Home'||e.key==='End'){e.preventDefault();window.__groveTravel?.setProgress(e.key==='Home'?0:1);return;}
    const delta={ArrowDown:100,ArrowUp:-100,ArrowLeft:100,ArrowRight:-100,PageDown:innerWidth*.8,PageUp:-innerWidth*.8,' ':innerWidth*.8}[e.key];
    if(delta){e.preventDefault();scroll(delta);}
  });
  window.addEventListener('grove-travel-frame',e=>{pose=e.detail;updateCue();});
  window.addEventListener('message',e=>{
    if(e.origin!==location.origin||e.source!==parent)return;
    if(e.data?.type==='grove-state')apply(e.data.state);
    if(e.data?.type==='grove-visibility'){
      window.__grovePaused=!e.data.visible;
      if(e.data.visible)requestAnimationFrame(()=>window.dispatchEvent(new Event('resize')));
    }
  });
  apply({});
  window.addEventListener('DOMContentLoaded',()=>{apply({});parent.postMessage({type:'grove-mounted'},location.origin);});
})();
