import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export async function prepareGrove(){
  const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
  let html=await readFile(path.join(root,'../sylva-preview/public/landing-pages/inner-green-3d.html'),'utf8');
  // Preserve the authored page: renderer, responsive scene, portals, dock,
  // liquid-metal controls and entrance animation all run together.
  html=html.replaceAll('/landing-pages/inner-green-assets/','/scenes/inner-green-assets/');
  const travel=await readFile(path.join(root,'scripts/scene-travel-hook.js'),'utf8');
  const originalCamera=/camera\.position\.x = -smooth\.x \* 26;\s*camera\.position\.y =  smooth\.y \* 16;\s*camera\.lookAt\(camera\.position\.x \* 0\.42, camera\.position\.y \* 0\.42, 0\);/;
  if(!originalCamera.test(html)||!html.includes('  var frames = 0;'))throw Error('Authored camera hook not found');
  html=html.replace(originalCamera,'updateTravel(dt);');
  html=html.replace('  var frames = 0;',travel+'\n  var frames = 0;');
  html=html.replace('<title>Sylva', '<title>论径');
  html=html.replace('</head>',`<link rel="stylesheet" href="/assets/grove-adaptation.css"></head>`);
  html=html.replace('</body>',`<script src="/assets/grove-bridge.js"></script></body>`);
  await writeFile(path.join(root,'public/scenes/grove.html'),html);
  console.log('Prepared complete Sylva page with product text and navigation bindings.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await prepareGrove();
