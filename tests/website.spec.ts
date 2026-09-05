import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, truncate } from 'node:fs/promises';

async function ready(page: Page) {
  await page.locator('astro-island[ssr]').first().waitFor({ state: 'detached' });
  await page.evaluate(() => document.fonts.ready);
}

test('system map, graph scenarios, keyboard inspection, and data export work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('One accountable');
  await page.getByRole('button', { name: /Facility:/ }).click();
  await expect(page.locator('#layer-description')).toContainText('physical limits');
  await expect(page.getByRole('button', { name: /Facility:/ })).toHaveAttribute('aria-pressed', 'true');
  await page.getByRole('button', { name: 'Collective wait' }).click();
  await expect(page.locator('.evidence-reading h3')).toContainText('data is in transit');
  await expect(page.locator('.plot-metrics')).toContainText('NCCL share of step');
  const slider = page.getByRole('slider', { name: 'Inspect time' });
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', /0 seconds: NCCL share of step 32 percent/);
  await slider.press('ArrowRight');
  await expect(page.locator('.sample-control output')).toHaveText('05 s');
  await page.getByText('View sample data', { exact: true }).click();
  await expect(page.getByRole('table')).toBeVisible();
  await expect(page.getByRole('table').locator('tbody tr')).toHaveCount(12);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download trace' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('strided-illustrative-communication.csv');
  expect(errors).toEqual([]);
});

test('navigation works on both pages and mobile menu supports Escape', async ({ page, isMobile }) => {
  await page.goto('/submit');
  if (isMobile) {
    const toggle = page.getByRole('button', { name: 'Open navigation' });
    await toggle.click();
    await expect(page.getByRole('navigation', { name: 'Mobile navigation' })).toBeVisible();
    await page.keyboard.press('Escape');
    await expect(toggle).toBeFocused();
    await expect(toggle).toHaveAttribute('aria-expanded', 'false');
    await toggle.click();
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Our approach' }).click();
  } else {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Our approach' }).click();
  }
  await expect(page).toHaveURL(/\/#approach$/);
  await expect(page.locator('#approach')).toBeInViewport();
});

for (const path of ['/', '/submit']) {
  test(`${path} has no overflow, broken internal links, or WCAG AA violations`, async ({ page }) => {
    await page.goto(path);
    await ready(page);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true);
    const brokenAnchors = await page.locator('a[href^="#"]').evaluateAll(links => links.filter(link => !document.getElementById(link.getAttribute('href')!.slice(1))).map(link => link.getAttribute('href')));
    expect(brokenAnchors).toEqual([]);
    const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
    expect(results.violations).toEqual([]);
    await page.screenshot({ path: `test-results/${path === '/' ? 'home' : path.slice(1)}-${test.info().project.name}.png`, fullPage: true });
  });
}

async function fillContact(page: Page) {
  await page.getByRole('textbox', { name: 'Name', exact: false }).first().fill('Test Engineer');
  await page.getByRole('textbox', { name: 'Work email' }).fill('engineer@example.com');
}
const capture = { name: 'capture.json', mimeType: 'application/json', buffer: Buffer.from('{"test":true}') };

test('capture validation rejects empty, unsupported, and oversized files', async ({ page }) => {
  await page.goto('/submit');
  await ready(page);
  await fillContact(page);
  const input = page.locator('#dump');
  const submit = page.getByRole('button', { name: 'Send workload' });
  await expect(submit).toBeDisabled();
  await input.setInputFiles({ ...capture, buffer: Buffer.alloc(0) });
  await expect(page.getByRole('alert')).toContainText('empty');
  await input.setInputFiles({ ...capture, name: 'file.exe' });
  await expect(page.getByRole('alert')).toContainText('Choose a .ncu-rep');
  await mkdir(test.info().outputDir, { recursive: true });
  const oversizedFile = test.info().outputPath('oversized.json');
  await writeFile(oversizedFile, '');
  await truncate(oversizedFile, 50 * 1024 * 1024 + 1);
  await input.setInputFiles(oversizedFile);
  await expect(page.getByRole('alert')).toContainText('50 MB');
  await expect(submit).toBeDisabled();
  await input.setInputFiles(capture);
  await expect(page.getByRole('alert')).toHaveCount(0);
  await expect(submit).toBeEnabled();
});

test('upload completes through signing, storage, and notification with mocked services', async ({ page }) => {
  const calls: string[] = [];
  await page.route('**/api/upload-url', async route => {
    calls.push('sign');
    expect(route.request().postDataJSON().fileName).toBe('capture.json');
    await route.fulfill({ json: { uploadUrl: 'http://127.0.0.1:4321/test-storage', contentType: 'application/octet-stream', key: 'test-key', token: 'test-token' } });
  });
  await page.route('**/test-storage', async route => {
    calls.push('upload');
    expect(route.request().method()).toBe('PUT');
    await route.fulfill({ status: 200, body: '' });
  });
  await page.route('**/api/notify', async route => {
    calls.push('notify');
    expect(route.request().postDataJSON().token).toBe('test-token');
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/submit');
  await ready(page);
  await fillContact(page);
  await page.locator('#dump').setInputFiles(capture);
  await page.getByRole('button', { name: 'Send workload' }).click();
  await expect(page.getByRole('status')).toContainText('Workload received.');
  await expect(page.getByRole('status')).toContainText('engineer@example.com');
  expect(calls).toEqual(['sign', 'upload', 'notify']);
});

test('failed upload explains the error and allows retry', async ({ page }) => {
  await page.route('**/api/upload-url', route => route.fulfill({ status: 502, json: { error: 'Could not start the upload. Try again shortly.' } }));
  await page.goto('/submit');
  await ready(page);
  await fillContact(page);
  await page.locator('#dump').setInputFiles(capture);
  await page.getByRole('button', { name: 'Send workload' }).click();
  await expect(page.getByRole('alert')).toContainText('Could not start the upload');
  await expect(page.getByRole('alert').getByRole('link')).toHaveAttribute('href', 'mailto:hello@strided.dev');
  await expect(page.getByRole('button', { name: 'Send workload' })).toBeEnabled();
});
