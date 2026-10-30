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
    ["openai:gpt-6-astra:tier-2", [2, 20, 75]],
    ["openai:gpt-6.1-sol:tier-2", [0.2, 4, 15]],
    ["openai:gpt-6.1-terra:tier-2", [0.1, 2, 7.5]],
    ["openai:gpt-6-luna:tier-2", [0.02, 0.2, 0.75]],
    ["anthropic:claude-fable-5-1:fixed", [0.25, 10, 50]],
    ["anthropic:claude-opus-5-5:fixed", [0.2, 4, 20]],
    ["anthropic:claude-sonnet-5-5:fixed", [0.1, 2, 10]],
    ["anthropic:claude-haiku-5-5:tier-1", [0.01, 0.1, 0.5]],
    ["anthropic:claude-haiku-5-5:tier-2", [0.05, 0.5, 2.5]],
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
  assert.match(overseasPresets.find(p => p.actual === "gemini-3.8-flash").pricingNote, /2026-12-31.*2027-01-01/);
  assert.match(overseasPresets.find(p => p.actual === "gpt-6.1-sol").pricingNote, /≤272K.*>272K/);
});

test("百炼 MiniMax 使用北京区人民币价格折算，来源与模型渠道一致", () => {
  for (const [id, cnyPrices] of [
    ["bailian:MiniMax/MiniMax-M3:tier-1", [2.1, 0.42, 8.4]],
    ["bailian:MiniMax/MiniMax-M3:tier-2", [4.2, 0.84, 16.8]],
  ]) {
    const preset = bailianPresets.find(p => p.id === id);
    [preset.miss, preset.hit, preset.output].forEach((price, index) => close(price, cnyPrices[index] / 6.6684));
    assert.equal(preset.provider, "aliyun-bailian");
    assert.equal(preset.region, "华北2（北京）");
    assert.equal(preset.source, "https://help.aliyun.com/zh/model-studio/model-pricing");
    assert.equal(preset.sourceLabel, "官方人民币价按固定汇率折算");
  }
  assert.ok(bailianPresets.every(preset => preset.region === "华北2（北京）"));
});

test("Grok 在 200K 输入时属于长上下文，标签与档位边界一致", () => {
  for (const model of ["grok-4.7", "grok-4.6", "grok-4.5"]) {
    const short = overseasPresets.find(p => p.id === `xai:${model}:tier-1`);
    const long = overseasPresets.find(p => p.id === `xai:${model}:tier-2`);
    assert.equal(short.period, "<200K 输入");
    assert.equal(long.period, "≥200K 输入");
    assert.equal(short.tier.input_tokens_lte, 199999);
    assert.equal(long.tier.input_tokens_gt, 199999);
  }
});

test("Qwen 的特殊缓存价和未计入的活动价明确说明", () => {
  for (const model of ["qwen3.8-max", "qwen3.8-flash"]) {
    const preset = bailianPresets.find(p => p.actual === model);
    assert.equal(preset.sourceLabel, "缓存费率待核验");
    assert.match(preset.pricingNote, /尚未独立核验.*百炼控制台/);
  }
  for (const preset of bailianPresets.filter(p => p.actual === "qwen3.7-plus")) {
    assert.match(preset.pricingNote, /未折扣目录价.*限时八折.*未计入本预设/);
  }
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
  close(results[1].cost.total, (4 + 20) / 1000);
  config.plans[0].model.outputPrice = 14;
  const imported = readComparisonConfig(config);
  assert.deepEqual(validateComparison(imported), {});
  assert.equal(imported.plans[0].model.outputPrice, 14);
  assert.deepEqual(imported.plans[1].model, config.plans[1].model);
});
