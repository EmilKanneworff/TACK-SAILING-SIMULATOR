'use strict';

importScripts('settings.js','simulation/boats.js','archipelago.js','archipelago-relief.js',
  'simulation/terrain.js','shelter.js','water-depth.js','wind-field.js','simulation/physics.js',
  'simulation/foils.js','simulation/recovery.js','simulation/weather.js','simulation/course.js',
  'course-editor-model.js','collisions.js','simulation/runtime.js','simulation/live-room.js');

const requiresFields = self.location.search === '?fields=precomputed';
if (requiresFields) importScripts('archipelago-fields.js');

const { RoomSimulation,Sim,neutral } = globalThis.TackLiveRoom;
const stepMs = Sim.fixedDt * 1000;
let sim,run,paused = false,lastUpdate = 0,lastFrame = 0,debt = 0;
const players = new Map();

function syncPlayers(roster) {
  const present = new Set(roster.map(player=>player.id));
  for(const [id,player] of players) {
    if(present.has(id))continue;
    players.delete(id);
    sim.remove(player);
  }
  for(const member of roster) {
    const existing = players.get(member.id);
    if(!existing) {
      const player = { ...member,ws:member.connected,control:neutral(),lastSeq:-1,inputAt:0 };
      players.set(player.id,player);
      sim.add(player);
    }else {
      const changed = existing.boat!==member.boat;
      Object.assign(existing,member,{ws:member.connected});
      if(changed)existing.control.foreAft=0;
      if(changed||!existing.ws)existing.control=neutral(existing.control);
      if(changed&&sim.boats.has(existing.id))sim.spawn(existing);
    }
  }
}

function publish() {
  postMessage({type:'authority-frame',run,phase:sim.phase,state:sim.packet()});
}

function start(message) {
  sim = new RoomSimulation(message.env);
  run = message.run;
  sim.serial = run-1;
  players.clear();
  syncPlayers(message.players);
  sim.configure(message.settings);
  sim.start(players,message.draft);
  paused = false;
  lastUpdate = lastFrame = performance.now();
  debt = 0;
  publish();
}

onmessage = async ({data})=>{
  try {
    if(requiresFields){
      await globalThis.TackArchipelagoFieldsReady;
      if(!globalThis.TackArchipelagoFields)throw Error('Værten kunne ikke hente øhavets dybde- og terrændata.');
    }
    if(data.action==='start')return start(data);
    if(!sim||data.run!==run)return;
    if(data.action==='players')syncPlayers(data.players);
    if(data.action==='weather')sim.changeWeather(data.env);
    if(data.action==='input'){
      const p = players.get(data.id);
      if(!p||!p.ws||data.seq<=p.lastSeq)return;
      p.control = data.control;
      p.lastSeq = data.seq;
      p.inputAt = performance.now();
    }
    if(data.action==='pause'||data.action==='resume'){
      paused = data.action==='pause';
      for(const p of players.values())p.control=neutral(p.control);
      lastUpdate = performance.now();
      debt = 0;
    }
  }catch(error){
    postMessage({type:'authority-failed',run:run??data.run,message:error.message});
    sim = null;
  }
};

setInterval(()=>{
  if(!sim||paused)return;
  const now = performance.now();
  // Leave time for incoming helm inputs, and bound catch-up after browser suspension.
  debt = Math.min(debt+now-lastUpdate,200);
  lastUpdate = now;
  try{
    for(let steps=0;steps<8&&debt>=stepMs;steps++){
      sim.step(players,now);
      debt -= stepMs;
      if(performance.now()-now>=16)break;
    }
    if(now-lastFrame>=65){
      lastFrame = now;
      publish();
    }
  }catch(error){
    postMessage({type:'authority-failed',run,message:error.message});
    sim = null;
  }
},8);
