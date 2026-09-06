import { test, expect } from '@playwright/test';

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
    // Let the native anchor scroll finish before testing another interaction.
    await expect.poll(() => page.evaluate(() => Math.abs(document.getElementById('vision')!.getBoundingClientRect().top - parseFloat(getComputedStyle(document.documentElement).scrollPaddingTop)))).toBeLessThan(2);
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
