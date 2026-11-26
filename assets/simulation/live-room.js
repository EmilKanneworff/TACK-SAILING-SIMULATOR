/* The fixed-step room model runs unchanged in Node or the host's worker. */
(function (create) {
  if (typeof module !== 'undefined' && module.exports) module.exports = create;
  else globalThis.TackLiveRoom = create({
    ...globalThis.TackSimulation,
    Course: globalThis.SailingCourse,
    map: globalThis.ArchipelagoData,
    terrain: globalThis.SailingWorld
  },globalThis.SailingSettings,globalThis.FriVindCourseEditorModel);
})(function (Sim,Settings,CourseEditor) {
'use strict';

const { fixedDt, physics: P, profiles: Boats } = Sim;

// The room clock and sea continue even if the organiser disconnects.
function makeWorld(env) {
  const world = { time: 0, boatId: 'laser', seaState: P.seaTarget(env) };
  P.advanceWaveProfile(world, env);
  return world;
}

function neutral(control = {}) {
  return { ...control, steer: 0, trim: 0, sheetTarget: undefined, crew: 0, foreAft: control.foreAft ?? 0, crewPose: control.crewPose ?? 2 };
}

function roomWeather(patch, current = Settings.defaults) {
  const env = Settings.normalize(patch ?? {}, current);
  return { ...env, windSeed: current.windSeed };
}

class RoomSimulation {
  constructor(env) {
    this.env = env;
    this.world = makeWorld(env);
    this.boats = new Map();
    this.races = new Map();
    this.acks = {};
    this.finished = new Map();
    this.serial = 0;
    this.phase = 'lobby';
    this.settings = { mode: 'free', courseType: 'gates', courseVariant: 'short' };
    this.clockMs = 0;
  }

  largest(players) {
    return [...players.values()].map(p => Boats.get(p.boat)).reduce((a,b) => b.length > a.length ? b : a, Boats.get('laser'));
  }

  spawn(player, initial) {
    const previous = this.boats.get(player.id);
    const field = { ...this.env, boatId: player.boat, difficulty: player.control?.difficulty ?? 'hard' };
    const spawn = initial || previous || Sim.map.spawn;
    const initialState = {
      x: spawn.x, y: spawn.y, time: this.world.time, theta: spawn.theta ?? (90-this.env.direction-92)*P.DEG,
      vx: spawn.vx ?? 0, vy: spawn.vy ?? 0, crewPose: player.control?.crewPose ?? 2
    };
    initialState.crewSide=P.windwardCrewSide(P.windForState(initialState,field))||-1;
    const state = Sim.createBoat(player.boat, initialState, field);
    Sim.placeAtSafeSpawn(state);
    Sim.alignSpawn(state, this.world, true);
    P.refresh(state,field);
    this.boats.set(player.id,state);
  }

  freeSpawn(slot) {
    // A deep, shared launch area gives even the largest rigs room to separate.
    const theta = (90-this.env.direction-103)*P.DEG;
    const axis = P.axes(theta), spacing = 32, row = Math.floor(slot/3), across = (slot%3-1)*spacing;
    return { x: -1500+across*axis.rx-row*spacing*axis.fx, y: -1800+across*axis.ry-row*spacing*axis.fy,
      theta, vx: .8*axis.fx, vy: .8*axis.fy };
  }

  add(player) {
    if (this.phase === 'free') this.spawn(player,this.freeSpawn(player.slot));
  }

  remove(player) {
    this.boats.delete(player.id);
    this.races.delete(player.id);
    delete this.acks[player.id];
    this.updatePhase();
  }

  configure(settings) {
    const { mode, courseType, courseVariant } = settings;
    if (!['free','course'].includes(mode) || !['gates','triangle'].includes(courseType) ||
        !['short','long','custom'].includes(courseVariant)) return false;
    this.settings = { mode, courseType, courseVariant };
    return true;
  }

  changeWeather(patch) {
    const next=roomWeather(patch,this.env);
    if(Object.keys(next).every(key=>next[key]===this.env[key]))return;
    this.env=next;
    for (const race of this.races.values()) race.invalidate('Vejret er ændret');
  }

  start(players, draft) {
    const { courseType, courseVariant, mode } = this.settings;
    const largest = this.largest(players);
    const field = { ...this.env, courseType, courseVariant, boatId: largest.id };
    let model;
    if (mode === 'course') {
      if (courseVariant === 'custom') {
        const issues = CourseEditor.validate(draft,Sim.terrain.heightAt);
        if (issues.length) throw new Error(issues[0].message);
        model = CourseEditor.compile(draft,Sim.Course.geometry.rounding,largest);
      } else {
        model = Sim.Course.geometry.makeModel(field,largest,courseType);
      }
    }

    this.serial++;
    this.races.clear();
    this.boats.clear();
    this.finished.clear();
    this.phase = model ? 'countdown' : 'free';
    const grid = model ? this.startGrid(model,players,largest) : null;
    let slot = 0;
    for (const p of players.values()) {
      p.control = neutral({...p.control, foreAft: 0});
      this.spawn(p,grid?.get(p.id) ?? this.freeSpawn(p.slot ?? slot++));
      if (model) {
        const race = new Sim.Course({ ...field, boatId: p.boat, difficulty: p.control.difficulty },'course',courseType,model);
        race.storage = false;
        race.beginCountdown(this.clockMs,this.boats.get(p.id));
        this.races.set(p.id,race);
      }
    }
    this.model = model;
  }

  startGrid(model, players, largest) {
    const line = model.startLine;
    const width = Math.hypot(line.b.x-line.a.x,line.b.y-line.a.y);
    const tangent = { x:(line.b.x-line.a.x)/width, y:(line.b.y-line.a.y)/width };
    const spacing = Math.max(5,largest.beam*1.6,largest.length*.48);
    const columns = Math.max(1,Math.min(players.size,Math.floor(width*.88/spacing)));
    return new Map([...players.values()].map((player,i) => {
      const row=Math.floor(i/columns), rowLength=Math.min(columns,players.size-row*columns);
      const lateral=(i%columns-(rowLength-1)/2)*spacing;
      const setback=Math.max(24,largest.length*2.4)+row*Math.max(13,largest.length*1.6);
      return [player.id,{ x:line.centre.x+tangent.x*lateral-line.normal.x*setback,
        y:line.centre.y+tangent.y*lateral-line.normal.y*setback, theta:model.spawn.theta, vx:0,vy:0 }];
    }));
  }

  lobby() {
    this.phase = 'lobby';
    this.boats.clear();
    this.races.clear();
    this.finished.clear();
    this.model = null;
  }

  updatePhase() {
    if (this.phase === 'countdown' && [...this.races.values()].some(r=>r.phase!=='countdown')) this.phase = 'race';
    if (this.phase === 'race' && this.races.size && [...this.races.values()].every(r=>r.finished)) this.phase = 'results';
  }

  step(players, now) {
    if (!this.boats.size) return;
    const world = this.world;
    this.clockMs += fixedDt*1000;
    world.time += fixedDt;
    const active = Settings.advanceWind(world,this.env,fixedDt);
    P.advanceSea(world,active,fixedDt);
    const before = new Map();
    for (const [id,state] of this.boats) {
      const player = players.get(id);
      const control = player.ws && now-player.inputAt<700 ? player.control : neutral(player.control);
      before.set(id,{ x:state.x,y:state.y,theta:state.theta,heel:state.heel,pitch:state.pitch,capsized:state.capsized,recovering:state.recovering });
      Sim.stepFleetBoat(state,control,{...active,ironsHelp:control.ironsHelp,controlRate:control.controlRate,
        controlSensitivity:control.controlSensitivity,motionDamping:control.motionDamping},fixedDt,world,now);
      if (player.lastSeq>=0) this.acks[id] = player.lastSeq;
      const race = this.races.get(id);
      if (race && (state.ground?.contact || state.recovering || state.capsized)) race.invalidate('Kontakt med bunden eller automatisk opretning');
    }
    const contacts = Sim.resolveContacts([...this.boats].map(([id,state])=>({id,state})));
    for (const [id,race] of this.races) {
      const previous = before.get(id), state = this.boats.get(id);
      const events = race.update(previous,state,fixedDt,{ nowMs:this.clockMs, discontinuity:contacts.touched.has(id) });
      if (events.some(event=>event.type==='finish')) {
        const { name,boat } = players.get(id);
        this.finished.set(id,{ id,name,boat,time:race.time });
      }
    }
    this.updatePhase();
  }

  packet() {
    const races = Object.fromEntries([...this.races].map(([id,r])=>[id,{
      serial:this.serial,index:r.index,phase:r.phase,time:r.time,countdown:r.countdown,
      startAtHostMs:r.gunAtMs,ocs:r.ocs,started:r.started,finished:r.finished,valid:r.valid
    }]));
    return { env:this.env, time:this.world.time, mode:this.model?'course':'free', model:this.model, serial:this.serial,
      races, acks:this.acks, results:[...this.finished.values()].sort((a,b)=>a.time-b.time),
      boats:Object.fromEntries([...this.boats].map(([id,s])=>[id,packBoat(s)])) };
  }
}

// Transmit state used by rendering and local prediction. The server keeps the
// complete force ledgers and each integration step's list of pressure patches.
function packBoat(state) {
  const s = { ...state, crewJoints:undefined, hydro:{ ...state.hydro,items:undefined },
    sail:{ ...state.sail,accumulator:undefined }, forces:{ ...state.forces,ledger:undefined } };
  if (state.foils) s.foils = Object.fromEntries(Object.entries(state.foils).map(([key,foil])=>[key,{ ...foil,parts:undefined }]));
  return s;
}

return { RoomSimulation, Sim, neutral, roomWeather };
});
