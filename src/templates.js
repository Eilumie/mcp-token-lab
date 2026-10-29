import { readComparisonConfig } from './comparison.js';

export function createTemplate(config, name, description = '') {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new Error('模板名称需为 1–100 个字符');
  if (typeof description !== 'string' || description.length > 1000) throw new Error('模板介绍不能超过 1000 个字符');
  return {
    type: 'token-lab-template', version: 1, name: name.trim(), description: description.trim(),
    config: readComparisonConfig(JSON.parse(JSON.stringify(config))),
  };
}

export function readTemplate(data, fallbackName = '自定义模板') {
  if (data?.type === 'token-lab-template') {
    if (data.version !== 1) throw new Error('不支持的模板版本');
    return createTemplate(data.config, data.name, data.description ?? '');
  }
  return createTemplate(readComparisonConfig(data), fallbackName, data?.description ?? '');
}

// Discovery belongs to Vite's JSON registry; normalization also runs in Node tests.
export function createBuiltinTemplates(sources) {
  return Object.entries(sources).sort(([a], [b]) => a.localeCompare(b, 'en')).map(([path, data]) => {
    const key = path.replace(/^\.\//, '').replace(/\.json$/i, '');
    const fallbackName = key.split('/').at(-1).slice(0, 100);
    try {
      return { ...readTemplate(data, data?.name ?? fallbackName), id: 'builtin-' + key };
    } catch (error) {
      throw new Error('默认模板 ' + path + '：' + error.message, { cause: error });
    }
  });
}

export function createDefaultConfig(sources) {
  const first = createBuiltinTemplates(sources).filter(item => item.id === 'builtin-progressive-tool-no-compress')[0];
  if (!first) throw new Error('未配置默认模板');
  return first.config;
}
