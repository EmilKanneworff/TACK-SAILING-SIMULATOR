'use strict';

const fs=require('node:fs/promises');
const path=require('node:path');
const {chromium}=require('@playwright/test');
const {introOption}=require('./browser-setup.cjs');

const phase=process.argv[2];
if(!['foer','efter'].includes(phase))throw Error('Vælg foer eller efter');
const url=process.env.FRI_VIND_URL||'http://localhost:5173/';
const output=path.resolve('gennemgang/vand',phase);
const viewport={width:1360,height:850};
const shot={speed:12.1,direction:270,swellDirection:270,wavePeriod:3.7,shortSea:1.1,gusts:0,waves:.85,x:-300,y:-860,theta:.43,velocity:3.6,time:8.75};
const layers=['samlet','geometri','normaler','refleksion','skum'];

async function prepare(page,setup=shot,freeze=true){
  const response=await page.goto(url);
  await (await introOption(page,'#introBoat')).selectOption('yacht');
  await page.click('#startButton');
  if(freeze){
    await page.clock.install();
    await page.clock.pauseAt(await page.evaluate(()=>Date.now()+200));
  }
  await page.evaluate(setup=>{
    const game=SAILING_GAME,{env,scene,state}=game,P=SailPhysics;
    Object.assign(env,{speed:setup.speed,direction:setup.direction,swellDirection:setup.swellDirection,wavePeriod:setup.wavePeriod,
      shortSea:setup.shortSea,waves:setup.waves,gusts:setup.gusts});
    const s=P.createState({boatId:'yacht',time:setup.time,x:setup.x,y:setup.y,theta:setup.theta,
      vx:setup.velocity*Math.cos(setup.theta),vy:setup.velocity*Math.sin(setup.theta),sheet:.42},env);
    SailingWeather.initialize(s,env);
    Object.assign(state,s);
    const wind=document.querySelector('#windSpeed');
    wind.value=String(env.speed);wind.dispatchEvent(new Event('input',{bubbles:true}));
    game.map.update(state,env,game.course);game.map.draw();
    scene.lastTime=-1;
    scene.update(state,env,game.course,1/60,{cameraMode:0,quality:'high',paused:true});
    if(scene.surfaceFoam){
      const wet={...env,waveCurrent:state.seaState,waveProfile:state.waveProfile};
      for(let i=14;i>=0;i--)scene.surfaceFoam.update({...state,time:state.time-i*.15},wet,i===14);
      scene.renderer.render(scene.scene,scene.camera);
    }
  },setup);
  return response.headers()['x-fri-vind-revision'];
}

async function captureLayers(page){
  const report={layers:{},revision:await prepare(page),setup:shot};
  const errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  for(const [index,name] of layers.entries()){
    const data=await page.evaluate(index=>{
      const {scene}=SAILING_GAME,material=scene.water.material,T=THREE;
      const changed=[];
      if(index){
        const mode=['','geometry','normals','reflection','foam'][index];
        if(material.uniforms.waterView)material.uniforms.waterView.value=index;
        else{
          const replacement={
            geometry:'vec3 raw=normalize(cross(dFdx(vWorld),dFdy(vWorld)));raw*=sign(raw.y);color=vec3(.23,.32,.35)*(1.+1.5*(dot(raw,sunDir)-sunDir.y));',
            normals:'color=vec3(.5)+.48*vec3(n.x,n.z,n.y-.5);',
            reflection:'color=skyReflection*fresnel+sunTint*reflectedSun*sunlight*sunStrength*farFade;',
            foam:'color=vec3(foam);'
          }[mode];
          const audit=material.clone();
          // Keep the bound textures, local masks and wave time from the real material.
          audit.uniforms=material.uniforms;
          audit.fragmentShader=audit.fragmentShader.replace('gl_FragColor=vec4(color,opacity);',replacement+'\n gl_FragColor=vec4(color,opacity);');
          scene.water.material=audit;
        }
        for(const object of [scene.windStrokeMesh,scene.rainLines,scene.wakeMesh,scene.foilWakeMesh,scene.contactFoam,scene.foamPoints,scene.breakingFoam,scene.shoreFoam]){
          if(object&&(index!==4||object===scene.windStrokeMesh||object===scene.rainLines)){changed.push([object,object.visible]);object.visible=false;}
        }
      }
      scene.renderer.render(scene.scene,scene.camera);
      const context=scene.renderer.getContext();
      const data={gl:context.getError(),triangles:scene.renderer.info.render.triangles,
        camera:scene.camera.position.toArray(),time:scene.waterUniforms.time.value};
      const audit=scene.water.material;
      if(audit!==material){scene.water.material=material;audit.dispose();}
      if(material.uniforms.waterView)material.uniforms.waterView.value=0;
      for(const [object,visible] of changed)object.visible=visible;
      return data;
    },index);
    await page.screenshot({path:path.join(output,name+'.png')});
    report.layers[name]=data;
  }
  report.errors=errors;
  return report;
}


async function voyages(browser){
  const scenarios={
    'modsoe':{theta:Math.PI},'tvaerssoe':{theta:Math.PI/2},'medsoe':{theta:.10},
    'verdenskoordinater':{velocity:1.1,theta:.39},
    'fra-kysten':{x:346,y:-151,direction:90,swellDirection:90,theta:-2.8,velocity:3.8,speed:8}
  };
  const report={scenes:{},errors:[]};
  for(const [name,changes] of Object.entries(scenarios)){
    const context=await browser.newContext({viewport,recordVideo:{dir:output,size:{width:960,height:600}}});
    const page=await context.newPage();
    try{
      page.on('pageerror',error=>report.errors.push(error.message));
      const setup={...shot,...changes,time:0};
      report.revision=await prepare(page,setup,false);
      const samples=[];
      const times=name==='fra-kysten'?[1,3,6,9,12,15,18]:[1,2,3,4,5,6,7,8,9];
      for(const time of times){
        await page.waitForFunction(t=>SAILING_GAME.state.time>=t,time,{timeout:45000});
        const data=await page.evaluate(()=>{
          const {state:s,env,scene}=SAILING_GAME,P=SailPhysics;
          const wet={...env,waveCurrent:s.seaState,waveProfile:s.waveProfile};
          const water=P.waveAt(s.x,s.y,s.time,wet);
          return {time:s.time,x:s.x,y:s.y,camera:scene.cameraMode,speed:s.speed,heave:s.heave,heel:s.heel,pitch:s.pitch,
            wave:water.height,force:[s.hydro.waveFx,s.hydro.waveFy],depth:-SailingWorld.heightAt(s.x,s.y),
            samples:scene.waterSamples?{...scene.waterSampleOrigin}:null,ground:s.ground?.contact??false};
        });
        samples.push(data);
        if(name==='verdenskoordinater'&&time===1)await page.evaluate(()=>{SAILING_GAME.scene.waterSampleMode=true;});
        if(name==='verdenskoordinater'&&time===3)await page.screenshot({path:path.join(output,'vandproever.png')});
        if(name==='verdenskoordinater'&&time===5)await page.click('#cameraButton');
        if(name==='fra-kysten'&&(time===1||time===18))await page.screenshot({path:path.join(output,time===1?'kyst-naer.png':'kyst-ude.png')});
      }
      report.scenes[name]={setup,samples};
    }finally{
      const video=page.video();
      await context.close();
      await fs.rename(await video.path(),path.join(output,name+'.webm'));
    }
  }
  await captureStates(browser);
  await fs.writeFile(path.join(output,'sejlads.json'),JSON.stringify(report,null,2)+'\n');
  if(report.errors.length)throw Error(JSON.stringify(report.errors));
  console.log(report.revision,Object.keys(report.scenes));
}

async function captureStates(browser){
  for(const [name,conditions] of [['roligt',{speed:5,waves:0}],['moderat',{speed:6,waves:.35}]]){
    const page=await browser.newPage({viewport});
    try{
      await prepare(page,{...shot,...conditions});
      await page.screenshot({path:path.join(output,name+'.png')});
    }finally{await page.close();}
  }
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',executablePath:process.env.CHROME_PATH});
  try{
    if(process.argv.includes('--states'))return await captureStates(browser);
    if(process.argv.includes('--clips'))return await voyages(browser);
    const page=await browser.newPage({viewport});
    const report=await captureLayers(page);
    await fs.writeFile(path.join(output,'lag.json'),JSON.stringify(report,null,2)+'\n');
    console.log(report.revision,report.layers);
    if(report.errors.length||Object.values(report.layers).some(l=>l.gl))throw Error(JSON.stringify(report.errors));
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
