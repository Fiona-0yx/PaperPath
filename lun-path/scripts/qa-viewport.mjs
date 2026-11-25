import assert from 'node:assert/strict';
import {createServer} from '../server/index.mjs';
import {browser} from './browser.mjs';

const server=createServer();
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
const base='http://127.0.0.1:'+server.address().port;
const b=await browser();
const grove='document.querySelector("#grove-frame")?.contentWindow';
const journal='document.querySelector(".journal-frame,.profile-book")?.contentDocument';
const journalReady=()=>b.until(journal+'?.body.dataset.ready==="1"',30000);
async function bookSize(){
  return b.evaluate(`(()=>{const d=${journal},w=d.defaultView;
    const book=d.querySelector('#sbBook').getBoundingClientRect();
    const next=d.querySelector('#sbRight').getBoundingClientRect();
    const tools=d.querySelector('.sb-tools').getBoundingClientRect();
    return {width:book.width,top:book.top+.218*book.height,bottom:book.top+.782*book.height,
      nextRight:next.right,toolsBottom:tools.bottom,viewport:w.innerHeight,single:d.body.classList.contains('single-sheet')};
  })()`);
}
try{
  await b.viewport(2540,1314);
  await b.send('Page.navigate',{url:base+'/#/home'});
  await b.until(grove+'?.__ready===true',60000);
  await b.delay(3000);
  const span=await b.evaluate(grove+'.__groveTravel.getState().span');
  await b.shot('viewport-wide-home');
  await b.viewport(1418,1326);await b.delay(900);
  await b.shot('viewport-reference-home');
  await b.viewport(1366,650);await b.delay(900);
  const shortSpan=await b.evaluate(grove+'.__groveTravel.getState().span');
  assert.ok(shortSpan<span);
  await b.shot('viewport-short-home');
  await b.evaluate(grove+'.__groveTravel.setProgress(.5)');
  await b.until(grove+'.__groveTravel.getState().progress===.5',60000);
  await b.viewport(2540,1314);await b.delay(1000);
  const restored=await b.evaluate(grove+'.__groveTravel.getState()');
  assert.equal(restored.span,span);assert.equal(restored.progress,.5);
  await b.evaluate('location.hash="#/journal"');await journalReady();
  const wide=await bookSize();assert.equal(wide.width,1755);
  await b.shot('viewport-wide-book');
  await b.viewport(1366,650);await b.delay(300);
  const short=await bookSize();
  assert.ok(short.top>=0 && short.bottom<=short.viewport && short.toolsBottom<=short.viewport && short.nextRight<=1366);
  await b.shot('viewport-short-book');
  await b.viewport(390,844,true);await b.delay(300);
  assert.ok((await bookSize()).single);
  await b.evaluate(journal+'.querySelector("#sbRight").click()');
  await b.until(journal+'?.querySelector("#sbBook .journal-face.full form")');
  await b.shot('viewport-mobile-journal');
  await b.evaluate('location.hash="#/home"');await b.until(grove+'?.innerWidth===390');
  await b.evaluate(grove+'.__groveTravel.setProgress(0)');
  await b.until(grove+'.__groveTravel.getState().progress===0',60000);
  await b.shot('viewport-mobile-home');
  assert.deepEqual(b.errors,[]);assert.deepEqual(b.network,[]);
  console.log(JSON.stringify({wide,short,wideTravelSpan:span,shortTravelSpan:shortSpan}));
}finally{b.close();server.close()}
