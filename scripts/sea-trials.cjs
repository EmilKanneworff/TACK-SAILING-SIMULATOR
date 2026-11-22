'use strict';

const {writeFile}=require('node:fs/promises');
const {createHash}=require('node:crypto');
const {execFileSync}=require('node:child_process');
const {chromium}=require('@playwright/test');

function voyage({boatId,kind,wind,angle,dt=1/60,extra,sheetSetting,crewSetting}){
 const P=globalThis.SailPhysics,B=globalThis.SailingBoats,D=P.DEG,c=B.get(boatId),seed=318031;
 const managed=kind==='beam-managed',surfing=kind.startsWith('surf'),steady=kind==='steady'||kind==='reference';
 const windFrom=surfing?270:0,heading=(90-windFrom-angle)*D;
 const sheets={laser:[.75,.59,.39,.20],dinghy:[.78,.64,.47,.28],yacht:[.82,.65,.49,.29],ac75:[.67,.55,.48,.43],ac72:[.71,.57,.49,.43]};
 const point=Math.abs(angle)<62?0:Math.abs(angle)<110?1:Math.abs(angle)<149?2:3;
 const sheet=sheetSetting??(managed?.30:extra?B.cruiserSails[extra].sheet:(kind==='foil'?.55:surfing?.13:sheets[boatId][point]));
 const pose=crewSetting??(managed?1:boatId==='laser'?(surfing?2:wind>=7&&point<2?3:point<3?2:1):boatId==='dinghy'?3:2);
 const env={...P.DEFAULT_ENV,boatId,difficulty:'hard',speed:wind,direction:windFrom,waves:0,gusts:0,
  windSeed:seed,ironsHelp:false,shelter:false,crewPose:pose,autoRecovery:false,forceDiagnostics:true};
 if(kind==='swell'||kind==='foil'||surfing){
  delete env.waves;
  Object.assign(env,{waveHeight:surfing?(kind==='surf-flat'?0:1.35):kind==='foil'?.72:.50,chop:surfing?0:.22});
 }
 const initial={boatId,x:0,y:-13000,theta:heading,sheet,crewPose:pose,crewPoseBlend:pose,crewSide:-Math.sign(angle),crewSideBlend:-Math.sign(angle)};
 const startSpeed=steady||managed||kind==='foil'||kind==='calm'?0:kind==='tack'?3.1:surfing?4.25:2.3;
 initial.vx=startSpeed*Math.cos(heading);initial.vy=startSpeed*Math.sin(heading);
 if(surfing){
  Object.assign(env,{wavePeriod:3.85,waveComponent:0});
  const w=P.WAVE_COMPONENTS[0];initial.x=((kind==='surf-back'?.7:4.4)-w.phase)*P.waveProfileFor(env).period**2/w.k;
 }
 if(kind==='capsize'){initial.vx=initial.vy=0;initial.heel=(boatId==='yacht'?85:78)*D;initial.heelRate=.12;}
 if(kind==='calm'){initial.vx=.85;initial.vy=.25;initial.heel=0;initial.crewPose=initial.crewPoseBlend=1;initial.crewSide=initial.crewSideBlend=0;}
 const state=P.createState(initial,env),duration=steady?180:kind==='foil'?65:surfing?5:kind==='capsize'?12:kind==='calm'?22:36;
 const samples=[],window=[];
 const clamp=P.clamp,wrap=P.wrap;
 function snapshot(controls){
  const s=state,f=s.forces,h=s.hydro,i=P.instruments(s,null,env),a=P.axes(s.theta);
  const wave=P.waveAt(s.x,s.y,s.time,{...env,waveCurrent:s.seaState,waveProfile:s.waveProfile});
  const head=s.crewJoints?.head;
  return {t:s.time,x:s.x,y:s.y,speed:i.waterSpeed,ground:i.speed,heel:s.heel/D,pitch:s.pitch/D,heave:s.heave,
   heading:i.heading,twa:i.twa==null?null:i.twa/D,awa:i.awa==null?null:i.awa/D,wind:i.tws,leeway:i.leeway==null?null:i.leeway/D,
   yawRate:s.omega/D,headingError:wrap(s.theta-controls.heading)/D,steer:controls.steer,rudder:s.rudder/D,helmAssist:f.yawAssist??s.steering?.assistedMoment??0,
   sheet:s.sheet,seil:{main:s.sail.main?.area??null,jib:s.sail.jib?.area??0,extra:s.sail.spinnaker?.area??0,
    mainDrive:s.sail.main?.drive??null,jibDrive:s.sail.jib?.drive??0,extraDrive:s.sail.spinnaker?.drive??0},
   boom:s.boom/D,crewPose:s.crewPoseBlend,crewSide:s.crewSideBlend,crewCG:s.crewCG,
   boomClearance:boatId==='laser'&&head?B.boomDistance(c,s.boom,head):null,cg:h?.cg,
   drive:s.sail.drive,sideForce:s.sail.sideForce,rollSail:s.sail.rollMoment,rollCrew:f.rollCrew??null,
   hullDrag:f.hullF??null,boardSide:f.board?.side??null,rudderSide:f.rudder?.side??null,
   buoyancy:h?.buoyancy??null,weight:h?.weight??null,planingLift:f.planingLift??null,
   waveForce:h?.waveFx==null?null:h.waveFx*a.fx+h.waveFy*a.fy,waveHeight:wave.height,waveSlope:wave.dx*a.fx+wave.dy*a.fy,
   foilLift:f.foilVertical??s.foiling?.controller?.actualFoilVertical??null,clearance:s.foiling?.clearance??null,
   liftFraction:s.foiling?.liftFraction??null,foilPhase:s.foiling?.support?.phase??null,hullWet:s.foiling?.hullWetFraction??null,
   forces:f.ledger??null,capsized:s.capsized};
 }
 const fields=['speed','ground','heel','pitch','leeway','yawRate','headingError','rudder','helmAssist','drive','rollSail','rollCrew','hullDrag','buoyancy','planingLift','clearance','liftFraction'];
 function stats(rows){
  const result={};
  for(const key of fields){
   const xs=rows.map(r=>r[key]).filter(Number.isFinite);
   if(!xs.length)continue;
   const mean=xs.reduce((total,x)=>total+x,0)/xs.length;
   result[key]={mean,sd:Math.sqrt(xs.reduce((total,x)=>total+(x-mean)**2,0)/xs.length)};
  }
  return result;
 }
 let status='timeout',lastControl={heading,steer:0},managedHike=false,tackCrossed=false;
 const stride=Math.round(.25/dt);
 for(let k=0;k<Math.round(duration/dt);k++){
  const t=k*dt;
  const tack=kind==='tack'&&t>=8;
  const startingSide=initial.crewSide;
  if(tack&&state.wind.twa*startingSide<-3*D)tackCrossed=true;
  const crewSide=tackCrossed?-startingSide:startingSide;
  if(managed&&state.speed>2.6)managedHike=true;
  const desiredHeading=tack?(90+angle)*D:kind==='foil'&&t>=24&&t<36?heading+18*D:heading;
  let crewPose=managed?(managedHike?3:1):kind==='calm'?1:kind==='trapeze'&&t<12?2:kind==='puff'&&t>=12?2:pose;
  if(tack)crewPose=tackCrossed&&state.crewSideBlend*crewSide>=.95?2:1;
  const trim=managed&&managedHike?.61:kind==='puff'&&t>=9.25&&t<13.5?.30:kind==='puff'&&t>=13.5?.48:kind==='foil'&&t>=36?.05:sheet;
  if(kind.startsWith('puff'))env.speed=wind+4*Math.max(0,Math.min(1,(t-8)*2,(12-t)*2));
  if(kind==='foil'&&t>=36)env.speed=Math.max(0,wind-(t-36)*4);
  const steer=kind==='calm'||kind==='capsize'?0:clamp(-2.1*wrap(desiredHeading-state.theta)+1.12*state.omega,-.80,.80);
  lastControl={heading:desiredHeading,steer,steerDigital:false,crewPose,trim:kind==='calm'?0:clamp((trim-state.sheet)*6,-1,1),trimFast:true,
   ...(kind==='tack'?{crew:crewSide}:{}),...(extra?{spinnaker:true,downwindType:extra}:{}),...(kind==='reef'&&t>=14?{reef:1,headsail:1}:{})};
  P.step(state,lastControl,env,dt);
  if(![state.x,state.y,state.vx,state.vy,state.heave,state.heel,state.theta].every(Number.isFinite)){status='invalid';break;}
  if(state.capsized&&kind!=='capsize'){status='capsize';break;}
  if((k+1)%stride)continue;
  const row=snapshot(lastControl);window.push(row);if(!steady)samples.push(row);
  if(window.length>64)window.shift();
  if(steady&&t>=24&&window.length===64&&(k+1)%(stride*4)===0){
   const early=stats(window.slice(0,32)),recent=stats(window.slice(32));
   const change=key=>Math.abs((early[key]?.mean??0)-(recent[key]?.mean??0));
   if(recent.speed.mean>.32&&change('speed')<.12&&recent.speed.sd<.18&&change('heel')<2&&recent.heel.sd<2.5&&
     change('leeway')<2&&(recent.leeway?.sd??0)<3&&recent.yawRate.sd<2&&Math.abs(recent.yawRate.mean)<.8&&
     Math.abs(recent.headingError.mean)<7&&recent.headingError.sd<3){status='steady';break;}
  }
 }
 if(status==='timeout'&&!steady)status='completed';
 if(status==='timeout'&&steady){const tail=stats(window.slice(-32));if(tail.headingError?.sd>3||tail.heel?.sd>2.5||tail.yawRate?.sd>2)status='oscillating';}
 return {boatId,kind,status,waterDensity:c.waterDensity,condition:{wind,windFrom,angle,seed,dt,crewPose:pose,crewMass:c.crewMass,mass:c.mass,
  waveHeight:env.waveHeight??0,chop:env.chop??0,gusts:env.gusts,currentX:0,currentY:0,shelter:env.shelter,assistance:'hard',sheet,extra},
  initial,elapsed:state.time,statistics:stats(window.slice(-32)),end:snapshot(lastControl),...(samples.length?{samples}:{})};
}

async function run(){
 const args=process.argv.slice(2),output=args.find(a=>a.startsWith('--out='))?.slice(6)??'gennemgang/fysik/kalibrering.json';
 const base=args.find(a=>a.startsWith('--url='))?.slice(6)??'http://localhost:4173/';
 const single=args.find(a=>a.startsWith('--boat='))?.slice(7),only=args.find(a=>a.startsWith('--kind='))?.slice(7);
 const boats=(single?[single]:['laser','dinghy','yacht','ac75','ac72']);
 const suite=[];
 for(const boatId of boats){
  for(const wind of [4,7,9])for(const angle of [50,90,130,165])for(const side of [-1,1]){
   if(args.includes('--quick')&&(wind!==7||side<0))continue;
   suite.push({boatId,kind:'steady',wind,angle:angle*side});
  }
  suite.push({boatId,kind:'calm',wind:0,angle:90},{boatId,kind:'capsize',wind:0,angle:90});
  if(boatId==='laser'){
   for(const [knots,sheetSetting] of [[9,.825],[12,.78]])suite.push({boatId,kind:'reference',wind:knots*1852/3600,angle:50,sheetSetting});
   for(const angle of [-90,90])suite.push({boatId,kind:'beam-managed',wind:9,angle});
   for(const wind of [8,9])for(const angle of [-49,49])suite.push({boatId,kind:'tack',wind,angle});
   for(const angle of [52,90,160])suite.push({boatId,kind:'swell',wind:7,angle});
   suite.push({boatId,kind:'puff',wind:8,angle:95},{boatId,kind:'puff-fixed',wind:8,angle:95});
   for(const kind of ['surf','surf-flat','surf-back'])suite.push({boatId,kind,wind:14,angle:165});
  }
  if(boatId==='dinghy')suite.push({boatId,kind:'trapeze',wind:8,angle:90});
  if(boatId==='yacht'){
   suite.push({boatId,kind:'reef',wind:8,angle:90},{boatId,kind:'tack',wind:6,angle:50});
   for(const [extra,angle] of [['code0',90],['gennaker',125],['spinnaker',162]])suite.push({boatId,kind:'steady',wind:7,angle,extra});
  }
  if(boatId==='ac75'||boatId==='ac72')suite.push({boatId,kind:'foil',wind:16,angle:112});
 }
 const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',args:['--enable-unsafe-swiftshader']});
 try{
  const page=await browser.newPage();
  const response=await page.goto(base);
  await page.waitForFunction(()=>!!window.SailPhysics&&!!window.SAILING_GAME);
  const profiles=await page.evaluate(()=>SailingBoats.LIST.map(c=>{
   const P=SailPhysics,e={...P.DEFAULT_ENV,boatId:c.id,speed:0,waves:0,gusts:0,shelter:false};
   const s=P.createState({x:0,y:-13000,vx:0,vy:0,theta:0,crewPose:1,crewPoseBlend:1,crewSide:0,crewSideBlend:0},e);
   const h=s.hydro,heave=s.heave,sections=Array.from({length:501},(_,i)=>c.hullSections[0][0]+i*(c.hullSections.at(-1)[0]-c.hullSections[0][0])/500);
   const wet=sections.filter(x=>s.heave+SailingBoats.hullBottom(c,x,0)<0);
   P.step(s,{crewPose:1},e,1/60);
   return {id:c.id,config:c,loadedMass:h.weight/c.gravity,cg:h.cg,buoyancy:h.buoyancy,waterline:wet.at(-1)-wet[0],
    equilibriumHeave:heave,buoyancyCentre:h.centerOfBuoyancy??null,inertia:[s.forces.inertiaRoll,s.forces.inertiaPitch,s.forces.inertiaYaw],
    crewCG:s.crewCG,crewmembers:s.crewJoints?.members?.length??c.crewStations?.length??1};
  }));
  const configHash=createHash('sha256').update(JSON.stringify(profiles.map(p=>p.config))).digest('hex').slice(0,16);
  const result={schema:1,revision:await response?.headerValue('x-fri-vind-revision')??args.find(a=>a.startsWith('--revision='))?.slice(11)??null,baseCommit:execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim(),configHash,
   units:{speed:'m/s',angles:'deg',mass:'kg',force:'N',moment:'Nm',time:'s',position:'m'},
   sampling:{interval:.25,windows:[8,8],maxSeconds:180,criterion:'2 successive 8s windows; speed delta < .12 m/s; speed sd < .18 m/s; heel delta < 2 deg, sd < 2.5 deg; leeway delta < 2 deg, sd < 3 deg; mean yaw < .8 deg/s, yaw sd < 2 deg/s; mean heading error < 7 deg, sd < 3 deg'},
   profiles,runs:[]};
  for(const scenario of suite.filter(v=>!only||v.kind===only)){
   const row=await page.evaluate(voyage,scenario);
   result.runs.push(row);
   console.log(row.boatId,row.kind,row.condition.wind,row.condition.angle,row.status,row.elapsed.toFixed(1),row.end.speed.toFixed(2));
  }
  const number=(key,value)=>typeof value==='number'&&Number.isFinite(value)?Number(value.toFixed(6)):value;
  const {runs,profiles:activeProfiles,...metadata}=result;
  await writeFile(output,JSON.stringify(metadata,number,2).slice(0,-2)+',\n  "profiles": [\n    '+
   activeProfiles.map(row=>JSON.stringify(row,number)).join(',\n    ')+
   '\n  ],\n  "runs": [\n    '+runs.map(row=>JSON.stringify(row,number)).join(',\n    ')+'\n  ]\n}\n');
 }finally{await browser.close();}
}

if(require.main===module)run().catch(error=>{console.error(error);process.exitCode=1;});
module.exports={voyage};
