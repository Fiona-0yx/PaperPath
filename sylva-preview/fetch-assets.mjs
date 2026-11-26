import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import path from 'node:path';
const base=path.dirname(process.cwd());
const jobs=[];
for(const [dir,id,port] of [['sylva-preview','sylva-hero',5175],['sketchbook-preview','meng-to-sketchbook-landing-page',5176]]){
  const root=path.join(base,dir), bundle=JSON.parse(await readFile(path.join(root,'source-bundle.json'),'utf8'));
  const html=bundle.files.find(f=>f.role==='canonical-source');
  const actual=createHash('sha256').update(await readFile(path.join(root,html.path))).digest('hex');
  await writeFile(path.join(root,'SOURCE-NOTES.txt'),`官方示例原样预览，未加入论径功能。\n运行：在此目录执行 npm start，然后打开 http://127.0.0.1:${port}/\n源码清单：https://threeui.com/source-code/${id}.json\nHTML：https://threeui.com${html.sourceUrl}\nHTML 当前 SHA256：${actual}\n清单 SHA256：${html.sha256}\n二者${actual===html.sha256?'一致':'不同，官网已更新，不能宣称为清单历史版本'}。\n原 HTML 保持原样；仍有在线媒体引用，需要联网。\nReact 宿主等注册源码已保存到 src；此预览直接运行 HTML，无需安装依赖。\n`);
  for(const f of [...bundle.files.filter(f=>f.sourceUrl&&f.role!=='canonical-source'),...bundle.assets]){
    const target=path.join(root,f.path);
    if(!target.startsWith(root+path.sep))throw Error('Invalid asset path');
    jobs.push({target,url:'https://threeui.com/'+f.path.replace(/^public\//,''),sha256:f.sha256});
  }
}
let next=0;const results=[];
await Promise.all(Array.from({length:4},async()=>{
  while(next<jobs.length){
    const job=jobs[next++];await mkdir(path.dirname(job.target),{recursive:true});
    await new Promise((resolve,reject)=>{
      const proc=spawn('curl.exe',['--silent','--show-error','--fail','--location','--ssl-revoke-best-effort','--connect-timeout','10','--max-time','60','--output',job.target,job.url],{windowsHide:true,stdio:['ignore','ignore','pipe']});
      let err='';proc.stderr.on('data',d=>err+=d);proc.on('error',reject);proc.on('exit',c=>c===0?resolve():reject(Error(job.url+' '+err)));
    });
    const actual=createHash('sha256').update(await readFile(job.target)).digest('hex');
    results.push({path:path.relative(base,job.target),hashMatches:actual===job.sha256,sha256:actual});
  }
}));
await writeFile('asset-verification.json',JSON.stringify(results,null,2));
console.log(JSON.stringify({downloaded:results.length,hashMatches:results.filter(r=>r.hashMatches).length,changed:results.filter(r=>!r.hashMatches)},null,2));
