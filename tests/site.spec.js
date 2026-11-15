const { test, expect } = require('@playwright/test');

test('page structure, internal links and local images are valid', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveTitle(/Вера Ланская/);

  const heroEyebrowTop = await page.locator('.hero .eyebrow').evaluate(el => el.getBoundingClientRect().top);
  expect(heroEyebrowTop).toBeGreaterThan(80);

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

  const firstReveal = page.locator('.reveal').first();
  await firstReveal.scrollIntoViewIfNeeded();
  await expect(firstReveal).toHaveClass(/is-in/);
  await page.locator('.reveal').evaluateAll(elements => elements.forEach(el => el.classList.add('is-in')));
  await page.waitForTimeout(1100);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'test-results/photograf-desktop-viewport.png' });
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
  await page.screenshot({ path: 'test-results/photograf-mobile-menu.png' });
  await page.locator('#menuClose').click();
  await expect(page.locator('#mnav')).toHaveAttribute('aria-hidden', 'true');
  const firstReveal = page.locator('.reveal').first();
  await firstReveal.scrollIntoViewIfNeeded();
  await expect(firstReveal).toHaveClass(/is-in/);
  await page.locator('.reveal').evaluateAll(elements => elements.forEach(el => el.classList.add('is-in')));
  await page.waitForTimeout(1100);
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(150);
  await page.screenshot({ path: 'test-results/photograf-mobile.png', fullPage: true });
});

test('indexing, local-only form and analytics safeguards are correct', async ({ page }) => {
  await page.goto('/');
  const safeguards = await page.evaluate(() => ({
    robots: document.querySelector('meta[name="robots"]')?.content,
    localOnlyForm: /navigator\.clipboard\.writeText/.test(document.querySelectorAll('script')[1]?.textContent || '') && !/fetch\(/.test(document.querySelectorAll('script')[1]?.textContent || ''),
    analyticsDisabled: /METRIKA_ID:\s*0/.test(document.querySelectorAll('script')[1]?.textContent || '')
  }));
  expect(safeguards.robots).toBe('noindex,follow');
  expect(safeguards.localOnlyForm).toBe(true);
  expect(safeguards.analyticsDisabled).toBe(true);
});



test('lead form prepares a readable multiline message without submitting data to a server', async ({ page }) => {
  const nonGetRequests = [];
  page.on('request', request => {
    if (request.method() !== 'GET') nonGetRequests.push({ method: request.method(), url: request.url() });
  });

  await page.goto('/');
  await page.locator('#f-name').fill('Мария');
  await page.locator('#f-phone').fill('@maria_photo');
  await page.locator('#f-agree').check();
  await page.locator('#submitBtn').click();

  await expect(page.locator('.form-ok')).toBeVisible();
  const message = await page.locator('#messagePreview').textContent();
  expect(message).toContain('Имя: Мария');
  expect(message).toContain('Контакт: @maria_photo');
  expect(message).toContain('\nКонтакт:');
  expect(message).not.toContain('\\n');
  expect(nonGetRequests).toEqual([]);
});


test('primary interactions run without uncaught browser errors or horizontal page overflow', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  await page.locator('#burger').click();
  await page.locator('#menuClose').click();
  await page.locator('#filters [data-filter="wedding"]').click();
  await page.locator('#gallery .g-btn').first().click();
  await page.locator('#lbClose').click();

  const hasHorizontalOverflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(errors).toEqual([]);
  expect(hasHorizontalOverflow).toBe(false);
});


test('WCAG accessibility audit: main page and open navigation', async ({ page }) => {
  const AxeBuilder = require('@axe-core/playwright').default;
  await page.goto('/');
  const pageResults = await new AxeBuilder({ page })
    .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])
    .analyze();
  expect(pageResults.violations.map(v => ({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);

  await page.locator('#burger').click();
  const menuResults = await new AxeBuilder({ page })
    .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])
    .analyze();
  expect(menuResults.violations.map(v => ({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}))).toEqual([]);
});


test('three navigation modes cycle without breaking the menu', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  await expect(page.locator('.hdr-nav')).toBeVisible();
  await expect(page.locator('.hdr-nav a')).toHaveCount(4);
  await page.locator('#burger').click();
  const mode = page.locator('#menuModeToggle');
  await expect(mode).toHaveAttribute('data-mode', 'editorial');
  await mode.click();
  await expect(mode).toHaveAttribute('data-mode', 'vertical');
  await expect(page.locator('body')).toHaveClass(/menu-mode-vertical/);
  await mode.click();
  await expect(mode).toHaveAttribute('data-mode', 'orbit');
  await expect(page.locator('body')).toHaveClass(/menu-mode-orbit/);
  await mode.click();
  await expect(mode).toHaveAttribute('data-mode', 'editorial');
  await page.locator('#menuClose').click();
  await expect(page.locator('#mnav')).toHaveAttribute('aria-hidden', 'true');
});


test('signature hero keeps cinematic motion accessible and responsive', async ({ page }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('/');
  const activeImage = page.locator('.hero-slide.is-active img');
  await expect(activeImage).toBeVisible();
  const animation = await activeImage.evaluate(el => getComputedStyle(el).animationName);
  expect(animation).toContain('heroCinematicDrift');
  await page.locator('.hero').hover({ position: { x: 180, y: 160 } });
  await expect.poll(() => page.locator('.hero').evaluate(el => el.style.getPropertyValue('--hero-shift-x'))).not.toBe('');
  await page.setViewportSize({ width: 390, height: 844 });
  await expect(page.locator('.hero')).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  expect(errors).toEqual([]);
});

test('signature hero disables motion when reduced motion is requested', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  const activeImage = page.locator('.hero-slide.is-active img');
  const animation = await activeImage.evaluate(el => getComputedStyle(el).animationName);
  expect(animation).toBe('none');
});


test('gallery experience reports filtered image counts and remains responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const cards = page.locator('#gallery .g-item');
  const total = await cards.count();
  await expect(page.locator('#portfolio .gallery-status')).toContainText(String(total).padStart(2,'0'));
  await page.locator('#filters [data-filter="wedding"]').click();
  const weddingCount = await page.locator('#gallery .g-item[data-cat="wedding"]:not(.is-hidden)').count();
  await expect(page.locator('#portfolio .gallery-status')).toContainText(String(weddingCount).padStart(2,'0'));
  await expect(page.locator('#filters [data-filter="wedding"]')).toHaveAttribute('aria-pressed','true');
  await page.setViewportSize({ width: 360, height: 800 });
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
  await expect(page.locator('#filters [data-filter="all"]')).toBeVisible();
});


test('lightbox cinema transitions preserve keyboard and touch navigation', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const first = page.locator('#gallery .g-btn').first();
  await first.click();
  const dialog = page.locator('#lb');
  await expect(dialog).toHaveAttribute('aria-hidden','false');
  await expect(page.locator('#lbImg')).toHaveClass(/is-loaded/);
  await expect(page.locator('#lbCount')).toContainText('1 /');
  await page.keyboard.press('ArrowRight');
  await expect(page.locator('#lbCount')).toContainText('2 /');
  await page.keyboard.press('ArrowLeft');
  await expect(page.locator('#lbCount')).toContainText('1 /');
  await page.keyboard.press('Escape');
  await expect(dialog).toHaveAttribute('aria-hidden','true');
  await expect(first).toBeFocused();
});

test('lightbox cinema respects reduced motion', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/');
  await page.locator('#gallery .g-btn').first().click();
  const transition = await page.locator('#lbImg').evaluate(el => getComputedStyle(el).transitionDuration);
  expect(transition).toMatch(/0s|0\.01ms/);
});


test('premium navigation marks the current section and keeps anchor navigation responsive', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto('/');
  const portfolioLink = page.locator('.hdr-nav a[href="#portfolio"]');
  await page.locator('#portfolio').scrollIntoViewIfNeeded();
  await expect(portfolioLink).toHaveAttribute('aria-current', 'location');
  await page.locator('.hdr-nav a[href="#services"]').click();
  await expect(page.locator('#services')).toBeInViewport();
  await expect(page.locator('.hdr-nav a[href="#services"]')).toHaveAttribute('aria-current', 'location');
});

test('premium menu controls retain keyboard focus and reduced-motion preferences', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  const burger = page.locator('#burger');
  await burger.focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('#mnav')).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#mnav a').first()).toBeFocused();
  await page.keyboard.press('Escape');
  await expect(page.locator('#mnav')).toHaveAttribute('aria-hidden', 'true');
  await expect(burger).toBeFocused();
  const scrollBehavior = await page.locator('html').evaluate(el => getComputedStyle(el).scrollBehavior);
  expect(scrollBehavior).toBe('auto');
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
  expect(overflow).toBe(false);
});


test('hero image is prioritized and portfolio imagery is deferred', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('link[rel="preload"][as="image"][fetchpriority="high"]')).toHaveCount(1);
  const heroImage = page.locator('.hero-slide.is-active img').first();
  await expect(heroImage).toHaveAttribute('fetchpriority', 'high');
  await expect(heroImage).toHaveAttribute('decoding', 'async');
  const galleryImages = page.locator('#portfolio .g-item img');
  expect(await galleryImages.count()).toBeGreaterThan(0);
  await expect(galleryImages.first()).toHaveAttribute('loading', 'lazy');
  await expect(galleryImages.first()).toHaveAttribute('decoding', 'async');
});

test('performance enhancements do not introduce horizontal overflow on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await page.goto('/');
  const dimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
});

test('technical SEO metadata stays consistent with demo noindex policy', async ({ page }) => {
  await page.goto('/');
  const metadata = await page.evaluate(() => {
    const schema = [...document.querySelectorAll('script[type="application/ld+json"]')]
      .map(node => JSON.parse(node.textContent));
    return {
      lang: document.documentElement.lang,
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content,
      robots: document.querySelector('meta[name="robots"]')?.content,
      canonical: document.querySelector('link[rel="canonical"]')?.href,
      ogUrl: document.querySelector('meta[property="og:url"]')?.content,
      ogImage: document.querySelector('meta[property="og:image"]')?.content,
      schema
    };
  });
  expect(metadata.lang).toBe('ru');
  expect(metadata.title).toMatch(/Вера Ланская/);
  expect(metadata.description.length).toBeGreaterThan(50);
  expect(metadata.robots).toBe('noindex,follow');
  expect(metadata.canonical).toBe('https://marcostavar24633-cyber.github.io/Photograf/');
  expect(metadata.ogUrl).toBe(metadata.canonical);
  expect(metadata.ogImage).toMatch(/^https:\/\//);
  expect(metadata.schema.some(item => item['@type'] === 'WebSite' && item.url === metadata.canonical)).toBe(true);
  expect(await page.locator('head').textContent()).not.toContain('\\n<link');
  const robotsTxt = await page.request.get('/robots.txt');
  expect(robotsTxt.ok()).toBe(true);
  expect(await robotsTxt.text()).toContain('Sitemap: https://marcostavar24633-cyber.github.io/Photograf/sitemap.xml');
  const sitemapXml = await page.request.get('/sitemap.xml');
  expect(sitemapXml.ok()).toBe(true);
  expect(await sitemapXml.text()).not.toContain('/privacy.html');
});

test('conversion copy never implies a customer endorsement or completed submission', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('.plan--hot .badge')).toHaveText('Средний формат');
  await expect(page.locator('#submitBtn')).toContainText('Подготовить сообщение');
  await page.locator('#f-name').fill('Мария');
  await page.locator('#f-phone').fill('@maria_photo');
  await page.locator('#f-agree').check();
  await page.locator('#submitBtn').click();
  await expect(page.locator('.form-ok h3')).toHaveText('Текст заявки подготовлен');
  await expect(page.locator('#formResultMessage')).toContainText('Заявка не отправлена');
  await expect(page.locator('#formResultMessage')).toContainText('отправьте самостоятельно');
  await expect(page.locator('#submitBtn')).not.toHaveAttribute('data-goal','form_submit');
  await expect(page.locator('#messagePreview')).toContainText('Имя: Мария');
});


test('responsive layout stays within the viewport across common device widths', async ({ page }) => {
  const widths = [320, 360, 375, 390, 414, 768, 900, 1024, 1280, 1440];
  for (const width of widths) {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/');
    const layout = await page.evaluate(() => {
      const overflow = [...document.querySelectorAll('body *')]
        .filter(el => {
          const style = getComputedStyle(el);
          if (style.position === 'fixed' || style.position === 'absolute' || style.display === 'none') return false;
          const rect = el.getBoundingClientRect();
          return rect.width > 0 && (rect.left < -1 || rect.right > document.documentElement.clientWidth + 1);
        })
        .slice(0, 12)
        .map(el => ({tag:el.tagName, id:el.id, className:typeof el.className === 'string' ? el.className : '', left:Math.round(el.getBoundingClientRect().left), right:Math.round(el.getBoundingClientRect().right)}));
      return {
        viewport: document.documentElement.clientWidth,
        document: document.documentElement.scrollWidth,
        offenders: overflow
      };
    });
    expect(layout.document, `horizontal overflow at ${width}px: ${JSON.stringify(layout.offenders)}`).toBeLessThanOrEqual(layout.viewport);
    await expect(page.locator('#hdr')).toBeVisible();
    await expect(page.locator('#book')).toBeAttached();
  }
});

test('all local portfolio images load after lazy sections are brought into view', async ({ page }) => {
  await page.goto('/');
  const images = page.locator('#portfolio .g-item img');
  const count = await images.count();
  expect(count).toBeGreaterThan(10);
  for (let i = 0; i < count; i++) {
    const image = images.nth(i);
    await image.scrollIntoViewIfNeeded();
    await expect.poll(() => image.evaluate(img => img.complete && img.naturalWidth > 0), { timeout: 10000 }).toBe(true);
  }
});

test('lead form validation exposes errors and moves keyboard focus to the first invalid field', async ({ page }) => {
  await page.goto('/');
  await page.locator('#submitBtn').click();
  await expect(page.locator('#f-name')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#f-phone')).toHaveAttribute('aria-invalid', 'true');
  await expect(page.locator('#f-name')).toBeFocused();
  await expect(page.locator('#err-name')).toBeVisible();
});


test('images declare responsive dimensions and use intentional loading priorities', async ({ page }) => {
  await page.goto('/');
  const imageAudit = await page.evaluate(() => {
    const images = [...document.images].filter(img => img.id !== 'lbImg');
    const hero = document.querySelector('.hero-slide.is-active img');
    const galleryImages = [...document.querySelectorAll('#gallery img')];
    return {
      imagesMissingDimensions: images.filter(img => !img.hasAttribute('width') || !img.hasAttribute('height')).map(img => img.getAttribute('src')),
      galleryNotLazy: galleryImages.filter(img => img.loading !== 'lazy').map(img => img.getAttribute('src')),
      galleryMissingSrcset: galleryImages.filter(img => !img.srcset).map(img => img.getAttribute('src')),
      heroPriority: hero?.getAttribute('fetchpriority'),
      heroLoading: hero?.getAttribute('loading'),
      heroDecoding: hero?.getAttribute('decoding')
    };
  });
  expect(imageAudit.imagesMissingDimensions).toEqual([]);
  expect(imageAudit.galleryNotLazy).toEqual([]);
  expect(imageAudit.galleryMissingSrcset).toEqual([]);
  expect(imageAudit.heroPriority).toBe('high');
  expect(imageAudit.heroLoading).not.toBe('lazy');
  expect(imageAudit.heroDecoding).toBe('async');
});


test('lightbox keyboard controls keep focus contained and restore it on close', async ({ page }) => {
  await page.goto('/');
  const opener = page.locator('#gallery .g-btn').first();
  await opener.click();
  const dialog = page.locator('#lb');
  await expect(dialog).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#lbClose')).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(page.locator('#lbNext')).toBeFocused();
  await page.keyboard.press('Tab');
  await expect(page.locator('#lbClose')).toBeFocused();

  const initialIndex = await dialog.getAttribute('data-view-index');
  await page.keyboard.press('ArrowRight');
  await expect(dialog).not.toHaveAttribute('data-view-index', initialIndex);
  await page.keyboard.press('ArrowLeft');
  await expect(dialog).toHaveAttribute('data-view-index', initialIndex);

  await page.keyboard.press('Escape');
  await expect(dialog).toHaveAttribute('aria-hidden', 'true');
  await expect(opener).toBeFocused();
});

test('lightbox remains usable on a small touch viewport and loads the selected full image eagerly', async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 720 });
  await page.goto('/');
  const opener = page.locator('#gallery .g-btn').first();
  await opener.scrollIntoViewIfNeeded();
  await opener.click();
  const dialog = page.locator('#lb');
  await expect(dialog).toHaveAttribute('aria-hidden', 'false');
  await expect(page.locator('#lbImg')).toHaveAttribute('loading', 'eager');
  await expect(page.locator('#lbClose')).toBeVisible();
  await expect(page.locator('#lbPrev')).toBeVisible();
  await expect(page.locator('#lbNext')).toBeVisible();

  const controls = await page.evaluate(() => ['#lbClose','#lbPrev','#lbNext'].map(selector => {
    const rect = document.querySelector(selector).getBoundingClientRect();
    return {left:rect.left,right:rect.right,top:rect.top,bottom:rect.bottom};
  }));
  for (const rect of controls) {
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.right).toBeLessThanOrEqual(320);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.bottom).toBeLessThanOrEqual(720);
  }
  await page.locator('#lbClose').click();
  await expect(dialog).toHaveAttribute('aria-hidden', 'true');
});

test('privacy notice is reachable, readable and accessible on desktop and mobile', async ({ page }) => {
  const AxeBuilder = require('@axe-core/playwright').default;
  await page.goto('/privacy.html');
  await expect(page).toHaveTitle(/Конфиденциальность/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Уведомление о конфиденциальности');
  await expect(page.getByRole('link', { name: /Вернуться на главную/ })).toHaveAttribute('href', 'index.html');
  await expect(page.locator('body')).toContainText('Сайт не отправляет');
  await expect(page.locator('body')).toContainText('GitHub Pages');
  const desktopAudit = await new AxeBuilder({ page })
    .withTags(['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'])
    .analyze();
  expect(desktopAudit.violations.map(v => ({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);

  for (const width of [320, 360, 390, 768]) {
    await page.setViewportSize({ width, height: 820 });
    const layout = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth
    }));
    expect(layout.document, `privacy page overflows at ${width}px`).toBeLessThanOrEqual(layout.viewport);
  }
});

test('all referenced local image variants and core stylesheets resolve', async ({ page, request }) => {
  await page.goto('/');
  const assets = await page.evaluate(() => {
    const urls = new Set();
    document.querySelectorAll('img[src],source[srcset]').forEach(el => {
      if (el.hasAttribute('src')) urls.add(el.getAttribute('src'));
      if (el.hasAttribute('srcset')) {
        el.getAttribute('srcset').split(',').forEach(candidate => {
          const url = candidate.trim().split(' ')[0];
          if (url) urls.add(url);
        });
      }
    });
    document.querySelectorAll('link[rel="stylesheet"][href],script[src]').forEach(el => {
      urls.add(el.getAttribute('href') || el.getAttribute('src'));
    });
    return [...urls].filter(url => url && !url.startsWith('//') && !url.startsWith('http:') && !url.startsWith('https:') && !url.startsWith('data:'));
  });
  const failures = [];
  for (const asset of assets) {
    const response = await request.get(new URL(asset, 'http://127.0.0.1:4173/').href);
    if (!response.ok()) failures.push({ asset, status: response.status() });
  }
  expect(failures).toEqual([]);
});

test('commercial calls to action lead to the booking form and preselect the chosen package', async ({ page }) => {
  await page.goto('/');
  const ctas = page.locator('a[data-goal], a[data-plan]');
  const count = await ctas.count();
  expect(count).toBeGreaterThan(5);
  for (let i = 0; i < count; i++) {
    const link = ctas.nth(i);
    const href = await link.getAttribute('href');
    expect(href, `CTA without a destination at index ${i}`).toBe('#book');
  }
  const plans = page.locator('.plans a[data-plan]');
  const planCount = await plans.count();
  expect(planCount).toBeGreaterThanOrEqual(3);
  for (let i = 0; i < planCount; i++) {
    const plan = plans.nth(i);
    const name = await plan.getAttribute('data-plan');
    await plan.click();
    await expect(page.locator('#f-plan')).toHaveValue(name);
  }
  await expect(page.locator('#book')).toBeInViewport();
});

test('every in-page navigation target exists and the privacy page is linked from the site', async ({ page }) => {
  await page.goto('/');
  const missing = await page.locator('a[href^="#"]').evaluateAll(nodes => {
    const targets = new Set([...document.querySelectorAll('[id]')].map(node => '#' + node.id));
    return [...new Set(nodes.map(node => node.getAttribute('href'))
      .filter(href => href && href.length > 1 && !targets.has(href)))];
  });
  expect(missing).toEqual([]);
  const privacyLinks = page.locator('a[href="privacy.html"]');
  await expect(privacyLinks).toHaveCount(2);
  for (let i = 0; i < await privacyLinks.count(); i++) {
    await expect(privacyLinks.nth(i)).toHaveAttribute('href', 'privacy.html');
  }
});
