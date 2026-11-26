'use strict';

const fs = require('node:fs/promises');
const { chromium } = require('@playwright/test');
const { changeScene } = require('./render-performance.cjs');

async function main(url, output) {
  if (!url || !output) throw Error('node scripts/verify-auto-pressure.cjs URL JSON');
  const browser = await chromium.launch({ executablePath: process.env.CHROME_PATH ||
    (process.platform === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined),
  args: ['--enable-unsafe-swiftshader'] });
  try {
    const page = await browser.newPage({ viewport: { width: 1120, height: 700 }, deviceScaleFactor: 1.5 });
    const cdp = await page.context().newCDPSession(page);
    const errors = [];
    page.on('pageerror',error=>errors.push(error.message));
    page.on('console',entry=>{if(entry.type()==='error')errors.push(entry.text());});
    await page.addInitScript(() => localStorage.setItem('fri-vind.settings.v3', JSON.stringify({
      personal:{quality:'auto',difficulty:'easy',volume:0}
    })));
    const response = await page.goto(url);
    await page.click('#startButton');
    await page.waitForFunction(() => SAILING_GAME.state.time > .15);
    await page.evaluate(changeScene, { boat: 'laser', x: -1900, y: -2170, heading: -.45, speed: 4, camera: 0 });
    await page.evaluate(() => {
      const view = SAILING_GAME.scene, renderer = view.renderer;
      const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-1,1,1,-1,0,2);
      camera.position.z=1;
      const material = new THREE.ShaderMaterial({
        vertexShader:'void main(){gl_Position=vec4(position.xy,0.,1.);}',
        fragmentShader:`void main(){
          vec2 p=gl_FragCoord.xy*.005;float v=p.x;
          for(int i=0;i<105;i++){v=sin(v+p.y+float(i)*.088)+cos(v+p.x);}
          gl_FragColor=vec4(v*.25+.5, .3, .4, .002);
        }`, depthTest:false, depthWrite:false, transparent:true, blending:THREE.AdditiveBlending
      });
      const overlay=new THREE.Mesh(new THREE.PlaneGeometry(2,2),material);
      overlay.frustumCulled=false;
      scene.add(overlay);
      const timedDraw = view.timedDraw;
      window.auditGpuPasses = 0;
      view.timedDraw = function(draw, enabled) {
        return timedDraw.call(this, () => {
          draw();
          if(!window.auditGpuPasses)return;
          const autoClear=renderer.autoClear;
          renderer.autoClear=false;
          try{for(let i=0;i<window.auditGpuPasses;i++)renderer.render(scene,camera);}
          finally{renderer.autoClear=autoClear;}
        }, enabled);
      };
      window.autoPressure = () => {
        const game = SAILING_GAME;
        return { at:performance.now(), simulation:game.state.time, debt:game.simulationDebt,
          ...game.performanceBudget,size:[view.canvas.width,view.canvas.height],gpuPasses:window.auditGpuPasses };
      };
    });
    const rows = [], phases = [], started = performance.now();
    const collect = async (phase, seconds, cpu, passes) => {
      await cdp.send('Emulation.setCPUThrottlingRate',{rate:cpu});
      await page.evaluate(value=>window.auditGpuPasses=value,passes);
      const began = performance.now();
      phases.push({phase,seconds,cpu,passes,at:began-started});
      do {
        rows.push({elapsed:performance.now()-started,phase,...await page.evaluate(()=>autoPressure())});
        await page.waitForTimeout(250);
      } while(performance.now()-began<seconds*1000);
      console.log(phase,rows.at(-1));
    };
    await collect('reference',5,1,0);
    let passes=Number(process.env.TACK_GPU_PASSES || 8);
    if(!process.env.TACK_GPU_PASSES){
      for(;passes<32;passes*=2){
        await collect('GPU kalibrering '+passes,3,1,passes);
        const {gpuMs,fps}=rows.at(-1);
        if(gpuMs>=16&&fps<50)break;
      }
    }
    await collect('GPU',18,1,passes);
    await collect('efter GPU',33,1,0);
    if(process.env.TACK_GPU_ONLY!=='1'){
      await page.evaluate(changeScene, { boat: 'ac72', x: -1900, y: -2170, heading: -.45, speed: 10, camera: 0 });
      await collect('CPU og scene',14,4,0);
      await collect('efter CPU',33,1,0);
    }
    await fs.writeFile(output,JSON.stringify({url,build:await response.headerValue('x-fri-vind-revision'),rows,phases,errors},null,2)+'\n');
    if(errors.length)throw Error(errors.join('\n'));
  } finally {await browser.close();}
}
main(...process.argv.slice(2)).catch(error=>{console.error(error);process.exitCode=1;});
