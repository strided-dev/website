import { test, expect } from '@playwright/test';

test('all section links stay on the homepage, preserve the graphic, and support history', async ({ page, isMobile }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#vision');
  await page.evaluate(() => document.fonts.ready);
  const power = page.locator('[data-rack-explorer]').getByRole('button', { name: 'Power', exact: true });
  await expect(power).toBeEnabled();
  await power.click();
  const documentRequests: string[] = [];
  page.on('request', request => {
    if (request.isNavigationRequest() && request.frame() === page.mainFrame()) documentRequests.push(request.url());
  });
  const navigation = page.getByRole('navigation', { name: isMobile ? 'Mobile navigation' : 'Main navigation', exact: true, includeHidden: true });
  const links = [
    { label: 'The system', id: 'system', heading: 'system-title' },
    { label: 'Vision', id: 'vision', heading: 'vision-title' },
    { label: 'Our approach', id: 'approach', heading: 'approach-title' },
    { label: 'Research', id: 'research', heading: 'research-title' },
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
  await expect(page).toHaveURL(/\/#approach$/);
  await expect(navigation.locator('[data-section-link="approach"]')).toHaveAttribute('aria-current', 'location');
  await page.locator('#vision').evaluate(section => section.scrollIntoView());
  await expect(navigation.locator('[data-section-link="vision"]')).toHaveAttribute('aria-current', 'location');
  await expect(power).toHaveAttribute('aria-pressed', 'true');
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
