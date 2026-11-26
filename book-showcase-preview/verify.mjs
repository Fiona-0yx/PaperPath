import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

await mkdir('qa', { recursive: true });
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--disable-gpu', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9333', `--user-data-dir=${path.resolve('qa/edge-profile')}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let ws;
try {
  let tabs;
  for (let i=0; i<60; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9333/json')).json(); if(tabs.some(t=>t.type==='page')) break; } catch {}
    await delay(250);
  }
  if (!tabs) throw Error('Browser did not start');
  ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve; ws.onerror=reject;});
  let id=0; const pending=new Map(), errors=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}} if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails.text);};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const key=++id;pending.set(key,{resolve,reject});ws.send(JSON.stringify({id:key,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:5173/'});
  for(let i=0;i<60;i++){if(await evaluate('document.querySelectorAll(".book-card").length === 3'))break;await delay(500);}
  check(await evaluate('document.querySelectorAll(".book-card").length === 3'),'Missing book cards: '+await evaluate('location.href + " " + document.body.innerText.slice(0,250)'));
  await delay(1200);
  const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'});await writeFile(`qa/${name}.png`,Buffer.from(s.data,'base64'));};
  await shot('desktop');
  const results=[];
  for(const [book,title] of [['codex','Codex'],['claude','Claude Code'],['cursor','Cursor']]){
    await evaluate(`document.querySelector('[data-book="${book}"]').click()`);
    await delay(800);
    check(await evaluate(`document.body.dataset.mode === 'detail' && document.querySelector('#detailTitle').textContent === '${title}'`),`${book} details failed`);
    if(book==='claude') await shot('detail');
    await evaluate("document.querySelector('#saveButton').click()");
    check(await evaluate("document.querySelector('#saveButton').getAttribute('aria-pressed') === 'true'"),'Save failed');
    await evaluate("document.querySelector('#closeButton').click()");await delay(800);
    check(await evaluate("document.body.dataset.mode === 'gallery'"),'Close failed');
    results.push(`${book}: open, save, close passed`);
  }
  await evaluate("document.querySelector('#menuButton').click()");
  check(await evaluate("document.body.dataset.menu === 'open'"),'Menu failed');
  await evaluate("document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))");
  check(await evaluate("document.body.dataset.menu === 'closed'"),'Escape failed');
  const sizes=[[820,1180,'tablet'],[390,844,'mobile']];
  for(const [width,height,name] of sizes){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});await delay(900);
    await shot(name);
    check(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),`${name}: horizontal overflow`);
    await evaluate("document.querySelector('[data-book=codex]').click()");await delay(800);
    check(await evaluate("document.body.dataset.mode === 'detail' && !document.querySelector('#detailPanel').inert"),`${name}: details failed`);
    await shot(`${name}-detail`);
    await evaluate("document.querySelector('#closeButton').click()");await delay(800);
    results.push(`${name}: layout and details passed (emulation)`);
  }
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  await delay(300);
  const reducedMotion=await evaluate("[...document.querySelectorAll('video')].every(v=>v.paused)");
  check(reducedMotion,'Reduced motion video pause failed');
  const videos=await evaluate("[...document.querySelectorAll('video')].map(v=>({ready:v.readyState,error:v.error?.code||null}))");
  const report={results,reducedMotion,videos,runtimeErrors:errors};
  check(errors.length===0,'Browser runtime errors');
  await writeFile('qa/results.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
} finally {
  ws?.close(); edge.kill();
}
