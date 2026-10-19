// Run independently of the application/database: node --test docs/mockups/arena-sprite-preview.test.mjs
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { chromium } from '@playwright/test';

let browser;
before(async () => { browser = await chromium.launch(); });
after(async () => { await browser?.close(); });

async function openPreview(t) {
  const page = await browser.newPage({ viewport: { width: 1200, height: 850 } });
  t.after(() => page.close());
  await page.route('https://**', (route) => route.abort());
  await page.clock.install();
  await page.clock.pauseAt(new Date());
  await page.goto(new URL('./7-arena-sprite-preview.html', import.meta.url).href);
  return page;
}

async function typeText(page, text) {
  // keyboard.type inserts accented characters without keydown; the mockup listens to keydown.
  for (const char of text) {
    if (char.charCodeAt(0) > 127) {
      await page.locator('body').dispatchEvent('keydown', { key: char, bubbles: true });
    } else {
      await page.keyboard.press(char === ' ' ? 'Space' : char);
    }
  }
}

test('switching styles preserves the race and loads every sprite', async (t) => {
  const page = await openPreview(t);
  const errors = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const images = await page.locator('image').evaluateAll(async (nodes) => Promise.all(nodes.map(async (node) => {
    const image = new Image();
    image.src = node.getAttribute('href');
    await image.decode();
    return image.naturalWidth;
  })));
  assert.equal(images.length, 8);
  assert.ok(images.every((width) => width === 512));
  await typeText(page, 'Le ballon');
  const beforeSwitch = await page.locator('#racers > g').first().getAttribute('transform');
  await page.getByRole('button', { name: '2D', exact: true }).click();
  assert.equal(await page.locator('#flat').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('#racers .sprite').first().isVisible(), false);
  assert.equal(await page.locator('#racers .flat').first().isVisible(), true);
  await page.getByRole('button', { name: 'Blender', exact: true }).click();
  assert.equal(await page.locator('#racers .sprite').first().isVisible(), true);
  assert.equal(await page.locator('#racers .flat').first().isVisible(), false);
  assert.equal(await page.locator('#racers > g').first().getAttribute('transform'), beforeSwitch);
  assert.equal(await page.locator('.done').count(), 9);
  assert.deepEqual(errors, []);
});

test('typing follows floor, wall, ceiling and shot, with boost, errors and goal', async (t) => {
  const page = await openPreview(t);
  const text = await page.locator('.demo-text').textContent();
  const car = page.locator('#racers > g').first();
  async function angle() {
    return Number((await car.getAttribute('transform')).match(/rotate\(([^)]+)\)/)[1]);
  }
  assert.equal(await angle(), 0);
  await typeText(page, '!');
  assert.equal(await page.locator('.current.wrong').count(), 1);
  assert.equal(await page.locator('.done').count(), 0);
  let typed = 0;
  for (const [progress, min, max] of [[0.3, -91, -89], [0.6, 179, 181], [0.9, 90, 179]]) {
    const count = Math.floor(text.length * progress);
    await typeText(page, text.slice(typed, count));
    typed = count;
    const rotation = await angle();
    assert.ok(rotation >= min && rotation <= max, `rotation ${rotation} at ${progress}`);
    assert.equal(await page.locator('.current.wrong').count(), 0);
  }
  assert.equal(await page.locator('#streak').textContent(), 'Supersonique !');
  await typeText(page, text.slice(typed));
  assert.equal(await page.locator('.done').count(), text.length);
  assert.equal(await page.locator('#flash').textContent(), 'BUT !');
  await typeText(page, 'extra');
  assert.equal(await page.locator('.done').count(), text.length);
});

test('style controls work with the keyboard and the preview fits a narrow screen', async (t) => {
  const page = await openPreview(t);
  await page.setViewportSize({ width: 360, height: 780 });
  await page.locator('#flat').focus();
  await page.keyboard.press('Space');
  assert.equal(await page.locator('#flat').getAttribute('aria-pressed'), 'true');
  assert.equal(await page.locator('.current.wrong').count(), 0);
  await page.locator('#blender').focus();
  await page.keyboard.press('Enter');
  assert.equal(await page.locator('#blender').getAttribute('aria-pressed'), 'true');
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
});
