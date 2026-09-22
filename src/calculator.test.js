import test from "node:test";
import assert from "node:assert/strict";
import { defaults, presets, toTokens, validate } from "./config.js";
import { calculateOnDemand } from "./on-demand.js";
import { calculateFullLoad } from "./full-load.js";
const close = (a, b) =>
  assert.ok(
    Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-11),
    `${a} != ${b}`,
  );
const calculators = [calculateOnDemand, calculateFullLoad];
const referenceRate = presets.find((rate) => rate.id === "flash-off");
const expected = [
  [1, 0, 28145, 6655, 1300, 13855, 0.0124179],
  [1, 1, 153990, 5790, 1200, 57690, 0.0136698],
  [2, 0, 85910, 14310, 2600, 21510, 0.0264282],
  [2, 1, 327350, 12580, 2400, 64480, 0.028727],
  [10, 0, 1650350, 75550, 13000, 82750, 0.160557],
  [10, 1, 2447550, 66900, 12000, 118800, 0.163851],
];
for (const [rounds, i, hit, miss, out, context, cost] of expected)
  test(`验收：方案 ${i + 1} / ${rounds} 轮`, () => {
    const r = calculators[i](toTokens({ ...defaults, rounds }), referenceRate);
    for (const [a, b] of [
      [r.total_in_cache, hit],
      [r.total_in_new, miss],
      [r.total_out, out],
      [r.context, context],
      [r.cost.total, cost],
    ])
      close(a, b);
    close(
      r.sources.reduce((n, s) => n + s.cost.total, 0),
      cost,
    );
    close(
      r.rounds.reduce((n, s) => n + s.cost, 0),
      cost,
    );
    for (const q of r.requests)
      for (const [key, total] of [
        ["hit", q.in_cache],
        ["miss", q.in_new],
        ["output", q.out],
      ])
        close(
          q.attribution.reduce((n, s) => n + s[key], 0),
          total,
        );
  });
test("来源独立归因与末次回复不回传", () => {
  const a = calculateOnDemand(toTokens({ ...defaults, rounds: 1 }), referenceRate);
  const b = calculateFullLoad(toTokens({ ...defaults, rounds: 1 }), referenceRate);
  close(a.sources.find((s) => s.source === "Tools List").hit, 4800);
  close(b.sources.find((s) => s.source === "Tools Schema").hit, 137700);
  const tool = a.sources.find((s) => s.source === "Tools Result");
  close(tool.miss, 4500);
  close(tool.output, 0);
  const reply = a.sources.find((s) => s.source === "Agent 最终回复");
  close(reply.output, 1000);
  close(reply.hit + reply.miss, 0);
});
test("冷启动只改变初始上下文缓存计费", () => {
  calculators.forEach((calc) => {
    const p = toTokens(defaults),
      warm = calc(p, referenceRate),
      cold = calc(p, presets[0], true);
    close(warm.total_in_cache - cold.total_in_cache, warm.initial_context);
    close(cold.total_in_new - warm.total_in_new, warm.initial_context);
    close(warm.context, cold.context);
    close(warm.total_out, cold.total_out);
    close(
      cold.sources.reduce((n, s) => n + s.cost.total, 0),
      cold.cost.total,
    );
  });
});
test("高峰翻倍、零费率", () => {
  const p = toTokens(defaults);
  calculators.forEach((calc) => {
    const off = calc(p, referenceRate),
      peak = calc(p, presets.find((rate) => rate.id === "flash-peak"));
    close(peak.cost.total, off.cost.total * 2);
    close(peak.total_in_cache, off.total_in_cache);
    const zero = calc(p, { hit: 0, miss: 0, output: 0 });
    assert.equal(zero.cost.total, 0);
  });
});
test("零内容仍保留阶段、小数平均与非法参数", () => {
  const values = Object.fromEntries(
    Object.keys(defaults).map((k) => [k, k === "rounds" ? 1 : 0]),
  );
  calculators.forEach((calc, i) => {
    const r = calc(toTokens(values), referenceRate);
    assert.equal(r.requests.length, i ? 3 : 4);
    assert.equal(r.cost.total, 0);
  });
  assert.deepEqual(validate(defaults, presets[0]), {});
  for (const value of [-1, NaN, Infinity, ""])
    assert.ok(
      validate({ ...defaults, tool_result: value }, presets[0]).tool_result,
    );
  assert.ok(validate({ ...defaults, rounds: 1.5 }, presets[0]).rounds);
  assert.ok(
    validate({ ...defaults, tools_total: 0 }, presets[0]).tools_per_round,
  );
  const p = toTokens({
    ...defaults,
    skills_per_round: 0.1234,
    tools_per_round: 0.5678,
  });
  const r = calculateOnDemand(p, referenceRate);
  close(
    r.sources.reduce((n, s) => n + s.cost.total, 0),
    r.cost.total,
  );
});
test("10,000 轮完整计算，累计守恒", () => {
  calculators.forEach((calc) => {
    const r = calc(toTokens({ ...defaults, rounds: 10000 }), presets[0]);
    assert.equal(r.rounds.length, 10000);
    assert.ok(Number.isFinite(r.cost.total));
    close(
      r.sources.reduce((n, s) => n + s.cost.total, 0),
      r.cost.total,
    );
  });
});

test("配置 JSON 往返与损坏配置拒绝", async () => {
  const { readConfig } = await import("./config.js");
  const config = {
    version: 1,
    values: { ...defaults, rounds: 20 },
    rates: structuredClone(presets),
    selected: "pro-off",
    cold: true,
  };
  const restored = readConfig(JSON.parse(JSON.stringify(config)));
  assert.deepEqual(restored, config);
  assert.throws(() => readConfig({ ...config, selected: "missing" }));
  assert.throws(() =>
    readConfig({ ...config, values: { ...defaults, rounds: null } }),
  );
  assert.throws(() =>
    readConfig({ ...config, rates: [{ ...presets[0], miss: "0" }] }),
  );
  assert.throws(() =>
    readConfig({ ...config, rates: [presets[0], presets[0]] }),
  );
});

test("缓存费率及命中输入折算跟随单价，零分母不可折算", () => {
  for (const calc of calculators) {
    const p = toTokens(defaults);
    const standard = calc(p, referenceRate);
    close(standard.cachePriceRatio, 0.02);
    close(standard.equivalent, standard.total_in_cache * 0.02);
    const custom = calc(p, { hit: 0.015, miss: 0.15, output: 0.6 });
    close(custom.cachePriceRatio, 0.1);
    close(custom.equivalent, custom.total_in_cache * 0.1);
    const freeCache = calc(p, { hit: 0, miss: 0.15, output: 0.6 });
    assert.equal(freeCache.equivalent, 0);
    const zeroMiss = calc(p, { hit: 0, miss: 0, output: 0.6 });
    assert.equal(zeroMiss.cachePriceRatio, null);
    assert.equal(zeroMiss.equivalent, null);
  }
});

test("累计费用构成金额与占比守恒，零费用占比为空", () => {
  for (const calc of calculators) {
    const result = calc(toTokens(defaults), referenceRate);
    close(result.cost.input, result.cost.cached + result.cost.fresh);
    close(result.costShare.input, result.cost.input / result.cost.total);
    close(result.costShare.output, result.cost.generated / result.cost.total);
    close(result.costShare.cached, result.cost.cached / result.cost.total);
    close(result.costShare.fresh, result.cost.fresh / result.cost.total);
    close(result.costShare.input + result.costShare.output, 1);
    close(result.costShare.cached + result.costShare.fresh, result.costShare.input);

    const zero = calc(toTokens(defaults), { hit: 0, miss: 0, output: 0 });
    assert.equal(zero.cost.input, 0);
    assert.deepEqual(zero.costShare, {
      input: null,
      output: null,
      cached: null,
      fresh: null,
    });
  }
});

test("百炼预设完整、人民币配置可往返、旧配置自动补充", async () => {
  const { bailianPresets } = await import("./model-pricing.js");
  const { readConfig, mergePresets } = await import("./config.js");
  assert.equal(bailianPresets.length, 18);
  assert.ok(bailianPresets.every((r) => r.currency === "CNY"));
  const flash = bailianPresets.find((r) => r.actual === "qwen3.8-flash");
  const result = calculateOnDemand(toTokens(defaults), flash);
  close(
    result.cost.total,
    (1650350 / 1e6) * 0.1 + (75550 / 1e6) * 0.8 + (13000 / 1e6) * 2.7,
  );
  const config = {
    version: 1,
    values: defaults,
    rates: [flash],
    selected: flash.id,
    cold: false,
  };
  assert.deepEqual(readConfig(JSON.parse(JSON.stringify(config))), config);
  const merged = mergePresets(config);
  assert.equal(merged.rates.length, presets.length);
  assert.equal(mergePresets(merged).rates.length, merged.rates.length);
  assert.equal(merged.selected, flash.id);
  const tiers = bailianPresets.filter((r) => r.actual === "qwen3.7-plus");
  assert.deepEqual(
    tiers.map((r) => [r.hit, r.miss, r.output]),
    [
      [0.4, 2, 8],
      [1.2, 6, 24],
    ],
  );
});

test("DeepSeek 官方预设使用人民币价格且缓存中的修改会被重置", async () => {
  const { mergePresets } = await import("./config.js");
  const {
    deepseekData,
    deepseekPresets,
    modelPricingData,
    modelPresets,
  } = await import("./model-pricing.js");
  const deepseek = presets.filter((rate) => rate.provider === "deepseek");
  assert.equal(deepseekData.models.length, 2);
  assert.deepEqual(
    modelPricingData.map((source) => source.provider),
    ["deepseek", "aliyun-bailian"],
  );
  assert.deepEqual(modelPresets, presets);
  assert.deepEqual(deepseekPresets, deepseek);
  assert.ok(deepseek.every((rate) => rate.currency === "CNY"));
  assert.deepEqual(
    deepseek.map((rate) => [rate.hit, rate.miss, rate.output]),
    [
      [0.02, 1, 4],
      [0.04, 2, 8],
      [0.15, 4.5, 13.5],
      [0.3, 9, 27],
    ],
  );
  const old = {
    ...deepseek[0],
    currency: "USD",
    hit: 0.003,
    miss: 0.15,
    output: 0.6,
  };
  const upgraded = mergePresets({ rates: [old] });
  assert.deepEqual(upgraded.rates[0], deepseek[0]);
  const customized = mergePresets({ rates: [{ ...old, modified: true }] });
  assert.deepEqual(customized.rates[0], deepseek[0]);
  const customRate = { ...old, id: "custom-rate", modified: true };
  const withCustomRate = mergePresets({ rates: [customRate] });
  assert.deepEqual(withCustomRate.rates[0], customRate);
});

test("全量 Schema 由数量与单个长度派生，忽略旧的独立配置", () => {
  assert.equal(defaults.single_tool_schema, 0.51);
  assert.equal(toTokens(defaults).full_tools_schema, 45900);
  const p = toTokens({
    ...defaults,
    tools_total: 100,
    single_tool_schema: 0.8,
    full_tools_schema: 999,
  });
  assert.equal(p.full_tools_schema, 80000);
  close(calculateFullLoad(p, presets[0]).initial_context, 85000);
  assert.equal(
    toTokens({ ...defaults, tools_total: 0, tools_per_round: 0 })
      .full_tools_schema,
    0,
  );
});

test("Skills Discovery List 由 Skills 总数与单个索引派生，Tools List 不暴露为参数", () => {
  assert.equal(defaults.tools_discovery_list, 1.2);
  assert.equal("skills_discovery_list" in defaults, false);
  assert.equal(toTokens(defaults).tools_discovery_list, 1200);
  assert.equal(toTokens(defaults).skills_discovery_list, 3000);
  const p = toTokens({
    ...defaults,
    skills_total: 12,
    single_skill_discovery: 0.25,
    skills_discovery_list: 999,
  });
  assert.equal(p.skills_discovery_list, 3000);
});
