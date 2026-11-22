/* Course editor data and geometry. Coordinates are world metres: east, north. */
(function (root, factory) {
  if (typeof module !== 'undefined' && module.exports) {
    const data = {};
    require('./archipelago')(data);
    module.exports = factory(data.ArchipelagoData);
  } else root.FriVindCourseEditorModel = factory(root.ArchipelagoData);
})(typeof globalThis !== 'undefined' ? globalThis : this, function (map) {
  'use strict';
  const MAP = map.version, METRIC_MAP = 'faaborg-metric-1', LEGACY_MAP = 'faaborg-hand-drawn-1', VERSION = 1, TAU = 2 * Math.PI;
  const add = (a,b) => ({x:a.x+b.x,y:a.y+b.y});
  const sub = (a,b) => ({x:a.x-b.x,y:a.y-b.y});
  const mul = (a,n) => ({x:a.x*n,y:a.y*n});
  const dot = (a,b) => a.x*b.x+a.y*b.y;
  const length = a => Math.hypot(a.x,a.y);
  const unit = a => { const n=length(a); return n>1e-9?mul(a,1/n):null; };
  const right = a => ({x:a.y,y:-a.x});
  const centre = line => mul(add(line.a,line.b),.5);
  const point = p => p && Number.isFinite(p.x) && Number.isFinite(p.y) && Math.abs(p.x)<1e6 && Math.abs(p.y)<1e6;
  const clone = v => JSON.parse(JSON.stringify(v));
  const windAxis = degrees => {const r=degrees*Math.PI/180;return {x:Math.sin(r),y:Math.cos(r)};};
  const angleDifference = (a,b) => ((a-b+540)%360)-180;
  function lineAdvice(line, degrees) {
    const direction=unit(sub(line.b,line.a)), up=windAxis(degrees);
    if (!direction) return null;
    const component=dot(direction,up);
    const deviation=Math.asin(Math.min(1,Math.abs(component)))*180/Math.PI;
    return {deviation, favored: Math.abs(component)<1e-9?null:component>0?'b':'a'};
  }
  function startWidth(boats, wind=5, waves=0) {
    // Game sizing, not an official class prescription: 1.5 hull lengths per
    // boat plus a manoeuvre allowance for beam, foils and rough conditions.
    if (!boats.length) return 0;
    const sum=boats.reduce((n,b)=>n+1.5*b.length+Math.max(0,b.beam||0)*.6,0);
    return sum*(1+Math.max(0,wind-6)*.025+Math.max(0,waves)*.12);
  }
  function validate(d, terrain) {
    const issues=[], error=(message)=>issues.push({level:'error',message});
    if (!d || typeof d!=='object' || Array.isArray(d)) return [{level:'error',message:'Filen indeholder ikke en bane.'}];
    if (d.version!==VERSION || ![MAP,METRIC_MAP,LEGACY_MAP].includes(d.map)) error('Banens version eller kort passer ikke til dette spil.');
    if (terrain && d.map===METRIC_MAP){
      const heightAt=terrain;
      terrain=(x,y)=>{const p=map.fromMetric(x,y);return heightAt(p.x,p.y);};
    }
    if (typeof d.id!=='string' || !d.id || typeof d.name!=='string' || !d.name.trim() || d.name.length>100) error('Banen mangler et gyldigt navn eller id.');
    if (!d.weather || !Number.isFinite(d.weather.direction) || d.weather.direction<0 || d.weather.direction>=360 || !Number.isFinite(d.weather.speed) || d.weather.speed<0 || d.weather.speed>20) error('Referencevinden er ugyldig.');
    const validLine=(l,name)=>{
      if(!l || !point(l.a) || !point(l.b) || length(sub(l.b,l.a))<1e-3 || !point(l.normal) || length(l.normal)<.999 || length(l.normal)>1.001) {error(name+' mangler eller har ugyldig geometri og retning.');return false;}
      const tangent=unit(sub(l.b,l.a));
      if(Math.abs(dot(tangent,l.normal))>1e-4){error(name+'s retning skal være vinkelret på linjen.');return false;}
      if(terrain){
        const span=sub(l.b,l.a),samples=Math.min(512,Math.max(10,Math.ceil(length(span)/4)));
        for(let i=0;i<=samples;i++){const p=add(l.a,mul(span,i/samples));if(terrain(p.x,p.y)>=0){error(name+' ligger på land eller for lavt vand.');break;}}
      }
      return true;
    };
    validLine(d.start,'Startlinjen'); validLine(d.finish,'Mållinjen');
    if(!Array.isArray(d.marks) || d.marks.length>100){error('Mærkelisten er ugyldig.');return issues;}
    const marks=new Map();
    for(const m of d.marks){
      if(!m || typeof m.id!=='string' || !m.id || ['start-a','start-b','finish-a','finish-b'].includes(m.id) || marks.has(m.id) || !point(m)){error('Et mærke er ugyldigt eller har et gentaget id.');continue;}
      marks.set(m.id,m);
      if(terrain && terrain(m.x,m.y)>=0)error('Mærket '+(m.label||m.id)+' ligger på land eller for lavt vand.');
    }
    if(!Array.isArray(d.route) || !d.route.length || d.route.length>100){error('Ruten mangler passager.');return issues;}
    for(const visit of d.route){
      if(!visit || !['round','gate'].includes(visit.kind) || !Array.isArray(visit.markIds) || visit.markIds.length!==(visit.kind==='gate'?2:1) || visit.markIds.some(id=>!marks.has(id)) || (visit.kind==='round'&&!['port','starboard'].includes(visit.side)) || (visit.kind==='gate'&&visit.markIds[0]===visit.markIds[1])) error('En passage er ugyldig eller henviser til et manglende mærke.');
    }
    return issues;
  }
  function onCurrentMap(d){
    if(d?.map!==METRIC_MAP||validate(d).length)return d;
    const toPoint=p=>({...p,...map.fromMetric(p.x,p.y)});
    const toLine=l=>({...l,a:toPoint(l.a),b:toPoint(l.b)});
    return {...d,map:MAP,start:toLine(d.start),finish:toLine(d.finish),marks:d.marks.map(toPoint)};
  }
  function rotate(d, degrees) {
    const out=clone(d), anchor=centre(out.start), r=degrees*Math.PI/180, c=Math.cos(r),s=Math.sin(r);
    const vector=p=>({x:p.x*c-p.y*s,y:p.x*s+p.y*c});
    const around=p=>add(anchor,vector(sub(p,anchor)));
    for(const line of [out.start,out.finish]){line.a=around(line.a);line.b=around(line.b);line.normal=vector(line.normal);}
    out.marks=out.marks.map(m=>({...m,...around(m)}));
    return out;
  }
  function draftFrom(model, weather, id, name) {
    const lines = new Set([...model.startLine.buoyIds, ...model.finishLine.buoyIds]);
    const line = ({a,b,normal}) => clone({a,b,normal});
    return {version:VERSION,map:MAP,id,name,revision:1,template:model.type,weather:clone(weather),
      start:line(model.startLine),finish:line(model.finishLine),
      marks:model.buoys.filter(b=>!lines.has(b.id)).map(({id,label,x,y})=>({id,label,x,y})),
      route:model.route.filter(v=>v.kind!=='finish').map(v=>({kind:v.kind,label:v.label,markIds:v.buoyIds.slice(),side:v.side}))};
  }
  function moveEndpoint(line, end, p) {
    const edited={...line,[end]:p}, tangent=unit(sub(edited.b,edited.a));
    if(!tangent)return null;
    const normal=right(tangent);
    return {...edited,normal:dot(normal,line.normal)<0?mul(normal,-1):normal};
  }
  function courseGeometry(d,boat) {
    const scale=Math.max(1,Math.min(2.15,Math.sqrt(boat.length/4.23))),radius=.65*scale;
    const buoys=d.marks.filter(point).map(m=>({id:m.id,label:m.label||m.id,name:m.label||m.id,x:m.x,y:m.y,color:'#ffad37',role:'course',radius,scale}));
    const lines={};
    for(const [key,l] of [['start',d.start],['finish',d.finish]]){
      const ids=[key+'-a',key+'-b'],label=key==='start'?'Start':'Mål';
      for(const [i,position] of [l.a,l.b].entries()){
        if(point(position))buoys.push({id:ids[i],label:label[0],name:label,...position,color:key==='start'?'#ff9f36':'#4299ed',role:key,radius,scale});
      }
      if(point(l.a)&&point(l.b))lines[key]={id:key,a:{...l.a},b:{...l.b},normal:{...l.normal},centre:centre(l),buoyIds:ids,label};
    }
    return {buoys,startLine:lines.start,finishLine:lines.finish};
  }
  function compile(d, rounding, boat={length:4.23,beam:1.37}) {
    const issues=validate(d);if(issues.length)throw new Error(issues[0].message);
    d=onCurrentMap(d);
    const {buoys,startLine,finishLine}=courseGeometry(d,boat),lines={start:startLine,finish:finishLine};
    const byId=new Map(buoys.map(b=>[b.id,b])), targets=d.route.map(v=>{
      const pair=v.markIds.map(id=>byId.get(id)), p=pair.length===2?mul(add(pair[0],pair[1]),.5):pair[0];
      return {v,p,pair};
    });
    const route=targets.map(({v,p,pair},i)=>{
      const from=i?targets[i-1].p:lines.start.centre,to=targets[i+1]?.p||lines.finish.centre;
      let incoming=unit(sub(p,from));const outgoing=unit(sub(to,p));
      if(!incoming||!outgoing)throw new Error('To efterfølgende passager ligger samme sted.');
      const gate=v.kind==='gate';
      if(gate){
        const tangent=unit(sub(pair[1],pair[0]));
        if(!tangent)throw new Error('De to gatebøjer skal placeres hver for sig.');
        const normal=right(tangent);
        incoming=dot(normal,incoming)<0?mul(normal,-1):normal;
      }
      const firstSide=dot(sub(pair[0],p),right(incoming))>0?'starboard':'port';
      return {id:'visit-'+(i+1),kind:v.kind,label:v.label||pair.map(m=>m.label).join(' / '),x:p.x,y:p.y,buoyIds:v.markIds.slice(),side:gate?'choice':v.side,incoming,outgoing,roundings:gate?[rounding(pair[0],incoming,outgoing,firstSide),rounding(pair[1],incoming,outgoing,firstSide==='port'?'starboard':'port')]:[rounding(pair[0],incoming,outgoing,v.side)]};
    });
    route.push({id:'visit-'+(route.length+1),kind:'finish',label:'Mål',...lines.finish.centre,buoyIds:lines.finish.buoyIds,side:'line',incoming:{...lines.finish.normal},outgoing:{...lines.finish.normal},line:lines.finish,roundings:[]});
    const points=buoys, axis={...lines.start.normal}, origin=lines.start.centre;
    return {type:d.template==='triangle'?'triangle':'gates',variant:'custom',name:d.name,axis,right:right(axis),origin,buoys,gateGroups:targets.filter(t=>t.v.kind==='gate').map(t=>({id:'gate-'+t.v.markIds.join('-'),label:t.v.label||'Gate',buoyIds:t.v.markIds.slice(),x:t.p.x,y:t.p.y})),startLine:lines.start,finishLine:lines.finish,route,bounds:{minX:Math.min(...points.map(p=>p.x))-50,maxX:Math.max(...points.map(p=>p.x))+50,minY:Math.min(...points.map(p=>p.y))-50,maxY:Math.max(...points.map(p=>p.y))+50},roundingRadius:Math.max(11,boat.length*2.65),gateWidth:Math.max(1,...targets.filter(t=>t.pair.length===2).map(t=>length(sub(t.pair[1],t.pair[0])))),spawn:{...add(origin,mul(axis,-Math.max(24,boat.length*2.4))),theta:Math.atan2(axis.y,axis.x)-55*Math.PI/180},meta:{version:12,length:length(sub(origin,route[0])),customId:d.id,customVersion:d.revision||1,referenceWind:{...d.weather}}};
  }
  return {MAP,VERSION,windAxis,angleDifference,lineAdvice,startWidth,validate,onCurrentMap,rotate,draftFrom,moveEndpoint,courseGeometry,compile,clone};
});
