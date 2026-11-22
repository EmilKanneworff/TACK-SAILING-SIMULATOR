'use strict';

const { createSimulation } = require('../assets/simulation/node');

module.exports = require('../assets/simulation/live-room')(
  createSimulation(),require('../assets/settings'),require('../assets/course-editor-model')
);
