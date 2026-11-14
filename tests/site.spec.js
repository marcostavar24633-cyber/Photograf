const { test, expect } = require('@playwright/test');

test('page structure, internal links and local images are valid', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Photograf/);

  const audit = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('[id]')].map(el => el.id);
    const duplicateIds = ids.filter((id, index) => ids.indexOf(id) !== index);
    const missingAnchors = [...document.querySelectorAll('a[href^="#"]')]
      .map(a => a.getAttribute('href').slice(1))
      .filter(id => id && !document.getElementById(id));
    const missingImages = [...document.images]
      .filter(img => img.hasAttribute('src') && img.complete && img.naturalWidth === 0)
      .map(img => img.getAttribute('src'));
    return { duplicateIds, missingAnchors, missingImages };
  });

  expect(audit.duplicateIds).toEqual([]);
  expect(audit.missingAnchors).toEqual([]);
  expect(audit.missingImages).toEqual([]);
  await page.screenshot({ path: 'test-results/photograf-desktop.png', fullPage: true });
});

test('cinematic navigation opens, filters a gallery and closes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#burger').click();
  await expect(page.locator('#mnav')).toHaveAttribute('aria-hidden', 'false');
  await page.getByRole('link', { name: 'Свадебные истории' }).click();
  await expect(page.locator('#filters [data-filter="wedding"]')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.locator('#mnav')).toHaveAttribute('aria-hidden', 'true');
});

test('lightbox opens, navigates and closes', async ({ page }) => {
  await page.goto('/');
  await page.locator('#gallery .g-btn').first().click();
  await expect(page.locator('#lb')).toHaveClass(/is-open/);
  await expect(page.locator('#lbImg')).toHaveClass(/is-loaded/);
  await page.locator('#lbNext').click();
  await expect(page.locator('#lbCount')).toContainText('/');
  await page.locator('#lbClose').click();
  await expect(page.locator('#lb')).not.toHaveClass(/is-open/);
});

test('mobile navigation remains usable at narrow viewport', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await expect(page.locator('#burger')).toBeVisible();
  await page.locator('#burger').click();
  await expect(page.locator('#mnav')).toBeVisible();
  await expect(page.getByRole('link', { name: 'Обсудить съёмку' })).toBeVisible();
  await page.locator('#menuClose').click();
  await expect(page.locator('#mnav')).toHaveAttribute('aria-hidden', 'true');
  await page.screenshot({ path: 'test-results/photograf-mobile.png', fullPage: true });
});

test('demo safeguards stay enabled', async ({ page }) => {
  await page.goto('/');
  const safeguards = await page.evaluate(() => ({
    noindex: document.querySelector('meta[name="robots"]')?.content,
    formspreeDisabled: /FORMSPREE_ID:\s*''/.test(document.querySelectorAll('script')[1]?.textContent || ''),
    analyticsDisabled: /METRIKA_ID:\s*0/.test(document.querySelectorAll('script')[1]?.textContent || '')
  }));
  expect(safeguards.noindex).toBe('noindex,follow');
  expect(safeguards.formspreeDisabled).toBe(true);
  expect(safeguards.analyticsDisabled).toBe(true);
});
