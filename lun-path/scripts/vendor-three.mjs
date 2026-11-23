import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { createHash } from 'node:crypto';
const files=['build/three.module.js','examples/jsm/controls/OrbitControls.js','examples/jsm/environments/RoomEnvironment.js','examples/jsm/geometries/RoundedBoxGeometry.js','examples/jsm/lights/RectAreaLightUniformsLib.js','LICENSE'];
const root=path.resolve('public/vendor/three');let next=0;const manifest=[];
await Promise.all(Array.from({length:3},async()=>{while(next<files.length){const file=files[next++],out=path.join(root,file);await mkdir(path.dirname(out),{recursive:true});await new Promise((resolve,reject)=>{const p=spawn('curl.exe',['--silent','--show-error','--fail','--location','--ssl-revoke-best-effort','--connect-timeout','15','--max-time','90','--output',out,'https://cdn.jsdelivr.net/npm/three@0.165.0/'+file],{windowsHide:true,stdio:['ignore','ignore','pipe']});let err='';p.stderr.on('data',d=>err+=d);p.on('exit',c=>c===0?resolve():reject(Error(file+' '+err)));p.on('error',reject);});manifest.push({file,sha256:createHash('sha256').update(await readFile(out)).digest('hex')});}}));
await writeFile(path.join(root,'source-manifest.json'),JSON.stringify({version:'0.165.0',source:'https://cdn.jsdelivr.net/npm/three@0.165.0/',files:manifest},null,2));console.log('Saved local Three.js r165 and dependencies: '+manifest.length+' files.');
