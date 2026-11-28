<script setup>
import {ref,computed,onMounted,onBeforeUnmount,nextTick} from 'vue';
import {api,readLocal,writeLocal} from '../../../../复杂前端/lun-path/src/reader-api.js';
import {paperBehavior} from '@/utils/paper-behavior';
const props=defineProps({material:Object,profile:Object,record:Function});
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
  const box=r.getBoundingClientRect();menu.value={left:Math.max(8,Math.min(box.left,innerWidth-308)),top:Math.max(8,Math.min(box.bottom+6,innerHeight-150))};
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
async function ask(question){
  if(pending.value||!question.trim()||!quote.value)return;
  const q={...quote.value};pending.value=true;error.value='';input.value=question;
  const point={sectionId:q.section,paragraphId:q.pid};
  const history=chats.value.slice(-3).map(c=>({question:c.question,answer:c.answer}));
  const relevant=behavior.value.filter(s=>s.pid===q.pid && s.status!=='asked')
    .sort((a,b)=>Number(b.key===JSON.stringify([q.pid,q.start,q.end]))-Number(a.key===JSON.stringify([q.pid,q.start,q.end])))
    .slice(0,4).map(({pid,status})=>({pid,status}));
  const event=props.record('ask_ai',{...q,question,version:p.version||'v1'});
  if(event)behaviorEvents.value.push(event);
  try{
    const a=await api('analyze','POST',{paperId:p.id,contentVersion:p.version||'v1',test_id:props.profile.test_id,mode:'model',question,text:q.text,history,readingBehavior:relevant,
      range:{start:{...point,offset:q.start},end:{...point,offset:q.end}}});
    if(a.mode!=='model')throw Error('没有可核对的原文');
    chats.value.push({...q,id:crypto.randomUUID(),question,answer:a.explanation,basis:a.profileBasis,citation:a.quote,supplement:a.supplement});
    writeLocal(key+'.chat',chats.value);input.value='';
  }catch(e){error.value='暂时无法回答。'+e.message;}finally{pending.value=false;}
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
function finish(section){const at=visible.get(section);if(at!==undefined){props.record('view_section',{section,durationMs:Date.now()-at});visible.delete(section);}}
function observe(){observer.disconnect();for(const s of [...visible.keys()])finish(s);if(!document.hidden)document.querySelectorAll('[data-read-section]').forEach(el=>observer.observe(el));}
onMounted(()=>{props.record('open_paper');document.addEventListener('pointerdown',close);document.addEventListener('keydown',keydown);
  compact.addEventListener('change',closeUnusedPanel);
  observer=new IntersectionObserver(entries=>entries.forEach(e=>{const id=e.target.dataset.readSection;if(e.isIntersecting&&!document.hidden){if(!visible.has(id))visible.set(id,Date.now());}else finish(id);}));
  observe();document.addEventListener('visibilitychange',observe);
  const pid=new URLSearchParams(location.hash.split('?')[1]).get('paragraph');
  if(pid)nextTick(()=>document.getElementById(pid)?.scrollIntoView({block:'center'}));});
onBeforeUnmount(()=>{observer?.disconnect();for(const s of [...visible.keys()])finish(s);document.removeEventListener('visibilitychange',observe);document.removeEventListener('pointerdown',close);document.removeEventListener('keydown',keydown);compact.removeEventListener('change',closeUnusedPanel);});
</script>
<template>
 <div class="reading-grid">
  <el-card class="md-preview text-side" shadow="never">
    <header class="reading-heading">
      <h2>{{p.excerpt?'原文摘录':'论文原文'}}</h2>
      <a v-if="p.original" :href="p.original" target="_blank" rel="noopener">查看完整原文 <span aria-hidden="true">↗</span></a>
    </header>
    <section v-for="s in p.sections" :key="s.id" :data-read-section="s.id">
      <h3 v-if="!p.excerpt || p.sections.length > 1">{{s.heading}}</h3>
      <div v-for="(text,i) in s.paragraphs" :key="i" class="paragraph"><small>¶ {{i+1}}</small>
       <p :id="s.id+'-p'+(i+1)" :data-pid="s.id+'-p'+(i+1)" :data-section="s.id" tabindex="0" @pointerup="pick" @keyup="pick"><span v-for="(part,k) in pieces(s.id+'-p'+(i+1),text)" :key="k" :class="part.color">{{part.text}}</span></p></div>
    </section>
  </el-card>
  <div v-if="mobilePanel" class="panel-backdrop" aria-hidden="true" @click="closePanel"></div>
  <aside id="reading-tools" ref="panel" class="reader-sidebar" :class="{'mobile-open':mobilePanel}" aria-label="阅读工具">
    <el-card shadow="never">
      <div class="sidebar-header">
        <nav aria-label="阅读工具"><button v-for="t in tabs" :key="t" @click="tab=t" :aria-pressed="tab===t">{{t}}</button></nav>
        <button type="button" class="mobile-close" aria-label="关闭阅读工具" @click="closePanel">×</button>
      </div>
    <template v-if="tab==='篇内画像'">
      <p>阅读目标 · {{profile.reading_plan.depth}}</p>
      <h4>读前答题证据</h4>
      <p v-if="!profile.concept_evidence.length">本次没有答题证据。</p>
      <p v-for="e in profile.concept_evidence" :key="e.question_id">{{e.concept}} · {{ {mastered:'本题答对',gap:'先补讲',unsure:'待确认'}[e.status] }}</p>
      <h4>阅读中的变化</h4>
      <p v-if="!behavior.length">本篇还没有标记或提问。</p>
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
      <article v-for="c in chats" :key="c.id"><b>{{c.question}}</b><p>{{c.basis}}</p><p>{{c.answer}}</p><blockquote>原文依据 · {{c.citation}}</blockquote><p v-if="c.supplement">模型补充 · {{c.supplement}}</p><button @click="saveChat(c)">存入笔记</button><button @click="saveChat(c,true)">标记已解决</button></article>
      <blockquote>{{quote?.text || '先在左侧选中想问的原文。'}}</blockquote><small>发送选句、上下文、最近对话、篇内画像及本段的阅读提示，由模型回答。</small>
      <div><button v-for="prompt in prompts" :key="prompt" :disabled="pending||!quote" @click="ask(prompt)">{{prompt}}</button></div>
      <form @submit.prevent="ask(input)"><textarea id="paper-question" v-model="input" placeholder="继续问这段原文…" maxlength="1500"/><button :disabled="pending||!quote||!input.trim()">发送</button></form><p role="status">{{pending?'正在回答…':error}}</p>
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
  grid-template-columns: minmax(0, 1fr) minmax(290px, 32%);
  gap: clamp(16px, 2.2vw, 28px);
  align-items: start;
  color: var(--paper-text);
}
.text-side, .reader-sidebar :deep(.el-card) {
  min-width: 0;
  border-radius: 10px;
  border-color: var(--paper-line);
  background: var(--paper-card);
  box-shadow: 0 3px 14px #18251d0a;
}
.text-side :deep(.el-card__body) { padding: clamp(18px, 3vw, 38px); }
.reading-heading {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px 16px;
  padding-bottom: 16px;
  margin-bottom: 18px;
  border-bottom: 1px solid var(--paper-line);
}
.reading-heading h2 { font-size: 21px; font-weight: 650; }
.reading-heading a, .note-actions > button:first-child { color: var(--paper-accent); }
.reading-heading a { font-size: 14px; text-underline-offset: 4px; text-decoration: underline; }
.text-side section + section { margin-top: 32px; }
.text-side h3 { margin: 0 0 14px; font-size: 19px; font-weight: 650; }
.paragraph { display: flex; gap: 12px; align-items: baseline; }
.paragraph small { color: var(--paper-muted); white-space: nowrap; }
.paragraph p {
  margin: 0 0 14px;
  font-family: Georgia, "Songti SC", "Noto Serif CJK SC", serif;
  font-size: clamp(16px, 1.4vw, 19px);
  line-height: 1.85;
  overflow-wrap: anywhere;
}
.paragraph:last-child p { margin-bottom: 0; }
.reader-sidebar { position: sticky; top: 18px; max-height: calc(100dvh - 36px); overflow: auto; }
.reader-sidebar h4 { margin: 16px 0 4px; font-weight: 650; }
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
.reader-sidebar textarea {
  width: 100%;
  margin-top: 10px;
  border: 1px solid var(--paper-line);
  background: var(--paper-card);
  padding: 8px;
  border-radius: 6px;
}
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
@media (max-width: 768px) {
  .reading-grid { grid-template-columns: minmax(0, 1fr); }
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
