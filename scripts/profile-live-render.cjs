'use strict';

const fs = require('node:fs/promises');
const os = require('node:os');
const { chromium } = require('@playwright/test');

async function main(url, filename) {
  if (!url || !filename) throw Error('node scripts/profile-live-render.cjs URL JSON');
  const executablePath = process.env.CHROME_PATH ||
    (os.platform() === 'darwin' ? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' : undefined);
  const browser = await chromium.launch({ executablePath, args: ['--enable-unsafe-swiftshader'] });
  const errors = [];
  try {
    const clients = [];
    for (const name of ['Vært', 'Gæst']) {
      const context = await browser.newContext({ viewport: {width:1120,height:700}, deviceScaleFactor:1.5 });
      await context.addInitScript(() => localStorage.setItem('fri-vind.settings.v3',
        JSON.stringify({personal:{quality:'low',difficulty:'hard'}})));
      const page = await context.newPage(), packets = [];
      const workers = [];
      await page.route('**/live-worker.js*', async route => {
        const response = await route.fetch();
        const body = await response.text();
        const original = '      sim.step(players,now);';
        const debtLimit = '  debt = Math.min(debt+now-lastUpdate,200);';
        if (!body.includes(original) || !body.includes(debtLimit)) throw Error('Worker probe anchor missing');
        await route.fulfill({ response, body: body.replace(debtLimit, `
  const discarded=Math.max(0,debt+now-lastUpdate-200);
  if(discarded)(self.liveDiscarded ||= []).push({time:now,ms:discarded});
${debtLimit}`).replace(original, `
      const started=performance.now();
      sim.step(players,now);
      const probe=self.livePerf ||= [];
      probe.push({time:performance.now(), stepMs:performance.now()-started, debtMs:debt});
`) });
      });
      page.on('pageerror', error => errors.push(`${name}: ${error.message}`));
      page.on('worker', worker => workers.push(worker));
      page.on('websocket', socket => {
        for (const event of ['framesent', 'framereceived']) socket.on(event, ({payload}) => {
          if (typeof payload !== 'string') return;
          const msg = JSON.parse(payload);
          packets.push({ at: performance.now(), event, type:msg.type, bytes:Buffer.byteLength(payload) });
        });
      });
      const response = await page.goto(url);
      const build = await response.headerValue('x-fri-vind-revision');
      if (name === 'Gæst') {
        await page.locator('#introSetup summary').click();
        await page.selectOption('#introBoat','ac72');
      }
      await page.click('#introLobby');
      await page.fill('#lobbyName', name);
      if (clients.length) {
        await page.fill('#lobbyCodeInput', await clients[0].page.locator('#lobbyCode').innerText());
        await page.click('#lobbyJoin');
      } else await page.click('#lobbyCreate');
      await page.locator('#lobbyRoom').waitFor();
      clients.push({ page, packets, workers, name, build });
    }
    await clients[0].page.click('#lobbySail');
    for (const {page} of clients) await page.waitForFunction(() => FriVindLobby.fleet.synced && FriVindLobby.fleet.boats.size === 1);
    const first = performance.now();
    await Promise.all(clients.map(({page}) => page.evaluate(() => {
      const game = SAILING_GAME, fleet = FriVindLobby.fleet, scene = game.scene;
      const values = { start:performance.now(), time:game.state.time, debt:game.simulationDebt,
        draws:0, queue:[], corrections:[], intervals:[] };
      const bridge = fleet.bridge, correct = bridge.correct, draw = scene.render;
      bridge.correct = function (state, ...args) {
        values.corrections.push({ at:performance.now()-values.start, published:state.time,
          delta:game.state.time-state.time, queued:fleet.pending.length });
        return correct.call(this,state,...args);
      };
      let last = values.start;
      scene.render = function (...args) {
        const now = performance.now();
        values.intervals.push(now-last);
        values.draws++;
        values.queue.push(fleet.pending.length);
        last=now;
        return draw.apply(this,args);
      };
      window.finishLiveProfile = () => {
        scene.render=draw;
        bridge.correct=correct;
        return {...values, elapsed:performance.now()-values.start,
          simulated:game.state.time-values.time, debtEnd:game.simulationDebt, boat:game.state.boatId,
          size:[scene.canvas.width,scene.canvas.height], remote:[...fleet.boats.values()].map(boat=>boat.boatId)};
      };
    })));
    await new Promise(resolve => setTimeout(resolve,3000));
    for (const {page} of clients) {
      await page.keyboard.down('ArrowRight');
      await page.waitForTimeout(220);
      await page.keyboard.up('ArrowRight');
      await page.keyboard.down('ArrowDown');
      await page.waitForTimeout(220);
      await page.keyboard.up('ArrowDown');
    }
    await new Promise(resolve => setTimeout(resolve,6000));
    const end = performance.now(), results = [];
    for (const {page, packets, workers, name, build} of clients) {
      const data = await page.evaluate(() => window.finishLiveProfile());
      const worker = workers.find(actor => actor.url().includes('/live-worker.js'));
      const workerSteps = worker ? await worker.evaluate(duration =>
        (self.livePerf || []).filter(sample => sample.time > performance.now()-duration), data.elapsed) : [];
      const workerDiscardedMs = worker ? await worker.evaluate(duration =>
        (self.liveDiscarded || []).filter(sample => sample.time > performance.now()-duration)
          .reduce((sum, sample) => sum + sample.ms, 0), data.elapsed) : null;
      const p95 = numbers => [...numbers].sort((a,b)=>a-b)[Math.max(0,Math.ceil(numbers.length*.95)-1)];
      results.push({ name, build, workers:workers.length,
        fps:data.draws*1000/data.elapsed, intervalP95:p95(data.intervals),
        pendingP95:p95(data.queue), simulationLagSecondsP95:p95(data.corrections.map(x=>x.delta)),
        workerStepP95:p95(workerSteps.map(x=>x.stepMs)), workerSteps, workerDiscardedMs,
        ...data, packets:packets.filter(packet=>packet.at>=first&&packet.at<=end) });
    }
    await fs.writeFile(filename, JSON.stringify({ url, errors, results },null,2)+'\n');
    console.log(results.map(x => [x.name,x.boat,x.remote,x.workers,x.fps,x.simulated,x.elapsed,x.pendingP95]));
    if (errors.length) throw Error(errors.join('\n'));
  } finally { await browser.close(); }
}

main(...process.argv.slice(2)).catch(error => { console.error(error); process.exitCode=1; });
