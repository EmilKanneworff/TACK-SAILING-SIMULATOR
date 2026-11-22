/* FRI VIND / AC75- and AC72-inspired, force-driven foil model.
 * SI, seconds, radians. World x=east,y=north,z=UP; body x=forward,y=UP,z=starboard.
 * This is an openly calibrated game model, not AC75 design/performance data.
 * Main+jib projected areas count once. Moving 1265kg foil assemblies are
 * counted once in mass/CG/inertia. Automatic controls command only actuators;
 * every displacement, acceleration, roll and pitch follows integrated forces.
 * Ventilation models entrained surface air; cavitation is not simulated.
 */
(function(install){
 if(typeof module!=='undefined'&&module.exports)module.exports=install;
 else install(globalThis);
})(function(root){
'use strict';
const B=root.SailingBoats;
const P=root.SailPhysics;
const PI=Math.PI,D=PI/180,clamp=P.clamp,wrap=P.wrap;
const C=()=>B.get('ac75'),cfg=s=>B.get(s),envFor=P.environment;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);};
const move=(a,b,d)=>a+clamp(b-a,-d,d),mix=(a,b,t)=>a+(b-a)*t;
const V=(x=0,y=0,z=0)=>({x,y,z}),add=(a,b)=>V(a.x+b.x,a.y+b.y,a.z+b.z),sub=(a,b)=>V(a.x-b.x,a.y-b.y,a.z-b.z),mul=(a,k)=>V(a.x*k,a.y*k,a.z*k),dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,cross=(a,b)=>V(a.y*b.z-a.z*b.y,a.z*b.x-a.x*b.z,a.x*b.y-a.y*b.x),len=a=>Math.hypot(a.x,a.y,a.z),unit=a=>mul(a,1/(len(a)||1));
const isCat=c=>c.hullType==='catamaran';
function foilKeys(s){return isCat(cfg(s))?['port','starboard','rudderPort','rudderStarboard']:['port','starboard','rudder'];}
function bodyVector(s,p){const q=P.bodyOffset(s,p),a=P.axes(s.theta);return V(q.f*a.fx+q.r*a.rx,q.f*a.fy+q.r*a.ry,q.up);}
function bodyPoint(s,p){return P.bodyPoint(s,p);}
function angularVelocity(s){const a=P.axes(s.theta),cp=Math.cos(s.pitch),sp=Math.sin(s.pitch);return V(s.heelRate*cp*a.fx+s.pitchRate*a.rx,s.heelRate*cp*a.fy+s.pitchRate*a.ry,s.omega+s.heelRate*sp);}
// State translation is stored at hull reference O. This is exactly the
// CG-point formula: V(CG)=V(O)+omega x r(CG), then V(p)=V(CG)+
// omega x (r(p)-r(CG)). Keeping O avoids inventing motion when a heavy arm
// moves the CG. The moving-joint contribution is added separately.
function pointVelocity(s,p,jointVelocity){const vel=add(V(s.vx,s.vy,s.heaveVelocity),cross(angularVelocity(s),bodyVector(s,p)));return jointVelocity?add(vel,bodyVector(s,jointVelocity)):vel;}
function rotateX(p,a){return V(p.x,Math.cos(a)*p.y-Math.sin(a)*p.z,Math.sin(a)*p.y+Math.cos(a)*p.z);}
function foilPose(s,side){
 const c=cfg(s),rudder=side===0||String(side).startsWith('rudder');if(rudder){const key=side===0?'rudder':side,f=s.foils?.[key]||{},z=isCat(c)?(side==='rudderPort'?-1:1)*c.foilHingeZ:0,centre=V(c.rudderX,c.rudderY,z);return{key,side:0,rudder:true,hinge:V(c.rudderX,c.deckY,z),elbow:V(c.rudderX,c.rudderY+.22,z),wingCentre:centre,wingNormal:V(0,1,0),spanDirection:V(0,0,1),chordDirection:V(1,0,0),span:c.rudderSpan,chord:c.rudderWingArea/c.rudderSpan,area:c.rudderWingArea,arm:0,flap:f.flap||0,armCG:centre,jointVelocity:V(),jointAcceleration:V()};}
 if(isCat(c)){const sg=side==='port'?-1:side==='starboard'?1:Math.sign(side)||1,key=sg<0?'port':'starboard',f=s.foils?.[key]||{},arm=f.arm||0,hinge=V(c.foilHingeX,c.foilHingeY,sg*c.foilHingeZ),offset=V(0,-c.foilDrop+arm*c.foilRetraction,0),centre=add(hinge,offset),normal=V(0,Math.cos(c.foilCant),-sg*Math.sin(c.foilCant));return{key,side:sg,rudder:false,retracting:true,hinge,elbow:V(centre.x,centre.y+.35,centre.z),wingCentre:centre,wingNormal:normal,spanDirection:unit(cross(V(1,0,0),normal)),chordDirection:V(1,0,0),span:c.foilSpan,chord:c.foilArea/c.foilSpan,area:c.foilArea,arm,flap:f.flap||0,armCG:add(hinge,mul(offset,.63)),jointVelocity:V(0,(f.armRate||0)*c.foilRetraction,0),jointAcceleration:V(0,(f.armAcceleration||0)*c.foilRetraction,0)};}
 const sg=side==='port'?-1:side==='starboard'?1:Math.sign(side)||1,f=s.foils?.[sg<0?'port':'starboard']||{},arm=f.arm||0,hinge=V(c.foilHingeX,c.foilHingeY,sg*c.foilHingeZ),offset=rotateX(V(0,-c.foilDrop,sg*c.foilOutreach),-sg*arm),centre=add(hinge,offset),normal=rotateX(V(0,Math.cos(c.foilCant),-sg*Math.sin(c.foilCant)),-sg*arm);
 const rate=f.armRate||0,accel=f.armAcceleration||0,jv=V(0,sg*offset.z*rate,-sg*offset.y*rate),ja=V(0,sg*offset.z*accel-offset.y*rate*rate,-sg*offset.y*accel-offset.z*rate*rate);
 return{side:sg,hinge,elbow:add(hinge,rotateX(V(0,-2.45,sg*1.70),-sg*arm)),wingCentre:centre,wingNormal:normal,spanDirection:unit(cross(V(1,0,0),normal)),chordDirection:V(1,0,0),span:c.foilSpan,chord:c.foilArea/c.foilSpan,area:c.foilArea,arm,flap:f.flap||0,armCG:add(hinge,mul(offset,.63)),jointVelocity:jv,jointAcceleration:ja};
}
function foilWingDrop(span,fraction){return -.045*span*Math.abs(fraction)**3;}
function groundingPoints(s,key){
 const pose=foilPose(s,key),{hinge,wingCentre,spanDirection,wingNormal,span}=pose;
 const points=[wingCentre,pose.elbow,...[-1,1].map(side=>add(add(wingCentre,mul(spanDirection,side*span*.5)),mul(wingNormal,foilWingDrop(span,side))))];
 const rate=s.foils[key]?.armRate||0;
 return points.map(point=>{
  let velocity;
  if(rate){
   if(pose.retracting)velocity=pose.jointVelocity;
   else {const offset=sub(point,hinge);velocity=V(0,pose.side*offset.z*rate,-pose.side*offset.y*rate);}
  }
  return {...point,kind:point===pose.elbow?(pose.rudder?key+' blade':key+' strut'):key+' foil',jointVelocity:velocity};
 });
}
function massProperties(s){
 const c=cfg(s),scale=s.massScale||1,points=c.massPoints.map(p=>({...p,mass:p.mass*scale,kind:'fixed'}));
 for(const p of B.foilerCrewPositions(s))points.push({...p,mass:p.mass*scale,kind:'crew'});
 for(const side of [-1,1]){const p=foilPose(s,side);points.push({...p.armCG,mass:c.armMass*scale,kind:'arm',side,jointVelocity:mul(p.jointVelocity,.63),jointAcceleration:mul(p.jointAcceleration,.63)});}
 let mass=0,cg=V(),ir=c.rollInertia*scale,ip=c.pitchInertia*scale,iy=c.yawInertia*scale;
 for(const p of points){mass+=p.mass;cg=add(cg,mul(p,p.mass));ir+=p.mass*(p.y*p.y+p.z*p.z);ip+=p.mass*(p.x*p.x+p.y*p.y);iy+=p.mass*(p.x*p.x+p.z*p.z);}
 cg=mul(cg,1/mass);
 return{mass,cg,points,inertiaRoll:ir,inertiaPitch:ip,inertiaYaw:iy,armMass:2*c.armMass*scale,crewMass:c.crewMass*scale};
}
function foilCoefficients(alpha,flap=0,c=C()){
 const a=alpha+flap,fold=.5*Math.atan2(Math.sin(2*a),Math.cos(2*a)),stall=smooth(c.foilStallStart,c.foilStallEnd,Math.abs(fold));
 const attached=c.foilCLMax*Math.tanh(c.foilLiftSlope*fold/c.foilCLMax),cl=mix(attached,.82*Math.sin(2*a),stall),cd=c.foilProfileCD+c.foilInducedCD*cl*cl+c.foilPlateCD*Math.sin(a)**2*stall;
 return{cl,cd,alpha:fold,stall};
}
function foilElement(o){
 const c=o.config||C(),velocity=o.velocity||V(),speed=len(velocity),area=Math.max(0,o.area||0),normal=unit(o.normal||V(0,1,0)),chord=unit(o.chord||V(1,0,0)),wet=clamp(o.wet??1,0,1),ventilation=clamp(o.ventilation||0,0,1);
 if(speed<1e-8||area===0||wet===0)return{force:V(),lift:0,drag:0,alpha:0,cl:0,cd:0,stall:0,speed,power:0,wet,ventilation};
 const stream=mul(velocity,1/speed),raw=(o.incidence||0)+(o.flap||0)-Math.atan2(dot(velocity,normal),dot(velocity,chord)),polar=foilCoefficients(raw,0,c),cl=o.coefficients?.cl??polar.cl,cd=o.coefficients?.cd??polar.cd;
 let liftNormal=sub(normal,mul(stream,dot(stream,normal)));liftNormal=unit(liftNormal);
 // A folded symmetric polar does not itself reverse the lift basis when
 // water flows from trailing edge to leading edge. Orient that basis by
 // chordwise flow. The tiny cross-flow band fades lift continuously to zero;
 // all ordinary forward flow (V.chord / |V| >= .03) is bit-for-bit unchanged.
 const chordFraction=clamp(dot(stream,chord)/.03,-1,1),orientation=chordFraction*(1.5-.5*chordFraction*chordFraction),liftEfficiency=Math.abs(orientation);liftNormal=mul(liftNormal,Math.sign(orientation));
 // Lift is perpendicular to actual local flow. Positive drag can only remove
 // mechanical energy; ventilation continuously removes lift and raises drag.
 const q=.5*(o.rho||c.waterDensity)*speed*speed*area*wet,L=q*cl*(1-c.foilVentLoss*ventilation)*liftEfficiency,drag=q*(cd+.035*ventilation),force=add(mul(liftNormal,L),mul(stream,-drag));
 return{force,liftForce:mul(liftNormal,L),dragForce:mul(stream,-drag),liftDirection:liftNormal,lift:L,drag,alpha:polar.alpha,cl,cd,stall:polar.stall,speed,power:dot(force,velocity),wet,ventilation,flowAngle:Math.atan2(dot(velocity,normal),dot(velocity,chord)),q};
}
function accumulator(){return{force:V(),roll:0,pitch:0,yaw:0,items:[]};}
function addForce(a,s,p,force,label){
 a.force=add(a.force,force);const q=P.bodyOffset(s,p),ax=P.axes(s.theta),ff=force.x*ax.fx+force.y*ax.fy,rr=force.x*ax.rx+force.y*ax.ry,up=force.z,cp=Math.cos(s.pitch),sp=Math.sin(s.pitch),uy=Math.cos(s.heel)*p.y-Math.sin(s.heel)*p.z;
 const roll=ff*sp*q.r+rr*uy-up*cp*q.r,pitch=-ff*q.up+up*q.f,yaw=ff*q.r-rr*q.f;a.roll+=roll;a.pitch+=pitch;a.yaw+=yaw;
 if(label)a.items.push({label,point:{...p},force:{...force},roll,pitch,yaw});return{roll,pitch,yaw};
}
function combine(a,b){a.force=add(a.force,b.force);a.roll+=b.roll;a.pitch+=b.pitch;a.yaw+=b.yaw;return a;}
function sailPolar(alpha,c,camber=c.camber){const shape=clamp(camber/c.camber,.7,1.2),folded=.5*Math.atan2(Math.sin(2*alpha),Math.cos(2*alpha)),aa=Math.abs(folded),stall=smooth(c.stallStart,c.stallEnd,aa),cl=mix(c.sailCLMax*Math.tanh(c.sailLiftSlope*folded/c.sailCLMax),.92*Math.sin(2*alpha),stall)*shape,cd=c.sailProfileCD+c.sailInducedCD*cl*cl+c.sailPlateCD*Math.sin(alpha)**2*stall;return{cl,cd,folded,luff:1-smooth(1*D,4*D,aa),stall};}
function updateReef(s,c,requested,dt){
 if(!c.heavyAir)return;
 if(!s.rig)P.updateRig(s,c,0);
 if([0,1,2].includes(requested))s.rig.reefTarget=requested*.5;
 s.rig.reef=move(s.rig.reef??0,s.rig.reefTarget??0,.28*dt);
}
function aero(s,inputEnv,overrideWind){
 const c=cfg(s),env={...envFor(inputEnv),waveCurrent:s.seaState,waveCurrentRate:s.seaStateRate||0,waveProfile:s.waveProfile},wind=P.windForState(s,env,overrideWind),a=P.axes(s.theta),aws=wind.aws;
 const side=s.rig?.side??(Math.abs(s.boom)>.005?Math.sign(s.boom):-1),twist=c.rigidWing?(s.wing?.twist||0):(s.rig?.twist??c.baseTwist*(1.2-.6*s.sheet)),jibAngle=c.rigidWing?(s.wing?.jibAngle??s.boom*.78):s.boom*.78+1.2*D*Math.tanh(s.boom/(2*D)),acc=accumulator();
 const scaleMain=B.foilerSailScale(c,'main',s.rig?.reef),scaleJib=B.foilerSailScale(c,'jib',s.rig?.reef);
 const areaMain=c.mainArea*scaleMain**2,areaJib=c.jibArea*scaleJib**2,activeArea=areaMain+areaJib;
 const result={wind,fx:0,fy:0,drive:0,sideForce:0,rollMoment:0,pitchMoment:0,yawMoment:0,alpha:0,cl:0,cd:0,lift:0,drag:0,luff:0,stall:0,exposure:0,qArea:0,twist,camber:c.camber,side};
 const flutter=P.sailFlutter(s.rig,.58);
 const along=bodyVector(s,V(1,0,0)),across=bodyVector(s,V(0,0,1));
 for(const [name,area,scale,beta,px,py]of [['main',areaMain,scaleMain,s.boom+(s.rig?.sideBlend??side)*twist*.35+(c.rigidWing?0:flutter*.48),c.mainCPX,c.mainCPHeight],['jib',areaJib,scaleJib,jibAngle+P.sailFlutter(s.rig,.58,true)*.36,c.jibCPX,c.jibCPHeight]]){
  if(!area)continue;
  const foot=name==='main'?c.boomY:c.jibTackY;
  const point=V(name==='main'?c.mastX-c.sailCPChord*scale*Math.cos(beta):mix(c.jibTackX,px,scale),mix(foot,py,scale),(name==='main'?c.sailCPChord:1.8)*scale*Math.sin(beta)),wp=bodyPoint(s,point),water=P.waveHeightAt(wp.x,wp.y,s.time,env),exposure=smooth(-.1,.5,wp.z-water);
  const span=bodyVector(s,V(0,1,0)),chord=bodyVector(s,V(-Math.cos(beta),0,Math.sin(beta))),localAir=P.sailAirAt(s,env,point,overrideWind,name==='main'?s.boomRate||0:0),air=V(localAir.x,localAir.y,localAir.z),sectionFlow=sub(air,mul(span,dot(air,span))),sectionSpeed=len(sectionFlow),angle=sectionSpeed>1e-8?Math.atan2(dot(cross(sectionFlow,chord),span),dot(sectionFlow,chord)):0,co=sailPolar(angle+(c.rigidWing&&name==='main'?(s.wing?.flap||0)*.28:0),c,c.rigidWing?c.camber:(s.rig?.camber??c.camber)*(.55+.45*(s.rig?.fill??1))*Math.abs(s.rig?.sideBlend??1)),q=.5*c.airDensity*sectionSpeed*sectionSpeed*area*exposure*clamp(s.recoveryAeroScale??1,0,1),L=q*co.cl,drag=q*co.cd,force=add(mul(unit(cross(sectionFlow,span)),L),mul(unit(air),drag)),ff=force.x*a.fx+force.y*a.fy,rr=force.x*a.rx+force.y*a.ry,m=addForce(acc,s,point,force,name),weight=area/activeArea;
  const sail={area,angle:beta,alpha:co.folded,cl:co.cl,cd:co.cd,lift:L,drag,drive:ff,sideForce:rr,rollMoment:m.roll,load:clamp(Math.hypot(ff,rr)/(area*170),0,1),luff:co.luff,stall:co.stall,exposure,side,point,force,twist,camber:(s.rig?.camber??c.camber)*(.55+.45*(s.rig?.fill??1)),fill:s.rig?.fill??0,localAirSpeed:sectionSpeed,localAwa:Math.atan2(-dot(air,across),-dot(air,along))};result[name]=sail;
  result.alpha+=co.folded*weight;result.cl+=co.cl*weight;result.cd+=co.cd*weight;result.luff+=co.luff*weight;result.stall+=co.stall*weight;result.exposure+=exposure*weight;result.lift+=L;result.drag+=drag;result.qArea+=q;result.drive+=ff;result.sideForce+=rr;
 }
 result.fx=acc.force.x;result.fy=acc.force.y;result.fz=acc.force.z;result.rollMoment=acc.roll;result.pitchMoment=acc.pitch;result.yawMoment=acc.yaw;result.load=clamp(Math.hypot(result.drive,result.sideForce)/39000,0,1);result.flow=aws<.15||result.luff>.55?'luff':Math.abs(wind.awa||0)>125*D&&result.drag>Math.abs(result.lift)*.5&&result.drive>0?'running':result.stall>.55?'stalled':'attached';result.cpX=(c.mainCPX*c.mainArea+c.jibCPX*c.jibArea)/c.sailArea;result.cpR=c.sailCPChord*Math.sin(s.boom);result.accumulator=acc;return result;
}
const surfaceCache=new Map();
function hullPatches(c){if(surfaceCache.has(c.id))return surfaceCache.get(c.id);const out=[],nx=18,nz=8,x0=c.hullSections[0][0],x1=c.hullSections.at(-1)[0],dx=(x1-x0)/nx;for(let i=0;i<nx;i++){const x=x0+(i+.5)*dx,w=B.halfBeamAt(c,x),dz=w*2/nz;for(let k=0;k<nz;k++){const z=-w+(k+.5)*dz,y=B.hullBottom(c,x,z),eps=.025,bx=(B.hullBottom(c,x+eps,z)-B.hullBottom(c,x-eps,z))/(2*eps),bz=(B.hullBottom(c,x,z+eps)-B.hullBottom(c,x,z-eps))/(2*eps);out.push({x,y,z,area:dx*dz,normal:unit(V(-bx,1,-bz))});}}surfaceCache.set(c.id,out);return out;}
const displacedCache=new Map();
function displacedGroups(c){if(displacedCache.has(c.id))return displacedCache.get(c.id);const data=P.hullSamples(c),patches=hullPatches(c),out={data,groups:(c.hullOffsets||[0]).map(offset=>({offset,cells:offset?data.points.map(p=>({...p,z:p.z+offset})):data.points,patches:offset?patches.map(p=>({...p,z:p.z+offset})):patches}))};displacedCache.set(c.id,out);return out;}
function hullLoads(s,inputEnv,properties,withDamping=true){
 const c=cfg(s),env={...envFor(inputEnv),waveCurrent:s.seaState,waveCurrentRate:s.seaStateRate||0,waveProfile:s.waveProfile},acc=accumulator(),prepared=displacedGroups(c),data=prepared.data,m=properties||massProperties(s),cp=Math.cos(s.pitch),sp=Math.sin(s.pitch),ch=Math.cos(s.heel),sh=Math.sin(s.heel),offsets=c.hullOffsets||[0],damping=clamp(env.motionDamping??1,.35,2),ax=P.axes(s.theta),hulls=[];
 let buoyancy=0,submergedVolume=0,wetArea=0,area=0,slamForce=0,slamPeak=0,rigWet=0,buoyancyRoll=0,buoyancyPitch=0,gravityRoll=0,gravityPitch=0,hullF=0,hullR=0,coamingClearance=Infinity,clearance=Infinity,clearanceRate=0;
 // Each catamaran hull has its own displacement integral, local entry
 // pressure and drag application point. There is no buoyant bridge volume.
 for(const group of prepared.groups){const offset=group.offset;let hBuoyancy=0,hWetArea=0,hArea=0,hSlam=0;
  for(const p of group.cells){
   const uy=ch*p.y-sh*p.z,r=sh*p.y+ch*p.z,forward=cp*p.x-sp*uy,up=sp*p.x+cp*uy;
   const x=s.x+forward*ax.fx+r*ax.rx,y=s.y+forward*ax.fy+r*ax.ry,z=s.heave+up;
   const span=Math.max(.025,Math.abs(sp)*p.dx+Math.abs(cp*ch)*p.dy+Math.abs(cp*sh)*p.dz);
   const threshold=z-span*.5-1e-9,depth=Math.max(0,-s.heave-up);
   if(threshold>0&&P.waveHeightAt(x,y,s.time,env,depth)<=threshold)continue;
   const w=P.waveAt(x,y,s.time,env,depth);
   const fraction=clamp(.5+(w.height-s.heave-up)/span,0,1)*(p.dryAir?1-(s.cockpitWet||0):1);
   if(fraction<=0)continue;
   const volume=p.volume*fraction,fb=c.waterDensity*c.gravity*volume;
   const vel=s.heaveVelocity-s.heelRate*cp*r+s.pitchRate*forward-w.waterVz;
   const fd=withDamping?clamp(-c.heaveDamping*damping*volume/(m.mass/c.waterDensity)*vel,-.85*fb,fb*3):0,fz=fb+fd;
   acc.force.z+=fz;acc.roll-=cp*r*fz;acc.pitch+=forward*fz;
   addForce(acc,s,p,V(c.waterDensity*volume*w.waterAx,c.waterDensity*volume*w.waterAy,0),'wave pressure');
   buoyancy+=fb;hBuoyancy+=fb;submergedVolume+=volume;buoyancyRoll-=cp*r*fb;buoyancyPitch+=forward*fb;
  }
  for(const p of group.patches){
   const wp=bodyPoint(s,p),threshold=wp.z-.015-1e-9,submerged=Math.max(0,-wp.z);
   area+=p.area;hArea+=p.area;
   if(threshold>0&&P.waveHeightAt(wp.x,wp.y,s.time,env,submerged)<=threshold)continue;
   const w=P.waveAt(wp.x,wp.y,s.time,env,submerged),depth=w.height-wp.z,contact=smooth(-.015,.08,depth);
   wetArea+=contact*p.area;hWetArea+=contact*p.area;
   if(!withDamping||contact===0)continue;
   const vel=pointVelocity(s,p),down=Math.max(0,w.velocity+w.dx*vel.x+w.dy*vel.y-vel.z);
   const entry=contact*(1-smooth(.10,.55,depth)),n=bodyVector(s,p.normal);
   const pressure=.5*c.waterDensity*c.hullSlamCoefficient*p.area*down*down*entry*Math.max(0,n.z)
     *smooth(0,.3,-dot(n,sub(vel,V(w.waterVx,w.waterVy,w.waterVz))));
   if(pressure>0){const force=mul(n,pressure);addForce(acc,s,p,force);slamForce+=Math.max(0,force.z);hSlam+=Math.max(0,force.z);slamPeak=Math.max(slamPeak,down);}
  }
  const wetFraction=clamp(hWetArea/(hArea||1),0,1),wetDrag=Math.pow(wetFraction,.80),badHeel=1+1.5*Math.sin(s.heel)**2,dragPoint=V(0,c.deckY-c.hullDepth*.64,offset),local=pointVelocity(s,dragPoint),dragWorld=bodyPoint(s,dragPoint),orbital=P.waveAt(dragWorld.x,dragWorld.y,s.time,env,Math.max(0,-dragWorld.z)),flow=P.waterVelocity(s,orbital),u=(local.x-flow.x)*ax.fx+(local.y-flow.y)*ax.fy,v=(local.x-flow.x)*ax.rx+(local.y-flow.y)*ax.ry,ff=-(c.hullLinearDrag*u+c.hullQuadraticDrag*u*Math.abs(u)+c.hullWaveDrag*u*Math.abs(u)**3)*wetDrag*badHeel/offsets.length,rr=-(c.hullLateralLinear*v+c.hullLateralQuadratic*v*Math.abs(v))*wetDrag*badHeel/offsets.length;
  addForce(acc,s,dragPoint,V(ff*ax.fx+rr*ax.rx,ff*ax.fy+rr*ax.ry,0),'hull');hullF+=ff;hullR+=rr;
  for(const x of [c.cockpit.minX,c.cockpit.maxX])for(const z of [-c.cockpit.halfWidth,c.cockpit.halfWidth]){const p=bodyPoint(s,V(x,c.deckY,z+offset));coamingClearance=Math.min(coamingClearance,p.z-P.waveHeightAt(p.x,p.y,s.time,env));}
  const refLocal=V(0,B.hullBottom(c,0,0),offset),ref=bodyPoint(s,refLocal),water=P.waveAt(ref.x,ref.y,s.time,env),hc=ref.z-water.height;
  const velocity=pointVelocity(s,refLocal);
  // A foil crossing a sloped front sees the surface pass vertically even
  // when the water elevation at a fixed horizontal point is steady.
  const rate=velocity.z-water.velocity-water.dx*velocity.x-water.dy*velocity.y;
  if(hc<clearance){clearance=hc;clearanceRate=rate;}
  hulls.push({offset,wetFraction,buoyancy:hBuoyancy,clearance:hc,clearanceRate:rate,slam:hSlam,dragForward:ff,dragSide:rr});
 }
 for(const p of m.points){const gm=addForce(acc,s,p,V(0,0,-p.mass*c.gravity));gravityRoll+=gm.roll;gravityPitch+=gm.pitch;}
 // Sealed mast/wing and crew volume retain flotation after a capsize.
 for(let i=0;i<9;i++){const p=V(c.mastX,c.boomY+(i+.5)/9*(c.mastTop-c.boomY),0),wp=bodyPoint(s,p),w=P.waveAt(wp.x,wp.y,s.time,env),wet=smooth(-.05,.4,w.height-wp.z);rigWet+=wet/9;if(!wet)continue;const fb=wet*c.mastFloatVolume/9*c.waterDensity*c.gravity,vel=pointVelocity(s,p),drag=withDamping?mul(sub(vel,V(0,0,w.velocity)),-wet*(c.rigDragLinear+c.rigDragQuadratic*len(vel))):V();addForce(acc,s,p,add(V(0,0,fb),drag));buoyancy+=fb;}
 const crew=B.foilerCrewPositions(s);for(const p of crew){const wp=bodyPoint(s,p),water=P.waveHeightAt(wp.x,wp.y,s.time,env),wet=smooth(-.03,.4,water-wp.z),fb=wet*c.crewFloatVolume/crew.length*c.waterDensity*c.gravity;addForce(acc,s,p,V(0,0,fb));buoyancy+=fb;}
 const wetFraction=clamp(wetArea/(area||1),0,1),wetDrag=Math.pow(wetFraction,.80);
 const rotationalDamping={roll:-c.rollDamping*s.heelRate*wetDrag*damping,pitch:-c.pitchDamping*s.pitchRate*wetDrag*damping,yaw:-(c.yawLinearDamping*s.omega+c.yawQuadraticDamping*s.omega*Math.abs(s.omega))*wetDrag*damping};acc.roll+=rotationalDamping.roll;acc.pitch+=rotationalDamping.pitch;acc.yaw+=rotationalDamping.yaw;
 return{...acc,hulls,rotationalDamping,waterContactDampingFraction:wetDrag,controlClearance:hulls.reduce((n,h)=>n+h.clearance/hulls.length,0),controlClearanceRate:hulls.reduce((n,h)=>n+h.clearanceRate/hulls.length,0),buoyancy,weight:m.mass*c.gravity,vertical:acc.force.z,submergedVolume,totalDisplacedVolume:buoyancy/(c.waterDensity*c.gravity),totalVolume:data.volume*offsets.length,hullWetFraction:wetFraction,clearance,clearanceRate,slamForce,slamSeverity:clamp(slamForce/(m.mass*c.gravity),0,4),slamPeak,rigWet,coamingClearance,cockpitWet:s.cockpitWet||0,hullF,hullR,rollBuoyancy:buoyancyRoll,pitchBuoyancy:buoyancyPitch,rollGravity:gravityRoll,pitchGravity:gravityPitch,rollCrew:0,cg:m.cg};
}
function wingImmersion(s,pose,env){let wet=0,depth=0,minimum=Infinity;for(let i=0;i<5;i++){const offset=(i-2)/4*pose.span*.92,p=add(pose.wingCentre,mul(pose.spanDirection,offset)),wp=bodyPoint(s,p),d=P.waveHeightAt(wp.x,wp.y,s.time,env)-wp.z;depth+=d/5;minimum=Math.min(minimum,d);wet+=smooth(-pose.chord*.30,pose.chord*.45,d)/5;}return{wet,depth,minimum};}
const strutConfigCache=new WeakMap();
function strutConfig(c){let cached=strutConfigCache.get(c);if(!cached||cached.cd!==c.foilStrutCD){cached={cd:c.foilStrutCD,config:{...c,foilProfileCD:c.foilStrutCD}};strutConfigCache.set(c,cached);}return cached.config;}
function foilLoads(s,inputEnv,dt=0){
 const c=cfg(s),bladeConfig=strutConfig(c),env={...envFor(inputEnv),waveCurrent:s.seaState,waveCurrentRate:s.seaStateRate||0,waveProfile:s.waveProfile},acc=accumulator(),individual={};let vertical=0,foilDrag=0;
 for(const key of foilKeys(s)){
  const f=s.foils[key],pose=foilPose(s,key),side=pose.side,rudder=key.startsWith('rudder'),imm=wingImmersion(s,pose,env),normal=bodyVector(s,pose.wingNormal),chord=bodyVector(s,pose.chordDirection),parts=[],wingAcc=accumulator(),liftAcc=accumulator();
  const specifications=rudder?[['whole',0,pose.area,f.flap]]:[['inner',-side*pose.span/4,pose.area/2,f.flapInner??f.flap],['outer',side*pose.span/4,pose.area/2,f.flapOuter??f.flap]];
  let lift=0,drag=0,alpha=0,cl=0,cd=0,speed=0,flowAngle=0,liftDirection=V();
  for(const [name,offset,area,flap]of specifications){
   const localPoint=add(pose.wingCentre,mul(pose.spanDirection,offset)),fromHinge=sub(localPoint,pose.hinge),jointVelocity=pose.retracting?pose.jointVelocity:side?V(0,side*fromHinge.z*f.armRate,-side*fromHinge.y*f.armRate):V(),wp=bodyPoint(s,localPoint),wave=P.waveAt(wp.x,wp.y,s.time,env,Math.max(0,-wp.z)),velocity=sub(pointVelocity(s,localPoint,jointVelocity),P.waterVelocity(s,wave)),halfPose={...pose,wingCentre:localPoint,span:side?pose.span/2:pose.span},depth=wingImmersion(s,halfPose,env);
   const foil=foilElement({velocity,normal,chord,area,flap,incidence:side===0?0:c.foilIncidence,wet:depth.wet,ventilation:f.ventilation,config:c}),moment=addForce(wingAcc,s,localPoint,foil.force,name),lm=addForce(liftAcc,s,localPoint,foil.liftForce||V());
   const count=specifications.length;lift+=foil.lift;drag+=foil.drag;alpha+=foil.alpha/count;cl+=foil.cl/count;cd+=foil.cd/count;speed+=foil.speed/count;flowAngle+=(foil.flowAngle||0)/count;liftDirection=add(liftDirection,mul(foil.liftDirection||normal,1/count));
   // The allocator converts its desired finite lift into flap using this
   // real local flow. Removing the flow term would leave enormous passive
   // damping at high q and make height/roll control sluggish. Transient loads
   // are preserved by flightCommands' bounded disturbance observer, not by
   // delaying this actuator effectiveness calculation or the player's input.
   parts.push({name,localPoint,jointVelocity,area,flap,force:foil.force,lift:foil.lift,drag:foil.drag,alpha:foil.alpha,cl:foil.cl,cd:foil.cd,flowAngle:foil.flowAngle||0,normal,liftDirection:foil.liftDirection||normal,velocity,speed:foil.speed,wet:depth.wet,submergence:depth.depth,minimumSubmergence:depth.minimum,moment,liftMoment:lm});
  }
  const shallow=1-smooth(-.02,c.foilVentDepth+.34,imm.minimum),loaded=smooth(.06,.7,Math.abs(cl)),cant=1-Math.abs(normal.z),target=clamp(shallow*(.35+.65*loaded)*(.7+.3*cant),0,1);
  if(dt>0)f.ventilation+=(target-f.ventilation)*(1-Math.exp(-dt/(target>f.ventilation?c.foilVentOnset:c.foilVentRecovery)));
  combine(acc,wingAcc);vertical+=wingAcc.force.z;foilDrag+=drag;
  Object.assign(f,{localPoint:pose.wingCentre,force:wingAcc.force,alpha,cl,cd,submergence:imm.depth,minimumSubmergence:imm.minimum,wet:imm.wet,lift,drag,localVelocity:parts[0].velocity,normal,flowAngle,speed,vertical:wingAcc.force.z,moment:{roll:wingAcc.roll,pitch:wingAcc.pitch,yaw:wingAcc.yaw},liftMoment:{roll:liftAcc.roll,pitch:liftAcc.pitch,yaw:liftAcc.yaw},liftDirection:unit(liftDirection),parts});individual[key]={...f,...imm,pose};
  let bladeForce=V(),bladeWet=0;const rudderAngle=rudder?s.rudder:0,cn=V(Math.cos(rudderAngle),0,-Math.sin(rudderAngle)),nn=V(Math.sin(rudderAngle),0,Math.cos(rudderAngle));
  for(let j=0;j<5;j++){const t=(j+.5)/5,strut=add(pose.hinge,mul(sub(pose.wingCentre,pose.hinge),t)),sw=bodyPoint(s,strut),water=P.waveAt(sw.x,sw.y,s.time,env,Math.max(0,-sw.z)),strutWet=smooth(-.05,.18,water.height-sw.z),strutVelocity=sub(pointVelocity(s,strut,side?mul(pose.jointVelocity,t):null),P.waterVelocity(s,water));
   // The same entrained-air state can weaken the adjacent submerged blade.
   // Dry area has already been removed by strutWet; this is ventilation loss,
   // not a second immersion factor or a flight-mode bonus/penalty.
   const strutVentilation=f.ventilation*(c.foilStrutVentCoupling??.70),strutForce=foilElement({velocity:strutVelocity,normal:bodyVector(s,nn),chord:bodyVector(s,cn),area:(rudder?c.rudderArea:c.foilStrutArea)/5,wet:strutWet,ventilation:strutVentilation,config:bladeConfig});addForce(acc,s,strut,strutForce.force,key+' blade');bladeForce=add(bladeForce,strutForce.force);bladeWet+=strutWet/5;foilDrag+=strutForce.drag;
  }f.strutForce=bladeForce;f.strutWet=bladeWet;f.strutEffectiveWet=bladeWet*(1-c.foilVentLoss*f.ventilation*(c.foilStrutVentCoupling??.70));
 }
 const rudderYaw=acc.items.filter(item=>item.label?.startsWith('rudder')).reduce((n,item)=>n+item.yaw,0)+foilKeys(s).filter(key=>key.startsWith('rudder')).reduce((n,key)=>n+(s.foils[key].moment?.yaw||0),0);
 return{...acc,vertical,foilDrag,individual,rudderYaw};
}
function airHullLoads(s,env){const c=cfg(s),w=P.windForState(s,env),v=V(w.avx,w.avy,0),speed=len(v),force=mul(v,.5*c.airDensity*c.hullAirArea*c.hullAirCD*speed),acc=accumulator();addForce(acc,s,V(0,c.deckY+.5,0),force);return acc;}
function solve3(A,b){const q=A.map((row,i)=>[...row,b[i]]);for(let i=0;i<3;i++){let p=i;for(let j=i+1;j<3;j++)if(Math.abs(q[j][i])>Math.abs(q[p][i]))p=j;if(Math.abs(q[p][i])<1e-8)return null;[q[i],q[p]]=[q[p],q[i]];const div=q[i][i];for(let k=i;k<4;k++)q[i][k]/=div;for(let j=0;j<3;j++)if(j!==i){const f=q[j][i];for(let k=i;k<4;k++)q[j][k]-=f*q[i][k];}}return q.map(row=>row[3]);}
function allocateParts(s,parts,vertical,roll,pitch){const lr=[],lp=[];for(const part of parts){const direction=part.liftDirection,nz=Math.abs(direction.z)>.12?direction.z:Math.sign(direction.z||1)*.12,probe=accumulator();addForce(probe,s,part.localPoint,mul(direction,1/nz));lr.push(probe.roll);lp.push(probe.pitch);}return solve3([[1,1,1],lr,lp],[vertical,roll,pitch]);}
function catFlightReference(s,c,hull,ctrl,forwardSpeed,dt){
 const fast=smooth(8,21,forwardSpeed),tuning=c.rideControl;
 // Smooth the water reference at speed, keeping the boat's heave velocity
 // in the height feedback. Otherwise the flaps chase individual crests.
 const waterHeight=s.heave-hull.controlClearance;
 const tau=.12+tuning.waveFilter*fast;
 const old=ctrl.waterReference??waterHeight;
 const waterRate=(waterHeight-old)/tau;
 ctrl.waterReference=mix(old,waterHeight,1-Math.exp(-dt/tau));
 const minimum=Math.min(...foilKeys(s).map(key=>s.foils[key].minimumSubmergence??2));
 const reserve=fast*(1-smooth(.18,.85,minimum));
 const lowerHeight=c.flightHeight-fast*tuning.fastHeightReduction-reserve*tuning.immersionHeightReduction;
 const previous=ctrl.rideReference??c.flightHeight;
 ctrl.rideReference=mix(previous,lowerHeight,1-Math.exp(-dt/(lowerHeight<previous?.24:1.10)));
 return {clearance:s.heave-ctrl.waterReference,rate:s.heaveVelocity-waterRate,height:ctrl.rideReference,fast};
}
// v10 coordinated flight control. These are calibrated game-control values,
// not measured AC75/AC72 polars. The common reference O is the hull origin;
// physical forces remain integrated once at their actual application points.
// A slowly learned trim load balances steady rig/CG loads. It does NOT cancel
// the current gust, wave, rotation or contact moment. Fast bounded attitude
// feedback and slower height control are allocated through real foil flaps.
// No integrator is used, so travel/rate saturation cannot wind up hidden trim.
function flightCommands(s,env,dt,m,hull,sail,water){
 const c=cfg(s),cat=isCat(c),f=s.foiling,weight=m.mass*c.gravity,damping=clamp(env.motionDamping??1,.35,2),keys=foilKeys(s);
 const ctrl=f.controller||(f.controller={trimRoll:0,trimPitch:0,trimAeroVertical:0,initialized:false});
 let wingRoll=0,wingPitch=0;for(const key of keys){wingRoll+=s.foils[key].liftMoment?.roll||0;wingPitch+=s.foils[key].liftMoment?.pitch||0;}
 const externalRoll=hull.roll+sail.rollMoment+water.roll-wingRoll,externalPitch=hull.pitch+sail.pitchMoment+water.pitch-wingPitch;
 const trimTime=c.foilTrimLoadTime??(cat?.30:.45),blend=1-Math.exp(-dt/trimTime);
 if(!ctrl.initialized){
  ctrl.trimRoll=externalRoll;ctrl.trimPitch=externalPitch;ctrl.trimAeroVertical=sail.fz;ctrl.initialized=true;
  if(c.rideControl){ctrl.waterReference=s.heave-hull.controlClearance;ctrl.rideReference=c.flightHeight;}
 }
 else{ctrl.trimRoll+=(externalRoll-ctrl.trimRoll)*blend;ctrl.trimPitch+=(externalPitch-ctrl.trimPitch)*blend;ctrl.trimAeroVertical+=(sail.fz-ctrl.trimAeroVertical)*blend;}
 const axes=P.axes(s.theta),flow=P.waterVelocity(s),forwardSpeed=(s.vx-flow.x)*axes.fx+(s.vy-flow.y)*axes.fy;
 const ride=c.rideControl?catFlightReference(s,c,hull,ctrl,forwardSpeed,dt):null;
 const clearance=ride?.clearance??hull.clearance,clearanceRate=ride?.rate??hull.clearanceRate,targetHeight=ride?.height??c.flightHeight;
 const targetVerticalVelocity=clamp((c.flightHeightRateGain??1.20)*(targetHeight-clearance),-(c.flightDescentRate??.85),c.flightClimbRate??.95);
 const verticalAcceleration=clamp((c.flightVerticalRateGain??(cat?1.8:1.65))*(targetVerticalVelocity-clearanceRate),-2.6,2.6);
 const release=(1-smooth(.015,.35,hull.hullWetFraction))*smooth(-.1,.30,clearance),bankMax=c.flightBankLimit??(cat?4*D:7*D),bankGain=c.flightBankGain??(cat?.25:.36),targetHeel=clamp(-Math.atan2(forwardSpeed*s.omega,c.gravity)*bankGain,-bankMax,bankMax)*release;
 // Modest nose-up attitude during a requested climb comes from the same outer
 // loop, not an animation. No reference changes mass, inertia or boat height.
 const targetPitch=c.flightPitch+clamp(targetVerticalVelocity*(c.flightClimbPitchGain??.012),-.8*D,.8*D)*release;
 const rollAccel=clamp(c.rollKp*(targetHeel-s.heel)-c.rollKd*damping*s.heelRate,-(c.flightRollAccelLimit??.95),c.flightRollAccelLimit??.95),pitchAccel=clamp(c.pitchKp*(targetPitch-s.pitch)-c.pitchKd*damping*s.pitchRate,-(c.flightPitchAccelLimit??.70),c.flightPitchAccelLimit??.70);
 const aeroVertical=ride?mix(ctrl.trimAeroVertical,sail.fz,ride.fast*.65):ctrl.trimAeroVertical;
 const vertical=weight+m.mass*verticalAcceleration-hull.buoyancy-aeroVertical,roll=-ctrl.trimRoll+m.inertiaRoll*rollAccel,pitch=-ctrl.trimPitch+m.inertiaPitch*pitchAccel;
 Object.assign(ctrl,{externalRoll,externalPitch,transientRoll:externalRoll-ctrl.trimRoll,transientPitch:externalPitch-ctrl.trimPitch,targetVerticalVelocity,verticalAcceleration,targetHeel,targetPitch,rollAcceleration:rollAccel,pitchAcceleration:pitchAccel,release,trimTime,forceRequest:vertical,rollRequest:roll,pitchRequest:pitch});
 f.targetHeight=targetHeight;f.targetHeel=targetHeel;f.targetPitch=targetPitch;
 if(s.capsized||s.recovering)ctrl.initialized=false;
 return{vertical,roll,pitch};
}
// The AC72 game crew uses all four real foil supports. Minimum-norm load
// allocation solves the requested vertical force, roll and pitch moments;
// limited flap actuators realise them. It never writes helm, sheet or motion.
function catAutoFoils(s,controls,env,dt,m,hull,sail,water){
 const c=cfg(s),f=s.foiling,keys=foilKeys(s),awa=sail.wind.awa;
 f.autopilot=true;if(awa!=null&&sail.wind.aws>.4&&Math.abs(awa)>c.foilSideHysteresis&&Math.abs(awa)<150*D){const side=-Math.sign(awa);if(side!==f.leewardSide){f.overlap=c.foilOverlapSeconds;f.leewardSide=side;}}f.windwardSide=-f.leewardSide;f.overlap=Math.max(0,(f.overlap||0)-dt);f.targetHeight=c.flightHeight;
 const {vertical,roll,pitch}=flightCommands(s,env,dt,m,hull,sail,water);
 const columns=[],weights=[];for(const key of keys){const a=s.foils[key],p=foilPose(s,key),n=a.liftDirection||bodyVector(s,p.wingNormal),nz=Math.abs(n.z)>.12?n.z:Math.sign(n.z||1)*.12,probe=accumulator();addForce(probe,s,p.wingCentre,mul(n,1/nz));columns.push([1,probe.roll,probe.pitch]);weights.push(p.area*a.wet*(1-c.foilVentLoss*a.ventilation));}
 const gram=Array.from({length:3},(_,i)=>Array.from({length:3},(_,j)=>columns.reduce((sum,col,k)=>sum+col[i]*col[j]*weights[k],0))),dual=solve3(gram,[vertical,roll,pitch]);
 const totalWeight=weights.reduce((sum,w)=>sum+w,0),allocation=keys.map((_,k)=>dual?weights[k]*columns[k].reduce((sum,a,i)=>sum+a*dual[i],0):vertical*weights[k]/(totalWeight||1));
 for(let k=0;k<keys.length;k++){
  const key=keys[k],a=s.foils[key],rudder=key.startsWith('rudder'),low=rudder?c.rudderFlapMin:c.foilFlapMin,high=rudder?c.rudderFlapMax:c.foilFlapMax;
  // Both lifting boards remain deployed through normal manoeuvres. They are
  // independent physical assemblies; no side or lift is switched instantly.
  if(!rudder){a.targetArm=0;const targetRate=clamp(-a.arm*1.8,-c.foilArmRate,c.foilArmRate),oldRate=a.armRate;a.armRate=move(oldRate,targetRate,c.foilArmAcceleration*dt);a.armAcceleration=(a.armRate-oldRate)/(dt||1);a.arm=clamp(a.arm+a.armRate*dt,0,c.foilUpAngle);a.deployment=1-a.arm/c.foilUpAngle;}
  let flap=0,flapRate=0,targetMean=0;const targets=[];
  const wetParts=a.parts.reduce((total,p)=>total+p.wet,0);
  for(let i=0;i<a.parts.length;i++){const part=a.parts[i],nup=Math.abs(part.liftDirection.z)>.12?part.liftDirection.z:Math.sign(part.liftDirection.z||1)*.12,q=.5*c.waterDensity*part.speed**2*part.area*part.wet,loss=1-c.foilVentLoss*a.ventilation,requested=allocation[k]*part.wet/(wetParts||1),cl=clamp(requested/(Math.max(50,q)*nup*loss),-c.foilAttachedLimit,c.foilAttachedLimit),alpha=c.foilCLMax/c.foilLiftSlope*Math.atanh(cl/c.foilCLMax),target=clamp(alpha*smooth(.08,.65,part.wet)+part.flowAngle-(rudder?0:c.foilIncidence),low,high),field=rudder?'flap':i===0?'flapInner':'flapOuter',old=a[field]??a.flap;
   a[field]=move(old,s.capsized||s.recovering?0:target,(rudder?c.rudderFlapRate:c.foilFlapRate)*dt);flap+=a[field]/a.parts.length;flapRate+=(a[field]-old)/(dt||1)/a.parts.length;targetMean+=target/a.parts.length;targets.push(target);part.requestedVertical=requested;part.targetFlap=target;}
  a.flap=flap;a.flapRate=flapRate;a.targetFlap=targetMean;a.targetFlapInner=targets[0];a.targetFlapOuter=targets[1]??targets[0];a.requestedVertical=allocation[k];a.saturated=targets.some(t=>t<=low+.001||t>=high-.001);
 }
 f.raisedSide=0;f.commandedFoil='both';f.heightError=f.targetHeight-hull.controlClearance;f.requestedVertical=vertical;f.requestedRoll=roll;f.requestedPitch=pitch;f.controllerSaturated=keys.some(k=>s.foils[k].saturated||Math.abs(s.foils[k].targetFlap-s.foils[k].flap)>.02);
}
function autoFoils(s,controls,env,dt,m,hull,sail,water){
 if(isCat(cfg(s)))return catAutoFoils(s,controls,env,dt,m,hull,sail,water);
 const c=cfg(s),f=s.foiling,w=sail.wind,awa=w.awa,damping=clamp(env.motionDamping??1,.35,2);f.autopilot=true;
 if(awa!=null&&w.aws>.4&&Math.abs(awa)>c.foilSideHysteresis&&Math.abs(awa)<150*D){const side=-Math.sign(awa);if(side!==f.leewardSide){f.overlap=c.foilOverlapSeconds;f.leewardSide=side;}}
 f.windwardSide=-f.leewardSide;if(Math.abs(s.rudder)>2.5*D||Math.abs(s.omega)>.055)f.overlap=c.foilOverlapSeconds;else f.overlap=Math.max(0,(f.overlap||0)-dt);
 const targetHeight=c.flightHeight;f.targetHeight=targetHeight;
 const command=flightCommands(s,env,dt,m,hull,sail,water),desiredVertical=command.vertical,desiredRoll=command.roll,desiredPitch=command.pitch;
 const desired=[];const leverRoll=[],leverPitch=[];
 for(const side of [-1,1,0]){const pose=foilPose(s,side),normal=s.foils[side===0?'rudder':side<0?'port':'starboard'].liftDirection||bodyVector(s,pose.wingNormal),nz=Math.abs(normal.z)>.16?normal.z:Math.sign(normal.z||1)*.16,acc=accumulator();addForce(acc,s,pose.wingCentre,mul(normal,1/nz));leverRoll.push(acc.roll);leverPitch.push(acc.pitch);}
 const allocation=solve3([[1,1,1],leverRoll,leverPitch],[desiredVertical,desiredRoll,desiredPitch])||[desiredVertical*.5,desiredVertical*.5,0];
 const leeKey=f.leewardSide<0?'port':'starboard',windwardKey=f.leewardSide>0?'port':'starboard',single=s.foils[leeKey],leePose=foilPose(s,f.leewardSide),q=.5*c.waterDensity*single.speed**2*c.foilArea,capacity=q*c.foilAttachedLimit*Math.max(.1,bodyVector(s,leePose.wingNormal).z)*(1-c.foilVentLoss*single.ventilation);
 const windwardIndex=f.leewardSide>0?0:1,leeIndex=1-windwardIndex,windwardDemand=Math.abs(allocation[windwardIndex]),targetLoad=Math.max(1,desiredVertical);
 const eligibleBase=capacity>Math.max(targetLoad,0)*1.18&&windwardDemand<c.foilSingleLoadFraction*Math.max(targetLoad,m.mass*c.gravity*.2)&&Math.abs(s.heel)<9*D&&f.overlap<=0&&hull.hullWetFraction<.015&&hull.clearance>.30&&!s.capsized;
 let feasible=false;
 if(eligibleBase){
  // The residual-load fraction is only a cheap prefilter. Qualify the real
  // two spanwise sections plus elevator against their CL, immersion, flap
  // travel and differential limits before removing the other support.
  const parts=single.parts.concat(s.foils.rudder.parts),trial=allocateParts(s,parts,desiredVertical,desiredRoll,desiredPitch),angles=[],cls=[];feasible=!!trial;
  if(trial)for(let i=0;i<3;i++){const p=parts[i],a=i===2?s.foils.rudder:single,nz=p.liftDirection.z,q=.5*c.waterDensity*p.speed**2*p.area*p.wet*nz*(1-c.foilVentLoss*a.ventilation),cl=trial[i]/(Math.sign(q||1)*Math.max(50,Math.abs(q))),bounded=clamp(cl,-c.foilCLMax*.999,c.foilCLMax*.999),alpha=c.foilCLMax/c.foilLiftSlope*Math.atanh(bounded/c.foilCLMax),angle=alpha+p.flowAngle-(i===2?0:c.foilIncidence),low=i===2?c.rudderFlapMin:c.foilFlapMin,high=i===2?c.rudderFlapMax:c.foilFlapMax;angles.push(angle);cls.push(cl);if(!Number.isFinite(angle)||p.wet<.90||Math.abs(cl)>c.foilAttachedLimit*.90||angle<low+.5*D||angle>high-.5*D)feasible=false;}
  if(trial&&Math.abs(angles[1]-angles[0])>2*c.foilDifferentialMax*.90)feasible=false;
  f.singlePredictedCL=cls;f.singlePredictedDifferential=trial?(angles[1]-angles[0])/2:0;
 }
 f.singleFeasible=feasible;const eligible=eligibleBase&&feasible;
 // Do not withdraw a foil that is supplying necessary downward roll load.
 // Qualify a settled flight window before the heavy arm starts to travel.
 f.singleReadySeconds=eligible&&Math.abs(s.heelRate)<.025&&Math.abs(hull.clearance-targetHeight)<.20?(f.singleReadySeconds||0)+dt:0;
 if(!f.raisedSide&&f.singleReadySeconds>c.foilSingleConfirmSeconds)f.raisedSide=f.windwardSide;
 if(f.raisedSide&&(f.raisedSide!==f.windwardSide||f.overlap>0||capacity<targetLoad*.92||windwardDemand>c.foilKeepLoadFraction*Math.max(targetLoad,m.mass*c.gravity)||s.heel*f.leewardSide< -13*D||s.heel*f.leewardSide>20*D||hull.hullWetFraction>.06||hull.clearance<.05||s.capsized)){f.raisedSide=0;f.overlap=Math.max(f.overlap,3);}
 const canSingle=!!f.raisedSide;
 // Once a foil leaves the water it cannot be used as a virtual lift actuator.
 // Fade its requested load during withdrawal; the two real spanwise flap
 // sections and elevator then solve the three requested force/moment loads.
 const withdrawing=s.foils[windwardKey].arm;
 const wingRequests={port:[allocation[0]/2,allocation[0]/2],starboard:[allocation[1]/2,allocation[1]/2],rudder:[allocation[2]]};
 if(withdrawing>.02){
  const support=(1-smooth(.02,.35,withdrawing))*Math.max(0,allocation[windwardIndex]);wingRequests[windwardKey]=[support/2,support/2];
  const actual=s.foils[leeKey].parts.concat(s.foils.rudder.parts);
  // Two real spanwise flap sections and the elevator are the three force
  // actuators. Differential lift changes its actual centre of pressure, not
  // an invented roll torque. Total projected wing area is unchanged.
  const singleAllocation=allocateParts(s,actual,desiredVertical-support,desiredRoll-leverRoll[windwardIndex]*support,desiredPitch-leverPitch[windwardIndex]*support);
  if(singleAllocation){wingRequests[leeKey]=singleAllocation.slice(0,2);wingRequests.rudder=[singleAllocation[2]];}
 }
 const armTargets={port:f.raisedSide===-1?c.foilUpAngle:0,starboard:f.raisedSide===1?c.foilUpAngle:0};
 for(const side of [-1,1]){const key=side<0?'port':'starboard',a=s.foils[key];a.targetArm=s.recovering?0:armTargets[key];const desiredRate=clamp((a.targetArm-a.arm)*1.6,-c.foilArmRate,c.foilArmRate),oldRate=a.armRate;a.armRate=move(a.armRate,desiredRate,c.foilArmAcceleration*dt);a.armAcceleration=(a.armRate-oldRate)/(dt||1);a.arm+=a.armRate*dt;if(a.arm<0||a.arm>c.foilUpAngle){a.arm=clamp(a.arm,0,c.foilUpAngle);a.armRate=0;}a.deployment=1-a.arm/c.foilUpAngle;}
 for(const key of ['port','starboard','rudder']){
  const a=s.foils[key],rudder=key==='rudder',limitLow=rudder?c.rudderFlapMin:c.foilFlapMin,limitHigh=rudder?c.rudderFlapMax:c.foilFlapMax,oldInner=a.flapInner??a.flap,oldOuter=a.flapOuter??a.flap;let sumFlap=0,sumRate=0,sumTarget=0,sumRequested=0;const targets=[];
  for(let i=0;i<a.parts.length;i++){
   const part=a.parts[i],direction=part.liftDirection,qArea=.5*c.waterDensity*part.speed**2*part.area*Math.max(.02,part.wet),nup=Math.abs(direction.z)>.12?direction.z:Math.sign(direction.z||1)*.12,loss=1-c.foilVentLoss*a.ventilation,requested=wingRequests[key][i],cl=clamp(requested/(Math.max(50,qArea)*nup*loss),-c.foilAttachedLimit,c.foilAttachedLimit),alpha=c.foilCLMax/c.foilLiftSlope*Math.atanh(cl/c.foilCLMax),target=clamp(alpha+part.flowAngle-(rudder?0:c.foilIncidence),limitLow,limitHigh),field=rudder?'flap':i===0?'flapInner':'flapOuter',old=a[field]??a.flap;
   a[field]=move(old,s.capsized||s.recovering?0:target,(rudder?c.rudderFlapRate:c.foilFlapRate)*dt);part.requestedVertical=requested;part.targetFlap=target;targets.push(target);sumFlap+=a[field]/a.parts.length;sumRate+=(a[field]-old)/(dt||1)/a.parts.length;sumTarget+=target/a.parts.length;sumRequested+=requested;
  }
  let differentialLimited=false;
  if(!rudder){
   // Preserve feasible net wing support before spending the remaining motor
   // rate on roll differential. Independent saturated +/− flap commands used
   // to freeze their mean while local roll flow removed the required lift.
   let capacityVertical=0,flowWeighted=0,flowWeight=0;for(const part of a.parts){const nz=Math.abs(part.liftDirection.z)>.12?part.liftDirection.z:Math.sign(part.liftDirection.z||1)*.12,q=.5*c.waterDensity*part.speed**2*part.area*Math.max(.02,part.wet)*(1-c.foilVentLoss*a.ventilation),w=q*Math.abs(nz);capacityVertical+=q*nz;flowWeighted+=part.flowAngle*w;flowWeight+=w;}
   const cl=clamp(sumRequested/(Math.sign(capacityVertical||1)*Math.max(50,Math.abs(capacityVertical))),-c.foilAttachedLimit,c.foilAttachedLimit),alpha=c.foilCLMax/c.foilLiftSlope*Math.atanh(cl/c.foilCLMax),rawMean=alpha+flowWeighted/(flowWeight||1)-c.foilIncidence,meanTarget=s.capsized||s.recovering?0:clamp(rawMean,limitLow,limitHigh),rawDifference=(targets[1]-targets[0])/2,maxDifference=Math.min(c.foilDifferentialMax,meanTarget-limitLow,limitHigh-meanTarget),differenceTarget=s.capsized||s.recovering?0:clamp(rawDifference,-maxDifference,maxDifference),oldMean=(oldInner+oldOuter)/2,oldDifference=(oldOuter-oldInner)/2,budget=c.foilFlapRate*dt;
   if(Math.abs(rawDifference)>c.foilDifferentialMax+.001){
    const average=move(oldMean,clamp(meanTarget,limitLow+Math.abs(oldDifference),limitHigh-Math.abs(oldDifference)),budget),remaining=Math.max(0,budget-Math.abs(average-oldMean)),difference=move(oldDifference,differenceTarget,remaining);
    a.flapInner=average-difference;a.flapOuter=average+difference;sumFlap=average;sumRate=(average-oldMean)/(dt||1);sumTarget=meanTarget;targets[0]=meanTarget-differenceTarget;targets[1]=meanTarget+differenceTarget;differentialLimited=true;
   }else{const average=(a.flapInner+a.flapOuter)/2,difference=clamp((a.flapOuter-a.flapInner)/2,-c.foilDifferentialMax,c.foilDifferentialMax);a.flapInner=average-difference;a.flapOuter=average+difference;sumFlap=average;}
  }
  a.targetFlapInner=targets[0];a.targetFlapOuter=targets[1]??targets[0];a.saturated=differentialLimited||targets.some(t=>t<=limitLow+.001||t>=limitHigh-.001);a.flap=sumFlap;a.flapRate=sumRate;a.targetFlap=sumTarget;a.requestedVertical=sumRequested;
 }
 f.commandedFoil=f.overlap>0?'both':canSingle?(f.leewardSide<0?'port':'starboard'):'both';f.heightError=targetHeight-hull.clearance;f.requestedVertical=desiredVertical;f.requestedRoll=desiredRoll;f.requestedPitch=desiredPitch;f.singleFoilCapacity=capacity;f.windwardDemand=windwardDemand;f.controllerSaturated=['port','starboard','rudder'].some(k=>s.foils[k].saturated||Math.abs(s.foils[k].targetFlap-s.foils[k].flap)>.02);
}
function equilibrium(s,env){const before=s.heave;let lo=-4,hi=5;for(let i=0;i<40;i++){s.heave=(lo+hi)/2;const h=hullLoads(s,env,massProperties(s),false);if(h.buoyancy>h.weight)lo=s.heave;else hi=s.heave;}s.heave=before;return(lo+hi)/2;}
function newFoil(){return{arm:0,armRate:0,armAcceleration:0,targetArm:0,deployment:1,flap:0,flapInner:0,flapOuter:0,flapRate:0,targetFlap:0,submergence:0,ventilation:0,wet:0,force:V(),localPoint:V(),alpha:0,speed:0};}
// Read-only presentation of the same force balance used by the integrator.
// Lift-off transfers support from displaced hull volume to dynamic foil lift;
// it does NOT reduce mass or move the centre of gravity by a phase switch.
// Fractions are force / weight (they need not sum to one while accelerating).
// Only the status WORD is held briefly to avoid flicker; modeBlend and all
// measurements remain continuous readings, never inputs to a force/control.
function supportTelemetry(s,hull,lift){
 const f=s.foiling,c=cfg(s),old=f.support,weight=hull.weight||c.mass*(s.massScale||1)*c.gravity,hullN=(hull.hulls||[]).reduce((n,h)=>n+h.buoyancy,0),aeroN=s.forces.aeroVertical??s.sail?.fz??0,raw=f.status,now=s.time||0;
 let phase=old?.phase||raw,pending=old?.pendingPhase||raw,since=old?.pendingSince??now;
 if(raw==='capsized'||raw==='recovering'||raw==='touchdown'){phase=raw;pending=raw;since=now;}
 else if(raw===phase){pending=raw;since=now;}
 else{if(raw!==pending){pending=raw;since=now;}if(now-since>=(raw==='lowLift'?.65:raw==='foiling'?.65:raw==='takeoff'?.8:.5)){phase=raw;since=now;}}
 const hullFraction=hullN/weight,foilFraction=lift/weight,release=(1-smooth(.015,.30,hull.hullWetFraction))*smooth(-.10,.28,hull.clearance),modeBlend=release*smooth(.20,.90,Math.max(0,foilFraction));
 f.support={phase,rawPhase:raw,pendingPhase:pending,pendingSince:since,hullFraction,foilFraction,aeroFraction:aeroN/weight,clearance:hull.clearance,hullWetFraction:hull.hullWetFraction,hullDragN:Math.abs(hull.hullF),foilDragN:s.forces.foilDrag??foilKeys(s).reduce((n,key)=>n+(s.foils[key].drag||0),0),modeBlend,netVerticalN:s.forces.vertical??hull.vertical+lift+aeroN,weightN:weight};
 return f.support;
}
function createState(overrides,inputEnv){
 const env=envFor(inputEnv),o=overrides||{},c=B.get(o.boatId||inputEnv?.boatId||'ac75'),theta=(90-env.direction)*D-90*D,a=P.axes(theta),sheet=.06,boom=P.boomLimit(sheet,c);
 const s={boatId:c.id,massScale:1,x:0,y:0,vx:0,vy:0,theta,omega:0,heel:0,heelRate:0,pitch:0,pitchRate:0,heave:0,heaveVelocity:0,rudder:0,sheet,boom,boomRate:0,crewPose:env.crewPose??2,crewPoseBlend:env.crewPose??2,crewSide:-1,crewSideBlend:-1,crewTackFrom:0,crewSwim:0,crew:0,crewCG:V(-4.75,1.65,0),crewJoints:null,time:0,capsized:false,recovering:false,recovery:0,cockpitWet:0,seaState:P.seaTarget(env),gybeTarget:0,gybeCount:0,tackCount:0,lastTackSide:0,waterX:0,waterY:0,forces:{},foils:Object.fromEntries((isCat(c)?['port','starboard','rudderPort','rudderStarboard']:['port','starboard','rudder']).map(k=>[k,newFoil()])),wing:{angle:boom,flap:0,load:0,stall:0},foiling:{status:'displacement',clearance:0,hullWetFraction:1,liftFraction:0,targetHeight:c.flightHeight,activeFoil:'both',leewardSide:1,windwardSide:-1,autopilot:true,overlap:c.foilOverlapSeconds,slamSeverity:0},...o};
 const wind=P.windForState(s,env);
 if(o.crewSide==null)s.crewSide=P.windwardCrewSide(wind)||s.crewSide;
 if(o.crewSideBlend==null)s.crewSideBlend=s.crewSide;
 P.advanceWaveProfile(s,env);P.updateCrew(s,{crewPose:s.crewPose},{...env,autoBalance:false},0,{wind});
 if(o.heave==null)s.heave=equilibrium(s,env);
 if(o.boom==null){
  const angle=wind.awa;
  const side=angle!=null&&Math.abs(Math.sin(angle))>.08?-Math.sign(angle):1;
  s.boom=side*P.boomLimit(s.sheet,c);
 }
 updateReef(s,c,undefined,0);refresh(s,env);s.hydro=hullLoads(s,env,massProperties(s),false);s.massMotion=null;foilLoads(s,env);updateStatus(s,s.hydro);return s;
}
function updateStatus(s,hull){
 const f=s.foiling,c=cfg(s),lift=foilKeys(s).reduce((sum,key)=>sum+s.foils[key].force.z,0),weight=c.mass*(s.massScale||1)*c.gravity,oldStatus=f.status;
 f.hulls=hull.hulls;f.clearance=hull.clearance;f.hullWetFraction=hull.hullWetFraction;f.liftFraction=lift/weight;f.slamSeverity=hull.slamSeverity||0;
 const supported=hull.hullWetFraction<.015&&hull.clearance>.08&&f.liftFraction>.55,lowLift=hull.clearance>.08&&hull.hullWetFraction<.12&&(f.liftFraction<.65||s.heaveVelocity<-.5),accelerating=(s.forces.forward||0)>c.mass*.035;
 f.status=s.recovering?'recovering':s.capsized?'capsized':hull.slamSeverity>.20?'touchdown':lowLift?'lowLift':supported?'foiling':f.liftFraction>.30&&hull.hullWetFraction<.70?'takeoff':accelerating?'accelerating':'waterborne';
 const loaded=['port','starboard'].filter(k=>s.foils[k].wet>.10&&s.foils[k].vertical>weight*.10);f.activeFoil=loaded.length===2?'both':loaded[0]||'none';f.swapping=['port','starboard'].some(k=>{const a=s.foils[k];return a.arm>.07&&a.arm<c.foilUpAngle-.07&&Math.abs(a.armRate)>.02;});f.jibAngle=s.sail?.jib?.angle||0;
 supportTelemetry(s,hull,lift);
}
function refresh(s,env){s.sail=aero(s,env);s.wind=s.sail.wind;s.speed=Math.hypot(s.vx,s.vy);if(cfg(s).rigidWing){s.wing=s.wing||{flap:0};s.wing.angle=s.boom;s.wing.load=s.sail.load;s.wing.stall=s.sail.stall;}return s;}
function loads(s,env){const m=massProperties(s),hull=hullLoads(s,env,m),sail=aero(s,env),water=foilLoads(s,env),air=airHullLoads(s,env),total=accumulator();combine(total,hull);combine(total,sail.accumulator);combine(total,water);combine(total,air);return{...total,mass:m,hull,sail,foils:water,air};}
function updateRigidWing(s,c,dt,rescuing){
 const wing=s.wing||(s.wing={angle:s.boom,flap:0});
 const side=Math.sign(s.boom||s.foiling.leewardSide);
 const target=rescuing?0:-side*c.wingFlapMax*(.25+.75*s.sheet);
 wing.flap=move(wing.flap,target,c.wingFlapRate*dt);
 const jibTarget=s.boom*.78+1.2*D*Math.tanh(s.boom/(2*D));
 wing.jibAngle=move(wing.jibAngle??jibTarget,jibTarget,30*D*dt);
 const twist=(1-s.sheet)*5*D;
 wing.twist=move(wing.twist??0,twist,5*D*dt);
}
function advance(s,controls,env,h){
 const c=cfg(s),rescueActive=!!root.SailingRecovery?.active(s),ctrl=rescueActive?{steer:0,trim:0,crewPose:1,crew:0}:controls||{};s.time+=h;P.advanceWaveProfile(s,env);s.seaState+=(P.seaTarget(env)-s.seaState)*(1-Math.exp(-h/c.seaTimeConstant));s.seaStateRate=(P.seaTarget(env)-s.seaState)/c.seaTimeConstant;// Foil boats use the same keyboard response; the rig retains its own dynamics.
 P.updateSheet(s,c,ctrl,env,h);
 if(rescueActive){s.rudder=move(s.rudder,0,h*c.rudderCenterRate);s.helmTarget=0;}else P.updateHelm(s,ctrl,env,h);
 P.updateCrew(s,ctrl,env,h);
 if(c.rigidWing)updateRigidWing(s,c,h,rescueActive);
 const easy=(ctrl.difficulty??env.difficulty)==='easy',lively=!easy&&!rescueActive&&!s.capsized;
 P.updateRig(s,c,h,lively);updateReef(s,c,ctrl.rig?.reef,h);
 let sail=aero(s,env);
 const boom=P.updateBoom(s,c,sail,env,h,lively);
 sail=aero(s,env);let m=massProperties(s),hull=hullLoads(s,env,m),water=foilLoads(s,env,h);autoFoils(s,ctrl,env,h,m,hull,sail,water);m=massProperties(s);water=foilLoads(s,env);
 const gravityAtCg=P.bodyOffset(s,m.cg),gravityRoll=-hull.weight*gravityAtCg.dHeel,gravityPitch=-hull.weight*gravityAtCg.dPitch;
 hull.roll+=gravityRoll-hull.rollGravity;hull.pitch+=gravityPitch-hull.pitchGravity;
 hull.rollGravity=gravityRoll;hull.pitchGravity=gravityPitch;
 const air=airHullLoads(s,env),total=accumulator();combine(total,hull);combine(total,sail.accumulator);combine(total,water);combine(total,air);
 const ground=root.SailingWorld?.contact(s,c,env)||{fx:0,fy:0,fz:0,yaw:0,roll:0,pitch:0,contact:false,depth:80,distance:Infinity};s.ground=ground;total.force.x+=ground.fx;total.force.y+=ground.fy;total.force.z+=ground.fz;total.roll+=ground.roll;total.pitch+=ground.pitch;total.yaw+=ground.yaw;
 // The arm actuator is internal. Its mass transfer is in integrateMass.
 const reaction=accumulator();
 const physicalYaw=total.yaw,rollPhysical=total.roll,pitchPhysical=total.pitch;
 const rescue=root.SailingRecovery?.forces(s,env,{roll:m.inertiaRoll,pitch:m.inertiaPitch,yaw:m.inertiaYaw,mass:m.mass,physicalRoll:rollPhysical,physicalPitch:pitchPhysical,physicalYaw,physicalFz:total.force.z})||{roll:0,pitch:0,yaw:0,fx:0,fy:0,fz:0},recoveryRoll=rescue.roll,recoveryPitch=rescue.pitch;
 total.roll+=rescue.roll;total.pitch+=rescue.pitch;total.yaw+=rescue.yaw+boom.reaction;total.force.x+=rescue.fx;total.force.y+=rescue.fy;total.force.z+=rescue.fz;
 if(s.foiling.controller)Object.assign(s.foiling.controller,{actualFoilVertical:water.vertical,actualFoilRoll:water.roll,actualFoilPitch:water.pitch,actualRollAcceleration:total.roll/m.inertiaRoll,actualPitchAcceleration:total.pitch/m.inertiaPitch,actualVerticalAcceleration:total.force.z/m.mass,hullDamping:{...hull.rotationalDamping},hullContactFraction:hull.hullWetFraction});
 P.integrateMass(s,h,m.mass,m.cg,{roll:m.inertiaRoll,pitch:m.inertiaPitch,yaw:m.inertiaYaw},total.force,total);
 s.cockpitWet+=(smooth(.03,-.10,hull.coamingClearance)-s.cockpitWet)*(1-Math.exp(-h/(hull.coamingClearance<0?c.floodFillSeconds:c.floodDrainSeconds)));
 if(Math.abs(wrap(s.heel))>c.capsizeAngle||Math.abs(wrap(s.pitch))>65*D)s.capsized=true;
 const ax=P.axes(s.theta);s.hydro={...hull,weight:m.mass*c.gravity,cg:m.cg};s.forces={forward:total.force.x*ax.fx+total.force.y*ax.fy,side:total.force.x*ax.rx+total.force.y*ax.ry,world:total.force,vertical:total.force.z,aeroVertical:sail.fz,roll:total.roll,pitch:total.pitch,yaw:total.yaw,yawAssist:0,yawPhysical:physicalYaw,yawRecovery:rescue.yaw,rollPhysical,pitchPhysical,recoveryVertical:rescue.fz,recoveryDrag:{x:rescue.fx,y:rescue.fy},yawRudder:water.rudderYaw,ground,rollSail:sail.rollMoment,rollHull:hull.roll,rollHydro:water.roll,rollCrew:0,rollDamping:hull.rotationalDamping?.roll||0,pitchDamping:hull.rotationalDamping?.pitch||0,yawDamping:hull.rotationalDamping?.yaw||0,buoyancy:hull.buoyancy,weight:m.mass*c.gravity,hullF:hull.hullF,hullR:hull.hullR,foilVertical:water.vertical,foilDrag:water.foilDrag,inertiaRoll:m.inertiaRoll,inertiaPitch:m.inertiaPitch,inertiaYaw:m.inertiaYaw,armReaction:reaction.force,armReactionRoll:reaction.roll,recoveryRoll,recoveryPitch,boomTorque:boom.torque,boomReaction:boom.reaction,mass:m.mass,board:{forward:0,side:0},rudder:s.foils.rudder||s.foils.rudderPort};
 if(env.forceDiagnostics){
  const report=(a,weight=0)=>({force:{...a.force,z:a.force.z+weight},moment:{roll:a.roll-(weight?hull.rollGravity:0),pitch:a.pitch-(weight?hull.pitchGravity:0),yaw:a.yaw}});
  s.forces.ledger={sail:report(sail.accumulator),hull:report(hull,hull.weight),foils:report(water),airDrag:report(air),
   gravity:{force:V(0,0,-hull.weight),moment:{roll:hull.rollGravity,pitch:hull.pitchGravity,yaw:0}},
   ground:{force:V(ground.fx,ground.fy,ground.fz),moment:{roll:ground.roll,pitch:ground.pitch,yaw:ground.yaw}},
   boom:{force:V(),moment:{roll:0,pitch:0,yaw:boom.reaction}},
   assist:{force:V(rescue.fx,rescue.fy,rescue.fz),moment:{roll:rescue.roll,pitch:rescue.pitch,yaw:rescue.yaw}}};
 }
 root.SailingRecovery?.postStep(s,env);if(root.SailingRecovery?.active(s)&&s.recoveryState.fallback){hull=hullLoads(s,env,massProperties(s),false);s.hydro=hull;foilLoads(s,env);}updateStatus(s,hull);refresh(s,env);
}
function step(s,controls,inputEnv,dt){const env=envFor(inputEnv),h=dt==null?1/60:clamp(dt,0,.05);if(!h)return s;const count=Math.ceil(h/(1/240)-1e-9),sub=h/count;for(let i=0;i<count;i++)advance(s,controls||{},env,sub);return s;}
function recover(s,env,nowMs){const R=root.SailingRecovery;if(!R)throw Error('Opretningsmodellen er ikke indlæst.');R.start(s,env,nowMs);return s;}
root.FoilingPhysics={foilKeys,foilCoefficients,foilElement,foilPose,foilWingDrop,groundingPoints,massProperties,bodyVector,bodyPoint,pointVelocity,angularVelocity,aero,hullLoads,foilLoads,loads,createState,step,refresh,recover,updateStatus,supportTelemetry,equilibrium,flightCommands};

});
