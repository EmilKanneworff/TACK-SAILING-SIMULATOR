'use strict';

async function introOption(page, selector) {
  const closedSetup = page.locator('#introSetup:not([open]) > summary');
  if (await closedSetup.count()) await closedSetup.click();
  return page.locator(selector);
}

async function dragMap(page, widthDelta, heightDelta) {
  await page.locator('#courseCard').hover();
  const handle = page.locator('#mapResize');
  await handle.waitFor({ state: 'visible' });
  const box = await handle.boundingBox();
  const x = box.x + box.width / 2;
  const y = box.y + box.height / 2;
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x - widthDelta, y + heightDelta, { steps: 6 });
  await page.mouse.up();
}

async function chooseSail(page, name) {
  const closed = page.locator('#sailPlan:not([open]) > summary');
  if (await closed.count()) await closed.click();
  await page.locator('[data-sail-choice="'+name+'"]').click();
}

async function operateExtraSail(page, selector) {
  const name = selector.replace(/^#/, '').replace(/Button$/, '');
  await chooseSail(page, name);
  await page.locator(selector).click();
}

module.exports = { introOption, dragMap, chooseSail, operateExtraSail };
