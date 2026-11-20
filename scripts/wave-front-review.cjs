'use strict';

const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const {execFileSync}=require('node:child_process');
const {chromium}=require('@playwright/test');

const fps=15,frames=120,steps=60/fps;
const viewport={width:1120,height:700};
const output=path.resolve('gennemgang/vand/boelgefronter');
const url=process.env.FRI_VIND_URL||'http://localhost:5173/?proeve=boelger';
const options={fps,steps,speed:20,waves:1,bearing:270,anchor:{x:-675,y:-1100}};

async function prepare(page,neutral){
  const response=await page.goto(url);
  await page.locator('#startButton:enabled').click();
  await page.clock.install();
  await page.clock.pauseAt(await page.evaluate(()=>Date.now()+150));
  await page.evaluate(({neutral,speed,waves,bearing,anchor,steps,fps})=>{
    const game=SAILING_GAME,{scene,course}=game,P=SailPhysics,T=THREE;
    const theta=.43,heading=bearing*P.DEG;
    const fx=-Math.sin(heading),fy=-Math.cos(heading),ax=-fy,ay=fx;
    const env={...game.env,speed,waves,direction:bearing,swellDirection:bearing,
      gusts:0,wavePeriod:P.BASE_WAVE_PERIOD,shortSea:1};
    const wave=P.WAVE_COMPONENTS[0],phaseSpeed=wave.omega/wave.k,startOffset=-25;
    const startPhase=(wave.k*(anchor.x*fx+anchor.y*fy+startOffset)+wave.phase-Math.PI/2)/wave.omega;
    const period=2*Math.PI/wave.omega,start=((startPhase%period)+period)%period+period*3;
    const state=P.createState({boatId:'yacht',...anchor,theta,time:start,
      vx:neutral?0:1.9*Math.cos(theta),vy:neutral?0:1.9*Math.sin(theta),sheet:.42},env);
    SailingWeather.initialize(state,env);

    document.body.classList.add('clear-view');
    const style=document.createElement('style');
    style.textContent='.clear-view .tools,.clear-view #downwindControls,.clear-view .brand {display:none!important}';
    document.head.append(style);
    let label,grid,crest;
    const world=(ahead,across)=>({x:anchor.x+fx*ahead+ax*across,y:anchor.y+fy*ahead+ay*across});
    function makeLine(points,color,opacity,segments=false){
      const geometry=new T.BufferGeometry();
      geometry.setAttribute('position',new T.BufferAttribute(new Float32Array(points.length*3),3).setUsage(T.DynamicDrawUsage));
      const material=new T.LineBasicMaterial({color,opacity,transparent:true,depthWrite:false});
      const line=segments?new T.LineSegments(geometry,material):new T.Line(geometry,material);
      line.frustumCulled=false;
      line.renderOrder=3;
      scene.scene.add(line);
      return line;
    }
    const gridPoints=[],crossings=[];
    if(neutral){
      for(let across=-24;across<=24;across+=8){
        for(let ahead=-40;ahead<40;ahead+=2)gridPoints.push(world(ahead,across),world(ahead+2,across));
      }
      for(let ahead=-40;ahead<=40;ahead+=8){
        for(let across=-24;across<24;across+=2)gridPoints.push(world(ahead,across),world(ahead,across+2));
      }
      for(let across=-24;across<=24;across+=.75)crossings.push(across);
      grid=makeLine(gridPoints,0xc2e0e2,.44,true);
      crest=makeLine(crossings,0xffce76,1);
      const startArrow=world(-16,-19);
      const arrow=new T.ArrowHelper(new T.Vector3(fx,0,-fy),new T.Vector3(startArrow.x,1.3,-startArrow.y),9,0xffce76,1.7,1.1);
      scene.scene.add(arrow);
      label=document.createElement('div');
      label.style.cssText='position:fixed;top:24px;left:24px;z-index:100;padding:12px 16px;border-radius:8px;background:#0c2b37f0;color:#f7f2e6;font:600 15px system-ui;line-height:1.5';
      document.body.append(label);
    }
    const setLine=(line,points,water,lift)=>{
      const positions=line.geometry.getAttribute('position');
      points.forEach(({x,y},i)=>positions.setXYZ(i,x,water(x,y)+lift,-y));
      positions.needsUpdate=true;
    };

    const camera=scene.camera;
    const fixed=new T.Vector3(anchor.x-27,24,-anchor.y+49),target=new T.Vector3(anchor.x+3,1,-anchor.y);
    scene.updateCamera=()=>{
      camera.position.copy(fixed);
      camera.fov=52;
      camera.lookAt(target);
      camera.updateProjectionMatrix();
    };
    scene.waterUniforms.waterView.value=neutral?1:0;
    if(neutral)for(const object of [scene.surfaceFoam.mesh,scene.wakeMesh,scene.foilWakeMesh,scene.contactFoam,scene.foamPoints,scene.shoreFoam])if(object)object.visible=false;
    window.paintWaveReview=frame=>{
      const elapsed=frame/fps;
      if(neutral)state.time=start+elapsed;
      else if(frame)for(let step=0;step<steps;step++)P.step(state,{steer:0,trim:0,crewPose:2},env,1/60);
      const wet={...env,waveCurrent:state.seaState,waveProfile:state.waveProfile};
      const water=(x,y)=>P.waveAt(x,y,state.time,wet).height;
      let byBoat=null,acrossRange=null;
      if(neutral){
        const predicted=startOffset+phaseSpeed*elapsed;
        setLine(grid,gridPoints,water,.035);
        const line=crossings.map(across=>{
          let best=world(predicted,across),highest=-Infinity,position=predicted;
          for(let shift=-4;shift<=4;shift+=.2){
            const point=world(predicted+shift,across),height=water(point.x,point.y);
            if(height<=highest)continue;
            best=point;highest=height;position=predicted+shift;
          }
          return {...best,position};
        });
        setLine(crest,line,water,.066);
        byBoat=line[line.length>>1].position;
        acrossRange=Math.max(...line.map(p=>p.position))-Math.min(...line.map(p=>p.position));
        label.textContent='Bølger mod øst · markeret bølgekam · gitter 8 m · '+elapsed.toFixed(1).replace('.',',')+' s';
      }
      scene.update(state,env,course,steps/60,{cameraMode:0,quality:'high',paused:neutral,windArrows:false});
      return {elapsed,byBoat,acrossRange,heave:state.heave,pitch:state.pitch,water:water(state.x,state.y),
        x:state.x,y:state.y,foam:scene.surfaceFoam.patches.length,camera:camera.position.toArray()};
    };
  },{...options,neutral});
  return response.headers()['x-fri-vind-revision'];
}

async function capture(browser,neutral,temp){
  const name=neutral?'fast-kamera':'sejlads';
  const folder=path.join(temp,name);
  await fs.mkdir(folder);
  const page=await browser.newPage({viewport});
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  try{
    const revision=await prepare(page,neutral);
    const readings=[];
    for(let i=0;i<frames;i++){
      const reading=await page.evaluate(i=>paintWaveReview(i),i);
      const file=path.join(folder,String(i).padStart(3,'0')+'.jpg');
      await page.screenshot({path:file,type:'jpeg',quality:94});
      if(i%fps===0||i===frames-1)readings.push(reading);
      if(i===4*fps)await page.screenshot({path:path.join(output,name+'.png')});
    }
    const webglError=await page.evaluate(()=>SAILING_GAME.scene.renderer.getContext().getError());
    if(errors.length||webglError)throw Error(JSON.stringify({errors,webglError}));
    execFileSync('ffmpeg',['-loglevel','error','-y','-framerate',String(fps),'-i',path.join(folder,'%03d.jpg'),
      '-c:v','libx264','-crf','19','-pix_fmt','yuv420p','-movflags','+faststart',path.join(output,name+'.mp4')]);
    console.log(name,revision);
    return {revision,readings};
  }finally{await page.close();}
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const temp=await fs.mkdtemp(path.join(os.tmpdir(),'fri-vind-boelgefronter-'));
  const browser=await chromium.launch({channel:'chrome',executablePath:process.env.CHROME_PATH});
  try{
    const neutral=await capture(browser,true,temp);
    const sailing=await capture(browser,false,temp);
    await fs.writeFile(path.join(output,'maaling.json'),JSON.stringify({options,neutral,sailing},null,2)+'\n');
  }finally{
    await browser.close();
    await fs.rm(temp,{recursive:true,force:true});
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
