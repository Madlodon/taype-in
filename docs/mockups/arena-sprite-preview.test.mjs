// node --test docs/mockups/arena-sprite-preview.test.mjs
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, extname } from "node:path";
import { chromium } from "@playwright/test";
import { buildPreview } from "./build-arena-preview.mjs";

let browser, server, url;
before(async () => {
  const directory = await buildPreview();
  server = createServer(async (request, response) => {
    try {
      const path = new URL(request.url, 'http://localhost').pathname;
      const bytes = await readFile(join(directory, path));
      response.setHeader('Content-Type', ({ '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.webp': 'image/webp' })[extname(path)] ?? 'application/octet-stream');
      response.end(bytes);
    } catch {
      response.writeHead(404).end();
    }
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  url = `http://127.0.0.1:${server.address().port}/7-arena-sprite-preview.html`;
  browser = await chromium.launch();
});
after(async () => { await browser?.close(); await new Promise(resolve => server?.close(resolve)); });

async function openPreview(t) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 1000 } });
  t.after(() => page.close());
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  t.after(() => assert.deepEqual(errors, []));
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(url);
  await page.locator('[data-sprite-car]').first().waitFor();
  return page;
}

const player = '[data-car-id="preview"]';

test('uses the current diorama and preserves car and ball positions when switching styles', async t => {
  const page = await openPreview(t);
  assert.equal(await page.locator('.arena').getAttribute('data-stadium'), 'diorama');
  const sources = await page.locator('.arena image').evaluateAll(nodes => [...new Set(nodes.map(node => node.getAttribute('href')))]);
  assert.ok(sources.includes('/stadiums/diorama.webp'));
  assert.ok(sources.includes('assets/arena-preview/field-blue.png'));
  assert.ok(sources.includes('assets/arena-preview/field-orange.png'));
  assert.ok(sources.includes('assets/arena-preview/field-ball-none.png'));
  assert.equal(await page.locator('.arena [data-sprite-ball]').count(), 4);
  await page.evaluate(async sources => {
    for (const src of sources) { const image = new Image(); image.src = src; await image.decode(); }
  }, sources);
  const pose = await page.locator(`${player} > g > g`).first().getAttribute('transform');
  const ball = await page.locator(`${player} [data-field-ball]`).getAttribute('transform');
  const spin = await page.locator(`${player} [data-field-ball] > g`).getAttribute('transform');
  await page.getByRole('button', { name: 'Actuelles', exact: true }).click();
  assert.equal(await page.locator('[data-sprite-car]').count(), 0);
  assert.equal(await page.locator('.arena [data-sprite-ball]').count(), 0);
  assert.equal(await page.locator('.arena [data-ball]').count(), 4);
  assert.equal(await page.locator('[data-field-body]').count(), 4);
  await page.getByRole('button', { name: 'Blender', exact: true }).click();
  assert.equal(await page.locator(`${player} > g > g`).first().getAttribute('transform'), pose);
  assert.equal(await page.locator(`${player} [data-field-ball]`).getAttribute('transform'), ball);
  assert.equal(await page.locator(`${player} [data-field-ball] > g`).getAttribute('transform'), spin);
  assert.equal(await page.locator('.arena [data-sprite-ball]').count(), 4);
  const size = await page.locator('.arena [data-sprite-ball] image').first().getAttribute('width');
  assert.ok(Math.abs(Number(size) * 1.8 / 2.4 - 32) < .001);
});

test('keeps free driving, ball contact, boost, shots and the finish celebration', async t => {
  const page = await openPreview(t);
  const ball = page.locator(`${player} [data-field-ball]`);
  const start = await ball.getAttribute('transform');
  const initialSpin = await ball.locator(':scope > g').getAttribute('transform');
  await page.clock.runFor(2000);
  assert.notEqual(await ball.getAttribute('transform'), start);
  assert.notEqual(await ball.locator(':scope > g').getAttribute('transform'), initialSpin);
  // Observe the real contact effect while the existing simulation runs.
  await page.evaluate(() => {
    window.contactCount = 0;
    new MutationObserver(records => {
      for (const record of records) for (const node of record.addedNodes) {
        if (node instanceof Element && (node.matches('[data-ball-impact]') || node.querySelector('[data-ball-impact]'))) window.contactCount++;
      }
    }).observe(document.querySelector('.arena'), { childList: true, subtree: true });
  });
  await page.getByRole('button', { name: 'Boost', exact: true }).click();
  await page.clock.runFor(32);
  assert.equal(await page.locator(`${player} [data-field-body]`).getAttribute('data-boosting'), 'true');
  await page.clock.runFor(7000);
  assert.ok(await page.evaluate(() => window.contactCount > 0));
  await page.getByRole('button', { name: 'Tirer au but', exact: true }).click();
  await page.clock.runFor(600);
  const shot = await ball.getAttribute('transform');
  await page.clock.runFor(600);
  assert.notEqual(await ball.getAttribute('transform'), shot);
  await page.clock.runFor(3000);
  await page.getByRole('button', { name: 'Tir manqué', exact: true }).click();
  await page.clock.runFor(600);
  assert.notEqual(await ball.getAttribute('transform'), shot);
  await page.clock.runFor(3000);
  const prompt = await page.locator('.prompt').getAttribute('aria-label');
  await page.locator('textarea').fill(prompt);
  await page.clock.runFor(1500);
  assert.equal(await page.locator(`${player} [data-finish-goal]`).count(), 1);
  assert.equal(await page.locator('textarea').getAttribute('readonly'), '');
  await page.getByRole('button', { name: 'Recommencer', exact: true }).click();
  assert.equal(await page.locator('textarea').inputValue(), '');
  assert.equal(await page.locator('[data-finish-goal]').count(), 0);
});

test('keyboard toggle works and preview fits narrow screens', async t => {
  const page = await openPreview(t);
  await page.setViewportSize({ width: 360, height: 780 });
  const current = page.getByRole('button', { name: 'Actuelles', exact: true });
  await current.focus();
  await page.keyboard.press('Space');
  assert.equal(await current.getAttribute('aria-pressed'), 'true');
  const blender = page.getByRole('button', { name: 'Blender', exact: true });
  await blender.focus();
  await page.keyboard.press('Enter');
  assert.equal(await blender.getAttribute('aria-pressed'), 'true');
  await page.locator('textarea').fill('!');
  assert.equal(await page.locator('.wrong').count(), 1);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});


test('every garage ball keeps its selected look in both modes without resetting motion', async t => {
  const page = await openPreview(t);
  const ball = page.locator(`${player} [data-field-ball]`);
  await page.clock.runFor(1000);
  const position = await ball.getAttribute('transform');
  const choices = [['none', 'Standard'], ['beach', 'Plage'], ['emerald', 'Émeraude'], ['glacier', 'Glacier'], ['solar', 'Solaire'], ['gold', 'Doré']];
  const sources = [];
  for (const [finish, label] of choices) {
    await page.getByRole('group', { name: 'Ballons du garage' }).getByRole('button', { name: label, exact: true }).click();
    assert.equal(await ball.getAttribute('data-field-ball'), finish);
    assert.equal(await ball.getAttribute('transform'), position);
    const image = ball.locator('[data-sprite-ball] image');
    const source = await image.getAttribute('href');
    assert.equal(source, `assets/arena-preview/field-ball-${finish}.png`);
    sources.push(source);
    await page.getByRole('button', { name: 'Actuelles', exact: true }).click();
    assert.equal(await ball.locator('[data-ball]').getAttribute('data-ball'), finish);
    assert.equal(await ball.getAttribute('transform'), position);
    await page.getByRole('button', { name: 'Blender', exact: true }).click();
    assert.equal(await ball.locator('[data-sprite-ball]').getAttribute('data-sprite-ball'), finish);
  }
  const decoded = await page.evaluate(async sources => Promise.all(sources.map(async src => {
    const image = new Image(); image.src = src; await image.decode();
    const response = await fetch(src);
    return { width: image.naturalWidth, bytes: Array.from(new Uint8Array(await response.arrayBuffer())).join(',') };
  })), sources);
  assert.ok(decoded.every(image => image.width === 256));
  assert.equal(new Set(decoded.map(image => image.bytes)).size, 6);
});
