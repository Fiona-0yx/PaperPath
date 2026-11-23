import { prepareGrove } from './prepare-grove.mjs';
import { mkdir, readFile, writeFile, cp } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const parent=path.dirname(root);
const read=p=>readFile(path.join(parent,p),'utf8');
await mkdir(path.join(root,'public/scenes'),{recursive:true});
await mkdir(path.join(root,'public/assets'),{recursive:true});
await cp(path.join(parent,'sketchbook-preview/public/landing-pages/meng-to-sketchbook'),path.join(root,'public/assets/botanical'),{recursive:true});
await cp(path.join(parent,'sylva-preview/public/landing-pages/inner-green-assets'),path.join(root,'public/scenes/inner-green-assets'),{recursive:true});
for(const [dir,file] of [['sylva-preview','inner-green-3d.html'],['complete-shelf-preview','complete-shelf-v2.html'],['sketchbook-preview','meng-to-sketchbook.html'],['book-showcase-preview','bestsellers-book-showcase.html']]){
  await mkdir(path.join(root,'references'),{recursive:true});
  await writeFile(path.join(root,'references',file),await read(`${dir}/public/landing-pages/${file}`));
}
await prepareGrove();
let shelf=await read('complete-shelf-preview/public/landing-pages/complete-shelf-v2.html');
shelf=shelf.replaceAll('https://cdn.jsdelivr.net/npm/three@0.165.0/','/vendor/three/');
shelf=shelf.replace(/<link\b[^>]*href="https:\/\/fonts\.[\s\S]*?>/g,'');
shelf=shelf.replace('coverAtlasImage.src = COVER_ATLAS_DATA;','// Cover titles are drawn from the local paper catalog.');
shelf=shelf.replace('woodTextureImage.src = WOOD_TEXTURE_DATA;','// Use the authored procedural wood when no texture is provided.');
shelf=shelf.replace('const experience = document.querySelector("#experience");',`const params = new URLSearchParams(location.search);
    const zh=params.get('lang')!=='en';
    let catalog=[];try{catalog=JSON.parse(params.get('catalog')||'[]')}catch{}
    if(catalog.length){const templates=BOOKS.slice(); BOOKS.splice(0,BOOKS.length,...catalog.map((p,i)=>({...templates[i%templates.length],id:p.id,title:p.coverTitle||p.title,note:p.title,deck:p.abstract,discipline:zh?'学习文献':'Field paper',theme:p.title,chapters:['Read','Reflect','Grow']})));}
    const fallbackGrid=document.querySelector('.fallback__grid');
    if(fallbackGrid){fallbackGrid.replaceChildren(...BOOKS.map(p=>{const b=document.createElement('button');b.className='fallback-book';b.style.setProperty('--book-color',p.color);const label=document.createElement('strong');label.textContent=p.note;b.append(label);b.addEventListener('click',()=>parent.postMessage({type:'paper-opened',paperId:p.id},location.origin));return b;}));}
    document.querySelector('#fallback-title').textContent=zh?'选择一篇论文':'Choose a paper';
    document.querySelector('#fallback-status').textContent=zh?'可从目录继续阅读。':'Continue from the paper index.';
    const experience = document.querySelector("#experience");`);
shelf=shelf.replace('coverAtlasReady = true;','coverAtlasReady = false;');
shelf=shelf.replace('narrow ? 8.7 : 8.1','narrow ? 6.7 : 5.8');
shelf=shelf.replace('await coverAtlasImage.decode();','// Procedural authored covers carry the new paper titles.');
shelf=shelf.replace('ctx.fillText(book.title, canvasTexture.width / 2, canvasTexture.height * 0.72);',`const words=book.title.split(' '); const midpoint=Math.ceil(words.length/2);const lines=book.title.length>17?[words.slice(0,midpoint).join(' '),words.slice(midpoint).join(' ')]:[book.title];lines.forEach((line,i)=>ctx.fillText(line,canvasTexture.width/2,canvasTexture.height*(.68+i*.075),650));`);
shelf=shelf.replace('ctx.fillText(book.title, 58, 1020);','// The procedural base already carries the paper title.');
shelf=shelf.replace('ctx.fillText(book.discipline.toUpperCase(), 60, 1066);','// Avoid a duplicate caption in the foil layer.');
shelf=shelf.replaceAll('WORKING VOLUMES','LUN JING / PAPERS').replaceAll('Working Volumes','论径 · 论文书架');
shelf=shelf.replace('function openDetail(origin = inspectButton) {',`function openDetail(origin = inspectButton) {
      if(parent!==window){parent.postMessage({type:'paper-opening',paperId:BOOKS[selectedIndex].id},location.origin);}
`);
shelf=shelf.replace('closeButton.focus({ preventScroll: true });',`closeButton.focus({ preventScroll: true });
      if(parent!==window)parent.postMessage({type:'paper-opened',paperId:activeBook.data.id},location.origin);`);
shelf=shelf.replace('function updateSelection(index, announce = false) {',`function updateSelection(index, announce = false) {`);
shelf=shelf.replace('selectionTitle.textContent = book.title;',`selectionTitle.textContent = book.title; if(parent!==window)parent.postMessage({type:'paper-selected',paperId:book.id},location.origin);`);
shelf=shelf.replace('experience.classList.add("webgl-ready");',`experience.classList.add("webgl-ready");parent.postMessage({type:'shelf-ready'},location.origin);`);
shelf=shelf.replace('function showFallback(message) {',`function showFallback(message) { parent.postMessage({type:'shelf-ready'},location.origin);`);
shelf=shelf.replace('Seven field guides for making', 'Papers for a curious mind');
shelf=shelf.replace('</head>',`<style>
  .editorial-header,.pointer-label,.selection,.detail-panel,.close-button,.microcopy{display:none!important}
  .browse-actions{bottom:24px!important}.browse-ui{pointer-events:none}.browse-actions,.index-nav{pointer-events:auto}
  .index-nav{right:30px!important;bottom:32px!important}.loading{background:#292b28!important}
  .experience{--paper:#292b28;--ink:#eee9dd}.text-button{font-family:Georgia,serif!important}
  @media(max-width:650px){.index-nav{display:none!important}}
  </style></head>`);
shelf=shelf.replace('</body>',`<script>
  const zh=new URLSearchParams(location.search).get('lang')!=='en';
  document.querySelector('#inspect').textContent=zh?'翻开论文':'Open paper';
  document.querySelector('#previous').setAttribute('aria-label',zh?'上一篇':'Previous paper');
  document.querySelector('#next').setAttribute('aria-label',zh?'下一篇':'Next paper');
  document.querySelector('#loading p').textContent=zh?'正在整理书架':'Arranging your shelf';
  </script></body>`);
await writeFile(path.join(root,'public/scenes/shelf.html'),shelf);
// The first showcase contributes its cloth binding and layered page block,
// with its stronger hover motion replaced by the second shelf's renderer.
let showcase=await read('book-showcase-preview/public/landing-pages/bestsellers-book-showcase.html');
const css=showcase.match(/<style>([\s\S]*?)<\/style>/)?.[1]||'';
const from=css.indexOf('    .page-block::after'),to=css.indexOf('    .front-cover::before');
await writeFile(path.join(root,'public/assets/showcase-binding.css'),`/* Adapted from the provided BestsellersBookShowcase. Scoped to journal bindings. */\n`+(from>=0&&to>from?css.slice(from,to).replaceAll('.page-block','.journal-binding .page-block').replaceAll('.page-fan','.journal-binding .page-fan').replaceAll('.front-cover','.journal-binding .front-cover'):''));
console.log('Prepared four original references, local botanical assets, grove scene and adapted paper shelf.');
