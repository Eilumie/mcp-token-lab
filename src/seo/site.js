export const siteUrl = 'https://eilumie.github.io/mcp-token-lab/';
export const basePath = new URL(siteUrl).pathname;
export const homePath = language => basePath + (language === 'zh' ? 'zh/' : '');
export const guidePath = (slug, language) => homePath(language) + 'guides/' + slug + '/';
export const languageFromPath = path => path.startsWith(basePath + 'zh/') ? 'zh' : 'en';
export function pagePath(language, slug) { return slug ? guidePath(slug, language) : homePath(language); }
export function pageUrl(language, slug) { return new URL(pagePath(language, slug), siteUrl).href; }
export function guideFromPath(path) { return /\/guides\/([^/]+)\/?$/.exec(path)?.[1]; }
export const homeMetadata = {
  en: {
    title: 'MCP Token Calculator & Agent Cost Simulator | MCP Token Lab',
    description: 'Compare MCP tool loading, prompt caching and context compression. Simulate multi-turn agent token usage and estimated LLM costs in your browser. No API key needed.',
  },
  zh: {
    title: 'MCP Token 计算器与 Agent 成本模拟工具 | MCP Token Lab',
    description: '对比 MCP 工具全量加载、渐进式 Schema、Tool Search、缓存与上下文压缩策略，模拟多轮 Agent 的 Token 用量和 LLM 预估费用。浏览器本地计算，无需 API Key。',
  },
};
