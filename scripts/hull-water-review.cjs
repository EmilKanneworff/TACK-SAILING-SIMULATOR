'use strict';

const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {spawnSync}=require('node:child_process');
const {chromium}=require('@playwright/test');

const phase=process.argv[2],stills=process.argv.includes('--stills');
if(!['foer','efter'].includes(phase))throw Error('Vælg foer eller efter.');
const url=process.env.FRI_VIND_URL||'http://localhost:5173/';
const output=path.resolve('gennemgang/vand/vandkontakt',phase);
const fps=15,viewport={width:1120,height:700};
const scenes=[
  {key:'laser-stille',title:'Laserjolle · stille vand',length:1.7,wind:0,waves:0,velocity:0,sheet:0,still:[1]},
  {key:'laser-acceleration',title:'Laserjolle · accelererer',length:4.8,wind:14,waves:.035,velocity:.45,sheet:.60,still:[4.5]},
  {key:'laser-kraengning',title:'Laserjolle · krængning',length:3,wind:11,waves:.17,velocity:3.9,sheet:.53,heel:-.46,still:[.25,1]},
  {key:'laser-sving',title:'Laserjolle · sving og afbremsning',length:9.5,wind:8,waves:.04,velocity:4.2,sheet:.55,lead:3,turn:true,still:[1,4.8,9]},
  {key:'laser-boelger',title:'Laserjolle · gennem bølger',length:4.6,wind:14,waves:.78,velocity:3.6,sheet:.53,still:[2.6]},
  {key:'foil-loeft',title:'Foilmonohull · løft',boatId:'ac75',length:6,wind:12,waves:.12,bearing:225,theta:.95,velocity:12,sheet:.56,still:[1,5.6]},
  {key:'foil-landing',title:'Foilmonohull · landing',boatId:'ac75',length:9.5,wind:12,waves:.12,bearing:225,theta:.95,velocity:12,sheet:.56,lead:5,land:true,still:[.5,2.5,8.7]}
];

async function start(browser){
  const page=await browser.newPage({viewport,deviceScaleFactor:1});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('console',line=>{if(line.type()==='error'&&/shader|WebGL|THREE/i.test(line.text()))errors.push(line.text());});
  const response=await page.goto(url);
  await page.locator('#startButton:enabled').click();
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+100));
  await page.evaluate(()=>{
    const style=document.createElement('style');
    style.textContent=`#water-review{position:fixed;top:17px;left:20px;z-index:250;color:#f2f6ea;background:#09252fe8;border:1px solid #67828a;
      border-radius:9px;padding:8px 12px;font:600 13px system-ui;line-height:1.55;white-space:pre}
      #hud,#startButton,#quickStartButton{display:none!important}`;
    document.head.append(style);
    const label=document.createElement('div');label.id='water-review';document.body.append(label);
    const P=SailPhysics,g=SAILING_GAME,w=g.scene;
    let options,s,env,frame,mode;
    window.reviewSetup=(cfg,camera=0)=>{
      options=cfg;mode=camera;frame=0;
      const boatId=cfg.boatId||'laser',theta=cfg.theta??.96,velocity=cfg.velocity;
      env={...g.env,boatId,speed:cfg.wind,direction:cfg.bearing??270,swellDirection:cfg.bearing??270,
        waves:cfg.waves,shortSea:1,gusts:0,shelter:false,weather:'clear',seaStateRate:0};
      if(cfg.overcast)SailingWeather.applyPreset(env,'overcast');
      if(cfg.overcast)Object.assign(env,{speed:cfg.wind,waves:cfg.waves,direction:cfg.bearing??270});
      s=P.createState({boatId,x:0,y:-1400,theta,vx:velocity*Math.cos(theta),vy:velocity*Math.sin(theta),
        sheet:cfg.sheet,crewPose:cfg.heel?1:2,heel:cfg.heel||0},env);
      SailingWeather.initialize(s,env);w.lastTime=-1;
      for(let i=0;i<(cfg.lead||0)*60;i++){
        P.step(s,{steer:0,trim:0,crewPose:2},env,1/60);
        if(cfg.turn&&i%4===0)paint();
      }
      if(cfg.heel)Object.assign(s,{heel:cfg.heel,heelRate:0});
      if(cfg.land){
        env.speed=0;env.gusts=0;
      }
    };
    function paint(reset=false){
      if(reset)w.lastTime=-1;
      w.update(s,env,{marks:[]},1/15,{cameraMode:mode,quality:'high',helpers:false,windArrows:false});
    }
    window.reviewFrame=(target,layer)=>{
      const elapsed=target/15;
      while(frame<target){
        const t=frame/15;
        if(options.turn&&t>2.15)env.speed=0;
        const steer=options.turn&&t<2.1?-.82:options.land&&t<3?.38:0;
        const trim=options.land||options.turn&&t>1.9?-1:0;
        const steps=options.turn&&t>5.2?100:4;
        for(let i=0;i<steps;i++)P.step(s,{steer,steerDigital:true,trim,crewPose:options.heel?1:2},env,1/60);
        frame++;
        paint();
      }
      if(target===0)paint();
      const speed=Math.hypot(s.vx,s.vy),wet=s.foiling?.hullWetFraction;
      label.textContent=options.title+(options.turn&&elapsed>5.2?' · afslutning ×25':'')+'\n'+(speed*1.94384).toFixed(1)+' knob  ·  '+(s.heel*180/Math.PI).toFixed(0)+'° krængning  ·  '+elapsed.toFixed(1)+' s'+
        (wet==null?'':'  ·  '+Math.round(wet*100)+' % skrogkontakt');
      if(layer==='wake-off'){
        w.wakeMesh.visible=false;w.renderer.render(w.scene,w.camera);
      }else if(layer==='reflection-off'&&w.hullWater){
        w.hullWater.uniforms.boatReflectionEnabled.value=0;w.renderer.render(w.scene,w.camera);
      }
      const fx=w.hullWater?.actors.get('local');
      return {time:s.time,speed,heel:s.heel,x:s.x,y:s.y,heave:s.heave,heading:s.theta,wet,foil:s.foiling?.status,
        points:w.wakes.length,spray:w.spray.length,localWaves:w.hullWater?.uniforms.contactWaveCount.value,
        contact:fx?.contacts.map(({id,depth,closing,wet})=>({id,depth,closing,wet})),capsized:s.capsized};
    };
  });
  return {page,errors,revision:await response.headerValue('x-fri-vind-revision')};
}
async function run(){
  await fs.mkdir(output,{recursive:true});
  const work=await fs.mkdtemp(path.join(os.tmpdir(),'frivind-hull-review-'));
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    args:['--ignore-gpu-blocklist','--enable-unsafe-swiftshader','--disable-background-timer-throttling']});
  try{
    const {page,errors,revision}=await start(browser);
    const results={phase,revision,viewport,fps,camera:0,scenes:{},errors};
    const segmentFiles=[];
    for(const cfg of scenes.filter(cfg=>!process.env.FRI_VIND_REVIEW_SCENE||cfg.key===process.env.FRI_VIND_REVIEW_SCENE)){
      await page.evaluate(cfg=>reviewSetup(cfg),cfg);
      const samples=[],targets=new Set(cfg.still.map(t=>Math.round(t*fps)));
      const folder=path.join(work,cfg.key);
      if(!stills)await fs.mkdir(folder);
      for(let frame=0;frame<Math.round(cfg.length*fps);frame++){
        const sample=await page.evaluate(frame=>reviewFrame(frame),frame);
        if(frame%5===0||targets.has(frame))samples.push(sample);
        if(!stills||targets.has(frame)){
          const bytes=await page.screenshot({type:'jpeg',quality:85});
          if(!stills)await fs.writeFile(path.join(folder,String(frame).padStart(4,'0')+'.jpg'),bytes);
          if(targets.has(frame))await fs.writeFile(path.join(output,cfg.key+'-'+frame+'.jpg'),bytes);
        }
      }
      results.scenes[cfg.key]={setup:cfg,samples};
      await fs.writeFile(path.join(output,'manoeverdata.json'),JSON.stringify(results,null,2)+'\n');
      if(!stills){
        const video=path.join(work,cfg.key+'.mp4'),render=spawnSync('ffmpeg',['-v','error','-y','-framerate',String(fps),'-i',path.join(folder,'%04d.jpg'),
          '-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',video],{encoding:'utf8'});
        if(render.status!==0)throw Error(render.stderr);
        segmentFiles.push(video);
      }
      console.log(cfg.key,samples[0]?.foil,samples.at(-1)?.foil,samples[0]?.speed,samples.at(-1)?.speed);
    }
    const diagnostic={...scenes[3],lead:4,turn:false,title:'Laserjolle · lagkontrol fra siden'};
    await page.evaluate(cfg=>reviewSetup(cfg,3),diagnostic);
    await page.evaluate(()=>reviewFrame(32));
    await page.screenshot({path:path.join(output,'lag-alle.jpg'),quality:93});
    await page.evaluate(()=>reviewFrame(32,'wake-off'));
    await page.screenshot({path:path.join(output,'lag-uden-koelvand.jpg'),quality:93});
    if(phase==='efter'){
      const calm={...scenes[0],title:'Laserjolle · roligt vand fra siden'};
      await page.evaluate(cfg=>reviewSetup(cfg,3),calm);
      await page.evaluate(()=>reviewFrame(10));
      await page.screenshot({path:path.join(output,'lag-refleksion.jpg'),quality:93});
      await page.evaluate(()=>reviewFrame(10,'reflection-off'));
      await page.screenshot({path:path.join(output,'lag-uden-refleksion.jpg'),quality:93});
      for(const [name,mode] of [['ovenfra',1],['cockpit',2]]){
        await page.evaluate(({cfg,mode})=>reviewSetup(cfg,mode),{cfg:{...diagnostic,title:'Laserjolle · '+name},mode});
        await page.evaluate(()=>reviewFrame(26));
        await page.screenshot({path:path.join(output,'laser-'+name+'.jpg'),quality:90});
      }
      const clouds={...diagnostic,overcast:true,title:'Laserjolle · overskyet'};
      await page.evaluate(cfg=>reviewSetup(cfg,3),clouds);
      await page.evaluate(()=>reviewFrame(32));
      await page.screenshot({path:path.join(output,'laser-overskyet.jpg'),quality:90});
      for(const [boatId,name] of [['dinghy','Racer 32'],['yacht','Turbåd 43'],['ac75','Foilmonohull'],['ac72','Foilkatamaran']]){
        const cfg={...scenes[2],boatId,velocity:boatId.startsWith('ac')?6:4.6,heel:0,title:name+' · fra siden'};
        await page.evaluate(cfg=>reviewSetup(cfg,3),cfg);
        await page.evaluate(()=>reviewFrame(34));
        await page.screenshot({path:path.join(output,boatId+'-fra-siden.jpg'),quality:90});
      }
    }
    if(!stills)for(const [name,files] of [['laser',segmentFiles.slice(0,5)],['foil',segmentFiles.slice(5)]]){
      const list=path.join(work,name+'.txt');
      await fs.writeFile(list,files.map(file=>"file '"+file+"'").join('\n')+'\n');
      const result=spawnSync('ffmpeg',['-v','error','-y','-f','concat','-safe','0','-i',list,'-c','copy','-movflags','+faststart',path.join(output,name+'.mp4')],{encoding:'utf8'});
      if(result.status!==0)throw Error(result.stderr);
    }
    if(errors.length)throw Error(errors[0]);
  }finally{
    await browser.close();await fs.rm(work,{recursive:true,force:true});
  }
}
run().catch(e=>{console.error(e);process.exitCode=1;});
