'use strict';

const http = require('node:http');
const crypto = require('node:crypto');
const { execFileSync } = require('node:child_process');
const { WebSocketServer, WebSocket } = require('ws');
const { validCode,newCode } = require('./codes');
const protocol = require('../assets/live-protocol');
const { RoomSimulation,Sim,neutral,roomWeather } = require('./room');

const PORT = Number(process.env.PORT || 3001);
const HOST = process.env.HOST || '0.0.0.0';
const browserAuthority = process.env.TACK_LIVE_AUTHORITY === 'browser';
const MAX_PLAYERS = browserAuthority ? 2 : 6, GRACE_MS = 30000, LOBBY_TTL = 60*60*1000;
const MAX_MESSAGE = browserAuthority ? 128*1024 : 65536, MAX_BUFFER = 256*1024;
const playerPalette = ['#fbbf4c','#63cbd7','#ee785c','#bd9cf5','#8dcc6b','#ef89ba'];
const rooms = new Map(), attempts = new Map();
const origins = (process.env.TACK_WEB_ORIGINS || '').split(',').map(value=>value.trim()).filter(Boolean);
const id = () => crypto.randomBytes(16).toString('hex');
const build = process.env.RENDER_GIT_COMMIT || process.env.TACK_BUILD || (() => {
  try { return execFileSync('git',['rev-parse','--short','HEAD'],{ encoding:'utf8',stdio:['ignore','pipe','ignore'] }).trim(); }
  catch { return 'local'; }
})();
const identity = { protocol, build, world: Sim.map.version, authority:browserAuthority?'browser':'server',capacity:MAX_PLAYERS };
const log = (event, room, player, details = {}) => console.log(JSON.stringify({
  event, room: room?.id, player: player?.id, ...details
}));
const send = (ws,message,replaceable=false) => {
  if (ws?.readyState !== WebSocket.OPEN) return;
  if (ws.bufferedAmount > MAX_BUFFER) {
    if (!replaceable) ws.terminate();
    return;
  }
  ws.send(typeof message==='string'?message:JSON.stringify(message));
};
const emit = (room,message,replaceable=false) => {
  const serialized = JSON.stringify({ ...message,session:room.id });
  for (const player of room.players.values()) send(player.ws,serialized,replaceable);
};
const validName = value => typeof value==='string' && value.trim().length>0 && value.trim().length<=32 && !/[\u0000-\u001f]/.test(value);
const validBoat = value => typeof value==='string' && Object.hasOwn(Sim.profiles.CONFIGS,value);
const members = room => [...room.players.values()].map(p=>({
  id:p.id,name:p.name,boat:p.boat,color:p.color,ready:p.ready,connected:!!p.ws,host:p.id===room.hostId
}));
const roomInfo = room => ({ phase:room.sim.phase, settings:room.sim.settings, env:room.sim.env, players:members(room), hostId:room.hostId });
function roster(room) {
  emit(room,{type:'roster',...roomInfo(room)});
  if(room.run&&room.sim.phase!=='lobby')authority(room,'players',{players:authorityPlayers(room)});
}
function authorityPlayers(room) {
  return members(room).map(player=>({...player,slot:room.players.get(player.id).slot}));
}
function authority(room,action,fields={}) {
  send(room.players.get(room.hostId)?.ws,{type:'authority',session:room.id,run:room.run,action,...fields});
}
function waitForHost(room,waiting) {
  if (room.waitingForHost===waiting) return;
  room.waitingForHost=waiting;
  emit(room,{type:'authority-status',waiting});
}
function resetLobby(room) {
  room.sim.lobby();
  room.relayState=null;
  room.waitingForHost=false;
  for(const player of room.players.values())player.ready=false;
}
const snapshot = (room,ws) => {
  const state = browserAuthority ? room.relayState : room.sim.boats.size ? room.sim.packet() : null;
  if (!state) return;
  const message = {type:'snapshot',session:room.id,seq:++room.seq,sentAt:performance.now(),state};
  if (ws) send(ws,message);
  else emit(room,message,true);
};
const fail = (ws,message,code='invalid') => {
  log('request-error',ws.room,ws.player,{ code });
  send(ws,{ type:'error',message,code });
};

function joined(ws,room,p) {
  ws.room=room;
  ws.player=p;
  p.ws=ws;
  send(ws,{ type:'joined',...identity,code:room.code,session:room.id,id:p.id,token:p.token,
    nextSeq:p.lastSeq+1,host:p.id===room.hostId,...roomInfo(room) });
  roster(room);
  snapshot(room,ws);
  if(browserAuthority&&room.sim.phase!=='lobby'){
    if(p.id===room.hostId)authority(room,'resume');
    if(room.waitingForHost)send(ws,{type:'authority-status',session:room.id,waiting:true});
  }
}

function add(ws,room,name,boat) {
  const used = new Set([...room.players.values()].map(p=>p.slot));
  const slot = playerPalette.findIndex((_,index)=>!used.has(index));
  const p = { id:id(),token:id()+id(),name:name.trim(),boat,ws,ready:false,slot,color:playerPalette[slot],
    lastSeq:-1,inputAt:0,control:neutral(),timer:null };
  // Membership and code reservation run synchronously on one process.
  room.players.set(p.id,p);
  if (!room.hostId) room.hostId=p.id;
  room.sim.add(p);
  joined(ws,room,p);
  log(room.players.size===1?'create':'join',room,p);
}

function closeRoom(room,message){
  rooms.delete(room.code);
  for(const player of room.players.values()){
    clearTimeout(player.timer);
    const ws=player.ws;
    if(!ws)continue;
    ws.room=null;ws.player=null;
    send(ws,{type:'closed',session:room.id,message});
  }
  room.players.clear();
}

function remove(room,p) {
  clearTimeout(p.timer);
  room.players.delete(p.id);
  room.sim.remove(p);
  if (!room.players.size) {
    rooms.delete(room.code);
    return;
  }
  if (room.hostId===p.id) {
    if(browserAuthority&&room.sim.phase!=='lobby')resetLobby(room);
    const players = [...room.players.values()];
    room.hostId = (players.find(player=>player.ws) || players[0]).id;
    log('host-transfer',room,room.players.get(room.hostId));
  }
  emit(room,{ type:'left',id:p.id });
  roster(room);
}

function disconnect(ws,explicit=false) {
  const room=ws.room,p=ws.player;
  if (!room || !p || p.ws!==ws) return;
  ws.room=null;
  ws.player=null;
  p.ws=null;
  p.control=neutral(p.control);
  log(explicit?'leave':'disconnect',room,p);
  if (explicit) return remove(room,p);
  if(browserAuthority&&room.sim.phase!=='lobby'&&p.id===room.hostId)waitForHost(room,true);
  p.timer=setTimeout(()=>{ if (!p.ws) remove(room,p); },GRACE_MS);
  p.timer.unref();
  roster(room);
}

function limited(ip) {
  const now=Date.now(),times=(attempts.get(ip)||[]).filter(time=>now-time<60000);
  if (times.length>=35) return true;
  times.push(now);
  attempts.set(ip,times);
  return false;
}

function connect(ws,m) {
  if (m.protocol!==protocol || m.world!==identity.world) {
    return fail(ws,'Spilversionen passer ikke til live-tjenesten. Genindlæs siden for at få den nyeste version.','version');
  }
  if (ws.room) return fail(ws,'Forlad først den nuværende lobby.');
  if (m.type==='resume') {
    const room=rooms.get(m.code);
    const player=room?.id===m.session && [...room.players.values()].find(p=>p.token===m.token);
    if (!player) {
      if (limited(ws.ip)) return fail(ws,'For mange forsøg. Prøv igen senere.','rate');
      return fail(ws,'Sessionen er afsluttet. Opret et nyt spil eller brug en aktuel lobbykode.','expired');
    }
    const old = player.ws;
    if (old) {
      old.room=null;
      old.player=null;
      send(old,{type:'closed',session:room.id,message:'Du er forbundet fra et andet vindue.'});
      old.close(1000);
    }
    clearTimeout(player.timer);
    player.control=neutral(player.control);
    joined(ws,room,player);
    log('resume',room,player);
    return;
  }
  if (limited(ws.ip)) return fail(ws,'For mange forsøg. Prøv igen senere.','rate');
  if (!validName(m.name)||!validBoat(m.boat)) return fail(ws,'Skriv et navn på højst 32 tegn og vælg en båd.');
  if (m.type==='create') {
    const env=roomWeather(m.env,{ windSeed:crypto.randomInt(1,2147483647) });
    const room={ code:newCode(rooms),id:id(),hostId:null,players:new Map(),sim:new RoomSimulation(env),seq:0,updated:Date.now() };
    rooms.set(room.code,room);
    add(ws,room,m.name,m.boat);
    return;
  }
  if (!validCode(m.code)) return fail(ws,'Koden skal have seks cifre.');
  const room=rooms.get(m.code);
  if (!room) return fail(ws,'Lobbyen findes ikke.','not-found');
  if (room.players.size>=MAX_PLAYERS) return fail(ws,'Lobbyen er fuld.','full');
  if (!['free','lobby'].includes(room.sim.phase)) return fail(ws,'Kapsejladsen er i gang. Deltag, når værten åbner lobbyen igen.','race');
  add(ws,room,m.name,m.boat);
}

function readControl(m,boat) {
  const validUnit=value=>value===undefined||Number.isFinite(value)&&Math.abs(value)<=1;
  const validSwitch=value=>value===undefined||typeof value==='boolean';
  const inRange=(value,min,max)=>value===undefined||Number.isFinite(value)&&value>=min&&value<=max;
  if (!Number.isSafeInteger(m.seq)||m.seq<0||!Number.isFinite(m.steer)||!validUnit(m.steer)||
      !Number.isFinite(m.trim)||!validUnit(m.trim)||!inRange(m.sheetTarget,0,1)||![1,2,3].includes(m.crewPose)||
      (m.difficulty!==undefined&&!['easy','hard'].includes(m.difficulty))||!validUnit(m.crew)||!validUnit(m.foreAft)||
      ![m.trimFast,m.steerDigital,m.spinnaker,m.ironsHelp].every(validSwitch)||
      !inRange(m.controlRate,.6,1.6)||!inRange(m.controlSensitivity,.5,1.5)||!inRange(m.motionDamping,.6,1.6)||
      (m.downwindType!==undefined&&!['spinnaker','gennaker','code0'].includes(m.downwindType))) return null;
  const control={ steer:m.steer,trim:m.trim,sheetTarget:m.sheetTarget,crew:m.crew??0,foreAft:m.foreAft??0,crewPose:m.crewPose,
    difficulty:m.difficulty??'hard',ironsHelp:m.ironsHelp??false,spinnaker:m.spinnaker??false,
    downwindType:m.downwindType??'spinnaker',trimFast:m.trimFast??true,steerDigital:m.steerDigital??true,
    controlRate:m.controlRate??1,controlSensitivity:m.controlSensitivity??1,motionDamping:m.motionDamping??1 };
  if(m.crewInput!==undefined){
    const input=m.crewInput;
    if(input!==null&&(!input||typeof input!=='object'||Array.isArray(input)||
      !Number.isSafeInteger(input.order)||input.order<0||!Number.isSafeInteger(input.epoch)||input.epoch<0||
      ![-1,1].includes(input.side)||![1,2,3].includes(input.pose)||!Number.isFinite(input.foreAft)||!validUnit(input.foreAft)))return null;
    control.crewInput=input&&{order:input.order,epoch:input.epoch,side:input.side,pose:input.pose,foreAft:input.foreAft};
  }
  if (m.rig===undefined) return control;
  const rig=m.rig;
  const sheet=value=>value===undefined||Number.isFinite(value)&&value>=0&&value<=1;
  if (!rig||typeof rig!=='object'||Array.isArray(rig)||
      (rig.reef!==undefined&&![0,1,2].includes(rig.reef))||(rig.headsail!==undefined&&![0,1].includes(rig.headsail))||
      !sheet(rig.jibSheet)||!sheet(rig.extraSheet)||
      (boat!=='yacht'&&[rig.headsail,rig.extraSheet].some(value=>value!==undefined))||
      (boat==='laser'&&rig.jibSheet!==undefined)) return null;
  control.rig={reef:rig.reef,headsail:rig.headsail,jibSheet:rig.jibSheet,extraSheet:rig.extraSheet};
  return control;
}

function receiveAuthorityFrame(ws,room,m) {
  const state=m.state,phase=room.sim.phase;
  if (m.run!==room.run||phase==='lobby') return;
  if(!state||state.serial!==room.run||!Number.isFinite(state.time)||state.time<0||
    !state.boats||typeof state.boats!=='object'||Array.isArray(state.boats)||
    state.mode!==room.sim.settings.mode||
    (state.mode==='course'&&(!state.model||state.model.type!==room.sim.settings.courseType||
      state.model.variant!==room.sim.settings.courseVariant||!Array.isArray(state.model.route)))||
    !state.boats[room.hostId]||Object.keys(state.boats).length>MAX_PLAYERS)
    return fail(ws,'Værtens sejlads kunne ikke synkroniseres.','authority');
  if (room.relayState && state.time<=room.relayState.time) return;
  const now=performance.now();
  if(room.relayState&&now-room.relayAt<35)return;
  const keep=(entries)=>Object.fromEntries([...room.players.keys()].filter(id=>Object.hasOwn(entries??{},id)).map(id=>[id,entries[id]]));
  const boats = keep(state.boats);
  if(Object.values(boats).some(boat=>!boat||!validBoat(boat.boatId)||
    ![boat.time,boat.x,boat.y,boat.theta,boat.heave,boat.heel,boat.pitch,boat.vx,boat.vy].every(Number.isFinite)))
    return fail(ws,'Værten sendte en ugyldig bådtilstand.','authority');
  const races=keep(state.races);
  room.relayAt=now;
  const results=[...room.players.values()].filter(p=>races[p.id]?.finished&&
    Number.isFinite(races[p.id].time)&&races[p.id].time>=0)
    .map(p=>({id:p.id,name:p.name,boat:p.boat,time:races[p.id].time})).sort((a,b)=>a.time-b.time);
  room.relayState={serial:room.run,time:state.time,mode:state.mode,env:room.sim.env,boats,races,results,
    model:state.mode==='course'?state.model:undefined,acks:keep(state.acks)};
  if (phase==='countdown'&&['race','results'].includes(m.phase)) room.sim.phase='race';
  if (room.sim.phase==='race'&&m.phase==='results'&&Object.keys(races).length===room.players.size&&
      Object.values(races).every(race=>race?.finished)) room.sim.phase='results';
  if(room.sim.phase!==phase)roster(room);
  waitForHost(room,false);
  snapshot(room);
}

function handle(ws,m) {
  if (!m || typeof m!=='object' || Array.isArray(m) || typeof m.type!=='string') return fail(ws,'Ugyldig besked.');
  if (['create','join','resume'].includes(m.type)) return connect(ws,m);
  const room=ws.room,p=ws.player;
  if (!room || !p || m.session!==room.id) return fail(ws,'Forbindelsen er udløbet.','expired');
  room.updated=Date.now();
  const sim=room.sim, isHost=p.id===room.hostId;
  switch (m.type) {
    case 'leave': return disconnect(ws,true);
    case 'sync': return snapshot(room,ws);
    case 'ready':
      if (typeof m.ready!=='boolean') return fail(ws,'Ugyldig klarstatus.');
      p.ready=m.ready;
      return roster(room);
    case 'boat':
      if (!['lobby','free'].includes(sim.phase)) return fail(ws,'Bådvalg er låst under løbet.');
      if (!validBoat(m.boat)) return fail(ws,'Ukendt båd.');
      if (p.boat===m.boat) return;
      p.boat=m.boat;
      p.control=neutral({ difficulty:p.control.difficulty });
      if (sim.boats.has(p.id)) sim.spawn(p);
      roster(room);
      return snapshot(room);
    case 'authority-frame':
      if(!browserAuthority||!isHost) return fail(ws,'Kun værten kan sende sejladsens tilstand.','host');
      return receiveAuthorityFrame(ws,room,m);
    case 'authority-failed':
      if(!browserAuthority||!isHost) return fail(ws,'Kun værten kan afslutte værtens simulation.','host');
      if(m.run!==room.run||sim.phase==='lobby')return;
      resetLobby(room);
      roster(room);
      return emit(room,{type:'authority-status',waiting:false,
        message:typeof m.message==='string'?m.message.trim().slice(0,160):'Værtens sejlads blev lukket. Start igen fra lobbyen.'});
    case 'input': {
      if (browserAuthority?sim.phase==='lobby':!sim.boats.has(p.id)) return;
      const control=readControl(m,p.boat);
      if (!control || m.seq<=p.lastSeq) return fail(ws,'Ugyldigt eller forældet input.');
      p.lastSeq=m.seq;
      p.inputAt=performance.now();
      p.control=control;
      if(browserAuthority)authority(room,'input',{id:p.id,seq:p.lastSeq,control});
      return;
    }
    case 'settings':
    case 'start':
    case 'lobby':
      if (!isHost) return fail(ws,'Kun værten kan ændre det fælles spil.','host');
      break;
    default: return fail(ws,'Ukendt besked.');
  }
  if (m.type==='settings') {
    if (m.settings && !sim.configure(m.settings)) return fail(ws,'Ugyldig spiltype eller bane.');
    if (m.env){
      sim.changeWeather(m.env);
      if(browserAuthority&&sim.phase!=='lobby')authority(room,'weather',{env:sim.env});
    }
    return roster(room);
  }
  if (m.type==='start') {
    if (['countdown','race'].includes(sim.phase) && (m.settings?.mode??sim.settings.mode)==='course') return fail(ws,'Løbet er allerede i gang.');
    const previous=sim.settings;
    if (m.settings && !sim.configure(m.settings)) return fail(ws,'Ugyldig spiltype eller bane.');
    if(browserAuthority){
      room.run=(room.run??0)+1;
      room.relayState=null;
      room.relayAt=performance.now();
      room.waitingForHost=false;
      sim.phase=sim.settings.mode==='course'?'countdown':'free';
      roster(room);
      authority(room,'start',{settings:sim.settings,env:sim.env,players:authorityPlayers(room),draft:m.draft});
      log('start',room,p,{phase:sim.phase,authority:'browser'});
      return;
    }
    try { sim.start(room.players,m.draft); }
    catch (err) { sim.settings=previous; return fail(ws,err.message,'course'); }
    log('start',room,p,{ phase:sim.phase });
  } else {
    resetLobby(room);
  }
  roster(room);
  snapshot(room);
}

const server=http.createServer((req,res)=>{
  if (req.url!=='/health') { res.writeHead(404).end(); return; }
  res.writeHead(200,{ 'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store' });
  res.end(JSON.stringify({ status:'ok',...identity, rooms:rooms.size }));
});
const wss=new WebSocketServer({ noServer:true,maxPayload:MAX_MESSAGE,
  perMessageDeflate:{ threshold:1024,concurrencyLimit:6,zlibDeflateOptions:{level:1} } });
server.on('upgrade',(req,socket,head)=>{
  const origin=req.headers.origin;
  if (origins.length && (!origin || !origins.includes(origin))) {
    socket.end('HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n');
    return;
  }
  wss.handleUpgrade(req,socket,head,ws=>wss.emit('connection',ws,req));
});
wss.on('connection',(ws,req)=>{
  // Only read the proxy's appended address when deployed behind that proxy.
  ws.ip=process.env.TACK_TRUST_PROXY==='1'&&req.headers['x-forwarded-for']
    ?req.headers['x-forwarded-for'].split(',').at(-1).trim():req.socket.remoteAddress;
  ws.alive=true;
  ws.windowStart=Date.now();
  ws.messageCount=0;
  ws.on('pong',()=>{ws.alive=true;});
  ws.on('message',(data,binary)=>{
    const now=Date.now();
    if (now-ws.windowStart>=1000) { ws.windowStart=now; ws.messageCount=0; }
    if (++ws.messageCount>100||binary) { ws.close(1008,'For mange eller ugyldige beskeder'); return; }
    try { handle(ws,JSON.parse(data.toString())); }
    catch (err) { log('message-error',ws.room,ws.player,{ error:err.name }); fail(ws,'Ugyldig besked.'); }
  });
  ws.on('close',()=>disconnect(ws));
  ws.on('error',err=>log('socket-error',ws.room,ws.player,{ code:err.code }));
});

setInterval(()=>{
  for (const ws of wss.clients) {
    if (!ws.alive) { ws.terminate(); continue; }
    ws.alive=false;
    ws.ping();
  }
  const now=Date.now();
  for (const [ip,times] of attempts) if (now-times.at(-1)>60000) attempts.delete(ip);
  for (const room of rooms.values()) {
    if (room.sim.phase!=='lobby' || now-room.updated<LOBBY_TTL) continue;
    closeRoom(room,'Lobbyen er udløbet.');
  }
},10000).unref();

// A host that loses its transport retains its seat for the reconnect window.
if(browserAuthority)setInterval(()=>{
  const now=performance.now();
  for(const room of rooms.values()){
    if(room.sim.phase==='lobby')continue;
    if(room.relayState&&now-room.relayAt>2500)waitForHost(room,true);
    if(now-room.relayAt<45000)continue;
    resetLobby(room);
    roster(room);
    emit(room,{type:'authority-status',waiting:false,message:'Værtens sejlads er stoppet. Start igen fra lobbyen.'});
  }
},1000).unref();

// Fixed steps on one process. Collapse obsolete network frames independently
// of the physics tick, and cap each burst so inbound input still runs.
let lastUpdate=performance.now(),debt=0,lastSnapshot=lastUpdate;
if(!browserAuthority)setInterval(()=>{
  const now=performance.now(),dt=Sim.fixedDt*1000;
  debt+=now-lastUpdate;
  lastUpdate=now;
  const deadline=now+14;
  for (let count=0;debt>=dt&&count<8;count++) {
    debt-=dt;
    for (const room of rooms.values()) {
      const before=room.sim.phase,finished=room.sim.finished.size;
      try {
        room.sim.step(room.players,now);
        if (before!==room.sim.phase || finished!==room.sim.finished.size) roster(room);
      } catch (err) {
        log('room-error',room,null,{ error:err.name });
        closeRoom(room,'Sessionen er afsluttet efter en fejl i sejladsen.');
      }
    }
    if (performance.now()>=deadline) break;
  }
  if (now-lastSnapshot>=50) {
    lastSnapshot=now;
    for (const room of rooms.values()) snapshot(room);
  }
},8).unref();

function shutdown(){
  for(const ws of wss.clients)ws.close(1012,'Live-tjenesten genstarter');
  server.close(()=>process.exit(0));
  setTimeout(()=>process.exit(0),1000).unref();
}
process.on('SIGTERM',shutdown);
process.on('SIGINT',shutdown);

server.listen(PORT,HOST,()=>log('listening',null,null,{ ...identity,host:HOST,port:server.address().port }));
