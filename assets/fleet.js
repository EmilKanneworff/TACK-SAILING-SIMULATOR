/* Shared free-sailing prototype. The host advances one physical state per player. */
(() => {
'use strict';
const P=globalThis.SailPhysics,W=globalThis.SailingWeather,R=globalThis.SailingRecovery;
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
 draw.rig=blendFields(from.rig,to.rig,t,['sideBlend','camber','twist','fill','reef','sheetEase','flutter','jibFlutter','jibFill','flutterPhase','gybeImpact']);
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
 constructor(bridge,send){this.bridge=bridge;this.send=send;this.players=[];this.boats=new Map();this.actors=new Map();this.controls=new Map();this.views=new Map();this.seq=0;this.inputSeq=0;this.lastSend=0;this.lastInput=0;this.session=null;this.id=null;this.host=false;this.inWorld=false;this.synced=false;this.lastSnapshot=-1;this.pending=[];this.acks={};this.races=new Map();this.raceSerial=0;}
 joined(room,players){const resuming=this.session===room.session&&this.inWorld;if(this.session!==room.session)this.clear();Object.assign(this,{session:room.session,id:room.id,host:room.host});if(resuming&&!room.host){this.synced=false;this.pending=[];}this.roster(players);}
 roster(players){this.players=players||[];if(this.host&&this.inWorld)this.ensure();let ids=new Set(this.players.map(p=>p.id));for(const [id] of this.boats)if(!ids.has(id)){this.boats.delete(id);this.races.delete(id);this.controls.delete(id);this.views.delete(id);delete this.acks[id];}for(const [id,a] of this.actors)if(!ids.has(id)){a.disposeBoat();this.actors.delete(id);}}
 enter(){if(!this.session)return;this.bridge.enter();this.inWorld=true;this.synced=this.host;if(this.host){this.ensure();this.broadcast();}}
 ensure(){let env=this.bridge.env(),base=this.bridge.state();for(const [i,p] of this.players.entries()){if(p.id===this.id)continue;let b=this.boats.get(p.id);if(!b||b.boatId!==p.boat){let s=P.createState({boatId:p.boat,x:b?.x??base.x+(i+1)*25,y:b?.y??base.y-(i+1)*25,time:base.time,vx:0,vy:0}, {...env,boatId:p.boat,difficulty:b?.crewDifficulty??'hard'});const safe=R.safeLocation(s,globalThis.SailingBoats.get(p.boat),s.theta);s.x=safe.x;s.y=safe.y;s.seaState=base.seaState;s.waveProfile=base.waveProfile;W.initialize(s,env);this.boats.set(p.id,s);}}}
 onMessage(m){if(!this.session||m.session!==this.session)return;
  if(m.type==='input'&&this.host){this.controls.set(m.id,{steer:m.steer,trim:m.trim,crew:m.crew??0,foreAft:m.foreAft??0,rig:m.rig,crewPose:m.crewPose,difficulty:m.difficulty??'hard',spinnaker:!!m.spinnaker,downwindType:m.downwindType||'spinnaker',trimFast:m.trimFast??true,steerDigital:m.steerDigital??true,seq:m.seq,received:performance.now()});}
  if(m.type==='disconnected'&&this.host)this.controls.delete(m.id);
  if((m.type==='host-stalled'||m.type==='disconnected'&&m.host)&&!this.host)this.bridge.wait(true);
  if(m.type==='host-restored'&&!this.host)this.bridge.wait(false);
  if(m.type==='sync-request'&&this.host&&this.inWorld){this.ensure();this.broadcast();}
  if(m.type==='snapshot'&&!this.host&&m.seq>this.lastSnapshot&&m.state?.boats){this.lastSnapshot=m.seq;this.receive(m.state);}
 }
 step(control,now,dt){if(!this.session||!this.inWorld)return;
  if(this.host){this.ensure();const env=this.bridge.env(),world=this.bridge.state(),previous=new Map();for(const [id,s] of this.boats){s.time=world.time-dt;s.waveProfile=world.waveProfile;let c=this.controls.get(id);if(!c||now-c.received>700)c={steer:0,trim:0,crewPose:s.crewPose||2,difficulty:s.crewDifficulty??'hard'};const localEnv={...env,boatId:s.boatId,crewPose:c.crewPose};const prev={x:s.x,y:s.y,theta:s.theta,heel:s.heel,pitch:s.pitch,recovering:s.recovering,capsized:s.capsized};previous.set(id,prev);R.update(s,localEnv,now);P.step(s,c,localEnv,dt);W.step(s,localEnv,dt);s.seaState=world.seaState;R.update(s,localEnv,now);if(c.seq!==undefined)this.acks[id]=c.seq;}
   const contact=globalThis.FriVindCollisions.resolve([{id:this.id,state:world},...[...this.boats].map(([id,state])=>({id,state}))],globalThis.SailingBoats);this.lastContacts=contact.pairs;
   for(const [id,s] of this.boats){const prev=previous.get(id),race=this.races.get(id);if(race)race.update(prev,s,dt,{nowMs:now,discontinuity:!!(contact.touched.has(id)||prev.recovering||s.recovering||prev.capsized||s.capsized)});}
   if(this.raceActive&&this.bridge.course().finished&&[...this.races.values()].every(r=>r.finished)){this.raceActive=false;this.send({type:'phase',phase:'free'});}if(now-this.lastSend>=70){this.lastSend=now;this.broadcast();}return contact.touched.has(this.id);}

  else {const seq=++this.inputSeq;this.pending.push({seq,control:{...control},dt});if(this.pending.length>180)this.pending.shift();if(now-this.lastInput>=50){this.lastInput=now;this.send({type:'input',seq,steer:control.steer,trim:control.trim,crew:control.crew||0,foreAft:control.foreAft??0,...(control.rig?{rig:control.rig}:{}),crewPose:control.crewPose,difficulty:control.difficulty,spinnaker:!!control.spinnaker,downwindType:control.downwindType||'spinnaker',trimFast:!!control.trimFast,steerDigital:!!control.steerDigital});}}
 }
 startFree(){if(!this.host||!this.inWorld)return;this.raceActive=false;this.races.clear();this.send({type:'phase',phase:'free'});this.broadcast();}
 startGrid(model){
  const line=model.startLine,center=line.centre;
  const width=Math.hypot(line.b.x-line.a.x,line.b.y-line.a.y);
  const tangent={x:(line.b.x-line.a.x)/width,y:(line.b.y-line.a.y)/width};
  const boats=[...this.players].sort((a,b)=>Number(b.id===this.id)-Number(a.id===this.id));
  const largest=SailingBoats.get(this.largestBoat());
  const spacing=Math.max(5,largest.beam*1.6,largest.length*.48);
  const columns=Math.max(1,Math.min(boats.length,Math.floor(width*.88/spacing)));
  return new Map(boats.map((player,i)=>{
   const row=Math.floor(i/columns),rowLength=Math.min(columns,boats.length-row*columns);
   const lateral=(i%columns-(rowLength-1)/2)*spacing;
   const distance=Math.max(16,largest.length*2.4)+row*Math.max(13,largest.length*1.6);
   const x=center.x+tangent.x*lateral-line.normal.x*distance;
   const y=center.y+tangent.y*lateral-line.normal.y*distance;
   return [player.id,{x,y,theta:model.spawn.theta,vx:0,vy:0}];
  }));
 }
 startRace(course,now){
  if(!this.host||!this.inWorld)return;
  this.raceSerial++;this.raceActive=true;this.races.clear();this.controls.clear();
  const grid=this.startGrid(course.model),world=this.bridge.state();
  this.send({type:'phase',phase:'race'});
  for(const [id,old] of this.boats){
   const env={...this.bridge.env(),boatId:old.boatId,difficulty:old.crewDifficulty??'hard'};
   const spawn=grid.get(id)||course.model.spawn;
   const state=P.createState({...spawn,boatId:old.boatId,time:world.time,crewPose:old.crewPose},env);
   const safe=R.safeLocation(state,SailingBoats.get(old.boatId),state.theta);
   state.x=safe.x;state.y=safe.y;state.seaState=world.seaState;state.waveProfile=world.waveProfile;
   W.initialize(state,env);
   this.boats.set(id,state);
   const race=new SailingCourse(env,'course',course.type,course.model);
   race.storage=false;
   race.beginCountdown(now,state);
   this.races.set(id,race);
  }
  this.broadcast();
 }
 packRace(r){return r&&r.phase!=='free'&&r.phase!=='preview'?{serial:this.raceSerial,model:r.model,index:r.index,phase:r.phase,time:r.time,countdown:r.countdown,startAtHostMs:r.gunAtMs,ocs:r.ocs,started:r.started,finished:r.finished,valid:r.valid}:null;}
 broadcast(){const states={[this.id]:this.bridge.state()};for(const [id,s] of this.boats)states[id]=s;const races=Object.fromEntries([[this.id,this.packRace(this.bridge.course())],...[...this.races].map(([id,r])=>[id,this.packRace(r)])]);const results=this.players.map(p=>({id:p.id,name:p.name,boat:p.boat,race:races[p.id]})).filter(x=>x.race?.finished).map(x=>({id:x.id,name:x.name,boat:x.boat,time:x.race.time})).sort((a,b)=>a.time-b.time);this.bridge.results(results);this.sentWeather=this.bridge.sharedWeather();this.send({type:'snapshot',seq:++this.seq,state:{boats:states,env:this.sentWeather,time:this.bridge.state().time,mode:this.bridge.course().mode,acks:this.acks,races,results}});}
 flushWeather(){
  if(!this.host||!this.inWorld||this.weatherCommit!=null)return;
  // Intermediate values use the normal snapshots; commit the last value even
  // if the next physics frame is delayed, without sending an extra duplicate.
  this.weatherCommit=setTimeout(()=>{
   this.weatherCommit=null;
   const weather=this.bridge.sharedWeather();
   if(Object.keys(weather).every(key=>weather[key]===this.sentWeather?.[key]))return;
   this.lastSend=performance.now();
   this.broadcast();
  },Math.max(0,70-(performance.now()-this.lastSend)));
 }
 receive(packet){this.bridge.wait(false);this.bridge.weather(packet.env);this.bridge.results(packet.results||[]);const ownRace=packet.races?.[this.id],hostId=this.players.find(p=>p.host)?.id,allRaces=Object.values(packet.races||{}).filter(Boolean),hostRace=packet.races?.[hostId],sharedRace=hostRace&&!hostRace.finished?hostRace:allRaces.find(r=>!r.finished)||hostRace||allRaces[0];if(packet.mode==='free')this.bridge.free();else if(ownRace||sharedRace)this.bridge.race({...ownRace||sharedRace,spectating:!ownRace});const my=packet.boats[this.id];if(my&&this.inWorld){this.synced=true;const ack=packet.acks?.[this.id]??0;this.pending=this.pending.filter(p=>p.seq>ack);this.bridge.correct(my,this.pending);}const now=performance.now();
  for(const [id,s] of Object.entries(packet.boats)){
   if(id===this.id||!this.players.some(player=>player.id===id))continue;
   const view=this.views.get(id);
   const previous=view?.to;
   const interval=view?clamp(now-view.at,40,150):75;
   const duration=view?view.duration*.7+interval*.3:75;
   const jump=previous&&(previous.boatId!==s.boatId||Math.hypot(s.x-previous.x,s.y-previous.y)>Math.max(9,(s.speed||0)*interval*.004));
   this.views.set(id,{from:view&&!jump?visualPose(view,now):s,to:s,at:now,duration});
   this.boats.set(id,s);
  }
 }
 largestBoat(){const ids=this.players.map(p=>p.boat);return ['ac72','ac75','yacht','dinghy','laser'].find(id=>ids.includes(id))||this.bridge.state().boatId;}
 ready(){return !this.inWorld||this.host||this.synced;}
 mapBoats(){return [...this.boats].filter(([id])=>id!==this.id).map(([id,s])=>({...s,player:this.players.find(p=>p.id===id)}));}
 render(dt){
  if(!this.inWorld||!this.session)return;
  const scene=this.bridge.scene(),env=this.bridge.env(),world=this.bridge.state(),now=performance.now();
  const {remoteDistance}=scene.graphicsProfile,eye=scene.camera.position;
  for(const [id,s] of this.boats){
   if(id===this.id)continue;
   let actor=this.actors.get(id);
   if(actor&&actor.boatId!==s.boatId){actor.disposeBoat();this.actors.delete(id);actor=null;}
   if(Math.hypot(s.x-eye.x,s.y+eye.z)>remoteDistance+35){
    if(actor){actor.boatRoot.visible=false;actor.hull.visible=false;}
    continue;
   }
   const view=this.views.get(id),pose=view?visualPose(view,now):s;
   const distance=Math.hypot(pose.x-eye.x,pose.y+eye.z);
   if(distance>=remoteDistance){
    if(actor){actor.boatRoot.visible=false;actor.hull.visible=false;}
    continue;
   }
   if(!actor){
    actor=Object.create(scene);actor.boatRoot=null;actor.boatId=null;actor.isRemoteActor=true;
    actor.configureWaterMask=()=>{};actor.updateWaterMask=()=>{};
    actor.buildBoat(s.boatId);
    const info=this.players.find(p=>p.id===id);
    const name=new THREE.Sprite(new THREE.SpriteMaterial({map:scene.makeLabel(info?.name||'Sejler',false,info?.color||'#ffffff'),transparent:true,depthWrite:false}));
    name.position.set(0,scene.modelFor(s.boatId).mastHeight*.5+2,0);
    name.scale.set(5,2.2,1);actor.nameplate=name;actor.hull.add(name);
    this.actors.set(id,actor);
   }
   const draw={...pose,time:world.time,seaState:world.seaState,waveProfile:world.waveProfile};
   actor.boatRoot.visible=actor.hull.visible=true;
   actor.nameplate.visible=distance<460;
   actor.nameplate.material.opacity=clamp((460-distance)/150,0,1);
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
 clear(){clearTimeout(this.weatherCommit);this.weatherCommit=null;this.sentWeather=null;for(const a of this.actors.values())a.disposeBoat();this.actors.clear();this.boats.clear();this.controls.clear();this.views.clear();this.pending=[];this.acks={};this.races.clear();this.raceActive=false;this.session=null;this.inWorld=false;this.synced=false;this.lastSnapshot=-1;}
}
globalThis.FriVindFleet=Fleet;
})();
