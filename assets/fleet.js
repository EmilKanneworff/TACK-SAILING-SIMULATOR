/* Client-side input prediction and rendering of the live server’s fleet. */
(() => {
'use strict';
const Sim=globalThis.TackSimulation,P=Sim.physics;
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));
function blendFields(from,to,fraction,keys){
 if(!to)return to;
 const result={...to};
 for(const key of keys)if(Number.isFinite(from?.[key])&&Number.isFinite(to[key]))result[key]=from[key]+(to[key]-from[key])*fraction;
 return result;
}
function visualPose(view,now){
 const {from,to,at,duration}=view,t=clamp((now-at)/duration,0,1);
 if(from===to||t===1)return to;
 const draw=blendFields(from,to,t,[
  'x','y','vx','vy','omega','heave','heaveVelocity','heel','heelRate','pitch','pitchRate',
  'rudder','boom','boomRate','crewPoseBlend','crewSideBlend','crewPoseVelocity','crewSideVelocity','crewForeAft','crewDuck','crewSwim'
 ]);
 if(Number.isFinite(from.theta)&&Number.isFinite(to.theta))draw.theta=from.theta+P.wrap(to.theta-from.theta)*t;
 draw.rig=blendFields(from.rig,to.rig,t,['sideBlend','camber','twist','fill','reef','flutter','jibFlutter','jibFill','flutterPhase','gybeImpact']);
 draw.cruiserRig=blendFields(from.cruiserRig,to.cruiserRig,t,['reef','headsail','jibSheet','extraSheet']);
 draw.wing=blendFields(from.wing,to.wing,t,['angle','flap','twist','jibAngle','load']);
 draw.spinnaker=from.spinnaker?.type===to.spinnaker?.type
  ?blendFields(from.spinnaker,to.spinnaker,t,['hoist','fill','luff','sideBlend','flutter']):to.spinnaker;
 if(to.foils)draw.foils=Object.fromEntries(Object.entries(to.foils).map(([key,foil])=>[key,
  blendFields(from.foils?.[key],foil,t,['arm','armRate','flap','flapInner','flapOuter','deployment'])]));
 if(to.sail){
  draw.sail=blendFields(from.sail,to.sail,t,['load','luff','stall','twist','camber','fill']);
  for(const key of ['main','jib']){
   const part=to.sail[key],old=from.sail?.[key];
   if(!part)continue;
   draw.sail[key]=blendFields(old,part,t,['angle','alpha','load','luff','stall','twist','camber','fill']);
   if(old?.sections&&part.sections)draw.sail[key].sections=part.sections.map((section,i)=>
    blendFields(old.sections[i],section,t,['alpha','luff','stall','airForward','airRight','localAirSpeed']));
  }
 }
 draw.crewJoints=undefined;
 return draw;
}
class Fleet {
 constructor(bridge,send){
  this.bridge=bridge;this.send=send;this.players=[];this.boats=new Map();this.actors=new Map();
  this.silhouettes=new Map();this.views=new Map();this.inputSeq=0;this.lastSnapshot=-1;this.pending=[];
 }
 joined(room,players){
  if(this.session!==room.session)this.clear();
  Object.assign(this,{session:room.session,id:room.id,host:room.host});
  this.inputSeq=Math.max(this.inputSeq,room.nextSeq);
  this.pending=[];this.synced=false;
  this.roster(players,room.phase);
 }
 roster(players,phase){
  this.players=players;this.phase=phase;
  this.host=!!players.find(p=>p.id===this.id)?.host;
  for(const id of this.boats.keys()){
   if(players.some(p=>p.id===id))continue;
   this.boats.delete(id);this.views.delete(id);this.actors.get(id)?.disposeBoat();this.actors.delete(id);
   if(this.silhouettes.has(id))this.dropSilhouette(id);
  }
  if(phase==='lobby'&&this.inWorld){
   this.resetWorld();
   this.bridge.lobby();
  }
  if(phase!=='lobby'&&!this.inWorld){
   this.inWorld=true;
   this.bridge.enter();
  }
 }
 onMessage(m){
  if(m.session!==this.session||m.type!=='snapshot'||m.seq<=this.lastSnapshot||!m.state?.boats)return;
  this.lastSnapshot=m.seq;
  this.receive(m.state);
 }
 step(control,now,dt){
  if(!this.inWorld||!this.synced)return;
  const seq=this.inputSeq++;
  const predict=this.bridge.state().time+dt<=this.serverTime+.30;
  if(predict)this.pending.push({seq,control:{...control},dt});
  const old=this.lastControl;
  // Send small analogue changes on the network cadence, and key changes
  // immediately so a quick tap can reach an authority tick.
  const changed=!old||['steer','steerDigital','trimKey','crewPose','crew','spinnaker','downwindType'].some(key=>old[key]!==control[key]);
  if(changed||now-this.lastInput>=50){
   this.lastInput=now;
   this.lastControl=control;
   this.send({type:'input',seq,...control});
  }
  return predict;
 }
 release(){
  if(!this.inWorld||!this.lastControl)return;
  const control=this.lastControl;
  this.lastControl=null;
  this.send({...control,type:'input',seq:this.inputSeq++,steer:0,trim:0,crew:0,foreAft:0});
 }
 startFree(){
  if(this.host)this.send({type:'start',settings:{mode:'free',courseType:'gates',courseVariant:'short'}});
 }
 startRace(course,draft){
  if(!this.host)return;
  this.send({type:'start',settings:{mode:'course',courseType:course.model.type,courseVariant:course.model.variant},draft});
 }
 flushWeather(){
  if(!this.host)return;
  clearTimeout(this.weatherCommit);
  this.weatherCommit=setTimeout(()=>{
   this.weatherCommit=null;
   this.send({type:'settings',env:this.bridge.sharedWeather()});
  },100);
 }
 receive(packet){
  if(!this.inWorld)return;
  this.serverTime=packet.time;
  if(!this.host)this.bridge.weather(packet.env);
  this.bridge.results(packet.results||[]);
  const ownRace=packet.races?.[this.id],my=packet.boats[this.id];
  if(packet.mode==='free')this.bridge.free();
  else if(ownRace&&packet.model)this.bridge.race({...ownRace,model:packet.model});
  if(my){
   const ack=packet.acks?.[this.id]??-1;
   const newStart=this.serial!==packet.serial||!this.synced||this.boatId!==my.boatId;
   this.serial=packet.serial;this.boatId=my.boatId;
   this.pending=newStart?[]:this.pending.filter(p=>p.seq>ack);
   this.bridge.correct(my,this.pending,newStart);
   this.synced=true;
   this.bridge.wait(false);
  }
  const now=performance.now();
  for(const [id,s] of Object.entries(packet.boats)){
   if(id===this.id||!this.players.some(player=>player.id===id))continue;
   const view=this.views.get(id), old=view?.to;
   const interval=view?clamp(now-view.at,40,150):60;
   const duration=view?view.duration*.7+interval*.3:60;
   const jump=old&&(old.boatId!==s.boatId||Math.hypot(s.x-old.x,s.y-old.y)>Math.max(9,(s.speed||0)*interval*.004));
   this.views.set(id,{from:view&&!jump?visualPose(view,now):s,to:s,at:now,duration});
   this.boats.set(id,s);
  }
 }
 largestBoat(){
  const B=SailingBoats,profiles=this.players.map(p=>B.get(p.boat));
  return profiles.reduce((a,b)=>b.length>a.length?b:a,B.get(this.bridge.state())).id;
 }
 ready(){return !this.inWorld||this.synced;}
 mapBoats(){return [...this.boats].map(([id,s])=>({...s,player:this.players.find(p=>p.id===id)}));}
 makeNameplate(scene,id,boatId){
  const info=this.players.find(p=>p.id===id);
  const label=new THREE.Sprite(new THREE.SpriteMaterial({
   map:scene.makeLabel(info?.name||'Sejler',false,info?.color||'#ffffff'),transparent:true,depthWrite:false
  }));
  label.position.set(0,scene.modelFor(boatId).mastHeight*.5+2,0);
  label.scale.set(5,2.2,1);
  return label;
 }
 updateNameplate(label,distance){
  label.visible=distance<460;label.material.opacity=clamp((460-distance)/150,0,1);
 }
 dropSilhouette(id){
  const silhouette=this.silhouettes.get(id);
  silhouette.root.removeFromParent();
  if(silhouette.nameplate){
   silhouette.nameplate.material.map.dispose();silhouette.nameplate.material.dispose();
  }
  this.silhouettes.delete(id);
 }
 render(dt){
  if(!this.inWorld||!this.session)return;
  const scene=this.bridge.scene(),env=this.bridge.env(),world=this.bridge.state(),now=performance.now();
  const {remoteDistance}=scene.graphicsProfile,eye=scene.camera.position;
  for(const [id,s] of this.boats){
   if(id===this.id)continue;
   let actor=this.actors.get(id),silhouette=this.silhouettes.get(id);
   if(actor&&actor.boatId!==s.boatId){actor.disposeBoat();this.actors.delete(id);actor=null;}
   if(silhouette&&(silhouette.boatId!==s.boatId||silhouette.root.parent!==scene.scene)){
    this.dropSilhouette(id);silhouette=null;
   }
   const view=this.views.get(id);
   const fraction=view?clamp((now-view.at)/view.duration,0,1):1;
   const bodyPose=view?blendFields(view.from,view.to,fraction,['x','y','heave','heel','pitch','boom']):s;
   const distance=Math.hypot(bodyPose.x-eye.x,bodyPose.y+eye.z);
   const detailRange=scene.graphicsProfile.detailRanges[1];
   const showDetail=distance<detailRange+(actor?.boatRoot.visible?20:0);
   if(!showDetail&&actor){actor.boatRoot.visible=actor.hull.visible=false;}
   if(distance>=remoteDistance){
    if(silhouette)silhouette.root.visible=false;
    continue;
   }
   if(!showDetail){
    if(!silhouette){silhouette=scene.createBoatSilhouette(s.boatId);this.silhouettes.set(id,silhouette);}
    silhouette.root.visible=true;
    silhouette.root.position.set(bodyPose.x,bodyPose.heave,-bodyPose.y);
    silhouette.root.rotation.y=view?view.from.theta+P.wrap(view.to.theta-view.from.theta)*fraction:s.theta;
    silhouette.body.rotation.set(bodyPose.heel,0,bodyPose.pitch||0,'ZXY');
    silhouette.boom.rotation.y=bodyPose.boom||0;
    if(distance<460&&!silhouette.nameplate){
     silhouette.nameplate=this.makeNameplate(scene,id,s.boatId);silhouette.body.add(silhouette.nameplate);
    }
    if(silhouette.nameplate)this.updateNameplate(silhouette.nameplate,distance);
    continue;
   }
   if(silhouette)silhouette.root.visible=false;
   if(!actor){
    actor=scene.createBoatActor(s.boatId);
    actor.nameplate=this.makeNameplate(scene,id,s.boatId);actor.hull.add(actor.nameplate);
    this.actors.set(id,actor);
   }
   const pose=view?visualPose(view,now):s;
   const draw={...pose,time:world.time,seaState:world.seaState,waveProfile:world.waveProfile};
   actor.boatRoot.visible=actor.hull.visible=true;
   this.updateNameplate(actor.nameplate,distance);
   actor.crewDetail=distance<(scene.quality==='low'?34:96);
   const detailInterval=scene.quality==='low'?(distance<37?65:140):distance<160?30:125;
   if(!actor.lastDetailAt||now-actor.lastDetailAt>=detailInterval){
    const detailDt=actor.lastDetailAt?Math.min(.2,(now-actor.lastDetailAt)*.001):dt;
    actor.lastDetailAt=now;actor.updateBoat(draw,env,detailDt);
   }else{
    actor.boatRoot.position.set(draw.x,draw.heave,-draw.y);
    actor.heading.rotation.y=draw.theta;actor.hull.rotation.set(draw.heel,0,draw.pitch||0,'ZXY');
   }
   scene.hullWater.remote(id,actor,draw,env,distance<(scene.quality==='low'?20:50));
  }
 }
 resetWorld(){
  for(const actor of this.actors.values())actor.disposeBoat();
  this.actors.clear();
  for(const id of this.silhouettes.keys())this.dropSilhouette(id);
  this.boats.clear();this.views.clear();this.pending=[];this.lastControl=null;
  this.inWorld=false;this.synced=false;this.lastInput=-Infinity;this.serial=null;this.serverTime=0;
 }
 clear(){
  clearTimeout(this.weatherCommit);this.weatherCommit=null;
  this.resetWorld();
  this.session=null;this.host=false;this.players=[];this.lastSnapshot=-1;this.inputSeq=0;
 }
}
globalThis.FriVindFleet=Fleet;
})();
