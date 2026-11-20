'use strict';

async function introOption(page, selector) {
  const closedSetup = page.locator('#introSetup:not([open]) > summary');
  if (await closedSetup.count()) await closedSetup.click();
  return page.locator(selector);
}

module.exports = { introOption };
