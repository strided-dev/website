import { test, expect } from '@playwright/test';

test('all section links stay on the homepage, preserve the graphic, and support history', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#memory');
  await page.evaluate(() => document.fonts.ready);
  const agent = page.locator('[data-model-explorer]').getByRole('button', { name: 'Agent loop', exact: true });
  await expect(agent).toBeEnabled();
  await agent.click();
  const documentRequests: string[] = [];
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests.push(request.url());
  });
  const navigation = page.getByRole('navigation', { name: isMobile ? 'Mobile navigation' : 'Main navigation', exact: true, includeHidden: true });
  const links = [
    { label: 'vivace', id: 'vivace', heading: 'vivace-title' },
    { label: 'Live tuning', id: 'tuning', heading: 'tuning-title' },
    { label: 'Benchmarks', id: 'benchmarks', heading: 'benchmarks-title' },
    { label: 'Vision', id: 'vision', heading: 'vision-title' },
  ];
  for (const item of links) {
    if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
    const link = navigation.locator(`[data-section-link="${item.id}"]`);
    await expect(link).toHaveAttribute('href', `#${item.id}`);
    await link.click();
    await expect(page).toHaveURL(new RegExp(`/#${item.id}$`));
    await expect(page.locator(`#${item.heading}`)).toBeInViewport();
    await expect(link).toHaveAttribute('aria-current', 'location');
    await expect(navigation.locator('[aria-current]')).toHaveCount(1);
    if (isMobile) await expect(navigation).toBeHidden();
  }
  await page.goBack();
  await expect(page).toHaveURL(/\/#benchmarks$/);
  await expect(navigation.locator('[data-section-link="benchmarks"]')).toHaveAttribute('aria-current', 'location');
  await page.locator('#tuning').evaluate(section => section.scrollIntoView());
  await expect(navigation.locator('[data-section-link="tuning"]')).toHaveAttribute('aria-current', 'location');
  await expect(agent).toHaveAttribute('aria-pressed', 'true');
  expect(documentRequests).toEqual([]);

  await page.goto('/submit');
  for (const item of links) {
    await expect(navigation.locator(`[data-section-link="${item.id}"]`)).toHaveAttribute('href', `/#${item.id}`);
  }
  if (isMobile) await page.getByRole('button', { name: 'Open navigation' }).click();
  await navigation.getByRole('link', { name: 'Vision', exact: true }).click();
  await expect(page).toHaveURL(/\/#vision$/);
  await expect(page.locator('#vision-title')).toBeInViewport();
});
