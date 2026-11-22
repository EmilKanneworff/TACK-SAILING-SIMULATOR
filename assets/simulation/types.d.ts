export type BoatId = 'laser' | 'dinghy' | 'yacht' | 'ac75' | 'ac72';
export type Difficulty = 'easy' | 'hard';
export type CrewPose = 1 | 2 | 3;

export interface ControlInput {
  steer?: number;
  steerDigital?: boolean;
  trim?: number;
  trimFast?: boolean;
  crewPose?: CrewPose;
  /** On Hard, signed values request a side within the wind limits. Zero holds the current side. */
  crew?: number;
  foreAft?: number;
  difficulty?: Difficulty;
  spinnaker?: boolean;
  downwindType?: 'spinnaker' | 'gennaker' | 'code0';
  rig?: { reef?: number; headsail?: number; jibSheet?: number; extraSheet?: number };
}

export interface FieldInputs {
  /** Reference wind in m/s and bearing FROM in degrees. */
  speed: number;
  direction: number;
  gusts: number;
  windSeed?: number;
  /** Target wave height in metres and independent chop on [0, 1]. */
  waveHeight?: number;
  chop?: number;
  waves?: number;
  shelter?: boolean;
  difficulty?: Difficulty;
  forceDiagnostics?: boolean;
  boatId?: BoatId;
  crewPose?: CrewPose;
  autoBalance?: boolean;
  autoRecovery?: boolean;
}

export interface WaterSample {
  height: number;
  dx: number;
  dy: number;
  velocity: number;
  waterVx: number;
  waterVy: number;
  waterVz: number;
  waterAx: number;
  waterAy: number;
  curvature: number;
}

export interface FieldSamplers {
  water?(east: number, north: number, time: number, field: FieldInputs, depth?: number): WaterSample;
  wind?(east: number, north: number, time: number, field: FieldInputs, height?: number): {
    vx: number; vy: number; speed: number; gust?: number; exposure?: number; meanSpeed?: number;
  };
}

export interface BoatPose {
  x: number;
  y: number;
  heave: number;
  theta: number;
  heel: number;
  pitch: number;
  vx: number;
  vy: number;
  heaveVelocity: number;
  omega: number;
  heelRate: number;
  pitchRate: number;
  /** Elapsed physical time in seconds. */
  time: number;
}

export interface BoatState extends BoatPose {
  boatId: BoatId;
  rudder: number;
  sheet: number;
  /** Ordered stance and side, then the smooth physical actuator positions. */
  crewPose: CrewPose;
  crewSide: number;
  crewPoseBlend: number;
  crewSideBlend: number;
  /** The last established windward side outside the head-to-wind sector. */
  crewTackFrom: number;
  windClimate?: Pick<FieldInputs, 'speed' | 'direction' | 'gusts'>;
  waveProfile?: object;
  atmosphere?: object;
  seaState: number;
  recovering: boolean;
  capsized: boolean;
  forces: Diagnostics;
}

export type StartState = Partial<BoatPose & Pick<BoatState,
  'crewPose' | 'crewPoseBlend' | 'crewSide' | 'crewSideBlend' | 'sheet' | 'rudder'>>;

export interface Diagnostics {
  yaw?: number;
  yawSail?: number;
  yawBoard?: number;
  yawRudder?: number;
  yawDamping?: number;
  yawHull?: number;
  weight?: number;
  buoyancy?: number;
  rudder?: { wet?: number; axialFlow?: number };
  ledger?: Record<string, {
    force: { x: number; y: number; z: number };
    moment: { roll: number; pitch: number; yaw: number };
  }>;
}
export interface StepOptions {
  diagnostics?: boolean;
  /** Preserve an already prepared direction until a new coastal grid is ready. */
  waitForWind?: boolean;
}
export interface RuntimeComponents {
  SailPhysics: {
    CONFIG: { fixedDt: number };
    createState(initial: StartState & { boatId: BoatId }, field: FieldInputs): BoatState;
    step(state: BoatState, control: ControlInput, field: FieldInputs, dt: number): BoatState;
    windwardCrewSide(wind?: { tws: number; twa: number | null }): number;
    tackCrewSide(state: BoatState, steer: number): number;
  };
  SailingSettings: {
    advanceWind(state: BoatState, field: FieldInputs, dt: number): FieldInputs;
  };
  SailingWeather: {
    initialize(state: BoatState, field: FieldInputs): object;
    step(state: BoatState, field: FieldInputs, dt: number): object;
  };
  SailingWind: { prepare(direction: number): boolean };
  SailingRecovery: {
    update(state: BoatState, field: FieldInputs, nowMs: number): object;
    safeLocation(state: BoatState, profile: object, heading: number): { x: number; y: number };
  };
  SailingBoats: { get(id: BoatId): object };
  FriVindCollisions: {
    resolve(entries: { id: string; state: BoatState }[], boats: RuntimeComponents['SailingBoats']): {
      pairs: object[];
      touched: Set<string>;
    };
  };
}
