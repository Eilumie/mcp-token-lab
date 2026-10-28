import test from "node:test";
import assert from "node:assert/strict";
import { modelPresets, bailianPresets, deepseekPresets, overseasPresets, bailianData, modelPricingData } from "./model-pricing.js";
import { createConfig, createPresetConfig, readConfig, validate } from "./config.js";
import { createComparisonConfig, readComparisonConfig, validateComparison } from "./comparison.js";
import { simulate } from "./session-report.js";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("全部费率数据及预设直接使用美元，固定、分档、分时及显式缓存保留原值", () => {
  assert.equal(new Set(modelPresets.map(p => p.id)).size, modelPresets.length);
  for (const preset of modelPresets) {
    assert.equal(preset.currency, "USD");
    assert.deepEqual(validate({ ...createConfig(), ...createPresetConfig(preset) }), {});
  }
  close(bailianData.models[0].prices.input, 12 / 6.6684);
  const first = bailianPresets[0];
  close(first.miss, 12 / 6.6684);
  close(first.hit, 1.5 / 6.6684);
  close(first.output, 36 / 6.6684);
  close(first.explicitCacheCreate, 15 / 6.6684);
  close(first.explicitCacheHit, 1 / 6.6684);
  close(bailianPresets.find(p => p.id === "bailian:qwen3.7-plus:tier-2").miss, 6 / 6.6684);
  close(deepseekPresets.find(p => p.id === "flash-peak").output, 1.2);
  assert.ok(modelPricingData.every(provider => provider.currency === "USD"));
});

test("海外模型保留官方美元价格、来源、分档及优惠说明", () => {
  for (const [id, prices] of [
    ["openai:gpt-6.1-sol:tier-1", [0.1, 2, 10]],
    ["openai:gpt-6.1-sol:tier-2", [0.2, 4, 20]],
    ["anthropic:claude-opus-5-5:fixed", [0.2, 2, 10]],
    ["anthropic:claude-haiku-5-5:tier-2", [0.05, 0.25, 1.25]],
    ["google:gemini-3.8-flash:fixed", [0.075, 0.75, 3.75]],
  ]) {
    const preset = overseasPresets.find(p => p.id === id);
    assert.deepEqual([preset.hit, preset.miss, preset.output], prices);
    assert.match(preset.source, /^https:\/\//);
    const config = { ...createConfig(), ...createPresetConfig(preset) };
    assert.deepEqual(readConfig(JSON.parse(JSON.stringify(config))), config);
    assert.ok(config.pricing.note);
  }
  assert.match(overseasPresets.find(p => p.actual === "gemini-4-argon").pricingNote, /2026-11-30/);
});

test("美元配置导入保留实际单价，导入导出不修改费率数值", () => {
  for (const currency of ["$"]) {
    const config = createConfig();
    config.model = { name: "自定义模型", currency, inputCachedPrice: 0, inputNotCachedPrice: 7, outputPrice: 14 };
    delete config.pricing;
    const snapshot = structuredClone(config);
    const imported = readConfig(config);
    assert.deepEqual(config, snapshot);
    assert.deepEqual(imported.model, { ...config.model, currency: "$" });
    assert.deepEqual(readConfig(imported), imported);
    config.model.inputNotCachedPrice = "7";
    assert.throws(() => readConfig(config), /单价/);
  }
  const invalid = createConfig();
  invalid.model.currency = "USD";
  assert.throws(() => readConfig(invalid), /美元/);
});

test("国内、海外模型可直接比较，导入保留 USD，费用守恒", () => {
  const config = createComparisonConfig();
  Object.assign(config.plans[0], createPresetConfig(bailianPresets[0]));
  Object.assign(config.plans[1], createPresetConfig(overseasPresets.find(p => p.actual === "claude-opus-5-5")));
  for (const plan of config.plans) {
    plan.useGlobal.model = false;
    plan.useGlobal.turnTotalCount = false;
    plan.simulation.turnTotalCount = 1;
    plan.simulation.flow = { initial: [{ type: "action", text: "输入", token: 1 }], turn: [{ type: "llm", text: "输出", token: 1 }] };
    plan.useGlobal.expectedPrefixCacheHitRate = false;
    plan.simulation.expectedPrefixCacheHitRate = 0;
  }
  assert.deepEqual(validateComparison(config), {});
  const results = simulate(config);
  close(results[0].cost.total, (12 + 36) / 6.6684 / 1000);
  close(results[1].cost.total, (2 + 10) / 1000);
  config.plans[0].model.outputPrice = 14;
  const imported = readComparisonConfig(config);
  assert.deepEqual(validateComparison(imported), {});
  assert.equal(imported.plans[0].model.outputPrice, 14);
  assert.deepEqual(imported.plans[1].model, config.plans[1].model);
});
