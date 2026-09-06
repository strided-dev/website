import { test, expect } from '@playwright/test';

test('departing cubes fade before removal and return fully opaque', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#local-model');
  await page.evaluate(() => document.fonts.ready);
  const diagram = page.locator('[data-model-explorer]');
  const graphic = diagram.getByRole('img', { name: 'Local model memory allocation' });
  await diagram.evaluate(root => root.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await diagram.getByRole('button', { name: 'Long context', exact: true }).click();
  await expect(diagram.locator('[data-metric="memory"]')).toHaveText('20.0');
  const outlines = await diagram.locator('[data-face="wire"]').evaluateAll(paths => paths.map(path => path.getAttribute('d')));

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.clock.install({ time: new Date('2026-09-06T01:00:00Z') });
  await page.clock.pauseAt(new Date('2026-09-06T01:00:01Z'));
  await diagram.getByRole('button', { name: 'Idle', exact: true }).click();
  await page.clock.runFor(1200);
  await expect(graphic).toHaveAttribute('aria-busy', 'true');
  const departing = await diagram.locator('[data-solid]').evaluateAll(groups => groups.slice(17, 40).map(group => ({
    opacity: Number(getComputedStyle(group).opacity),
    hasGeometry: Boolean(group.querySelector('[data-face="top"]')!.getAttribute('d')),
  })));
  expect(departing.every(cube => cube.hasGeometry && cube.opacity < 0.01)).toBe(true);

  await page.clock.runFor(250);
  await expect(graphic).toHaveAttribute('aria-busy', 'false');
  expect(await diagram.locator('[data-face="top"]').evaluateAll(paths => paths.slice(17).every(path => !path.getAttribute('d')))).toBe(true);
  await diagram.getByRole('button', { name: 'Long context', exact: true }).click();
  await page.clock.runFor(1450);
  await expect(graphic).toHaveAttribute('aria-busy', 'false');
  expect(await diagram.locator('[data-solid]').evaluateAll(groups => groups.slice(0, 40).every(group => getComputedStyle(group).opacity === '1'))).toBe(true);
  expect(await diagram.locator('[data-face="wire"]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(outlines);
});

test('memory blocks animate, accept a new selection mid-transition, and settle', async ({ page }) => {
  await page.goto('/#vision');
  await page.evaluate(() => document.fonts.ready);
  const diagram = page.locator('[data-model-explorer]');
  const graphic = diagram.getByRole('img', { name: 'Local model memory allocation' });
  await diagram.evaluate(root => root.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await expect(graphic).toBeInViewport();
  const memory = diagram.locator('[data-metric="memory"]');
  const paths = diagram.locator('[data-face="top"]');
  const baselinePaths = await paths.evaluateAll(items => items.map(item => item.getAttribute('d')));
  await expect(diagram.getByRole('button', { name: 'Long context', exact: true })).toBeEnabled();
  await diagram.getByRole('button', { name: 'Long context', exact: true }).click();
  await expect(graphic).toHaveAttribute('aria-busy', 'true');
  await expect.poll(async () => Number(await memory.textContent())).toBeGreaterThan(16);
  expect(Number(await memory.textContent())).toBeLessThan(20);
  expect(await paths.evaluateAll(items => items.map(item => item.getAttribute('d')))).not.toEqual(baselinePaths);

  await diagram.getByRole('button', { name: 'Idle', exact: true }).click();
  await expect(diagram.getByRole('button', { name: 'Idle', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await expect(graphic).toHaveAttribute('aria-busy', 'false');
  await expect(memory).toHaveText('8.5');
  await expect(diagram.locator('[data-metric="headroom"]')).toHaveText('15.5');
  await expect(diagram.getByRole('status')).toContainText('Idle. Allocated GPU memory 8.5 GiB');
  expect(await paths.evaluateAll(items => items.filter(item => item.getAttribute('d')).length)).toBe(17);

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
  await page.goto('/#vision');
  await page.evaluate(() => document.fonts.ready);
  const diagram = page.locator('[data-model-explorer]');
  const graphic = diagram.getByRole('img', { name: 'Local model memory allocation' });
  await diagram.evaluate(root => root.scrollIntoView({ behavior: 'instant', block: 'start' }));
  await expect(graphic).toBeInViewport();
  await diagram.getByRole('button', { name: 'Long context', exact: true }).click();
  await expect(graphic).toHaveAttribute('aria-busy', 'true');
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect(graphic).toHaveAttribute('aria-busy', 'false');
  await expect(diagram.locator('[data-metric="memory"]')).toHaveText('20.0');

  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await diagram.getByRole('button', { name: 'Idle', exact: true }).click();
  await expect(graphic).toHaveAttribute('aria-busy', 'true');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(graphic).not.toBeInViewport();
  await expect(graphic).toHaveAttribute('aria-busy', 'false');
  await expect(diagram.locator('[data-metric="memory"]')).toHaveText('8.5');
});

test('previously shared Vision URLs lead to the homepage section', async ({ page }) => {
  await page.goto('/vision');
  await expect(page).toHaveURL(/\/#vision$/);
  await expect(page.locator('#vision-title')).toBeInViewport();
  await expect(page.locator('#vision-title')).toContainText('From local models');
});

test('local workloads change memory and request settings and restore the baseline', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#vision');
  const diagram = page.locator('[data-model-explorer]');
  const memory = diagram.locator('[data-metric="memory"]');
  const requests = diagram.locator('[data-metric="requests"]');
  const context = diagram.locator('[data-metric="context"]');
  const headroom = diagram.locator('[data-metric="headroom"]');
  const baselinePaths = await diagram.locator('[data-face]').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  await expect(memory).toHaveText('16.0');
  await expect(requests).toHaveText('4');
  const longContext = diagram.getByRole('button', { name: 'Long context', exact: true });
  await expect(longContext).toBeEnabled();
  await longContext.focus();
  await longContext.press('Enter');
  await expect(longContext).toHaveAttribute('aria-pressed', 'true');
  await expect(diagram.getByRole('status')).toContainText('Long context. Allocated GPU memory');
  await expect(context).toHaveText('32,768');
  expect(Number(await memory.textContent())).toBeGreaterThan(16);
  expect(Number(await requests.textContent())).toBeLessThan(4);
  expect(await diagram.locator('[data-face]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).not.toEqual(baselinePaths);

  for (const workload of [
    { label: 'Chat', requests: '2', context: '8,192' },
    { label: 'Batch jobs', requests: '6', context: '4,096' },
    { label: 'Idle', requests: '0', context: '8,192' },
  ]) {
    await diagram.getByRole('button', { name: workload.label, exact: true }).click();
    await expect(diagram.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(diagram.getByRole('status')).toContainText(workload.label);
    await expect(requests).toHaveText(workload.requests);
    await expect(context).toHaveText(workload.context);
    const allocated = Number(await memory.textContent());
    expect(allocated).toBeGreaterThanOrEqual(8);
    expect(allocated + Number(await headroom.textContent())).toBe(24);
    const filledBlocks = await diagram.locator('[data-face="top"]').evaluateAll(paths => paths.filter(path => path.getAttribute('d')).length);
    expect(filledBlocks * 0.5).toBe(allocated);
  }

  await diagram.getByRole('button', { name: 'Baseline', exact: true }).click();
  await expect(memory).toHaveText('16.0');
  await expect(requests).toHaveText('4');
  await expect(context).toHaveText('8,192');
  expect(await diagram.locator('[data-face]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(baselinePaths);
  await page.getByText('About this example', { exact: true }).click();
  await expect(page.locator('.model-assumptions')).toContainText('No speed or latency improvement is predicted.');
  expect(errors).toEqual([]);
});

test.describe('static baseline', () => {
  test.use({ javaScriptEnabled: false });
  test('the local hosting vision remains useful without JavaScript', async ({ page }) => {
    await page.goto('/#vision');
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
    await expect(page.locator('#vision-title')).toBeInViewport();
    const position = await page.evaluate(() => ({
      heading: document.getElementById('vision-title')!.getBoundingClientRect().top,
      header: document.querySelector('header')!.getBoundingClientRect().bottom,
    }));
    expect(position.heading).toBeGreaterThanOrEqual(position.header);
    await expect(page.locator('#vision-title')).toContainText('From local models');
    await expect(page.getByRole('img', { name: 'Local model memory allocation' })).toBeVisible();
    await expect(page.locator('[data-metric="memory"]')).toHaveText('16.0');
    await expect(page.locator('[data-metric="requests"]')).toHaveText('4');
    await expect(page.getByRole('button', { name: 'Chat', exact: true })).toBeDisabled();
    const fallback = page.locator('[data-model-explorer] noscript p');
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText('The baseline is shown above.');
    await page.getByText('About this example', { exact: true }).click();
    await expect(page.locator('.model-assumptions p')).toBeVisible();
  });
});
