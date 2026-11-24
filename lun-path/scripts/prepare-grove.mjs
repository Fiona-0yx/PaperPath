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
  html=html.replace('    buildAmbient();','    buildAmbient();\n    buildJourney();');
  // Keep the authored root points, extending the same mesh without a join.
  html=html.replace('    var mainCount = nearLimbs.length;',`    var butterflyLimbs = nearLimbs.slice();
    nearLimbs = extendJourneyTrunk(nearLimbs);
    var mainCount = nearLimbs.length;`);
  html=html.replace('if (!small) bf = buildButterfly(nearGroup, nearLimbs, nearGroup.userData.uni);','bf = buildButterfly(nearGroup, butterflyLimbs, nearGroup.userData.uni);');
  html=html.replace('blades: BLADES_NEAR, ferns: small ? 26 : 46, flowers: small ? 120 : 260,','blades: BLADES_NEAR + (small ? 80000 : 180000), ferns: small ? 54 : 108, flowers: small ? 220 : 460,');
  html=html.replace('if (renderer && clock) renderFrame();','if (renderer && clock && !window.__grovePaused) renderFrame();');
  html=html.replace('  function layout() {','  function layout() {\n    if (!hero.clientWidth || !hero.clientHeight) return;');
  html=html.replace('<title>Sylva', '<title>论径');
  html=html.replace('</head>',`<link rel="stylesheet" href="/assets/grove-adaptation.css"></head>`);
  // Bind/clone the original cards before Sylva measures its portals and dock.
  html=html.replace('<script src="inner-green-assets/three.min.js">', '<script src="/assets/grove-bridge.js"></script>\n<script src="inner-green-assets/three.min.js">');
  await writeFile(path.join(root,'public/scenes/grove.html'),html);
  console.log('Prepared complete Sylva page with product text and navigation bindings.');
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await prepareGrove();
