'use strict';

const fs = require('node:fs/promises');
const { chromium } = require('@playwright/test');
const { changeScene } = require('./render-performance.cjs');

const bounds=[
  ['vec3 farNormal=normalize(vec3(-vSlope.x,1.,-vSlope.y));','if(simplified>=1.)'],
  ['float depth=seaDepth(vWorld.xz);','vec3 body=mix(nearColor*.73']
];
function segments(html) {
  return bounds.map(([from,to])=>{
    const start=html.indexOf(from),end=html.indexOf(to,start);
    if(start<0||end<0)throw Error('Vandshaderens grænser mangler');
    return html.slice(start,end);
  });
}

async function main(url, baseline, output) {
  if(!url||!baseline||!output)throw Error('node scripts/verify-water-gpu.cjs URL BASELINE_HTML OUTPUT');
  const original=segments(await fs.readFile(baseline,'utf8'));
  const browser=await chromium.launch({executablePath:process.env.CHROME_PATH||
    (process.platform==='darwin'?'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome':undefined),args:['--enable-unsafe-swiftshader']});
  try {
    const errors=[];
    const scenes=[
      {name:'havn',boat:'laser',x:4,y:-47,heading:-1.5,speed:2,camera:0},
      {name:'katamaran-regn',boat:'ac72',x:-1900,y:-2170,heading:-.45,speed:10,camera:0,rain:.95}
    ];
    const all=[];
    let build;
    for(const stage of scenes){
      const page=await browser.newPage({viewport:{width:1120,height:700},deviceScaleFactor:1.5});
      page.on('pageerror',error=>errors.push(error.message));
      page.on('console',item=>{if(item.type()==='error')errors.push(item.text());});
      await page.addInitScript(()=>{
        localStorage.setItem('fri-vind.settings.v3',JSON.stringify({personal:{quality:'high'}}));
        const raf=window.requestAnimationFrame.bind(window);
        window.requestAnimationFrame=fn=>window.freezeWater&&fn.name==='frame'?0:raf(fn);
      });
      const response=await page.goto(url), current=segments(await response.text());
      build=await response.headerValue('x-fri-vind-revision');
      await page.click('#startButton');
      await page.waitForFunction(()=>SAILING_GAME.state.time>.15);
      await page.evaluate(changeScene,stage);
      const results=await page.evaluate(async({stage,original,current})=>{
        window.freezeWater=true;
        const {scene,state,env,course}=SAILING_GAME,renderer=scene.renderer,gl=renderer.getContext();
        await new Promise(requestAnimationFrame);
        const ext=gl.getExtension('EXT_disjoint_timer_query_webgl2');
        if(!ext)throw Error('GPU-timer mangler');
        const source=scene.water.material;
        const active=SailingSettings.live(env,state);
        scene.cameraReady=false;
        scene.update(state,active,course,1/60,{quality:'high',cameraMode:stage.camera,windArrows:true});
        const materials={current:source,original:source.clone()};
        materials.original.uniforms=source.uniforms;
        for(let i=0;i<current.length;i++){
          if(!materials.original.fragmentShader.includes(current[i]))throw Error('Forkert fragmentshader');
          materials.original.fragmentShader=materials.original.fragmentShader.replace(current[i],original[i]);
        }
        // Everything except the two identified shader segments is shared.
        const same=source.vertexShader===materials.original.vertexShader;
        if(!same)throw Error('Forskellig geometri');
        const warm=async material=>{
          scene.water.material=material;
          await renderer.compileAsync(scene.scene,scene.camera);
          for(let i=0;i<18;i++){await new Promise(requestAnimationFrame);scene.render();}
        };
        let discarded=0;
        const run=async label=>{
          const values=[], inFlight=[];
          const flush=()=>{
            const bad=gl.getParameter(ext.GPU_DISJOINT_EXT);
            for(let i=inFlight.length-1;i>=0;i--){
              const query=inFlight[i];
              if(!bad&&!gl.getQueryParameter(query,gl.QUERY_RESULT_AVAILABLE))continue;
              if(bad)discarded++;else values.push(gl.getQueryParameter(query,gl.QUERY_RESULT)/1e6);
              gl.deleteQuery(query);inFlight.splice(i,1);
            }
          };
          await warm(materials[label]);
          for(let i=0;i<80;i++){
            await new Promise(requestAnimationFrame);
            flush();
            const query=gl.createQuery();
            gl.beginQuery(ext.TIME_ELAPSED_EXT,query);
            scene.render();
            gl.endQuery(ext.TIME_ELAPSED_EXT);
            inFlight.push(query);
          }
          for(let i=0;inFlight.length&&i<30;i++){await new Promise(requestAnimationFrame);flush();}
          for(const query of inFlight)gl.deleteQuery(query);
          return {label,gpuMs:values,missing:80-values.length};
        };
        const runs=[];
        let frozen;
        try{
          for(const label of ['original','current','current','original','current','original','original','current'])
            runs.push(await run(label));
          frozen={boat:state.boatId,x:state.x,y:state.y,time:state.time,heading:state.theta,weather:active,
            cameraPosition:scene.camera.position.toArray(),cameraRotation:scene.camera.quaternion.toArray(),size:[scene.canvas.width,scene.canvas.height]};
        }finally{
          scene.water.material=source;
          materials.original.dispose();
          window.freezeWater=false;
        }
        return {frozen,runs,discarded};
      },{stage,original,current});
      all.push({stage,...results});
      console.log(stage.name,results.frozen.size,results.runs.map(x=>[x.label,x.gpuMs.length]));
      await page.close();
    }
    await fs.writeFile(output,JSON.stringify({build,url,all,errors},null,2));
    if(errors.length)throw Error(errors.join('\n'));
  } finally {await browser.close();}
}
main(...process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
