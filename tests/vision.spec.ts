import { test, expect } from '@playwright/test';

test('previously shared Vision URLs lead to the homepage section', async ({ page }) => {
  await page.goto('/vision');
  await expect(page).toHaveURL(/\/#vision$/);
  await expect(page.locator('#vision-title')).toBeInViewport();
  await expect(page.locator('#vision-title')).toContainText('works as one');
});

test('rack objectives show coherent tradeoffs and restore the original baseline', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#vision');
  const diagram = page.locator('[data-rack-explorer]');
  const metrics = page.locator('#rack-metrics');
  const draw = page.locator('[data-metric="draw"]');
  const work = page.locator('[data-metric="work"]');
  const headroom = page.locator('[data-metric="headroom"]');
  const baselineDraw = Number(await draw.textContent());
  const baselinePaths = await diagram.locator('[data-face]').evaluateAll(paths => paths.map(path => path.getAttribute('d')));
  await expect(work).toHaveText('100');
  const power = diagram.getByRole('button', { name: 'Power', exact: true });
  await expect(power).toBeEnabled();
  await power.focus();
  await power.press('Enter');
  await expect(power).toHaveAttribute('aria-pressed', 'true');
  await expect(diagram.getByRole('status')).toContainText('Power. Modeled GPU draw');
  expect(Number(await draw.textContent())).toBeLessThan(baselineDraw);
  expect(Number(await work.textContent())).toBeLessThan(100);
  expect(await diagram.locator('[data-face]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).not.toEqual(baselinePaths);

  for (const label of ['Throughput', 'Cost', 'Latency']) {
    await diagram.getByRole('button', { name: label, exact: true }).click();
    await expect(diagram.locator('button[aria-pressed="true"]')).toHaveCount(1);
    await expect(diagram.getByRole('status')).toContainText(label);
    expect(Number(await draw.textContent())).toBeGreaterThan(0);
    expect(Number(await work.textContent())).toBeGreaterThan(100);
    expect(Number(await draw.textContent()) + Number(await headroom.textContent())).toBeCloseTo(34.08, 0);
    await expect(metrics).not.toContainText('NaN');
  }

  await diagram.getByRole('button', { name: 'Baseline', exact: true }).click();
  await expect(draw).toHaveText(baselineDraw.toFixed(1));
  await expect(work).toHaveText('100');
  expect(await diagram.locator('[data-face]').evaluateAll(paths => paths.map(path => path.getAttribute('d')))).toEqual(baselinePaths);
  await page.getByText('About this model', { exact: true }).click();
  await expect(page.locator('.rack-assumptions')).toContainText('No latency or financial outcome is calculated.');
  expect(errors).toEqual([]);
});

test.describe('static baseline', () => {
  test.use({ javaScriptEnabled: false });
  test('the vision and rack remain useful without JavaScript', async ({ page }) => {
    await page.goto('/#vision');
    await expect(page.locator('#vision-title')).toContainText('works as one');
    await expect(page.getByRole('img', { name: 'One rack, forty-eight GPUs' })).toBeVisible();
    await expect(page.locator('[data-metric="draw"]')).toHaveText('26.2');
    await expect(page.locator('[data-metric="work"]')).toHaveText('100');
    await expect(page.getByRole('button', { name: 'Power', exact: true })).toBeDisabled();
    const fallback = page.locator('[data-rack-explorer] noscript p');
    await expect(fallback).toBeVisible();
    await expect(fallback).toContainText('The baseline is shown above.');
    await page.getByText('About this model', { exact: true }).click();
    await expect(page.locator('.rack-assumptions p')).toBeVisible();
  });
});
