export async function makeJournalArt() {
  const original=new Image();
  original.src='/assets/botanical/botanic-gardens.png';
  await original.decode();
  const canvas=document.createElement('canvas');
  canvas.width=original.width;canvas.height=original.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});
  ctx.drawImage(original,0,0);
  const scanned=ctx.getImageData(0,0,canvas.width,canvas.height);
  const pixels=scanned.data,width=canvas.width;
  const point=(x,y)=>(y*width+x)*4;
  function cleaned(x0,y0,x1,y1) {
    const out=new ImageData(new Uint8ClampedArray(pixels),width,canvas.height);
    for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){
      const at=point(x,y);
      // Sample the same printed page and the same column (including the gutter).
      const row=(y-y0)%102;
      const sample=point(x,300+(row<51?row:101-row));
      const edge=Math.min(1,(x-x0)/20,(x1-x)/20,(y-y0)/18,(y1-y)/18);
      for(let c=0;c<3;c++){
        const bottom=pixels[point(x,907)+c],top=pixels[point(x,332)+c];
        const base=pixels[sample+c]+(bottom-top)*Math.max(0,Math.min(1,(y-332)/575));
        out.data[at+c]=pixels[at+c]+(base-pixels[at+c])*edge;
      }
    }
    return out;
  }
  function texture(){
    return new Promise(resolve=>canvas.toBlob(blob=>resolve(URL.createObjectURL(blob))));
  }
  const coverPaper=cleaned(1150,365,1535,872);
  ctx.putImageData(coverPaper,0,0);
  // Preserve the original tape and soft shadow but discard matching paper pixels.
  const cut=document.createElement('canvas');cut.width=287;cut.height=330;
  const cutCtx=cut.getContext('2d'),leaf=cutCtx.createImageData(cut.width,cut.height);
  for(let y=0;y<cut.height;y++)for(let x=0;x<cut.width;x++){
    const at=point(x+1180,y+385),dst=(y*cut.width+x)*4;
    const contrast=Math.max(...[0,1,2].map(c=>coverPaper.data[at+c]-pixels[at+c]));
    const alpha=Math.min(1,Math.max(0,(contrast-3)/16));
    leaf.data.set(pixels.subarray(at,at+3),dst);leaf.data[dst+3]=255*alpha;
  }
  cutCtx.putImageData(leaf,0,0);ctx.drawImage(cut,1207,410,246,283);
  const cover=await texture();
  ctx.putImageData(cleaned(108,363,1648,885),0,0);
  return {cover,sheet:await texture()};
}
