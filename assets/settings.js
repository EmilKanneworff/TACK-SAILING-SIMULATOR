(function(root){
'use strict';

const MAX_WAVE_HEIGHT=1.5;
const FIRST_PERSON_CAMERA=4;
const oldSeaHeights=Object.freeze({calm:0,small:.35,large:.85});
const seaShapes=[
  {height:0,period:3.6,spread:.72,short:.34,ripples:.43},
  {height:.35,period:4.2,spread:.85,short:.93,ripples:.77},
  {height:.85,period:5.15,spread:1.04,short:1.22,ripples:1}
];
const defaults=Object.freeze({speed:5,direction:0,gusts:.20,waveHeight:.35,chop:.35,clouds:.18,rain:0,fog:.04,daylight:0});
const personalDefaults=Object.freeze({camera:0,mapDimensions:null,quality:'auto',volume:1,windArrows:true,difficulty:'hard'});
const key='fri-vind.settings.v3';
const previousKeys=['fri-vind.settings.v2','fri-vind.settings.v1','fri-vind-settings'];
const clamp=(n,a,b)=>Math.max(a,Math.min(b,n));
const numeric=(v,fallback)=>typeof v==='number'&&Number.isFinite(v)?v:fallback;
const integer=(n,a,b)=>Math.round(clamp(n,a,b));
const bearing=n=>((n%360)+360)%360;
const legacySeaName=height=>Object.keys(oldSeaHeights).find(name=>oldSeaHeights[name]===height);

function normalize(values={},base=defaults){
  const value=name=>numeric(values?.[name],numeric(base?.[name],defaults[name]));
  const result={speed:clamp(value('speed'),0,20),
    direction:bearing(Math.round(value('direction'))),
    waveHeight:clamp(value('waveHeight'),0,MAX_WAVE_HEIGHT)};
  for(const name of ['chop','gusts','clouds','rain','fog','daylight'])result[name]=clamp(value(name),0,1);
  return result;
}

function migrate(values={}){
  const namedHeight=Object.hasOwn(oldSeaHeights,values.sea)?oldSeaHeights[values.sea]:undefined;
  const namedLight=values.daylight==='day'?0:values.daylight==='evening'||values.weather==='sunset'?1:0;
  const height=numeric(values.waveHeight,namedHeight??numeric(values.waves,defaults.waveHeight));
  return normalize({...values,waveHeight:height,chop:numeric(values.chop,height===0?0:defaults.chop),
    daylight:numeric(values.daylight,namedLight)});
}

function seaShape(height){
  const [calm,small,large]=seaShapes;
  if(height>=large.height)return large;
  const [from,to]=height<=small.height?[calm,small]:[small,large];
  const t=clamp((height-from.height)/(to.height-from.height),0,1);
  const blend=name=>from[name]+(to[name]-from[name])*t;
  return {period:blend('period'),spread:blend('spread'),short:blend('short'),ripples:blend('ripples')};
}

function personal(values={}){
  const size=values.mapDimensions;
  const mapDimensions=Number.isFinite(size?.width)&&size.width>0&&Number.isFinite(size?.height)&&size.height>0
    ?{width:Math.max(1,Math.round(size.width)),height:Math.max(1,Math.round(size.height))}
    :values.mapSize===1?{width:470,height:330}:values.mapSize===2?{width:920,height:600}:null;
  return {camera:integer(numeric(values.camera,0),0,FIRST_PERSON_CAMERA),mapDimensions,
    quality:['auto','low','high'].includes(values.quality)?values.quality:'auto',
    volume:clamp(numeric(values.volume,values.soundEnabled===false?0:1),0,1),windArrows:values.windArrows!==false,
    difficulty:values.difficulty==='easy'?'easy':'hard'};
}
function load(storage){
  try{
    const current=JSON.parse(storage.getItem(key));
    if(current){
      const settings={weather:migrate(current.weather),personal:personal(current.personal)};
      if(Object.hasOwn(current.personal||{},'showWind'))save(storage,settings);
      return settings;
    }
    for(const previousKey of previousKeys){
      const old=JSON.parse(storage.getItem(previousKey));
      if(!old)continue;
      const migrated={weather:migrate(old.weather&&typeof old.weather==='object'?old.weather:old.env||old),
        personal:personal(old.personal||old)};
      save(storage,migrated);
      return migrated;
    }
  }catch{}
  return {weather:{...defaults},personal:{...personalDefaults}};
}
function save(storage,data){
  try{storage.setItem(key,JSON.stringify(data));}catch{}
}
function live(env,state){
  return state?.windClimate?{...env,...state.windClimate}:env;
}
function advanceWind(state,env,dt){
  const old=state.windClimate||env;
  const gain=1-Math.exp(-dt/1.05),delta=bearing(env.direction-old.direction+180)-180;
  const ease=(a,b,tolerance)=>Math.abs(b-a)<tolerance?b:a+(b-a)*gain;
  state.windClimate={speed:ease(old.speed,env.speed,.01),direction:bearing(ease(old.direction,old.direction+delta,.06)),
    gusts:ease(old.gusts,env.gusts,.002)};
  return live(env,state);
}

const api={MAX_WAVE_HEIGHT,FIRST_PERSON_CAMERA,seaShape,legacySeaName,defaults,personalDefaults,key,normalize,migrate,personal,load,save,live,advanceWind};
if(typeof module!=='undefined'&&module.exports)module.exports=api;
else root.SailingSettings=api;
})(globalThis);
