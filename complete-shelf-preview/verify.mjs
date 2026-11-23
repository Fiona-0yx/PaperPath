import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';

await mkdir('qa', { recursive: true });
const edge = spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', [
  '--headless=new', '--enable-unsafe-swiftshader', '--no-first-run', '--no-default-browser-check',
  '--remote-debugging-port=9334', `--user-data-dir=${path.resolve('qa/edge-profile')}`, 'about:blank'
], { windowsHide: true, stdio: 'ignore' });
let ws;
try {
  let tabs;
  for (let i=0; i<80; i++) {
    try { tabs = await (await fetch('http://127.0.0.1:9334/json')).json(); if(tabs.some(t=>t.type==='page')) break; } catch {}
    await delay(250);
  }
  if (!tabs) throw Error('Browser did not start');
  ws = new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve; ws.onerror=reject;});
  let id=0; const pending=new Map(), errors=[], networkFailures=[];
  ws.onmessage=e=>{
    const m=JSON.parse(e.data);
    if(m.id){const p=pending.get(m.id);if(p){pending.delete(m.id);clearTimeout(p.timer);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    if(m.method==='Network.loadingFailed')networkFailures.push(m.params.errorText);
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const key=++id;
    const timer=setTimeout(()=>{pending.delete(key);reject(Error('Timed out: '+method));},60000);
    pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));
  });
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const check=(ok,message)=>{if(!ok)throw Error(message);};
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(500);}throw Error('Not ready: '+expression+' '+JSON.stringify(await evaluate('({title:document.title,text:document.body.innerText.slice(-600)})')));};
  const click=selector=>evaluate(`document.querySelector(${JSON.stringify(selector)}).click()`);
  const shot=async name=>{const s=await send('Page.captureScreenshot',{format:'png'});await writeFile(`qa/${name}.png`,Buffer.from(s.data,'base64'));};
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:'http://127.0.0.1:5174/'});
  await until("document.querySelector('#experience')?.classList.contains('webgl-ready')");
  await delay(1200);await shot('desktop');
  check(await evaluate("document.querySelectorAll('#markers button').length === 7"),'Expected seven volumes');
  await click('#next');await delay(1500);
  check(await evaluate("document.querySelector('#counter').textContent === '02 / 07'"),'Next volume failed');
  await click('#previous');await delay(1500);
  check(await evaluate("document.querySelector('#counter').textContent === '01 / 07'"),'Previous volume failed');
  await click('#inspect');
  await until("document.querySelector('#detail-panel').getAttribute('aria-hidden') === 'false' && !document.querySelector('#experience').classList.contains('is-opening')");
  await click('#toggle-book');await delay(1200);
  check(await evaluate("document.querySelector('#toggle-book').getAttribute('aria-pressed') === 'true'"),'Book opening failed');
  await click('#next-page');await delay(800);
  check(await evaluate("document.querySelector('#page-counter').textContent === '02 / 05'"),'Page turn failed');
  await shot('reading');
  await click('#previous-page');await click('#reset-view');
  await click('#close-detail');await delay(1600);
  check(await evaluate("document.querySelector('#detail-panel').inert"),'Close detail failed');
  await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
  for(const [width,height,name] of [[820,1180,'tablet'],[390,844,'mobile']]){
    await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:true});
    await delay(1000);await shot(name);
    check(await evaluate('document.documentElement.scrollWidth <= window.innerWidth + 1'),name+' horizontal overflow');
    await click('#inspect');await delay(500);
    check(await evaluate("!document.querySelector('#detail-panel').inert"),name+' details failed');
    await shot(name+'-detail');await click('#close-detail');await delay(300);
  }
  const report={webglReady:true,volumes:7,navigation:true,openClose:true,openBook:true,pageTurn:true,responsive:['820x1180','390x844'],reducedMotion:true,runtimeErrors:errors,networkFailures};
  await writeFile('qa/results.json',JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  check(errors.length===0,'Browser runtime errors');
} finally {
  ws?.close();edge.kill();
}
