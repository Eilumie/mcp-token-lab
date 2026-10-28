import test from 'node:test';
import assert from 'node:assert/strict';
import { descriptionReferences, descriptionVariables, renderPlanDescription } from './plan-description.js';
import { createComparisonConfig, deleteVariable, readComparisonConfig, resolvePlanDescription } from './comparison.js';
import { createTemplate, readTemplate } from './templates.js';

test('说明替换内置、嵌套、自定义和零值变量，保留普通文本与未知占位符', () => {
  const simulation = { toolsTotalCount: 12, initialContext: { agentPromptToken: 1.25 }, variables: { extra: { label: '扩展', value: 0 } } };
  const text = '工具 {{toolsTotalCount}} / {{ toolsTotalCount }}\n提示 {{initialContext.agentPromptToken}} K；扩展 {{extra}}；{{missing}}';
  assert.equal(renderPlanDescription(text, simulation), '工具 12 / 12\n提示 1.25 K；扩展 0；{{missing}}');
  assert.deepEqual(descriptionReferences(text), ['toolsTotalCount', 'initialContext.agentPromptToken', 'extra', 'missing']);
  assert.equal(renderPlanDescription(undefined, simulation), '');
  assert.equal(renderPlanDescription('普通说明', simulation), '普通说明');
});

test('说明跟随全局继承与方案独立覆盖，不修改原文，模板往返保留引用', () => {
  const config = createComparisonConfig(), [inherited, custom] = config.plans;
  config.globalSimulation.toolsTotalCount = 17;
  config.globalSimulation.variables.extra = { label: '扩展', value: 2.5 };
  for (const plan of config.plans) plan.description = '{{toolsTotalCount}} 个工具，{{extra}} K';
  custom.useGlobal.toolsTotalCount = false;
  custom.simulation.toolsTotalCount = 9;
  custom.useGlobal['variables.extra'] = false;
  custom.simulation.variables.extra = { label: '独立扩展', value: 0 };
  assert.equal(resolvePlanDescription(inherited, config.globalSimulation), '17 个工具，2.5 K');
  assert.equal(resolvePlanDescription(custom, config.globalSimulation), '9 个工具，0 K');
  config.globalSimulation.toolsTotalCount = 20;
  config.globalSimulation.variables.extra.value = 3;
  assert.equal(resolvePlanDescription(inherited, config.globalSimulation), '20 个工具，3 K');
  assert.equal(resolvePlanDescription(custom, config.globalSimulation), '9 个工具，0 K');
  assert.equal(readComparisonConfig(config).plans[0].description, inherited.description);
  assert.equal(readTemplate(createTemplate(config, '动态说明', '测试')).config.plans[0].description, inherited.description);
});

test('说明只读取可用配置数值，不解释脚本或访问原型，删除的参数保留占位符', () => {
  const config = createComparisonConfig(), plan = config.plans[0];
  plan.description = '{{toolsTotalCount}} {{constructor}} {{Math.random()}} {{extra + 1}}';
  config.globalSimulation.removedFields = ['toolsTotalCount'];
  assert.equal(resolvePlanDescription(plan, config.globalSimulation), plan.description);
  assert.ok(!descriptionVariables({ toolsTotalCount: Infinity, variables: { extra: { label: '扩展', value: '' } } }).length);
});

test('自定义变量在说明中的实际引用阻止删除，独立覆盖仍可保留', () => {
  const config = createComparisonConfig(), [inherited, custom] = config.plans;
  config.globalSimulation.variables.extra = { label: '扩展', value: 2 };
  inherited.description = '{{extra}}';
  assert.throws(() => deleteVariable(config, 'extra'), /变量仍被引用.*方案说明/);
  inherited.description = '{{extraLong}}';
  custom.description = '{{ extra }}';
  custom.useGlobal['variables.extra'] = false;
  custom.simulation.variables.extra = { label: '扩展', value: 3 };
  deleteVariable(config, 'extra');
  assert.equal(resolvePlanDescription(custom, config.globalSimulation), '3');
  assert.throws(() => deleteVariable(config, 'extra', custom), /方案说明/);
});
