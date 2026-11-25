/* Lobby transport and presentation. The room identity is issued by the server. */
(() => {
  'use strict';
  const $ = id=>document.getElementById(id);
  const assets=new URL('.',document.currentScript.src);
  const protocol=globalThis.TackLiveProtocol, reconnectMs=30000, sessionKey='tack.live.session';
  const phases={lobby:'Venter på start',free:'Fri sejlads',countdown:'Nedtælling',race:'Kapsejlads',results:'Resultater'};
  let ws,room,adapter,fleet,pending,retryTimer,openTimer,reconnectDeadline=0,attempt=0;
  let worker,workerRun,settingsDraft;

  const message=text=>{ $('lobbyMessage').textContent=text; };
  const send=data=>{
    if(ws?.readyState===WebSocket.OPEN&&ws.bufferedAmount<65536) {
      ws.send(JSON.stringify(room?{...data,session:room.session}:data));
      return true;
    }
    return false;
  };
  const settingsFromForm=()=>{
    const [courseType,courseVariant]=$('lobbyCourse').value.split(':');
    return {mode:$('lobbyMode').value,courseType,courseVariant};
  };
  const url=()=>globalThis.FRI_VIND_REALTIME_URL||(location.protocol==='https:'?'':`ws://${location.hostname||'localhost'}:3001`);
  const inviteUrl=()=>{
    const link=new URL(location.pathname,location.origin);
    link.searchParams.set('lobby',room.code);
    return link.href;
  };
  function setPending(type){
    pending=type;
    $('lobbyCreate').disabled=$('lobbyJoin').disabled=Boolean(type);
    $('lobbyCreate').textContent=type==='create'?'Opretter spil…':'Opret spil';
    $('lobbyJoin').textContent=type==='join'?'Tilslutter…':'Deltag i spil';
  }
  function view(){
    $('lobbyConnect').hidden=Boolean(room);
    $('lobbyRoom').hidden=!room;
    if(!room)return;
    $('lobbySetup').hidden=!(room.host&&room.phase==='lobby');
    $('lobbyCourse').hidden=$('lobbyCourseLabel').hidden=(settingsDraft??room.settings).mode!=='course';
    $('lobbyReady').hidden=room.phase!=='lobby';
    $('lobbySail').hidden=!(room.host&&room.phase==='lobby');
    $('lobbyReturn').hidden=!room.host||room.phase==='lobby';
    $('lobbyInvite').hidden=location.protocol==='file:';
  }
  function roster(info){
    room.phase=info.phase;
    room.host=info.hostId===room.id;
    room.settings=info.settings;
    $('lobbyCode').textContent=room.code;
    const self=info.players.find(p=>p.id===room.id);
    const ready=$('lobbyReady');
    ready.textContent=self?.ready?'Meld ikke klar':'Meld klar';
    ready.setAttribute('aria-pressed',String(Boolean(self?.ready)));
    $('lobbyCount').textContent=`${info.players.length} / ${room.capacity} spillere`;
    $('lobbyAuthority').hidden=room.authority!=='browser';
    $('lobbyPlayers').replaceChildren(...info.players.map(p=>{
      const li=document.createElement('li');
      const flag=p.host?' · Vært':'';
      const status=p.connected?(p.ready?' · Klar':' · Forbundet'):' · Afbrudt';
      li.textContent=p.name+' · '+SailingBoats.get(p.boat).name+flag+status;
      return li;
    }));
    const courses={gates:'Op/ned',triangle:'Trekant'};
    const detail=info.settings.mode==='course'?'Kapsejlads · '+courses[info.settings.courseType]+
      (info.settings.courseVariant==='long'?' · Lang':info.settings.courseVariant==='short'?' · Kort':' · Egen bane'):'Fri sejlads';
    $('lobbySettingsSummary').textContent=detail+' · '+Number(info.env.speed).toLocaleString('da-DK')+' m/s · '+info.env.direction+'° · '+Number(info.env.waveHeight).toLocaleString('da-DK')+' m bølger · '+phases[info.phase];
    if(!room.host||info.phase!=='lobby'||settingsDraft&&Object.keys(settingsDraft).every(key=>settingsDraft[key]===info.settings[key]))
      settingsDraft=undefined;
    if(!settingsDraft){
      $('lobbyMode').value=info.settings.mode;
      if(info.settings.courseVariant!=='custom')$('lobbyCourse').value=info.settings.courseType+':'+info.settings.courseVariant;
    }
    if(!room.host||!fleet.inWorld)adapter.weather(info.env);
    fleet.roster(info.players,info.phase);
    if(info.phase==='lobby'||!room.host)stopWorker();
    view();
  }
  function saveSession(value){
    try{
      if(value)sessionStorage.setItem(sessionKey,JSON.stringify({code:value.code,session:value.session,token:value.token}));
      else sessionStorage.removeItem(sessionKey);
    }catch{}
  }
  function stopWorker(){
    worker?.terminate();
    worker=undefined;
    workerRun=undefined;
  }
  function onAuthority(data){
    if(!room.host||room.authority!=='browser')return;
    if(data.action==='start'){
      stopWorker();
      workerRun=data.run;
      try{
        const url=new URL('live-worker.js',assets);
        if(globalThis.TackRequireArchipelagoFields)url.searchParams.set('fields','precomputed');
        const simulation=new Worker(url);
        simulation.onmessage=event=>{
          if(worker===simulation)send(event.data);
        };
        simulation.onerror=()=>{
          if(worker===simulation)send({type:'authority-failed',run:workerRun,message:'Værtens browser kunne ikke starte sejladsen. Prøv igen.'});
        };
        worker=simulation;
      }catch{
        send({type:'authority-failed',run:workerRun,message:'Værtens browser kunne ikke starte sejladsen. Prøv igen.'});
      }
    }
    if(data.run===workerRun&&worker)worker.postMessage(data);
    else if(data.action==='resume')
      send({type:'authority-failed',run:data.run,message:'Værtens fane blev lukket eller genindlæst. Start igen fra lobbyen.'});
  }
  function stop(text,open=false){
    clearTimeout(retryTimer);clearTimeout(openTimer);
    reconnectDeadline=attempt=0;
    const socket=ws;ws=null;
    if(socket?.readyState<2)socket.close();
    const active=fleet.inWorld;
    stopWorker();fleet.clear();room=null;settingsDraft=undefined;saveSession(null);setPending(null);view();
    adapter.wait(false);
    if(active&&open)adapter.openPanel('lobbyPanel',null,false);
    message(text);
  }
  function retry(credentials){
    if(!reconnectDeadline)reconnectDeadline=Date.now()+reconnectMs;
    worker?.postMessage({action:'pause',run:workerRun});
    if(fleet.inWorld){fleet.synced=false;adapter.wait(true);}
    const remaining=reconnectDeadline-Date.now();
    if(remaining<=0){stop('Sessionen er afsluttet. Prøv at tilslutte dig igen.',true);return;}
    message('Forbindelsen er afbrudt. Prøver igen…');
    retryTimer=setTimeout(()=>openSocket(credentials),Math.min(remaining,500*2**Math.min(4,attempt++)));
  }
  function openSocket(first){
    let socket;
    try{socket=new WebSocket(url());}
    catch{stop('Live-tjenesten er midlertidigt utilgængelig.',true);return;}
    ws=socket;
    const recovering=first.type==='resume';
    const deadline=recovering?Math.max(50,Math.min(7000,reconnectDeadline-Date.now())):80000;
    openTimer=setTimeout(()=>{if(ws===socket)socket.close();},deadline);
    socket.addEventListener('open',()=>{
      if(ws===socket)socket.send(JSON.stringify({...first,protocol,world:ArchipelagoData.version}));
    });
    socket.addEventListener('message',event=>{
      if(ws!==socket)return;
      let m;
      try{m=JSON.parse(event.data);}catch{return;}
      if(m.type==='joined'){
        if(m.protocol!==protocol||m.world!==ArchipelagoData.version){
          stop('Spilversionen passer ikke til live-tjenesten. Genindlæs siden.',true);
          return;
        }
        clearTimeout(openTimer);clearTimeout(retryTimer);reconnectDeadline=attempt=0;setPending(null);
        room={code:m.code,session:m.session,id:m.id,token:m.token,host:m.host,phase:m.phase,settings:m.settings,nextSeq:m.nextSeq,authority:m.authority,capacity:m.capacity};
        settingsDraft=undefined;
        saveSession(room);
        adapter.weather(m.env);
        fleet.joined(room,m.players);
        roster(m);
        message(recovering?'Forbindelsen er gendannet.':'Forbundet.');
      }else if(m.type==='roster'&&m.session===room?.session){
        roster(m);
      }else if(m.type==='authority'&&m.session===room?.session){
        onAuthority(m);
      }else if(m.type==='authority-status'&&m.session===room?.session){
        adapter.wait(m.waiting,'Værtens sejlads venter · hold fanen åben');
        if(m.message)message(m.message);
      }else if(m.type==='closed'&&m.session===room?.session){
        stop(m.message,true);
      }else if(m.type==='error'){
        if(!room||recovering&&reconnectDeadline)stop(m.message,true);
        else message(m.message);
      }else fleet.onMessage(m);
    });
    socket.addEventListener('close',()=>{
      if(ws!==socket)return;
      clearTimeout(openTimer);ws=null;
      if(room||recovering){
        const {code,session,token}=room||first;
        retry({type:'resume',code,session,token});
      }else stop('Kunne ikke forbinde til live-tjenesten. Prøv igen.');
    });
  }
  function connect(type){
    if(pending||ws||room)return;
    if(!url())return message('Live-tjenesten er midlertidigt utilgængelig.');
    if(location.protocol==='https:'&&!url().startsWith('wss://'))return message('Live-tjenesten kræver en sikker forbindelse.');
    const name=$('lobbyName').value.trim(),code=$('lobbyCodeInput').value.trim();
    if(!name){message('Skriv dit navn.');$('lobbyName').focus();return;}
    if(type==='join'&&!/^\d{6}$/.test(code)){message('Koden skal have seks cifre.');$('lobbyCodeInput').focus();return;}
    setPending(type);message(type==='create'?'Opretter spil…':'Tilslutter…');
    openSocket({type,name,code,boat:adapter.getBoat(),...(type==='create'?{env:adapter.sharedWeather()}: {})});
  }
  async function copy(text,confirmation){
    try{await navigator.clipboard.writeText(text);message(confirmation);}
    catch{
      const field=$('lobbyInviteLink');
      field.hidden=false;field.value=text;field.select();
      message('Markér og kopiér teksten.');
    }
  }
  function init(options){
    adapter=options;fleet=new globalThis.FriVindFleet(adapter,send);
    for(const id of ['lobbyButton','introLobby'])$(id).onclick=event=>adapter.openPanel('lobbyPanel',event.currentTarget);
    $('lobbyClose').onclick=()=>adapter.closePanel('lobbyPanel');
    $('lobbyCreate').onclick=()=>connect('create');
    $('lobbyJoinForm').onsubmit=event=>{event.preventDefault();connect('join');};
    $('lobbyCodeInput').oninput=event=>{event.target.value=event.target.value.replace(/\D/g,'').slice(0,6);};
    $('lobbyCodeInput').onpaste=event=>{
      const code=event.clipboardData.getData('text').replace(/\D/g,'');
      if(code.length!==6)return;
      event.preventDefault();event.currentTarget.value=code;
    };
    $('lobbySail').onclick=()=>send({type:'start',settings:settingsDraft??settingsFromForm()});
    $('lobbyReturn').onclick=()=>send({type:'lobby'});
    $('lobbyReady').onclick=()=>send({type:'ready',ready:$('lobbyReady').getAttribute('aria-pressed')!=='true'});
    $('lobbyLeave').onclick=()=>{send({type:'leave'});stop('Du har forladt lobbyen.');};
    for(const id of ['lobbyMode','lobbyCourse'])$(id).onchange=()=>{
      // An earlier relay reply can arrive between selecting a course and clicking Start.
      settingsDraft=settingsFromForm();
      view();
      send({type:'settings',settings:settingsDraft});
    };
    $('lobbyCopy').onclick=()=>copy(room.code,'Koden er kopieret.');
    $('lobbyInvite').onclick=()=>copy(inviteUrl(),'Invitationslinket er kopieret.');
    const code=new URLSearchParams(location.search).get('lobby');
    if(/^\d{6}$/.test(code??'')){
      $('lobbyCodeInput').value=code;
      adapter.openPanel('lobbyPanel',null,false);
      $('lobbyName').focus();
    }
    let credentials;
    try{credentials=JSON.parse(sessionStorage.getItem(sessionKey));}catch{}
    if(credentials?.code&&(!code||code===credentials.code)&&url()){
      setPending('join');retry({type:'resume',...credentials});
    }
  }
  function boatChanged(boat){
    if(room&&!['free','lobby'].includes(room.phase)){message('Bådvalg er låst under løbet.');return false;}
    if(room)send({type:'boat',boat});
    return true;
  }
  globalThis.FriVindLobby={init,boatChanged,startFree:()=>fleet?.startFree(),startRace:(...args)=>fleet?.startRace(...args),
    step:(...args)=>fleet?.step(...args),release:()=>fleet?.release(),render:(...args)=>fleet?.render(...args),
    back:()=>send({type:'lobby'}),get fleet(){return fleet;}};
})();
