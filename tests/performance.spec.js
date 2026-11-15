const { test, expect } = require('@playwright/test');

test('image delivery follows responsive and lazy-loading performance rules', async ({ page }) => {
  await page.goto('/');

  const audit = await page.evaluate(() => {
    const images = [...document.querySelectorAll('img')].filter(img => img.id !== 'lbImg');
    const heroImages = [...document.querySelectorAll('.hero-slide img')];
    const contentImages = images.filter(img => !img.closest('.hero'));
    return {
      imageCount: images.length,
      missingAlt: images.filter(img => !img.hasAttribute('alt') || !img.getAttribute('alt').trim()).length,
      missingDimensions: images.filter(img => !(img.getAttribute('width') && img.getAttribute('height'))).length,
      missingSrcset: images.filter(img => !img.getAttribute('srcset')).map(img => img.getAttribute('src')),
      nonLazyContentImages: contentImages.filter(img => img.loading !== 'lazy').map(img => img.getAttribute('src')),
      nonAsyncImages: images.filter(img => img.decoding !== 'async').map(img => img.getAttribute('src')),
      heroPriority: heroImages.map(img => img.getAttribute('fetchpriority')),
      heroLoading: heroImages.map(img => img.getAttribute('loading'))
    };
  });

  expect(audit.imageCount).toBeGreaterThan(10);
  expect(audit.missingAlt).toBe(0);
  expect(audit.missingDimensions).toBe(0);
  expect(audit.missingSrcset).toEqual([]);
  expect(audit.nonLazyContentImages).toEqual([]);
  expect(audit.nonAsyncImages).toEqual([]);
  expect(audit.heroPriority[0]).toBe('high');
  expect(audit.heroLoading[0]).not.toBe('lazy');
  expect(audit.heroLoading.slice(1).every(value => value === 'lazy')).toBe(true);
});

test('image gallery does not eagerly fetch full-resolution originals before opening the lightbox', async ({ page }) => {
  const imageRequests = [];
  page.on('request', request => {
    if (/\/img\/.*(?:full|2000x|1800x|1600x)/.test(request.url())) imageRequests.push(request.url());
  });

  await page.goto('/');
  await page.waitForLoadState('networkidle');
  const beforeOpen = [...imageRequests];

  await expect(page.locator('#gallery .g-btn').first()).toBeVisible();
  expect(beforeOpen.length).toBeLessThan(8);

  await page.locator('#gallery .g-btn').first().click();
  await expect(page.locator('#lb')).toHaveClass(/is-open/);
});
