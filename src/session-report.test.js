import test from "node:test";
import assert from "node:assert/strict";
import Session from "./session.js";
import { simulate, buildReport, modes } from "./session-report.js";
import { createConfig, createPresetConfig, validate, readConfig } from "./config.js";
import { modelPresets } from "./model-pricing.js";
import { money, csvCell } from "./utils.js";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) <= Math.max(1e-9, Math.abs(expected) * 1e-10), actual + " != " + expected);
const setup = (simulation = {}) => {
  const config = createConfig();
  Object.assign(config.simulation, simulation);
  return config;
};

test("默认选择第一个模型，重置时恢复其费率和元数据", () => {
  const first = modelPresets[0];
  const config = createConfig();
  assert.equal(config.pricing.id, first.id);
  assert.equal(config.model.name, first.name);
  assert.equal(config.model.currency, first.currency === "CNY" ? "¥" : "$");
  assert.deepEqual([config.model.inputCachedPrice, config.model.inputNotCachedPrice, config.model.outputPrice], [first.hit, first.miss, first.output]);
  config.model.inputCachedPrice = 999;
  config.pricing.contextWindow = 1;
  const reset = createConfig();
  assert.equal(reset.model.inputCachedPrice, first.hit);
  assert.equal(reset.pricing.contextWindow, first.contextWindow);
  assert.deepEqual(validate(reset), {});
});

test("Session 不提供默认费率，计费必须显式传入全部单价", () => {
  const session = new Session({ turnTotalCount: 1 });
  assert.deepEqual(session.config.model, {});
  assert.throws(() => session.getConsumptionTokens(), /inputCachedPrice/);
  const partial = new Session({ model: { inputCachedPrice: 1 } });
  assert.throws(() => partial.getConsumptionTokens(), /inputNotCachedPrice/);
  Object.assign(session.config.model, { inputCachedPrice: 0, inputNotCachedPrice: 0, outputPrice: 0 });
  session.reset();
  assert.equal(session.getConsumptionTokens().totalPrice, 0);
});

test("导入其他模型或自定义费率不继承默认模型上下文限制", () => {
  const config = createConfig();
  const preset = modelPresets.find(p => !p.contextWindow);
  Object.assign(config, createPresetConfig(preset));
  assert.deepEqual(readConfig(JSON.parse(JSON.stringify(config))), config);
  delete config.pricing;
  const imported = readConfig(config);
  assert.equal(imported.pricing.id, "custom");
  assert.equal(imported.pricing.contextWindow, undefined);
  assert.deepEqual(imported.model, config.model);
});
function checkConservation(result) {
  const total = key => result.requests.reduce((sum, r) => sum + r[key], 0);
  for (const key of ["hit", "miss", "output"]) {
    close(total(key), result[key]);
    close(result.sources.reduce((sum, s) => sum + s[key], 0), result[key]);
  }
  close(result.sources.reduce((sum, s) => sum + s.cost.total, 0), result.cost.total);
  close(result.rounds.reduce((sum, r) => sum + r.cost, 0), result.cost.total);
  close(result.requests.reduce((sum, r) => sum + r.cost.total, 0), result.cost.total);
  close(result.rounds.at(-1).context, result.finalContext);
  for (const request of result.requests) {
    for (const key of ["hit", "miss", "output"]) close(request.attribution.reduce((sum, s) => sum + s[key], 0), request[key]);
    close(request.input, request.hit + request.miss);
  }
  assert.equal(result.rounds.flatMap(r => r.requestIds).length, result.requests.length);
  assert.doesNotThrow(() => JSON.stringify(result));
}

test("10 轮基准，末轮压缩请求和最终上下文完整计入", () => {
  const results = simulate(setup({ turnTotalCount: 10, skillsTotalCount: 1 }));
  const expected = [
    [41, 6.089, 1588.9941, 255.1049, 19, 25.799, 6.12874995],
    [31, 51.989, 2365.2981, 332.7109, 18, 69.969, 8.18847795],
  ];
  results.forEach((r, i) => {
    const [requests, initial, hit, miss, output, final, cost] = expected[i];
    assert.equal(r.requests.length, requests);
    close(r.initialContext, initial); close(r.hit, hit); close(r.miss, miss);
    close(r.output, output); close(r.finalContext, final); close(r.cost.total, cost);
    assert.deepEqual(r.compressions[0].compressedRounds, [1, 2, 3, 4, 5, 6, 7, 8]);
    assert.deepEqual(r.compressions[0].keptRounds, [9, 10]);
    assert.equal(r.rounds.at(-1).requestIds.length, i ? 4 : 5);
    assert.equal(r.requests.at(-1).stage, "上下文压缩");
    checkConservation(r);
  });
});

test("重复压缩、用户轮次编号及逐轮上下文与 Session 实际快照一致", () => {
  const config = setup({ turnTotalCount: 30 });
  for (const toolsMode of modes) {
    const session = new Session({ ...config.simulation, model: config.model, toolsMode });
    const contexts = [];
    for (let i = 0; i < 30; i++) {
      session.startNewTurn();
      contexts.push(session.getContextSnapshot().turns.flatMap(t => t.actions).reduce((sum, a) => sum + (a.type === "llm" ? 0 : a.token), 0));
    }
    const report = buildReport(session);
    report.rounds.forEach((r, i) => close(r.context, contexts[i]));
    assert.deepEqual(report.compressions.map(c => c.round), [10, 18, 26]);
    assert.deepEqual(report.compressions[1].compressedRounds, [9, 10, 11, 12, 13, 14, 15, 16]);
    assert.deepEqual(report.compressions[1].keptRounds, [17, 18]);
    assert.ok(report.sources.find(s => s.key === "compression retained turns").hit > 0);
    checkConservation(report);
  }
});

test("Token 阈值下两方案独立触发压缩", () => {
  const results = simulate(setup({ turnTotalCount: 20, compressionThresholdType: "TOKEN", compressionThresholdToken: 80 }));
  assert.notDeepEqual(results[0].compressions.map(c => c.round), results[1].compressions.map(c => c.round));
  results.forEach(checkConservation);
  results.forEach(r => close(r.averageUserTurnsPerCompression, 20 / r.compressions.length));
});

test("平均压缩轮次只统计实际用户消息，包含尾部轮次，重复 reset 不累积", () => {
  const config = setup({ turnTotalCount: 30 });
  const session = new Session({ ...config.simulation, model: config.model });
  assert.equal(session.getConsumptionTokens().averageUserTurnsPerCompression, null);
  for (let i = 0; i < 9; i++) session.startNewTurn();
  assert.equal(buildReport(session).averageUserTurnsPerCompression, null);
  session.startNewTurn();
  assert.equal(buildReport(session).averageUserTurnsPerCompression, 10);
  for (let i = 10; i < 18; i++) session.startNewTurn();
  assert.equal(session.getConsumptionTokens().averageUserTurnsPerCompression, 9);
  assert.equal(buildReport(session).averageUserTurnsPerCompression, 9);
  session.reset();
  assert.equal(session.getConsumptionTokens().averageUserTurnsPerCompression, 10);
  session.reset();
  assert.equal(buildReport(session).averageUserTurnsPerCompression, 10);
});

test("保留零轮、多次压缩及零长度摘要", () => {
  const results = simulate(setup({ turnTotalCount: 12, compressionKeepTurns: 0, compressionThresholdTurnCount: 3, compressionTargetToken: 0 }));
  results.forEach(r => {
    assert.deepEqual(r.compressions.map(c => c.round), [3, 6, 9, 12]);
    assert.ok(r.compressions.every(c => c.keptRounds.length === 0));
    close(r.finalContext, r.initialContext);
    checkConservation(r);
  });
});

test("0% 与 100% 命中只改变分类，所有 Token 归因守恒", () => {
  const none = simulate(setup({ turnTotalCount: 18, expectedPrefixCacheHitRate: 0 }));
  const all = simulate(setup({ turnTotalCount: 18, expectedPrefixCacheHitRate: 1 }));
  none.forEach((r, i) => {
    close(r.hit, 0);
    close(r.miss, all[i].hit + all[i].miss);
    close(r.output, all[i].output);
    close(r.finalContext, all[i].finalContext);
    close(r.requests[0].prefix, r.initialContext);
    checkConservation(r); checkConservation(all[i]);
  });
});

test("零内容和零价格不丢弃请求，末次输出费用归因完整", () => {
  const config = setup({ turnTotalCount: 1 });
  const base = simulate(config);
  base.forEach(r => {
    const final = r.sources.find(s => s.key === "agent_result");
    close(final.output, 1); close(final.hit + final.miss, 0);
    close(r.sources.find(s => s.key === "call_tools").output, 0);
  });
  Object.assign(config.model, { inputCachedPrice: 0, inputNotCachedPrice: 0, outputPrice: 0 });
  simulate(config).forEach((r, i) => {
    close(r.cost.total, 0); close(r.hit, base[i].hit);
    assert.equal(r.equivalent, null); checkConservation(r);
  });
  for (const key of Object.keys(config.simulation)) {
    if (["compressionThresholdType", "compressionThresholdTurnCount", "compressionThresholdToken", "turnTotalCount", "initialContext"].includes(key)) continue;
    config.simulation[key] = 0;
  }
  config.simulation.initialContext.agentPromptToken = 0;
  simulate(config).forEach((r, i) => {
    assert.equal(r.requests.length, i ? 3 : 4);
    assert.equal(r.hitRate, null); checkConservation(r);
  });
});

test("配置校验与快照往返：不兼容旧版本，不替换费率", () => {
  const config = createConfig();
  assert.deepEqual(validate(config), {});
  config.model.inputCachedPrice = 0.12345;
  assert.deepEqual(readConfig(JSON.parse(JSON.stringify(config))), config);
  for (const value of [-1, Infinity, NaN, ""]) assert.ok(validate(setup({ userMessageToken: value })).userMessageToken);
  assert.ok(validate(setup({ turnTotalCount: 1001 })).turnTotalCount);
  assert.ok(validate(setup({ turnTotalCount: 1.2 })).turnTotalCount);
  assert.ok(validate(setup({ expectedPrefixCacheHitRate: 1.01 })).expectedPrefixCacheHitRate);
  assert.ok(validate(setup({ compressionKeepTurns: 10 })).compressionThresholdTurnCount);
  assert.ok(validate(setup({ compressionThresholdType: "TOKEN", compressionThresholdToken: 0 })).compressionThresholdToken);
  assert.throws(() => readConfig({ version: 1 }));
  assert.throws(() => readConfig({ ...config, unit: "Token" }));
  assert.throws(() => readConfig({ ...config, simulation: {} }));
});

test("1000 轮分页数据完整、压缩汇总守恒", () => {
  const results = simulate(setup({ turnTotalCount: 1000 }));
  results.forEach((r, i) => {
    assert.equal(r.rounds.length, 1000);
    assert.equal(r.requests.length, 1000 * (i ? 3 : 4) + r.compressions.length);
    checkConservation(r);
  });
});

test("小额非零费用不显示为零，CSV 防止公式注入", () => {
  assert.equal(money(0), "$0");
  assert.notEqual(money(0.00001), "$0.00");
  assert.match(money(1e-10), /e-10/);
  assert.equal(csvCell('=SUM(A1)'), '"\'=SUM(A1)"');
  assert.equal(csvCell('a"b'), '"a""b"');
});
