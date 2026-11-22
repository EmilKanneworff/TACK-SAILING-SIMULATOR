/* FRI VIND weather presets and deterministic atmosphere.
 * These are chosen game conditions and visual palettes, not measured weather
 * forecasts or certified sea states. The existing force model receives only
 * env.speed/gusts/waves; weather never adds a hidden propulsion multiplier.
 * Colors below become linear RGB arrays, ready for THREE.Color.fromArray().
 */
(function(install){
 if(typeof module!=='undefined'&&module.exports)module.exports=install;
 else install(globalThis);
})(function(root){
  'use strict';
  const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
  const finite=(v,fallback)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
  const COLORS=['skyTop','skyBottom','waterNear','waterDeep','horizon','sunColor','hemiSky','hemiGround','cloudColor'];
  const BASE={skyTop:'#438ebd',skyBottom:'#c5e0ed',waterNear:'#315d65',waterDeep:'#24495f',horizon:'#9abaca',sunColor:'#fff0d6',hemiSky:'#d3edff',hemiGround:'#315d5d',cloudColor:'#f6fbfa',sunIntensity:2.8,hemiIntensity:1.80,exposure:1.04,sunElevation:.75,sunWarmth:.12};
  const make=(id,name,description,conditions,visual)=>Object.freeze({id,name,description,...conditions,visual:Object.freeze({...BASE,...visual})});
  const PRESETS=Object.freeze({
    clear:make('clear','Solskin','Klart lys, små skyer og roligt vand.',
      {speed:5,gusts:.20,waves:.35,rain:0,fog:.04,clouds:.18},{}),
    overcast:make('overcast','Overskyet','Et tæt skydække, blødt lys og frisk vind.',
      {speed:6,gusts:.24,waves:.50,rain:0,fog:.16,clouds:.86},
      {skyTop:'#748b9a',skyBottom:'#c0ccce',waterNear:'#287d82',waterDeep:'#3b697a',horizon:'#a2b8bd',sunColor:'#e1e9e9',hemiSky:'#c8d8e1',cloudColor:'#aabac1',sunIntensity:.85,hemiIntensity:2.35,exposure:1.04,sunElevation:.64,sunWarmth:.02}),
    rain:make('rain','Regn','Synlig regn, mørkere vand og jævne vindpust.',
      {speed:7,gusts:.32,waves:.68,rain:.68,fog:.26,clouds:.96},
      {skyTop:'#5a6c7d',skyBottom:'#99adb5',waterNear:'#24646e',waterDeep:'#304e65',horizon:'#8da4ae',sunColor:'#c1d6e2',hemiSky:'#a8bdcc',hemiGround:'#2c535a',cloudColor:'#8599a7',sunIntensity:.48,hemiIntensity:2.0,exposure:1.0,sunElevation:.57,sunWarmth:0}),
    fog:make('fog','Tåge','Kort sigtbarhed og let vind. Følg kompas og bøjer.',
      {speed:3,gusts:.10,waves:.22,rain:0,fog:.92,clouds:.62},
      {skyTop:'#b3c7cd',skyBottom:'#d4dfe0',waterNear:'#719e9e',waterDeep:'#789aa7',horizon:'#cad7d8',sunColor:'#edf0df',hemiSky:'#e0e8e6',cloudColor:'#d3dedf',sunIntensity:.65,hemiIntensity:2.25,exposure:1.08,sunElevation:.60,sunWarmth:.08}),
    squall:make('squall','Bygevejr','Kraftige pust, tæt regn og flere bølgetoppe.',
      {speed:10,gusts:.50,waves:.95,rain:.95,fog:.38,clouds:1},
      {skyTop:'#354b61',skyBottom:'#7a929e',waterNear:'#205361',waterDeep:'#253f57',horizon:'#728d9c',sunColor:'#afc7db',hemiSky:'#91a9bf',hemiGround:'#243d49',cloudColor:'#657f91',sunIntensity:.30,hemiIntensity:1.75,exposure:1.0,sunElevation:.46,sunWarmth:0}),
    sunset:make('sunset','Solnedgang','Lav sol, varmt lys og en roligere aftenbrise.',
      {speed:4.5,gusts:.14,waves:.30,rain:0,fog:.14,clouds:.28},
      {skyTop:'#5a789f',skyBottom:'#f2c7a2',waterNear:'#477f88',waterDeep:'#3e617d',horizon:'#d9b9a4',sunColor:'#ffd09b',hemiSky:'#b7c0da',hemiGround:'#716c63',cloudColor:'#f0c7b5',sunIntensity:2.6,hemiIntensity:1.9,exposure:1.12,sunElevation:.12,sunWarmth:1})
  });
  const LIST=Object.freeze(Object.values(PRESETS));
  const DEFAULTS=Object.freeze({weather:'clear',rain:0,fog:.04,clouds:.18});
  const CONFIG=Object.freeze({colorSeconds:8,lightSeconds:5,rainSeconds:2.8,fogSeconds:6.5,cloudSeconds:7,baseFogDensity:.00012,maxExtraFogDensity:.0125});
  function srgb(c){return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4);}
  function rgb(hex){const n=parseInt(hex.slice(1),16);return [srgb((n>>16&255)/255),srgb((n>>8&255)/255),srgb((n&255)/255)];}
  function normalized(env={}){
    const daylight=Number.isFinite(env.daylight)?clamp(env.daylight,0,1):undefined;
    const p=daylight===undefined?PRESETS[env.weather]||PRESETS.clear:PRESETS.clear;
    return {weather:p.id,daylight,speed:clamp(finite(env.speed,p.speed),0,root.SailingWind.CONFIG.maxSpeed),gusts:clamp(finite(env.gusts,p.gusts),0,1),waves:clamp(finite(env.waves,p.waves),0,1),rain:clamp(finite(env.rain,p.rain),0,1),fog:clamp(finite(env.fog,p.fog),0,1),clouds:clamp(finite(env.clouds,p.clouds),0,1)};
  }
  function target(env={}){
    const n=normalized(env),p=PRESETS[n.weather],v=p.visual,evening=PRESETS.sunset,light=n.daylight??0;
    const blend=(a,b)=>a+(b-a)*light;
    const sun=p=>p.visual.sunIntensity/(1-.72*p.clouds);
    const a={weather:n.weather,rain:n.rain,fog:n.fog,clouds:n.clouds,
      fogDensity:CONFIG.baseFogDensity*Math.min(1,n.fog/.04)+CONFIG.maxExtraFogDensity*Math.pow(n.fog,2.2),
      sunIntensity:clamp(blend(sun(p),sun(evening))*(1-.72*n.clouds),.08,4.5),
      hemiIntensity:blend(v.hemiIntensity,evening.visual.hemiIntensity),
      exposure:blend(v.exposure,evening.visual.exposure),
      sunElevation:blend(v.sunElevation,evening.visual.sunElevation),
      sunWarmth:blend(v.sunWarmth,evening.visual.sunWarmth)};
    const overcast=n.daylight===undefined?0:clamp(n.clouds-.18,0,.76);
    for(const key of COLORS){
      const clear=rgb(v[key]),grey=rgb(PRESETS.overcast.visual[key]);
      const sunset=light?rgb(evening.visual[key]):clear;
      a[key]=clear.map((value,i)=>{
        const lit=blend(value,sunset[i]);
        return lit+(grey[i]-lit)*overcast;
      });
    }
    return a;
  }
  function applyPreset(env,id){
    const p=PRESETS[id];if(!p)throw new RangeError('Ukendt vejrtype: '+id);
    const values={weather:id,speed:p.speed,gusts:p.gusts,waves:p.waves,waveHeight:null,rain:p.rain,fog:p.fog,clouds:p.clouds};
    Object.assign(env,Number.isFinite(env.waveHeight)?root.SailingSettings.migrate(values):values);
    return p;
  }
  function initialize(state,env){state.atmosphere=target(env);return state.atmosphere;}
  function step(state,env,dt){
    if(!state.atmosphere)return initialize(state,env);
    const a=state.atmosphere,b=target(env),h=Math.max(0,finite(dt,0));
    // Exact exponential relaxation is independent of subdivision. The main
    // simulation owns the fixed step and drops long hidden-tab elapsed time.
    for(const key of Object.keys(b)){
      if(key==='weather'){a.weather=b.weather;continue;}
      const seconds=COLORS.includes(key)?CONFIG.colorSeconds:key==='rain'?CONFIG.rainSeconds:key==='fog'||key==='fogDensity'?CONFIG.fogSeconds:key==='clouds'?CONFIG.cloudSeconds:CONFIG.lightSeconds;
      const k=1-Math.exp(-h/seconds);
      if(Array.isArray(b[key])){if(!Array.isArray(a[key]))a[key]=b[key].slice();else for(let i=0;i<3;i++)a[key][i]+=(b[key][i]-a[key][i])*k;}
      else a[key]=Number.isFinite(a[key])?a[key]+(b[key]-a[key])*k:b[key];
    }
    return a;
  }
  function read(state,env){return state&&state.atmosphere||target(env);}
  root.SailingWeather={PRESETS,LIST,DEFAULTS,CONFIG,normalize:normalized,target,applyPreset,initialize,step,read};

});
