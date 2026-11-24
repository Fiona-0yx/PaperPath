  /* Negative camera X looks LEFT; the world and native cards move RIGHT. */
  var travelTarget = 0, travelCurrent = 0, travelLast = null;
  var travelOverview = false, travelDirty = true, travelAnchors = [];
  var travelSpan = 1, journeyGroups = [];
  var travelPose = { progress: 0, x: 0, y: 0, zoom: 1 };
  window.__groveTravel = {
    setProgress: function(p) { travelTarget = Math.max(0, Math.min(1, Number(p) || 0)); },
    getState: function() { return Object.assign({}, travelPose, {target: travelTarget, span: travelSpan}); },
    setOverview: function(value) { travelOverview = value; travelDirty = true; },
    moveNode: function() {
      var rect = document.querySelector('.play-wrap').getBoundingClientRect();
      travelTarget = Math.min(1, travelCurrent + Math.max(0, W - rect.left + 4) / travelSpan);
    }
  };
  window.addEventListener('resize', function() { travelDirty = true; });
  function buildJourney() {
    // Extend the authored near root with its own bark/moss shaders and plants.
    var identity = function(x,y,z) { return new THREE.Vector3(x,y,z || 0); };
    for (var j=0;j<4;j++) {
      var start=-5.75-j*7.2, base=-.30;
      var trunk=makeLimb(identity, [
        [start+.18,j===0?-1.70:base,-.62],[start-1.5,base+.5,0],
        [start-3.4,base+1.15,.25],[start-5.3,base+.25,0],[start-7.38,base,-.62]
      ], {segs:180,radial:24,vScale:24,rt:[.56,.58,.6,.54,.56],sink:.5});
      var up=j%2===0;
      var branch=makeLimb(identity, [
        [start-.8,base+.18,-.1], [start-2,base+(up?1.7:-.8),.15],
        [start-3.5,base+(up?3.1:-1.3),.1], [start-5,base+(up?2.1:-.8),-.18],
        [start-6.7,base+.12,-.45]
      ], {segs:140,radial:20,vScale:22,rt:[.3,.36,.39,.32,.28],sink:.35});
      var g=assembleRoot([trunk,branch], {
        aspect:ARCH.aspect,haze:.15,fog:0,alpha:1,order:2,
        blades:NARROW.matches?22000:65000,ferns:18,flowers:65,
        fernSize:[.22,.50],flowerSize:[.055,.118],mainLimbs:2,wire:true,
        mouse:uMouseNear,mouseR:1.2
      });
      journeyGroups.push(g);scene.add(g);
    }
    window.__groveBuildCount = (window.__groveBuildCount || 0) + 1;
  }
  function measureTravel() {
    var narrow=W<700;
    var step=Math.max(W*.85,600);
    travelSpan=step*4;
    var cards=Array.prototype.slice.call(document.querySelectorAll('.card[data-category]'));
    cards.forEach(function(el,i) {
      el.style.translate='none';
      if(!travelOverview) {
        var width=narrow?Math.min(W*.70,300):Math.min(W*.235,340);
        el.style.width=width+'px';el.style.height=width*.94+'px';
        el.style.left=((narrow?W*.59:W*.69)-width/2-i*step)+'px';
        el.style.top=(narrow?H*.43:H*(i%2===0?.19:.44))+'px';
      } else ['width','height','left','top'].forEach(function(k){el.style.removeProperty(k);});
    });
    travelAnchors=Array.prototype.slice.call(stageEl.querySelectorAll(':scope > .card,:scope > .headline,:scope > .lede,:scope > .pill-clip,:scope > .play-wrap,:scope > .ghost,:scope > .direction-label'));
    travelAnchors.forEach(function(el){el.style.translate='none';});
    travelDirty=false;travelLast=null;
  }
  function updateTravel(dt) {
    if(travelDirty)measureTravel();
    travelCurrent=REDUCED?travelTarget:travelCurrent+(travelTarget-travelCurrent)*(1-Math.exp(-dt*9));
    if(Math.abs(travelTarget-travelCurrent)<.00005)travelCurrent=travelTarget;
    var x=travelOverview?0:-travelCurrent*travelSpan;
    camera.position.set(x,0,DIST);camera.lookAt(x,0,0);
    journeyGroups.forEach(function(g){
      g.scale.copy(nearGroup.scale);g.position.copy(nearGroup.position);g.rotation.copy(nearGroup.rotation);
      g.scale.x=(travelSpan/4)/7.2;
      g.position.x+=-5.75*(nearGroup.scale.x-g.scale.x);
      g.visible=!travelOverview;
    });
    nearGroup.visible=true;farGroup.visible=!travelOverview;
    if(travelOverview) { camera.position.y=H*.43;camera.lookAt(0,H*.43,0); }
    if(travelLast!==x) {
      travelAnchors.forEach(function(el) {
        el.style.translate=travelOverview?'none':(-x)+'px 0px';
        if(!travelOverview && el.matches('.card,.play-wrap,.pill-clip')) {
          var box=el.getBoundingClientRect();el.inert=box.right<0||box.left>W;
        } else el.inert=false;
      });
      travelPose={progress:travelCurrent,x:x,y:0,zoom:1};
      window.dispatchEvent(new CustomEvent('grove-travel-frame',{detail:travelPose}));
      travelLast=x;
    }
  }
