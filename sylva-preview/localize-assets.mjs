import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';
const base=path.dirname(process.cwd());
for(const dir of ['sylva-preview','sketchbook-preview']){
  const root=path.join(base,dir),bundle=JSON.parse(await readFile(path.join(root,'source-bundle.json'),'utf8'));
  const file=bundle.files.find(f=>f.role==='canonical-source');
  const target=path.join(root,file.path);
  const original=await readFile(target,'utf8');
  await mkdir(path.join(root,'originals'),{recursive:true});
  await writeFile(path.join(root,'originals',path.basename(file.path)),original);
  const byName=new Map(bundle.assets.map(a=>[path.basename(a.path),a]));
  const local=original.replace(/https:\/\/ublctyddhtbgaersvxxb\.supabase\.co\/storage\/v1\/object\/public\/threeui-media\/scene-images\/[^\s"'<>\\)]+/g,url=>{
    const name=path.basename(url);
    const asset=byName.get(name)||bundle.assets.find(a=>name.startsWith(a.sha256+'.'));
    return asset?'/'+asset.path.replace(/^public\//,''):url;
  });
  await writeFile(target,local);
  await writeFile(path.join(root,'SOURCE-NOTES.txt'),(await readFile(path.join(root,'SOURCE-NOTES.txt'),'utf8'))+'\n本地化补充：原始下载保存在 originals，运行文件仅将清单中图片与字体的外链改为本地路径，保持设计、渲染与交互逻辑。清单中的全部资源已下载并通过 SHA256 校验。\n');
  console.log(dir+': local asset references prepared');
}
