import { test, expect, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { mkdir, writeFile, truncate } from 'node:fs/promises';

async function ready(page: Page) {
  await page.locator('astro-island[ssr]').first().waitFor({ state: 'detached' });
  await page.evaluate(() => document.fonts.ready);
}

test('system map, trial outcomes, keyboard inspection, and data export work', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto('/');
  await ready(page);
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Local models');
  const controls = page.getByRole('group', { name: 'Explore live adjustments' });
  await expect(page.locator('.map-scope')).toContainText('Workload · Scheduler · KV cache · Kernels · GPU');
  await controls.getByRole('button', { name: 'Prefill', exact: true }).click();
  await expect(page.locator('#control-description')).toContainText('chunk size');
  await expect(page.locator('.map-scope')).toHaveText('Spans Workload · Scheduler · Kernels');
  await expect(page.locator('.map-knob')).toHaveText('Setting prefill_chunk_tokens');
  await expect(controls.getByRole('button', { name: 'Prefill', exact: true })).toHaveAttribute('aria-pressed', 'true');
  await controls.getByRole('button', { name: 'Batching', exact: true }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('.map-scope')).toHaveText('Spans Workload · Scheduler · KV cache · GPU');
  await controls.getByRole('button', { name: 'Attention', exact: true }).click();
  await expect(page.locator('.map-scope')).toHaveText('Spans KV cache · Kernels · GPU');
  await controls.getByRole('button', { name: 'Memory', exact: true }).click();
  await expect(page.locator('.map-scope')).toHaveText('Spans Scheduler · KV cache · GPU');
  await expect(page.locator('.map-knob')).toHaveText('Setting kv_preempt_watermark');
  await controls.getByRole('button', { name: 'Overview', exact: true }).click();
  await expect(controls.locator('[aria-pressed="true"]')).toHaveCount(1);
  await expect(page.locator('.map-scope')).toHaveText('Spans Workload · Scheduler · KV cache · Kernels · GPU');

  const outcomes = page.getByRole('group', { name: 'Example trial outcome' });
  await expect(page.locator('.trial-reading h4')).toContainText('Kept.');
  await expect(page.locator('.plot-metrics')).toContainText('+12%');
  await expect(page.locator('.phase-track .is-skipped')).toHaveCount(0);
  await outcomes.getByRole('button', { name: 'Guardrail' }).click();
  await expect(page.locator('.trial-reading h4')).toContainText('Reverted in one step');
  await expect(page.locator('.trial-reading')).toContainText('max_batch_seqs 16 → 32');
  await expect(page.locator('.plot-metrics')).toContainText('+45%');
  await expect(page.locator('.phase-figure')).toContainText('Outcome: Reverted');
  await expect(page.getByRole('list', { name: 'Trial phases' }).getByRole('listitem').filter({ hasText: 'skipped' })).toHaveText('Review (skipped)');
  const slider = page.getByRole('slider', { name: 'Inspect window' });
  await slider.focus();
  await slider.press('Home');
  await expect(slider).toHaveAttribute('aria-valuetext', /^Steps 0 to 100, arm A: throughput 100 percent/);
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');
  await slider.press('ArrowRight');
  await expect(page.locator('.sample-control output')).toHaveText('B · 400');
  await expect(slider).toHaveAttribute('aria-valuetext', /p99 time per token 158 percent of baseline/);
  await outcomes.getByRole('button', { name: 'Traffic shift' }).click();
  await expect(page.locator('.phase-figure')).toContainText('Outcome: Inconclusive');
  await expect(page.locator('.trial-reading')).toContainText('25% tolerance');
  await outcomes.getByRole('button', { name: 'Guardrail' }).click();
  await page.getByText('View trial data', { exact: true }).click();
  await expect(page.getByRole('table', { name: /Guardrail/ })).toBeVisible();
  await expect(page.getByRole('table', { name: /Guardrail/ }).locator('tbody tr')).toHaveCount(16);
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download trial' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('strided-illustrative-trial-guardrail.csv');
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
    await page.getByRole('navigation', { name: 'Mobile navigation' }).getByRole('link', { name: 'Live tuning' }).click();
  } else {
    await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Live tuning' }).click();
  }
  await expect(page).toHaveURL(/\/#tuning$/);
  await expect(page.locator('#tuning')).toBeInViewport();
  await page.getByRole('banner').getByRole('link', { name: 'Join the beta' }).click();
  await expect(page).toHaveURL(/\/#beta$/);
  await expect(page.locator('#beta-title')).toBeInViewport();
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

test('beta signup sends the form as JSON and confirms with mocked service', async ({ page }) => {
  let sent: Record<string, string> = {};
  await page.route('**/api/beta', async route => {
    sent = route.request().postDataJSON();
    await route.fulfill({ json: { ok: true } });
  });
  await page.goto('/#beta');
  const form = page.locator('#beta form');
  const submit = form.getByRole('button', { name: 'Join the beta' });
  await submit.click();
  expect(await form.getByRole('textbox', { name: 'Email' }).evaluate((input: HTMLInputElement) => input.validity.valueMissing)).toBe(true);
  expect(sent).toEqual({});
  await form.getByRole('textbox', { name: 'Email' }).fill('builder@example.com');
  await form.getByRole('textbox', { name: 'Name' }).fill('Ada Builder');
  await form.getByRole('combobox', { name: 'GPU' }).selectOption({ label: 'Apple silicon' });
  await form.getByRole('combobox', { name: 'Operating system' }).selectOption({ label: 'macOS' });
  await form.getByRole('textbox', { name: 'What would you run on it?' }).fill('A coding model, long prompts.');
  await submit.click();
  const joined = page.locator('#beta-joined');
  await expect(joined).toBeVisible();
  await expect(joined).toBeFocused();
  await expect(joined).toContainText("You're on the list.");
  await expect(joined).toContainText('builder@example.com');
  await expect(form).toBeHidden();
  expect(sent).toEqual({ email: 'builder@example.com', name: 'Ada Builder', gpu: 'apple', os: 'macos', use: 'A coding model, long prompts.', website: '' });
});

test('failed beta signup explains the error and allows retry', async ({ page }) => {
  await page.route('**/api/beta', route => route.fulfill({ status: 502, json: { error: "We couldn't add you right now." } }));
  await page.goto('/#beta');
  const form = page.locator('#beta form');
  await form.getByRole('textbox', { name: 'Email' }).fill('builder@example.com');
  await form.getByRole('button', { name: 'Join the beta' }).click();
  await expect(form.getByRole('alert')).toContainText("We couldn't add you right now.");
  await expect(form.getByRole('alert').getByRole('link')).toHaveAttribute('href', 'mailto:hello@strided.dev');
  await expect(form.getByRole('button', { name: 'Join the beta' })).toBeEnabled();
  await expect(form.getByRole('textbox', { name: 'Email' })).toHaveValue('builder@example.com');
  await expect(page.locator('#beta-joined')).toBeHidden();
});

test('beta endpoint rejects invalid input and absorbs bots before contacting any service', async ({ request, baseURL }) => {
  const invalid = await request.post('/api/beta', { data: { email: 'not-an-email' } });
  expect(invalid.status()).toBe(400);
  expect(await invalid.json()).toEqual({ error: 'A valid email is required.' });
  const bot = await request.post('/api/beta', { data: { email: 'bot@example.com', website: 'https://spam.example' } });
  expect(bot.status()).toBe(200);
  expect(await bot.json()).toEqual({ ok: true });
  // Browsers send Origin with form posts; Astro rejects cross-site ones.
  const form = await request.post('/api/beta', { form: { email: 'not-an-email' }, headers: { origin: baseURL! }, maxRedirects: 0 });
  expect(form.status()).toBe(303);
  expect(form.headers().location).toBe('/#beta-error');
});

test.describe('beta without JavaScript', () => {
  test.use({ javaScriptEnabled: false });
  test('the form posts natively and both results are reachable', async ({ page }) => {
    await page.goto('/#beta');
    const form = page.locator('#beta form');
    await expect(form).toHaveAttribute('method', 'post');
    await expect(form).toHaveAttribute('action', '/api/beta');
    await expect(page.locator('#beta-joined')).toBeHidden();
    await expect(page.locator('#beta-error')).toBeHidden();
    await page.goto('/#beta-joined');
    await expect(page.locator('#beta-joined')).toBeVisible();
    await expect(page.locator('#beta-joined')).toContainText("We'll email you when the vivace beta opens.");
    await expect(form).toBeHidden();
    await page.goto('/#beta-error');
    await expect(page.locator('#beta-error')).toBeVisible();
    await expect(form).toBeVisible();
  });
});
