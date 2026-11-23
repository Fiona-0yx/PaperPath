import { browser } from './browser.mjs';
import { writeFile } from 'node:fs/promises';
const b=await browser();
try{
  await b.viewport(1440,1000);
  await b.send('Page.navigate',{url:'http://127.0.0.1:5180/#/garden'});
  await b.until("document.querySelector('#grove-frame')?.contentWindow?.__ready === true",45000);
  const setEvidence=async status=>{
    await b.evaluate(`import('/src/state.js').then(m=>{const s=m.blankState();s.onboarded=true;s.profile.direction='plants';s.evidence=[{paperId:'leaf-splits',stage:'diagnostic',status:${JSON.stringify(status)}}];localStorage.setItem('lunjing-journal-v1',JSON.stringify(s));})`);
    await b.send('Page.reload');await b.until("document.querySelector('#grove-frame')?.contentWindow?.__ready === true",45000);
  };
  await setEvidence('incorrect');
  if(!await b.evaluate("!!document.querySelector('#grove-frame').contentDocument.querySelector('.play-wrap.grove-recommended')"))throw Error('Missing prerequisite recommendation');
  await setEvidence('correct');
  if(!await b.evaluate("!!document.querySelector('#grove-frame').contentDocument.querySelector('.card--about.grove-recommended')"))throw Error('Missing next-step recommendation');
  await b.shot('04-garden');
  await b.evaluate("location.hash='#/shelf/foundations'");
  await b.until("document.querySelector('#shelf-frame')?.contentDocument?.querySelector('#experience')?.classList.contains('webgl-ready')",60000);
  await b.delay(700);await b.shot('05-shelf');
  const health=await b.evaluate("fetch('/api/health').then(r=>r.json())");
  if(!health.ok||health.modelConfigured!==false)throw Error('Unexpected runtime mode');
  const result={recommendationChangesWithEvidence:true,shelfRendered:true,health,errors:b.errors,network:b.network};
  await writeFile('qa/final-smoke.json',JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));
  if(b.errors.length)throw Error('Browser exception');
}finally{b.close();}
