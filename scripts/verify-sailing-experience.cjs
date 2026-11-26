'use strict';

const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('@playwright/test');

async function main(url, directory) {
  if (!url || !directory) throw Error('node scripts/verify-sailing-experience.cjs URL OUTPUT_DIRECTORY');
  await fs.mkdir(directory, { recursive: true });
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ||
    (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
  args: ['--enable-unsafe-swiftshader'] });
  const records = [], actions = [], errors = [], images = [], switching = ['dinghy','yacht','ac75','ac72','laser','dinghy','laser'];
  let started;
  try {
    const page = await browser.newPage({ viewport: {width: 1180, height: 760} });
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => localStorage.setItem('fri-vind.settings.v3', JSON.stringify({
      personal:{quality:'auto',difficulty:'easy',volume:0},
      weather:{speed:8.5,direction:0,waveHeight:.45,chop:.35}
    })));
    const response = await page.goto(new URL('?proeve=lae',url).href);
    await page.click('#startButton');
    await page.waitForFunction(() => SAILING_GAME.state.time > .10);
    const cdp = await page.context().newCDPSession(page);
    cdp.on('Page.screencastFrame', frame => {
      if (frame.metadata.timestamp) images.push({ time:frame.metadata.timestamp, jpeg:Buffer.from(frame.data,'base64') });
      cdp.send('Page.screencastFrameAck',{sessionId:frame.sessionId}).catch(()=>{});
    });
    const scale = Number(process.env.TACK_EXPERIENCE_CPU || 2);
    await cdp.send('Emulation.setCPUThrottlingRate',{rate:scale});
    await page.evaluate(() => {
      const view=SAILING_GAME.scene,draw=view.render,retire=view.releaseRetiredBoat;
      const idle=window.requestIdleCallback;
      window.experienceProbe={draws:0,schedules:0,completed:0,largestQueue:0,pending:0,drawIntervals:[],lastDraw:0};
      const probe=window.experienceProbe;
      view.render=function(...args){
        const now=performance.now();
        if(probe.lastDraw)probe.drawIntervals.push(now-probe.lastDraw);
        probe.draws++;probe.lastDraw=now;return draw.apply(this,args);
      };
      view.releaseRetiredBoat=function(){
        window.requestIdleCallback=(fn,opt)=>{
          probe.schedules++;probe.pending++;
          probe.largestQueue=Math.max(probe.largestQueue,probe.pending);
          return idle.call(window,deadline=>{probe.pending--;probe.completed++;fn(deadline);},opt);
        };
        try{return retire.call(this);}finally{window.requestIdleCallback=idle;}
      };
    });
    started=performance.now();
    const elapsed=()=>performance.now()-started;
    const log=(action,value)=>actions.push({ms:elapsed(),action,value});
    let nextBoat=0, helm='', recording=false, trimmed=false;
    const seconds=Number(process.env.TACK_EXPERIENCE_SECONDS || 325);
    for(;elapsed()<seconds*1000;){
      const t=elapsed()/1000;
      if(t>=12&&!recording&&!images.length){
        await cdp.send('Page.startScreencast',{format:'jpeg',quality:78,maxWidth:900,maxHeight:585,everyNthFrame:2});
        recording=true;
      }
      if(t>=26&&recording){await cdp.send('Page.stopScreencast');recording=false;}
      if(nextBoat<switching.length&&t>=[61,108,153,198,241,272,275][nextBoat]){
        if(helm){await page.keyboard.up(helm);helm='';}
        if(nextBoat===5)await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
        const boat=switching[nextBoat++];
        await page.click('#boatMenuButton');
        await page.click('#boatPicker [data-boat="'+boat+'"]');
        await page.waitForFunction(id=>SAILING_GAME.scene.boatId===id,boat);
        log('boat',boat);trimmed=false;
      }
      const frame=await page.evaluate(()=>{
        const {scene,state,course,performanceBudget}=SAILING_GAME;
        const {render,memory,programs}=scene.renderer.info,contact=scene.hullWater.actors.get('local');
        const sample=SailingWaterDepth.sample(state.x,state.y),head=SailPhysics.wrap360(90-state.theta/SailPhysics.DEG);
        return {time:state.time,boat:state.boatId,x:state.x,y:state.y,heading:head,depth:sample.depth,
          shore:sample.distance??null,speed:state.speed,sheet:state.sheet,rudder:state.rudder,heel:state.heel,
          crew:state.crewSideBlend,visualCrew:scene.visibleCrewPose?.side??null,grounded:state.ground?.contact??false,capsized:state.capsized,
          windArrows:scene.windStrokeMesh.visible?scene.windStrokes.filter(arrow=>arrow.shown).length:0,
          wake:scene.wakeMesh.geometry.drawRange.count,spray:scene.spray.length,contacts:contact?.contacts.length??0,
          coaming:scene.coamingSubmergence,tier:performanceBudget.tier,cpuDetail:performanceBudget.cpuDetail,
          shoreVisible:scene.coastTerrain.filter(mesh=>mesh.visible).length,marks:scene.markGroup.children.length,
          draws:experienceProbe.draws,retired:Boolean(scene.retiredBoat),cpuQueue:experienceProbe.pending,
          phase:course.phase,calls:render.calls,geometries:memory.geometries,textures:memory.textures,programs:programs.length};
      });
      records.push({ms:elapsed(),...frame});
      if(!trimmed||records.length%25===0){
        const trim=frame.boat.startsWith('ac')?'62':'55';
        await page.locator('#sheetControl').fill(trim);
        await page.locator('#sea').focus();trimmed=true;log('sheet',trim);
      }
      const target=nextBoat%2===0?150:215;
      const error=((target-frame.heading+540)%360)-180;
      const next=Math.abs(error)<9||frame.capsized?'':error>0?'ArrowRight':'ArrowLeft';
      if(next!==helm){
        if(helm)await page.keyboard.up(helm);
        if(next)await page.keyboard.down(next);
        helm=next;log('helm',helm);
      }
      await page.waitForTimeout(650);
    }
    if(recording)await cdp.send('Page.stopScreencast');
    if(helm)await page.keyboard.up(helm);
    const probe=await page.evaluate(()=>experienceProbe);
    await fs.writeFile(path.join(directory,'sejlads.json'),JSON.stringify({
      build:await response.headerValue('x-fri-vind-revision'),url,seconds:elapsed()/1000,scale,records,actions,probe,errors
    },null,2));
    const clips=path.join(directory,'frames');
    await fs.mkdir(clips,{recursive:true});
    const manifest=[];
    for(const [i,image] of images.entries()){
      const name=String(i).padStart(5,'0')+'.jpg';
      await fs.writeFile(path.join(clips,name),image.jpeg);
      manifest.push("file '"+name+"'");
      manifest.push('duration '+Math.max(.016,images[i+1]?images[i+1].time-image.time:.05).toFixed(4));
    }
    await fs.writeFile(path.join(clips,'concat.txt'),manifest.join('\n')+'\n');
    console.log({seconds:elapsed()/1000,draws:probe.draws,recorded:images.length,switches:nextBoat,queue:probe.largestQueue,errors});
    if(errors.length)throw Error(errors.join('\n'));
  } finally {await browser.close();}
}
main(...process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
