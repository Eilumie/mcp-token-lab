import test from 'node:test';
import assert from 'node:assert/strict';
import { createComparisonConfig, createPlan, resolvePlan, readComparisonConfig, validateComparison, deleteVariable, globalKeys } from './comparison.js';
import { validateVariables } from './variables.js';
import { formulaVariables, resolveStepToken } from './session-flow.js';
import { simulate } from './session-report.js';
import { getValue } from './config.js';
import Session from './session.js';

test('全部内置参数可继承，嵌套参数与独立覆盖不污染源方案', () => {
  const config = createComparisonConfig(), plan = config.plans[0];
  const before = structuredClone(plan);
  config.globalSimulation.initialContext.agentPromptToken = 12;
  config.globalSimulation.turnAvgToolsCount = .5;
  config.globalSimulation.compressionKeepTurns = 1;
  const resolved = resolvePlan(plan, config.globalSimulation);
  for (const key of globalKeys) assert.equal(getValue(resolved.simulation,key), getValue(config.globalSimulation,key));
  assert.deepEqual(plan, before);
  plan.useGlobal['initialContext.agentPromptToken'] = false;
  plan.simulation.initialContext.agentPromptToken = 7;
  assert.equal(resolvePlan(plan, config.globalSimulation).simulation.initialContext.agentPromptToken, 7);
  assert.equal(config.globalSimulation.initialContext.agentPromptToken, 12);
  assert.deepEqual(validateComparison(config), {});
});

test('自定义变量驱动公式与计费，新增方案继承，独立覆盖不随全局变化', () => {
  const config = createComparisonConfig();
  config.globalSimulation.variables.retrievalToken = {label:'检索长度',value:2};
  config.globalSimulation.turnTotalCount = 2;
  for (const plan of config.plans) plan.simulation.flow = { initial: [], turn: [
    {type:'action',text:'检索',token:'retrievalToken * 2'}, {type:'llm',text:'答复',token:1},
  ] };
  const plan = config.plans[1];
  plan.simulation.variables.retrievalToken = {label:'自定义检索',value:3};
  plan.useGlobal['variables.retrievalToken'] = false;
  const before = simulate(config);
  assert.equal(before[0].requests[0].input, 4);
  assert.equal(before[1].requests[0].input, 6);
  config.globalSimulation.variables.retrievalToken.value = 10;
  const after = simulate(config);
  assert.equal(after[0].requests[0].input, 20);
  assert.deepEqual(after[1],before[1]);
  assert.equal(resolvePlan(createPlan(),config.globalSimulation).simulation.variables.retrievalToken.value,10);
  assert.deepEqual(readComparisonConfig(JSON.parse(JSON.stringify(config))),config);
  assert.deepEqual(simulate(readComparisonConfig(config)),after);
});

test('仅方案内变量支持 JSON 导入，所有数值内置变量可进入公式，运行索引仍由引擎提供', () => {
  const config = createComparisonConfig(), plan = config.plans[0];
  plan.simulation.variables.localToken = {label:'本地内容',value:2.5};
  plan.useGlobal['variables.localToken'] = false;
  plan.simulation.flow.turn[0].token = 'localToken + compressionTargetToken + expectedPrefixCacheHitRate';
  assert.deepEqual(validateComparison(config),{});
  assert.deepEqual(readComparisonConfig(config),config);
  assert.equal(resolveStepToken(['localToken'],plan.simulation),2.5);
  assert.equal(resolveStepToken(plan.simulation.flow.turn[0].token,plan.simulation),7.4);
  assert.equal(formulaVariables({...plan.simulation,turnIndex:999},{turnIndex:2}).turnIndex,2);
});

test('旧配置新增字段保持独立，修改全局值不改变旧方案结果', () => {
  const config = createComparisonConfig();
  const oldKeys = ['turnTotalCount','skillsTotalCount','toolsTotalCount','expectedPrefixCacheHitRate','compressionThresholdType','compressionThresholdTurnCount','compressionThresholdToken'];
  config.globalSimulation = Object.fromEntries(oldKeys.map(key=>[key,getValue(config.globalSimulation,key)]));
  for (const plan of config.plans) {
    plan.useGlobal = Object.fromEntries([...oldKeys,'model'].map(key=>[key,true]));
    delete plan.simulation.variables;
  }
  config.plans[1].simulation.userMessageToken = 4;
  const before = simulate(config), snapshot = structuredClone(config);
  const restored = readComparisonConfig(config);
  assert.deepEqual(config,snapshot);
  assert.deepEqual(simulate(restored),before);
  restored.globalSimulation.initialContext.agentPromptToken = 99;
  restored.globalSimulation.userMessageToken = 88;
  assert.deepEqual(simulate(restored),before);
});

test('删除会报告公式中的实际引用，名称子串不误报，独立覆盖可保留', () => {
  const config = createComparisonConfig(), plan = config.plans[0];
  config.globalSimulation.variables.extra = {label:'扩展',value:2};
  config.globalSimulation.variables.extraLong = {label:'较长扩展',value:3};
  plan.simulation.flow.turn[0].token = 'extraLong + extra';
  assert.throws(()=>deleteVariable(config,'extra'),/变量仍被引用.*plan|变量仍被引用.*按需/);
  assert.ok(config.globalSimulation.variables.extra);
  plan.simulation.flow.turn[0].token = 'extraLong';
  deleteVariable(config,'extra');
  assert.equal(config.globalSimulation.variables.extra,undefined);
  plan.simulation.variables.extraLong = {label:'本地扩展',value:9};
  plan.useGlobal['variables.extraLong'] = false;
  deleteVariable(config,'extraLong');
  assert.equal(resolvePlan(plan,config.globalSimulation).simulation.variables.extraLong.value,9);
  assert.throws(()=>deleteVariable(config,'extraLong',plan),/仍被引用/);
  plan.simulation.flow.turn[0].token = 1;
  deleteVariable(config,'extraLong',plan);
  assert.deepEqual(validateComparison(config),{});
});

test('变量格式、保留名称、非有限数值及嵌套字段在 Session 和导入入口校验', () => {
  for (const variables of [null, [], 1, {x:{label:'x',value:-1}}, {x:{label:'x',value:Infinity}},
    {x:{label:'',value:1}}, {x:{label:'x',value:1,hidden:2}}, {Math:{label:'x',value:1}},
    {turnIndex:{label:'x',value:1}}, {agentResult:{label:'x',value:1}}, {'a.b':{label:'x',value:1}}, {break:{label:'x',value:1}},
    JSON.parse('{"__proto__":{"label":"x","value":1}}')]) {
    assert.throws(()=>validateVariables(variables));
    assert.throws(()=>new Session({variables}));
    const config = createComparisonConfig(); config.plans[0].simulation.variables = variables;
    assert.throws(()=>readComparisonConfig(config));
  }
  const config = createComparisonConfig(); config.globalSimulation.variables.bad = {label:'无效',value:''};
  assert.throws(()=>simulate(config));
  config.globalSimulation.variables = {};
  config.plans[0].useGlobal['variables.missing'] = true;
  assert.ok(validateComparison(config)['plans.0.useGlobal']);
});
