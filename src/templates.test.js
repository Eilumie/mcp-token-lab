import test from 'node:test';
import assert from 'node:assert/strict';
import { reactive } from 'vue';
import { readdirSync, readFileSync } from 'node:fs';
import { createComparisonConfig, createPlan, readComparisonConfig, validateComparison } from './comparison.js';
import { createBuiltinTemplates, createTemplate, readTemplate } from './templates.js';
import { simulate } from './session-report.js';

test('template export/import preserves metadata, plan descriptions, and current configuration', () => {
  const config = createComparisonConfig();
  config.plans[0].description = '按需加载\n减少初始上下文';
  config.globalSimulation.variables = { retrievalToken: { label: '检索', value: 2 } };
  const before = structuredClone(config);
  const exported = createTemplate(reactive(config), ' 自定义实验 ', ' 两套策略 ');
  assert.equal(exported.name, '自定义实验');
  assert.equal(exported.description, '两套策略');
  assert.deepEqual(readTemplate(JSON.parse(JSON.stringify(exported))), exported);
  assert.deepEqual(exported.config, config);
  exported.config.plans[0].description = '修改';
  assert.deepEqual(config, before);
  assert.equal(createPlan({ source: config.plans[0] }).description, config.plans[0].description);
});

test('current config files import as custom templates and descriptions remain optional', () => {
  const config = createComparisonConfig();
  config.plans.forEach(plan => delete plan.description);
  const template = readTemplate(config, '当前配置');
  assert.equal(template.name, '当前配置');
  assert.deepEqual(template.config, config);
  assert.deepEqual(readComparisonConfig(config), config);
  for (const version of [2, 3]) {
    const previous = { ...config, version };
    assert.throws(() => readTemplate(previous), /当前多方案配置/);
    assert.throws(() => readTemplate({ type: 'token-lab-template', version: 1, name: '旧格式', config: previous }), /当前多方案配置/);
  }
});

test('invalid template metadata and invalid plan descriptions are rejected', () => {
  const config = createComparisonConfig();
  assert.throws(() => createTemplate(config, ' '), /模板名称/);
  assert.throws(() => createTemplate(config, 'a'.repeat(101)), /模板名称/);
  assert.throws(() => createTemplate(config, 'test', 'a'.repeat(1001)), /模板介绍/);
  assert.throws(() => readTemplate({ type: 'token-lab-template', version: 2 }), /模板版本/);
  assert.throws(() => readTemplate({ type: 'token-lab-template', version: 1, name: 'test', config: {} }), /当前多方案配置/);
  for (const description of [42, {}, 'a'.repeat(1001)]) {
    config.plans[0].description = description;
    assert.throws(() => readComparisonConfig(config), /方案说明/);
  }
});

const defaultTemplateDirectory = new URL('./config/default-template/', import.meta.url);
function defaultTemplateSources() {
  return Object.fromEntries(readdirSync(defaultTemplateDirectory, { recursive: true })
    .filter(file => file.endsWith('.json'))
    .map(file => ['./' + file, JSON.parse(readFileSync(new URL(file, defaultTemplateDirectory), 'utf8'))]));
}

test('all default JSON templates load in filename order and run with independent configurations', () => {
  const sources = defaultTemplateSources();
  const before = structuredClone(sources);
  const templates = createBuiltinTemplates(sources);
  assert.ok(templates.length > 0);
  assert.equal(templates.length, Object.keys(sources).length);
  const paths = Object.keys(sources).sort((a, b) => a.localeCompare(b, 'en'));
  assert.deepEqual(templates.map(template => template.id), paths.map(path => 'builtin-' + path.slice(2, -5)));
  assert.equal(new Set(templates.map(template => template.id)).size, templates.length);
  for (const [index, template] of templates.entries()) {
    assert.ok(template.name && template.description);
    assert.deepEqual(template.config, readComparisonConfig(sources[paths[index]]));
    assert.equal(template.description, sources[paths[index]].description);
    assert.deepEqual(validateComparison(template.config), {});
    const config = structuredClone(template.config);
    config.globalSimulation.turnTotalCount = 25;
    const results = simulate(config);
    assert.equal(results.length, config.plans.length);
    assert.ok(results.every(result => Number.isFinite(result.cost.total)));
  }
  templates[0].config.plans[0].description = 'edited';
  assert.notEqual(createBuiltinTemplates(sources)[0].config.plans[0].description, 'edited');
  assert.deepEqual(sources, before);
});

test('new JSON entries and nested templates load without changing an import list', () => {
  const config = createComparisonConfig();
  const sources = {
    './nested/extra.json': createTemplate(config, '新增模板', '完整模板格式'),
    './01-config.json': { ...config, description: '普通配置格式' },
  };
  const templates = createBuiltinTemplates(sources);
  assert.deepEqual(templates.map(template => template.id), ['builtin-01-config', 'builtin-nested/extra']);
  assert.deepEqual(templates.map(template => template.name), ['01-config', '新增模板']);
  assert.deepEqual(templates.map(template => template.description), ['普通配置格式', '完整模板格式']);
  assert.deepEqual(createBuiltinTemplates({}), []);
  assert.throws(() => createBuiltinTemplates({ './broken.json': {} }), /默认模板 \.\/broken\.json/);
});
