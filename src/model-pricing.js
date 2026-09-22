// 所有官方模型费率快照统一维护在此文件；数据不会自动联网更新。
export const deepseekData = {
  provider: "deepseek",
  provider_name: "DeepSeek",
  currency: "CNY",
  price_unit: "per_1m_tokens",
  source: "https://api-docs.deepseek.com/zh-cn/quick_start/pricing/",
  verified_at: "2026-09-22",
  models: [
    {
      id: "DeepSeek-V4.1-Flash",
      name: "DeepSeek V4.1 Flash",
      pricing_type: "time_based",
      preset_ids: { off_peak: "flash-off", peak: "flash-peak" },
      price_periods: {
        off_peak: { input: 1, input_cache_hit: 0.02, output: 4 },
        peak: { input: 2, input_cache_hit: 0.04, output: 8 },
      },
    },
    {
      id: "DeepSeek-V4-Pro-0813",
      name: "DeepSeek V4 Pro",
      pricing_type: "time_based",
      preset_ids: { off_peak: "pro-off", peak: "pro-peak" },
      price_periods: {
        off_peak: { input: 4.5, input_cache_hit: 0.15, output: 13.5 },
        peak: { input: 9, input_cache_hit: 0.3, output: 27 },
      },
    },
  ],
};

// 用户提供的百炼北京区费率快照；不代表联网核实。
export const bailianData = {
  provider: "aliyun-bailian",
  region: "cn-beijing",
  region_name: "华北2（北京）",
  currency: "CNY",
  price_unit: "per_1m_tokens",
  verified_at: "2026-09-21",
  models: [
    {
      id: "qwen3.8-max",
      name: "Qwen3.8 Max",
      vendor: "Alibaba Cloud",
      context_window: 1000000,
      pricing_type: "fixed",
      prices: {
        input: 12,
        input_cache_hit: 1.5,
        output: 36,
        explicit_cache_create: 15,
        explicit_cache_hit: 1,
      },
    },
    {
      id: "qwen3.7-plus",
      name: "Qwen3.7 Plus",
      vendor: "Alibaba Cloud",
      context_window: 1000000,
      pricing_type: "tiered",
      price_tiers: [
        {
          input_tokens_gt: 0,
          input_tokens_lte: 256000,
          prices: {
            input: 2,
            input_cache_hit: 0.4,
            output: 8,
            explicit_cache_create: 2.5,
            explicit_cache_hit: 0.2,
          },
        },
        {
          input_tokens_gt: 256000,
          input_tokens_lte: 1000000,
          prices: {
            input: 6,
            input_cache_hit: 1.2,
            output: 24,
            explicit_cache_create: 7.5,
            explicit_cache_hit: 0.6,
          },
        },
      ],
    },
    {
      id: "qwen3.8-flash",
      name: "Qwen3.8 Flash",
      vendor: "Alibaba Cloud",
      context_window: 1000000,
      pricing_type: "fixed",
      prices: {
        input: 0.8,
        input_cache_hit: 0.1,
        output: 2.7,
        explicit_cache_create: 1.25,
        explicit_cache_hit: 0.1,
      },
    },
    {
      id: "deepseek-v4.1-flash",
      name: "DeepSeek V4.1 Flash",
      vendor: "Alibaba Cloud",
      context_window: 1000000,
      pricing_type: "time_based",
      price_periods: {
        idle: {
          input: 1,
          input_cache_hit: 0.1,
          output: 4,
        },
        busy: {
          input: 2,
          input_cache_hit: 0.2,
          output: 8,
        },
      },
    },
    {
      id: "deepseek-v4-flash",
      name: "DeepSeek V4 Flash",
      vendor: "Alibaba Cloud",
      context_window: 1000000,
      pricing_type: "fixed",
      prices: {
        input: 1,
        input_cache_hit: 0.2,
        output: 2,
      },
    },
    {
      id: "deepseek-v4-pro",
      name: "DeepSeek V4 Pro",
      vendor: "Alibaba Cloud",
      context_window: 1000000,
      pricing_type: "fixed",
      prices: {
        input: 12,
        input_cache_hit: 1,
        output: 24,
      },
    },
    {
      id: "deepseek-v4-pro-0813",
      name: "DeepSeek V4 Pro 0813",
      vendor: "Alibaba Cloud",
      context_window: 1000000,
      pricing_type: "time_based",
      price_periods: {
        idle: {
          input: 4.5,
          input_cache_hit: 0.45,
          output: 13.5,
        },
        busy: {
          input: 9,
          input_cache_hit: 0.9,
          output: 27,
        },
      },
    },
    {
      id: "kimi-k3",
      name: "Kimi K3",
      vendor: "Alibaba Cloud",
      context_window: 1000000,
      pricing_type: "fixed",
      prices: {
        input: 20,
        input_cache_hit: 2,
        output: 100,
      },
    },
    {
      id: "kimi/kimi-k3",
      name: "Kimi K3 (Moonshot)",
      vendor: "Moonshot AI",
      context_window: 1048576,
      pricing_type: "fixed",
      prices: {
        input: 20,
        input_cache_hit: 2,
        output: 100,
      },
    },
    {
      id: "glm-5.2",
      name: "GLM-5.2",
      vendor: "Alibaba Cloud",
      context_window: 1048576,
      pricing_type: "fixed",
      prices: {
        input: 8,
        input_cache_hit: 2,
        output: 28,
      },
    },
    {
      id: "glm-5.3",
      name: "GLM-5.3",
      vendor: "Alibaba Cloud",
      context_window: 1048576,
      pricing_type: "fixed",
      prices: {
        input: 8,
        input_cache_hit: 2,
        output: 28,
      },
    },
    {
      id: "ZHIPU/GLM-5.3",
      name: "GLM-5.3 (ZHIPU)",
      vendor: "Zhipu AI",
      context_window: 1048576,
      pricing_type: "fixed",
      prices: {
        input: 8,
        input_cache_hit: 2,
        output: 28,
      },
    },
    {
      id: "ZHIPU/GLM-5.3-Flash",
      name: "GLM-5.3 Flash (ZHIPU)",
      vendor: "Zhipu AI",
      context_window: 1048576,
      pricing_type: "fixed",
      prices: {
        input: 0.8,
        input_cache_hit: 0.23,
        output: 2.8,
      },
    },
    {
      id: "MiniMax/MiniMax-M3",
      name: "MiniMax M3",
      vendor: "MiniMax",
      context_window: 1048576,
      pricing_type: "fixed",
      prices: {
        input: 4.2,
        input_cache_hit: 0.84,
        output: 16.8,
      },
    },
    {
      id: "xiaomi/mimo-v2.5-pro",
      name: "MiMo V2.5 Pro",
      vendor: "Xiaomi MiMo",
      context_window: 1048576,
      pricing_type: "fixed",
      prices: {
        input: 7,
        input_cache_hit: 1.4,
        output: 21,
      },
    },
  ],
};

export const bailianPresets = bailianData.models.flatMap((model) => {
  const variants = model.price_tiers
    ? model.price_tiers.map((tier, index) => ({
        suffix: `tier-${index + 1}`,
        label: `${tier.input_tokens_gt / 1000}K–${tier.input_tokens_lte / 1000}K 输入`,
        prices: tier.prices,
        tier: tier ?? null,
      }))
    : model.price_periods
      ? Object.entries(model.price_periods).map(([period, prices]) => ({
          suffix: period,
          label: period === "idle" ? "闲时" : "忙时",
          prices,
        }))
      : [{ suffix: "fixed", label: "固定价格", prices: model.prices }];
  return variants.map(({ suffix, label, prices, tier }) => ({
    id: `bailian:${model.id}:${suffix}`,
    name: `百炼 · ${model.name} · ${label}`,
    actual: model.id,
    provider: bailianData.provider,
    vendor: model.vendor,
    region: bailianData.region_name,
    currency: bailianData.currency,
    period: label,
    hit: prices.input_cache_hit,
    miss: prices.input,
    output: prices.output,
    explicitCacheCreate: prices.explicit_cache_create ?? null,
    explicitCacheHit: prices.explicit_cache_hit ?? null,
    contextWindow: model.context_window,
    tier: tier ?? null,
    source: "",
    verified: bailianData.verified_at,
    sourceLabel: "用户提供的费率快照",
    pricingNote: tier
      ? "手动固定档位模拟：每次请求输入量 > 下限且 ≤ 上限；不自动跨档。"
      : model.price_periods
        ? "整个会话按所选闲时 / 忙时价格计算；原数据未提供时段边界。"
        : "整个会话采用固定价格。",
  }));
});

const periodLabels = { off_peak: "非高峰", peak: "高峰" };

export const deepseekPresets = deepseekData.models.flatMap((model) =>
  Object.entries(model.price_periods).map(([period, prices]) => ({
    id: model.preset_ids[period],
    name: `${model.name} · ${periodLabels[period]}`,
    actual: model.id,
    provider: deepseekData.provider,
    currency: deepseekData.currency,
    period: periodLabels[period],
    hit: prices.input_cache_hit,
    miss: prices.input,
    output: prices.output,
    source: deepseekData.source,
    verified: deepseekData.verified_at,
  })),
);

export const modelPricingData = [deepseekData, bailianData];

// DeepSeek 保持为默认选项，百炼模型随后展示。
export const modelPresets = [...bailianPresets, ...deepseekPresets];
