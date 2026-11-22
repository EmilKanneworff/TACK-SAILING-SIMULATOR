/* FRI VIND v11 — one world-fixed race model for physics registration, map and 3D.
 * SI metres/seconds. World x=east, y=north; theta CCW from east.
 * Simplified solo sailing instructions inspired by RRS 2025–2028 definitions
 * Start / Sail the Course / Finish and Appendix S. NOT a complete RRS engine:
 * no right-of-way, protests, mark-touch penalties or rule 30 starting flags.
 * Roundings follow the actual swept track and required side. No maximum
 * rounding radius; proximity alone never advances a visit. Gates require
 * entry between the pair, followed by an outward turn around either buoy.
 * Start/finish use hull only, never rig, foils, sailor or wake. Monotonic
 * elapsed time from the gun includes pauses, suspensions and recovery.
 */
(function(install){
 if(typeof module!=='undefined'&&module.exports)module.exports=install;
 else install(globalThis);
})(function(g){
'use strict';
const PI=Math.PI,TAU=PI*2,EPS=1e-7,clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
const dot=(a,b)=>a.x*b.x+a.y*b.y,cross=(a,b)=>a.x*b.y-a.y*b.x;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y}),add=(a,b)=>({x:a.x+b.x,y:a.y+b.y});
const mul=(a,k)=>({x:a.x*k,y:a.y*k}),len=a=>Math.hypot(a.x,a.y);
const unit=a=>{const n=len(a);return n>EPS?mul(a,1/n):{x:0,y:1};};
const right=a=>({x:a.y,y:-a.x}),neg=a=>({x:-a.x,y:-a.y});
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),positive=a=>(a%TAU+TAU)%TAU;
const mix=(a,b,t)=>a+(b-a)*t,along=(p,c,d)=>dot(sub(p,c),d);
const interpolate=(a,b,t)=>({x:mix(a.x,b.x,t),y:mix(a.y,b.y,t),theta:(a.theta||0)+wrap((b.theta||0)-(a.theta||0))*t,heel:(a.heel||0)+wrap((b.heel||0)-(a.heel||0))*t,pitch:(a.pitch||0)+wrap((b.pitch||0)-(a.pitch||0))*t});
const monotonic=()=>typeof performance!=='undefined'?performance.now():Date.now();
const courseDistanceScale=g.ArchipelagoData?.horizontalScale??1;
// Game course dimensions based on useful upwind VMG and turning room.
// These are design values, not measured boat polars or racing class rules.
const SIZES={laser:{length:210,gateWidth:36,roundingRadius:11,expectedUpwindVMG:1.8},dinghy:{length:280,gateWidth:50,roundingRadius:16,expectedUpwindVMG:2.45},yacht:{length:480,gateWidth:118,roundingRadius:40,expectedUpwindVMG:3.8},ac75:{length:960,gateWidth:230,roundingRadius:76,expectedUpwindVMG:7.6},ac72:{length:1120,gateWidth:270,roundingRadius:86,expectedUpwindVMG:8.8}};
const TYPES={gates:'Op/ned',triangle:'Trekant'};
function planeCross(a,b,c,n){const x=along(a,c,n),y=along(b,c,n);return x<=EPS&&y>EPS&&y-x>EPS?clamp(-x/(y-x),0,1):null;}
function closestSegment(a,b,p){const d=sub(b,a),q=dot(d,d),t=q>EPS?clamp(dot(sub(p,a),d)/q,0,1):0;return len(sub(add(a,mul(d,t)),p));}
function boundsOf(points,margin=0){return {minX:Math.min(...points.map(p=>p.x))-margin,maxX:Math.max(...points.map(p=>p.x))+margin,minY:Math.min(...points.map(p=>p.y))-margin,maxY:Math.max(...points.map(p=>p.y))+margin};}
function rounding(buoy,incoming,outgoing,side='port'){
 const rotation=side==='port'?1:-1,start=mul(right(incoming),rotation),end=mul(right(outgoing),rotation),startAngle=Math.atan2(start.y,start.x),sweep=positive(rotation*(Math.atan2(end.y,end.x)-startAngle))||TAU;
 return {buoyId:buoy.id,side,rotation,startAngle,endAngle:startAngle+rotation*sweep,sweep,entryDirection:{...incoming},outgoingDirection:{...outgoing}};
}
function terrainPlacement(localPoints,axis,rt,shapeCentre,margin){
 // Validate the tactical envelope, including tacking room and turns, using
 // the actual contact-physics bathymetry, not a separate decorative coast.
 const terrain=g.SailingWorld,raw=boundsOf(localPoints,margin),samples=[],step=55*courseDistanceScale,
  nx=Math.max(2,Math.ceil((raw.maxX-raw.minX)/step)),ny=Math.max(2,Math.ceil((raw.maxY-raw.minY)/step));
 for(let i=0;i<=nx;i++)for(let j=0;j<=ny;j++)samples.push({x:mix(raw.minX,raw.maxX,i/nx),y:mix(raw.minY,raw.maxY,j/ny)});
 const candidates=[{x:0,y:0}];for(const distance of[250,500,750,1000,1400,1900,2500,3200,4000,5000])for(let k=0;k<24;k++){const a=k*TAU/24,radius=distance*courseDistanceScale;candidates.push({x:Math.cos(a)*radius,y:Math.sin(a)*radius});}
 let chosen=null,best=-Infinity;
 for(const centre of candidates){const origin=sub(centre,add(mul(rt,shapeCentre.x),mul(axis,shapeCentre.y)));let depth=90,safe=true;for(const q of samples){const p=add(origin,add(mul(rt,q.x),mul(axis,q.y))),h=terrain?terrain.heightAt(p.x,p.y):-90;depth=Math.min(depth,-h);if(h> -10){safe=false;break;}}if(safe){chosen={origin,depth,centre};break;}if(depth>best){best=depth;chosen={origin,depth,centre};}}
 return {...chosen,localBounds:raw,checkedSamples:samples.length};
}
function makeModel(env,c,type){
 const base=SIZES[c.id]||SIZES.laser,sz={...base,length:base.length*courseDistanceScale,
  gateWidth:base.gateWidth*courseDistanceScale,roundingRadius:base.roundingRadius*courseDistanceScale};
 const L=sz.length,a=(90-(Number(env.direction)||0))*PI/180,axis={x:Math.cos(a),y:Math.sin(a)},rt=right(axis),isTriangle=type==='triangle',variant=env.courseVariant==='long'?'long':'short';
 const turn=sz.roundingRadius,lineWidth=Math.max(7*c.length,sz.gateWidth*.82),lineU=-.24*L,finishU=isTriangle?1.24*L:lineU;
 const tactical=[{x:-.90*L,y:0},{x:.48*L,y:0},{x:-.90*L,y:1.24*L},{x:.48*L,y:1.24*L},{x:0,y:lineU}],centre={x:isTriangle?-.20*L:0,y:.5*L},placed=terrainPlacement(tactical,axis,rt,centre,turn*1.4+c.length),origin=placed.origin;
 const point=(r,u)=>add(origin,add(mul(rt,r),mul(axis,u))),buoyScale=clamp(Math.sqrt(c.length/4.23),1,2.15),buoyRadius=.65*buoyScale,buoys=[];
 const buoy=(id,label,r,u,color,role,scale=buoyScale)=>{const b={id,label,name:label,...point(r,u),color,role,radius:.65*scale,scale};buoys.push(b);return b;};
 const startA=buoy('start-port','S',-lineWidth/2,lineU,'#ff9f36','start'),startB=buoy('start-starboard','S',lineWidth/2,lineU,'#ff9f36','start-boat'),lineCentre=point(0,lineU);
 const startLine={id:'start',a:{x:startA.x,y:startA.y},b:{x:startB.x,y:startB.y},normal:{...axis},centre:lineCentre,buoyIds:[startA.id,startB.id],label:'Start'};
 let finishLine;
 if(isTriangle){const fa=buoy('finish-port','M',-lineWidth/2,finishU,'#4299ed','finish'),fb=buoy('finish-starboard','M',lineWidth/2,finishU,'#4299ed','finish');finishLine={id:'finish',a:{x:fa.x,y:fa.y},b:{x:fb.x,y:fb.y},normal:{...axis},centre:point(0,finishU),buoyIds:[fa.id,fb.id],label:'Mål'};}
 else finishLine={...startLine,id:'finish',normal:neg(axis),label:'Mål'};
 const one=buoy('mark-1','1',0,L,'#ffad37','windward');
 let targets,gateGroups=[];
 if(isTriangle){const two=buoy('mark-2','2',-.72*L,.53*L,'#ffad37','wing');const left=buoy('gate-left','3s',-sz.gateWidth/2,0,'#ffad37','leeward'),rightBuoy=buoy('gate-right','3b',sz.gateWidth/2,0,'#ffad37','leeward');const gate={id:'gate-3',label:'Gate 3',...point(0,0),pair:[left,rightBuoy]};gateGroups.push({id:gate.id,label:gate.label,buoyIds:gate.pair.map(b=>b.id),x:gate.x,y:gate.y});targets=variant==='long'?[one,two,gate,one,gate]:[one,two,gate];}
 else {const offset=buoy('mark-1a','1a',-.18*L,.94*L,'#e04b3f','offset',buoyScale*.72);const left=buoy('gate-left','2s',-sz.gateWidth/2,0,'#ffad37','leeward'),rightBuoy=buoy('gate-right','2b',sz.gateWidth/2,0,'#ffad37','leeward');const gate={id:'gate-2',label:'Gate 2',...point(0,0),pair:[left,rightBuoy]};gateGroups.push({id:gate.id,label:gate.label,buoyIds:gate.pair.map(b=>b.id),x:gate.x,y:gate.y});targets=variant==='long'?[one,offset,gate,one,offset,gate,one,offset]:[one,offset,gate,one,offset];}
 const route=[];
 for(let i=0;i<targets.length;i++){
  const target=targets[i],from=i?targets[i-1]:lineCentre,to=targets[i+1]||finishLine.centre,incoming=unit(sub(target,from)),outgoing=unit(sub(to,target));
  if(target.pair){const gateIn=neg(axis),gateOut=axis;route.push({id:'visit-'+(i+1),kind:'gate',label:target.label,gateId:target.id,x:target.x,y:target.y,buoyIds:target.pair.map(b=>b.id),side:'choice',incoming:gateIn,outgoing:gateOut,roundings:[rounding(target.pair[0],gateIn,gateOut,'starboard'),rounding(target.pair[1],gateIn,gateOut,'port')]});}
  else route.push({id:'visit-'+(i+1),kind:'round',label:target.label,x:target.x,y:target.y,buoyIds:[target.id],side:'port',incoming,outgoing,roundings:[rounding(target,incoming,outgoing,'port')]});
 }
 route.push({id:'visit-'+(targets.length+1),kind:'finish',label:'Mål',...finishLine.centre,buoyIds:finishLine.buoyIds,side:'line',incoming:{...finishLine.normal},outgoing:{...finishLine.normal},line:finishLine,roundings:[]});
 const lb=placed.localBounds,corners=[point(lb.minX,lb.minY),point(lb.minX,lb.maxY),point(lb.maxX,lb.minY),point(lb.maxX,lb.maxY)],spawnPoint=point(-lineWidth*.16,lineU-Math.max(c.length*2.4,L*.105));
 return {type,variant,name:TYPES[type],axis,right:rt,origin,buoys,gateGroups,startLine,finishLine,route,bounds:boundsOf(corners),roundingRadius:turn,gateWidth:sz.gateWidth,spawn:{...spawnPoint,theta:Math.atan2(axis.y,axis.x)-55*PI/180},meta:{version:12,length:L,gateWidth:sz.gateWidth,startLineWidth:lineWidth,startOffset:lineU,roundingRadius:turn,expectedUpwindVMG:sz.expectedUpwindVMG,expectedUpwindSeconds:L/sz.expectedUpwindVMG,minimumDepth:placed.depth,terrainSamples:placed.checkedSamples,tacticalCorners:corners,calibration:'Banestørrelse er spilkalibrering.'}};
}
const hullCache=new Map();
function hullGeometry(c){
 if(hullCache.has(c.id))return hullCache.get(c.id);const vertices=[],edges=[],sections=c.hullSections||[[-c.length/2,c.beam/2],[c.length/2,c.beam/2]],B=g.SailingBoats;
 for(const offset of c.hullOffsets||[0]){let previous=null;for(const[x,w]of sections){const coords=[[w,c.deckY],[0,c.deckY],[-w,c.deckY],[-w*.5,B?.hullBottom(c,x,-w*.5)??c.deckY-c.hullDepth],[0,B?.hullBottom(c,x,0)??c.deckY-c.hullDepth],[w*.5,B?.hullBottom(c,x,w*.5)??c.deckY-c.hullDepth]],ring=[];for(const[z,y]of coords){ring.push(vertices.length);vertices.push({x,y,z:z+offset});}for(let i=0;i<ring.length;i++){edges.push([ring[i],ring[(i+1)%ring.length]]);if(previous)edges.push([previous[i],ring[i]]);}previous=ring;}}
 const out={vertices,edges};hullCache.set(c.id,out);return out;
}
function projectedHull(state,c){
 const{vertices}=hullGeometry(c),theta=state.theta||0,fx=Math.cos(theta),fy=Math.sin(theta),rx=fy,ry=-fx,ch=Math.cos(state.heel||0),sh=Math.sin(state.heel||0),cp=Math.cos(state.pitch||0),sp=Math.sin(state.pitch||0);
 return vertices.map(p=>{const up=ch*p.y-sh*p.z,r=sh*p.y+ch*p.z,f=cp*p.x-sp*up;return{x:state.x+f*fx+r*rx,y:state.y+f*fy+r*ry};});
}
function wholeHullBefore(state,c,line){return projectedHull(state,c).every(p=>along(p,line.a,line.normal)<=EPS);}
function roots(a,b,c){if(Math.abs(a)<1e-12)return Math.abs(b)>1e-12?[-c/b]:[];const d=b*b-4*a*c;if(d<0)return[];const sq=Math.sqrt(Math.max(0,d));return[(-b-sq)/(2*a),(-b+sq)/(2*a)];}
function sweptHullCross(previous,state,c,line){
 const old=projectedHull(previous,c),now=projectedHull(state,c),d=sub(line.b,line.a),l2=dot(d,d),n=line.normal,candidates=[];
 for(let i=0;i<old.length;i++){const a=along(old[i],line.a,n),b=along(now[i],line.a,n);if(a<=EPS&&b>EPS&&b-a>EPS){const t=clamp(-a/(b-a),0,1),p=add(old[i],mul(sub(now[i],old[i]),t)),u=dot(sub(p,line.a),d)/l2;if(u>=-EPS&&u<=1+EPS)candidates.push(t);}}
 // A finite line endpoint can enter a swept hull edge although every
 // vertex passes outside the line. Solve this moving-edge quadratic too.
 for(const[i,j]of hullGeometry(c).edges){const p=old[i],dp=sub(now[i],p),e=sub(old[j],p),de=sub(sub(now[j],old[j]),dp);for(const q of[line.a,line.b]){const r=sub(q,p),a=-cross(de,dp),b=cross(de,r)-cross(e,dp),cc=cross(e,r);for(const t of roots(a,b,cc))if(t>=-EPS&&t<=1+EPS){const tt=clamp(t,0,1),v=add(e,mul(de,tt)),r2=sub(q,add(p,mul(dp,tt))),v2=dot(v,v),u=v2>EPS?dot(r2,v)/v2:-1;if(u>=-EPS&&u<=1+EPS&&dot(add(dp,mul(de,clamp(u,0,1))),n)>EPS)candidates.push(tt);}}}
 return candidates.length?Math.min(...candidates):null;
}
class SailingCourse{
 constructor(env={},mode='free',type=env.courseType||'gates',model){this.reset(env,mode,type,model);}
 reset(env={},mode='free',type=env.courseType||'gates',model){
  this.mode=mode;this.type=model?.type||(Object.hasOwn(TYPES,type)?type:'gates');this.config=g.SailingBoats?.get(env.boatId)||{id:'laser',length:4.23,beam:1.37,deckY:.245,hullDepth:.385};
  const courseBoat=env.courseScaleBoatId?g.SailingBoats?.get(env.courseScaleBoatId):this.config;
  this.model=model||makeModel(env,courseBoat||this.config,this.type);this.marks=mode==='free'?[]:this.model.buoys;this.route=mode==='free'?[]:this.model.route;
  this.index=0;this.phase=mode==='course'?'preview':'free';this.time=0;this.countdown=30;this.finished=false;this.valid=true;this.newBest=false;this.recoveries=0;this.ocs=false;this.startArmed=false;this.started=false;this.lastEvent=null;this.lastEvents=[];this.storage=true;this._clockMs=null;this._routeState=null;this._lastMissKey=null;this._lastMissMs=-Infinity;this._suppressSegment=false;
  this.startVisit={id:'start',kind:'start',label:'Startlinjen',...this.model.startLine.centre,buoyIds:this.model.startLine.buoyIds,side:'line',incoming:this.model.axis,outgoing:this.model.axis,line:this.model.startLine,roundings:[]};
  const foiler=this.config.kind==='foiler';this.settings={version:13,rules:'swept-hull-ordered-track-v12',type:this.type,variant:this.model.variant,courseLength:this.model.meta.length,origin:this.model.origin,boatId:this.config.id,steering:'authority-yaw-assist-v10',balance:'bounded-crew-v10',recovery:'automatic-wall-clock-v10',speed:env.speed,direction:env.direction,gusts:env.gusts,waveHeight:env.waveHeight??env.waves,autoBalance:foiler?'automatic-foil-crew':env.autoBalance,ironsHelp:env.ironsHelp!==false,helpers:env.helpers!==false,controlSensitivity:env.controlSensitivity??1,controlRate:env.controlRate??1,motionDamping:env.motionDamping??1,daylight:env.daylight??env.weather??'day',rain:env.rain||0,fog:env.fog||0,clouds:env.clouds||0,seed:env.seed||1};
  if(this.model.variant==='custom')Object.assign(this.settings,{customId:this.model.meta.customId,customVersion:this.model.meta.customVersion});
  if(Number.isFinite(env.chop)&&Number.isFinite(env.waveHeight)&&!Number.isFinite(env.waves))this.settings.chop=env.chop;
  if(env.difficulty==='easy')this.settings.balance='automatic-crew-v1';
  this.key='frivind-v12:'+JSON.stringify({...this.settings,map:g.ArchipelagoData?.version});this.best=null;
  try{
   let best=g.localStorage?.getItem(this.key);
   const {chop,...previousSettings}=this.settings;
   const comparableLegacy=chop===undefined||chop===g.SailingSettings.migrate({waveHeight:previousSettings.waveHeight}).chop;
   if(best==null&&chop!==undefined&&comparableLegacy)best=g.localStorage?.getItem('frivind-v12:'+JSON.stringify(previousSettings));
   const sea=Number.isFinite(env.waveHeight)?g.SailingSettings.legacySeaName(env.waveHeight):env.waves;
   const light=this.settings.daylight===0?'day':this.settings.daylight===1?'evening':this.settings.daylight;
   // Records made with the old menu remain comparable at its exact settings.
   if(best==null&&comparableLegacy&&sea!==undefined&&(light==='day'||light==='evening')){
    const legacy=Object.fromEntries(Object.entries(previousSettings).map(([name,value])=>
     name==='waveHeight'?['sea',sea]:[name,name==='daylight'?light:value]));
    best=g.localStorage?.getItem('frivind-v12:'+JSON.stringify(legacy));
   }
   if(Number.isFinite(+best)&&+best>0)this.best=+best;
  }catch(e){this.storage=false;}return this;
 }
 beginCountdown(nowMs=monotonic(),state){
  if(this.mode!=='course'||this.phase!=='preview')return false;
  this.countdownAtMs=nowMs;this.gunAtMs=nowMs+30000;this._clockMs=nowMs;this.phase='countdown';this.countdown=30;this.time=0;this._lastState=state?interpolate(state,state,0):null;return true;
 }
 _event(type,message,extra={}){const e={type,message,index:this.index,visitId:this.route[this.index]?.id||null,time:this.time,...extra};this.lastEvent=e;return e;}
 _miss(message,code,events,fraction=0){const key=this.index+':'+code,now=this._clockMs??0;if(key!==this._lastMissKey||now-this._lastMissMs>2500){events.push(this._event('miss',message,{code,fraction}));this._lastMissKey=key;this._lastMissMs=now;}}
 advanceClock(nowMs=monotonic(),state){
  const events=[];if(this.mode!=='course'||this.phase==='preview'||this.finished)return events;
  if(!Number.isFinite(nowMs))nowMs=monotonic();this._clockMs=Math.max(this._clockMs??nowMs,nowMs);this.countdown=Math.max(0,(this.gunAtMs-this._clockMs)/1000);this.time=Math.max(0,(this._clockMs-this.gunAtMs)/1000);
  if(this.phase==='countdown'&&this._clockMs>=this.gunAtMs){this.phase='starting';this.startArmed=!!state&&wholeHullBefore(state,this.config,this.model.startLine);this.ocs=!this.startArmed;if(this.ocs)this._miss('Tilbage over startlinjen — hele skroget skal tilbage.','ocs',events);}
  if(state)this._lastState=interpolate(state,state,0);return events;
 }
 invalidate(reason){if(this.mode==='course'&&!this.finished){this.valid=false;this.invalidReason=reason;}}
 target(){if(this.mode!=='course'||this.finished)return null;return this.started?this.route[this.index]||null:this.startVisit;}
 activeBuoyIds(){return this.target()?.buoyIds?.slice()||[];}
  status(){if(this.mode!=='course')return'Fri sejlads';if(this.phase==='preview')return this.model.name+' · Baneoversigt';if(this.phase==='countdown')return'Start om '+Math.ceil(this.countdown)+' s';if(this.phase==='starting')return this.ocs?'Tilbage over startlinjen':'Start! Kryds linjen i pilens retning';if(this.finished)return'Mål · '+this.model.name;return'Trin '+(this.index+1)+' af '+this.route.length+' · Næste: '+this.route[this.index].label;}
  hint(){if(this.phase==='preview')return'Ruten ligger fast. Start en 30 sekunders nedtælling, når du er klar.';if(this.phase==='countdown')return'Placér hele skroget på startsiden ved eller efter signalet.';if(this.phase==='starting')return this.ocs?'Vend tilbage, til hele skroget er på startsiden. Følg derefter startlinjens pil.':'Sejl mellem startbøjerne i pilens retning.';const v=this.route[this.index];if(!v)return this.finished?'Banen er gennemført.':'';if(v.kind==='gate')return this._routeState?.entered?'Rund en gatebøje udad, og sejl mod næste mærke.':'Sejl ind mellem gatebøjerne, og rund en af dem udad.';if(v.kind==='finish')return'Kryds mellem målbøjerne i pilens retning.';return'Hold mærket til '+(v.side==='starboard'?'styrbord':'bagbord')+'. Sejl rundt og ud mod næste ben.';}
 noteDiscontinuity(state,nowMs){if(nowMs!==undefined)this.advanceClock(nowMs,state);this._routeState=null;this.startArmed=false;this._suppressSegment=true;this._lastState=state?interpolate(state,state,0):null;}
 _stateFor(v,p){if(!this._routeState||this._routeState.id!==v.id)this._routeState={id:v.id,armed:along(p,v,v.incoming)<-EPS,entered:false,candidates:[]};return this._routeState;}
 _visitSegment(a,b,v,events,fa,fb){
  const rs=this._stateFor(v,a),n=v.incoming;if(along(a,v,n)<-EPS)rs.armed=true;
  if(!rs.entered){
   const t=planeCross(a,b,v,n);if(t===null||!rs.armed){if(along(b,v,n)<-EPS)rs.armed=true;return null;}
   const p=interpolate(a,b,t),eventFraction=mix(fa,fb,t);rs.armed=false;
   if(v.kind==='gate'){
    const pair=v.buoyIds.map(id=>this.model.buoys.find(q=>q.id===id)),gateVector=sub(pair[1],pair[0]),u=dot(sub(p,pair[0]),gateVector)/dot(gateVector,gateVector),edgeMargin=Math.min(.12,(pair[0].radius+.12*this.config.beam)/len(gateVector));
    if(u<=edgeMargin||u>=1-edgeMargin){this._miss('Sejl ind mellem '+v.label.toLowerCase()+'s to bøjer fra det foregående ben.','gate-entry',events,eventFraction);return null;}
   }else{
    const r=v.roundings[0],buoy=this.model.buoys.find(q=>q.id===r.buoyId),side=dot(sub(p,buoy),mul(right(n),r.rotation));
    if(side<=buoy.radius){this._miss(v.label+' skal holdes til '+(v.side==='starboard'?'styrbord':'bagbord')+'. Gå tilbage og rund på den viste side.','round-side',events,eventFraction);return null;}
   }
   rs.entered=true;rs.candidates=v.roundings.map(r=>({...r,progress:0,buoy:this.model.buoys.find(q=>q.id===r.buoyId)}));
   return this._afterEntry(p,b,v,rs,events,eventFraction,fb,t);
  }
  return this._afterEntry(a,b,v,rs,events,fa,fb,0);
 }
 _afterEntry(a,b,v,rs,events,fa,fb,baseFraction){
  const hits=[];
  for(const c of rs.candidates){
   const u=sub(a,c.buoy),w=sub(b,c.buoy),delta=Math.atan2(cross(u,w),dot(u,w))*c.rotation;
   if(closestSegment(a,b,c.buoy)<c.buoy.radius*.72){c.invalid=true;continue;}
   const t=planeCross(a,b,c.buoy,c.outgoingDirection);
   if(!c.invalid&&t!==null){const p=interpolate(a,b,t),z=sub(p,c.buoy),at=c.progress+Math.atan2(cross(u,z),dot(u,z))*c.rotation,side=dot(z,mul(right(c.outgoingDirection),c.rotation));if(at>=c.sweep-1e-5&&side>c.buoy.radius)hits.push({t,c});}
   c.progress+=delta;
  }
  if(hits.length){hits.sort((p,q)=>p.t-q.t);const h=hits[0];return{t:baseFraction+(1-baseFraction)*h.t,rounding:h.c,fraction:mix(fa,fb,h.t)};}
  const back=planeCross(a,b,v,neg(v.incoming));
  if(back!==null&&rs.candidates.every(c=>c.invalid||c.progress<c.sweep-.08)){
   const p=interpolate(a,b,back),between=v.kind==='gate'&&Math.abs(dot(sub(p,v),right(v.incoming)))<this.model.gateWidth/2;
   if(between||rs.candidates.every(c=>c.invalid||c.progress<-.05)){rs.entered=false;rs.armed=true;rs.candidates=[];this._miss(v.kind==='gate'?'Gateindgangen er passeret, men rundingen mangler. Sejl ind og rundt om ydersiden.':'Rund på den viste bagbordside og fortsæt mod næste ben.','round-incomplete',events,mix(fa,fb,back));}
  }
  return null;
 }
 _advanceVisit(events,fraction,rounding){const done=this.route[this.index];this.index++;this._routeState=null;this._lastMissKey=null;const next=this.route[this.index];events.push(this._event('mark',done.label+' gennemført — næste: '+next.label+'.',{fraction,completedVisitId:done.id,roundingBuoyId:rounding?.buoyId,roundingSide:rounding?.side}));}
 _finish(events,fraction,eventTimeMs){
  this.index=this.route.length;this.finished=true;this.phase='finished';this.time=Math.max(0,(eventTimeMs-this.gunAtMs)/1000);this.previousBest=this.best;this.newBest=this.valid&&(this.best===null||this.time<this.best);
  if(this.newBest){this.best=this.time;if(this.storage)try{g.localStorage?.setItem(this.key,String(this.time));}catch(e){this.storage=false;}}
  events.push(this._event('finish','Mål! '+this.model.name+' er gennemført.',{fraction,time:this.time,visitId:this.route.at(-1)?.id}));
 }
 update(previous,state,dt,meta={}){
  const events=[];if(this.mode!=='course'||this.finished||this.phase==='preview')return events;
  const end=Number.isFinite(meta.nowMs)?meta.nowMs:(this._clockMs??monotonic())+Math.max(0,dt||0)*1000,start=end-Math.max(0,dt||0)*1000;let from=previous,beginFraction=0;
  // The caller may have advanced its UI clock before dispatching queued
  // physics segments. Clip by absolute gun time regardless of current phase.
  // A pre-gun path can never become a valid start merely because a RAF was late.
  if(end<=this.gunAtMs){events.push(...this.advanceClock(end,state));this.lastEvents=events;return events;}
  if(start<this.gunAtMs){beginFraction=clamp((this.gunAtMs-start)/Math.max(1e-9,end-start),0,1);from=interpolate(previous,state,beginFraction);if(!this.started){this.startArmed=wholeHullBefore(from,this.config,this.model.startLine);this.ocs=!this.startArmed;}events.push(...this.advanceClock(this.gunAtMs,from));}
  events.push(...this.advanceClock(end,state));
  if(meta.discontinuity||state.recovering||state.capsized||previous.recovering||previous.capsized){this.noteDiscontinuity(state);this.lastEvents=events;return events;}
  if(this._suppressSegment){this._suppressSegment=false;this._routeState=null;this.startArmed=false;this._lastState=interpolate(state,state,0);this.lastEvents=events;return events;}
  if(this.phase==='countdown')return events;
  const angle=Math.max(Math.abs(wrap((state.theta||0)-(from.theta||0))),Math.abs(wrap((state.heel||0)-(from.heel||0))),Math.abs(wrap((state.pitch||0)-(from.pitch||0))));
  const count=Math.min(2048,Math.max(1,Math.ceil(angle/(2*PI/180)),Math.ceil(len(sub(state,from))/Math.max(3,this.config.length*.65))));
  for(let k=0;k<count&&!this.finished;k++){
   let a=interpolate(from,state,k/count),b=interpolate(from,state,(k+1)/count),fa=mix(beginFraction,1,k/count),fb=mix(beginFraction,1,(k+1)/count),loops=0;
   while(loops++<12&&!this.finished){
    if(!this.started){
     if(wholeHullBefore(a,this.config,this.model.startLine)){this.startArmed=true;this.ocs=false;}
     const t=this.startArmed?sweptHullCross(a,b,this.config,this.model.startLine):null;
     if(t!==null){const f=mix(fa,fb,t);this.started=true;this.phase='racing';this.ocs=false;this._routeState=null;this.startedAtMs=mix(start,end,f);events.push(this._event('start','Gyldig start — næste: '+this.route[0].label+'.',{fraction:f,time:Math.max(0,(this.startedAtMs-this.gunAtMs)/1000)}));a=interpolate(a,b,Math.min(1,t+1e-9));fa=f;continue;}
     if(wholeHullBefore(b,this.config,this.model.startLine)){this.startArmed=true;this.ocs=false;}break;
    }
    const visit=this.route[this.index];
    if(visit.kind==='finish'){
     const rs=this._stateFor(visit,a);if(wholeHullBefore(a,this.config,this.model.finishLine))rs.armed=true;
     const t=rs.armed?sweptHullCross(a,b,this.config,this.model.finishLine):null;
     if(t!==null){const f=mix(fa,fb,t);this._finish(events,f,mix(start,end,f));}else if(wholeHullBefore(b,this.config,this.model.finishLine))rs.armed=true;break;
    }
    const hit=this._visitSegment(a,b,visit,events,fa,fb);if(!hit)break;
    const f=hit.fraction;this._advanceVisit(events,f,hit.rounding);a=interpolate(a,b,Math.min(1,hit.t+1e-9));fa=f;
   }
  }
  this._lastState=interpolate(state,state,0);this.lastEvents=events;return events;
 }
}
SailingCourse.TYPES=TYPES;SailingCourse.SIZES=SIZES;SailingCourse.geometry={projectedHull,wholeHullBefore,sweptHullCross,rounding,makeModel};
g.SailingCourse=SailingCourse;
});
