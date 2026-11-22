'use strict';
(() => {
  const version = 2;
  if (typeof module !== 'undefined' && module.exports) module.exports = version;
  else globalThis.TackLiveProtocol = version;
})();
