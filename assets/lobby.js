/* Lobby transport. This does not yet claim to implement shared simulation. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  let ws, room, ready = false, adapter, fleet, reconnectTimer, reconnectDeadline=0, intentional = false;
  const send = message => { if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(room ? {...message, session:room.session} : message)); };
  const message = text => { $('lobbyMessage').textContent = text; };
  const view = () => { $('lobbyConnect').hidden = !!room; $('lobbyRoom').hidden = !room; };
  function updateReady(value) {
    ready = value;
    const button = $('lobbyReady');
    button.textContent = ready ? 'Meld ikke klar' : 'Meld klar';
    button.setAttribute('aria-pressed', String(ready));
  }
  function roster(players) {
    const self = players.find(player => player.id === room?.id);
    if (self) updateReady(Boolean(self.ready));
    $('lobbyPlayers').replaceChildren(); $('lobbyCount').textContent = `${players.length} / 6 spillere`;
    for (const p of players) { const li=document.createElement('li'); li.textContent = `● ${p.name} · ${p.boat}${p.host?' · Vært':''}${p.ready?' · Klar':''}${p.connected?'':' · Afbrudt'}`;li.style.color=p.color||''; $('lobbyPlayers').appendChild(li); }
  }
  function url() { const configured=globalThis.FRI_VIND_REALTIME_URL; if(configured) return configured; return location.protocol === 'https:' ? '' : `ws://${location.hostname || 'localhost'}:3001`; }
  function connect(type) {
    if (!url()) return message('Live-tjenestens adresse er ikke konfigureret.');
    if (location.protocol==='https:' && !url().startsWith('wss://')) return message('Live-tjenesten kræver en sikker forbindelse.');
    if (ws && ws.readyState < 2) return message('Forbindelsen er allerede åben.');
    const name=$('lobbyName').value.trim(),code=$('lobbyCodeInput').value;
    if (!name) return message('Skriv dit navn.');
    if (type==='join' && !/^\d{6}$/.test(code)) return message('Koden skal have seks cifre.');
    intentional=false;message('Opretter forbindelse…'); openSocket({type,name,code,boat:adapter.getBoat()});
  }
  function openSocket(firstMessage) {
    ws=new WebSocket(url());
    ws.addEventListener('open',()=>ws.send(JSON.stringify(firstMessage)));
    ws.addEventListener('message',event=>{
      let m;try{m=JSON.parse(event.data)}catch{return;}
      if(m.type==='joined'){clearTimeout(reconnectTimer);reconnectDeadline=0;room={code:m.code,session:m.session,id:m.id,token:m.token,host:m.host,phase:m.phase};$('lobbyCode').textContent=room.code;roster(m.players);fleet.joined(room,m.players);if(room.host)adapter.wait(false);view();message('Forbundet.');}
      else if(m.type==='roster'&&room&&m.session===room.session){room.phase=m.phase;roster(m.players);fleet.roster(m.players);}
      else if(m.type==='closed'&&room&&m.session===room.session){message(m.message);fleet.clear();room=null;intentional=true;adapter.wait(false);adapter.openPanel('lobbyPanel', null, false);view();ws.close();}
      else if(m.type==='error'&&!intentional){message(m.message);if(!room || firstMessage.type==='resume'){intentional=true;if(room){fleet.clear();adapter.wait(false);adapter.openPanel('lobbyPanel', null, false);}room=null;view();ws.close();}}
      else fleet.onMessage(m);
    });
    ws.addEventListener('error',()=>message('Forbindelsen blev afbrudt.'));
    ws.addEventListener('close',()=>{if(intentional)return;if(room){
        if(room.host)adapter.wait(true);
        if(!reconnectDeadline)reconnectDeadline=Date.now()+14500;
        if(Date.now()>=reconnectDeadline){message('Forbindelsen blev afbrudt.');fleet.clear();adapter.wait(false);adapter.openPanel('lobbyPanel', null, false);room=null;view();return;}
        message('Forbindelsen blev afbrudt. Genforbinder…');
        reconnectTimer=setTimeout(()=>{if(room&&!intentional)openSocket({type:'resume',code:room.code,session:room.session,token:room.token});},700);
      }else message('Kunne ikke forbinde til live-tjenesten.');});
  }
  function init(options) {
    adapter=options;fleet=new globalThis.FriVindFleet(adapter,send);
    for (const id of ['lobbyButton', 'introLobby']) $(id).onclick = event => adapter.openPanel('lobbyPanel', event.currentTarget);
    $('lobbyClose').onclick = () => adapter.closePanel('lobbyPanel');
    $('lobbyCreate').onclick=()=>connect('create');$('lobbyJoin').onclick=()=>connect('join');
    $('lobbySail').onclick=()=>{fleet.enter();adapter.closePanel('lobbyPanel',false);};
    $('lobbyReady').onclick=()=>{updateReady(!ready);send({type:'ready',ready});};
    $('lobbyLeave').onclick=()=>{intentional=true;clearTimeout(reconnectTimer);reconnectDeadline=0;send({type:'leave'});ws?.close();fleet.clear();room=null;updateReady(false);view();message('Du har forladt lobbyen.');};
    window.addEventListener('pagehide',()=>{if(room?.host){intentional=true;send({type:'leave'});}});
    $('lobbyCopy').onclick=async()=>{try{await navigator.clipboard.writeText(room.code);message('Koden er kopieret.');}catch{message('Markér og kopiér koden.');}};
  }
  function boatChanged(boat) { if(room?.phase==='race'){message('Bådvalg er låst under løbet.');return false;}if(room)send({type:'boat',boat});return true; }
  globalThis.FriVindLobby={init,boatChanged,startFree:()=>fleet?.startFree(),startRace:(...a)=>fleet?.startRace(...a),step:(...a)=>fleet?.step(...a),render:(...a)=>fleet?.render(...a),get fleet(){return fleet;}};
})();
