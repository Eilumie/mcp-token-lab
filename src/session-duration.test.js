import test from 'node:test';
import assert from 'node:assert/strict';
import { createComparisonConfig, createPlan, readComparisonConfig, validateComparison } from './comparison.js';
import { simulate, buildReport } from './session-report.js';
import Session from './session.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-9, `${actual} != ${expected}`);
const setup = (turnTotalCount = 4) => {
  const config = createComparisonConfig();
  config.globalSimulation.turnTotalCount = turnTotalCount;
  return config;
};

test('缺省节点耗时按类型累计，初始上下文不计入，LLM 输出不重复计时', () => {
  const config = setup();
  config.plans[0].simulation.flow.initial[0].durationSeconds = 999;
  const results = simulate(config);
  close(results[0].averageTurnDurationSeconds, 4 * 0.3 + 4 * 1.8);
  close(results[1].averageTurnDurationSeconds, 3 * 0.3 + 3 * 1.8);
  for (const result of results) {
    assert.equal(result.estimateDuration, true);
    result.rounds.forEach(round => close(round.durationSeconds, result.averageTurnDurationSeconds));
  }
});

test('自定义和零耗时独立生效，停用、0% 触发及间隔节点只计实际执行', () => {
  const config = setup();
  config.plans[0].simulation.flow.turn = [
    { type: 'action', text: '零耗时', token: 1, durationSeconds: 0 },
    { type: 'llm', text: '模型', token: 1, durationSeconds: 2.5 },
    { type: 'action', text: '工具', token: 1, durationSeconds: 4, trigger: { type: 'interval', value: 2 } },
    { type: 'action', text: '停用', token: 1, durationSeconds: 999, enabled: false },
    { type: 'llm', text: '不触发', token: 1, durationSeconds: 999, trigger: { type: 'probability', value: 0 } },
  ];
  const [result] = simulate(config);
  assert.deepEqual(result.rounds.map(round => round.durationSeconds), [2.5, 6.5, 2.5, 6.5]);
  close(result.averageTurnDurationSeconds, 4.5);
});

test('概率触发耗时与实际执行次数一致，不依赖 Token 长度', () => {
  const config = setup(100);
  config.globalSimulation.compressionThresholdTurnCount = 200;
  config.plans[0].simulation.flow.turn = [
    { type: 'llm', text: '概率模型', token: 0, durationSeconds: 3, trigger: { type: 'probability', value: 40 } },
  ];
  const [result] = simulate(config);
  assert.ok(result.requests.length > 0 && result.requests.length < 100);
  close(result.averageTurnDurationSeconds, result.requests.length * 3 / 100);
});

test('压缩耗时计入触发轮次，包括末轮和重复压缩，reset 不累积', () => {
  const config = setup(6);
  config.globalSimulation.compressionThresholdTurnCount = 2;
  config.globalSimulation.compressionKeepTurns = 0;
  const plan = config.plans[0];
  plan.simulation.flow.turn = [{ type: 'action', text: '工具', token: 1, durationSeconds: 0.5 }];
  const [result] = simulate(config);
  assert.deepEqual(result.rounds.map(round => round.durationSeconds), [0.5, 2.3, 0.5, 2.3, 0.5, 2.3]);
  close(result.averageTurnDurationSeconds, 1.4);
  const session = new Session({ ...plan.simulation, turnTotalCount: 6, compressionThresholdTurnCount: 2, compressionKeepTurns: 0, model: plan.model });
  session.reset();
  const before = buildReport(session);
  session.reset();
  assert.deepEqual(buildReport(session), before);
});

test('单个全局变量统一控制耗时统计，关闭后保留配置且费用和 Token 不变', () => {
  const config = setup();
  config.plans[0].simulation.flow.turn[1].durationSeconds = 5;
  const before = simulate(config);
  config.globalSimulation.estimateDuration = false;
  const off = simulate(config);
  assert.equal(off[0].estimateDuration, false);
  assert.equal(off[0].averageTurnDurationSeconds, null);
  assert.ok(off[0].rounds.every(round => round.durationSeconds === null));
  for (const key of ['cost', 'hit', 'miss', 'output', 'requests']) assert.deepEqual(off[0][key], before[0][key]);
  assert.equal(off[1].estimateDuration, false);
  assert.equal(off[1].averageTurnDurationSeconds, null);
  for (const key of ['cost', 'hit', 'miss', 'output', 'requests']) assert.deepEqual(off[1][key], before[1][key]);
  assert.equal(config.plans[0].simulation.flow.turn[1].durationSeconds, 5);
  config.globalSimulation.estimateDuration = true;
  assert.deepEqual(simulate(config), before);
});

test('空流程耗时为 0，无用户轮次时平均耗时为空', () => {
  const config = setup();
  config.plans[0].simulation.flow.turn = [];
  close(simulate(config)[0].averageTurnDurationSeconds, 0);
  // Session 支持零轮次，页面的用户轮次下限为 1。
  const plan = config.plans[0];
  const report = buildReport(new Session({ ...plan.simulation, turnTotalCount: 0, model: plan.model }));
  assert.equal(report.averageTurnDurationSeconds, null);
});

test('JSON 与 Worker 保留全局开关，复制保留节点耗时，旧配置默认开启', () => {
  const config = setup();
  config.globalSimulation.estimateDuration = false;
  config.plans[0].simulation.flow.initial[0].durationSeconds = 0;
  config.plans[0].simulation.flow.turn[1].durationSeconds = 4.25;
  const imported = readComparisonConfig(JSON.parse(JSON.stringify(config)));
  assert.deepEqual(imported, config);
  assert.deepEqual(simulate(structuredClone(imported)), simulate(config));
  const copy = createPlan({ source: imported.plans[0], id: 'copy' });
  assert.equal(copy.estimateDuration, undefined);
  assert.equal(copy.simulation.flow.turn[1].durationSeconds, 4.25);
  copy.simulation.flow.turn[1].durationSeconds = 10;
  assert.equal(imported.plans[0].simulation.flow.turn[1].durationSeconds, 4.25);
  delete config.globalSimulation.estimateDuration;
  assert.equal(simulate(readComparisonConfig(config))[0].estimateDuration, true);
  config.plans[0].estimateDuration = false;
  const legacy = readComparisonConfig(config);
  assert.equal(legacy.plans[0].estimateDuration, undefined);
  assert.equal(simulate(legacy)[0].estimateDuration, true);
});

test('非法耗时与全局开关在校验和导入时拒绝，耗时溢出报告错误', () => {
  for (const value of [-1, Infinity, NaN, '', null, '1.8']) {
    const config = setup();
    config.plans[0].simulation.flow.turn[0].durationSeconds = value;
    assert.match(validateComparison(config)['plans.0.flow'], /节点耗时/);
    assert.throws(() => readComparisonConfig(config), /节点耗时/);
  }
  const config = setup();
  for (const value of ['false', 0, 1, null]) {
    config.globalSimulation.estimateDuration = value;
    assert.throws(() => simulate(config), /预估耗时开关/);
    assert.throws(() => readComparisonConfig(config), /预估耗时开关/);
  }
  config.globalSimulation.estimateDuration = true;
  config.plans[0].simulation.flow.turn[0].durationSeconds = Number.MAX_VALUE;
  assert.throws(() => simulate(config), /耗时超出/);
});
