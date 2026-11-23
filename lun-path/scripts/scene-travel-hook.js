  /* Scroll-driven camera path through the authored Sylva geometry.
     The original plants, materials, light, pollen and butterfly stay intact. */
  var travelTarget = 0, travelCurrent = 0, travelDirty = true;
  var travelAnchors = [], travelFrames = [], travelLast = -1;
  var travelPose = { progress: 0, phase: 0, x: 0, y: 0, zoom: 1 };
  window.__groveTravel = {
    setProgress: function(p) { travelTarget = Math.max(0, Math.min(1, Number(p) || 0)); },
    getState: function() { return Object.assign({}, travelPose, { target: travelTarget }); }
  };
  window.addEventListener('resize', function() { travelDirty = true; });
  function travelEase(a,b,p) { var t=Math.max(0,Math.min(1,(p-a)/(b-a))); return t*t*(3-2*t); }
  function measureTravel() {
    var nodes = Array.prototype.filter.call(stageEl.children, function(el) {
      return !el.classList.contains('scroll') && !el.classList.contains('branch-hint');
    });
    nodes.forEach(function(el) { el.style.translate='none'; el.style.scale='none'; });
    var heroRect=hero.getBoundingClientRect();
    travelAnchors=nodes.map(function(el) {
      var box=el.getBoundingClientRect(), origin=getComputedStyle(el).transformOrigin.split(' ');
      return { el:el, x:box.left-heroRect.left+(parseFloat(origin[0])||box.width/2), y:box.top-heroRect.top+(parseFloat(origin[1])||box.height/2) };
    });
    var portrait=NARROW.matches;
    function frame(selector,p,targetX,targetY,zoom) {
      var box=document.querySelector(selector).getBoundingClientRect();
      var worldX=box.left-heroRect.left+box.width/2-W/2;
      var worldY=H/2-(box.top-heroRect.top+box.height/2);
      return { p:p, x:worldX-(targetX-W/2)/zoom, y:worldY-(H/2-targetY)/zoom, zoom:zoom };
    }
    travelFrames=[
      {p:0,x:0,y:0,zoom:1},
      frame('.play-wrap',.30,portrait?W*.30:W*.27,H*.52,portrait?1:1.18),
      frame('.card--about',.65,portrait?W*.50:W*.70,H*(portrait?.68:.48),portrait?1:1.18),
      frame('.card--stove',1,portrait?W*.50:W*.73,H*(portrait?.74:.52),portrait?1:1.15)
    ];
    travelDirty=false;travelLast=-1;
  }
  function updateTravel(dt) {
    if(travelDirty)measureTravel();
    travelCurrent=REDUCED?travelTarget:travelCurrent+(travelTarget-travelCurrent)*(1-Math.exp(-dt*10));
    if(Math.abs(travelTarget-travelCurrent)<.0001)travelCurrent=travelTarget;
    var p=travelCurrent, k=0;
    while(k<travelFrames.length-2&&p>travelFrames[k+1].p)k++;
    var a=travelFrames[k],b=travelFrames[k+1],t=travelEase(a.p,b.p,p);
    var x=a.x+(b.x-a.x)*t,y=a.y+(b.y-a.y)*t,zoom=a.zoom+(b.zoom-a.zoom)*t;
    camera.position.set(x-smooth.x*26,y+smooth.y*16,DIST/zoom);
    camera.lookAt(x-smooth.x*26*.42,y+smooth.y*16*.42,0);
    var phase=p<.12?0:p<.47?1:p<.82?2:3;
    travelPose={progress:p,phase:phase,x:x,y:y,zoom:zoom};
    if(Math.abs(p-travelLast)>.00005){
      travelAnchors.forEach(function(anchor){
        anchor.el.style.translate=((W/2-anchor.x)*(1-zoom)-x*zoom)+'px '+((H/2-anchor.y)*(1-zoom)+y*zoom)+'px';
        anchor.el.style.scale=String(zoom);
      });
      var initial=1-travelEase(.03,.20,p);
      hero.style.setProperty('--travel-intro',initial);
      ['.pill-clip','.stat','.headline'].forEach(function(s){var el=document.querySelector(s);if(el)el.inert=initial<.15;});
      [['foundations',.30,'.play-wrap'],['methods',.65,'.card--about'],['practice',1,'.card--stove']].forEach(function(item){
        var weight=Math.max(1-travelEase(.06,.22,p),1-travelEase(.12,.30,Math.abs(p-item[1])));
        hero.style.setProperty('--'+item[0]+'-visibility',weight);
        hero.style.setProperty('--'+item[0]+'-events',weight>.25?'auto':'none');
        document.querySelector(item[2]).inert=weight<.25;
        if(item[0]==='methods')document.querySelector('.knob-float').inert=weight<.25;
      });
      window.dispatchEvent(new CustomEvent('grove-travel-frame',{detail:travelPose}));
      travelLast=p;
    }
  }
