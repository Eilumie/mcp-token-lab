# Search visibility and static publishing

The production site remains a Vue application hosted on GitHub Pages. `pnpm build` builds the calculator, then renders a static introduction and strategy guides using the same Vue components and content shown to visitors. No runtime server is required.

## Public pages

- English calculator: <https://eilumie.github.io/mcp-token-lab/>
- Chinese calculator: <https://eilumie.github.io/mcp-token-lab/zh/>
- English guides: `/mcp-token-lab/guides/<template-id>/`
- Chinese guides: `/mcp-token-lab/zh/guides/<template-id>/`
- Downloadable scenario files: `/mcp-token-lab/examples/<template-id>.json`
- Sitemap: <https://eilumie.github.io/mcp-token-lab/sitemap.xml>

The two homepages contain the introduction, calculation method, instructions, scenario links and FAQ in their HTML response. The interactive calculator replaces that initial view when JavaScript starts. The twelve guides are complete HTML documents and do not load the calculator JavaScript. Their tables are computed from the real simulator and built-in configurations at build time; figures are estimates under the saved pricing snapshots or illustrative rates, not live provider quotes.

Language is determined by the URL, not stored browser preferences. Language switching on the calculator updates the URL and metadata without discarding the current configuration; browser back/forward restores the matching language. Each page has a self canonical and reciprocal English, Chinese and x-default alternatives. Query-string template links use the clean homepage canonical.

## Editing and verification

- `src/seo/content.js`: bilingual descriptions, guides and FAQ.
- `src/seo/site.js`: production origin, base path and language routes.
- `src/seo/metadata.js`: canonical URLs, language alternatives, social metadata, JSON-LD and sitemap.
- `src/config/default-template/*.json`: authoritative simulation assumptions.
- `public/social-preview.png`: 1200 × 630 sharing image.
- `index.html`: Search Console ownership-verification tag; retain it after verification.

After edits, run:

```bash
pnpm test
pnpm build
pnpm check:seo
pnpm preview
```

The SEO check reads the actual built HTML. It checks static content, a single descriptive H1, metadata, reciprocal language links, local assets and destinations, downloadable templates, engine-derived costs, sitemap coverage and image dimensions. CI runs this check before uploading the Pages artifact. Preview and test under `/mcp-token-lab/`, including direct visits to nested guide and Chinese URLs.

## Google Search Console

Use the URL-prefix property `https://eilumie.github.io/mcp-token-lab/`. The verification tag belongs to the account used to register this property. After deployment, verify ownership and submit the full sitemap URL. Inspect both homepages and a representative guide with the live URL test, and request indexing for the homepages when available. Reporting and actual indexing can take time; submitting a sitemap does not guarantee ranking or inclusion.

A project-level `/mcp-token-lab/robots.txt` does not control crawling. Robots rules must be served at `https://eilumie.github.io/robots.txt`, which belongs to the account-root site, not this project. No such file is needed to allow crawling; submit the project sitemap directly in Search Console. Do not add a misleading nested robots file.

The JSON-LD describes the application and articles without inventing reviews, ratings or measured results. It does not claim eligibility for Google rich results.
