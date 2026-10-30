import { guides } from './content.js';
import { homeMetadata, pageUrl, siteUrl } from './site.js';
export function metadata(language, slug) {
  const guide = slug ? guides.find(item => item.slug === slug) : null;
  if (slug && !guide) throw new Error('Unknown guide: ' + slug);
  const copy = guide ? guide[language] : homeMetadata[language];
  const title = guide ? copy.title + ' | MCP Token Lab' : copy.title;
  const url = pageUrl(language, slug);
  const structuredData = guide ? {
    '@context': 'https://schema.org', '@type': 'TechArticle', headline: copy.title,
    description: copy.description, inLanguage: language === 'zh' ? 'zh-CN' : 'en',
    url, mainEntityOfPage: url, isPartOf: { '@type': 'WebSite', name: 'MCP Token Lab', url: siteUrl },
  } : {
    '@context': 'https://schema.org', '@type': 'WebApplication', name: 'MCP Token Lab',
    url, description: copy.description, inLanguage: language === 'zh' ? 'zh-CN' : 'en',
    applicationCategory: 'DeveloperApplication', operatingSystem: 'Any', browserRequirements: 'JavaScript enabled for the interactive calculator',
    isAccessibleForFree: true, offers: { '@type': 'Offer', price: '0', priceCurrency: 'USD' },
  };
  return { title, description: copy.description, url, language, slug, structuredData };
}
export const escapeHtml = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const jsonLd = data => JSON.stringify(data).replaceAll('<', '\\u003c');
export function headMarkup(meta) {
  const image = new URL('social-preview.png', siteUrl).href;
  return [
    `<link rel="canonical" href="${escapeHtml(meta.url)}" />`,
    ...[['en', 'en'], ['zh', 'zh-CN'], ['en', 'x-default']].map(([language, tag]) => `<link rel="alternate" hreflang="${tag}" href="${pageUrl(language, meta.slug)}" />`),
    `<meta property="og:type" content="${meta.slug ? 'article' : 'website'}" />`,
    '<meta property="og:site_name" content="MCP Token Lab" />',
    `<meta property="og:title" content="${escapeHtml(meta.title)}" />`,
    `<meta property="og:description" content="${escapeHtml(meta.description)}" />`,
    `<meta property="og:url" content="${meta.url}" />`,
    `<meta property="og:locale" content="${meta.language === 'zh' ? 'zh_CN' : 'en_US'}" />`,
    `<meta property="og:locale:alternate" content="${meta.language === 'zh' ? 'en_US' : 'zh_CN'}" />`,
    `<meta property="og:image" content="${image}" />`,
    '<meta property="og:image:width" content="1200" />',
    '<meta property="og:image:height" content="630" />',
    '<meta property="og:image:alt" content="MCP Token Lab — MCP Token Calculator and Agent Cost Simulator" />',
    '<meta name="twitter:card" content="summary_large_image" />',
    `<meta name="twitter:title" content="${escapeHtml(meta.title)}" />`,
    `<meta name="twitter:description" content="${escapeHtml(meta.description)}" />`,
    `<meta name="twitter:image" content="${image}" />`,
    `<script type="application/ld+json" id="page-structured-data">${jsonLd(meta.structuredData)}</script>`,
  ].join('\n    ');
}
export function renderDocument(shell, body, language, slug) {
  const meta = metadata(language, slug);
  if (!shell.includes('<!--app-html-->') || !shell.includes('<!--seo-head-->')) throw new Error('Missing static rendering placeholders');
  let html = shell
    .replace(/<html lang="[^"]*">/, `<html lang="${language === 'zh' ? 'zh-CN' : 'en'}">`)
    .replace(/<title>[\s\S]*?<\/title>/, `<title>${escapeHtml(meta.title)}</title>`)
    .replace(/<meta name="description" content="[^"]*"\s*\/>/, `<meta name="description" content="${escapeHtml(meta.description)}" />`)
    .replace('<!--seo-head-->', headMarkup(meta))
    .replace('<!--app-html-->', body);
  // Guides are complete static documents and do not load the calculator bundle.
  if (slug) html = html.replace(/\s*<script type="module"[^>]*><\/script>/g, '');
  return html;
}
export function updateHomeMetadata(language) {
  const meta = metadata(language);
  document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
  document.title = meta.title;
  const set = (selector, attribute, value) => document.querySelector(selector)?.setAttribute(attribute, value);
  set('meta[name="description"]', 'content', meta.description);
  set('link[rel="canonical"]', 'href', meta.url);
  for (const [lang, tag] of [['en', 'en'], ['zh', 'zh-CN'], ['en', 'x-default']]) set(`link[hreflang="${tag}"]`, 'href', pageUrl(lang));
  for (const prefix of ['og', 'twitter']) {
    set(`meta[${prefix === 'og' ? 'property' : 'name'}="${prefix}:title"]`, 'content', meta.title);
    set(`meta[${prefix === 'og' ? 'property' : 'name'}="${prefix}:description"]`, 'content', meta.description);
  }
  set('meta[property="og:url"]', 'content', meta.url);
  set('meta[property="og:locale"]', 'content', language === 'zh' ? 'zh_CN' : 'en_US');
  set('meta[property="og:locale:alternate"]', 'content', language === 'zh' ? 'en_US' : 'zh_CN');
  const data = document.getElementById('page-structured-data');
  if (data) data.textContent = jsonLd(meta.structuredData);
}
export function sitemap() {
  const paths = [undefined, ...guides.map(guide => guide.slug)];
  const entries = paths.flatMap(slug => ['en', 'zh'].map(language => `<url><loc>${pageUrl(language, slug)}</loc>${[['en', 'en'], ['zh', 'zh-CN'], ['en', 'x-default']].map(([lang, tag]) => `<xhtml:link rel="alternate" hreflang="${tag}" href="${pageUrl(lang, slug)}" />`).join('')}</url>`));
  return '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + entries.join('\n') + '\n</urlset>\n';
}
