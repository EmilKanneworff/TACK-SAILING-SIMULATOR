const { test, expect } = require('@playwright/test');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

test.use({ launchOptions: { executablePath: process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', args: ['--enable-unsafe-swiftshader'] } });

test('open-water height is significant height and light tracks an independent blend',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const data=await page.evaluate(()=>{
  const P=SailPhysics,env=SAILING_GAME.env;
  const levels=[0,.45,1.5].map(waveHeight=>{
   const e={...env,waveHeight,chop:0,speed:20,shelter:false};
   return {waveHeight,model:P.seaTarget(e)*P.LONG_HEIGHT_UNIT};
  });
  const sample={...env,waveHeight:.45,chop:0,speed:20,shelter:false};
  const shape=P.waveProfileFor(sample);
  sample.waveProfile={from:shape,to:shape,start:-10};
  const heights=Array.from({length:2048},(_,i)=>P.waveAt((i*373)%911,-5000+(i*619)%977,i*.378,sample).height);
  const mean=heights.reduce((a,b)=>a+b,0)/heights.length;
  const measured=4*Math.sqrt(heights.reduce((a,b)=>a+(b-mean)**2,0)/heights.length);
  const lighting=[0,.4,1].map(daylight=>SailingWeather.target({...env,daylight,clouds:.37,fog:0,rain:0}));
  const gusts=[0,.23,.24,.25].map(gusts=>P.windAt(10,-5000,13,{...env,gusts,shelter:false}).speed);
  return {levels,measured,lighting,gusts,wind:env.speed};
 });
 for(const {waveHeight,model} of data.levels)expect(model).toBeCloseTo(waveHeight,8);
 expect(data.measured).toBeCloseTo(.45,1);
 const [day,middle,evening]=data.lighting;
 expect(middle.sunElevation).toBeCloseTo(day.sunElevation+.4*(evening.sunElevation-day.sunElevation),8);
 expect(middle.sunColor[1]).toBeCloseTo(day.sunColor[1]+.4*(evening.sunColor[1]-day.sunColor[1]),8);
 expect(data.lighting.map(a=>[a.clouds,a.fogDensity,a.rain])).toEqual(Array(3).fill([.37,0,0]));
 expect(data.gusts[0]).toBe(data.wind);
 expect(new Set(data.gusts).size).toBe(4);
 expect(data.gusts[3]-data.gusts[2]).toBeCloseTo(data.gusts[2]-data.gusts[1],8);
});

test('default sea is moderate, moving continuously, and larger seas remain selectable', async ({ page }) => {
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.waitForFunction(() => window.SAILING_GAME);
  const result = await page.evaluate(() => {
    const P = SailPhysics, env = { ...SAILING_GAME.env, speed: 5 };
    const height = waves => P.waveHeightUnit(P.waveProfileFor(env).short*P.windWaveTarget(env)) * P.seaTarget({ ...env, waves });
    const samples = [];
    for (let i = 0; i < 1200; i++) {
      const t = i / 60, a = P.waveAt(23, -5000, t, env), b = P.waveAt(23, -5000, t + .001, env);
      samples.push({ h: a.height, slope: Math.hypot(a.dx, a.dy), derivativeError: Math.abs((b.height - a.height) / .001 - a.velocity) });
    }
    return { calm: height(0), small: height(.35), large: height(.85), range: Math.max(...samples.map(s => s.h)) - Math.min(...samples.map(s => s.h)), maxSlope: Math.max(...samples.map(s => s.slope)), derivativeError: Math.max(...samples.map(s => s.derivativeError)) };
  });
  expect(result.calm).toBe(0);
  expect(result.small).toBeGreaterThan(.18);
  expect(result.small).toBeLessThan(.27);
  expect(result.large).toBeGreaterThan(result.small * 2);
  expect(result.range).toBeGreaterThan(.1);
  expect(result.maxSlope).toBeLessThan(.15);
  expect(result.derivativeError).toBeLessThan(.001);
});

test('long waves carry most of the energy while shorter waves respond to wind up to 20 m/s',async({page})=>{
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.waitForFunction(()=>window.SAILING_GAME);
  const result=await page.evaluate(()=>{
    const P=SailPhysics,base={...SAILING_GAME.env,waves:.85,speed:5,direction:270,shelter:false};
    const windWaves=P.WAVE_COMPONENTS.filter(w=>w.windSea&&!w.managedOnly);
    const lengths=windWaves.map(w=>2*Math.PI/Math.hypot(w.kx,w.ky));
    const energy=w=>w.reduce((sum,c)=>sum+c.amplitude**2,0);
    const windy=P.WAVE_COMPONENTS.indexOf(windWaves[1]);
    const sample=(wavePeriod,waveComponent)=>P.waveAt(16,-5003,7.9,{...base,wavePeriod,waveComponent}).height;
    const height=speed=>{
      const env={...base,speed},profile=P.waveProfileFor(env);
      return P.waveHeightUnit(profile.short*P.windWaveTarget(env))*P.seaTarget(env);
    };
    const shape=P.waveProfileFor(base),waveProfile={from:shape,to:shape,start:0,wind:{from:1,to:P.windWaveTarget({...base,speed:20}),start:4}};
    const changing={...base,speed:20,waveCurrent:.7,waveComponent:windy,waveProfile};
    const t=5,dt=.0001,y=P.waveAt(16,-5003,t,changing);
    const slope=(P.waveAt(16,-5003,t+dt,changing).height-P.waveAt(16,-5003,t-dt,changing).height)/(2*dt);
    const longWaves=P.WAVE_COMPONENTS.filter(w=>!w.windSea);
    const energeticWind=P.windWaveTarget({...base,speed:12});
    const longEnergy=energy(longWaves)/(energy(longWaves)+energy(windWaves)*energeticWind**2);
    const slopeEnergy=waves=>waves.reduce((sum,w)=>sum+(w.amplitude*w.k)**2,0);
    const shortSlopes=slopeEnergy(windWaves)*energeticWind**2/slopeEnergy(longWaves);
    const mainAngle=Math.atan2(longWaves[0].ky,longWaves[0].kx);
    const maxSpread=Math.max(...[...longWaves,...windWaves].map(w=>Math.abs(Math.atan2(w.ky,w.kx)-mainAngle)/P.DEG));
    return {lengths,longLengths:longWaves.map(w=>2*Math.PI/w.k),longEnergy,shortSlopes,maxSpread,
      short:[sample(3,windy),sample(11,windy)],long:[sample(3,0),sample(11,0)],
      heights:[height(5),height(12),height(20)],velocityError:Math.abs(slope-y.velocity)};
  });
  expect(Math.min(...result.lengths)).toBeGreaterThanOrEqual(4);
  expect(Math.max(...result.lengths)).toBeLessThan(10);
  expect(result.longLengths.filter(length=>length>20)).toHaveLength(3);
  expect(result.longEnergy).toBeGreaterThan(.85);
  expect(result.longEnergy).toBeLessThan(.90);
  expect(result.shortSlopes).toBeLessThan(1);
  expect(result.maxSpread).toBeGreaterThan(0);
  expect(result.maxSpread).toBeLessThan(5.001);
  expect(result.short[0]).toBeCloseTo(result.short[1],10);
  expect(Math.abs(result.long[0]-result.long[1])).toBeGreaterThan(.02);
  expect(result.heights[0]).toBeLessThan(result.heights[1]);
  expect(result.heights[1]).toBeLessThan(result.heights[2]);
  expect(result.heights[2]).toBeLessThan(1.5);
  expect(result.velocityError).toBeLessThan(.00001);
});

test('wave fronts stay coherent across the chosen direction and pass spaced probes in sequence',async({page})=>{
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  await page.waitForFunction(()=>window.SAILING_GAME);
  const readings=await page.evaluate(()=>{
    const P=SailPhysics;
    const env={...SAILING_GAME.env,waves:.85,speed:12,direction:270,shelter:false};
    return [[270,env],[35,{...env,swellDirection:35}]].map(([from,conditions])=>{
      const bearing=from*P.DEG,forwardX=-Math.sin(bearing),forwardY=-Math.cos(bearing);
      const sample=(along,across,t,profile=conditions)=>P.waveAt(
        along*forwardX-across*forwardY,-5000+along*forwardY+across*forwardX,t,profile).height;
      let acrossChange=0,alongChange=0;
      for(let along=-40;along<=40;along+=2){
        const height=sample(along,0,7);
        for(const across of [-36,36])acrossChange+=(height-sample(along,across,7))**2;
        for(const ahead of [-5,5])alongChange+=(height-sample(along+ahead,0,7))**2;
      }
      const main={...conditions,waveComponent:0},wave=P.WAVE_COMPONENTS[0],stretch=P.waveProfileFor(main).period;
      const spacing=6,lag=spacing*wave.k/(wave.omega*stretch);
      const errors=Array.from({length:40},(_,i)=>{
        const time=i*.2,height=sample(0,0,time,main);
        return {across:Math.abs(height-sample(0,32,time,main)),
          delayed:Math.abs(height-sample(spacing,0,time+lag,main)),
          simultaneous:Math.abs(height-sample(spacing,0,time,main))};
      });
      return {shape:Math.sqrt(acrossChange/alongChange),lag,
        across:Math.max(...errors.map(e=>e.across)),delayed:Math.max(...errors.map(e=>e.delayed)),
        simultaneous:Math.max(...errors.map(e=>e.simultaneous))};
    });
  });
  for(const reading of readings){
    expect(reading.shape).toBeGreaterThan(.04);
    expect(reading.shape).toBeLessThan(.55);
    expect(reading.lag).toBeGreaterThan(.8);
    expect(reading.lag).toBeLessThan(1.1);
    expect(reading.across).toBeLessThan(1e-8);
    expect(reading.delayed).toBeLessThan(1e-8);
    expect(reading.simultaneous).toBeGreaterThan(.15);
  }
});

test('Chop adds independent short waves while wind duration, fetch and depth still matter',async({page})=>{
 await page.goto(pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,D=SailingWaterDepth,base={...SAILING_GAME.env,speed:14,direction:0,waveHeight:0,chop:0};
  const short=P.WAVE_COMPONENTS.findIndex(w=>w.windSea),long=0;
  function rms(env,x,y){
   const p=P.waveProfileFor(env),conditions={...env,waveProfile:{from:p,to:p,start:-10}};
   return Math.sqrt(Array.from({length:480},(_,i)=>P.waveAt(x,y,i*.075,conditions).height**2)
    .reduce((sum,h)=>sum+h,0)/480);
  }
  const offshore={...base,shelter:false},big={...offshore,waveHeight:1.15},choppy={...offshore,chop:1};
  const combined={...big,chop:.5},shortSea={...big,chop:1};
  const depths=[40,3,.02].map(h=>D.phaseVelocity(30,h));
  const k0=2*Math.PI/30,k=D.waveNumber(k0,3);
  const state={time:0};
  const fresh={...base,speed:5,waveHeight:.9,chop:.85},windy={...fresh,speed:20};
  P.advanceWaveProfile(state,fresh);
  P.advanceWaveProfile(state,windy);
  const growth=[0,6,24,90].map(t=>P.windWaveAt(t,state.waveProfile,windy).scale);
  const island=SailingWorld.ISLANDS.find(i=>i.id==='bjorno'),x=ArchipelagoData.fromMetric(1500,0).x;
  let shore=island.minY;while(SailingWorld.islandSample(island,x,shore).distance>=0)shore++;
  const y=shore-70,lee={...base,chop:1,waveHeight:1.15};
  const leeProfile=P.waveProfileFor(lee),swellPath=P.wavePathField(leeProfile);
  const measuredPaths=[-40,0,40].map(offset=>D.samplePath(swellPath,x,y+offset,0).v);
  return {
   deep:depths[0],shallow:depths[1],veryShallow:depths[2],k,dispersionError:Math.abs(k*Math.tanh(k*3)-k0),
   onlyLong:[rms({...big,waveComponent:long},0,-10000),rms({...big,waveComponent:short},0,-10000)],
   onlyShort:[rms({...choppy,waveComponent:long},0,-10000),rms({...choppy,waveComponent:short},0,-10000)],
   combined:[rms({...combined,waveComponent:long},0,-10000),rms({...combined,waveComponent:short},0,-10000)],
   pureChop:[rms({...shortSea,waveComponent:long},0,-10000),rms({...shortSea,waveComponent:short},0,-10000)],
   calm:rms(offshore,0,-10000),growth, lee:rms(lee,x,y), open:rms(shortSea,x,y),
   fetch:P.waveExposureAt(leeProfile,x,y).fetch,measuredPaths,
   windlessSwell:rms({...big,speed:0},0,-10000),swell:rms(big,0,-10000)
  };
 });
 expect(result.deep).toBeCloseTo(Math.sqrt(9.82*30/(2*Math.PI)),3);
 expect(result.veryShallow).toBeCloseTo(Math.sqrt(9.82*.02),4);
 expect(result.shallow).toBeLessThan(result.deep);
 expect(result.k).toBeGreaterThan(2*Math.PI/30);
 expect(result.dispersionError).toBeLessThan(.0005);
 expect(result.calm).toBe(0);
 expect(result.onlyLong[0]).toBeGreaterThan(.1);
 expect(result.onlyLong[1]).toBe(0);
 expect(result.onlyShort[0]).toBe(0);
 expect(result.onlyShort[1]).toBeGreaterThan(.045);
 expect(result.combined[0]).toBeCloseTo(result.onlyLong[0],8);
 expect(result.combined[1]).toBeCloseTo(result.onlyShort[1]*.5,3);
 expect(result.pureChop[0]).toBeCloseTo(result.onlyLong[0],8);
 expect(result.pureChop[1]).toBeCloseTo(result.onlyShort[1],8);
 expect(result.growth[1]).toBeGreaterThan(result.growth[0]);
 expect(result.growth[2]).toBeGreaterThan(result.growth[1]);
 expect(result.growth[3]).toBeCloseTo(1.40,5);
 expect(result.windlessSwell).toBeCloseTo(result.swell,8);
 expect(result.fetch).toBeLessThan(140);
 expect(result.lee).toBeLessThan(result.open*.65);
 expect(Math.max(...result.measuredPaths)-Math.min(...result.measuredPaths)).toBeGreaterThan(.10);
});

test('managed swell gives its shortest band a full swell wavelength',async({page})=>{
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,component=P.WAVE_COMPONENTS.findLastIndex(w=>!w.windSea),w=P.WAVE_COMPONENTS[component];
  const env={speed:8,direction:270,swellDirection:270,waveHeight:1.3,chop:0,
   wavePeriod:P.BASE_WAVE_PERIOD,waveComponent:component,shelter:false};
  const profile=P.waveProfileFor(env),bearing=Math.atan2(w.ky,w.kx)+profile.angle+w.spreadAngle*(P.SWELL_SPREAD*profile.spread-1);
  const wavelength=2*Math.PI/w.k*(w.managedPeriod*profile.period)**2;
  const height=distance=>P.waveAt(distance*Math.cos(bearing),-10000+distance*Math.sin(bearing),.7,env).height;
  const error=Math.abs(height(0)-height(wavelength));
  return {error,half:Math.abs(height(0)-height(wavelength*.5)),wavelength};
 });
 expect(result.error).toBeLessThan(1e-8);
 expect(result.wavelength).toBeGreaterThan(18);
 expect(result.half).toBeGreaterThan(.05);
});

test('distant points on the same swell front move together',async({page})=>{
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,e={waveHeight:2,chop:0,speed:8,direction:270,shelter:false},rows=[];
  for(let i=0;i<600;i++){
   const x=-1600+i*.61,t=7+i*.045;
   rows.push([P.waveHeightAt(x,-1800,t,e),P.waveHeightAt(x,-1660,t,e),P.waveHeightAt(x+20,-1800,t,e)]);
  }
  const variance=col=>rows.reduce((sum,row)=>sum+row[col]**2,0);
  const coherence=rows.reduce((sum,row)=>sum+row[0]*row[1],0)/Math.sqrt(variance(0)*variance(1));
  const contrast=Math.sqrt(rows.reduce((sum,row)=>sum+(row[0]-row[2])**2,0)/rows.length);
  return {coherence,contrast};
 });
 expect(result.coherence).toBeGreaterThan(.94);
 expect(result.contrast).toBeGreaterThan(.6);
 console.log('Bølgefront',JSON.stringify(result));
});

test('depth-limited sea reduces shoal height smoothly and tracks the changing wave velocity',async({page})=>{
 await page.goto(process.env.TACK_URL||pathToFileURL(path.resolve('index.html')).href);
 await page.waitForFunction(()=>window.SAILING_GAME);
 const result=await page.evaluate(()=>{
  const P=SailPhysics,D=SailingWaterDepth,x=1343.778,y=-1149.262,time=7.5,dt=.0001;
  const env={speed:20,direction:270,swellDirection:270,waveHeight:1.5,chop:.12,shelter:true};
  const depth=D.sample(x,y).depth;
  function heightRMS(){
   let sum=0;
   for(let i=0;i<720;i++){const height=P.waveAt(x,y,i*.18,env).height;sum+=height*height;}
   return 4*Math.sqrt(sum/720);
  }
  const cap=D.breakingRatio,limited=heightRMS();
  let unlimited;
  try{D.breakingRatio=100;unlimited=heightRMS();}
  finally{D.breakingRatio=cap;}
  const scale=P.seaTarget(env),rate=.45;
  const height=t=>P.waveAt(x,y,t,{...env,waveCurrent:scale+(t-time)*rate}).height;
  const wave=P.waveAt(x,y,time,{...env,waveCurrent:scale,waveCurrentRate:rate});
  const derivative=(height(time+dt)-height(time-dt))/(2*dt);
  return {depth,cap,limited,unlimited,error:Math.abs(wave.velocity-derivative)};
 });
 expect(result.depth).toBeGreaterThan(1);
 expect(result.unlimited).toBeGreaterThan(result.limited*1.1);
 expect(result.limited).toBeLessThan(result.depth*result.cap);
 expect(result.error).toBeLessThan(1e-5);
});
