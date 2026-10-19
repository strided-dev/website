import { test, expect } from '@playwright/test';

test('departing cubes fade before removal and return fully opaque', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#memory');
  await page.evaluate(() => document.fonts.ready);
  const diagram = page.locator('[data-model-explorer]');
  const graphic = diagram.getByRole('img', { name: 'GPU memory on one vivace host' });
  await diagram.evaluate(root => root.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await diagram.getByRole('button', { name: 'Batch', exact: true }).click();
  await expect(diagram.locator('[data-metric="memory"]')).toHaveText('20.5');
  const outlines = await diagram.locator('[data-face="wire"]').evaluateAll(paths => paths.map(path => path.getAttribute('d')));

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-09-06T01:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-06T01:00:01Z'));
  await diagram.getByRole('button', { name: 'Loaded', exact: true }).click();
  await page.clock.runFor(1200);
  await expect(graphic).toHaveAttribute('aria-busy', 'true');
  const departing = await diagram.locator('[data-solid]').evaluateAll(groups => groups.slice(19, 41).map(group => ({
    opacity: Number(getComputedStyle(group).opacity),
    hasGeometry: Boolean(group.querySelector('[data-face="top"]')!.getAttribute('d')),
  })));
  expect(departing.every(cube => cube.hasGeometry && cube.opacity < 0.01)).toBe(true);

  await page.clock.runFor(250);
  await expect(graphic).toHaveAttribute('aria-busy', 'false');
  expect(await diagram.locator('[data-face="top"]').evaluateAll(paths => paths.slice(19).every(path => !path.getAttribute('d')))).toBe(true);
  await diagram.getByRole('button', { name: 'Batch', exact: true }).click();
  await page.clock.runFor(1450);
  await expect(graphic).toHaveAttribute('aria-busy', 'false');
  expect(await diagram.locator('[data-solid]').evaluateAll(groups => groups.slice(0, 41).every(group => getComputedStyle(group).opacity === '1'))).toBe(true);
  expect(await diagram.locator('[data-face="wire"]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(outlines);
});

test('memory blocks animate, accept a new selection mid-transition, and settle', async ({ page }) => {
  await page.goto('/#memory');
  await page.evaluate(() => document.fonts.ready);
  const diagram = page.locator('[data-model-explorer]');
  const graphic = diagram.getByRole('img', { name: 'GPU memory on one vivace host' });
  await diagram.evaluate(root => root.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await expect(graphic).toBeInViewport();
  const memory = diagram.locator('[data-metric="memory"]');
  const paths = diagram.locator('[data-face="top"]');
  const baselinePaths = await paths.evaluateAll(items => items.map(item => item.getAttribute('d')));
  await expect(diagram.getByRole('button', { name: 'Batch', exact: true })).toBeEnabled();
  await diagram.getByRole('button', { name: 'Batch', exact: true }).click();
  await expect(graphic).toHaveAttribute('aria-busy', 'true');
  await expect.poll(async () => Number(await memory.textContent())).toBeGreaterThan(9.5);
  expect(Number(await memory.textContent())).toBeLessThan(20.5);
  expect(await paths.evaluateAll(items => items.map(item => item.getAttribute('d')))).not.toEqual(baselinePaths);

  await diagram.getByRole('button', { name: 'Loaded', exact: true }).click();
  await expect(diagram.getByRole('button', { name: 'Loaded', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(graphic).toHaveAttribute('aria-busy', 'false');
  await expect(memory).toHaveText('9.5');
  await expect(diagram.locator('[data-metric="headroom"]')).toHaveText('14.5');
  await expect(diagram.getByRole('status')).toContainText('Loaded. GPU memory in use 9.5 GiB, 0 sequences running');
  expect(await paths.evaluateAll(items => items.filter(item => item.getAttribute('d')).length)).toBe(19);

  // Once settled, no geometry or readout updates should keep running.
  const mutations = await diagram.evaluate(root => new Promise<number>(resolve => {
    let count = 0;
    const observer = new MutationObserver(records => { count += records.length; });
    observer.observe(root, { subtree: true, childList: true, attributes: true, characterData: true });
    setTimeout(() => { observer.disconnect(); resolve(count); }, 250);
  }));
  expect(mutations).toBe(0);
});

test('motion settles immediately when reduced motion is enabled or the graphic leaves view', async ({ page }) => {
  await page.goto('/#memory');
  await page.evaluate(() => document.fonts.ready);
  const diagram = page.locator('[data-model-explorer]');
  const graphic = diagram.getByRole('img', { name: 'GPU memory on one vivace host' });
  await diagram.evaluate(root => root.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await expect(graphic).toBeInViewport();
  await diagram.getByRole('button', { name: 'Batch', exact: true }).click();
  await expect(graphic).toHaveAttribute('aria-busy', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(graphic).toHaveAttribute('aria-busy', 'false');
  await expect(diagram.locator('[data-metric="memory"]')).toHaveText('20.5');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await diagram.getByRole('button', { name: 'Loaded', exact: true }).click();
  await expect(graphic).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(graphic).not.toBeInViewport();
  await expect(graphic).toHaveAttribute('aria-busy', 'false');
  await expect(diagram.locator('[data-metric="memory"]')).toHaveText('9.5');
});

test('previously shared Vision URLs lead to the homepage section', async ({ page }) => {
  await page.goto('/vision');
  await expect(page).toHaveURL(/\/#vision$/);
  await expect(page.locator('#vision-title')).toBeInViewport();
  await expect(page.locator('#vision-title')).toContainText('From one GPU');
});

test('workloads change memory and sequence settings and restore the loaded state', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#memory');
  const diagram = page.locator('[data-model-explorer]');
  const memory = diagram.locator('[data-metric="memory"]');
  const requests = diagram.locator('[data-metric="requests"]');
  const context = diagram.locator('[data-metric="context"]');
  const headroom = diagram.locator('[data-metric="headroom"]');
  const loadedPaths = await diagram.locator('[data-face]').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  await expect(memory).toHaveText('9.5');
  await expect(requests).toHaveText('0');
  const agent = diagram.getByRole('button', { name: 'Agent loop', exact: true });
  await expect(agent).toBeEnabled();
  await agent.focus();
  await agent.press('Enter');
  await expect(agent).toHaveAttribute('aria-pressed', 'true');
  await expect(diagram.getByRole('status')).toContainText('Agent loop. GPU memory in use 14.5 GiB, 1 sequence running');
  await expect(context).toHaveText('16,384');
  await expect(requests).toHaveText('1');
  expect(Number(await memory.textContent())).toBeGreaterThan(9.5);
  expect(await diagram.locator('[data-face]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).not.toEqual(loadedPaths);

  for (const workload of [
    { label: 'One chat', memory: '11.5', requests: '1' },
    { label: 'Eight chats', memory: '18.5', requests: '8' },
    { label: 'Batch', memory: '20.5', requests: '16' },
  ]) {
    await diagram.getByRole('button', { name: workload.label, exact: true }).click();
    await expect(diagram.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(diagram.getByRole('status')).toContainText(workload.label);
    await expect(memory).toHaveText(workload.memory);
    await expect(requests).toHaveText(workload.requests);
    await expect(context).toHaveText('8,192');
    const used = Number(await memory.textContent());
    expect(used + Number(await headroom.textContent())).toBe(24);
    const filledBlocks = await diagram.locator('[data-face="top"]').evaluateAll(paths => paths.filter(path => path.getAttribute('d')).length);
    expect(filledBlocks * 0.5).toBe(used);
  }

  await diagram.getByRole('button', { name: 'Loaded', exact: true }).click();
  await expect(memory).toHaveText('9.5');
  await expect(requests).toHaveText('0');
  await expect(context).toHaveText('8,192');
  expect(await diagram.locator('[data-face]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(loadedPaths);
  await page.getByText('About this example', { exact: true }).click();
  await expect(page.locator('.model-assumptions')).toContainText('No speed or latency improvement is predicted.');
  expect(errors).toEqual([]);
});

test.describe('static memory example', () => {
  test.use({ javaScriptEnabled: false });
  test('the memory example remains useful without JavaScript', async ({ page }) => {
    await page.goto('/#memory');
    await page.evaluate(() => document.fonts.ready);
    // Font loading can shift the anchor's final position. Wait for scrolling
    // to settle before testing another interaction, then check the heading.
    let previousScrollY = -1;
    let settledSamples = 0;
    await expect.poll(async () => {
      const scrollY = await page.evaluate(() => window.scrollY);
      settledSamples = scrollY === previousScrollY ? settledSamples + 1 : 0;
      previousScrollY = scrollY;
      return settledSamples;
    }, { intervals: [100] }).toBeGreaterThanOrEqual(3);
    await expect(page.locator('#memory-title')).toBeInViewport();
    const position = await page.evaluate(() => ({
      heading: document.getElementById('memory-title')!.getBoundingClientRect().top,
      header: document.querySelector('header')!.getBoundingClientRect().bottom,
    }));
    expect(position.heading).toBeGreaterThanOrEqual(position.header);
    await expect(page.locator('#memory-title')).toContainText('Memory follows');
    await expect(page.getByRole('img', { name: 'GPU memory on one vivace host' })).toBeVisible();
    await expect(page.locator('[data-metric="memory"]')).toHaveText('9.5');
    await expect(page.locator('[data-metric="requests"]')).toHaveText('0');
    await expect(page.getByRole('button', { name: 'One chat', exact: true })).toBeDisabled();
    const fallback = page.locator('[data-model-explorer] noscript p');
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText('The loaded model is shown above.');
    await page.getByText('About this example', { exact: true }).click();
    await expect(page.locator('.model-assumptions p')).toBeVisible();
  });
});
