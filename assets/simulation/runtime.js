/* Typed simulation entry point. Browser scripts and offline consumers use the
 * same model installers. All inputs are SI except met bearings in degrees. */
(function () {
  'use strict';

  /** @typedef {import('./types').RuntimeComponents} RuntimeComponents */
  /** @typedef {import('./types').FieldInputs} FieldInputs */
  /** @typedef {import('./types').BoatState} BoatState */
  /** @typedef {import('./types').ControlInput} ControlInput */
  /** @typedef {import('./types').BoatId} BoatId */
  /** @typedef {import('./types').StartState} StartState */
  /** @typedef {import('./types').StepOptions} StepOptions */

  /** @param {RuntimeComponents} components */
  function createRuntime(components) {
    const { SailPhysics, SailingBoats, SailingSettings, SailingWind, SailingWeather,
      SailingRecovery, FriVindCollisions } = components;

    /**
     * @param {BoatId} profile
     * @param {StartState} initial
     * @param {FieldInputs} field
     * @returns {BoatState}
     */
    function createBoat(profile, initial, field) {
      const state = SailPhysics.createState({ ...initial, boatId: profile }, { ...field, boatId: profile });
      SailingWeather.initialize(state, field);
      return state;
    }

    /**
     * @param {BoatState} state
     * @param {ControlInput} control
     * @param {FieldInputs} field
     * @param {number} dt
     */
    function stepPrepared(state, control, field, dt) {
      SailPhysics.step(state, control, field, dt);
      SailingWeather.step(state, field, dt);
      return state.forces;
    }

    /**
     * @param {BoatState} state
     * @param {ControlInput} control
     * @param {FieldInputs} field
     * @param {number} dt
     * @param {StepOptions} [options]
     */
    function stepBoat(state, control, field, dt, options = {}) {
      const bearing = state.windClimate?.direction ?? field.direction;
      const actual = SailingSettings.advanceWind(state,
        field.boatId === state.boatId ? field : { ...field, boatId: state.boatId }, dt);
      if (options.waitForWind !== false && actual.direction !== bearing &&
          actual.shelter !== false && !SailingWind.prepare(actual.direction)) {
        if (state.windClimate) state.windClimate.direction = bearing;
        actual.direction = bearing;
      }
      if (options.diagnostics) actual.forceDiagnostics = true;
      return stepPrepared(state, control, actual, dt);
    }

    /**
     * Advance an authoritative guest on the host's prepared sea and clock.
     * @param {BoatState} state
     * @param {ControlInput} control
     * @param {FieldInputs} field
     * @param {number} dt
     * @param {BoatState} host
     * @param {number} nowMs
     */
    function stepFleetBoat(state, control, field, dt, host, nowMs) {
      const localField = { ...field, boatId: state.boatId, crewPose: control.crewPose, sharedSea: host };
      state.time = host.time - dt;
      SailingRecovery.update(state, localField, nowMs);
      stepPrepared(state, control, localField, dt);
      SailingRecovery.update(state, localField, nowMs);
      state.windClimate = host.windClimate;
    }

    /** @param {BoatState} state */
    function placeAtSafeSpawn(state) {
      const place = SailingRecovery.safeLocation(state, SailingBoats.get(state.boatId), state.theta);
      state.x = place.x;
      state.y = place.y;
      return place;
    }

    /**
     * Apply a shared clock and sea to a newly constructed hull.
     * @param {BoatState} state
     * @param {BoatState} host
     * @param {boolean} [retainClimate]
     */
    function alignSpawn(state, host, retainClimate = false) {
      state.time = host.time;
      state.seaState = host.seaState;
      state.seaStateRate = host.seaStateRate;
      state.waveProfile = host.waveProfile;
      if (retainClimate) {
        state.windClimate = host.windClimate;
        if (host.atmosphere) state.atmosphere = host.atmosphere;
      }
    }

    /** @param {{id: string, state: BoatState}[]} entries */
    function resolveContacts(entries) {
      return FriVindCollisions.resolve(entries, SailingBoats);
    }

    return { createBoat, stepBoat, stepFleetBoat, placeAtSafeSpawn, alignSpawn, resolveContacts,
      fixedDt: SailPhysics.CONFIG.fixedDt, profiles: SailingBoats, physics: SailPhysics,
      recovery: SailingRecovery, wind: SailingWind };
  }

  if (typeof module !== 'undefined' && module.exports) module.exports = createRuntime;
  else {
    const root = /** @type {typeof globalThis & RuntimeComponents & {TackSimulation: ReturnType<typeof createRuntime>}} */ (/** @type {unknown} */ (globalThis));
    root.TackSimulation = createRuntime(root);
  }
})();
