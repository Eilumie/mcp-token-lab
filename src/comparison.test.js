import test from "node:test";
import assert from "node:assert/strict";
import { createConfig } from "./config.js";
import { createComparisonConfig, createPlan, readComparisonConfig, validateComparison, compareSources, planColors, maxPlans } from "./comparison.js";
import { simulate } from "./session-report.js";
import { sourceOption, trendOption } from "./charts.js";
import { buildCsv } from "./export.js";

const small = () => {
  const config = createComparisonConfig();
  config.plans.forEach(p => p.simulation.turnTotalCount = 3);
  return config;
};
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test("默认两方案与原 v2 会话结果一致，配置相互独立", () => {
  const legacy = createConfig();
  legacy.simulation.turnTotalCount = 10;
  const config = createComparisonConfig(legacy);
  assert.deepEqual(validateComparison(config), {});
  const oldResults = simulate(legacy);
  const results = simulate(config);
  assert.deepEqual(results.map(r => r.planName), ["按需 Tools", "全量 Tools"]);
  results.forEach((r, i) => {
    assert.deepEqual(r.cost, oldResults[i].cost);
    assert.deepEqual(r.requests, oldResults[i].requests);
    assert.equal(r.planId, config.plans[i].id);
  });
  config.plans[0].simulation.flow.initial[0].token = 100;
  config.plans[0].model.inputCachedPrice = 999;
  assert.equal(config.plans[1].simulation.flow.initial[0].token, "initialContext.agentPromptToken");
  assert.notEqual(config.plans[1].model.inputCachedPrice, 999);
  assert.notEqual(legacy.model.inputCachedPrice, 999);
});

test("三个方案可使用同一加载方式及独立流程、费率、轮次", () => {
  const config = small();
  config.plans.push(createPlan({ source: config.plans[0], name: "精简流程", color: planColors[2] }));
  const extra = config.plans[2];
  extra.simulation.turnTotalCount = 7;
  extra.simulation.flow = { initial: [], turn: [{ type: "llm", text: "直接回复", token: 2 }] };
  extra.model.inputCachedPrice = 0;
  extra.model.inputNotCachedPrice = 0;
  extra.model.outputPrice = 10;
  const results = simulate(config);
  assert.equal(results.length, 3);
  assert.equal(results[0].mode, results[2].mode);
  assert.equal(results[0].rounds.length, 3);
  assert.equal(results[2].requests.length, 7);
  close(results[2].cost.total, 0.14);
  const before = results[0].cost.total;
  extra.model.outputPrice = 20;
  const next = simulate(config);
  close(next[0].cost.total, before);
  close(next[2].cost.total, 0.28);
});

test("来源表按 key 对齐自定义来源，多个图表和 CSV 包含全部方案", () => {
  const config = small();
  config.plans.push(createPlan({ source: config.plans[1], name: "第三方案", color: planColors[2] }));
  config.plans.forEach((p, i) => {
    p.simulation.turnTotalCount = i + 1;
    p.simulation.flow = { initial: [], turn: [{ type: "llm", text: `独有来源${i}`, token: i + 1 }] };
  });
  const results = simulate(config);
  const rows = compareSources(results, 2);
  assert.deepEqual(rows.find(row => row.key === "独有来源0").costs.slice(1), [0, 0]);
  const third = rows.find(row => row.key === "独有来源2");
  assert.equal(third.output, 9);
  close(third.costs[2], results[2].cost.total);
  const source = sourceOption(results, "¥");
  assert.deepEqual(source.yAxis.data, config.plans.map(p => p.name));
  for (let i = 0; i < results.length; i++) close(source.series.reduce((sum, series) => sum + series.data[i], 0), results[i].cost.total);
  const trend = trendOption(results, "context", "¥");
  assert.deepEqual(trend.series.map(s => s.name), config.plans.map(p => p.name));
  assert.equal(trend.xAxis.max, 3);
  for (const kind of ["requests", "sources"]) {
    const csv = buildCsv(results, config, kind);
    config.plans.forEach(p => assert.ok(csv.includes(`"${p.name}","K","CNY"`)));
    assert.ok(!csv.includes("undefined"));
  }
});

test("v3 配置往返保留方案、基准及自定义价格；v2 导入迁移成两方案", () => {
  const config = small();
  config.plans[0].name = "我的按需方案";
  config.plans[0].model.outputPrice = 1.234;
  config.baselineId = config.plans[0].id;
  const imported = readComparisonConfig(JSON.parse(JSON.stringify(config)));
  assert.deepEqual(imported, config);
  assert.deepEqual(simulate(imported), simulate(config));
  const legacy = createConfig();
  legacy.model.outputPrice = 123;
  const migrated = readComparisonConfig(legacy);
  assert.equal(migrated.version, 3);
  assert.deepEqual(migrated.plans.map(p => p.model.outputPrice), [123, 123]);
  assert.equal(migrated.plans[0].simulation.turnTotalCount, legacy.simulation.turnTotalCount);
});

test("单方案与空方案均能保存、计算，改变基准不改变实际成本", () => {
  const config = small();
  const results = simulate(config);
  config.baselineId = config.plans[0].id;
  assert.deepEqual(simulate(config), results);
  config.plans.pop();
  const single = simulate(config);
  assert.equal(single.length, 1);
  assert.equal(sourceOption(single, "¥").yAxis.data.length, 1);
  assert.equal(trendOption(single, "cost", "¥").series.length, 1);
  assert.deepEqual(readComparisonConfig(config), config);
  config.plans = [];
  config.baselineId = null;
  assert.deepEqual(simulate(config), []);
  assert.deepEqual(readComparisonConfig(config), config);
});

test("复制方案后修改嵌套流程和费率不影响原方案", () => {
  const config = small();
  const original = config.plans[0];
  const copy = createPlan({ source: original, name: "副本" });
  assert.notEqual(copy.id, original.id);
  copy.simulation.flow.turn.reverse();
  copy.simulation.initialContext.agentPromptToken = 500;
  copy.model.outputPrice = 500;
  assert.equal(original.simulation.flow.turn[0].text, "user_message");
  assert.notEqual(original.simulation.initialContext.agentPromptToken, 500);
  assert.notEqual(original.model.outputPrice, 500);
});

test("多方案校验拒绝重复标识、名称、混合币种、无效基准与数量超限", () => {
  for (const mutate of [
    c => c.plans[1].id = c.plans[0].id,
    c => c.plans[1].name = ` ${c.plans[0].name} `,
    c => c.plans[1].name = " ",
    c => c.plans[1].toolsMode = "invalid",
    c => c.plans[1].model.currency = "$",
    c => c.plans[1].color = "invalid",
    c => c.plans[1].simulation.userMessageToken = -1,
    c => c.baselineId = "missing",
    c => { c.plans = []; },
    c => { c.plans = Array.from({ length: maxPlans + 1 }, (_, i) => createPlan({ name: `方案${i}` })); },
  ]) {
    const config = small();
    mutate(config);
    assert.ok(Object.keys(validateComparison(config)).length > 0);
    assert.throws(() => simulate(config));
    assert.throws(() => readComparisonConfig(config));
  }
});

test("八方案比较的输入、输出、来源费用与各自请求记录守恒", () => {
  const config = small();
  while (config.plans.length < maxPlans) config.plans.push(createPlan({ source: config.plans[0], name: `方案${config.plans.length + 1}` }));
  const results = simulate(config);
  assert.equal(results.length, maxPlans);
  for (const result of results) {
    close(result.requests.reduce((sum, r) => sum + r.cost.total, 0), result.cost.total);
    close(result.sources.reduce((sum, s) => sum + s.cost.total, 0), result.cost.total);
    for (const key of ["hit", "miss", "output"]) close(result.requests.reduce((sum, r) => sum + r[key], 0), result[key]);
  }
});
