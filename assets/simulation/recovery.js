/* FRI VIND / v9 bounded rescue with an independent monotonic deadline.
 * This is explicit GAME assistance, not a real sailing righting procedure.
 * Normal sailing is force integrated. Rescue first uses external moments,
 * released sheets and drag. Only its last, declared safety phase can blend
 * the pose into a solved collision-free displacement state.
 * A foil does not lose mass, gain a speed bonus or jump to flying height.
 * Call update with performance.now() before the RAF pause/accumulator gate,
 * and again when capsize is detected. A one-shot 4.5s main-thread watchdog
 * must also call update; a suspended event loop finishes on its first wake.
 */
(function(install){
 if(typeof module!=='undefined'&&module.exports)module.exports=install;
 else install(globalThis);
})(function(root){
'use strict';
const D=Math.PI/180,PI=Math.PI;
const CONFIG=Object.freeze({unloadSeconds:.25,physicalTargetSeconds:2.80,minimumFinishSeconds:3.0,fallbackStartSeconds:3.50,fallbackEndSeconds:4.40,deadlineSeconds:4.45,watchdogSeconds:4.50,sheet:.02,sailLoadFraction:.02,targetWindAngle:75*D,rollKp:16,rollKd:8,pitchKp:16,pitchKd:8,yawKp:3.2,yawKd:3.7,maxRollAcceleration:4.2,maxPitchAcceleration:3.5,maxYawAcceleration:1.8,translationDragRate:1.05,maxTranslationDeceleration:7,stableAngle:4*D,stableRotationRate:7*D,stableVerticalRate:.18,stableHeaveError:.07,stableHeadingError:8*D,stableHoldSeconds:.10});
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),mix=(a,b,t)=>a+(b-a)*t,wrap=x=>Math.atan2(Math.sin(x),Math.cos(x)),finite=(x,otherwise=0)=>Number.isFinite(x)?x:otherwise;
const smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t);},smoothDerivative=t=>t<=0||t>=1?0:6*t*(1-t);
const physics=()=>root.SailPhysics,boats=()=>root.SailingBoats,foils=()=>root.FoilingPhysics;
const monotonicNow=now=>Number.isFinite(now)?now:root.performance&&typeof root.performance.now==='function'?root.performance.now():0;
function active(s){return !!(s?.recoveryState?.active);}
function windPlan(s,env){
 const P=physics(),w=P.windForState(s,env),from=w.tws>.01?Math.atan2(-w.vy,-w.vx):finite(s.theta)+PI/2;
 // Recovery ends at zero boat speed. Use TRUE wind to choose its tack:
 // inverted/drifting apparent wind can briefly reverse even in fixed wind.
 const selected=s.crewTarget?.side;
 const manualSide=(s.crewDifficulty??env.difficulty)!=='easy' && (selected===1||selected===-1);
 const side=manualSide?selected:w.twa!=null&&Math.abs(w.twa)>.12&&Math.abs(w.twa)<PI-.15?Math.sign(w.twa):-Math.sign(s.boom||1);
 return{side:side||-1,heading:wrap(from+(side||-1)*CONFIG.targetWindAngle),from};
}
function statePoint(s){return{x:finite(s.x),y:finite(s.y),theta:finite(s.theta),heel:finite(s.heel),pitch:finite(s.pitch),heave:finite(s.heave),vx:finite(s.vx),vy:finite(s.vy),omega:finite(s.omega),heelRate:finite(s.heelRate),pitchRate:finite(s.pitchRate),heaveVelocity:finite(s.heaveVelocity),boom:finite(s.boom),boomRate:finite(s.boomRate),sheet:clamp(finite(s.sheet,.02),0,1),crewPoseBlend:clamp(finite(s.crewPoseBlend,1),1,3),crewSideBlend:clamp(finite(s.crewSideBlend,-1),-1,1),crewSwim:clamp(finite(s.crewSwim),0,1),cockpitWet:clamp(finite(s.cockpitWet),0,1),foils:s.foils?Object.fromEntries(Object.entries(s.foils).map(([k,f])=>[k,{arm:finite(f.arm),flap:finite(f.flap),flapInner:finite(f.flapInner),flapOuter:finite(f.flapOuter)}])):null};}
function spawnClearance(c,heading){
 const world=root.SailingWorld;
 const requiredDepth=Math.max(2,c.daggerDepth||0,c.foilDrop||0,c.rudderDepth||0)+1.2;
 const halfLength=c.length*.57,halfWidth=Math.max(c.beam*.58,(c.foilHingeZ||0)+(c.foilOutreach||0)+(c.foilSpan||0)*.5),P=physics(),axis=P.axes(heading);
 const clear=(x,y)=>{if(!Number.isFinite(x)||!Number.isFinite(y))return false;for(const f of [-halfLength,0,halfLength])for(const r of [-halfWidth,0,halfWidth])if(world.heightAt(x+axis.fx*f+axis.rx*r,y+axis.fy*f+axis.ry*r)>-requiredDepth)return false;return true;};
 return {clear,requiredDepth};
}
function safeLocation(s,c,heading){
 const world=root.SailingWorld;if(!world)return{x:finite(s.x),y:finite(s.y),relocated:false,requiredDepth:0};
 const {clear,requiredDepth}=spawnClearance(c,heading);
 const x=finite(s.x),y=finite(s.y);if(clear(x,y))return{x,y,relocated:false,requiredDepth};
 const step=Math.max(20,c.length*1.15);for(let ring=1;ring<=96;ring++){const radius=step*ring;let best=null;for(let j=0;j<24;j++){const a=2*PI*j/24,xx=x+radius*Math.cos(a),yy=y+radius*Math.sin(a);if(clear(xx,yy)){const depth=-world.heightAt(xx,yy);if(!best||depth>best.depth)best={x:xx,y:yy,depth};}}if(best)return{...best,relocated:true,requiredDepth};}
 // The common spawn is checked, not assumed safe. A distant open-sea fallback
 // is last resort for corrupt/out-of-world or deeply grounded fixtures.
 for(const p of [{x:0,y:0},{x:0,y:-6000},{x:0,y:-12000}])if(clear(p.x,p.y))return{...p,relocated:true,requiredDepth};
 return{x:0,y:-20000,relocated:true,requiredDepth};
}
function solvedState(s,env,plan){
 const P=physics(),c=boats().get(s),where=safeLocation(s,c,plan.heading),sheet=Math.min(CONFIG.sheet,finite(s.sheet,CONFIG.sheet));
 const fresh=P.createState({boatId:s.boatId,massScale:s.massScale||1,x:where.x,y:where.y,theta:plan.heading,time:finite(s.time),vx:0,vy:0,omega:0,heel:0,heelRate:0,pitch:0,pitchRate:0,heaveVelocity:0,crewPose:1,crewPoseBlend:1,crewSide:plan.side,crewSideBlend:plan.side,crewSwim:0,cockpitWet:0,sheet,rudder:0,boom:0,boomRate:0,seaState:s.seaState,atmosphere:s.atmosphere,waveProfile:s.waveProfile,seaStateRate:s.seaStateRate,
  cruiserRig:s.cruiserRig?{...s.cruiserRig,jibSheet:null,extraSheet:null}:undefined}, {...env,crewPose:1});
 if(fresh.foils)for(const f of Object.values(fresh.foils))Object.assign(f,{arm:0,armRate:0,armAcceleration:0,targetArm:0,deployment:1,flap:0,flapInner:0,flapOuter:0,flapRate:0,targetFlap:0,ventilation:0});
 if(fresh.foiling)Object.assign(fresh.foiling,{windwardSide:plan.side,leewardSide:-plan.side,raisedSide:0,overlap:c.foilOverlapSeconds||3,activeFoil:'both',commandedFoil:'both',status:'waterborne',slamSeverity:0});
 if(fresh.wing)Object.assign(fresh.wing,{flap:0,load:0,stall:0});
 fresh.heave=P.equilibriumHeave(fresh,env);P.refresh(fresh,env);
 // Free, eased boom/wing feathers along the actual apparent air direction.
 fresh.boom=-plan.side*Math.min(P.boomLimit(fresh.sheet,c),Math.abs(fresh.wind.awa||CONFIG.targetWindAngle));fresh.boomRate=0;
 if(fresh.wing)fresh.wing.angle=fresh.boom;
 P.updateRig(fresh,c,0);
 fresh.rig.sideBlend=fresh.rig.side;
 if(c.kind==='foiler'&&Number.isFinite(s.rig?.reef)){
  fresh.rig.reef=s.rig.reef;
  fresh.rig.reefTarget=s.rig.reefTarget??s.rig.reef;
 }
 if(c.id==='yacht')fresh.spinnaker=null;
 P.refresh(fresh,env);
 if(c.kind==='foiler'){const F=foils(),hull=F.hullLoads(fresh,env,F.massProperties(fresh),false);fresh.hydro=hull;F.foilLoads(fresh,env,0);F.updateStatus(fresh,hull);}else fresh.hydro=P.hydrostatics(fresh,env,false);
 fresh.ground=root.SailingWorld?.contact(fresh,c,env)||{contact:false,depth:90};
 return{fresh,where};
}
function start(s,env,nowMs){
 if(env?.autoRecovery===false)return{started:false};
 if(active(s)){s.recoveryState.repeatedStartCount++;return{started:false,record:s.recoveryState};}
 const now=monotonicNow(nowMs),initial=statePoint(s),plan=windPlan(s,env),r={id:(s.lastRecovery?.id||s.recoveryState?.id||0)+1,active:true,startMs:now,lastMs:now,elapsed:0,phase:'unload',initial,plan,usedFallback:false,fallback:null,stableSince:null,completedAtMs:null,completedElapsedSeconds:null,deadlineMs:now+CONFIG.deadlineSeconds*1000,watchdogMs:now+CONFIG.watchdogSeconds*1000,clock:'monotonic milliseconds supplied by caller',repeatedStartCount:0};
 s.recoveryState=r;s.recovering=true;s.capsized=true;s.recovery=0;s.recoveryAeroScale=1;s.gybeTarget=0;s.crewPose=1;s.crewSide=plan.side;s.helmHoldSeconds=0;s.steerIntent=0;s.helmAssist={active:false,level:0,moment:0,backAngle:0};s.steering=null;
 if(s.foiling)s.foiling.overlap=boats().get(s).foilOverlapSeconds||3;
 return{started:true,record:r};
}
function target(s){
 const r=s.recoveryState,e=r.elapsed,span=CONFIG.physicalTargetSeconds-CONFIG.unloadSeconds,u=clamp((e-CONFIG.unloadSeconds)/span,0,1),ease=smooth(u),d=smoothDerivative(u)/span;
 const h=wrap(r.initial.heel),p=wrap(r.initial.pitch),baseH=r.initial.heel-h,baseP=r.initial.pitch-p,deltaTheta=wrap(r.plan.heading-r.initial.theta);
 return{heel:baseH+h*(1-ease),pitch:baseP+p*(1-ease),heelRate:-h*d,pitchRate:-p*d,theta:r.initial.theta+deltaTheta*ease,yawRate:deltaTheta*d};
}
function boomTorque(s,env){
 if(!active(s))return 0;const c=boats().get(s),w=physics().windForState(s,env),side=s.recoveryState.plan.side,angle=-side*Math.min(physics().boomLimit(s.sheet,c),Math.abs(w.awa||CONFIG.targetWindAngle)),acc=clamp(14*wrap(angle-s.boom)-7*s.boomRate,-3.5,3.5);return c.boomInertia*acc;
}
function forces(s,env,properties={}){
 if(!active(s))return{roll:0,pitch:0,yaw:0,fx:0,fy:0,fz:0,boomTorque:0};
 const c=boats().get(s),r=s.recoveryState,t=target(s),mass=properties.mass||c.mass*(s.massScale||1),Iroll=properties.roll||c.rollInertia,Ipitch=properties.pitch||c.pitchInertia,Iyaw=properties.yaw||c.yawInertia;
 const physicalRoll=finite(properties.physicalRoll),physicalPitch=finite(properties.physicalPitch),physicalYaw=finite(properties.physicalYaw),unloading=r.elapsed<CONFIG.unloadSeconds;
 const ar=clamp(unloading?-10*s.heelRate:CONFIG.rollKp*(t.heel-s.heel)+CONFIG.rollKd*(t.heelRate-s.heelRate),-CONFIG.maxRollAcceleration,CONFIG.maxRollAcceleration);
 const ap=clamp(unloading?-10*s.pitchRate:CONFIG.pitchKp*(t.pitch-s.pitch)+CONFIG.pitchKd*(t.pitchRate-s.pitchRate),-CONFIG.maxPitchAcceleration,CONFIG.maxPitchAcceleration);
 const ay=clamp(unloading?-8*s.omega:CONFIG.yawKp*wrap(t.theta-s.theta)+CONFIG.yawKd*(t.yawRate-s.omega),-CONFIG.maxYawAcceleration,CONFIG.maxYawAcceleration);
 const rollCap=Iroll*8+mass*c.gravity*(c.beam*.65+c.mastTop*.12),pitchCap=Ipitch*7+mass*c.gravity*c.length*.60,yawCap=Iyaw*5+mass*c.gravity*c.length*.20;
 const roll=clamp(Iroll*ar-physicalRoll,-rollCap,rollCap),pitch=clamp(Ipitch*ap-physicalPitch,-pitchCap,pitchCap),yaw=clamp(Iyaw*ay-physicalYaw,-yawCap,yawCap);
 const speed=Math.hypot(s.vx,s.vy),drag=mass*Math.min(CONFIG.translationDragRate,CONFIG.maxTranslationDeceleration/(speed||1)),fx=-drag*s.vx,fy=-drag*s.vy;
 let fz=0;
 if(r.elapsed>1.8&&Math.abs(wrap(s.heel))<35*D&&Math.abs(wrap(s.pitch))<25*D){
  if(!Number.isFinite(r.equilibriumHeave)||s.time-(r.equilibriumTime??-99)>.16){const probe={...s,heel:0,pitch:0,heaveVelocity:0,heelRate:0,pitchRate:0,cockpitWet:0};r.equilibriumHeave=physics().equilibriumHeave(probe,env);r.equilibriumTime=s.time;}
  const az=clamp(12*(r.equilibriumHeave-s.heave)-7*s.heaveVelocity,-3.5,3.5),blend=1-smooth((Math.abs(wrap(s.heel))-15*D)/(20*D));fz=clamp(mass*az-finite(properties.physicalFz),-mass*c.gravity*2,mass*c.gravity*2)*blend;
 }
 const out={roll,pitch,yaw,fx,fy,fz,boomTorque:boomTorque(s,env),rollCap,pitchCap,yawCap,target:t};r.forces=out;return out;
}
function isStable(s,env){
 const r=s.recoveryState;if(Math.abs(wrap(s.heel))>CONFIG.stableAngle||Math.abs(wrap(s.pitch))>CONFIG.stableAngle||Math.abs(s.heelRate)>CONFIG.stableRotationRate||Math.abs(s.pitchRate)>CONFIG.stableRotationRate||Math.abs(s.omega)>CONFIG.stableRotationRate||Math.abs(s.heaveVelocity)>CONFIG.stableVerticalRate||Math.abs(wrap(s.theta-r.plan.heading))>CONFIG.stableHeadingError||Math.abs((s.crewPoseBlend||1)-1)>.08||Math.abs((s.crewSideBlend??r.plan.side)-r.plan.side)>.06||s.sheet>CONFIG.sheet+.015||s.ground?.contact)return false;
 // A still-moving heavy foil arm must finish through the continuous rescue
 // transition, never be snapped down by an early "already stable" result.
 if(s.foils&&Object.values(s.foils).some(f=>Math.abs(f.arm||0)>.025||Math.abs(f.armRate||0)>.035||Math.abs(f.flap||0)>.025))return false;
 const wind=physics().windForState(s,env);if(wind.tws>.3&&(Math.abs(wind.twa||0)<42*D||Math.abs(wind.twa||0)>150*D||Math.sign(wind.twa||r.plan.side)!==r.plan.side))return false;
 const P=physics(),eq=P.equilibriumHeave(s,env);return Math.abs(s.heave-eq)<CONFIG.stableHeaveError&&Math.hypot(s.vx,s.vy)<1.1;
}
function currentRecoveryPlan(s,env){
 const plan=s.recoveryState.plan,wind=physics().windForState(s,env);
 if(wind.tws<=.3)return plan;
 const from=Math.atan2(-wind.vy,-wind.vx),angle=wrap(plan.heading-from)*plan.side;
 if(angle>=42*D&&angle<=150*D)return plan;
 return {...plan,from,heading:wrap(from+plan.side*CONFIG.targetWindAngle)};
}
function beginFallback(s,env){
 const r=s.recoveryState;if(r.fallback)return;
 const plan=currentRecoveryPlan(s,env);
 const solved=solvedState(s,env,plan);
 // Relocation to navigable water is a discontinuity, not a high-speed
 // physical trip over the seabed. Never differentiate its distance into vx/vy.
 if(solved.where.relocated){s.x=solved.where.x;s.y=solved.where.y;s.vx=0;s.vy=0;}
 r.plan=plan;r.usedFallback=true;r.fallback={startElapsed:r.elapsed,start:statePoint(s),target:statePoint(solved.fresh),safeLocation:solved.where};r.phase='stabilize';
}
function hermite(a,v,b,t,duration){const t2=t*t,t3=t2*t;return(2*t3-3*t2+1)*a+(t3-2*t2+t)*v*duration+(-2*t3+3*t2)*b;}
function hermiteVelocity(a,v,b,t,duration){return((6*t*t-6*t)*a+(3*t*t-4*t+1)*v*duration+(-6*t*t+6*t)*b)/duration;}
function projectFallback(s,env){
 const r=s.recoveryState,f=r?.fallback;if(!r?.active||!f)return;
 const duration=Math.max(.05,CONFIG.fallbackEndSeconds-f.startElapsed),u=clamp((r.elapsed-f.startElapsed)/duration,0,1),ease=smooth(u),A=f.start,Z=f.target;
 for(const [p,v,cap]of [['x','vx',10],['y','vy',10],['heave','heaveVelocity',2],['heel','heelRate',1.8],['pitch','pitchRate',1.4],['theta','omega',1.3],['boom','boomRate',2]]){
  const start=A[p],end=(p==='heel'||p==='pitch')?start-wrap(start):p==='theta'||p==='boom'?start+wrap(Z[p]-start):Z[p],velocity=clamp(A[v],-cap,cap);s[p]=hermite(start,velocity,end,u,duration);s[v]=hermiteVelocity(start,velocity,end,u,duration);
 }
 s.sheet=Math.min(CONFIG.sheet,s.sheet);s.crewPose=1;s.crewPoseBlend=mix(A.crewPoseBlend,1,ease);s.crewSideBlend=mix(A.crewSideBlend,r.plan.side,ease);s.crewSwim=mix(A.crewSwim,0,ease);s.cockpitWet=mix(A.cockpitWet,0,ease);s.crewPoseVelocity=0;s.crewSideVelocity=0;
 if(s.foils&&A.foils)for(const [key,f0]of Object.entries(A.foils)){const f1=s.foils[key];for(const p of ['arm','flap','flapInner','flapOuter'])f1[p]=mix(f0[p],0,ease);f1.armRate=-f0.arm*smoothDerivative(u)/duration;f1.armAcceleration=0;f1.targetArm=0;f1.flapRate=-f0.flap*smoothDerivative(u)/duration;f1.targetFlap=0;f1.deployment=1-f1.arm/boats().get(s).foilUpAngle;}
 physics().updateCrew(s,{crewPose:1},{...env,autoBalance:false},0);
 if(s.wing){s.wing.flap*=1-ease;s.wing.angle=s.boom;}
 r.fallbackProgress=u;
}
function finish(s,env,nowMs,reason){
 const r=s.recoveryState;if(!r?.active)return{completed:false};
 // A physically settled course is already usable (checked in isStable).
 // Do not rotate it instantly merely to recover the nominal 75-degree TWA.
 const now=Math.max(r.lastMs,monotonicNow(nowMs)),plan=reason==='force-settled'?{...r.plan,heading:s.theta}:r.fallback?{...r.plan,heading:r.fallback.target.theta}:currentRecoveryPlan(s,env),solved=solvedState(s,env,plan),elapsed=(now-r.startMs)/1000;r.plan=plan;
 const crewTarget=s.crewTarget,history={id:r.id,startMs:r.startMs,completedAtMs:now,elapsedSeconds:elapsed,deadlineSeconds:CONFIG.deadlineSeconds,reason,usedFallback:r.usedFallback,relocated:!!(solved.where.relocated||r.fallback?.safeLocation.relocated),position:{x:solved.fresh.x,y:solved.fresh.y},heading:solved.fresh.theta,sheet:solved.fresh.sheet,crewPose:1,waterline:solved.fresh.heave,clock:'monotonic wall time',lateAfterInactiveGap:elapsed>5,overdueSeconds:Math.max(0,elapsed-CONFIG.deadlineSeconds)};
 // A sailor reboards inside. A pre-capsize full hike would roll an unloaded dinghy to windward.
 const reboardedInside=s.boatId==='laser'&&crewTarget?.pose===3&&(s.crewDifficulty??env.difficulty)!=='easy';
 Object.assign(s,solved.fresh,{reboardedInside});if(crewTarget)s.crewTarget=crewTarget;
 Object.assign(r,{active:false,phase:'complete',lastMs:now,elapsed,completedAtMs:now,completedElapsedSeconds:elapsed,reason,stableSince:null});s.recoveryState=r;s.lastRecovery=history;s.recovering=false;s.capsized=false;s.recovery=1;s.recoveryAeroScale=1;s.helmHoldSeconds=0;s.steerIntent=0;s.helmTarget=0;s.helmAssist={active:false,level:0,moment:0};s.steering=null;s.gybeTarget=0;
 return{completed:true,record:history};
}
function update(s,env,nowMs){
 if(!s||env?.autoRecovery===false)return{started:false,completed:false};let started=false;
 if(s.capsized&&!active(s)){start(s,env,nowMs);started=true;}
 if(!active(s))return{started,completed:false};
 const r=s.recoveryState,now=Math.max(r.lastMs,monotonicNow(nowMs));r.lastMs=now;r.elapsed=(now-r.startMs)/1000;s.recovery=clamp(r.elapsed/CONFIG.fallbackEndSeconds,0,1);s.recovering=true;s.crewPose=1;
 const released=smooth(r.elapsed/CONFIG.unloadSeconds);s.sheet=Math.min(s.sheet,mix(r.initial.sheet,Math.min(r.initial.sheet,CONFIG.sheet),released));s.recoveryAeroScale=mix(1,CONFIG.sailLoadFraction,smooth(r.elapsed/.15));
 if(r.elapsed>=CONFIG.deadlineSeconds)return{started,...finish(s,env,now,r.elapsed>5?'deadline-after-inactive-gap':'deadline')};
 if(r.elapsed>=CONFIG.fallbackStartSeconds){beginFallback(s,env);projectFallback(s,env);if(r.elapsed>=CONFIG.fallbackEndSeconds)return{started,...finish(s,env,now,'controlled-stabilization')};}
 else{
  r.phase=r.elapsed<CONFIG.unloadSeconds?'unload':'righting';
  if(r.elapsed>=CONFIG.minimumFinishSeconds){if(isStable(s,env)){if(r.stableSince==null)r.stableSince=now;if(now-r.stableSince>=CONFIG.stableHoldSeconds*1000)return{started,...finish(s,env,now,'force-settled')};}else r.stableSince=null;}
 }
 return{started,completed:false,record:r};
}
function postStep(s,env){if(active(s)&&s.recoveryState.fallback)projectFallback(s,env);}
root.SailingRecovery={CONFIG,active,start,update,forces,boomTorque,postStep,isStable,spawnClearance,safeLocation,solvedState,finish};

});
