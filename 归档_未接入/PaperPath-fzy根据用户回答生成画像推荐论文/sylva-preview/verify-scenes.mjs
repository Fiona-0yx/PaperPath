import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
const kind=process.argv[2] || 'sylva';
if(!['sylva','sketchbook'].includes(kind))throw Error('Unknown preview');
const port=kind==='sylva'?5175:5176;
const folder=path.resolve(kind==='sylva'?'.':'../sketchbook-preview');
const qa=path.join(folder,'qa');await mkdir(qa,{recursive:true});
const edge=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
  '--headless=new','--enable-unsafe-swiftshader','--no-first-run','--no-default-browser-check',
  '--remote-debugging-port=9335',`--user-data-dir=${path.join(qa,'edge-profile')}`,'about:blank'
],{windowsHide:true,stdio:'ignore'});
let ws;
try{
  let tabs;
  for(let i=0;i<80;i++){
    try{tabs=await(await fetch('http://127.0.0.1:9335/json')).json();if(tabs.some(t=>t.type==='page'))break;}catch{}
    await delay(250);
  }
  if(!tabs)throw Error('Browser did not start');
  ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);
  await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let id=0;const pending=new Map(),errors=[],failedRequests=[];
  ws.onmessage=e=>{
    const m=JSON.parse(e.data);
    if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}
    if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);
    if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')errors.push(m.params.args.map(a=>a.description||a.value));
    if(m.method==='Network.responseReceived'&&m.params.response.status>=400)failedRequests.push({url:m.params.response.url,status:m.params.response.status});
  };
  const send=(method,params={})=>new Promise((resolve,reject)=>{
    const key=++id,timer=setTimeout(()=>{pending.delete(key);reject(Error('Timed out '+method));},60000);
    pending.set(key,{resolve,reject,timer});ws.send(JSON.stringify({id:key,method,params}));
  });
  const evaluate=async expression=>{
    const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});
    if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;
  };
  const until=async expression=>{for(let i=0;i<100;i++){if(await evaluate(expression))return;await delay(500);}throw Error('Not ready '+expression+' '+JSON.stringify(errors));};
  const check=(v,message)=>{if(!v)throw Error(message);};
  const click=s=>evaluate(`document.querySelector(${JSON.stringify(s)}).click()`);
  const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png'});await writeFile(path.join(qa,name+'.png'),Buffer.from(r.data,'base64'));};
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  await send('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await send('Page.navigate',{url:`http://127.0.0.1:${port}/`});
  const report={kind,checks:[]};
  if(kind==='sylva'){
    await until('window.__ready === true');await delay(1500);
    check(await evaluate("document.querySelector('#scene').width > 0"),'Empty 3D canvas');
    await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:900,y:650});
    report.checks.push('WebGL scene rendered; pointer move dispatched');
  }else{
    await until("document.body.dataset.ready === '1'");
    await delay(500);
    await until("!document.querySelector('#sbWrap').classList.contains('intro') && turn === null");
    const before=await evaluate("document.querySelector('#sbCaptions').textContent");
    await click('#sbRight');
    await until(`document.querySelector('#sbCaptions').textContent !== ${JSON.stringify(before)}`);
    await until('turn === null');
    await click('#sbLeft');await until('turn === null');
    check(await evaluate(`document.querySelector('#sbCaptions').textContent === ${JSON.stringify(before)}`),'Previous page failed');
    await click('#zIn');await delay(700);
    check(await evaluate("document.querySelector('#zRead').textContent !== '100%'"),'Zoom failed');
    await click('#zOut');await delay(700);
    await click('#loupeBtn');
    check(await evaluate("document.querySelector('#loupeBtn').getAttribute('aria-pressed') === 'false'"),'Magnifier failed');
    await click('#loupeBtn');
    check(await evaluate('document.querySelectorAll("#plateList li").length === 9'),'Missing plates');
    report.checks.push('Nine plates; next/previous page, zoom, magnifier passed');
  }
  await shot('desktop');
  await send('Emulation.setDeviceMetricsOverride',{width:820,height:1180,deviceScaleFactor:1,mobile:true});
  await delay(1200);await shot('tablet');
  report.tabletHorizontalOverflow=await evaluate('document.documentElement.scrollWidth > innerWidth + 1');
  report.images=await evaluate('[...document.images].filter(i=>!i.complete || i.naturalWidth===0).map(i=>i.src)');
  report.runtimeErrors=errors;report.failedRequests=failedRequests;
  await writeFile(path.join(qa,'results.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report,null,2));
  check(errors.length===0,'Browser runtime errors');
}finally{ws?.close();edge.kill();}
