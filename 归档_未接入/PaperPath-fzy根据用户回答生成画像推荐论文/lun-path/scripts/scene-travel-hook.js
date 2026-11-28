  /* Positive camera X looks RIGHT; the world and native cards move LEFT. */
  var travelTarget = 0, travelCurrent = 0, travelLast = null;
  var travelOverview = false, travelDirty = true, travelAnchors = [];
  var travelSpan = 1, journeyGroups = [], journeyBranches = [], journeyPerches = [];
  var journeyAir = [], journeyButterflies = [];
  var travelPose = { progress: 0, x: 0, y: 0, zoom: 1 };
  window.__groveTravel = {
    setProgress: function(p) { travelTarget = Math.max(0, Math.min(1, Number(p) || 0)); },
    getState: function() { return Object.assign({}, travelPose, {target: travelTarget, span: travelSpan}); },
    setOverview: function(value) { travelOverview = value; travelDirty = true; },
    moveNode: function() {
      var rect = document.querySelector('.play-wrap').getBoundingClientRect();
      travelTarget = Math.min(1, travelCurrent + Math.max(0, rect.right + 4) / travelSpan);
    }
  };
  window.addEventListener('resize', function() { travelDirty = true; });
  function extendJourneyTrunk(nearLimbs) {
    // A continuous trunk removes exposed ends between extension sections.
    // Branch ends taper inside that trunk, using Sylva's original surface builder.
    var identity = function(x,y,z) { return new THREE.Vector3(x,y,z || 0); };
    var original=nearLimbs[0];
    var spine=original.curve.points.map(function(p){return [p.x,p.y,p.z];});
    spine.push([6.5,-.66,-.65]);
    for (var j=0;j<4;j++) {
      var start=5.9+j*7.2, base=-.30;
      spine.push([start+1.5,base+.5,0], [start+3.4,base+1.15,.25],
        [start+5.3,base+.25,0],[start+7.2,base,-.62]);
      var up=j%2===0;
      var branch=makeLimb(identity, [
        [start+.45,j===0?-.46:base+.10,-.48],
        [start+1.25,base+(up?.7:-.25),-.08],
        [start+2.4,base+(up?2.2:-1),up?-1.25:-.5],
        [start+3.6,base+(up?2.9:-1.25),up?-1.65:-.7],
        [start+5,base+(up?2:-.75),up?-1.15:-.5],
        [start+6.25,base+(up?.45:-.20),-.38],
        [start+6.9,base+.03,-.55]
      ], {segs:180,radial:24,vScale:22,rt:[.08,.23,.34,.37,.32,.21,.06],sink:.35});
      journeyBranches.push({limb:branch,far:up});
      journeyPerches.push(makeLimb(identity,[
        [start+1.5,base+.5,0],[start+3.4,base+1.15,.25],[start+5.3,base+.25,0]
      ],{segs:90,radial:20,vScale:12,rt:[.56,.56,.56],sink:.5}));
    }
    // Continue beyond the final stop, keeping the far endpoint out of view.
    spine.push([36.7,-.1,-.55],[39,.35,-.25]);
    var curve=new THREE.CatmullRomCurve3(spine.map(function(p){return identity(p[0],p[1],p[2]);}),false,'centripetal',.5);
    var originalFraction=original.len/curve.getLength();
    var extended=makeLimb(identity,spine,{
      segs:1100,radial:28,vScale:120,sink:.5,
      rw:function(t){var blend=sstep(originalFraction-.015,originalFraction+.03,t);return original.rw(Math.min(1,t/originalFraction))*(1-blend)+.56*.52*knot(t,.05,.024)*blend;},
      moss:function(t){var blend=sstep(originalFraction-.015,originalFraction+.03,t);return original.moss(Math.min(1,t/originalFraction))*(1-blend)+.56*.88*blend;}
    });
    return [extended].concat(nearLimbs.slice(1));
  }
  function buildJourney() {
    journeyBranches.forEach(function(item,i){
      var g=assembleRoot([item.limb],{
        aspect:ARCH.aspect,haze:.16,fog:item.far?.27:.12,alpha:1,order:1,
        hazeCol:[.150,.164,.120],hazeLift:.82,
        blades:NARROW.matches?11000:24000,ferns:12,flowers:35,
        fernSize:[.22,.50],flowerSize:[.055,.118],mainLimbs:1,wire:true,
        mouse:uMouseNear,mouseR:1.2
      });
      journeyGroups.push(g);scene.add(g);
      journeyButterflies.push(buildButterfly(nearGroup,[journeyPerches[i]],nearGroup.userData.uni));
      var ridge=farGroup.clone(true),light=glowMesh.clone(),shadow=shadowMesh.clone();
      scene.add(ridge,light,shadow);journeyAir.push({ridge:ridge,light:light,shadow:shadow});
    });
    window.__groveBuildCount = (window.__groveBuildCount || 0) + 1;
    window.__groveAtmosphere = {distantBranches:journeyGroups.length,butterflies:journeyButterflies.length+1};
  }
  function measureTravel() {
    var narrow=W<700;
    var step=7.2*nearGroup.scale.x;
    travelSpan=step*4;
    var cards=Array.prototype.slice.call(document.querySelectorAll('.card[data-category]'));
    cards.forEach(function(el,i) {
      el.style.translate='none';
      if(!travelOverview) {
        var width=narrow?Math.min(W*.70,300):Math.min(W*.235,340);
        el.style.width=width+'px';el.style.height=width*.94+'px';
        el.style.left=((narrow?W*.59:W*.69)-width/2+i*step)+'px';
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
    var x=travelOverview?0:travelCurrent*travelSpan;
    camera.position.set(x,0,DIST);camera.lookAt(x,0,0);
    journeyGroups.forEach(function(g){
      g.scale.copy(nearGroup.scale);g.position.copy(nearGroup.position);g.rotation.copy(nearGroup.rotation);
      g.visible=!travelOverview;
    });
    journeyAir.forEach(function(air,i){
      [[air.ridge,farGroup],[air.light,glowMesh],[air.shadow,shadowMesh]].forEach(function(pair){
        pair[0].position.copy(pair[1].position);pair[0].scale.copy(pair[1].scale);pair[0].rotation.copy(pair[1].rotation);
        pair[0].position.x+=(i+1)*travelSpan/4*(DIST-pair[1].position.z)/DIST;
        pair[0].visible=!travelOverview;
      });
    });
    if(!REDUCED)journeyButterflies.forEach(function(update){update(dt,uTime.value);});
    if(motes)motes.position.x=x;
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
