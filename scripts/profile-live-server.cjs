'use strict';

const fs = require('node:fs');
const { RoomSimulation } = require('../server/room');
const { WebSocket } = require('ws');
const output = process.env.TACK_LIVE_SERVER_PROFILE;
if (!output) throw Error('Set TACK_LIVE_SERVER_PROFILE to an output path');

const rows = { parse: [], stringify: [], pack: [], step: [], send: [] };
const stringify = JSON.stringify, parse = JSON.parse;
JSON.parse = function (value, ...args) {
  const at = performance.now();
  const result = parse.call(this, value, ...args);
  if (result?.type === 'input' || result?.type === 'authority-frame')
    rows.parse.push({ at, ms: performance.now() - at, type: result.type, bytes: Buffer.byteLength(value) });
  return result;
};
JSON.stringify = function (value, ...args) {
  const at = performance.now();
  const result = stringify.call(this, value, ...args);
  if (value?.type === 'snapshot' || value?.type === 'authority')
    rows.stringify.push({ at, ms: performance.now() - at, type: value.type, bytes: Buffer.byteLength(result) });
  return result;
};
for (const [functionName, label] of [['packet', 'pack'], ['step', 'step']]) {
  const original = RoomSimulation.prototype[functionName];
  RoomSimulation.prototype[functionName] = function (...args) {
    if (this.boats.size === 0) return original.apply(this, args);
    const at = performance.now(), result = original.apply(this, args);
    rows[label].push({ at, ms: performance.now() - at, boats: this.boats.size, time: this.world.time });
    return result;
  };
}
const send = WebSocket.prototype.send;
WebSocket.prototype.send = function (...args) {
  const at = performance.now(), buffered = this.bufferedAmount;
  const result = send.apply(this, args);
  rows.send.push({ at, ms: performance.now() - at, buffered, after: this.bufferedAmount });
  return result;
};
setInterval(() => fs.writeFileSync(output, stringify(rows) + '\n'), 2000).unref();
