import test from 'node:test';
import assert from 'node:assert/strict';
import { parseHTML } from 'linkedom';
import { guides } from './seo/content.js';
import { homePath, pageUrl, languageFromPath } from './seo/site.js';
import { metadata, renderDocument, sitemap } from './seo/metadata.js';

const shell = '<!doctype html><html lang="en"><head><meta name="description" content="old" /><title>Old</title><!--seo-head--><script type="module" src="/mcp-token-lab/assets/app.js"></script></head><body><div id="app"><!--app-html--></div></body></html>';
test('static documents expose localized content and reciprocal canonical metadata before JavaScript', () => {
  for (const slug of [undefined, ...guides.map(item => item.slug)]) {
    for (const language of ['en', 'zh']) {
      const { document } = parseHTML(renderDocument(shell, '<h1>Visible content</h1>', language, slug));
      assert.equal(document.title, metadata(language, slug).title);
      assert.equal(document.querySelector('h1').textContent, 'Visible content');
      assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'), pageUrl(language, slug));
      assert.equal(document.querySelector('link[hreflang="zh-CN"]').getAttribute('href'), pageUrl('zh', slug));
      assert.equal(document.querySelectorAll('script[type="module"]').length, slug ? 0 : 1);
      assert.ok(!document.querySelector('script[type="application/ld+json"]').textContent.includes('aggregateRating'));
    }
  }
});
test('language routes and sitemap cover both homepages and every guide', () => {
  assert.equal(languageFromPath(homePath('zh')), 'zh');
  assert.equal(languageFromPath(homePath('en')), 'en');
  assert.equal((sitemap().match(/<loc>/g) || []).length, 2 * (guides.length + 1));
  assert.throws(() => metadata('en', 'unknown'), /Unknown guide/);
});
test('language switching preserves query and fragment while metadata follows URL and browser history', async t => {
  const saved = new Map(['window', 'document', 'location', 'history', 'localStorage'].map(key => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  t.after(() => { for (const [key, descriptor] of saved) descriptor ? Object.defineProperty(globalThis, key, descriptor) : delete globalThis[key]; });
  const { document } = parseHTML(renderDocument(shell, '<h1>Test</h1>', 'zh'));
  globalThis.document = document;
  globalThis.window = new EventTarget();
  globalThis.location = new URL('https://eilumie.github.io/mcp-token-lab/zh/?template=tool-search#global-settings');
  globalThis.localStorage = { getItem: () => 'en' };
  globalThis.history = { pushState(_state, _title, path) { globalThis.location = new URL(path, globalThis.location); } };
  const { locale, setLocale } = await import('./i18n.js');
  assert.equal(locale.value, 'zh', 'explicit URL overrides saved language');
  setLocale('en');
  assert.equal(location.pathname, homePath('en'));
  assert.equal(location.search, '?template=tool-search');
  assert.equal(location.hash, '#global-settings');
  assert.equal(document.title, metadata('en').title);
  assert.equal(document.querySelector('link[rel="canonical"]').getAttribute('href'), pageUrl('en'));
  globalThis.location = new URL('https://eilumie.github.io/mcp-token-lab/zh/?template=tool-search#global-settings');
  window.dispatchEvent(new Event('popstate'));
  assert.equal(locale.value, 'zh');
  assert.equal(document.documentElement.lang, 'zh-CN');
  assert.equal(document.title, metadata('zh').title);
});
