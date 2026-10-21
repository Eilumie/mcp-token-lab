import test from "node:test";
import assert from "node:assert/strict";
import { CNY_PER_USD, conversionNote } from "./currency.js";
import { modelPresets, bailianPresets, deepseekPresets, overseasPresets, bailianData } from "./model-pricing.js";
import { createConfig, createPresetConfig, readConfig, validate } from "./config.js";
import { createComparisonConfig, readComparisonConfig, validateComparison } from "./comparison.js";
import { simulate } from "./session-report.js";
import { buildCsv } from "./export.js";

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-10, `${actual} != ${expected}`);

test("全部预设为美元，人民币固定、分档、分时及显式缓存费率均实际换算", () => {
  assert.equal(new Set(modelPresets.map(p => p.id)).size, modelPresets.length);
  for (const preset of modelPresets) {
    assert.equal(preset.currency, "USD");
    assert.deepEqual(validate({ ...createConfig(), ...createPresetConfig(preset) }), {});
  }
  assert.equal(bailianData.models[0].prices.input, 12);
  const first = bailianPresets[0];
  close(first.miss, 12 / CNY_PER_USD);
  close(first.hit, 1.5 / CNY_PER_USD);
  close(first.output, 36 / CNY_PER_USD);
  close(first.explicitCacheCreate, 15 / CNY_PER_USD);
  close(first.explicitCacheHit, 1 / CNY_PER_USD);
  close(bailianPresets.find(p => p.id === "bailian:qwen3.7-plus:tier-2").miss, 6 / CNY_PER_USD);
  close(deepseekPresets.find(p => p.id === "flash-peak").output, 8 / CNY_PER_USD);
  assert.ok([...bailianPresets, ...deepseekPresets].every(p => p.conversionNote === conversionNote));
});

test("海外模型保留官方美元价格、来源、分档及优惠说明", () => {
  for (const [id, prices] of [
    ["openai:gpt-6.1-sol:tier-1", [0.1, 2, 10]],
    ["openai:gpt-6.1-sol:tier-2", [0.2, 4, 15]],
    ["anthropic:claude-opus-5-5:fixed", [0.2, 4, 20]],
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
});

test("人民币旧配置导入转换实际单价，保持输入不变，美元再次导入不重复换算", () => {
  for (const currency of ["¥", "CNY"]) {
    const legacy = createConfig();
    legacy.model = { name: "历史自定义", currency, inputCachedPrice: 0, inputNotCachedPrice: 7, outputPrice: 14 };
    delete legacy.pricing;
    const snapshot = structuredClone(legacy);
    const converted = readConfig(legacy);
    assert.deepEqual(legacy, snapshot);
    assert.deepEqual(converted.model, { name: "历史自定义", currency: "$", inputCachedPrice: 0, inputNotCachedPrice: 1, outputPrice: 2 });
    assert.equal(converted.pricing.conversionNote, conversionNote);
    assert.deepEqual(readConfig(converted), converted);
    legacy.model.inputNotCachedPrice = "7";
    assert.throws(() => readConfig(legacy), /单价/);
  }
  const old = createConfig();
  old.version = 2;
  old.model = { name: "旧模型", currency: "¥", inputCachedPrice: 0.7, inputNotCachedPrice: 7, outputPrice: 14 };
  assert.ok(readComparisonConfig(old).plans.every(p => p.model.currency === "$" && p.model.outputPrice === 2));
});

test("国内、海外模型可直接比较，混合旧币种导入与 CSV 均为 USD，费用守恒", () => {
  const config = createComparisonConfig();
  Object.assign(config.plans[0], createPresetConfig(bailianPresets[0]));
  Object.assign(config.plans[1], createPresetConfig(overseasPresets.find(p => p.actual === "claude-opus-5-5")));
  for (const plan of config.plans) {
    plan.simulation.turnTotalCount = 1;
    plan.simulation.flow = { initial: [{ type: "action", text: "输入", token: 1 }], turn: [{ type: "llm", text: "输出", token: 1 }] };
    plan.simulation.expectedPrefixCacheHitRate = 0;
  }
  assert.deepEqual(validateComparison(config), {});
  const results = simulate(config);
  close(results[0].cost.total, (12 + 36) / CNY_PER_USD / 1000);
  close(results[1].cost.total, (4 + 20) / 1000);
  for (const kind of ["sources", "requests"]) {
    const csv = buildCsv(results, config, kind);
    assert.ok(csv.includes('"K","USD"'));
    assert.ok(!csv.includes('"CNY"'));
  }
  config.plans[0].model.currency = "¥";
  config.plans[0].model.outputPrice = 14;
  const imported = readComparisonConfig(config);
  assert.deepEqual(validateComparison(imported), {});
  assert.equal(imported.plans[0].model.outputPrice, 2);
  assert.deepEqual(imported.plans[1].model, config.plans[1].model);
});
