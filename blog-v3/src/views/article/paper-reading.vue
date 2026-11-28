<script setup>
import {ref,computed,onMounted,onBeforeUnmount,nextTick,watch} from 'vue';
import {api,readLocal,writeLocal} from '../../../../复杂前端/lun-path/src/reader-api.js';
import {paperBehavior} from '@/utils/paper-behavior';
const props=defineProps({material:Object,profile:Object,paragraph:String,reviewType:String,record:Function});
const p=props.material, key='lunjing.reading.'+p.id+'.'+(p.version||'v1');
const notes=ref(readLocal(key,[])), chats=ref(readLocal(key+'.chat',[]));
const behaviorEvents=ref((readLocal('lunjing-journal-v1',{})?.events||[]).filter(event=>
  event.paperId===p.id && (!event.version || event.version===(p.version||'v1'))));
const behavior=computed(()=>paperBehavior(notes.value,behaviorEvents.value));
const behaviorLabels={
  'needs-help':'需要补讲', 'resolved':'用户已标记解决', 'follow-up':'多次提问，理解待确认',
  'asked':'提出过问题', 'reader-marked':'用户标记已理解'
};
const quote=ref(null), menu=ref(null), tab=ref('笔记'), filter=ref('全部'), input=ref(''), pending=ref(false), error=ref('');
const tabs = ['笔记', '问 AI', '篇内画像'];
const mobilePanel = ref(false);
const panel = ref(null);
const toolbar = ref(null);
const compact = window.matchMedia('(max-width: 768px)');
const colors={yellow:'重点',green:'已理解',red:'有疑问',blue:'需要解释'};
const prompts=['用中文讲讲','举个例子','这句话在这一节起什么作用','我需要先懂什么'];
const evidenceLabels={mastered:'本题答对',gap:'阅读时先补讲',unsure:'待确认'};
const reviewPrompt=computed(()=>({
  gist:'用自己的话写下这篇材料主要在回答什么问题。',
  retell:'用自己的话复述一个关键结论，写出支持它的一条依据。',
  implement:'选一个文中的方法，写下你会从哪一步开始尝试，以及还需要查明什么。',
}[props.reviewType] || '用自己的话写下你读懂了什么，还有哪里想再看一遍。'));
const previousReview=ref(readLocal(key+'.review',null));
const reviewDraft=ref(previousReview.value?.text || '');
const reviewStatus=ref('');
const persist=()=>writeLocal(key,notes.value);
const shown=computed(()=>notes.value.filter(n=>filter.value==='全部'||n.label===filter.value));
function pieces(id,text){
  const marks=notes.value.filter(n=>n.pid===id&&n.color);
  const cuts=[...new Set([0,text.length,...marks.flatMap(m=>[m.start,m.end])])].sort((a,b)=>a-b);
  return cuts.slice(1).map((end,i)=>({text:text.slice(cuts[i],end),color:marks.find(m=>m.start<=cuts[i]&&m.end>=end)?.color}));
}
function pick(){
  const sel=window.getSelection();
  if(!sel?.rangeCount||sel.isCollapsed)return;
  const r=sel.getRangeAt(0);
  const startElement=r.startContainer.nodeType===Node.ELEMENT_NODE?r.startContainer:r.startContainer.parentElement;
  const el=startElement?.closest('[data-pid]');
  if(!el||!el.contains(r.endContainer))return;
  const before=r.cloneRange();before.selectNodeContents(el);before.setEnd(r.startContainer,r.startOffset);
  let start=before.toString().length,end=start+r.toString().length;
  const text=el.textContent,word=c=>!!c&&/[A-Za-z0-9'’-]/.test(c);
  while(start>0&&word(text[start-1])&&word(text[start]))start--;
  while(end<text.length&&word(text[end-1])&&word(text[end]))end++;
  if(!text.slice(start,end).trim())return;
  quote.value={pid:el.dataset.pid,section:el.dataset.section,start,end,text:text.slice(start,end)};
  positionMenu(r.getBoundingClientRect());
}
function positionMenu(box) {
  menu.value={left:Math.max(8,Math.min(box.left,innerWidth-308)),top:Math.max(8,Math.min(box.bottom+6,innerHeight-150))};
}
function selectParagraph(section,index,text,event) {
  quote.value={pid:section+'-p'+(index+1),section,start:0,end:text.length,text};
  positionMenu(event.currentTarget.getBoundingClientRect());
  nextTick(()=>document.querySelector('.selection-tools button')?.focus({preventScroll:true}));
}
function mark(color,label=colors[color]){
  if(!quote.value)return;
  const q=quote.value, existing=notes.value.find(n=>n.pid===q.pid&&n.start===q.start&&n.end===q.end&&(color?!!n.color:n.label===label));
  if(color)notes.value=notes.value.filter(n=>n===existing||!n.color||n.pid!==q.pid||n.end<=q.start||n.start>=q.end);
  const n=existing || {...q,id:crypto.randomUUID()};
  Object.assign(n,{color,label,resolved:false});if(!existing)notes.value.unshift(n);
  props.record(color?'highlight':'bookmark',{...q,noteId:n.id,color});persist();menu.value=null;tab.value='笔记';filter.value='全部';
  window.getSelection()?.removeAllRanges();
}
function saveReview(){
  const text=reviewDraft.value.trim();
  if(!text || text===previousReview.value?.text)return;
  const review={text,time:new Date().toISOString()};
  if(!writeLocal(key+'.review',review)){
    reviewStatus.value='浏览器无法保存回顾，请复制后再离开。';
    return;
  }
  previousReview.value=review;
  const event=props.record('finish_review',{text,reviewType:props.reviewType,source:'self-report'});
  reviewStatus.value=event ? '已保存，打开学习记录即可回看。' : '已保存在本篇，学习记录暂时无法更新。';
}
function remove(n){notes.value=notes.value.filter(x=>x.id!==n.id);props.record(n.color?'unhighlight':'note_delete',{pid:n.pid,noteId:n.id});persist();}
function resolve(n){n.resolved=!n.resolved;props.record('mark_resolved',{pid:n.pid,noteId:n.id,resolved:n.resolved});persist();}
function jump(n){
  mobilePanel.value=false;
  const el=document.getElementById(n.pid);
  el?.focus({preventScroll:true});
  el?.scrollIntoView({block:'center',behavior:'smooth'});
  el?.animate([{background:'#f5e1a5'},{background:'transparent'}],{duration:1100});
  props.record('view_source',{pid:n.pid,section:n.section});
}
function showTab(value, focusQuestion = false) {
  tab.value = value;
  if (compact.matches) mobilePanel.value = true;
  nextTick(() => {
    if (focusQuestion) panel.value?.querySelector('#paper-question')?.focus({preventScroll:true});
    else if (compact.matches) panel.value?.querySelector('.mobile-close')?.focus({preventScroll:true});
  });
}
function closePanel() {
  mobilePanel.value = false;
  nextTick(() => toolbar.value?.querySelector('[aria-label="'+tab.value+'"]')?.focus({preventScroll:true}));
}
function openChat(){menu.value=null;window.getSelection()?.removeAllRanges();showTab('问 AI', true);}
function changeColor(note, event) {
  event.target.closest('details').open = false;
  quote.value = note;
  mark(event.target.value);
}
async function ask(question, mode='model'){
  if(pending.value||!question.trim()||!quote.value)return;
  const q={...quote.value};pending.value=true;error.value='';input.value=question;
  const point={sectionId:q.section,paragraphId:q.pid};
  const history=chats.value.slice(-3).map(c=>({question:c.question,answer:c.answer}));
  const relevant=behavior.value.filter(s=>s.pid===q.pid && s.status!=='asked')
    .sort((a,b)=>Number(b.key===JSON.stringify([q.pid,q.start,q.end]))-Number(a.key===JSON.stringify([q.pid,q.start,q.end])))
    .slice(0,4).map(({pid,status})=>({pid,status}));
  if(mode==='model'){
    const event=props.record('ask_ai',{...q,question});
    if(event)behaviorEvents.value.push(event);
  }
  try{
    const request={paperId:p.id,contentVersion:p.version||'v1',question, text:q.text,
      range:{start:{...point,offset:q.start},end:{...point,offset:q.end}}};
    let result;
    try {
      result=await api('analyze','POST',{...request,mode,...(mode==='model' && {
        test_id:props.profile.test_id,history,readingBehavior:relevant,
      })});
    } catch(modelError) {
      if(mode==='retrieval')throw modelError;
      result=await api('analyze','POST',{...request,mode:'retrieval'});
      error.value=modelFallbackMessage(modelError);
    }
    const citation=result.citations?.[0]?.range?.start;
    chats.value.push({...q,id:crypto.randomUUID(),question,answer:result.explanation,basis:result.profileBasis,
      citation:result.quote,supplement:result.supplement,mode:result.mode,
      citationPoint:citation && {pid:citation.paragraphId,section:citation.sectionId}});
    writeLocal(key+'.chat',chats.value);input.value='';
  }catch(e){error.value='暂时无法回答。'+e.message;}finally{pending.value=false;}
}
function modelFallbackMessage(cause){
  if(cause.status===503 && cause.message==='模型服务尚未配置完成')
    return '当前预览未配置在线模型，已展示原文检索结果。';
  if(cause.status===409 || cause.status===404)
    return '当前篇内画像不可用，已展示原文检索结果。可刷新页面后重试。';
  if(cause.status===504)
    return '在线解释等待超时，已展示原文检索结果。';
  return '在线解释暂不可用，已展示原文检索结果。';
}
function saveChat(c,done=false){
  let note=notes.value.find(n=>n.id===c.id);
  if(!note){note={...c,label:'需要解释',resolved:false};notes.value.unshift(note);props.record('save_answer',{noteId:c.id,pid:c.pid});}
  if(done&&!note.resolved)resolve(note);persist();
}
function close(e){if(!e.target.closest('.selection-tools'))menu.value=null;}
function closeUnusedPanel(){if(!compact.matches)mobilePanel.value=false;}
function keydown(e){
  if(e.key!=='Escape')return;
  if(menu.value)menu.value=null;
  else if(compact.matches && mobilePanel.value)closePanel();
}
let observer,visible=new Map();
let positionTimer;
const positionKey=key+'.paragraph';
function savePosition(){
  const paragraphs=[...document.querySelectorAll('[data-pid]')];
  const paragraph=paragraphs.find(el=>{
    const rect=el.getBoundingClientRect();
    return rect.bottom>=innerHeight*.25 && rect.top<innerHeight;
  });
  if(paragraph)writeLocal(positionKey,paragraph.id);
}
function trackPosition(){
  if(!positionTimer)positionTimer=setTimeout(()=>{positionTimer=null;savePosition();},400);
}
function returnToPosition(pid){
  if(pid)nextTick(()=>document.getElementById(pid)?.scrollIntoView({block:'start'}));
}
watch(()=>props.paragraph,returnToPosition);
function finish(section){const at=visible.get(section);if(at!==undefined){props.record('view_section',{section,durationMs:Date.now()-at});visible.delete(section);}}
function observe(){observer.disconnect();for(const s of [...visible.keys()])finish(s);if(!document.hidden)document.querySelectorAll('[data-read-section]').forEach(el=>observer.observe(el));}
onMounted(()=>{props.record('open_paper');document.addEventListener('pointerdown',close);document.addEventListener('keydown',keydown);
  compact.addEventListener('change',closeUnusedPanel);
  window.addEventListener('scroll',trackPosition,{passive:true});
  window.addEventListener('pagehide',savePosition);
  observer=new IntersectionObserver(entries=>entries.forEach(e=>{const id=e.target.dataset.readSection;if(e.isIntersecting&&!document.hidden){if(!visible.has(id))visible.set(id,Date.now());}else finish(id);}));
  observe();document.addEventListener('visibilitychange',observe);
  returnToPosition(props.paragraph || readLocal(positionKey,null));});
onBeforeUnmount(()=>{
  clearTimeout(positionTimer);savePosition();window.removeEventListener('scroll',trackPosition);
  window.removeEventListener('pagehide',savePosition);
  observer?.disconnect();for(const s of [...visible.keys()])finish(s);
  document.removeEventListener('visibilitychange',observe);document.removeEventListener('pointerdown',close);
  document.removeEventListener('keydown',keydown);compact.removeEventListener('change',closeUnusedPanel);
});
</script>
<template>
 <div class="reading-grid" :class="{'has-contents':p.sections.length > 1}">
  <div class="paper-tools" role="group" aria-label="标注工具">
    <div class="paper-tool-actions">
      <button v-for="(name,c) in colors" :key="c" type="button" :disabled="!quote" @click="mark(c)">
        <span class="note-dot" :class="c" aria-hidden="true"></span>{{name}}
      </button>
      <button type="button" :disabled="!quote" @click="mark(null,'收藏')">收藏</button>
      <button type="button" :disabled="!quote" @click="openChat">问 AI</button>
    </div>
    <a v-if="p.original" :href="p.original" target="_blank" rel="noopener">查看完整原文 <span aria-hidden="true">↗</span></a>
  </div>
  <nav v-if="p.sections.length > 1" class="paper-contents" aria-labelledby="paper-contents-title">
    <h2 id="paper-contents-title">目录</h2>
    <button v-for="s in p.sections" :key="s.id" @click="jump({pid:s.id+'-p1',section:s.id})">{{s.heading}}</button>
  </nav>
  <el-card class="md-preview text-side" shadow="never">
    <header class="reading-heading">
      <div>
        <h2>{{p.excerpt?'原文摘录':(p.id==='radiation'?'论文阅读摘记':'教学材料')}}</h2>
        <p class="reader-muted">选中文字，或点击段落旁的「标注」。</p>
      </div>
    </header>
    <section v-for="s in p.sections" :key="s.id" :data-read-section="s.id">
      <h3 v-if="!p.excerpt || p.sections.length > 1">{{s.heading}}</h3>
      <div v-for="(text,i) in s.paragraphs" :key="i" class="paragraph">
        <p :id="s.id+'-p'+(i+1)" :data-pid="s.id+'-p'+(i+1)" :data-section="s.id" tabindex="0" @pointerup="pick" @keyup="pick"><span v-for="(part,k) in pieces(s.id+'-p'+(i+1),text)" :key="k" :class="part.color">{{part.text}}</span></p>
        <button class="paragraph-action" :aria-label="s.heading+' 第 '+(i+1)+' 段标注'" @click="selectParagraph(s.id,i,text,$event)">标注</button>
      </div>
    </section>
    <form class="paper-review" @submit.prevent="saveReview">
      <h3>读后回顾</h3>
      <p class="reader-muted">你的自述会保存到学习记录中。</p>
      <label for="paper-review-text">{{reviewPrompt}}</label>
      <textarea id="paper-review-text" v-model="reviewDraft" rows="4" maxlength="800" />
      <button class="reader-primary" :disabled="!reviewDraft.trim() || reviewDraft.trim()===previousReview?.text">保存回顾</button>
      <p role="status" v-if="reviewStatus || previousReview">{{reviewStatus || '已保存上次回顾。'}}</p>
    </form>
  </el-card>
  <div v-if="mobilePanel" class="panel-backdrop" aria-hidden="true" @click="closePanel"></div>
  <aside id="reading-tools" ref="panel" class="reader-sidebar" :class="{'mobile-open':mobilePanel}" aria-label="阅读工具">
    <el-card shadow="never">
      <div class="sidebar-header">
        <nav aria-label="阅读工具"><button v-for="t in tabs" :key="t" @click="tab=t" :aria-pressed="tab===t">{{t}}</button></nav>
        <button type="button" class="mobile-close" aria-label="关闭阅读工具" @click="closePanel">×</button>
      </div>
    <template v-if="tab==='篇内画像'">
      <div class="profile-goal"><small>本篇阅读目标</small><strong>{{profile.reading_plan.depth}}</strong></div>
      <h4>读前答题证据</h4>
      <p class="reader-muted" v-if="!profile.concept_evidence.length">暂无答题证据，理解情况待确认。</p>
      <ul v-else class="profile-evidence">
        <li v-for="e in profile.concept_evidence" :key="e.question_id"><span>{{e.concept}}</span><span :class="e.status">{{evidenceLabels[e.status]}}</span></li>
      </ul>
      <h4>阅读行为</h4>
      <p class="reader-muted" v-if="!behavior.length">出现标记或提问后，这里会显示与原文对应的线索。</p>
      <article v-for="e in behavior" :key="e.key" data-behavior-evidence>
        <b>{{behaviorLabels[e.status]}}</b>
        <p>来源 · 阅读行为（仅限这段）{{e.questions.length ? ' · '+e.questions.length+' 个问题' : ''}}</p>
        <blockquote>{{e.text}}</blockquote>
        <button @click="jump(e)">查看原文</button>
      </article>
    </template>
    <template v-else-if="tab==='笔记'">
      <select class="note-filter" aria-label="笔记筛选" v-model="filter"><option v-for="f in ['全部','收藏','有疑问','需要解释']" :key="f">{{f}}</option></select>
      <p v-if="!shown.length" class="reader-muted">选中一段原文，添加划线或收藏。</p>
      <article v-for="n in shown" :key="n.id" class="reader-note">
        <p class="note-label"><span v-if="n.color" class="note-dot" :class="n.color" aria-hidden="true"></span><b>{{n.label}}</b><span v-if="n.resolved" class="reader-muted">已解决</span></p>
        <blockquote>{{n.text}}</blockquote><p v-if="n.answer">{{n.answer}}</p>
        <div class="note-actions">
          <button @click="jump(n)">查看原文</button>
          <button v-if="['有疑问','需要解释'].includes(n.label)" @click="resolve(n)">{{n.resolved?'重新打开':'标记已解决'}}</button>
          <details class="note-menu">
            <summary aria-label="更多笔记操作">···</summary>
            <div class="note-menu-options">
              <label v-if="n.color">划线颜色
                <select :value="n.color" @change="changeColor(n,$event)"><option v-for="(name,c) in colors" :key="c" :value="c">{{name}}</option></select>
              </label>
              <button @click="remove(n)">删除</button>
            </div>
          </details>
        </div>
      </article>
    </template>
    <template v-else>
      <p v-if="!quote" class="reader-muted">选中想问的原文，或点击段落旁的「标注」。</p>
      <div v-if="quote" class="question-block">
        <p class="reader-muted">当前选段</p>
        <blockquote>{{quote.text}}</blockquote>
        <div class="question-prompts">
          <button v-for="prompt in prompts" :key="prompt" :disabled="pending" @click="ask(prompt)">{{prompt}}</button>
        </div>
        <form @submit.prevent="ask(input)">
          <label class="reader-muted" for="paper-question">问题</label>
          <textarea id="paper-question" v-model="input" placeholder="想弄清这段的什么？" maxlength="1500"/>
          <p class="reader-muted">发送给 AI 会使用选段、上下文、最近对话和篇内画像。</p>
          <div class="question-actions">
            <button class="reader-primary" :disabled="pending||!input.trim()">发送给 AI</button>
            <button type="button" :disabled="pending" @click="ask(input.trim() || '查找这段原文', 'retrieval')">检索原文</button>
          </div>
        </form>
      </div>
      <p role="status" v-if="pending || error">{{pending?'正在查找原文和准备回答…':error}}</p>
      <article v-for="c in [...chats].reverse()" :key="c.id" class="chat-answer">
        <small>{{c.mode==='retrieval'?'原文检索':'AI 回答'}}</small>
        <b>{{c.question}}</b>
        <p v-if="c.basis" class="reader-muted">{{c.basis}}</p>
        <p>{{c.answer}}</p>
        <blockquote v-if="c.citation"><small>原文依据</small>{{c.citation}}</blockquote>
        <p v-if="c.supplement">模型补充 · {{c.supplement}}</p>
        <div class="question-actions">
          <button v-if="c.citationPoint" @click="jump(c.citationPoint)">定位原文</button>
          <button @click="saveChat(c)">存入笔记</button>
          <button @click="saveChat(c,true)">标记已解决</button>
        </div>
      </article>
    </template>
    </el-card>
  </aside>
  <div ref="toolbar" class="reader-toolbar" aria-label="阅读工具">
    <button v-for="t in tabs" :key="t" :aria-label="t" aria-controls="reading-tools" :aria-expanded="mobilePanel && tab===t" @click="mobilePanel && tab===t ? closePanel() : showTab(t)">{{t}}</button>
  </div>
  <div v-if="menu" class="selection-tools" :style="{top:menu.top+'px',left:menu.left+'px'}"><button v-for="(name,c) in colors" :key="c" :class="c" @click="mark(c)">{{name}}</button><button @click="mark(null,'收藏')">收藏</button><button @click="openChat">问 AI</button></div>
 </div>
</template>
<style scoped>
.reading-grid {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(275px, 28%);
  gap: 12px;
  align-items: start;
  color: var(--paper-text);
}
.paper-tools {
  grid-column: 1 / -1;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 6px 16px;
  padding: 7px 10px;
  border: 1px solid var(--paper-line);
  border-radius: 8px;
  background: color-mix(in srgb, var(--paper-card), var(--paper-accent) 7%);
}
.paper-tool-actions { display: flex; flex-wrap: wrap; gap: 4px; }
.paper-tool-actions button, .paper-tools a {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 8px;
  border: 0;
  border-radius: 5px;
  color: var(--paper-accent);
  background: transparent;
  font-size: 13px;
  text-underline-offset: 4px;
}
.paper-tool-actions button:disabled { opacity: .52; }
.paper-tool-actions button:not(:disabled):hover, .paper-tools a:hover { background: var(--paper-card); }
.paper-tools a:hover { text-decoration: underline; }
.text-side, .reader-sidebar :deep(.el-card) {
  min-width: 0;
  border-radius: 10px;
  border-color: var(--paper-line);
  background: var(--paper-card);
  box-shadow: 0 3px 14px #18251d0a;
}
.text-side :deep(.el-card__body) { padding: clamp(18px, 3vw, 38px); }
.reading-heading {
  padding-bottom: 16px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--paper-line);
}
.reading-heading h2 { font-size: 21px; font-weight: 650; }
.reading-heading p { margin-top: 5px; }
.note-actions > button:first-child { color: var(--paper-accent); }
.paper-contents {
  position: sticky;
  top: 18px;
  display: grid;
  gap: 4px;
  max-height: calc(100dvh - 36px);
  overflow: auto;
  padding: 13px 9px;
  border: 1px solid var(--paper-line);
  border-radius: 8px;
  background: color-mix(in srgb, var(--paper-card), var(--paper-accent) 4%);
}
.paper-contents h2 { margin: 0 8px 4px; font-size: 14px; font-weight: 650; }
.paper-contents button {
  padding: 7px 8px;
  border: 0;
  border-radius: 5px;
  color: var(--paper-accent);
  background: transparent;
  text-align: left;
  font-size: 13px;
  overflow-wrap: anywhere;
}
.paragraph-action {
  padding: 5px 10px;
  color: var(--paper-accent);
  background: transparent;
  border: 1px solid var(--paper-line);
  border-radius: 6px;
  font-size: 13px;
}
.paper-contents button:hover, .paragraph-action:hover { background: color-mix(in srgb, var(--paper-card), var(--paper-accent) 9%); }
.text-side section + section { margin-top: 32px; }
.text-side h3 { margin: 0 0 14px; font-size: 19px; font-weight: 650; }
.paragraph { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; }
.paragraph-action { padding-inline: 8px; margin-top: 3px; white-space: nowrap; }
.paragraph p {
  margin: 0 0 14px;
  scroll-margin-top: 24px;
  font-family: Georgia, "Songti SC", "Noto Serif CJK SC", serif;
  font-size: clamp(16px, 1.4vw, 19px);
  line-height: 1.85;
  overflow-wrap: anywhere;
}
.paragraph:last-child p { margin-bottom: 0; }
.paper-review {
  display: grid;
  justify-items: start;
  gap: 10px;
  margin-top: 34px;
  padding-top: 24px;
  border-top: 1px solid var(--paper-line);
}
.paper-review h3 { margin-bottom: 0; }
.paper-review textarea { width: 100%; min-height: 90px; resize: vertical; }
.reader-sidebar { position: sticky; top: 18px; max-height: calc(100dvh - 36px); overflow: auto; }
.reader-sidebar h4 { margin: 16px 0 4px; font-weight: 650; }
.reader-sidebar :deep(.el-card__body) { padding: 14px; }
.reader-sidebar p, .reader-sidebar blockquote { overflow-wrap: anywhere; }
.sidebar-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; }
.sidebar-header nav { display: flex; gap: 16px; border-bottom: 1px solid var(--paper-line); width: 100%; }
.sidebar-header nav button {
  flex: 1;
  padding: 8px 0 11px;
  border: 0;
  border-bottom: 2px solid transparent;
  border-radius: 0;
  white-space: nowrap;
  font-size: 14px;
  color: var(--paper-muted);
}
.sidebar-header nav button[aria-pressed="true"] { border-color: var(--paper-accent); color: var(--paper-accent); font-weight: 650; }
.reader-muted { color: var(--paper-muted); font-size: 13px; }
.profile-goal {
  display: grid;
  gap: 4px;
  padding: 12px 14px;
  border-radius: 8px;
  background: color-mix(in srgb, var(--paper-card), var(--paper-accent) 9%);
}
.profile-goal small { color: var(--paper-muted); }
.profile-evidence { display: grid; gap: 8px; padding: 0; list-style: none; }
.profile-evidence li { display: flex; justify-content: space-between; align-items: baseline; gap: 8px; }
.profile-evidence li span:last-child {
  padding: 2px 6px;
  border: 1px solid var(--paper-line);
  border-radius: 5px;
  font-size: 12px;
  white-space: nowrap;
}
.profile-evidence .gap { background: #f4e2bf; color: #63491c; }
.profile-evidence .mastered { background: #dcebd8; color: #29482c; }
.question-block { display: grid; gap: 8px; }
.question-block blockquote { max-height: 116px; overflow: auto; }
.question-prompts, .question-actions { display: flex; flex-wrap: wrap; gap: 6px; }
.question-block form { display: grid; gap: 8px; }
.chat-answer { display: grid; gap: 6px; }
.chat-answer small { display: block; color: var(--paper-muted); }
.chat-answer p { white-space: pre-line; }
.reader-sidebar button, .reader-toolbar button, .selection-tools button { background: transparent; }
.note-filter { margin: 3px 0 10px; }
.reader-sidebar button, .reader-sidebar select, .selection-tools button {
  padding: 5px 8px;
  border: 1px solid var(--paper-line);
  border-radius: 5px;
  font-size: 13px;
}
.reader-sidebar button:disabled { opacity: .5; }
.reader-sidebar blockquote {
  padding: 9px 12px;
  margin: 8px 0;
  border-left: 2px solid #879c83;
  background: color-mix(in srgb, var(--paper-card), #879c83 12%);
  font-size: 14px;
}
.reader-sidebar article { padding: 12px 0; border-bottom: 1px solid var(--paper-line); }
.note-label, .note-actions { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; }
.note-dot { width: 10px; height: 10px; border-radius: 50%; border: 1px solid #51654f38; }
.note-actions button { padding-inline: 0; border: 0; }
.note-actions button:hover { text-decoration: underline; }
.note-menu { margin-left: auto; }
.note-menu summary { list-style: none; cursor: pointer; padding: 0 8px; }
.note-menu summary::-webkit-details-marker { display: none; }
.note-menu-options { display: grid; gap: 6px; margin-top: 4px; padding: 6px 8px; border: 1px solid var(--paper-line); border-radius: 6px; }
.note-menu-options label { display: grid; gap: 4px; font-size: 12px; }
.sidebar-header nav button:hover, .reader-toolbar button:hover { background: color-mix(in srgb, var(--paper-card), var(--paper-accent) 9%); }
.reader-sidebar textarea, .paper-review textarea {
  width: 100%;
  border: 1px solid var(--paper-line);
  background: var(--paper-card);
  color: var(--paper-text);
  padding: 8px;
  border-radius: 6px;
}
.reader-sidebar .reader-primary, .paper-review .reader-primary {
  padding: 6px 12px;
  border: 1px solid #345641;
  border-radius: 6px;
  background: #345641;
  color: #fff;
  font-size: 14px;
}
.paper-review .reader-primary:disabled { opacity: .5; }
.selection-tools {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
  position: fixed;
  z-index: 100;
  max-width: min(300px, calc(100vw - 16px));
  padding: 5px;
  background: var(--paper-card);
  border: 1px solid var(--paper-line);
  border-radius: 7px;
  box-shadow: 0 4px 16px #18251d25;
}
.red{background:#f3caca}.blue{background:#cbdef2}.green{background:#cce4cd}.yellow{background:#f6e4a2}
.paragraph span:is(.red,.blue,.green,.yellow), .selection-tools button:is(.red,.blue,.green,.yellow) { color: #26342d; }
.reader-toolbar, .panel-backdrop, .sidebar-header .mobile-close { display: none; }
@media (min-width: 981px) {
  .reading-grid.has-contents {
    grid-template-columns: minmax(132px, 16%) minmax(0, 1fr) minmax(275px, 28%);
  }
}
@media (max-width: 980px) {
  .reading-grid { grid-template-columns: minmax(0, 1fr) minmax(255px, 36%); }
  .paper-contents {
    position: static;
    grid-column: 1 / -1;
    display: flex;
    flex-wrap: wrap;
    align-items: center;
    max-height: none;
    padding: 5px 8px;
  }
  .paper-contents h2 { margin: 0 8px; }
}
@media (max-width: 768px) {
  .reading-grid { grid-template-columns: minmax(0, 1fr); }
  .paragraph { column-gap: 8px; }
  .paragraph-action { min-height: 36px; padding-inline: 6px; }
  .reader-sidebar { display: none; }
  .reader-sidebar.mobile-open {
    display: block;
    position: fixed;
    inset: auto 0 0;
    z-index: 110;
    max-height: 75dvh;
    border-radius: 14px 14px 0 0;
    overscroll-behavior: contain;
  }
  .reader-sidebar :deep(.el-card__body) { padding: 16px 16px calc(20px + env(safe-area-inset-bottom)); }
  .sidebar-header { gap: 10px; }
  .sidebar-header .mobile-close { display: block; min-width: 38px; min-height: 38px; }
  .panel-backdrop { display: block; position: fixed; inset: 0; z-index: 105; background: #14231b50; }
  .reader-toolbar {
    display: flex;
    position: fixed;
    inset: auto 12px calc(10px + env(safe-area-inset-bottom)) 12px;
    z-index: 90;
    border: 1px solid var(--paper-line);
    border-radius: 10px;
    background: var(--paper-card);
    box-shadow: 0 4px 20px #18251d1f;
  }
  .reader-toolbar button { flex: 1; min-height: 44px; color: var(--paper-accent); font-size: 14px; }
  .reader-toolbar button + button { border-left: 1px solid var(--paper-line); }
}
</style>
