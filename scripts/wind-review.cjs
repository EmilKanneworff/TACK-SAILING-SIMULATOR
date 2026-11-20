'use strict';

const path=require('node:path');
const fs=require('node:fs/promises');
const assert=require('node:assert/strict');
const {chromium}=require('@playwright/test');

const url=process.env.FRI_VIND_URL||'http://localhost:5173/';
const output=path.resolve(process.env.FRI_VIND_REVIEW_DIR||'gennemgang/lae/maalinger-metrisk');
const directions=[[0,'nord'],[90,'oest'],[180,'syd'],[270,'vest']];
const viewport={width:1360,height:880};

async function charts(browser,report){
  const page=await browser.newPage({viewport});
  try{
    page.on('pageerror',error=>report.errors.push(error.message));
    await page.goto(new URL('/assets/vindkort.html',url).href);
    await page.waitForFunction(()=>document.querySelector('iframe').contentWindow.SailingWind);
    for(const [bearing,name] of directions){
      await page.locator(`[data-direction="${bearing}"]`).click();
      report.charts[name]=await page.evaluate(()=>{
        const frame=document.querySelector('iframe').contentWindow;
        return {
          map:frame.SailingWorld.version,
          contributions:frame.SailingWind.field(Number(document.querySelector('button[aria-pressed="true"]').dataset.direction)).a.shore.length
        };
      });
      assert(report.charts[name].contributions>0);
      await page.screenshot({path:path.join(output,name+'.png'),fullPage:true});
    }
    report.calibration=await page.evaluate(()=>{
      const {SailingWorld:world,SailingWind:wind}=document.querySelector('iframe').contentWindow;
      const env={speed:8.5,direction:0,gusts:0};
      const transects=[['fyn',-1150],['bjorno',1500],['svelmo',6280]].map(([id,x])=>{
        const island=world.ISLANDS.find(p=>p.id===id),points=island.points;
        const hits=points.flatMap((a,i)=>{
          const b=points[(i+1)%points.length];
          return (a.x>x)!==(b.x>x)?[a.y+(b.y-a.y)*(x-a.x)/(b.x-a.x)]:[];
        });
        const shore=Math.min(...hits);
        return {id,x,shore,measurements:[5,25,50,150,300].map(distance=>{
          const y=shore-distance;
          return {distance,depth:-world.heightAt(x,y),wind:wind.at(x,y,0,env).meanSpeed,
            windAt10m:wind.at(x,y,0,env,10).meanSpeed,reversed:wind.at(x,y,0,{...env,direction:180}).meanSpeed};
        })};
      });
      return {config:wind.CONFIG,transects};
    });
    const [fyn,bjorno,svelmo]=report.calibration.transects.map(item=>item.measurements);
    assert(fyn.every(p=>p.depth>0&&p.reversed>8.4));
    assert(fyn[0].wind<4&&fyn[2].wind<bjorno[2].wind&&fyn[3].wind<8);
    assert(svelmo[0].wind>7.5&&fyn[4].wind>8);
    await page.locator('#gusts').check();
    await page.waitForTimeout(300);
    const position=await page.evaluate(()=>{
      const rect=document.querySelector('canvas').getBoundingClientRect(),b=document.querySelector('iframe').contentWindow.SailingWorld.bounds;
      return {x:(-1150-b.minX)/(b.maxX-b.minX)*rect.width,y:(b.maxY+2300)/(b.maxY-b.minY)*rect.height};
    });
    await page.locator('canvas').hover({position});
    await page.waitForFunction(()=>document.querySelector('#point').textContent.includes('m/s i 2 m'));
  }finally{await page.close();}
}

async function voyage(browser,report){
  const context=await browser.newContext({viewport,recordVideo:{dir:output,size:{width:1020,height:660}}});
  const page=await context.newPage();
  try{
    page.on('pageerror',error=>report.errors.push(error.message));
    const response=await page.goto(new URL('?proeve=lae',url).href);
    report.revision=response.headers()['x-fri-vind-revision'];
    await page.locator('#startButton').click();
    await page.evaluate(()=>{
      const box=document.createElement('div');
      box.setAttribute('aria-hidden','true');
      box.style.cssText='position:fixed;left:20px;top:84px;z-index:15;padding:10px 14px;background:#123641eb;border:1px solid #518b90;border-radius:9px;color:#f0f4eb;font:600 14px system-ui;font-variant-numeric:tabular-nums;white-space:pre-line;min-width:168px;pointer-events:none';
      document.body.append(box);
      requestAnimationFrame(function update(){
        const {state,env}=SAILING_GAME;
        const wind=SailPhysics.windAt(state.x,state.y,state.time,env),fmt=v=>v.toFixed(1).replace('.',',');
        const reading='Middelvind '+fmt(wind.meanSpeed)+' m/s\nGrundvind '+fmt(env.speed)+' m/s\n'+Math.round(wind.exposure*100)+' % af grundvinden';
        if(box.textContent!==reading)box.textContent=reading;
        requestAnimationFrame(update);
      });
    });
    const sample=()=>page.evaluate(()=>{
      const {state,env,scene}=SAILING_GAME;
      const wind=SailPhysics.windAt(state.x,state.y,state.time,env);
      return {time:state.time,x:state.x,y:state.y,mean:wind.meanSpeed,speed:wind.speed,exposure:wind.exposure,
        indicated:state.wind.tws,boatSpeed:state.speed,load:state.sail.load,camera:scene.cameraMode,contact:state.ground?.contact};
    });
    const first=await sample();
    report.voyage=[first];
    for(const time of [5,10,20,30,40,45]){
      await page.waitForFunction(t=>SAILING_GAME.state.time>=t,time,{timeout:60000});
      const point=await sample();
      report.voyage.push(point);
      assert(Math.abs(point.speed-point.indicated)<1e-8);
      assert(!point.contact);
      if(time===5)await page.screenshot({path:path.join(output,'i-lae.png')});
      if(time===45)await page.screenshot({path:path.join(output,'ude-af-lae.png')});
    }
    assert(report.voyage.at(-1).exposure>=.9);
    assert(report.voyage.at(-1).mean-first.mean>.6);
  }finally{
    const video=page.video();
    await context.close();
    await fs.rename(await video.path(),path.join(output,'fra-lae-til-fri-vind.webm'));
  }
}

(async()=>{
  await fs.mkdir(output,{recursive:true});
  const browser=await chromium.launch({channel:'chrome',executablePath:process.env.CHROME_PATH});
  const report={charts:{},calibration:null,voyage:[],errors:[]};
  try{
    await charts(browser,report);
    await voyage(browser,report);
    assert.deepEqual(report.errors,[]);
    console.log(report.revision,report.charts);
    console.log(report.voyage.map(p=>[p.time,p.mean,p.speed]));
  }finally{
    await browser.close();
    await fs.writeFile(path.join(output,'maalinger.json'),JSON.stringify(report,null,2)+'\n');
  }
})().catch(error=>{console.error(error);process.exitCode=1;});
