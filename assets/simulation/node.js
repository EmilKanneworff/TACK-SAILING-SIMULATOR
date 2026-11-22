'use strict';

// Private dependency scope. The same installers run against the browser's
// compatibility namespace when loaded as classic scripts.
const createRuntime = require('./runtime');
function createSimulation(fieldSamplers = {}) {
  const scope = { performance, TackFieldSamplers: fieldSamplers,
    SailingSettings: require('../settings'), FriVindCollisions: require('../collisions') };
  for (const install of [
    require('./boats'), require('../archipelago'), require('../archipelago-relief'),
    require('./terrain'), require('../shelter'), require('../water-depth'), require('../wind-field'),
    require('./physics'), require('./foils'), require('./recovery'), require('./weather')
  ]) install(scope);
  return createRuntime(scope);
}

module.exports = { createSimulation };
