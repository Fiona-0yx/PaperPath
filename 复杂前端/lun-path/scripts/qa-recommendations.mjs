import assert from 'node:assert/strict';
import { browser } from './browser.mjs';
process.env.LUNJING_DATA_DIR = ':memory:';
process.env.QUESTIONNAIRE_MODEL_PROVIDER = 'none';
const { app } = await import('../../../blog-v3/server.js');
const server = await new Promise(resolve => {
  const instance = app.listen(0, '127.0.0.1', () => resolve(instance));
});
const origin = 'http://127.0.0.1:' + server.address().port;
const entry = '/lun-path/index.html';
const b = await browser();
try {
  await b.viewport(1280,900);
  await b.send('Page.navigate',{url:origin+entry+'#/profile'});
  await b.until('!!window.journalShell');
  await b.evaluate(`(()=>{const s=journalShell.intake;s.answers={direction:{source:'self',values:[0]},outcome:{source:'self',values:[0]}};for(const id of ['intro','education','purpose','reading','english','foundation','python','difficulty'])s.answers[id]={source:'unknown'};s.evidence={};s.portraitReady=true;s.started=true;s.position='summary';journalShell.save();location.hash='#/journal'})()`);
  await b.until('!!document.querySelector(".journal-frame")?.contentDocument?.querySelector("[data-submit-portrait]")');
  await b.evaluate('document.querySelector(".journal-frame").contentDocument.querySelector("[data-submit-portrait]").click()');
  await b.until('!!document.querySelector("[data-local-paper]")');
  assert.match(await b.evaluate('document.querySelector("#recommendations").innerText'),/规则推荐/);
  const id = await b.evaluate('journalShell.intake.recommendation.report.id');
  await b.send('Page.reload');
  await b.until('!!document.querySelector("[data-local-paper]")');
  assert.equal(await b.evaluate('journalShell.intake.recommendation.report.id'),id);
  await b.shot('recommendations-desktop');
  await b.evaluate(`document.querySelector('a[href*="/attention?source=recommendation"]').click()`);
  await b.until('!!document.querySelector(".reader-frame")?.contentDocument?.querySelector("#study-open")');
  await b.evaluate('document.querySelector(".reader-frame").contentDocument.querySelector("#study-open").click()');
  await b.until('!!document.querySelector(".reader-frame").contentDocument.querySelector("dialog[open] [data-do=create]")');
  await b.evaluate('document.querySelector(".reader-frame").contentDocument.querySelector("[data-do=create]").click()');
  await b.until('!!document.querySelector(".reader-frame").contentDocument.querySelector("#plan-depth")');
  assert.equal(await b.evaluate('document.querySelector(".reader-frame").contentDocument.querySelector("#plan-depth").value'),'看懂大意');
  await b.evaluate('location.hash="#/profile"');
  await b.until('!!document.querySelector("[data-local-paper]")');
  await b.viewport(390,844,true);
  await b.shot('recommendations-mobile');
  assert.equal(await b.evaluate('document.documentElement.scrollWidth > innerWidth + 1'),false);
  await b.send('Network.emulateNetworkConditions',{offline:true,latency:0,downloadThroughput:0,uploadThroughput:0});
  await b.click('.recommend-refresh');
  await b.until('document.querySelector("#recommendations").innerText.includes("推荐暂未更新")');
  assert.ok(await b.evaluate('!!document.querySelector("[data-local-paper]")'));
  await b.send('Network.emulateNetworkConditions',{offline:false,latency:0,downloadThroughput:-1,uploadThroughput:-1});
  await b.click('.recommend-refresh');
  await b.until('document.querySelector("#recommendations").innerText.includes("推荐已保存")');
  await b.click('.profile-language');
  await b.until('journalShell.intake.recommendation.report.locale === "en"');
  const englishId = await b.evaluate('journalShell.intake.recommendation.report.id');
  await b.evaluate('localStorage.removeItem("lunjing-intake-v1")');
  await b.send('Page.reload');
  await b.until('!!document.querySelector(".profile-book") && !!document.querySelector("[data-local-paper]")');
  assert.equal(await b.evaluate('journalShell.intake.recommendation.report.id'),englishId);
  assert.equal(b.errors.length,0,JSON.stringify(b.errors));
  // Exercise the outer Vue home (the standalone reader deliberately keeps its direct links).
  await b.viewport(1280,900);
  await b.send('Page.navigate',{url:origin+'/#/home'});
  const shell = 'document.querySelector(\'iframe[name="blog-home-grove"]\')';
  await b.until(shell+'?.contentWindow?.journalShell');
  await b.evaluate(shell+'.contentWindow.location.hash="#/profile"');
  await b.until(shell+'?.contentDocument?.querySelector("a[data-paper-id]") != null');
  const source = shell+'.contentDocument.querySelector("a[data-paper-id][target]")';
  const selected = await b.evaluate(source+'.dataset.paperId');
  await b.evaluate(source+'.click()');
  await b.until('document.querySelector(".paper-selected")?.dataset.paper === '+JSON.stringify(selected));
  await b.until('window.scrollY > 100');
  assert.ok(await b.evaluate('document.querySelectorAll(".paper-card:not(.paper-selected)").length > 0'));
  await b.click('.paper-selected');
  await b.until('!!document.querySelector(".intake-test button:not([disabled])")');
  assert.equal(await b.evaluate('!!document.querySelector(".reading-grid")'),false);
  if(process.env.QA_LIVE_MODEL==='1'){
    const started = Date.now();
    await b.click('.intake-test button');
    await b.until('!!document.querySelector(".intake-test fieldset") || !document.querySelector(".intake-test button")?.disabled',25000);
    assert.ok(await b.evaluate('!!document.querySelector(".intake-test fieldset")'),await b.evaluate('document.querySelector(".intake-test [role=status]").textContent'));
    console.log('Online pretest latency (ms):', Date.now() - started);
    await b.evaluate('document.querySelectorAll(".intake-test input[value=UNSURE]").forEach(el=>el.click())');
    await b.click('.intake-test form button');
  } else {
    await b.evaluate(`(()=>{
      const originalFetch=window.fetch;
      window.fetch=(url,options)=>{
        if (String(url)==='/api/reader/pretests' && JSON.parse(options.body).mode==='quick') {
          return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>{
            window.cancelledPretest=true;
            reject(options.signal.reason);
          },{once:true}));
        }
        return originalFetch(url,options);
      };
    })()`);
    await b.click('.intake-test button');
    await b.until('document.querySelector(".intake-test [role=status]")?.textContent.includes("20 秒")');
    await b.evaluate('Array.from(document.querySelectorAll(".intake-test button")).find(button=>button.textContent.includes("跳过")).click()');
    assert.equal(await b.evaluate('window.cancelledPretest'),true);
  }
  await b.until('document.querySelector(".intake-test h2")?.textContent==="本篇初始画像"');
  await b.click('.intake-test button');
  await b.until('!!document.querySelector(".reading-grid [data-pid]")');
  const selectPassage = `(()=>{const p=document.querySelector('[data-pid]'),r=document.createRange();r.selectNodeContents(p);const s=getSelection();s.removeAllRanges();s.addRange(r);p.dispatchEvent(new PointerEvent('pointerup',{bubbles:true}));})()`;
  await b.evaluate(selectPassage);
  await b.until('!!document.querySelector(".selection-tools .red")');
  await b.click('.selection-tools .red');
  await b.until('!!document.querySelector(".paragraph .red")');
  await b.evaluate('Array.from(document.querySelectorAll(".reading-grid nav button")).find(b=>b.textContent==="篇内画像").click()');
  await b.until('document.querySelector("[data-behavior-evidence]")?.textContent.includes("需要补讲")');
  const previousDocument = await b.evaluate('performance.timeOrigin');
  await b.send('Page.reload');
  await b.until('performance.timeOrigin !== '+previousDocument);
  await b.until('!!document.querySelector(".paragraph .red")');
  if(process.env.QA_LIVE_MODEL==='1'){
    await b.evaluate(selectPassage);
    await b.until('!!document.querySelector(".selection-tools button:last-child")');
    await b.click('.selection-tools button:last-child');
    await b.fill('#paper-question','用中文解释这句原文，说明这篇论文关注什么。');
    await b.click('.reading-grid form button');
    await b.until('!!document.querySelector(".reading-grid aside article blockquote") || document.querySelector(".reading-grid [role=status]")?.textContent.includes("暂时无法回答")',100000);
    assert.ok(await b.evaluate('!!document.querySelector(".reading-grid aside article blockquote")'),await b.evaluate('document.querySelector(".reading-grid [role=status]").textContent'));
    assert.ok(await b.evaluate(`document.querySelector('[data-pid]').textContent.includes(document.querySelector('.reading-grid aside article blockquote').textContent.replace(/^原文依据 · /,''))`));
    assert.ok(await b.evaluate('document.querySelector(".reading-grid aside article").textContent.includes("这段有未解决的标记")'));
  }
  await b.evaluate('Array.from(document.querySelectorAll(".reading-grid nav button")).find(b=>b.textContent==="笔记").click()');
  await b.evaluate('Array.from(document.querySelectorAll(".reading-grid aside article button")).find(b=>b.textContent==="标记已解决").click()');
  await b.evaluate('Array.from(document.querySelectorAll(".reading-grid nav button")).find(b=>b.textContent==="篇内画像").click()');
  await b.until('document.querySelector("[data-behavior-evidence]")?.textContent.includes("用户已标记解决")');
  assert.ok((await b.evaluate('location.hash')).includes('paper='+selected));
  await b.click('.back-to-papers');
  await b.until('document.activeElement?.dataset.paper === '+JSON.stringify(selected));
  console.log('PASS: recommendation, refresh, reading plan, mobile, offline preservation and retry', JSON.stringify(b.network));
} finally { b.close(); server.closeAllConnections(); server.close(); }
