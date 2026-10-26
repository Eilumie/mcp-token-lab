import test from "node:test";
import assert from "node:assert/strict";
import Session from "./session.js";
import { previewStep, shouldRunStep, stepRuntime } from "./session-flow.js";
import { buildReport, simulate } from "./session-report.js";
import { createComparisonConfig, readComparisonConfig } from "./comparison.js";

const action = (text, token = 1, trigger) => ({ type: "action", text, token, ...(trigger ? { trigger } : {}) });
const llm = (text, token = 1, trigger) => ({ ...action(text, token, trigger), type: "llm" });
const interval = value => ({ type: "interval", value });
const probability = value => ({ type: "probability", value });
const makeSession = (turn, extra = {}) => new Session({
  turnTotalCount: 7, compressionThresholdTurnCount: 100, compressionKeepTurns: 0,
  model: { inputCachedPrice: 1, inputNotCachedPrice: 2, outputPrice: 3 },
  flow: { initial: [], turn }, ...extra,
});
const userTurns = session => session.turns.filter(turn => turn.kind === "user");

test("缺省触发、100% 和每 1 轮保持原有结果，0% 和停用节点完全跳过", () => {
  const steps = [action("输入", 2), llm("输出", 3)];
  const baseline = makeSession(steps); baseline.reset();
  for (const trigger of [probability(100), interval(1)]) {
    const session = makeSession(steps.map(step => ({ ...step, trigger })));
    session.reset();
    assert.deepEqual(buildReport(session), buildReport(baseline));
  }
  const skipped = makeSession([
    action("不会追加", 999, probability(0)), llm("不会调用", 999, probability(0)),
    { ...llm("已停用", 999, interval(1)), enabled: false },
  ]);
  skipped.reset();
  assert.ok(userTurns(skipped).every(turn => turn.actions.length === 0));
  assert.equal(skipped.actionIndex, 0);
  const report = buildReport(skipped);
  assert.equal(report.cost.total, 0);
  assert.equal(report.finalContext, 0);
  assert.equal(report.requests.length, 0);
  assert.equal(report.rounds.length, 7);
});

test("每 N 轮在 N、2N 轮触发；压缩不重置轮次，llmIndex 只计算实际调用", () => {
  const session = makeSession([
    action("用户消息"), llm("间隔调用", "turnIndex + llmIndex", interval(3)),
    action("调用数", "llmIndex"), llm("末次调用", "llmIndex"),
  ], { compressionThresholdTurnCount: 2 });
  session.reset();
  const turns = userTurns(session);
  assert.deepEqual(turns.filter(t => t.actions.some(a => a.group === "间隔调用")).map(t => t.turnIndex + 1), [3, 6]);
  assert.deepEqual(turns.map(t => t.actions.find(a => a.group === "调用数").token), [0, 0, 1, 0, 0, 1, 0]);
  assert.deepEqual(turns.map(t => t.actions.find(a => a.group === "末次调用").token), [0, 0, 1, 0, 0, 1, 0]);
  assert.equal(session.turns.filter(t => t.kind === "compression").length, 3);
  for (const turn of turns) {
    assert.equal(stepRuntime(session.config.flow, "turn", 3, turn.turnIndex).llmIndex, turn.turnIndex % 3 === 2 ? 1 : 0);
  }
});

test("条件内容只在触发后进入上下文、后续缓存和费用归因", () => {
  const session = makeSession([action("用户消息"), action("间隔资料", 10, interval(2)), llm("回复", 2)], {
    turnTotalCount: 4, expectedPrefixCacheHitRate: 1,
    flow: { initial: [action("初始", 1)], turn: [action("用户消息"), action("间隔资料", 10, interval(2)), llm("回复", 2)] },
  });
  session.reset();
  const report = buildReport(session);
  assert.deepEqual(report.requests.map(r => r.input), [2, 15, 18, 31]);
  assert.deepEqual(report.requests.map(r => r.hit), [1, 2, 15, 18]);
  assert.equal(report.hit, 36);
  assert.equal(report.miss, 30);
  assert.equal(report.output, 8);
  assert.equal(report.finalContext, 33);
  assert.equal(report.sources.find(s => s.key === "间隔资料").hit, 20);
  assert.equal(report.sources.find(s => s.key === "间隔资料").miss, 20);
  assert.ok(Math.abs(report.cost.total - .12) < 1e-12);
});

test("概率抽样可复现，预览与真实执行一致，重新计费和延长会话不改写既有触发", () => {
  const steps = [llm("随机调用", "turnIndex", probability(30)), action("调用次数", "llmIndex")];
  const session = makeSession(steps, { turnTotalCount: 1000, compressionThresholdTurnCount: 5 });
  session.reset();
  const pattern = userTurns(session).map(t => t.actions.some(a => a.type === "llm"));
  const hits = pattern.filter(Boolean).length;
  assert.ok(hits > 250 && hits < 350, `30% 抽样命中 ${hits}/1000`);
  userTurns(session).forEach((turn, i) => {
    const first = previewStep(session.config.flow, "turn", 0, session.config, i);
    assert.equal(first.runs, pattern[i]);
    assert.equal(first.value, pattern[i] ? i : 0);
    const second = previewStep(session.config.flow, "turn", 1, session.config, i);
    assert.equal(second.value, turn.actions.find(a => a.group === "调用次数").token);
  });
  session.config.model.outputPrice = 999;
  session.reset();
  assert.deepEqual(userTurns(session).map(t => t.actions.some(a => a.type === "llm")), pattern);
  const shorter = makeSession(steps, { turnTotalCount: 20 }); shorter.reset();
  assert.deepEqual(userTurns(shorter).map(t => t.actions.some(a => a.type === "llm")), pattern.slice(0, 20));
  assert.notDeepEqual(pattern, pattern.map((_, i) => shouldRunStep(steps[0], i, 1)));
});

test("未触发不求值，间隔公式在首次触发轮次校验，后续错误包含正确运行索引", () => {
  const session = makeSession([
    llm("永不执行", "turnIndex === 0 ? 1 : -1", probability(0)),
    llm("间隔输出", "1 / turnIndex", interval(3)),
  ]);
  session.reset();
  assert.deepEqual(session.getConsumptionTokens().llms.map(r => r.output.token), [.5, .2]);
  assert.equal(previewStep(session.config.flow, "turn", 1, session.config, 0).value, 0);
  const failing = makeSession([llm("后续错误", "turnIndex < 3 ? 1 : -1", interval(3))]);
  assert.throws(() => failing.reset(), /flow.turn 第 1 步「后续错误」（turnIndex=5, llmIndex=0）/);
});

test("非法触发配置在 Session、导入和停用步骤中都被拒绝", () => {
  const invalid = [null, [], 30, {}, { type: "unknown", value: 1 },
    probability(-1), probability(101), probability(NaN), probability(Infinity), probability("50"),
    interval(0), interval(-1), interval(1.5), interval(Infinity), interval("2"), interval(Number.MAX_SAFE_INTEGER + 1),
    { ...interval(2), typo: true }];
  for (const trigger of invalid) {
    const step = { ...llm("无效"), trigger, enabled: false };
    assert.throws(() => makeSession([step]), /flow.turn 第 1 步/);
    const config = createComparisonConfig(); config.plans[0].simulation.flow.turn = [step];
    assert.throws(() => readComparisonConfig(config), /flow.turn 第 1 步/);
  }
  assert.throws(() => makeSession([], { flow: { initial: [action("初始", 1, interval(2))], turn: [] } }), /初始上下文不支持 trigger/);
  assert.doesNotThrow(() => makeSession([llm("小数百分比", 1, probability(12.5))]));
});

test("触发配置在 JSON 导入导出后保留，模拟结果一致，间隔超过总轮次不触发", () => {
  const config = createComparisonConfig();
  config.plans[0].simulation.flow.turn[1].trigger = probability(25);
  config.plans[0].simulation.flow.turn[3].trigger = interval(3);
  const restored = readComparisonConfig(JSON.parse(JSON.stringify(config)));
  assert.deepEqual(restored.plans[0].simulation.flow, config.plans[0].simulation.flow);
  assert.deepEqual(simulate(restored), simulate(config));
  const session = makeSession([llm("超出会话", 1, interval(100))]); session.reset();
  assert.equal(session.getConsumptionTokens().llms.length, 0);
});
