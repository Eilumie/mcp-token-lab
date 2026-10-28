import test from 'node:test';
import assert from 'node:assert/strict';
import { reactive } from 'vue';
import { createComparisonConfig, createPlan, readComparisonConfig, resolvePlan, validateComparison } from './comparison.js';
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

test('legacy config files still import as custom templates and descriptions remain optional', () => {
  const config = createComparisonConfig();
  config.plans.forEach(plan => delete plan.description);
  const template = readTemplate(config, '旧配置');
  assert.equal(template.name, '旧配置');
  assert.deepEqual(template.config, config);
  assert.deepEqual(readComparisonConfig(config), config);
});

test('invalid template metadata and invalid plan descriptions are rejected', () => {
  const config = createComparisonConfig();
  assert.throws(() => createTemplate(config, ' '), /模板名称/);
  assert.throws(() => createTemplate(config, 'a'.repeat(101)), /模板名称/);
  assert.throws(() => createTemplate(config, 'test', 'a'.repeat(1001)), /模板介绍/);
  assert.throws(() => readTemplate({ type: 'token-lab-template', version: 2 }), /模板版本/);
  assert.throws(() => readTemplate({ type: 'token-lab-template', version: 1, name: 'test', config: {} }), /v4/);
  for (const description of [42, {}, 'a'.repeat(1001)]) {
    config.plans[0].description = description;
    assert.throws(() => readComparisonConfig(config), /方案说明/);
  }
});

test('built-in templates have runnable, independent plans with effective strategy differences', () => {
  const templates = createBuiltinTemplates();
  for (const template of templates) {
    assert.ok(template.name && template.description);
    assert.ok(template.config.plans.every(plan => plan.description));
    assert.deepEqual(validateComparison(template.config), {});
    const config = structuredClone(template.config);
    config.globalSimulation.turnTotalCount = 25;
    const results = simulate(config);
    assert.equal(results.length, config.plans.length);
    assert.ok(results.every(result => Number.isFinite(result.cost.total)));
    assert.ok(new Set(results.map(result => result.cost.total)).size > 1);
  }
  const cache = templates[1].config;
  assert.deepEqual(cache.plans.map(plan => resolvePlan(plan, cache.globalSimulation).simulation.expectedPrefixCacheHitRate), [0, 0.5, 0.9]);
  const compression = templates[2].config;
  assert.deepEqual(compression.plans.map(plan => resolvePlan(plan, compression.globalSimulation).simulation.compressionThresholdTurnCount), [5, 10, 20]);
  templates[0].config.plans[0].description = 'edited';
  assert.notEqual(createBuiltinTemplates()[0].config.plans[0].description, 'edited');
});
