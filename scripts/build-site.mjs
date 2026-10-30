import { build, createServer } from 'vite';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { guides } from '../src/seo/content.js';
import { homePath, guidePath, basePath } from '../src/seo/site.js';
import { renderDocument, sitemap } from '../src/seo/metadata.js';
import { readTemplate } from '../src/templates.js';
import { validateComparison } from '../src/comparison.js';
import { simulate } from '../src/session-report.js';

const root = fileURLToPath(new URL('../', import.meta.url));
await build({ root });
const shell = await readFile(resolve(root, 'dist/index.html'), 'utf8');
const server = await createServer({ root, server: { middlewareMode: true }, appType: 'custom' });
async function output(path, text) {
  const destination = resolve(root, 'dist', path);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, text);
}
try {
  const { render } = await server.ssrLoadModule('/src/entry-static.js');
  for (const language of ['en', 'zh']) {
    await output(homePath(language).slice(basePath.length) + 'index.html', renderDocument(shell, await render(language), language));
  }
  for (const guide of guides) {
    const raw = JSON.parse(await readFile(resolve(root, 'src/config/default-template', guide.slug + '.json'), 'utf8'));
    const template = readTemplate(raw, guide.en.title);
    const errors = validateComparison(template.config);
    if (Object.keys(errors).length) throw new Error(guide.slug + ': ' + JSON.stringify(errors));
    const results = simulate(template.config);
    for (const language of ['en', 'zh']) {
      const body = await render(language, { guide, template, results });
      await output(guidePath(guide.slug, language).slice(basePath.length) + 'index.html', renderDocument(shell, body, language, guide.slug));
    }
    await output('examples/' + guide.slug + '.json', JSON.stringify(template, null, 2) + '\n');
  }
  await output('sitemap.xml', sitemap());
  // A robots.txt inside a GitHub project subdirectory has no crawling authority.
  // Submit the project sitemap directly to Search Console instead.
  await output('.nojekyll', '');
  console.log('Generated 2 homepages, 12 strategy guides, 6 downloadable templates and sitemap.xml.');
} finally {
  await server.close();
}
