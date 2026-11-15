const { test, expect } = require('@playwright/test');

test('static-site security safeguards remain in place', async ({ page }) => {
  await page.goto('/');

  const audit = await page.evaluate(() => {
    const scripts = [...document.scripts];
    const executableCode = scripts
      .filter(script => !script.src && script.type !== 'application/ld+json')
      .map(script => script.textContent || '')
      .join('\n');
    const linkedScripts = scripts.filter(script => script.src).map(script => script.getAttribute('src'));
    const blankLinks = [...document.querySelectorAll('a[target="_blank"]')].map(link => ({
      href: link.getAttribute('href'),
      rel: (link.getAttribute('rel') || '').toLowerCase().split(/\s+/)
    }));
    const form = document.querySelector('#leadForm');
    return {
      referrer: document.querySelector('meta[name="referrer"]')?.content,
      linkedScripts,
      blankLinks,
      unsafeExecutors: /\beval\s*\(|\bnew\s+Function\s*\(|document\.write\s*\(/.test(executableCode),
      formAction: form?.getAttribute('action'),
      formMethod: (form?.getAttribute('method') || 'get').toLowerCase()
    };
  });

  expect(audit.referrer).toBe('strict-origin-when-cross-origin');
  expect(audit.linkedScripts.every(src => !/^https?:\/\//i.test(src))).toBe(true);
  expect(audit.blankLinks.every(link => link.rel.includes('noopener'))).toBe(true);
  expect(audit.unsafeExecutors).toBe(false);
  expect(audit.formAction).toBeNull();
  expect(audit.formMethod).toBe('get');
});
