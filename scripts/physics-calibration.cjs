'use strict';
// Controlled force-integrated comparisons, not measured or equilibrium polars.
const fs=require('node:fs');const path=require('node:path');const {pathToFileURL}=require('node:url');const {chromium}=require('@playwright/test');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
 const page=await browser.newPage();
 try{
 const response=await page.goto(process.env.FRI_VIND_URL||pathToFileURL(path.resolve('index.html')).href);await page.waitForFunction(()=>window.SAILING_GAME);
 const revision=await response.headerValue('x-fri-vind-revision');
 const profiles=await page.evaluate(()=>Object.keys(SailingBoats.CONFIGS).map(id=>{
  const P=SailPhysics,B=SailingBoats,c=P.configFor(id);
  const env={...P.DEFAULT_ENV,boatId:id,sea:'calm',waves:0,speed:0,gusts:0,shelter:false};
  const state=P.createState({boatId:id,x:0,y:-5000,vx:0,vy:0,theta:0},env);
  const {hydro:h}=state,foiler=c.kind==='foiler',mass=foiler?FoilingPhysics.massProperties(state):null;
  const columns=Array.from({length:401},(_,i)=>{
   const x=c.hullSections[0][0]+(c.hullSections.at(-1)[0]-c.hullSections[0][0])*i/400;
   const draft=-state.heave-B.hullBottom(c,x,0);
   let low=0,high=draft>0?B.halfBeamAt(c,x):0;
   for(let j=0;j<16;j++){
    const mid=(low+high)*.5;
    if(state.heave+B.hullBottom(c,x,mid)<0)low=mid;else high=mid;
   }
   return {x,draft,wetHalfBeam:low};
  });
  const wetted=columns.filter(sample=>sample.draft>0),perSide=18;
  function sectionPoint(column,i){
   const z=column.wetHalfBeam*i/perSide;
   return {x:column.x,y:Math.min(0,state.heave+B.hullBottom(c,column.x,z)),z};
  }
  function triangleArea(a,b,d){
   const x=b.x-a.x,y=b.y-a.y,z=b.z-a.z,u=d.x-a.x,v=d.y-a.y,w=d.z-a.z;
   return .5*Math.hypot(y*w-z*v,z*u-x*w,x*v-y*u);
  }
  let wettedHullArea=0;
  for(let i=1;i<columns.length;i++)for(let j=1;j<=perSide;j++){
   const a=sectionPoint(columns[i-1],j-1),b=sectionPoint(columns[i-1],j),
    d=sectionPoint(columns[i],j-1),e=sectionPoint(columns[i],j);
   wettedHullArea+=triangleArea(a,b,d)+triangleArea(b,d,e);
  }
  wettedHullArea*=2*(c.hullOffsets?.length||1);
  const appendages=foiler?FoilingPhysics.foilKeys(state).map(key=>{
   const p=FoilingPhysics.foilPose(state,key);
   return {id:key,area:p.area,span:p.span,centre:p.wingCentre,hinge:p.hinge,immersion:Math.max(0,-P.bodyPoint(state,p.wingCentre).z)};
  }):[{id:c.kind==='keelboat'?'keel':'board',area:c.daggerArea,x:c.daggerX,tipDepth:Math.max(0,-state.heave+c.daggerDepth-c.deckY)},
   ...(c.rudderOffsets||[0]).map(z=>({id:'rudder',area:c.rudderArea/(c.rudderOffsets?.length||1),x:c.rudderX,z,tipDepth:Math.max(0,-state.heave+c.rudderDepth-c.deckY)}))];
  const crew=state.crewJoints?.segments||state.crewStations;
  const inertia=mass?{roll:mass.inertiaRoll,pitch:mass.inertiaPitch,yaw:mass.inertiaYaw}:{
   roll:c.rollInertia+crew.reduce((sum,point)=>sum+point.mass*(point.p.y**2+point.p.z**2),0),
   pitch:c.pitchInertia+crew.reduce((sum,point)=>sum+point.mass*(point.p.x**2+point.p.y**2),0),
   yaw:c.yawInertia+crew.reduce((sum,point)=>sum+point.mass*(point.p.x**2+point.p.z**2),0)
  };
  return {id,name:c.name,loadCondition:{crewPose:state.crewPose,heave:state.heave,weight:h.weight,buoyancy:h.buoyancy,
   submergedHullVolume:h.submergedVolume,totalDisplacedVolume:h.totalDisplacedVolume,waterlineLength:wetted.length?wetted.at(-1).x-wetted[0].x:0,
   hullDraft:Math.max(0,...columns.map(column=>column.draft)),wettedHullArea,
   cg:h.cg,inertia,appendages,crew},calibration:c};
 }));
 const folder='gennemgang/fysik';
 fs.mkdirSync(folder,{recursive:true});
 fs.writeFileSync(path.join(folder,'baadprofiler.json'),JSON.stringify({revision,units:'SI, vinkler i radianer',profiles},null,2)+'\n');
 if(process.argv.includes('--profiles'))return;
 const result={description:'45 simulerede sekunder pr. punkt. Ro på vandet, ingen vindpust; kursholdning med rorhjælp. Fart er gennemsnit af sidste 10 sekunder og ikke nødvendigvis ligevægt.',wind:[2,4,6,8,10],angles:[45,90,135,175],initialSheet:{laser:0.35,dinghy:0.35,yacht:0.35,ac75:0.06,ac72:0.06},sailConfiguration:'standard storsejl og fok hvor relevant; ingen ekstra forsejl',boats:[]};
 for(const id of ['laser','dinghy','yacht','ac75','ac72']){
  const boat=await page.evaluate(id=>{const B=SailingBoats,P=SailPhysics,c=B.get(id),base={...P.DEFAULT_ENV,boatId:id,direction:0,waves:0,gusts:0,autoBalance:true},rows=[];
   for(const speed of [2,4,6,8,10])for(const angle of [45,90,135,175]){
    const e={...base,speed},theta=(90-angle)*Math.PI/180,s=P.createState({boatId:id,x:0,y:-5000,theta,vx:0,vy:0},e);let sum=0,heel=0,leeway=0,maxLift=0,maxPlaning=0,n=0;
    for(let k=0;k<2700;k++){const error=P.wrap(theta-s.theta),control={steer:Math.max(-1,Math.min(1,-error*2.2+s.omega*1.5)),trim:0,crewPose:2};P.step(s,control,e,1/60);if(k>=2100){sum+=Math.hypot(s.vx,s.vy);heel+=Math.abs(s.heel);leeway+=Math.abs(P.instruments(s).leeway||0);n++;}maxLift=Math.max(maxLift,s.foiling?.liftFraction||0);maxPlaning=Math.max(maxPlaning,(s.forces?.planingLift||0)/(c.mass*c.gravity));}
    rows.push({wind:speed,angle,speed:sum/n,heelDegrees:heel/n*180/Math.PI,leewayDegrees:leeway/n*180/Math.PI,finalHeadingErrorDegrees:P.wrap(s.theta-theta)*180/Math.PI,capsized:s.capsized,liftFractionMax:maxLift,planingFractionMax:maxPlaning,finite:[s.x,s.y,s.heel,s.vx,s.vy].every(Number.isFinite)});
   }
   const e={...base,speed:0},s=P.createState({boatId:id,x:0,y:-5000,vx:0,vy:0},e),h=c.kind==='foiler'?FoilingPhysics.hullLoads(s,e,FoilingPhysics.massProperties(s),false):P.hydrostatics(s,e,false);
   return {id,name:c.name,length:c.length,beam:c.beam,mass:c.mass,hull:c.hullMass,rig:c.rigMass,equipment:c.equipmentMass,ballast:c.ballastMass||0,arms:2*(c.armMass||0),crew:c.crewMass,sailArea:c.sailArea,mainArea:c.mainArea||c.sailArea,jibArea:c.jibArea||0,buoyancy:h.buoyancy,weight:c.mass*c.gravity,rows};
  },id);result.boats.push(boat);console.log(id,boat.rows.filter(x=>!x.finite).length,'non-finite',boat.rows.filter(x=>Math.abs(x.finalHeadingErrorDegrees)>20).length,'store kursafvigelser');
 }
 fs.writeFileSync(path.join(folder,'kalibrering.json'),JSON.stringify({...result,revision},null,2)+'\n');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1});
