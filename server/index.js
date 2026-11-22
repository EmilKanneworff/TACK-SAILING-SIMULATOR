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
const MAX_PLAYERS = 6, GRACE_MS = 30000, LOBBY_TTL = 60*60*1000;
const MAX_MESSAGE = 65536, MAX_BUFFER = 256*1024;
const playerPalette = ['#fbbf4c','#63cbd7','#ee785c','#bd9cf5','#8dcc6b','#ef89ba'];
const rooms = new Map(), attempts = new Map();
const origins = (process.env.TACK_WEB_ORIGINS || '').split(',').map(value=>value.trim()).filter(Boolean);
const id = () => crypto.randomBytes(16).toString('hex');
const build = process.env.RENDER_GIT_COMMIT || process.env.TACK_BUILD || (() => {
  try { return execFileSync('git',['rev-parse','--short','HEAD'],{ encoding:'utf8',stdio:['ignore','pipe','ignore'] }).trim(); }
  catch { return 'local'; }
})();
const identity = { protocol, build, world: Sim.map.version };
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
const roster = room => emit(room,{ type:'roster', ...roomInfo(room) });
const snapshot = (room,ws) => {
  if (!room.sim.boats.size) return;
  const message = { type:'snapshot',session:room.id,seq:++room.seq,sentAt:performance.now(),state:room.sim.packet() };
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
}

function add(ws,room,name,boat) {
  const used = new Set([...room.players.values()].map(p=>p.color));
  const p = { id:id(),token:id()+id(),name:name.trim(),boat,ws,ready:false,color:playerPalette.find(c=>!used.has(c)),
    lastSeq:-1,inputAt:0,control:neutral(),timer:null };
  // Membership and code reservation run synchronously on one process.
  room.players.set(p.id,p);
  if (!room.hostId) room.hostId=p.id;
  room.sim.add(p,room.players);
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
  if (!Number.isSafeInteger(m.seq)||m.seq<0||!Number.isFinite(m.steer)||!validUnit(m.steer)||
      !Number.isFinite(m.trim)||!validUnit(m.trim)||![1,2,3].includes(m.crewPose)||
      (m.difficulty!==undefined&&!['easy','hard'].includes(m.difficulty))||!validUnit(m.crew)||!validUnit(m.foreAft)||
      ![m.trimFast,m.steerDigital,m.spinnaker,m.ironsHelp].every(validSwitch)||
      (m.downwindType!==undefined&&!['spinnaker','gennaker','code0'].includes(m.downwindType))) return null;
  const control={ steer:m.steer,trim:m.trim,crew:m.crew??0,foreAft:m.foreAft??0,crewPose:m.crewPose,
    difficulty:m.difficulty??'hard',ironsHelp:m.ironsHelp??false,spinnaker:m.spinnaker??false,
    downwindType:m.downwindType??'spinnaker',trimFast:m.trimFast??true,steerDigital:m.steerDigital??true };
  if (m.rig===undefined) return control;
  const rig=m.rig;
  const sheet=value=>value===undefined||Number.isFinite(value)&&value>=0&&value<=1;
  if (!rig||typeof rig!=='object'||Array.isArray(rig)||!['yacht','ac75'].includes(boat)||
      (rig.reef!==undefined&&![0,1,2].includes(rig.reef))||(rig.headsail!==undefined&&![0,1].includes(rig.headsail))||
      !sheet(rig.jibSheet)||!sheet(rig.extraSheet)||
      (boat==='ac75'&&[rig.headsail,rig.jibSheet,rig.extraSheet].some(value=>value!==undefined))) return null;
  control.rig={reef:rig.reef,headsail:rig.headsail,jibSheet:rig.jibSheet,extraSheet:rig.extraSheet};
  return control;
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
    case 'input': {
      if (!sim.boats.has(p.id)) return;
      const control=readControl(m,p.boat);
      if (!control || m.seq<=p.lastSeq) return fail(ws,'Ugyldigt eller forældet input.');
      p.lastSeq=m.seq;
      p.inputAt=performance.now();
      p.control=control;
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
    if (m.env) sim.changeWeather(m.env);
    return roster(room);
  }
  if (m.type==='start') {
    if (['countdown','race'].includes(sim.phase) && (m.settings?.mode??sim.settings.mode)==='course') return fail(ws,'Løbet er allerede i gang.');
    const previous=sim.settings;
    if (m.settings && !sim.configure(m.settings)) return fail(ws,'Ugyldig spiltype eller bane.');
    try { sim.start(room.players,m.draft); }
    catch (err) { sim.settings=previous; return fail(ws,err.message,'course'); }
    log('start',room,p,{ phase:sim.phase });
  } else {
    sim.lobby();
    for (const player of room.players.values()) player.ready=false;
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
    if (room.sim.boats.size || now-room.updated<LOBBY_TTL) continue;
    closeRoom(room,'Lobbyen er udløbet.');
  }
},10000).unref();

// Fixed steps on one process. Collapse obsolete network frames independently
// of the physics tick, and cap each burst so inbound input still runs.
let lastUpdate=performance.now(),debt=0,lastSnapshot=lastUpdate;
setInterval(()=>{
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
