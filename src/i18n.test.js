import test from 'node:test';
import assert from 'node:assert/strict';
import { locale, translateUi } from './i18n.js';
import { createComparisonConfig } from './comparison.js';
import { simulate } from './session-report.js';
import { trendOption } from './charts.js';
import { createBuiltinTemplates } from './templates.js';

test('template descriptions and controls translate completely, including turn counts', () => {
  try {
    locale.value = 'en';
    for (const template of createBuiltinTemplates()) {
      for (const text of [template.name, template.description, ...template.config.plans.flatMap(plan => [plan.name, plan.description])]) {
        assert.doesNotMatch(translateUi(text), /[\u4e00-\u9fff]/);
      }
    }
    assert.equal(translateUi('导入自定义模板'), 'Import custom template');
    assert.equal(translateUi('方案说明'), 'Plan description');
  } finally { locale.value = 'zh'; }
});

test('display language changes without changing plan data or USD prices', () => {
  const config = createComparisonConfig();
  config.globalSimulation.turnTotalCount = 2;
  const original = JSON.stringify(config);
  const results = simulate(config);
  try {
    locale.value = 'en';
    assert.equal(translateUi('全局配置'), 'Global settings');
    assert.equal(translateUi('用户轮次请输入 1–1000数值'), 'User turns: Enter a finite number from 1 to 1000');
    assert.equal(translateUi('$12.50 USD'), '$12.50 USD');
    assert.equal(trendOption(results, 'cost', '$').series[0].name, 'Progressive Tools Schema');
    locale.value = 'zh';
    assert.equal(translateUi('全局配置'), '全局配置');
    assert.equal(trendOption(results, 'cost', '$').series[0].name, '渐进式Tools Schema');
    assert.equal(JSON.stringify(config), original);
  } finally { locale.value = 'zh'; }
});
