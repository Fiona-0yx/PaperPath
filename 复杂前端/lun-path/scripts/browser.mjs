import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { setTimeout as delay } from 'node:timers/promises';
export async function browser(){
  await mkdir('qa',{recursive:true});
  const child=spawn('C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',[
    '--headless=new','--enable-unsafe-swiftshader','--no-first-run','--no-default-browser-check','--remote-debugging-port=9340',`--user-data-dir=${path.resolve('qa/edge-profile')}`,'about:blank'
  ],{windowsHide:true,stdio:'ignore'});
  let tabs;
  for(let i=0;i<80;i++){try{tabs=await(await fetch('http://127.0.0.1:9340/json')).json();if(tabs.some(t=>t.type==='page'))break;}catch{}await delay(250);}
  if(!tabs){child.kill();throw Error('Browser startup failed');}
  const ws=new WebSocket(tabs.find(t=>t.type==='page').webSocketDebuggerUrl);await new Promise((resolve,reject)=>{ws.onopen=resolve;ws.onerror=reject;});
  let id=0;const pending=new Map(),errors=[],network=[];
  ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(m.error.message)):p.resolve(m.result);}}if(m.method==='Runtime.exceptionThrown')errors.push(m.params.exceptionDetails);if(m.method==='Network.responseReceived'&&m.params.response.status>=400)network.push({url:m.params.response.url,status:m.params.response.status});};
  const send=(method,params={})=>new Promise((resolve,reject)=>{const n=++id,timer=setTimeout(()=>{pending.delete(n);reject(Error('CDP timeout: '+method));},60000);pending.set(n,{resolve,reject,timer});ws.send(JSON.stringify({id:n,method,params}));});
  const evaluate=async expression=>{const r=await send('Runtime.evaluate',{expression,returnByValue:true,awaitPromise:true});if(r.exceptionDetails)throw Error(JSON.stringify(r.exceptionDetails));return r.result.value;};
  const until=async(expression,timeout=30000)=>{const end=Date.now()+timeout;while(Date.now()<end){if(await evaluate(expression))return;await delay(200);}throw Error('Not ready: '+expression+'\n'+JSON.stringify(await evaluate('({url:location.href,text:document.body.innerText.slice(0,1800)})')));};
  const click=selector=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});if(!e)throw Error('Missing '+${JSON.stringify(selector)});e.click();})()`);
  const fill=(selector,value)=>evaluate(`(()=>{const e=document.querySelector(${JSON.stringify(selector)});e.value=${JSON.stringify(value)};e.dispatchEvent(new Event('input',{bubbles:true}));})()`);
  const shot=async name=>{const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false});await writeFile(`qa/${name}.png`,Buffer.from(r.data,'base64'));};
  const viewport=async(width,height,mobile=false)=>send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile});
  await send('Page.enable');await send('Runtime.enable');await send('Network.enable');
  return {send,evaluate,until,click,fill,shot,viewport,errors,network,delay,close(){for(const p of pending.values())clearTimeout(p.timer);ws.close();child.kill();}};
}
