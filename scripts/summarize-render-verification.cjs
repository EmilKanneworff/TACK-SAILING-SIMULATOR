'use strict';

const fs = require('node:fs');
const path = require('node:path');
const folder = process.argv[2];
if (!folder) throw Error('node scripts/summarize-render-verification.cjs DATA_DIRECTORY');
const read = file => {
  const filename = path.join(folder, file);
  return fs.existsSync(filename) ? JSON.parse(fs.readFileSync(filename)) : null;
};
const count = (rows,key) => Object.fromEntries([...new Set(rows.map(key))].map(value=>[value,rows.filter(row=>key(row)===value).length]));
const sum = values => values.reduce((a,b)=>a+b,0);
const stats = values => {
  const a=values.filter(Number.isFinite).sort((x,y)=>x-y);
  if(!a.length)return null;
  const pct=p=>a[Math.ceil(a.length*p)-1];
  return { n:a.length, mean:sum(a)/a.length, p50:pct(.5), p95:pct(.95), p99:pct(.99), max:a.at(-1) };
};

const performanceScenarios=['baseline-light','final-light','final-auto','baseline-auto'].flatMap(name=>{
  const data=read(name+'.json');
  if(!data)return [];
  const {live,frames,inputResponse}=data.all[0], first=frames[0].timestamp;
  const startup=frames.filter(row=>row.timestamp-first<10000), steady=frames.slice(startup.length);
  const measure=(rows,debtStart,duration)=>{
    const draws=rows.filter(row=>row.calls), debtEnd=rows.at(-1).debtMs;
    const steps=sum(rows.map(row=>row.cpu.fixedStep?.count??0));
    const intervals=draws.map(row=>row.drawInterval).filter(Number.isFinite).slice(1);
    return {fps:draws.length*1000/duration,interval:stats(intervals),over100:intervals.filter(ms=>ms>100).length,
      steps, ratio:(steps*1000/60)/duration, debtStart,debtEnd,
      debtPeak:Math.max(debtStart,...rows.map(row=>row.debtMs)),stepMs:sum(rows.map(row=>row.cpu.fixedStep?.inclusive??0))/steps,
      tiers:count(draws,row=>row.tier),sizes:count(draws,row=>String(row.size)),
      cpuDetail:count(draws,row=>String(row.cpuDetail)),calls:stats(draws.map(row=>row.calls))};
  };
  return [{name,build:data.build,wallMs:live.wallMs,inputResponse,
    begin:measure(startup,live.debtStartMs,10000), end:measure(steady,startup.at(-1).debtMs,live.wallMs-10000),
    whole:measure(frames,live.debtStartMs,live.wallMs),
    clockResidualMs:live.wallMs-live.simulatedMs+live.debtStartMs-live.debtEndMs }];
});
const water=read('water-ab.json')?.all?.map(({stage,runs,discarded})=>({ scene:stage.name,discarded,
  blocks:runs.map(run=>({label:run.label,missing:run.missing,...stats(run.gpuMs)})),
  pairedCurrentLessOriginal:[0,2,4,6].map(i=>{
    const pair=runs.slice(i,i+2);
    return stats(pair.find(run=>run.label==='current').gpuMs).p50-stats(pair.find(run=>run.label==='original').gpuMs).p50;
  }) }));
function summarizeAuto(data) {
  return data?.phases.map(({phase})=>{
    const rows=data.rows.filter(row=>row.phase===phase);
    const changes=rows.filter((row,i)=>!i||row.tier!==rows[i-1].tier||row.cpuDetail!==rows[i-1].cpuDetail);
    return {phase,load:count(rows,row=>row.load),fps:stats(rows.map(row=>row.fps)),
      gpu:stats(rows.map(row=>row.gpuMs)),changed:changes.map(row=>[row.elapsed,row.tier,row.cpuDetail,row.load,row.size])};
  });
}
const auto=summarizeAuto(read('auto-pressure.json'));
const gpuOverlay=summarizeAuto(read('auto-gpu-overlay.json'));
const network=['live-before','live-two','live-six'].flatMap(name=>{
  const data=read(name+'.json');
  if(!data)return [];
  return [{name,errors:data.errors,clients:data.results.map(r=>{
    const packets={};
    for(const {type,event,bytes} of r.packets) (packets[event+':'+type]??=[]).push(bytes);
    const received=r.packets.filter(r=>r.event==='framereceived');
    const duration=(received.at(-1).at-received[0].at)/1000;
    return {boat:r.boat,build:r.build,elapsed:r.elapsed,fps:r.fps,interval:stats(r.intervals),
      ratio:r.simulated*1000/r.elapsed,pending:stats(r.queue),predictionOffset:stats(r.corrections.map(r=>r.delta)),
      correctionMs:stats(r.corrections.map(r=>r.ms)), extension:r.extension,sendBuffer:r.sendBuffer,
      workerPackMs:stats(r.workerPacking.map(r=>r.packMs)),workerCloneMs:stats(r.workerPacking.map(r=>r.cloneMs)),
      workerDiscardedMs:r.workerDiscardedMs,workerStep:stats(r.workerSteps.map(r=>r.stepMs)),
      messages:Object.fromEntries(Object.entries(packets).map(([key,bytes])=>[key,
        { hz:bytes.length/duration, bytesPerSecond:sum(bytes)/duration, size:stats(bytes) }])),
      parse:stats(r.codec.parse.map(r=>r.ms)),stringify:stats(r.codec.stringify.map(r=>r.ms)),fields:r.fields};
  })}];
});
const voyage=read('sejlads.json')??read('experience/sejlads.json');
let sailing;
if(voyage){
  const root={};
  require('../assets/archipelago')(root);
  const shores=root.ArchipelagoData.lands.flatMap(({points})=>points.map((start,i)=>{
    const end=points[(i+1)%points.length],dx=end.x-start.x,dy=end.y-start.y;
    return {start,dx,dy,lengthSquared:dx*dx+dy*dy};
  }));
  const shoreDistance=({x,y})=>Math.min(...shores.map(({start,dx,dy,lengthSquared})=>{
    const fraction=lengthSquared?Math.max(0,Math.min(1,((x-start.x)*dx+(y-start.y)*dy)/lengthSquared)):0;
    return Math.hypot(x-start.x-fraction*dx,y-start.y-fraction*dy);
  }));
  let distance=0,simulated=0;
  const {records}=voyage;
  for(let i=1;i<records.length;i++){
    const now=records[i],last=records[i-1];
    if(now.boat!==last.boat||now.time<last.time)continue;
    distance+=Math.hypot(now.x-last.x,now.y-last.y);
    simulated+=now.time-last.time;
  }
  const nearest=records.map(shoreDistance);
  const {drawIntervals,...retirement}=voyage.probe;
  sailing={distance,simulated,closestShore:Math.min(...nearest),farthestShore:Math.max(...nearest),
    seconds:voyage.seconds,retirement,drawIntervals:stats(drawIntervals)};
}
console.log(JSON.stringify({performanceScenarios,water,auto,gpuOverlay,network,sailing},null,2));
