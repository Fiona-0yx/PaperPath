<script setup>
import { ref, onMounted, onBeforeUnmount, watch } from 'vue';
import { api, readLocal, writeLocal } from '../../../../复杂前端/lun-path/src/reader-api.js';
import { profileInput } from '../../../../复杂前端/lun-path/src/profile-input.js';
import PaperReading from './paper-reading.vue';
const props = defineProps({ paper:Object });
const material=ref(null), plan=ref(null), test=ref(null), profile=ref(null);
const busy=ref(''), error=ref(''), reading=ref(false);
const generating=ref(false);
let modelRequest;
const key='lunjing.blog-study.'+props.paper.id;
const state=readLocal(key,{});
const choices=ref(state.choices || {});
const save=()=>writeLocal(key,{...state,choices:choices.value});
watch(choices,save,{deep:true});
async function run(label, action) {
  if (busy.value) return;
  busy.value=label; error.value='';
  try { await action(); } catch(e) { error.value=e.message; } finally { busy.value=''; }
}
async function prepare(){
  material.value=await api('materials/'+encodeURIComponent(props.paper.id));
  const version=material.value.version || 'v1';
  if(state.version && state.version!==version){
    delete state.planId; delete state.testId; delete state.reading; choices.value={};
  }
  state.version=version;
  if (state.planId) {
    try { plan.value=await api('plans/'+state.planId); }
    catch(e){ if(e.status!==404) throw e; delete state.planId; delete state.testId; delete state.reading; choices.value={}; save(); }
  }
  if (!plan.value) {
    const answers=readLocal('lunjing-intake-v1',{})?.submitted?.answers || {};
    const profile=await profileInput(answers,'./lun-path/shared/journal-questions.json');
    plan.value=await api('plans','POST',{paperId:props.paper.id,contentVersion:material.value.version || 'v1',input:{profile}});
    state.planId=plan.value.planId; save();
  }
  if(state.testId){
    test.value=await api('pretests/'+state.testId);
    try { profile.value=await api('pretests/'+state.testId+'/paper-profile'); reading.value=Boolean(state.reading); }
    catch(e){if(e.status!==409) throw e;}
  }
}
async function generate(mode) {
  const payload={planId:state.planId,revision:plan.value.revision,mode};
  const apply = result => {
    test.value=result;
    state.testId=test.value.test_id; choices.value={}; profile.value=test.value.paper_profile; save();
    if(mode==='skip')record('finish_test',{testId:state.testId,status:'skipped'});
  };
  if (mode!=='quick') {
    cancelGeneration();
    return run(mode==='skip'?'正在整理本篇画像…':'正在载入样题…',async()=>apply(await api('pretests','POST',payload)));
  }
  if (modelRequest || busy.value) return;
  const request=new AbortController();
  modelRequest=request; generating.value=true; error.value='';
  try {
    const result=await api('pretests','POST',{...payload,...(material.value.excerpt?{count:1}:{})},request.signal);
    if(modelRequest===request)apply(result);
  } catch(e) {
    if(modelRequest===request)error.value=e.message;
  } finally {
    if(modelRequest===request){modelRequest=null;generating.value=false;}
  }
}
function cancelGeneration(){
  modelRequest?.abort();
  modelRequest=null;
  generating.value=false;
}
onBeforeUnmount(cancelGeneration);
function grade(skip){
  run('正在整理本篇画像…',async()=>{
    const report=await api('pretests/'+state.testId+'/grade','POST',skip?{skip:true}:{answers:choices.value});
    profile.value=report.paper_profile; save();
    record('finish_test',{testId:state.testId,status:profile.value.completion_status});
  });
}
function record(type, detail={}) {
  const journal=readLocal('lunjing-journal-v1',{}) || {};
  const events=journal.events ||= [];
  if(type==='finish_test' && events.some(e=>e.type===type && e.testId===state.testId))return;
  const event={id:crypto.randomUUID(),time:new Date().toISOString(),type,paperId:props.paper.id,title:props.paper.article_title,...detail};
  events.push(event);
  writeLocal('lunjing-journal-v1',journal);
  return event;
}
function enter(){reading.value=true;state.reading=true;save();}
onMounted(()=>run('正在准备本篇读前方案…',prepare));
</script>
<template>
  <paper-reading v-if="reading && profile" :material="material" :profile="profile" :record="record" />
  <el-card v-else class="md-preview intake-test" shadow="never">
    <h2>{{profile?'本篇初始画像':'读前测试'}}</h2>
    <p role="status">{{busy || (generating ? '正在在线出题，最多等 20 秒。你也可以选择其他方式继续。' : error)}}</p>
    <template v-if="profile">
      <p>本篇目标 · {{profile.reading_plan.depth}}</p>
      <p v-if="!profile.concept_evidence.length">本次没有答题证据，相关概念保留为待确认。</p>
      <ul><li v-for="e in profile.concept_evidence" :key="e.question_id">{{e.concept}} · {{ {mastered:'本题答对',gap:'阅读时先补讲',unsure:'待确认'}[e.status] }}（读前题 {{e.question_id}}）</li></ul>
      <button @click="enter">进入论文阅读 →</button>
    </template>
    <form v-else-if="test" @submit.prevent="grade(false)">
      <fieldset v-for="(q,i) in test.questions" :key="q.id"><legend>{{i+1}}. {{q.stem}}</legend>
        <label v-for="(v,k) in q.options" :key="k"><input type="radio" required :name="q.id" :value="k" v-model="choices[q.id]"> {{v}}</label>
      </fieldset>
      <button :disabled="!!busy">提交并生成本篇画像</button>
      <button v-if="test.skippable" type="button" :disabled="!!busy" @click="grade(true)">跳过本次测试</button>
    </form>
    <template v-else-if="plan">
      <p>{{paper.article_description}}</p><p>阅读目标 · {{plan.plan.depth}}</p>
      <p>出题将使用本篇{{material.excerpt?'原文摘录':'材料'}}和手账中确认的画像。每题可选“不确定”。</p>
      <button v-if="paper.id==='radiation'" :disabled="!!busy" @click="generate('sample')">快速开始 · 五道样题</button>
      <button :disabled="!!busy || generating" @click="generate('quick')">生成个性化读前测试</button>
      <button v-if="plan.plan.pre_reading_test.skippable" :disabled="!!busy" @click="generate('skip')">跳过本次测试</button>
    </template>
    <button v-else-if="error" @click="run('正在重试…',prepare)">重新连接</button>
  </el-card>
</template>
<style scoped>
.intake-test {
  max-width: 860px;
  margin: 0 auto;
  border-radius: 10px;
  border-color: var(--paper-line);
  background: var(--paper-card);
  color: var(--paper-text);
  box-shadow: 0 3px 14px #18251d0a;
}
.intake-test :deep(.el-card__body) { padding: clamp(18px, 3vw, 38px); }
.intake-test h2 { font-size: 22px; font-weight: 650; border-bottom: 1px solid var(--paper-line); padding-bottom: 16px; }
.intake-test p, .intake-test li { line-height: 1.8; margin: 12px 0; }
.intake-test p:empty { display: none; }
.intake-test [role="status"] { color: var(--paper-muted); }
.intake-test fieldset { border: 1px solid var(--paper-line); border-radius: 8px; padding: 12px; margin: 16px 0; }
.intake-test legend { padding: 0 4px; font-weight: 600; }
.intake-test label { display: block; padding: 8px; border-radius: 5px; cursor: pointer; }
.intake-test label:has(input:checked) { background: color-mix(in srgb, var(--paper-card), #879c83 17%); }
.intake-test input { accent-color: #46604b; }
.intake-test button { padding: 8px 12px; border: 1px solid var(--paper-line); border-radius: 6px; margin: 8px 8px 0 0; }
.intake-test button:first-of-type { background: #46604b; color: white; border-color: #46604b; }
.intake-test button:disabled { opacity: .55; }
</style>
