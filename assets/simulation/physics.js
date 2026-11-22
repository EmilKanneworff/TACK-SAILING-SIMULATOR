/* FRI VIND / deterministic coupled dinghy and keel-yacht model, SI and radians.
 * World x=east,y=north,z=UP. Body x=forward,y=UP,z=starboard.
 * Body orientation is Rz(pitch)*Rx(heel), then heading Ry(theta) in Three.
 * Positive heel lowers starboard; positive pitch lifts bow.
 * Buoyancy is quadrature of submerged sealed hull volume, using the exact
 * shared hull shape and same waveAt as the ocean. Heave/pitch/roll have
 * inertia; gravity of hull, rig, gear and articulated sailor is counted once.
 * Empirical drag/added inertia, strip aerodynamics and recovery assistance
 * are transparent GAME approximations, not validated ILCA performance data.
 */
(function(install){
 if(typeof module!=='undefined'&&module.exports)module.exports=install;
 else install(globalThis);
})(function(root){
'use strict';
const B=root.SailingBoats;
if(!B)throw Error('Bådmodellerne er ikke indlæst.');
const PI=Math.PI,DEG=PI/180,EPS=1e-8,CONFIG=B.get('laser');
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x)),wrap=x=>Math.atan2(Math.sin(x),Math.cos(x)),wrap360=x=>((x%360)+360)%360;
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a),0,1);return t*t*(3-2*t);},move=(a,b,d)=>a+clamp(b-a,-d,d);
const configFor=s=>B.get(typeof s==='string'?s:s?.boatId||s?.id);
const DEFAULT_ENV=Object.freeze({speed:5,direction:0,gusts:.20,waves:.35,autoBalance:true,crewPose:2,ironsHelp:false,boatId:'laser',controlSensitivity:1,controlRate:1,motionDamping:1});
  // A narrow directional spectrum keeps crests continuous across the sound.
  // Different phases and bearings turn the straight fronts into uneven groups.
  const dominant=Math.atan2(.105,.075);
  const band=(windSea,entries,managedOnly=false)=>entries.map(([length,amplitude,offset,phase,managedLength=length])=>{
    const k=2*PI/length,angle=dominant+offset*DEG;
    return Object.freeze({windSea,managedOnly,amplitude,spreadAngle:offset*DEG,k,kx:k*Math.cos(angle),ky:k*Math.sin(angle),
      omega:Math.sqrt(9.82*k),phase,managedPeriod:Math.sqrt(managedLength/length)});
  });
  const WAVE_COMPONENTS=Object.freeze([
    ...band(false,[[27,.161,0,.2],[34,.098,3.2,2.1],[22.5,.070,-4.2,4.7],[9.4,.075,.8,3.4,18.8]]),
    ...band(true,[[7.9,.052,3.5,1.1],[5.6,.025,-5,3.9],[4.0,.010,2,5.1]]),
    // Crossing crests with distinct periods and phases in the live short sea.
    ...band(true,[[5.1,.022,8.8,2.8],[3.3,.016,-10.4,.6],[4.25,.014,-2.2,5.9]],true)
  ]);
  const CREST_BEND=.22,PROFILE_SECONDS=1.8,WIND_WAVE_SECONDS=6,MAX_WAVE_HEIGHT=root.SailingSettings.MAX_WAVE_HEIGHT;
  const CHOP_PERIOD=.77,CHOP_SPREAD=5.1,CHOP_HEIGHT=.40;
  const FIRST_CHOP=WAVE_COMPONENTS.findIndex(w=>w.windSea);
  const LEGACY_WAVE_COUNT=WAVE_COMPONENTS.findIndex(w=>w.managedOnly);
  const waveBlendAt=(time,profile)=>profile?smooth(0,1,(time-profile.start)/PROFILE_SECONDS):1;
  function environment(env) {
    const merged={...DEFAULT_ENV,...env};
    if(hasWaveHeight(env))delete merged.waves;
    return merged;
  }
  // Direct physics probes can still supply their dimensionless wave forcing.
  const hasWaveHeight=env=>Number.isFinite(env?.waveHeight)&&!Number.isFinite(env.waves);
  const independentSea=env=>hasWaveHeight(env)&&Number.isFinite(env.chop);
  const seaShape=env=>hasWaveHeight(env)?root.SailingSettings.seaShape(env.waveHeight):null;
  const BASE_WAVE_DIRECTION=wrap360(Math.atan2(-WAVE_COMPONENTS[0].kx,-WAVE_COMPONENTS[0].ky)/DEG);
  const BASE_WAVE_PERIOD=2*PI/WAVE_COMPONENTS[0].omega;
  const waveHeightUnit=(short=1)=>4*Math.sqrt(WAVE_COMPONENTS.reduce((sum,w)=>sum+(w.managedOnly?0:w.amplitude*(w.windSea?short:1))**2,0)/2);
  const WAVE_HEIGHT_UNIT=waveHeightUnit(),LONG_HEIGHT_UNIT=waveHeightUnit(0);
  const SHORT_HEIGHT_UNIT=4*Math.sqrt(WAVE_COMPONENTS.reduce((sum,w)=>sum+(w.windSea?w.amplitude**2:0),0)/2);
  const CHOP_SCALE=CHOP_HEIGHT/SHORT_HEIGHT_UNIT;
  function windWaveTarget(env){
    const wind=Number.isFinite(env?.speed)?env.speed:DEFAULT_ENV.speed;
    const strength=wind<5?Math.sqrt(Math.max(0,wind)/5):1+clamp((wind-5)/15,0,1)*.51;
    // The manually specified short sea includes residual motion. Limit its
    // open-water steepness at high winds before applying the shoal limit.
    return independentSea(env)?clamp(strength,.45,1.40):strength;
  }
  function waveGrowthAt(time,growth,seconds,fallback){
    if(!growth)return {scale:fallback,rate:0};
    const difference=growth.from-growth.to;
    const remainder=difference?difference*Math.exp(-Math.max(0,time-growth.start)/seconds):0;
    return {scale:growth.to+remainder,rate:time>=growth.start?-remainder/seconds:0};
  }
  function windWaveAt(time,profile,env){
    return waveGrowthAt(time,profile?.wind,WIND_WAVE_SECONDS,windWaveTarget(env));
  }
  function waveProfileFor(env={}){
    const wind=Number.isFinite(env.direction)?env.direction:BASE_WAVE_DIRECTION;
    const sea=seaShape(env),managed=independentSea(env),separateSwell=Number.isFinite(env.swellDirection);
    const incoming=separateSwell?env.swellDirection:wind;
    const period=clamp(env.wavePeriod??sea?.period??BASE_WAVE_PERIOD,3,12);
    const chop=managed?clamp(env.chop,0,1):0;
    const short=managed?CHOP_SCALE*chop:clamp(env.shortSea??sea?.short??1,0,2);
    const seeded=root.SailingWind.seedPhase(env.windSeed)-root.SailingWind.seedPhase(root.SailingWind.CONFIG.seed);
    return {angle:wrap((BASE_WAVE_DIRECTION-incoming)*DEG),windAngle:wrap((BASE_WAVE_DIRECTION-wind)*DEG),
      coupled:!managed&&(env.speed??DEFAULT_ENV.speed)>.05&&!separateSwell,
      period:period/BASE_WAVE_PERIOD,short,spread:sea?.spread??1,seed:managed?seeded:0,managed};
  }
  function advanceWaveProfile(s,env){
    const desired=waveProfileFor(env),p=s.waveProfile;
    const target=windWaveTarget(env);
    const wind=p?.wind?.to===target?p.wind:{from:windWaveAt(s.time,p,env).scale,to:target,start:s.time};
    if(!p){s.waveProfile={from:desired,to:desired,start:s.time-PROFILE_SECONDS,wind};return;}
    const finished=s.time-p.start>=PROFILE_SECONDS;
    const changed=Math.abs(wrap(desired.angle-p.to.angle))>1e-5
      ||Math.abs(wrap(desired.windAngle-(p.to.windAngle??p.to.angle)))>1e-5||desired.coupled!==p.to.coupled
      ||Math.abs(desired.spread-(p.to.spread??1))>1e-5||Math.abs(desired.period-p.to.period)>1e-5
      ||Math.abs(desired.short-p.to.short)>1e-5||desired.seed!==(p.to.seed??0)||desired.managed!==!!p.to.managed;
    if(finished&&changed)s.waveProfile={from:p.to,to:desired,start:s.time,wind};
    else if(wind!==p.wind)s.waveProfile={...p,wind};
  }

  function seaTarget(env={}){
    if(independentSea(env))return clamp(env.waveHeight,0,MAX_WAVE_HEIGHT)/LONG_HEIGHT_UNIT;
    if(hasWaveHeight(env)){
      const short=clamp(env.shortSea??seaShape(env).short,0,2);
      // Significant height is four standard deviations of the wave spectrum.
      return clamp(env.waveHeight,0,MAX_WAVE_HEIGHT)/waveHeightUnit(short*windWaveTarget(env));
    }
    const speed=env?.speed??DEFAULT_ENV.speed,waves=env?.waves??DEFAULT_ENV.waves;
    const scale=clamp(CONFIG.seaBaseFraction+CONFIG.seaWindFraction*Math.sqrt(Math.max(0,speed)/CONFIG.seaWindReference),
      CONFIG.seaBaseFraction,CONFIG.seaMaxScale);
    return waves*scale;
  }
  function advanceSea(s,env,dt){
    if(env.sharedSea){
      s.seaState=env.sharedSea.seaState;
      s.seaStateRate=env.sharedSea.seaStateRate;
      s.waveProfile=env.sharedSea.waveProfile;
      return;
    }
    advanceWaveProfile(s,env);
    const target=seaTarget(env),response=configFor(s).seaTimeConstant;
    s.seaState+=(target-s.seaState)*(1-Math.exp(-dt/response));
    if(independentSea(env)&&Math.abs(target-s.seaState)*LONG_HEIGHT_UNIT<.0005)s.seaState=target;
    s.seaStateRate=(target-s.seaState)/response;
  }
  const windAt=root.TackFieldSamplers?.wind??root.SailingWind.at;
  const injectedWater=root.TackFieldSamplers?.water;
  const waveAt=injectedWater??analyticWaveAt;
  const waveHeightAt=(x,y,time,env,depth)=>injectedWater
    ?injectedWater(x,y,time,env,depth).height:analyticWaveAt(x,y,time,env,0,true);
  const waveBands=new WeakMap(),openWater={v:1,dx:0,dy:0},openPath={v:0,dx:0,dy:0};
  function waveBand(profile){
    const old=waveBands.get(profile);
    const {angle,windAngle=angle,period,short,spread=1,seed=0,managed=false}=profile;
    if(old&&old.angle===angle&&old.windAngle===windAngle&&old.period===period&&old.short===short&&old.spread===spread&&old.seed===seed&&old.managed===managed)return old;
    const terms=WAVE_COMPONENTS.map((w,i)=>{
      const stretch=w.windSea?(managed?CHOP_PERIOD:1):period*(managed?w.managedPeriod:1);
      const k=w.k/(stretch*stretch),omega=w.omega/stretch;
      const rotation=(w.windSea?windAngle:angle)+w.spreadAngle*((w.windSea&&managed?CHOP_SPREAD:spread)-1);
      const c=Math.cos(rotation),s=Math.sin(rotation);
      const forwardX=(w.kx*c-w.ky*s)/w.k,forwardY=(w.kx*s+w.ky*c)/w.k;
      return {k,omega,forwardX,forwardY,amplitude:w.amplitude*(w.windSea?short:1),
        bend:CREST_BEND*k,phase:w.phase+seed*(i+1),windSea:w.windSea};
    });
    const prepared={angle,windAngle,period,short,spread,seed,managed,terms,exposure:null,path:null};
    waveBands.set(profile,prepared);
    return prepared;
  }
  function waveExposureField(p,band=waveBand(p)){
    const shelter=root.SailingShelter;
    return band.exposure ||= shelter.combinedField(shelter.waveDirection(p.angle),shelter.waveDirection(band.windAngle));
  }
  function wavePathField(p,band=waveBand(p)){
    const shelter=root.SailingShelter,short=WAVE_COMPONENTS[FIRST_CHOP];
    return band.path ||= root.SailingWaterDepth.pathField(shelter.waveDirection(p.angle),shelter.waveDirection(band.windAngle),
      BASE_WAVE_PERIOD*band.period,2*PI*CHOP_PERIOD/short.omega);
  }
  function waveExposureAt(p,x,y){
    const shelter=root.SailingShelter,field=waveExposureField(p);
    return {long:shelter.sampleGradient(field,x,y,p.coupled&&!p.managed?2:0),short:shelter.sampleGradient(field,x,y,1),
      fetch:shelter.sample(field,x,y,3)*shelter.fetchLimit};
  }
  function depthBreaking(swell,chop,site,scale,rate,wind,windRate){
    const coast=root.SailingWaterDepth,inv=1/(coast.breakingRatio*site.depth);
    const hLong=scale*LONG_HEIGHT_UNIT*inv,hShort=wind*SHORT_HEIGHT_UNIT*inv;
    const long=hLong*swell.v,short=hShort*chop.v,norm=long*long+short*short;
    if(norm<=coast.breakingOnset**2)return null;
    const r=Math.sqrt(norm),{gain,derivative}=coast.breakingLimit(r);
    const depthWeight=norm/site.depth;
    return {gain,
      dx:derivative*(long*hLong*swell.dx+short*hShort*chop.dx-depthWeight*site.dx)/r,
      dy:derivative*(long*hLong*swell.dy+short*hShort*chop.dy-depthWeight*site.dy)/r,
      rate:derivative*(long*LONG_HEIGHT_UNIT*rate*swell.v+short*SHORT_HEIGHT_UNIT*windRate*chop.v)*inv/r};
  }
  function analyticWaveAt(x,y,time,inputEnv,depth=0,heightOnly=false){
    const scale=inputEnv?.waveCurrent??seaTarget(inputEnv),scaleRate=inputEnv?.waveCurrentRate||0;
    let height=0,dx=0,dy=0,velocity=0,waterVx=0,waterVy=0,waterVz=0,waterAx=0,waterAy=0,curvature=0;
    const component=Number.isInteger(inputEnv?.waveComponent)?inputEnv.waveComponent:-1;
    const profile=inputEnv?.waveProfile,from=profile?.from||waveProfileFor(inputEnv),to=profile?.to||from;
    const blend=waveBlendAt(time,profile);
    if(!scale&&!scaleRate&&!((from.managed&&from.short)||(to.managed&&to.short)))
      return heightOnly?height:{height,dx,dy,velocity,waterVx,waterVy,waterVz,waterAx,waterAy,curvature};
    const transition=blend>0&&blend<1;
    const shelter=root.SailingShelter,covered=inputEnv?.shelter!==false&&shelter.contains(x,y),below=Math.max(0,depth);
    const wind=windWaveAt(time,profile,inputEnv);
    const coast=root.SailingWaterDepth,site=covered?coast.sample(x,y):null;
    const swellDepth=site&&site.depth<coast.swellDepth?coast.damp(site.depth,coast.swellDepth):null;
    const chopDepth=site&&site.depth<coast.chopDepth?coast.damp(site.depth,coast.chopDepth):null;
    const attenuate=(local,gain,xSlope,ySlope)=>({
      v:local.v*gain,dx:local.dx*gain+local.v*xSlope,dy:local.dy*gain+local.v*ySlope
    });
    const addBand=(p,weight)=>{
      const band=waveBand(p);
      const field=covered?band.exposure||waveExposureField(p,band):null;
      let swell=field?shelter.sampleGradient(field,x,y,p.coupled&&!p.managed?2:0):openWater;
      let chop=field?shelter.sampleGradient(field,x,y,1):openWater;
      const dampen=(local,depth)=>depth?attenuate(local,depth.value,depth.slope*site.dx,depth.slope*site.dy):local;
      if(site&&p.managed){
        const acrossDepth=(local,limit,k)=>{
          if(site.depth*k>=5&&site.depth>=limit)return local;
          const gain=coast.waveGain(site.depth,limit,k);
          const slope=(coast.waveGain(site.depth+.02,limit,k)-coast.waveGain(site.depth-.02,limit,k))*25;
          return attenuate(local,gain,slope*site.dx,slope*site.dy);
        };
        swell=acrossDepth(swell,coast.swellDepth,band.terms[0].k);
        chop=acrossDepth(chop,coast.chopDepth,band.terms[FIRST_CHOP].k);
      }else{
        swell=dampen(swell,swellDepth);chop=dampen(chop,chopDepth);
      }
      const path=covered&&p.managed?wavePathField(p,band):null;
      const swellPath=path?coast.samplePath(path,x,y,0):openPath,chopPath=path?coast.samplePath(path,x,y,1):openPath;
      const waveScale=scale,waveRate=scaleRate;
      const windScale=p.managed?wind.scale:scale*wind.scale,windScaleRate=p.managed?wind.rate:scaleRate*wind.scale+scale*wind.rate;
      const breaking=p.managed&&site?.depth>0?depthBreaking(swell,chop,site,waveScale,waveRate,windScale*band.short,windScaleRate*band.short):null;
      const swellRate=breaking?swell.v*breaking.rate:0,chopRate=breaking?chop.v*breaking.rate:0;
      if(breaking){
        const {gain,dx,dy}=breaking;
        swell=attenuate(swell,gain,dx,dy);
        chop=attenuate(chop,gain,dx,dy);
      }
      let profileHeight=0,profileDepth=0;
      const start=component>=0?component:waveScale||waveRate?0:FIRST_CHOP;
      const count=p.managed?band.terms.length:LEGACY_WAVE_COUNT;
      const end=component>=0?Math.min(component+1,count):band.short&&(windScale||windScaleRate)?count:FIRST_CHOP;
      for(let i=start;i<end;i++){
        const w=band.terms[i],local=w.windSea?chop:swell,travel=w.windSea?chopPath:swellPath;
        const amplitude=w.amplitude*(w.windSea?windScale:waveScale),a=amplitude*local.v;
        const driven=w.amplitude*local.v*(w.windSea?windScaleRate:waveRate)+amplitude*(w.windSea?chopRate:swellRate);
        if(!a&&!driven)continue;
        const {forwardX,forwardY}=w;
        const q=w.k*(x*forwardX+y*forwardY+travel.v)-w.omega*time+w.phase,sin=Math.sin(q);
        const bend=w.bend,cos2=1-2*sin*sin,harmonic=bend*a*a,crest=harmonic*cos2,h=a*sin-crest;
        height+=weight*h;
        if(heightOnly)continue;
        const gx=forwardX+travel.dx,gy=forwardY+travel.dy,directionLength=Math.hypot(gx,gy),localK=w.k*directionLength;
        const cos=Math.cos(q),rate=a*cos+4*harmonic*sin*cos;
        const areaGradient=sin-2*bend*a*cos2,base=amplitude*areaGradient;
        const decay=below?Math.exp(-localK*below):1;
        let sideDecay=decay,verticalDecay=decay;
        if(p.managed&&site&&site.depth>0&&site.depth*w.k<5){
          // Finite-depth orbital motion at a solid bottom. Horizontal
          // motion remains parallel to it and vertical motion goes to zero.
          const k=coast.waveNumber(w.k,site.depth),relativeDepth=Math.min(site.depth,below);
          const down=Math.exp(-k*relativeDepth),up=Math.exp(-k*(2*site.depth-relativeDepth));
          const column=-Math.expm1(-2*k*site.depth);
          sideDecay=below<=site.depth?(down+up)/column:0;
          verticalDecay=(down-up)/column;
        }
        const slope=rate*w.k;
        dx+=weight*(slope*gx+base*local.dx);dy+=weight*(slope*gy+base*local.dy);
        curvature+=weight*(a*sin-4*crest)*localK*localK;
        velocity+=weight*(-w.omega*rate+areaGradient*driven);
        const orbital=weight*a*sin*sideDecay;
        const normalizer=w.omega/Math.max(1e-8,directionLength);
        waterVx+=orbital*gx*normalizer;waterVy+=orbital*gy*normalizer;
        // First-order incident pressure follows the horizontal acceleration
        // of the water particles. Its phase is independent of the hull.
        const acceleration=-weight*a*w.omega*cos*sideDecay*normalizer;
        waterAx+=acceleration*gx;waterAy+=acceleration*gy;
        waterVz+=weight*verticalDecay*(-w.omega*(a*cos+4*harmonic*sin*cos*verticalDecay)+(sin-2*bend*a*cos2*verticalDecay)*driven);
        if(transition){profileHeight+=h;profileDepth+=verticalDecay*(a*sin-crest*verticalDecay);}
      }
      return {height:profileHeight,depth:profileDepth};
    };
    if(blend===1)addBand(to,1);
    else if(blend===0)addBand(from,1);
    else{
      const a=addBand(from,1-blend),b=addBand(to,blend);
      if(heightOnly)return height;
      const phase=(time-profile.start)/PROFILE_SECONDS,rate=6*phase*(1-phase)/PROFILE_SECONDS;
      velocity+=(b.height-a.height)*rate;waterVz+=(b.depth-a.depth)*rate;
    }
    return heightOnly?height:{height,dx,dy,velocity,waterVx,waterVy,waterVz,waterAx,waterAy,curvature};
  }
  function axes(theta) { return { fx: Math.cos(theta), fy: Math.sin(theta), rx: Math.sin(theta), ry: -Math.cos(theta) }; }
  function windForState(s, env, overrideWind) {
    const w = overrideWind || windAt(s.x, s.y, s.time, env), a = axes(s.theta);
    const tvx = w.vx, tvy = w.vy, avx = tvx - s.vx, avy = tvy - s.vy;
    const tws = Math.hypot(tvx, tvy), aws = Math.hypot(avx, avy);
    const twa = tws < 1e-6 ? null : Math.atan2(-tvx * a.rx - tvy * a.ry, -tvx * a.fx - tvy * a.fy);
    const awa = aws < 1e-6 ? null : Math.atan2(-avx * a.rx - avy * a.ry, -avx * a.fx - avy * a.fy);
    return { vx: tvx, vy: tvy, avx, avy, tws, twd: tws < 1e-6 ? null : wrap360(Math.atan2(-tvx, -tvy) / DEG), twa, aws, awa, gust: w.gust || 0, meanSpeed:w.meanSpeed??tws, exposure:w.exposure??1 };
  }
function bodyOffset(s,p){
 const ch=Math.cos(s.heel||0),sh=Math.sin(s.heel||0),cp=Math.cos(s.pitch||0),sp=Math.sin(s.pitch||0),uy=ch*p.y-sh*p.z,r=sh*p.y+ch*p.z;
 return {f:cp*p.x-sp*uy,r,up:sp*p.x+cp*uy,dHeel:-cp*r,dPitch:cp*p.x-sp*uy};
}
function bodyPoint(s,p){const q=bodyOffset(s,p),a=axes(s.theta);return {x:s.x+q.f*a.fx+q.r*a.rx,y:s.y+q.f*a.fy+q.r*a.ry,z:(s.heave||0)+q.up};}
function pointMotion(s,q,a=axes(s.theta)){
 const pitch=s.pitchRate||0,heel=s.heelRate||0,yaw=s.omega||0;
 const f=s.vx*a.fx+s.vy*a.fy-pitch*q.up+(yaw+heel*Math.sin(s.pitch||0))*q.r;
 const r=s.vx*a.rx+s.vy*a.ry-yaw*q.f+heel*(Math.cos(s.pitch||0)*q.up-Math.sin(s.pitch||0)*q.f);
 return {f,r,x:f*a.fx+r*a.rx,y:f*a.fy+r*a.ry,z:(s.heaveVelocity||0)+pitch*q.f-heel*Math.cos(s.pitch||0)*q.r};
}
function waterVelocity(s,w={}){
 return {x:(s.waterX||0)+(w.waterVx||0),y:(s.waterY||0)+(w.waterVy||0),z:w.waterVz||0};
}
function waterContact(s,p,env,joint){
 const a=axes(s.theta),q=bodyOffset(s,p),motion=pointMotion(s,q,a);
 const wp={x:s.x+q.f*a.fx+q.r*a.rx,y:s.y+q.f*a.fy+q.r*a.ry,z:(s.heave||0)+q.up};
 if(joint){const j=bodyOffset(s,joint);motion.x+=j.f*a.fx+j.r*a.rx;motion.y+=j.f*a.fy+j.r*a.ry;motion.z+=j.up;}
 const w=waveAt(wp.x,wp.y,s.time,env,Math.max(0,-wp.z));
 const depth=w.height-wp.z,closing=w.velocity+w.dx*motion.x+w.dy*motion.y-motion.z;
 const water=waterVelocity(s,w);
 const entry=smooth(-.04,.04,depth)*(1-smooth(.09,.23,depth));
 return {x:wp.x,y:wp.y,z:wp.z,height:w.height,depth,closing,entry,dx:w.dx,dy:w.dy,point:p,
   waterX:water.x,waterY:water.y,waterAx:w.waterAx,waterAy:w.waterAy,
   relativeX:motion.x-water.x,relativeY:motion.y-water.y,relativeZ:motion.z-water.z};
}
function bowWaterContact(s,c,env,offset=0){
 const along=c.length*.38;
 return waterContact(s,{x:along,y:B.hullBottom(c,along,0),z:offset},env);
}
const resistanceSamples=new WeakMap();
const resistanceStations=[[-.28,.28],[.01,.46],[.29,.26]];
function wettedGirth(perimeter,depthAt){
 let length=0,y=0,z=0;
 for(let i=1;i<perimeter.length;i++){
  const a=perimeter[i-1],b=perimeter[i],da=depthAt(a),db=depthAt(b);
  if(da<=0&&db<=0)continue;
  const from=da>=0?0:da/(da-db),to=db>=0?1:da/(da-db);
  const wet=(to-from)*Math.hypot(b.y-a.y,b.z-a.z),mid=(from+to)*.5;
  length+=wet;y+=wet*(a.y+(b.y-a.y)*mid);z+=wet*(a.z+(b.z-a.z)*mid);
 }
 return {length,point:{x:perimeter[0].x,y:y/(length||1),z:z/(length||1)}};
}
function loadedWaterline(c){
 const {points}=hullSamples(c);
 let lo=c.deckY-c.hullDepth,hi=c.deckY;
 const displacement=c.mass/c.waterDensity;
 for(let i=0;i<30;i++){
  const level=(lo+hi)*.5;
  const volume=points.reduce((sum,p)=>sum+p.volume*clamp(.5+(level-p.y)/p.dy,0,1),0);
  if(volume<displacement)lo=level;else hi=level;
 }
 return (lo+hi)*.5;
}
function hullDragSamples(c){
 let data=resistanceSamples.get(c);
 if(data)return data;
 const samples=[],sections=[],waterline=c.hullCrossflowCD?loadedWaterline(c):0;
 for(const [station,share] of resistanceStations){
  const x=station*c.length,beam=B.halfBeamAt(c,x);
  for(const z of [-.38*beam,.38*beam]){
   samples.push({x,y:B.hullBottom(c,x,z)+c.hullDepth*.16,z,w:share*.5});
  }
  if(c.hullCrossflowCD){
   const perimeter=[{x,y:c.deckY,z:-beam}];
   for(const fraction of [-.93,-.69,-.40,0,.40,.69,.93]){
    const z=beam*fraction;
    perimeter.push({x,y:B.hullBottom(c,x,z),z});
   }
   perimeter.push({x,y:c.deckY,z:beam});
   const levelGirth=wettedGirth(perimeter,p=>waterline-p.y).length;
   const levelWeight=smooth(-.07,.09,waterline-B.hullBottom(c,x,.38*beam)-c.hullDepth*.16);
   sections.push({perimeter,share,length:share*(c.referenceWaterline??c.length*.91),
    girthScale:share*levelWeight/(levelGirth||1)});
  }
 }
 data={samples,sections};resistanceSamples.set(c,data);
 return data;
}
function addSwayWaterMass(water, mass, forward, acceleration){
 water.sway+=mass;
 water.firstMoment+=mass*forward;
 water.secondMoment+=mass*forward*forward;
 const reaction=mass*acceleration;
 water.incidentSway+=reaction;
 water.incidentFirstMoment+=reaction*forward;
}
function hullCrossflow(s,c,a,env,sections,rigFactor,waterInertia){
 let side=0,roll=0,yaw=0;
 const longitudinal=[];
 // The projected lateral area is the immersed height of each hull section
 // times its longitudinal width. It remains present when only the leeward
 // bilge is in the water. Force uses sideways water speed at mid-draft.
 const upAxis=bodyOffset(s,{x:0,y:1,z:0}),sideAxis=bodyOffset(s,{x:0,y:0,z:1});
 const vertical={x:Math.sin(s.pitch),y:upAxis.up,z:sideAxis.up};
 for(const {perimeter,share,length,girthScale} of sections){
  const centre=perimeter[4],surface=waterContact(s,centre,env);
  const slopeF=surface.dx*a.fx+surface.dy*a.fy,slopeR=surface.dx*a.rx+surface.dy*a.ry;
  const depthY=slopeF*upAxis.f+slopeR*upAxis.r-upAxis.up;
  const depthZ=slopeF*sideAxis.f+slopeR*sideAxis.r-sideAxis.up;
  const depthAt=point=>surface.depth+depthY*(point.y-centre.y)+depthZ*point.z;
  const girth=wettedGirth(perimeter,depthAt);
  if(girth.length>0)longitudinal.push({...girth.point,w:girth.length*girthScale});
  let lowest=centre,deepest=surface.depth,shallowest=surface.depth;
  for(const point of perimeter){
   const depth=depthAt(point);
   if(depth>deepest){deepest=depth;lowest=point;}
   shallowest=Math.min(shallowest,depth);
  }
  const draft=deepest-Math.max(0,shallowest);
  if(draft<=0)continue;
  const midDraft=draft*.5;
  const point={x:lowest.x+vertical.x*midDraft,y:lowest.y+vertical.y*midDraft,z:lowest.z+vertical.z*midDraft};
  const contact=waterContact(s,point,env),cross=contact.relativeX*a.rx+contact.relativeY*a.ry;
  const area=draft*length,wet=clamp(draft/(.28*c.hullDepth),0,1);
  const drag=-(.5*c.waterDensity*c.hullCrossflowCD*area*Math.abs(cross)+c.hullLateralLinear*share*wet)*cross*rigFactor;
  const moment=forceMoment(s,point,0,drag);
  side+=drag;roll+=moment.roll;yaw+=moment.yaw;
  // Approximate the partly immersed section by half of an ellipse
  // mirrored at the surface. The transverse inertia scales with draft².
  if(waterInertia)addSwayWaterMass(waterInertia,.5*c.waterDensity*PI*draft*draft*length,
    bodyOffset(s,point).f,contact.waterAx*a.rx+contact.waterAy*a.ry);
 }
 return {side,roll,yaw,longitudinal};
}
function hullResistance(s,c,a,env,rigWet,planingSupport,waterInertia){
 const {samples,sections}=hullDragSamples(c);
 const fDrag=1+(sections.length?0:c.hullHeelDrag*Math.sin(s.heel)**2)+rigWet*c.hullWetRigDrag;
 const rDrag=1+rigWet*c.hullWetRigLateralDrag;
 const cross=sections.length?hullCrossflow(s,c,a,env,sections,rDrag,waterInertia):null;
 const rise=c.hullWaveRise,referenceSpeed=Math.sqrt(c.gravity*(c.referenceWaterline??c.length*.91));
 // Radiated wave height falls as dynamic support unloads displacement.
 const displacementDrag=(1-planingSupport)**2;
 let f=0,r=0,roll=0,pitch=0,yaw=0,skinF=0,ownWaveF=0;
 for(const p of cross?.longitudinal??samples){
  const q=bodyOffset(s,p),point=bodyPoint(s,p),velocity=pointMotion(s,q,a);
  const w=waveAt(point.x,point.y,s.time,env,Math.max(0,-point.z));
  const water=waterVelocity(s,w),u=velocity.f-water.x*a.fx-water.y*a.fy,v=velocity.r-water.x*a.rx-water.y*a.ry;
  const wet=cross?p.w:p.w*smooth(-.07,.09,w.height-point.z);
  const speed=Math.abs(u);
  const froude=speed/referenceSpeed;
  const waveDrag=displacementDrag*(c.hullWaveDrag*(.68+.32*smooth(.12,.44,froude))+(rise?rise.extra*smooth(rise.from,rise.to,froude):0));
  const skin=-(c.hullLinearDrag*u+c.hullQuadraticDrag*u*speed)*wet*fDrag;
  const ownWave=-waveDrag*u*speed**3*wet*fDrag;
  const along=skin+ownWave;
  const across=sections.length?0:-(c.hullLateralLinear*v+c.hullLateralQuadratic*v*Math.abs(v))*wet*rDrag;
  const moment=forceMoment(s,p,along,across);
  f+=along;r+=across;roll+=moment.roll;pitch+=moment.pitch;yaw+=moment.yaw;skinF+=skin;ownWaveF+=ownWave;
 }
 if(cross){
  r+=cross.side;roll+=cross.roll;yaw+=cross.yaw;
 }
 return {f,r,roll,pitch,yaw,skinF,ownWaveF};
}
const planingStations=[[-.26,.54],[-.04,.46]];
const centerlinePlaningStrip=[[0,1]];
function planingLoad(s,c,a,env,hydro){
 const area=c.length*c.beam*c.planingAreaFraction,referenceSpeed=Math.sqrt(c.gravity*c.length);
 const immersion=clamp(hydro.submergedVolume/(c.mass/c.waterDensity),0,1);
 let lift=0,drag=0,surge=0,power=0,weightedRise=0,roll=0,pitch=0,yaw=0;
 const strips=c.planingStrips??centerlinePlaningStrip;
 // The lower side can still bear load after the centre of the bottom dries.
 for(const [station,lengthShare] of planingStations)for(const [across,widthShare] of strips){
  const x=station*c.length,z=across===0?0:across*B.halfBeamAt(c,x);
  const point={x,y:B.hullBottom(c,x,z)+.04*c.hullDepth,z};
  const contact=waterContact(s,point,env),forward=contact.relativeX*a.fx+contact.relativeY*a.fy;
  const fn=Math.max(0,forward)/referenceSpeed;
  if(fn<=.50)continue;
  const rise=contact.relativeZ,side=contact.relativeX*a.rx+contact.relativeY*a.ry;
  const alignment=forward*forward/(forward*forward+side*side);
  const wet=smooth(-.035,.09,contact.depth)*immersion;
  const incidence=clamp(.035+s.pitch-Math.atan2(rise,forward),0,.12);
  const support=.5*c.waterDensity*forward*forward*area*lengthShare*widthShare*c.planingLiftSlope*incidence*wet*alignment*smooth(.50,.85,fn);
  const resistance=support*.045;
  // Lift is perpendicular to the local stream. During descent, its
  // forward component redirects vertical momentum without adding energy
  // in the local water frame. Profile resistance remains dissipative.
  const drive=-resistance-support*rise/forward;
  const moment=forceMoment(s,point,drive,0),q=bodyOffset(s,point);
  lift+=support;drag+=resistance;surge+=drive;power-=resistance*forward;weightedRise+=rise*support;
  roll+=moment.roll+support*q.dHeel;pitch+=moment.pitch+support*q.dPitch;yaw+=moment.yaw;
 }
 const limit=Math.min(1,c.mass*c.gravity*c.planingMaxWeightFraction/Math.max(1e-8,lift));
 return {lift:lift*limit,drag:drag*limit,surge:surge*limit,rise:weightedRise/(lift||1),power:power*limit,
  moment:{roll:roll*limit,pitch:pitch*limit,yaw:yaw*limit}};
}
// Air velocity is in world coordinates and points TO where air moves. The
// instruments report wind FROM; each sail point sees the boat's translation,
// yaw, roll and pitch plus the movement of the boom about its mast pivot.
function sailAirAt(s,env,p,overrideWind,boomRate=0){
 const a=axes(s.theta),motion=pointMotion(s,bodyOffset(s,p),a);
 if(boomRate){
  const joint=bodyOffset(s,{x:(p.z||0)*boomRate,y:0,z:(configFor(s).mastX-p.x)*boomRate});
  motion.x+=joint.f*a.fx+joint.r*a.rx;motion.y+=joint.f*a.fy+joint.r*a.ry;motion.z+=joint.up;
 }
 const wp=bodyPoint(s,p),wind=overrideWind||windAt(wp.x,wp.y,s.time,env,wp.z);
 const x=wind.vx-motion.x,y=wind.vy-motion.y,z=-motion.z;
 return {x,y,z,speed:Math.hypot(x,y,z),trueSpeed:wind.speed??Math.hypot(wind.vx,wind.vy),point:wp};
}
// Cloth response is stepped with the forces and shared with the rendered sail.
function updateRig(s,c,dt,lively=false){
 const previous=s.sail?.main||s.sail||{},wind=s.sail?.wind||s.wind||{},old=s.rig||(s.rig={side:Math.sign(s.boom)||-1,camber:c.camber,twist:c.baseTwist||0,fill:.7});
 if(s.boom>.035)old.side=1;else if(s.boom<-.035)old.side=-1;
 old.sideBlend=move(old.sideBlend??old.side,old.side,2.5*dt);
 const load=clamp(previous.load||0,0,1),luff=clamp(previous.luff||0,0,1),speed=wind.aws||0,fill=(1-luff)*smooth(.08,1.4,speed);
 const targetCamber=c.camber*(.88+.12*(1-s.sheet))/(1+.20*load);
 // Under aerodynamic load the Racer's upper leech opens, especially with an eased sheet.
 const pressureTwist=c.pressureTwist?smooth(9**2,15**2,speed**2)*load*c.pressureTwist*(1-.55*s.sheet):0;
 const twistTravel=c.kind==='foiler'?.60:c.id==='laser'?.40*(1-c.vang):.40;
 const baseTwist=c.kind==='foiler'?1.2:1;
 const targetTwist=(c.baseTwist||0)*(baseTwist-twistTravel*s.sheet)+pressureTwist;
 const blend=1-Math.exp(-dt/0.7);old.camber+=(targetCamber-old.camber)*blend;old.twist+=(targetTwist-old.twist)*blend;old.fill+=(fill-old.fill)*(1-Math.exp(-dt/.45));
 const mean=old.apparentSpeed??speed;
 old.apparentSpeed=mean+(speed-mean)*(1-Math.exp(-dt/.52));
 const gust=smooth(.25,2.1,Math.abs(speed-mean)),pressure=smooth(2,11,speed);
 const flexibility=c.id==='yacht'?.66:c.kind==='foiler'?.52:.86;
 const motionScale=s.capsized||s.recovering?0:lively?1:.55;
 const gybe=lively&&s.gybeTarget ? .14 : 0;
 const advanceCloth=(field,flow,flex,impact)=>{
  // A stalled but loaded sail can hold its shape. Luffing means cloth
  // is losing tension, so only it and a real boom crossing drive large waves.
  const loose=smooth(.30,.84,flow.luff??0);
  const tension=clamp(flow.load??0,0,1);
  const stall=.16*smooth(.43,.93,flow.stall??0)*(1-.60*tension);
  const leech=.004*(1-.48*tension);
  const shake=motionScale*flex*pressure*(leech+.083*Math.max(loose,stall)+.030*gust*(.10+.90*loose)+impact);
  const before=old[field]??0,seconds=shake>before?(impact?.12:.22):.36;
  old[field]=before+(shake-before)*(1-Math.exp(-dt/seconds));
 };
 if(c.rigidWing)old.flutter=0;
 else advanceCloth('flutter',previous,flexibility,gybe);
 if(s.sail?.jib){
  advanceCloth('jibFlutter',s.sail.jib,flexibility*.84*(1-(s.spinnaker?.hoist??0)),gybe*.30);
  const prior=old.jibFill??fill,target=s.sail.jib.area>0?(1-s.sail.jib.luff)*smooth(.08,1.4,speed):0;
  old.jibFill=prior+(target-prior)*(1-Math.exp(-dt/.40));
 }
 old.flutterPhase=(old.flutterPhase??0)+dt*(7.5+.52*Math.min(21,speed));
 return old;
}
function sailFlutter(rig,height,jib=false){
 const amplitude=(jib?rig?.jibFlutter:rig?.flutter)||0;
 return amplitude?amplitude*Math.sin(rig.flutterPhase-height*9+(jib?1.9:0))*Math.sin(PI*height):0;
}
function forceMoment(s,p,forward,side,up=0){
 const q=bodyOffset(s,p),cp=Math.cos(s.pitch||0),sp=Math.sin(s.pitch||0),yaw=q.r*forward-q.f*side;
 return {roll:cp*q.up*side+sp*yaw+q.dHeel*up,pitch:-q.up*forward+q.dPitch*up,yaw};
}
// Translate and rotate about the instantaneous centre of mass. The scene,
// contact queries and networking still address the hull origin. Diagonal
// inertias are retained as an approximation to the coupled inertia tensor.
function integrateMass(s,dt,mass,cg,originInertia,force,moment,waterInertia,balance){
 const previous=s.massMotion,oldCg=previous?.cg??s.hydro?.cg??cg;
 const rate={x:(cg.x-oldCg.x)/dt,y:(cg.y-oldCg.y)/dt,z:(cg.z-oldCg.z)/dt};
 const axis=axes(s.theta),oldOffset=bodyOffset(s,oldCg),oldDrift=bodyOffset(s,previous?.rate??{x:0,y:0,z:0});
 const velocity=pointMotion(s,oldOffset,axis);
 let vx=velocity.x+oldDrift.f*axis.fx+oldDrift.r*axis.rx+force.x/mass*dt;
 let vy=velocity.y+oldDrift.f*axis.fy+oldDrift.r*axis.ry+force.y/mass*dt;
 const vz=velocity.z+oldDrift.up+force.z/mass*dt;
 const offset=bodyOffset(s,cg),originMoment=forceMoment(s,cg,force.x*axis.fx+force.y*axis.fy,force.x*axis.rx+force.y*axis.ry);
 const inertia={
  roll:Math.max(originInertia.roll*.25,originInertia.roll-mass*(cg.y*cg.y+cg.z*cg.z)),
  pitch:Math.max(originInertia.pitch*.25,originInertia.pitch-mass*(cg.x*cg.x+cg.y*cg.y)),
  yaw:Math.max(originInertia.yaw*.25,originInertia.yaw-mass*(cg.x*cg.x+cg.z*cg.z))
 };
 const prior=previous?.inertia??inertia;
 const yawAboutCG=moment.yaw-originMoment.yaw;
 let yawAcceleration=yawAboutCG/inertia.yaw;
 if(waterInertia?.sway>0){
  // Solve the coupled sway and yaw acceleration at the current immersion.
  // Added inertia resists changes in velocity and carries no static weight.
  const {sway,firstMoment,secondMoment}=waterInertia;
  const effectiveSway=mass+sway;
  const coupling=offset.f*sway-firstMoment;
  const effectiveYaw=inertia.yaw+secondMoment-offset.f*(2*firstMoment-offset.f*sway);
  const determinant=effectiveSway*effectiveYaw-coupling*coupling;
  const sideForce=force.x*axis.rx+force.y*axis.ry;
  // The added-water reaction is relative to local fluid acceleration.
  // The displaced-volume wave pressure is already counted in force/moment.
  const relativeSide=sideForce+(waterInertia.incidentSway??0);
  const relativeYaw=yawAboutCG+offset.f*(waterInertia.incidentSway??0)-(waterInertia.incidentFirstMoment??0);
  const change=((effectiveYaw*relativeSide-coupling*relativeYaw)/determinant-sideForce/mass)*dt;
  vx+=change*axis.rx;vy+=change*axis.ry;
  yawAcceleration=(effectiveSway*relativeYaw-coupling*relativeSide)/determinant;
 }
 if(balance){
  balance.yawAboutCG=yawAboutCG;
  balance.yawApplied=yawAcceleration*inertia.yaw;
  balance.yawWater=balance.yawApplied-yawAboutCG;
  balance.yawInertia=inertia.yaw;
 }
 s.heelRate=(s.heelRate*prior.roll+(moment.roll-originMoment.roll-offset.dHeel*force.z)*dt)/inertia.roll;
 s.pitchRate=(s.pitchRate*prior.pitch+(moment.pitch-originMoment.pitch-offset.dPitch*force.z)*dt)/inertia.pitch;
 s.omega=s.omega*prior.yaw/inertia.yaw+yawAcceleration*dt;
 s.theta=wrap(s.theta+s.omega*dt);s.heel+=s.heelRate*dt;s.pitch+=s.pitchRate*dt;
 const nextAxis=axes(s.theta),next=bodyOffset(s,cg),nextDrift=bodyOffset(s,rate);
 const nextVelocity=pointMotion({vx:0,vy:0,heaveVelocity:0,omega:s.omega,heelRate:s.heelRate,pitchRate:s.pitchRate,pitch:s.pitch},next,nextAxis);
 s.x+=oldOffset.f*axis.fx+oldOffset.r*axis.rx+vx*dt-next.f*nextAxis.fx-next.r*nextAxis.rx;
 s.y+=oldOffset.f*axis.fy+oldOffset.r*axis.ry+vy*dt-next.f*nextAxis.fy-next.r*nextAxis.ry;
 s.heave+=oldOffset.up+vz*dt-next.up;
 s.vx=vx-nextVelocity.x-nextDrift.f*nextAxis.fx-nextDrift.r*nextAxis.rx;
 s.vy=vy-nextVelocity.y-nextDrift.f*nextAxis.fy-nextDrift.r*nextAxis.ry;
 s.heaveVelocity=vz-nextVelocity.z-nextDrift.up;
 s.massMotion={cg,rate,inertia};
}
const hullCache=new Map();
function hullSamples(model){
 const c=configFor(model);if(hullCache.has(c.id))return hullCache.get(c.id);
 const points=[],nx=c.hydroNx,nz=c.hydroNz,ny=c.hydroNy,x0=c.hullSections[0][0],x1=c.hullSections.at(-1)[0],dx=(x1-x0)/nx;
 let volume=0,outerVolume=0;
 for(let ix=0;ix<nx;ix++){
  const x=x0+(ix+.5)*dx,w=B.halfBeamAt(c,x),dz=2*w/nz;
  for(let iz=0;iz<nz;iz++){
   const z=-w+(iz+.5)*dz,bottom=B.hullBottom(c,x,z),inside=B.insideCockpit(c,x,z),floor=Math.max(bottom,c.cockpit.floorY),layers=inside?[[bottom,floor,3,false],[floor,c.deckY,2,true]]:[[bottom,c.deckY,ny,false]];
   for(const [low,top,count,dryAir]of layers){if(top<=low)continue;const dy=(top-low)/count;
    for(let iy=0;iy<count;iy++){const v=dx*dy*dz;points.push({x,y:low+(iy+.5)*dy,z,dx,dy,dz,volume:v,dryAir});outerVolume+=v;if(!dryAir)volume+=v;}
   }
  }
 }
 const sample={points,volume,outerVolume};c.flotationVolume=volume;c.displacementVolume=outerVolume;
 hullCache.set(c.id,sample);return sample;
}
// A critically damped, acceleration-limited body-motion actuator. The desired
// stance changes immediately, but neither its velocity nor actual CG jumps.
// The scalar blend drives BOTH render joints and the physical mass segments.
function crewMotion(s,positionKey,velocityKey,target,maxSpeed,maxAcceleration,response,dt){
 let x=Number.isFinite(s[positionKey])?s[positionKey]:target,v=Number.isFinite(s[velocityKey])?s[velocityKey]:0;
 if(dt>0){const omega=1/Math.max(.04,response),acceleration=clamp(omega*omega*(target-x)-2*omega*v,-maxAcceleration,maxAcceleration),limitedVelocity=clamp(v+acceleration*dt,-maxSpeed,maxSpeed);v=move(v,limitedVelocity,maxAcceleration*dt);x+=v*dt;
  if(Math.abs(target-x)<1e-5&&Math.abs(v)<1e-4){x=target;v=0;}}
 s[positionKey]=x;s[velocityKey]=v;
}
const crewWindDeadband=5*DEG;
function windwardCrewSide(wind){
 const angle=wind?.twa,offBow=Math.abs(angle);
 return wind?.tws>.6&&offBow>crewWindDeadband&&offBow<PI-crewWindDeadband?Math.sign(angle):0;
}
function tackCrewSide(s,steer){
 const wind=s.wind,angle=wind?.twa;
 if(s.capsized||s.recovering||!(wind?.tws>.6)||angle==null||Math.abs(angle)>crewWindDeadband)return 0;
 const from=s.crewTackFrom;
 // The last established windward side stays fixed through the wind eye.
 // Small changes of wind angle or a second press should keep the same target.
 if(from)return -from;
 if(Math.abs(s.omega)>.10)return Math.sign(s.omega);
 if(Math.abs(steer)>.19)return -Math.sign(steer);
 return Math.sign(s.boom);
}
function manualCrewTarget(s,controls,env,dt,windSide){
 const requested=controls.crewPose??env.crewPose??s.crewPose??2;s.crewPose=clamp(Math.round(requested),1,3);
 if(s.recovering)s.crewPose=1;
 if(!Number.isFinite(s.crewSide))s.crewSide=-1;
 const requestedSide=Math.sign(controls.crew||0);
 if(!s.capsized&&!s.recovering&&Math.abs(controls.crew||0)>.2&&(!windSide||requestedSide===windSide))s.crewSide=requestedSide;
 if(s.boatId==='laser'){
  // The sailor ducks during a commanded crossing. Zero input holds the side.
  const crossing=Math.abs((s.crewSideBlend??s.crewSide)-s.crewSide)>.15,duck=crossing?1:0;
  s.crewDuck=move(s.crewDuck||0,duck,dt*(duck>(s.crewDuck||0)?5.6:3.2));
  if(crossing)(s.crewTransfer??={}).phase='crossing';
  else s.crewTransfer=null;
 }
 return s.crewPose;
}
const crewRightingMoment=new Map();
function automaticCrewTarget(s,c,controls,wind,sail,dt,windSide){
 let limit=crewRightingMoment.get(c.id);
 if(limit===undefined){
  limit=c.gravity*(c.kind==='foiler'
   ?B.foilerCrewPositions({boatId:c.id,crewPoseBlend:3,crewSideBlend:1}).reduce((n,p)=>n+p.mass*p.z,0)
   :c.crewMass*B.crewPose(c.id,3,1).cg.z);
  crewRightingMoment.set(c.id,limit);
 }
 // Anticipate roll from the sail and current roll velocity. Correction is
 // applied through the existing crew mass points and their available travel.
 const heel=wrap(s.heel),predicted=heel+.32*s.heelRate;
 const demand=-(.82*(sail?.rollMoment||0)/Math.max(1,limit)+3.7*predicted);
 const angle=Math.abs(wind.twa??PI);
 const inTack=wind.tws>.6&&angle<23*DEG&&(Math.abs(controls.steer||0)>.19||Math.abs(s.omega)>.12);
 const crossingEye=inTack&&Math.abs(predicted)<19*DEG;
 const side=windSide||s.crewSide||-1;
 const crossing=s.crewSideBlend*side<.46;
 const load=clamp(demand*side,0,1),extend=1+2*load**.57;
 const pose=crossingEye?1:crossing&&Math.abs(predicted)<21*DEG?Math.min(1.25,extend):extend;
 s.crewSide=side;
 s.crewPose=Math.round(pose);
 if(c.id==='laser'&&(crossingEye||crossing))(s.crewTransfer??={}).phase=crossing?'crossing':'prepare';
 else s.crewTransfer=null;
 s.crewDuck=move(s.crewDuck||0,crossingEye||crossing?1:0,dt*7);
 return pose;
}
function updateCrew(s,controls,env,dt,sail){
 const c=configFor(s);
 const wind=sail?.wind??s.wind??windForState(s,env),angle=Math.abs(wind.twa??PI);
 const windSide=windwardCrewSide(wind);
 if(windSide&&angle<90*DEG)s.crewTackFrom=windSide;
 s.crewDifficulty=(controls.difficulty??env.difficulty)==='easy'?'easy':'hard';
 const automatic=s.crewDifficulty==='easy'&&dt>0&&!s.recovering&&!s.capsized;
 const poseTarget=automatic?automaticCrewTarget(s,c,controls,wind,sail??s.sail,dt,windSide)
  :manualCrewTarget(s,controls,env,dt,windSide);
 const inward=poseTarget<(s.crewPoseBlend??poseTarget);
 crewMotion(s,'crewPoseBlend','crewPoseVelocity',poseTarget,automatic?9:inward?c.crewPoseReturnRate:c.crewPoseRate,
  automatic?80:inward?c.crewPoseReturnAcceleration:c.crewPoseAcceleration,automatic?.07:inward?c.crewPoseReturnResponse:c.crewPoseResponse,dt);
 crewMotion(s,'crewSideBlend','crewSideVelocity',s.crewSide,automatic?6:c.crewSideRate,
  automatic?45:c.crewSideAcceleration,automatic?.075:c.crewSideResponse,dt);
 const foreAft=automatic||s.capsized||s.recovering?0:clamp(controls.foreAft??0,-1,1);
 crewMotion(s,'crewForeAft','crewForeAftVelocity',foreAft,2.5,10,.18,dt);
 const capTarget=s.capsized&&!s.recovering?1:0;s.crewSwim=move(s.crewSwim||0,capTarget,dt*.85);
 if(c.kind==='foiler'){const people=B.foilerCrewPositions(s),sum=people.reduce((n,p)=>n+p.mass,0);s.crewStations=people;s.crewCG=people.reduce((v,p)=>({x:v.x+p.x*p.mass/sum,y:v.y+p.y*p.mass/sum,z:v.z+p.z*p.mass/sum}),{x:0,y:0,z:0});s.crew=s.crewCG.z;s.crewJoints=null;}
 else{s.crewJoints=B.crewPoseAt(s);s.crewCG=s.crewJoints.cg;s.crew=s.crewCG.z;}
}
function hydrostatics(s,inputEnv,withDamping=true){
 if(configFor(s).kind==='foiler'&&root.FoilingPhysics)return root.FoilingPhysics.hullLoads(s,inputEnv,root.FoilingPhysics.massProperties(s),withDamping);
 const c=configFor(s),env={...environment(inputEnv),waveCurrent:s.seaState??seaTarget(inputEnv),waveCurrentRate:s.seaStateRate||0,waveProfile:s.waveProfile},data=hullSamples(c),a=axes(s.theta),ch=Math.cos(s.heel||0),sh=Math.sin(s.heel||0),cp=Math.cos(s.pitch||0),sp=Math.sin(s.pitch||0);
 let buoyancy=0,verticalDamping=0,rollBuoyancy=0,pitchBuoyancy=0,rollHydroDamping=0,pitchHydroDamping=0,submergedVolume=0,centerX=0,centerY=0,centerZ=0,waveFx=0,waveFy=0,waveRoll=0,wavePitch=0,waveYaw=0;
 for(const p of data.points){
  const oy=ch*p.y-sh*p.z,rr=sh*p.y+ch*p.z,ff=cp*p.x-sp*oy,up=sp*p.x+cp*oy;
  const x=s.x+ff*a.fx+rr*a.rx,y=s.y+ff*a.fy+rr*a.ry,w=waveAt(x,y,s.time,env,Math.max(0,-s.heave-up)),verticalSpan=Math.abs(sp)*p.dx+Math.abs(cp*ch)*p.dy+Math.abs(cp*sh)*p.dz;
  const fraction=clamp(.5+(w.height-s.heave-up)/Math.max(.008,verticalSpan),0,1)*(p.dryAir?1-(s.cockpitWet||0):1);if(fraction<=0)continue;
  const volume=p.volume*fraction,fb=c.waterDensity*c.gravity*volume,dHeel=-cp*rr,dPitch=ff;
  const relativeV=(s.heaveVelocity||0)+dHeel*(s.heelRate||0)+dPitch*(s.pitchRate||0)-(w.waterVz||0);
  const fd=withDamping?clamp(-c.heaveDamping*clamp(env.motionDamping??1,.35,2)*volume/(c.mass/c.waterDensity)*relativeV,-fb*.95,fb*3):0;
  buoyancy+=fb;verticalDamping+=fd;rollBuoyancy+=fb*dHeel;pitchBuoyancy+=fb*dPitch;rollHydroDamping+=fd*dHeel;pitchHydroDamping+=fd*dPitch;
  // Integrate the incident-wave pressure gradient over displaced water. The
  // resolved wave field provides its direction and depth dependence.
  const mass=c.waterDensity*volume,fx=mass*w.waterAx,fy=mass*w.waterAy;
  const moment=forceMoment(s,p,fx*a.fx+fy*a.fy,fx*a.rx+fy*a.ry);
  waveFx+=fx;waveFy+=fy;waveRoll+=moment.roll;wavePitch+=moment.pitch;waveYaw+=moment.yaw;
  submergedVolume+=volume;centerX+=ff*volume;centerY+=up*volume;centerZ+=rr*volume;
 }
 const hullCenterOfBuoyancy={x:centerX/(submergedVolume||1),y:centerY/(submergedVolume||1),z:centerZ/(submergedVolume||1)};
 let gravity=-c.mass*c.gravity,rollGravity=0,pitchGravity=0,rollCrew=0,pitchCrew=0,cgX=0,cgY=0,cgZ=0;
 const crew=s.crewJoints||B.crewPoseAt(s);
 const masses=c.massPoints.concat(crew.segments.map(v=>({mass:v.mass,...v.p,crew:true})));
 for(const m of masses){const q=bodyOffset(s,m),force=-m.mass*c.gravity;const r=force*q.dHeel,p=force*q.dPitch;rollGravity+=r;pitchGravity+=p;if(m.crew){rollCrew+=r;pitchCrew+=p;}cgX+=m.mass*m.x/c.mass;cgY+=m.mass*m.y/c.mass;cgZ+=m.mass*m.z/c.mass;}
 // Mast/rig flotation and water drag are continuous immersion forces. The
 // sealed mast prevents immediate turtling but does not force a capsize angle.
 let rigBuoyancy=0,rollRigBuoyancy=0,rollRig=0,pitchRig=0,rigWet=0,rigDrag=0;
 for(let i=0;i<7;i++){
  const p={x:c.mastX,y:c.boomY+(i+.5)/7*(c.mastTop-c.boomY),z:0},q=bodyOffset(s,p),wp=bodyPoint(s,p),w=waveAt(wp.x,wp.y,s.time,env),wet=smooth(-.04,.13,w.height-wp.z);
  rigWet+=wet/7;if(!wet)continue;
  const displaced=wet*c.mastFloatVolume/7,f=displaced*c.waterDensity*c.gravity;rigBuoyancy+=f;rollRigBuoyancy+=q.dHeel*f;rollRig+=q.dHeel*f;pitchRig+=q.dPitch*f;centerX+=q.f*displaced;centerY+=q.up*displaced;centerZ+=q.r*displaced;
  const localV=(s.heaveVelocity||0)+q.dHeel*(s.heelRate||0)+q.dPitch*(s.pitchRate||0)-(w.velocity||0);
  const drag=withDamping?-wet*(c.rigDragLinear+c.rigDragQuadratic*Math.abs(localV))*localV:0;rigDrag+=drag;rollRig+=q.dHeel*drag;pitchRig+=q.dPitch*drag;
 }
 // The yacht's dense ballast is a distinct gravity point, already counted
 // once above. Its small displaced volume adds buoyancy at that same location.
 let keelBuoyancy=0;if(c.ballastVolume){const p={x:c.ballastX,y:c.ballastY,z:0},q=bodyOffset(s,p),wp=bodyPoint(s,p),water=waveHeightAt(wp.x,wp.y,s.time,env),wet=smooth(-.05,.30,water-wp.z);keelBuoyancy=wet*c.ballastVolume*c.waterDensity*c.gravity;buoyancy+=keelBuoyancy;rollBuoyancy+=keelBuoyancy*q.dHeel;pitchBuoyancy+=keelBuoyancy*q.dPitch;centerX+=q.f*wet*c.ballastVolume;centerY+=q.up*wet*c.ballastVolume;centerZ+=q.r*wet*c.ballastVolume;}
 // Include body and buoyancy-aid volume as each trapeze sailor enters the water.
 const crewCenters=c.racingYacht?crew.members.map(member=>member.cg):[crew.cg];
 const bodyVolume=c.crewFloatVolume/crewCenters.length;
 let crewDisplacement=0,crewWet=0;
 for(const center of crewCenters){
  const q=bodyOffset(s,center),wp=bodyPoint(s,center),water=waveHeightAt(wp.x,wp.y,s.time,env);
  const wet=smooth(-.03,.35,water-wp.z),volume=wet*bodyVolume,force=volume*c.waterDensity*c.gravity;
  crewWet+=wet/crewCenters.length;
  crewDisplacement+=volume;
  buoyancy+=force;rollBuoyancy+=force*q.dHeel;pitchBuoyancy+=force*q.dPitch;
  centerX+=q.f*volume;centerY+=q.up*volume;centerZ+=q.r*volume;
 }
 const totalDisplacedVolume=submergedVolume+(rigBuoyancy+keelBuoyancy)/(c.waterDensity*c.gravity)+crewDisplacement;
 const cc=c.cockpit;let coamingClearance=Infinity,floorClearance=Infinity,deckClearance=Infinity;
 for(let i=0;i<6;i++)for(const side of [-1,1]){const x=cc.minX+(cc.maxX-cc.minX)*i/5,p=bodyPoint(s,{x,y:c.deckY,z:side*cc.halfWidth}),water=waveHeightAt(p.x,p.y,s.time,env);coamingClearance=Math.min(coamingClearance,p.z-water);}
 for(const z of [-cc.halfWidth*.65,0,cc.halfWidth*.65]){const p=bodyPoint(s,{x:(cc.minX+cc.maxX)/2,y:cc.floorY,z}),water=waveHeightAt(p.x,p.y,s.time,env);floorClearance=Math.min(floorClearance,p.z-water);}
 for(const x of [c.hullSections[0][0]+.15,0,c.hullSections.at(-1)[0]-.15])for(const side of [-1,1]){const p=bodyPoint(s,{x,y:c.deckY,z:side*B.halfBeamAt(c,x)*.95}),water=waveHeightAt(p.x,p.y,s.time,env);deckClearance=Math.min(deckClearance,p.z-water);}
 let slam=0;
 if(withDamping&&!s.capsized){
  const shoulder=c.length*.32,span=B.halfBeamAt(c,shoulder)*.61;
  // The shoulders can strike separately as the boat heels. They share the
  // same effective impact area and buoyancy-based force budget as the bow.
  for(const [x,z,share] of [[c.length*.38,0,.58],[shoulder,-span,.21],[shoulder,span,.21]]){
   const hit=waterContact(s,{x,y:B.hullBottom(c,x,z),z},env);
   const entrySpeed=Math.max(0,hit.closing-.42);
   const force=share*Math.min(c.mass*c.gravity*.26,.5*c.waterDensity*c.beam*c.length*.038*entrySpeed**2*hit.entry);
   if(!force)continue;
   const fx=-hit.dx*force,fy=-hit.dy*force,q=bodyOffset(s,hit.point);
   const moment=forceMoment(s,hit.point,fx*a.fx+fy*a.fy,fx*a.rx+fy*a.ry);
   slam+=force;waveFx+=fx;waveFy+=fy;
   waveRoll+=moment.roll+q.dHeel*force;wavePitch+=moment.pitch+q.dPitch*force;waveYaw+=moment.yaw;
  }
 }
 return {buoyancy:buoyancy+rigBuoyancy,weight:-gravity,vertical:buoyancy+rigBuoyancy+gravity+verticalDamping+rigDrag+slam,verticalDamping,slamForce:slam,slamSeverity:slam/(c.mass*c.gravity),
  rollBuoyancy,pitchBuoyancy,rollGravity,pitchGravity,rollCrew,pitchCrew,rollHydroDamping,pitchHydroDamping,rollRig,rollRigBuoyancy,pitchRig,
  roll:rollBuoyancy+rollGravity+rollHydroDamping+rollRig+waveRoll,pitch:pitchBuoyancy+pitchGravity+pitchHydroDamping+pitchRig+wavePitch,waveFx,waveFy,waveRoll,wavePitch,waveYaw,
  submergedVolume,totalDisplacedVolume,totalVolume:data.volume,rigWet,crewWet,coamingClearance,floorClearance,deckClearance,cockpitWet:s.cockpitWet||0,hullCenterOfBuoyancy,
  centerOfBuoyancy:{x:centerX/(totalDisplacedVolume||1),y:centerY/(totalDisplacedVolume||1),z:centerZ/(totalDisplacedVolume||1)},cg:{x:cgX,y:cgY,z:cgZ}};
}
function equilibriumHeave(s,env){
 if(configFor(s).kind==='foiler'&&root.FoilingPhysics)return root.FoilingPhysics.equilibrium(s,env);
 let lo=-Math.max(1.2,configFor(s).hullDepth*1.3),hi=Math.max(1.4,configFor(s).hullDepth);const before=s.heave;for(let i=0;i<38;i++){s.heave=(lo+hi)/2;const h=hydrostatics(s,env,false);if(h.buoyancy>h.weight)lo=s.heave;else hi=s.heave;}const result=(lo+hi)/2;s.heave=before;return result;
}
function sailCoefficients(alpha,model,camber){const c=model?configFor(model):CONFIG,shape=clamp((camber??c.camber)/c.camber,.7,1.2),folded=.5*Math.atan2(Math.sin(2*alpha),Math.cos(2*alpha)),aa=Math.abs(folded),stall=smooth(c.stallStart,c.stallEnd,aa),luff=1-smooth(1.5*DEG,7*DEG,aa),attached=c.sailCLMax*Math.tanh(c.sailLiftSlope*folded/c.sailCLMax),cl=((1-stall)*attached+stall*.90*Math.sin(2*alpha))*shape,cd=c.sailProfileCD+c.sailInducedCD*cl*cl+c.sailPlateCD*Math.sin(alpha)**2*stall;return{cl,cd,luff,stall,folded};}
function cruiserSailWind(s,c,env,side,overrideWind){
 const point={x:c.mastX+1.8,y:c.mastTop*.56,z:side*1.1};
 const air=sailAirAt(s,env,point,overrideWind),axis=axes(s.theta);
 const forward=air.x*axis.fx+air.y*axis.fy,across=air.x*axis.rx+air.y*axis.ry;
 const speed=Math.hypot(forward,across),awa=Math.atan2(-across,-forward);
 return {point,speed,awa,angle:Math.abs(awa),trueSpeed:air.trueSpeed,forward,across};
}
function updateCruiserRig(s,control,env,dt){
 const r=s.cruiserRig??(s.cruiserRig={reef:0,headsail:0,jibSheet:null,extraSheet:null});
 const setting=control.rig??control;
 r.reef=move(r.reef,clamp(Math.round(setting.reef??r.reefTarget??0),0,2),dt*.55);
 r.headsail=move(r.headsail,clamp(Math.round(setting.headsail??r.headsailTarget??0),0,1),dt*.48);
 if(Number.isFinite(setting.reef))r.reefTarget=clamp(Math.round(setting.reef),0,2);
 if(Number.isFinite(setting.headsail))r.headsailTarget=clamp(Math.round(setting.headsail),0,1);
 const automatic=(control.difficulty??env.difficulty)==='easy';
 for(const [key,rate] of [['jibSheet',.56],['extraSheet',.62]]){
  if(automatic){r[key]=null;continue;}
  if(Number.isFinite(setting[key]))r[key]=move(r[key]??s.sheet,clamp(setting[key],0,1),rate*dt);
 }
}
function aero(s,inputEnv,overrideWind){
 if(configFor(s).kind==='foiler'&&root.FoilingPhysics)return root.FoilingPhysics.aero(s,inputEnv,overrideWind);
 const c=configFor(s),env={...environment(inputEnv),waveCurrent:s.seaState??seaTarget(inputEnv),waveCurrentRate:s.seaStateRate||0,waveProfile:s.waveProfile},wind=windForState(s,env,overrideWind),a=axes(s.theta),wf=wind.avx*a.fx+wind.avy*a.fy,wr=wind.avx*a.rx+wind.avy*a.ry;
 const sailPressure=clamp(s.recoveryAeroScale??1,0,1);
 let forceF=0,forceR=0,forceUp=0,cl=0,cd=0,alpha=0,luff=0,stall=0,lift=0,drag=0,rollMoment=0,pitchMoment=0,yawMoment=0,exposure=0;
 const cruiser=s.cruiserRig,mainScale=1-.22*(cruiser?.reef??0),jibScale=Math.sqrt(1-.42*(cruiser?.headsail??0));
 const mainArea=(c.mainArea||c.sailArea)*mainScale,jibArea=(c.jibArea??0)*jibScale**2*(1-(s.spinnaker?.hoist??0)),totalArea=mainArea+jibArea;
 const sectionFlow=c.id==='laser',along=sectionFlow?bodyOffset(s,{x:1,y:0,z:0}):null,across=sectionFlow?bodyOffset(s,{x:0,y:0,z:1}):null;
 const side=s.rig?.side??(Math.abs(s.boom)>.02?Math.sign(s.boom):-1),twist=s.rig?.twist??c.baseTwist*(.6+.4*(1-s.sheet));
 const heelFactor=sectionFlow?1:Math.max(.012,Math.cos(s.heel)**2);
 let mainPressure=0,boomTorque=0;
 const sections=[],actualCamber=(s.rig?.camber??c.camber)*(.55+.45*(s.rig?.fill??1)),mainFraction=mainArea/totalArea,strips=[[5/9,7/45],[3/9,13/27],[1/9,7/9]];
 for(const [weight,height]of strips){
  const beta=s.boom+(s.rig?.sideBlend??side)*twist*height*height+sailFlutter(s.rig,height)*.56,cp={x:c.mastX-c.sailCPChord*(1-height)*1.5*Math.cos(beta),y:c.boomY+c.sailLuff*height*mainScale,z:c.sailCPChord*(1-height)*1.5*Math.sin(beta)},wp=bodyPoint(s,cp),water=waveHeightAt(wp.x,wp.y,s.time,env),exposed=smooth(-.05,.22,wp.z-water);exposure+=exposed*weight;
  const air=sailAirAt(s,env,cp,overrideWind,s.boomRate||0),airF=air.x*a.fx+air.y*a.fy,airR=air.x*a.rx+air.y*a.ry;
  // Project onto the plane normal to the actual mast. The fixed cloth area
  // goes with these sectional polars, so there is no second heel correction.
  const localF=sectionFlow?along.f*airF+along.r*airR+along.up*air.z:airF;
  const localR=sectionFlow?across.f*airF+across.r*airR+across.up*air.z:airR;
  const localSpeed=Math.hypot(localF,localR);
  if(localSpeed<=1e-6)continue;
  const unitF=localF/localSpeed,unitR=localR/localSpeed,cf=-Math.cos(beta),cr=Math.sin(beta);
  const angle=Math.atan2(localF*-cr+localR*cf,localF*cf+localR*cr),coeff=sailCoefficients(angle,c,actualCamber*Math.abs(s.rig?.sideBlend??1));
  const q=.5*c.airDensity*localSpeed**2*mainArea*heelFactor*sailPressure*weight*exposed,L=q*coeff.cl,D=q*coeff.cd;
  const sectionF=-unitR*L+unitF*D,sectionR=unitF*L+unitR*D;
  const ff=sectionFlow?along.f*sectionF+across.f*sectionR:sectionF;
  const rr=sectionFlow?along.r*sectionF+across.r*sectionR:sectionR;
  const up=sectionFlow?along.up*sectionF+across.up*sectionR:0,m=forceMoment(s,cp,ff,rr,up);
  mainPressure+=q;
  if(sectionFlow)boomTorque+=cp.z*sectionF+(c.mastX-cp.x)*sectionR;
  sections.push({height,point:cp,drive:ff,sideForce:rr,vertical:up,alpha:coeff.folded,luff:coeff.luff,stall:coeff.stall,
   airForward:unitF,airRight:unitR,localAirSpeed:localSpeed,apparentSpeed:air.speed,trueSpeed:air.trueSpeed,load:Math.hypot(ff,rr,up)});
  forceF+=ff;forceR+=rr;forceUp+=up;rollMoment+=m.roll;pitchMoment+=m.pitch;yawMoment+=m.yaw;cl+=mainFraction*weight*coeff.cl;cd+=mainFraction*weight*coeff.cd;alpha+=mainFraction*weight*coeff.folded;luff+=mainFraction*weight*coeff.luff;stall+=mainFraction*weight*coeff.stall;lift+=L;drag+=D;
 }
 const mainLuff=luff/mainFraction;
 const main={area:mainArea,trim:s.sheet,centre:{x:c.mastX-c.sailCPChord*Math.cos(s.boom),y:c.boomY+(c.sailCPHeight-c.boomY)*mainScale,z:c.sailCPChord*Math.sin(s.boom)},angle:s.boom,drive:forceF,sideForce:forceR,vertical:forceUp,rollMoment,alpha:alpha/(mainFraction||1),luff:mainLuff,stall:stall/(mainFraction||1),load:clamp(Math.hypot(forceF,forceR,forceUp)/(190*(c.sailArea/7.06)),0,1),side,twist,camber:actualCamber,fill:s.rig?.fill??0,sections,...(sectionFlow?{boomTorque}:{})};let jib=null;
 // The keel yacht has a second, continuously sheeted sail. Its own resultant
 // acts at the configured CP; it does not duplicate the mainsail's area.
 if(c.jibArea){
  const jibSheet=cruiser?.jibSheet??s.sheet;
  const coupled=s.boom*.78+1.2*DEG*Math.tanh(s.boom/(2*DEG));
  const reach=Math.abs(wind.awa??0),windSide=reach<150*DEG&&reach>5*DEG?-Math.sign(wind.awa):Math.sign(s.boom||-1);
  const limit=(76-69*jibSheet)*DEG;
  const base=cruiser?.jibSheet==null?coupled:windSide*Math.min(limit,reach);
  const beta=base+sailFlutter(s.rig,.60,true)*.42;
  const tackY=c.jibTackY??c.deckY,p={x:c.jibTackX+(c.jibCPX-c.jibTackX)*jibScale,y:tackY+(c.jibCPHeight-tackY)*jibScale,z:.65*jibScale*Math.sin(beta)};
  const wp=bodyPoint(s,p),exposed=smooth(-.05,.22,wp.z-waveHeightAt(wp.x,wp.y,s.time,env)),air=sailAirAt(s,env,p,overrideWind);
  const jf=air.x*a.fx+air.y*a.fy,jr=air.x*a.rx+air.y*a.ry,js=Math.hypot(jf,jr);
  const angle=js>1e-6?Math.atan2(jf*-Math.sin(beta)+jr*-Math.cos(beta),jf*-Math.cos(beta)+jr*Math.sin(beta)):0;
  const camber=c.camber*(.63+.37*(s.rig?.jibFill??1)),co=sailCoefficients(angle,c,camber);
  const q=.5*c.airDensity*js**2*jibArea*heelFactor*exposed*sailPressure,L=q*co.cl,Fd=q*co.cd;
  const ff=js>1e-6?(-jr*L+jf*Fd)/js:0,rr=js>1e-6?(jf*L+jr*Fd)/js:0,m=forceMoment(s,p,ff,rr),fraction=jibArea/totalArea;
  forceF+=ff;forceR+=rr;rollMoment+=m.roll;pitchMoment+=m.pitch;yawMoment+=m.yaw;cl+=fraction*co.cl;cd+=fraction*co.cd;alpha+=fraction*co.folded;luff+=fraction*co.luff;stall+=fraction*co.stall;exposure=exposure*mainFraction+exposed*fraction;
  jib={area:jibArea,nominalArea:c.jibArea,trim:jibSheet,angle:beta,alpha:co.folded,cl:co.cl,cd:co.cd,lift:L,drag:Fd,drive:ff,sideForce:rr,rollMoment:m.roll,localAirSpeed:js,localAwa:Math.atan2(-jr,-jf),luff:co.luff,stall:co.stall,
   load:clamp(Math.hypot(ff,rr)/(190*c.jibArea/7.06),0,1),point:p,camber,fill:jibArea>0?s.rig?.jibFill??0:0,side:Math.sign(beta)||side};
 }
 let spinnaker=null;
 if(c.id==='yacht'&&s.spinnaker?.hoist>0){
  const sp=s.spinnaker,profile=B.cruiserSails[sp.type]||B.cruiserSails.spinnaker,nominalArea=c[profile.area],area=nominalArea*sp.hoist;
  const {point,speed,angle,forward,across}=cruiserSailWind(s,c,env,sp.sideBlend,overrideWind);
  const wp=bodyPoint(s,point),exposed=smooth(-.05,.22,wp.z-waveHeightAt(wp.x,wp.y,s.time,env));
  const pressure=.5*c.airDensity*speed**2*area*sailPressure*heelFactor*exposed;
  const load=pressure*clamp(sp.fill/sp.hoist,0,1);
  const reaching=1-smooth(145*DEG,175*DEG,angle);
  // A collapsed sail still presents cloth to the flow. It adds aerodynamic
  // drag while the working jib is rolled away, even after lift has fallen off.
  const luff=clamp(sp.luff??0,0,1);
  const flappingDrag=pressure*.21*smooth(.42,.94,luff)*(1+.032*Math.sin(s.time*9));
  const drag=(profile.drag+(1-reaching)*.17)*load+flappingDrag,lift=profile.lift*reaching*load;
  const uf=forward/Math.max(.01,speed),ur=across/Math.max(.01,speed);
  const ff=uf*drag+Math.abs(ur)*lift,rr=ur*drag-Math.sign(ur)*uf*lift,m=forceMoment(s,point,ff,rr);
  forceF+=ff;forceR+=rr;rollMoment+=m.roll;pitchMoment+=m.pitch;yawMoment+=m.yaw;
  spinnaker={type:sp.type,area,nominalArea,point,fill:sp.fill,luff,drive:ff,sideForce:rr,rollMoment:m.roll,trim:cruiser?.extraSheet??s.sheet,localAirSpeed:speed,localAwa:Math.atan2(-across,-forward),angle};
 }
 const fx=forceF*a.fx+forceR*a.rx,fy=forceF*a.fy+forceR*a.ry,pressure=Math.hypot(forceF,forceR),running=wind.awa!=null&&Math.abs(wind.awa)>125*DEG&&drag>Math.abs(lift)*.55&&forceF>0,flow=wind.aws<.15||luff>.48?'luff':running?'running':stall>.55?'stalled':'attached';
 const qArea=sectionFlow?mainPressure:.5*c.airDensity*wind.aws**2*totalArea*heelFactor*sailPressure*exposure;
 return{wind,main,jib,spinnaker,alpha,cl,cd,lift,drag,qArea,fx,fy,fz:forceUp,drive:forceF,sideForce:forceR,side,load:clamp(pressure/190,0,1),luff,stall,flow,twist,camber:actualCamber,fill:s.rig?.fill??0,cpX:c.mastX-c.sailCPChord*Math.cos(s.boom),cpR:c.sailCPChord*Math.sin(s.boom),rollMoment,pitchMoment,yawMoment,exposure};
}
function foil(u,v,angle,area,model,ventilation=0){const c=model?configFor(model):CONFIG;
 const speed=Math.hypot(u,v);if(speed<1e-8)return{forward:0,side:0,power:0,speed:0,alpha:0,stall:0};
 const wf=-u/speed,wr=-v/speed,cf=-Math.cos(angle),cr=Math.sin(angle);
 const alpha=Math.atan2(wf*-cr+wr*cf,wf*cf+wr*cr),fold=.5*Math.atan2(Math.sin(2*alpha),Math.cos(2*alpha)),stall=smooth(14*DEG,29*DEG,Math.abs(fold));
 const attached=c.foilCLMax*Math.tanh(c.foilLiftSlope*fold/c.foilCLMax);
 const cl=((1-stall)*attached+stall*.85*Math.sin(2*alpha))*(1-.82*ventilation);
 const profile=c.foilProfileCD??.008,induced=c.foilInducedCD*cl*cl,stallCD=1.12*Math.sin(alpha)**2*stall,cd=profile+induced+stallCD;
 const q=.5*c.waterDensity*area*speed*speed,forward=q*(-wr*cl+wf*cd),side=q*(wf*cl+wr*cd);
 return{forward,side,power:forward*u+side*v,speed,alpha:fold,stall,profileDrag:q*profile,inducedDrag:q*induced,stallDrag:q*stallCD};
}
function appendageBlade(s,a,model,blade,angle,env,dt,previous,waterInertia){
 const along=bodyOffset(s,{x:1,y:0,z:0}),across=bodyOffset(s,{x:0,y:0,z:1}),span=bodyOffset(s,{x:0,y:1,z:0});
 const verticalSpan=blade.root-blade.tip,band=verticalSpan/4,moment={roll:0,pitch:0,yaw:0};
 const load={forward:0,side:0,vertical:0,power:0,speed:0,wet:0,stall:0,axialSpeed:0,axialFlow:0,crossFlow:0,steeringPressure:0,ventilation:0,profileDrag:0,inducedDrag:0,stallDrag:0};
 let airSupply=0,wetSpan=0,wetCentre=0,wetAcceleration=0;
 for(let i=0;i<4;i++){
  const fraction=(i+.5)/4,p={x:blade.x,y:blade.root-fraction*verticalSpan,z:blade.z??0};
  const contact=waterContact(s,p,env);
  const surfaceSpan=span.up-contact.dx*(span.f*a.fx+span.r*a.rx)-contact.dy*(span.f*a.fy+span.r*a.ry);
  const immersed=clamp(.5+contact.depth/Math.max(.036,band*Math.abs(surfaceSpan)),0,1);
  if(!immersed)continue;
  const areaFraction=immersed*(1+(blade.taper-1)*fraction)/(2*(1+blade.taper));
  const f=contact.relativeX*a.fx+contact.relativeY*a.fy,r=contact.relativeX*a.rx+contact.relativeY*a.ry,up=contact.relativeZ;
  const u=along.f*f+along.r*r+along.up*up,v=across.f*f+across.r*r+across.up*up;
  const nearSurface=1-smooth(blade.chord*.35,blade.chord*1.5,contact.depth);
  const ventilation=(previous?.ventilation||0)*(.30+.70*nearSurface);
  const force=foil(u,v,angle,blade.area*areaFraction,model,ventilation);
  const forward=along.f*force.forward+across.f*force.side,side=along.r*force.forward+across.r*force.side,vertical=along.up*force.forward+across.up*force.side;
  const q=bodyOffset(s,p),m=forceMoment(s,p,forward,side);
  if(waterInertia){
   const length=immersed*band;
   wetSpan+=length;wetCentre+=q.f*length;
   wetAcceleration+=(contact.waterAx*a.rx+contact.waterAy*a.ry)*length;
  }
  moment.yaw+=m.yaw;moment.roll+=m.roll+q.dHeel*vertical;moment.pitch+=m.pitch+q.dPitch*vertical;
  load.forward+=forward;load.side+=side;load.vertical+=vertical;load.power+=force.power;load.wet+=areaFraction;
  load.profileDrag+=force.profileDrag??0;load.inducedDrag+=force.inducedDrag??0;load.stallDrag+=force.stallDrag??0;
  load.axialSpeed+=Math.abs(u)*areaFraction;load.speed+=force.speed*areaFraction;load.stall+=force.stall*areaFraction;
  load.axialFlow+=u*areaFraction;load.crossFlow+=v*areaFraction;
  load.steeringPressure+=u*u*areaFraction*(1-.82*ventilation)*(1-.55*force.stall)*Math.abs(across.r);
  airSupply=Math.max(airSupply,immersed*nearSurface*force.stall*smooth(.65,2.1,force.speed));
 }
 if(load.wet>0){load.axialSpeed/=load.wet;load.speed/=load.wet;load.stall/=load.wet;load.axialFlow/=load.wet;load.crossFlow/=load.wet;}
 // Surface air spreads quickly under high incidence. Rewetting restores lift
 // over several steps, even after the pressure/immersion has improved.
 const air=previous?.ventilation||0;
 load.ventilation=air+(airSupply-air)*(1-Math.exp(-dt/(airSupply>air?.09:.37)));
 if(wetSpan>0){
  // Broadside added mass of a thin plate with an end correction for a short wet span.
  const normal=across.r*Math.cos(angle)+along.r*Math.sin(angle);
  const mass=model.waterDensity*PI*(blade.chord*.5)**2*wetSpan**2/(wetSpan+blade.chord*.5)*normal**2;
  addSwayWaterMass(waterInertia,mass,wetCentre/wetSpan,wetAcceleration/wetSpan);
 }
 return {load,moment};
}
// Each soft rig sets the curvature of its control scale. Solver, replay and
// network values all stay in physical actuator travel, with linear wing trim.
function sheetFromTrim(trim,model){
 const t=clamp(trim,0,1);
 return t+(configFor(model).sheetCurve??0)*t*(1-t);
}
function trimFromSheet(sheet,model){
 const s=clamp(sheet,0,1);
 const curve=configFor(model).sheetCurve??0;
 if(!curve||s===0||s===1)return s;
 const b=1+curve;
 return 2*s/(b+Math.sqrt(b*b-4*curve*s));
}
// Control travel for one step of hauling. Taper in display units so small
// line movements near full trim do not make the percentage run away.
function haulSheetTravel(sheet,model,dt){
 const trim=trimFromSheet(sheet,model);
 const rate=.58-.40*smooth(.35,.70,trim);
 return Math.max(0,sheetFromTrim(trim+rate*dt,model)-sheet);
}
function easeSheetTravel(sheet,model,rawRate,dt){
 const c=configFor(model),trim=trimFromSheet(sheet,c);
 // Match the maximum slope of the trim curve so the readout has a constant
 // speed and the physical travel stays within the rig's release rate.
 const rate=rawRate/(1+(c.sheetCurve??0));
 return sheetFromTrim(trim-rate*dt,c)-sheet;
}
function boomLimit(sheet,model){
 const c=configFor(model);
 return c.boomMax+(c.boomMin-c.boomMax)*clamp(sheet,0,1);
}
function sheetRateFor(c,trim,fast,difficulty){
 if(trim<0&&fast)return c.sheetReleaseKeyRate??.5;
 if(trim<0&&difficulty!=='easy'&&c.sheetReleaseRate)return c.sheetReleaseRate;
 return fast?.5:c.sheetRate;
}
function updateSheet(s,c,control,env,dt){
 const trim=clamp(control.trim||0,-1,1);
 const rate=sheetRateFor(c,trim,control.trimFast,control.difficulty??env.difficulty);
 s.sheet=clamp(s.sheet+trim*rate*clamp(env.controlRate??1,.35,2)*dt,0,1);
}
// The sheet only pulls toward the centre. It becomes taut outside its stop;
// a small bounded stretch and outward damping avoid snapping the rig on trim.
function sheetTorque(s,limit,c){
 const side=Math.sign(s.boom)||1,stretch=Math.max(0,Math.abs(s.boom)-limit);
 if(!stretch)return 0;
 const outward=Math.max(0,side*(s.boomRate||0));
 const damping=c.rigidWing?1:smooth(0,DEG,stretch);
 return -side*c.boomInertia*(120*stretch+15*outward*damping);
}
// A right input turns the bow to starboard while moving forward. The actual
// blade keeps its speed and travel limits on both difficulty settings.
function updateHelm(s,controls,inputEnv,dt){
 const c=configFor(s),env=environment(inputEnv),a=axes(s.theta);
 const p={x:c.rudderX,y:c.rudderY??(c.deckY-c.rudderDepth*.62),z:0},flow=waterVelocity(s);
 let u=pointMotion(s,bodyOffset(s,p),a).f-flow.x*a.fx-flow.y*a.fy;
 if(c.waterBlades){
  const previous=s.forces?.rudder;
  if(previous?.wet>.04&&Number.isFinite(previous.axialFlow))u=previous.axialFlow;
  else{
   const blade=c.waterBlades.rudder;
   const stream=waterContact(s,{...p,y:blade.root+.65*(blade.tip-blade.root)},
    {...env,waveCurrent:s.seaState,waveCurrentRate:s.seaStateRate||0,waveProfile:s.waveProfile});
   const along=bodyOffset(s,{x:1,y:0,z:0});
   const f=stream.relativeX*a.fx+stream.relativeY*a.fy,r=stream.relativeX*a.rx+stream.relativeY*a.ry;
   u=along.f*f+along.r*r+along.up*stream.relativeZ;
  }
 }
 if(s.helmFlowSign!==1&&s.helmFlowSign!==-1)s.helmFlowSign=u<-.20?-1:1;
 if(u < -c.helmReverseThreshold)s.helmFlowSign=-1;else if(u>c.helmForwardThreshold)s.helmFlowSign=1;
 const steer=clamp(controls.steer||0,-1,1),sign=Math.sign(steer),previousSign=Math.sign(s.steerIntent||0),digital=controls.steerDigital!==false;
 s.helmHoldSeconds=sign&&sign===previousSign?(s.helmHoldSeconds||0)+dt:sign?dt:0;s.steerIntent=steer;
 const sensitivity=clamp(env.controlSensitivity??1,.35,1.8),rate=clamp(env.controlRate??1,.35,2);
 const flight=c.kind==='foiler'?(1-smooth(.015,.30,s.foiling?.hullWetFraction??1))*smooth(-.05,.22,s.foiling?.clearance??-.2):0;
 const initial=c.helmInitialFraction+flight*((c.helmFlightInitialFraction??c.helmInitialFraction)-c.helmInitialFraction);
 const growth=c.helmGrowthSeconds+flight*((c.helmFlightGrowthSeconds??c.helmGrowthSeconds)-c.helmGrowthSeconds);
 const progressive=1-(1-initial)*Math.exp(-s.helmHoldSeconds/growth);
 const demand=digital?steer*progressive:sign*Math.pow(Math.abs(steer),1.25-.37*flight);
 const easy=(controls.difficulty??env.difficulty)==='easy',speed=Math.hypot(s.vx-flow.x,s.vy-flow.y);
 const waterborneMax=c.waterborneRudderMax??c.rudderMax;
 // Give the player extra blade travel to finish a slow turn after touching down.
 const slowTravel=easy?(1-flight)*(1-smooth(3.8,8.5,speed))*((c.easySlowRudderMax??waterborneMax)-waterborneMax):0;
 const travel=waterborneMax+flight*(c.rudderMax-waterborneMax)+slowTravel;
 const available=travel*(c.helmMinimumFraction+(1-c.helmMinimumFraction)/(1+(u/c.helmSpeedReference)**2));
 s.helmTarget=clamp(demand*sensitivity,-1,1)*available*s.helmFlowSign;
 s.helmMaximum=available;s.helmDigital=digital;
 s.rudder=move(s.rudder,s.helmTarget,(sign?c.rudderRate:c.rudderCenterRate)*rate*dt);
 s.steering={mode:'rudder',input:steer,targetRudder:s.helmTarget,localForward:u,flowSign:s.helmFlowSign};

 // Backing the sail is a separate, opt-in manoeuvre for getting out of irons.
 let gate=0,angle=PI;
 if(easy&&env.ironsHelp&&!s.capsized&&!s.recovering&&Math.abs(steer)>.08){
  const wind=windForState(s,env);
  angle=Math.abs(wind.twa??PI);
  if(wind.tws>.6)gate=(1-smooth(c.ironsSpeed*.45,c.ironsSpeed,speed))*(1-smooth(c.ironsAngle-12*DEG,c.ironsAngle,angle));
 }
 const level=gate?move(s.helmAssist?.level||0,gate,dt/.65):0,active=level>.025;
 s.helmAssist={active,level,backAngle:active?steer*Math.min(c.ironsBackAngle,boomLimit(s.sheet,c))*(1-smooth(15*DEG,30*DEG,angle)):0};
}
function backingBoomTorque(s,c){const h=s.helmAssist;if(!h?.active||Math.abs(s.wind?.twa||0)>30*DEG)return 0;return clamp((h.backAngle-s.boom)*c.boomInertia*20-s.boomRate*c.boomInertia*4,-c.mass*1.2,c.mass*1.2)*h.level;}
function updateBoom(s,c,sail,env,dt,lively){
 const limit=boomLimit(s.sheet,c),awa=sail.wind.awa,side=Math.sign(s.boom),rig=s.rig;
 const hardBoom=lively&&!c.rigidWing&&sail.wind.aws>1;
 const sternMargin=hardBoom?4*DEG:c.gybeHysteresis;
 const openEnough=Math.abs(s.boom)>(hardBoom?28:35)*DEG;
 if(!s.capsized&&!s.recovering&&awa!=null&&Math.abs(awa)>120*DEG&&
   Math.abs(awa)<PI-sternMargin&&openEnough&&Math.sign(awa)===side&&!s.gybeTarget){
  s.gybeTarget=-side;s.gybeCount++;
  if(hardBoom){rig.gybeSide=-side;rig.gybeUntil=s.time+2.2;}
 }
 if(s.gybeTarget&&s.boom*s.gybeTarget>Math.min(.8*limit,42*DEG))s.gybeTarget=0;
 const swing=hardBoom&&(rig.gybeUntil??0)>s.time;
 const arm=c.kind==='foiler'?2.4:.84;
 const main=sail.main??sail,oldRate=s.boomRate;
 const airTorque=main.boomTorque??arm*(main.drive*Math.sin(s.boom)+main.sideForce*Math.cos(s.boom));
 const across=s.gybeTarget||0;
 // The old pressure on the belly collapses as air hits the back of the cloth.
 const attached=hardBoom&&airTorque*across<0?.30:1;
 const backPressure=c.gybeTorqueCoefficient+(swing&&c.kind==='foiler'?c.boomLength*.16:0);
 const gybeTorque=across*sail.qArea*backPressure;
 const damping=c.boomDamping*(swing?(c.kind==='foiler'?.70:.46):1);
 const lineTorque=sheetTorque(s,limit,c);
 const torque=attached*airTorque+gybeTorque+backingBoomTorque(s,c)+lineTorque
  -damping*oldRate+(root.SailingRecovery?.boomTorque(s,env)||0);
 const rateLimit=5.5;
 const speed=clamp(oldRate+torque/c.boomInertia*dt,-rateLimit,rateLimit);
 const stop=Math.min(c.boomMax,limit+5*DEG);
 let stopTorque=0;
 if(c.rigidWing){
  // The rigid wing retains its own rotation stops and flap actuator.
  const next=s.boom+speed*dt;
  s.boom=clamp(next,-stop,stop);
  s.boomRate=next!==s.boom&&speed*next>0?0:speed;
 }else{
  // Limit angular velocity at the moving stop. Releasing the line cannot
  // accelerate the boom outwards. A haul that takes up slack moves it with
  // the stop, so the actual rotation also reaches the sectional wind model.
  // A restored position may already be outside the current stop. Bring it
  // back at the rig's maximum rotation speed instead of jumping in one tick.
  s.boomRate=clamp(clamp(speed,(-stop-s.boom)/dt,(stop-s.boom)/dt),-rateLimit,rateLimit);
  s.boom+=s.boomRate*dt;
  stopTorque=c.boomInertia*(s.boomRate-speed)/dt;
  const lineMoment=Math.abs(lineTorque+(stop<c.boomMax?stopTorque:0));
  s.sheetLoad={limit,stop,taut:lineMoment>1e-6,momentNm:lineMoment,mechanicalStop:stop===c.boomMax&&stopTorque!==0};
 }
 rig.gybeImpact=(rig.gybeImpact??0)*Math.exp(-dt/.30);
 if(swing&&rig.gybeSide&&s.boom*rig.gybeSide>=limit&&speed*rig.gybeSide>.36){
  rig.gybeImpact=Math.max(rig.gybeImpact,smooth(.36,2.3,Math.abs(speed)));
  rig.gybeSide=0;
 }
 // The hull takes the opposite change in the boom's angular momentum.
 // Aerodynamic moments have already been counted once, at the sail.
 const reaction=swing?-c.boomInertia*(s.boomRate-oldRate)/dt:0;
 return {torque:torque+stopTorque,reaction,limit};
}
function refresh(s,env){if(configFor(s).kind==='foiler'&&root.FoilingPhysics)return root.FoilingPhysics.refresh(s,env);s.sail=aero(s,env);s.wind=s.sail.wind;s.speed=Math.hypot(s.vx,s.vy);return s;}
function createState(overrides,inputEnv){
 if(configFor(overrides?.boatId||inputEnv?.boatId).kind==='foiler'){if(!root.FoilingPhysics)throw Error('Foilmodellen er ikke indlæst.');return root.FoilingPhysics.createState(overrides,inputEnv);}
 const env=environment(inputEnv),o=overrides||{},boatId=B.get(o.boatId||env.boatId).id,c=configFor(boatId),theta=(90-env.direction)*DEG-90*DEG,sheet=.35,boom=boomLimit(sheet,c),a=axes(theta),pose=env.crewPose??2;
 const s=Object.assign({boatId,x:0,y:0,vx:1.5*a.fx,vy:1.5*a.fy,theta,omega:0,heel:0,heelRate:0,pitch:0,pitchRate:0,heave:0,heaveVelocity:0,rudder:0,sheet,boom,boomRate:0,crewPose:pose,crewPoseBlend:pose,crewSide:-1,crewSideBlend:-1,crewTackFrom:0,crewSwim:0,time:0,capsized:false,recovering:false,recovery:0,cockpitWet:0,seaState:seaTarget(env),gybeTarget:0,gybeCount:0,tackCount:0,lastTackSide:0,waterX:0,waterY:0,forces:{}},o);
 const wind=windForState(s,env);
 if(o.crew!=null){s.crewSide=Math.sign(o.crew);s.crewSideBlend=s.crewSide;}
 if(o.crew==null&&o.crewSide==null)s.crewSide=windwardCrewSide(wind)||s.crewSide;
 if(o.crewSideBlend==null)s.crewSideBlend=s.crewSide;
 if((c.id==='laser'||c.racingYacht)&&o.boom==null){
  const from=wind.awa??0,side=Math.abs(from)>7*DEG&&Math.abs(from)<175*DEG?Math.sign(from):Math.sign(s.crewSide)||-1;
  s.boom=-side*Math.min(boomLimit(s.sheet,c),Math.abs(from));
 }
 advanceWaveProfile(s,env);updateCrew(s,{crewPose:s.crewPose}, {...env,autoBalance:false},0);
 if(o.heave==null)s.heave=equilibriumHeave(s,env);s.hydro=hydrostatics(s,env);s.massMotion=null;refresh(s,env);return s;
}
function updateCruiserSail(s,controls,env,c,dt){
 const sp=s.spinnaker||(s.spinnaker={type:'spinnaker',hoist:0,fill:0,luff:0,side:-1,sideBlend:-1,unsafe:0,phase:'down'});
 const easy=(controls.difficulty??env.difficulty)==='easy';
 const choice=Object.hasOwn(B.cruiserSails,controls.downwindType)?controls.downwindType:'spinnaker';
 const selected=s.capsized||s.recovering?null:typeof controls.spinnaker==='boolean'
  ?(controls.spinnaker?choice:null):(sp.selected??(sp.requested?sp.type:null));
 const wasDown=sp.hoist===0;
 if(wasDown){
  if(selected&&sp.type!==selected){sp.type=selected;sp.fill=0;sp.luff=0;}
  sp.dousing=false;
 }
 const profile=B.cruiserSails[sp.type]||B.cruiserSails.spinnaker,asymmetric=sp.type!=='spinnaker';
 const {speed,awa,angle,trueSpeed}=cruiserSailWind(s,c,env,sp.sideBlend);
 const tooStrong=speed>profile.maxWind;
 const wait=speed<.65||trueSpeed<.65?'wind':tooStrong?'strong':angle<profile.open*DEG?'course':null;
 const wantedHere=selected===sp.type;
 if(!easy)sp.dousing=false;
 const holding=wantedHere&&sp.requested&&!wasDown&&!sp.dousing;
 const unsafe=tooStrong||angle<profile.close*DEG||trueSpeed<.4;
 sp.unsafe=easy&&holding?(unsafe?(sp.unsafe||0)+dt:Math.max(0,(sp.unsafe||0)-2*dt)):0;
 if(sp.unsafe>=4)sp.dousing=true;
 sp.requested=Boolean(wantedHere&&!sp.dousing&&(!easy||holding||!wait));
 sp.selected=selected;
 sp.waitingFor=easy&&wantedHere&&!sp.requested?wait:null;
 sp.hoist=move(sp.hoist,sp.requested?1:0,dt/4);

 // The asymmetric sails set to leeward, with a deadband on a dead run.
 if(speed>.5&&Math.abs(Math.sin(awa))>.08){
  if(asymmetric)sp.side=-Math.sign(awa);
  else if(angle>100*DEG&&angle<165*DEG)sp.side=Math.sign(awa);
 }
 if(wasDown&&asymmetric)sp.sideBlend=sp.side;
 else sp.sideBlend+=(sp.side-sp.sideBlend)*(1-Math.exp(-dt/1.5));

 const manualSheet=s.cruiserRig?.extraSheet,selectedSheet=manualSheet??s.sheet;
 const retainedTension=manualSheet==null?1:smooth(0,.24,selectedSheet);
 const trim=retainedTension*clamp(1-Math.abs(selectedSheet-profile.sheet)*1.25,0,1);
 const shadow=1-profile.shadowLoss*smooth(profile.shadow*DEG,178*DEG,angle);
 // During a gybe the cloth briefly collapses as the clew crosses the bow.
 const settled=smooth(.12,.76,sp.side*sp.sideBlend);
 const angleSupport=smooth(profile.close*DEG,profile.full*DEG,angle);
 const support=angleSupport*trim*shadow*settled;
 const fill=sp.hoist*support*smooth(.5,3,speed);
 const timeConstant=fill>=sp.fill?1.05:.42;
 sp.fill=sp.hoist>0?sp.fill+(fill-sp.fill)*(1-Math.exp(-dt/timeConstant)):0;
 // A modest trim or shadow loss reduces drive without making a loaded sail
 // flog. Luffing builds when the sail is too close to the wind or loses tension.
 const slack=smooth(.13,.46,profile.sheet-selectedSheet),blanketed=smooth(.22,.65,1-shadow);
 const luff=Math.max(1-retainedTension,1-angleSupport*settled,.76*slack,.72*blanketed)*smooth(.25,2,speed);
 sp.luff=sp.hoist>0?(sp.luff??0)+(luff-(sp.luff??0))*(1-Math.exp(-dt/.27)):0;
 const curl=sp.type==='code0'?.007:sp.type==='gennaker'?.012:.048;
 const loose=sp.type==='code0'?.10:sp.type==='gennaker'?.145:.19;
 const flutter=sp.hoist*smooth(.65,9,speed)*(curl+loose*smooth(.30,.93,sp.luff));
 sp.flutter=sp.hoist>0?(sp.flutter??0)+(flutter-(sp.flutter??0))*(1-Math.exp(-dt/.28)):0;
 sp.phase=sp.requested?(sp.hoist>=.999?'up':'raising'):sp.hoist>0?'lowering':sp.waitingFor?'waiting':'down';
}
function step(s,controls,inputEnv,dt){
 if(configFor(s).kind==='foiler')return root.FoilingPhysics.step(s,controls,inputEnv,dt);
 const env=environment(inputEnv),c=configFor(s),rescueActive=!!root.SailingRecovery?.active(s),ctrl=rescueActive?{steer:0,trim:0,crewPose:1,crew:0}:controls||{},h=dt==null?c.fixedDt:Math.max(0,Math.min(dt,.05));if(h===0)return s;
 s.time+=h;advanceSea(s,env,h);
 updateSheet(s,c,ctrl,env,h);
 if(rescueActive){s.rudder=move(s.rudder,0,h*c.rudderCenterRate);s.helmTarget=0;}else updateHelm(s,ctrl,env,h);
 const lively=(ctrl.difficulty??env.difficulty)!=='easy'&&!rescueActive&&!s.capsized;
 updateRig(s,c,h,lively);
 if(c.id==='yacht'){updateCruiserRig(s,ctrl,env,h);updateCruiserSail(s,ctrl,env,c,h);}
 let sail=aero(s,env);const awa=sail.wind.awa;
 const boom=updateBoom(s,c,sail,env,h,lively);
 if(awa!=null&&Math.abs(awa)<100*DEG&&Math.abs(awa)>12*DEG){const side=Math.sign(awa);if(s.lastTackSide&&side!==s.lastTackSide&&Math.abs(awa)<60*DEG)s.tackCount++;s.lastTackSide=side;}
 updateCrew(s,ctrl,env,h,sail);
 sail=aero(s,env);const a=axes(s.theta),wetEnv={...env,waveCurrent:s.seaState,waveCurrentRate:s.seaStateRate||0,waveProfile:s.waveProfile};
 const waterInertia=c.id==='laser'?{sway:0,firstMoment:0,secondMoment:0,incidentSway:0,incidentFirstMoment:0}:null;
 const blades=c.waterBlades,offsets=c.rudderOffsets??[0];
 const {load:board,moment:bMoment}=appendageBlade(s,a,c,blades.board,0,wetEnv,h,s.forces?.board,waterInertia);
 const rudders=offsets.map((z,i)=>{
  const blade={...blades.rudder,z,area:blades.rudder.area/offsets.length};
  const prior=s.forces?.rudder?.parts?.[i]??s.forces?.rudder;
  return appendageBlade(s,a,c,blade,s.rudder,wetEnv,h,prior,waterInertia);
 });
 const rudder={parts:rudders.map(({load},i)=>({...load,x:blades.rudder.x,z:offsets[i],area:blades.rudder.area/offsets.length}))};
 for(const key of Object.keys(rudders[0].load)){
  const total=rudders.reduce((sum,r)=>sum+r.load[key],0);
  rudder[key]=['forward','side','vertical','power','profileDrag','inducedDrag','stallDrag'].includes(key)?total:total/offsets.length;
 }
 const rMoment={roll:0,pitch:0,yaw:0};
 for(const {moment} of rudders)for(const axis of ['roll','pitch','yaw'])rMoment[axis]+=moment[axis];
 const hydro=hydrostatics(s,env),wetRig=hydro.rigWet;
 const planing=c.planing?planingLoad(s,c,a,wetEnv,hydro):null,planingLift=planing?.lift??0,planingDrag=planing?.drag??0;
 const planingSurge=planing?.surge??0,planingMoment=planing?.moment??{roll:0,pitch:0,yaw:0};
 const dynamicSupport=clamp(planingLift/(hydro.buoyancy+planingLift||1),0,.72);
 const resistance=hullResistance(s,c,a,wetEnv,wetRig,dynamicSupport,waterInertia),hullF=resistance.f,hullR=resistance.r;
 const forceF=sail.drive+board.forward+rudder.forward+hullF+planingSurge,forceR=sail.sideForce+board.side+rudder.side+hullR;
 const damping=clamp(env.motionDamping??1,.35,2),yawDamping=(-c.yawLinearDamping*s.omega-c.yawQuadraticDamping*s.omega*Math.abs(s.omega)-wetRig*c.rigYawDamping*s.omega)*damping;
 const ground=root.SailingWorld?.contact(s,c,env)||{fx:0,fy:0,fz:0,yaw:0,roll:0,pitch:0,contact:false,depth:80,distance:Infinity};s.ground=ground;
 const crewSegments=(s.crewJoints||B.crewPoseAt(s)).segments;
 const inertiaYaw=c.yawInertia+crewSegments.reduce((sum,v)=>sum+v.mass*(v.p.x*v.p.x+v.p.z*v.p.z),0);
 const physicalYaw=sail.yawMoment+bMoment.yaw+rMoment.yaw+planingMoment.yaw+resistance.yaw+yawDamping+ground.yaw+hydro.waveYaw;
 const waterDrive=hydro.waveFx*a.fx+hydro.waveFy*a.fy,waterSide=hydro.waveFx*a.rx+hydro.waveFy*a.ry;
 const rollDamping=-(c.rollDamping+wetRig*c.rigRollDamping)*s.heelRate*damping,pitchDamping=-(c.pitchDamping+wetRig*c.rigPitchDamping)*s.pitchRate*damping;
 let rollMoment=sail.rollMoment+bMoment.roll+rMoment.roll+planingMoment.roll+resistance.roll+hydro.roll+rollDamping+ground.roll,pitchMoment=sail.pitchMoment+bMoment.pitch+rMoment.pitch+planingMoment.pitch+resistance.pitch+hydro.pitch+pitchDamping+ground.pitch;
 // The articulated segments are the same mass points used by gravity and
 // rendering. Summing their parallel-axis terms preserves the spread within
 // each sailor and between crew members; a single crew centroid loses it.
 const inertiaRoll=c.rollInertia+crewSegments.reduce((sum,v)=>sum+v.mass*(v.p.y*v.p.y+v.p.z*v.p.z),0),inertiaPitch=c.pitchInertia+crewSegments.reduce((sum,v)=>sum+v.mass*(v.p.x*v.p.x+v.p.y*v.p.y),0);
 const vertical=hydro.vertical+sail.fz+planingLift+ground.fz+(board.vertical||0)+(rudder.vertical||0);
 const rollPhysical=rollMoment,pitchPhysical=pitchMoment,rescue=root.SailingRecovery?.forces(s,env,{roll:inertiaRoll,pitch:inertiaPitch,yaw:inertiaYaw,mass:c.mass,physicalRoll:rollPhysical,physicalPitch:pitchPhysical,physicalYaw,physicalFz:vertical})||{roll:0,pitch:0,yaw:0,fx:0,fy:0,fz:0};
 const recoveryRoll=rescue.roll,recoveryPitch=rescue.pitch,yawMoment=physicalYaw+boom.reaction+rescue.yaw;rollMoment+=recoveryRoll;pitchMoment+=recoveryPitch;
 const force={x:forceF*a.fx+forceR*a.rx+ground.fx+rescue.fx+hydro.waveFx,y:forceF*a.fy+forceR*a.ry+ground.fy+rescue.fy+hydro.waveFy,z:vertical+rescue.fz};
 let balance;
 if(env.forceDiagnostics){
  const cg=hydro.cg,arm=bodyOffset(s,cg).dHeel;
  balance={
   sailRoll:sail.rollMoment-forceMoment(s,cg,sail.drive,sail.sideForce,sail.fz).roll,
   staticRoll:hydro.rollBuoyancy+hydro.rollRigBuoyancy+hydro.rollGravity-arm*(hydro.buoyancy-hydro.weight),
   netRoll:rollMoment-forceMoment(s,cg,force.x*a.fx+force.y*a.fy,force.x*a.rx+force.y*a.ry,force.z).roll
  };
 }
 integrateMass(s,h,c.mass,hydro.cg,{roll:inertiaRoll,pitch:inertiaPitch,yaw:inertiaYaw},force,{roll:rollMoment,pitch:pitchMoment,yaw:yawMoment},waterInertia,balance);
 const floodTarget=smooth(.025,-.065,hydro.coamingClearance);s.cockpitWet+=(floodTarget-s.cockpitWet)*(1-Math.exp(-h/(floodTarget>s.cockpitWet?c.floodFillSeconds:c.floodDrainSeconds)));
 if(!s.capsized&&Math.abs(wrap(s.heel))>c.capsizeAngle){s.capsized=true;s.gybeTarget=0;}
 s.hydro=hydro;s.hydro.cockpitWet=s.cockpitWet;
 s.forces={forward:forceF+waterDrive+(ground.fx+rescue.fx)*a.fx+(ground.fy+rescue.fy)*a.fy,side:forceR+waterSide+(ground.fx+rescue.fx)*a.rx+(ground.fy+rescue.fy)*a.ry,world:force,hullF,hullR,skinF:resistance.skinF,ownWaveF:resistance.ownWaveF,waveForward:waterDrive,planingLift,planingDrag,planingSurge,planingRelativeRise:planing?.rise??0,planingPower:planing?.power??0,board,rudder,yaw:yawMoment,yawSail:sail.yawMoment,yawBoard:bMoment.yaw,yawRudder:rMoment.yaw,yawDamping,yawAssist:0,yawPhysical:physicalYaw,yawRecovery:rescue.yaw,ground,roll:rollMoment,rollPhysical,pitchPhysical,rollSail:sail.rollMoment,rollCrew:hydro.rollCrew,rollHull:hydro.rollBuoyancy+hydro.rollGravity-hydro.rollCrew,rollHydro:bMoment.roll+rMoment.roll+hydro.rollRig,rollDamping:rollDamping+hydro.rollHydroDamping,pitch:pitchMoment,vertical:vertical+rescue.fz,recoveryVertical:rescue.fz,recoveryDrag:{x:rescue.fx,y:rescue.fy},buoyancy:hydro.buoyancy,weight:hydro.weight,recoveryRoll,recoveryPitch,inertiaRoll,inertiaPitch,inertiaYaw,boomTorque:boom.torque,boomReaction:boom.reaction,sheetTension:Math.abs(s.boom)>=boom.limit-.001?Math.abs(boom.torque):0};
 if(env.forceDiagnostics){
  s.forces.balance=balance;
  s.forces.waterInertia=waterInertia;
  const ledger=(forward,side,up,roll,pitch,yaw)=>({force:{x:forward*a.fx+side*a.rx,y:forward*a.fy+side*a.ry,z:up},moment:{roll,pitch,yaw}});
  const at=(load,m)=>ledger(load.forward,load.side,load.vertical??0,m.roll,m.pitch,m.yaw);
  s.forces.ledger={
   sail:ledger(sail.drive,sail.sideForce,sail.fz,sail.rollMoment,sail.pitchMoment,sail.yawMoment),
   hull:ledger(hullF,hullR,0,resistance.roll,resistance.pitch,resistance.yaw),
   board:at(board,bMoment),rudder:at(rudder,rMoment),planing:at({forward:planingSurge,side:0,vertical:planingLift},planingMoment),
   buoyancyAndDamping:ledger(0,0,hydro.vertical+hydro.weight,hydro.roll-hydro.rollGravity-hydro.waveRoll+rollDamping,hydro.pitch-hydro.pitchGravity-hydro.wavePitch+pitchDamping,yawDamping),
   gravity:ledger(0,0,-hydro.weight,hydro.rollGravity,hydro.pitchGravity,0),
   wave:ledger(waterDrive,waterSide,0,hydro.waveRoll,hydro.wavePitch,hydro.waveYaw),
   ground:{force:{x:ground.fx,y:ground.fy,z:ground.fz},moment:{roll:ground.roll,pitch:ground.pitch,yaw:ground.yaw}},
   boom:ledger(0,0,0,0,0,boom.reaction),assist:{force:{x:rescue.fx,y:rescue.fy,z:rescue.fz},moment:{roll:rescue.roll,pitch:rescue.pitch,yaw:rescue.yaw}}
  };
 }
 root.SailingRecovery?.postStep(s,env);if(root.SailingRecovery?.active(s)&&s.recoveryState.fallback)s.hydro=hydrostatics(s,env,false);return refresh(s,env);
}
function recover(s,env,nowMs){const R=root.SailingRecovery;if(!R)throw Error('Opretningsmodellen er ikke indlæst.');R.start(s,env,nowMs);return s;}
function instruments(s,target,env){const a=axes(s.theta),w=s.wind,speed=Math.hypot(s.vx,s.vy);
 const logSpeed=Math.hypot(s.vx-(s.waterX||0),s.vy-(s.waterY||0));
 const flow=waterVelocity(s,env?waveAt(s.x,s.y,s.time,{...env,waveCurrent:s.seaState,waveProfile:s.waveProfile},Math.max(0,-s.heave)):undefined),waterX=s.vx-flow.x,waterY=s.vy-flow.y,waterSpeed=Math.hypot(waterX,waterY);let distance=null,vmg=null,bearing=null;if(target){const dx=target.x-s.x,dy=target.y-s.y;distance=Math.hypot(dx,dy);vmg=distance>1e-8?(s.vx*dx+s.vy*dy)/distance:0;bearing=wrap360(Math.atan2(dx,dy)/DEG);}return{speed,knots:speed*1.9438444924,waterSpeed,waterKnots:waterSpeed*1.9438444924,logKnots:logSpeed*1.9438444924,heading:wrap360(90-s.theta/DEG),course:speed>.03?wrap360(Math.atan2(s.vx,s.vy)/DEG):null,leeway:waterSpeed>.03?Math.atan2(waterX*a.rx+waterY*a.ry,waterX*a.fx+waterY*a.fy):null,tws:w.tws,twd:w.twd,twa:w.twa,aws:w.aws,awa:w.awa,heel:s.heel,sheet:s.sheet,boom:s.boom,distance,vmg,bearing,boatId:s.boatId,crewPose:s.crewPose,heave:s.heave,pitch:s.pitch,vmgWind:w.tws>.01?-(waterX*w.vx+waterY*w.vy)/w.tws:null};}
root.SailPhysics={CONFIG,DEFAULT_ENV,environment,WAVE_COMPONENTS,BASE_WAVE_DIRECTION,BASE_WAVE_PERIOD,WAVE_HEIGHT_UNIT,LONG_HEIGHT_UNIT,SHORT_HEIGHT_UNIT,CREST_BEND,PROFILE_SECONDS,MAX_WAVE_HEIGHT,CHOP_PERIOD,CHOP_SPREAD,CHOP_HEIGHT,waveHeightUnit,windWaveAt,windWaveTarget,waveProfileFor,waveBlendAt,advanceWaveProfile,advanceSea,waveExposureField,waveExposureAt,wavePathField,DEG,clamp,wrap,wrap360,configFor,createState,step,windAt,waveAt,waveHeightAt,seaTarget,aero,sailCoefficients,foil,windForState,instruments,sheetFromTrim,trimFromSheet,haulSheetTravel,easeSheetTravel,boomLimit,sheetRateFor,updateSheet,sheetTorque,integrateMass,recover,refresh,axes,windwardCrewSide,tackCrewSide,bodyPoint,bodyOffset,pointMotion,waterVelocity,waterContact,bowWaterContact,hydrostatics,equilibriumHeave,hullSamples,updateCrew,updateRig,updateBoom,sailFlutter,sailAirAt,updateHelm,backingBoomTorque};

});
