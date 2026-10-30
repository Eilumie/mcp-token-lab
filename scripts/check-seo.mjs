import assert from 'node:assert/strict';
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DOMParser, parseHTML } from 'linkedom';
import { guides, homeContent } from '../src/seo/content.js';
import { basePath, pagePath, pageUrl, siteUrl } from '../src/seo/site.js';
import { metadata } from '../src/seo/metadata.js';
import { readTemplate } from '../src/templates.js';
import { simulate } from '../src/session-report.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const dist = resolve(root, 'dist');
const origin = new URL(siteUrl).origin;
const entries = [undefined, ...guides.map(guide => guide.slug)].flatMap(slug => ['en', 'zh'].map(language => ({ language, slug })));
const titles = new Set();
for (const { language, slug } of entries) {
  const path = pagePath(language, slug);
  const file = resolve(dist, path.slice(basePath.length), 'index.html');
  const { document } = parseHTML(await readFile(file, 'utf8'));
  const meta = metadata(language, slug);
  const label = path + ': ';
  assert.equal(document.documentElement.lang, language === 'zh' ? 'zh-CN' : 'en', label + 'language');
  assert.equal(document.title, meta.title, label + 'title');
  assert.ok(!titles.has(document.title), label + 'unique title'); titles.add(document.title);
  assert.equal(document.querySelector('meta[name="description"]')?.content, meta.description, label + 'description');
  assert.equal(document.querySelectorAll('link[rel="canonical"]').length, 1, label + 'single canonical');
  assert.equal(document.querySelector('link[rel="canonical"]')?.getAttribute('href'), meta.url, label + 'canonical');
  for (const [lang, tag] of [['en', 'en'], ['zh', 'zh-CN'], ['en', 'x-default']]) {
    assert.equal(document.querySelector(`link[hreflang="${tag}"]`)?.getAttribute('href'), pageUrl(lang, slug), label + tag);
  }
  assert.equal(document.querySelectorAll('h1').length, 1, label + 'single H1');
  assert.ok(document.querySelector('h1').textContent.length > 15, label + 'descriptive H1');
  assert.ok(!document.querySelector('meta[name="robots"]')?.content.includes('noindex'), label + 'indexable');
  assert.equal(document.querySelector('meta[property="og:url"]')?.content, meta.url, label + 'share URL');
  assert.equal(document.querySelector('meta[property="og:title"]')?.content, meta.title, label + 'share title');
  assert.equal(document.querySelector('meta[name="twitter:card"]')?.content, 'summary_large_image', label + 'share card');
  assert.deepEqual(JSON.parse(document.querySelector('script[type="application/ld+json"]').textContent), meta.structuredData, label + 'structured data');
  const guide = guides.find(item => item.slug === slug);
  if (guide) {
    assert.equal(document.querySelectorAll('script[type="module"]').length, 0, label + 'guides need no JavaScript');
    for (const paragraph of guide[language].paragraphs) assert.ok(document.body.textContent.includes(paragraph), label + 'visible substantive content');
    const template = readTemplate(JSON.parse(await readFile(resolve(dist, 'examples', slug + '.json'), 'utf8')));
    const expected = simulate(template.config);
    const rows = [...document.querySelectorAll('.article-table tbody tr')];
    assert.equal(rows.length, expected.length, label + 'all plans');
    for (const [index, row] of rows.entries()) assert.equal(row.querySelector('td').textContent, '$' + expected[index].cost.total.toFixed(4), label + 'reproducible costs');
  } else {
    assert.ok(document.body.textContent.includes(homeContent[language].intro), label + 'static introduction');
    assert.ok(document.body.textContent.includes(homeContent[language].method), label + 'static calculation method');
    assert.equal(document.querySelectorAll('.seo-cards a').length, guides.length, label + 'discoverable guides');
    assert.equal(document.querySelectorAll('script[type="module"]').length, 1, label + 'calculator entry');
    assert.ok(document.querySelector('meta[name="google-site-verification"]')?.content, label + 'Search Console verification');
  }
  for (const element of document.querySelectorAll('[href], [src]')) {
    const value = element.getAttribute('href') || element.getAttribute('src');
    if (!value || value.startsWith('data:')) continue;
    const url = new URL(value, meta.url);
    if (url.origin !== origin) continue;
    assert.ok(url.pathname.startsWith(basePath), label + 'project-relative asset: ' + value);
    const relative = url.pathname.slice(basePath.length);
    const target = resolve(dist, relative, url.pathname.endsWith('/') ? 'index.html' : '');
    assert.ok((await stat(target)).isFile(), label + 'existing target: ' + value);
  }
}
const xml = new DOMParser().parseFromString(await readFile(resolve(dist, 'sitemap.xml'), 'utf8'), 'text/xml');
assert.equal(xml.documentElement.localName, 'urlset');
assert.deepEqual(new Set([...xml.querySelectorAll('loc')].map(node => node.textContent)), new Set(entries.map(({ language, slug }) => pageUrl(language, slug))));
for (const node of xml.querySelectorAll('url')) assert.equal(node.querySelectorAll('xhtml\\:link').length, 3, 'sitemap language alternates');
const png = await readFile(resolve(dist, 'social-preview.png'));
assert.equal(png.readUInt32BE(16), 1200); assert.equal(png.readUInt32BE(20), 630);
console.log(`SEO checks passed: ${entries.length} static pages, reciprocal language URLs, metadata, links, assets, simulated results and sitemap.`);
