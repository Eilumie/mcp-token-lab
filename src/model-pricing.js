// 费率以 USD / 1M tokens 维护；数据不会自动联网更新。CNY 原价按注明的固定汇率折算。
export const deepseekData = {
  provider: "deepseek",
  provider_name: "DeepSeek",
  currency: "USD",
  price_unit: "per_1m_tokens",
  source: "https://api-docs.deepseek.com/quick_start/pricing/",
  verified_at: "2026-10-30",
  models: [
    {
      id: "deepseek-flash",
      name: "DeepSeek V4.1 Flash 1017",
      pricing_type: "time_based",
      preset_ids: { off_peak: "flash-off", peak: "flash-peak" },
      price_periods: {
        off_peak: { input: 0.15, input_cache_hit: 0.003, output: 0.6 },
        peak: { input: 0.3, input_cache_hit: 0.006, output: 1.2 },
      },
    },
    {
      id: "DeepSeek-V4-Pro-0813",
      name: "DeepSeek V4 Pro",
      pricing_type: "time_based",
      preset_ids: { off_peak: "pro-off", peak: "pro-peak" },
      price_periods: {
        off_peak: { input: 0.66, input_cache_hit: 0.022, output: 1.98 },
        peak: { input: 1.32, input_cache_hit: 0.044, output: 3.96 },
      },
    },
  ],
};

// 百炼北京区费率快照；官方按人民币报价，按 2026-10-27 的 USD/CNY 6.6684 折算为 USD。
export const bailianData = {
  provider: "aliyun-bailian",
  region: "cn-beijing",
  region_name: "华北2（北京）",
  currency: "USD",
  price_unit: "per_1m_tokens",
  verified_at: "2026-10-30",
  models: [
    {
      id: "qwen3.8-max",
      name: "Qwen3.8 Max",
      sourceLabel: "缓存费率待核验",
      pricingNote: "输入和输出采用官方目录价；特殊缓存单价保留历史快照，尚未独立核验，请以百炼控制台为准。",
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
      pricingNote: "采用未折扣目录价；官网当前标有限时八折，未计入本预设，活动及缓存优惠叠加规则以百炼账单为准。",
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
      sourceLabel: "缓存费率待核验",
      pricingNote: "输入和输出采用官方目录价；特殊缓存单价保留历史快照，尚未独立核验，请以百炼控制台为准。",
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
      pricing_type: "tiered",
      price_tiers: [
        { input_tokens_gt: 0, input_tokens_lte: 512000, prices: { input: 2.1, input_cache_hit: 0.42, output: 8.4 } },
        { input_tokens_gt: 512000, input_tokens_lte: 1048576, prices: { input: 4.2, input_cache_hit: 0.84, output: 16.8 } },
      ],
    },
  ],
};

// 百炼官方价格以人民币发布。将该目录下所有数字费率一次性静态折算为美元，
// 保留原有 tier/time-period 结构与模型 ID，避免历史配置失效。
const CNY_PER_USD = 6.6684;
const convertPrices = (prices) => Object.fromEntries(
  Object.entries(prices).map(([key, value]) => [key, value / CNY_PER_USD]),
);
bailianData.models = bailianData.models.map((model) => ({
  ...model,
  ...(model.prices ? { prices: convertPrices(model.prices) } : {}),
  ...(model.price_tiers ? { price_tiers: model.price_tiers.map((tier) => ({ ...tier, prices: convertPrices(tier.prices) })) } : {}),
  ...(model.price_periods ? { price_periods: Object.fromEntries(Object.entries(model.price_periods).map(([period, prices]) => [period, convertPrices(prices)])) } : {}),
}));

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
    name: `${model.vendor && model.vendor !== "Alibaba Cloud" ? model.vendor : "百炼"} · ${model.name} · ${label}`,
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
    source: "https://help.aliyun.com/zh/model-studio/model-pricing",
    verified: bailianData.verified_at,
    sourceLabel: model.sourceLabel || "官方人民币价按固定汇率折算",
    pricingNote: [
      "百炼北京区人民币目录价按 2026-10-27 USD/CNY 6.6684 折算，汇率不自动更新。",
      tier
        ? "手动固定档位模拟：每次请求输入量 > 下限且 ≤ 上限；不自动跨档。"
        : model.price_periods
          ? "整个会话按所选闲时 / 忙时价格计算；原数据未提供时段边界。"
          : "整个会话采用固定价格。",
      model.pricingNote,
    ].filter(Boolean).join(" "),
  }));
});

const periodLabels = { off_peak: "非高峰", peak: "高峰" };

export const deepseekPresets = deepseekData.models.flatMap((model) =>
  Object.entries(model.price_periods).map(([period, prices]) => ({
    id: model.preset_ids[period],
    name: `${deepseekData.provider_name} · ${model.name} · ${periodLabels[period]}`,
    actual: model.id,
    provider: deepseekData.provider,
    currency: deepseekData.currency,
    period: periodLabels[period],
    hit: prices.input_cache_hit,
    miss: prices.input,
    output: prices.output,
    source: deepseekData.source,
    sourceLabel: "官方美元费率快照",
    verified: deepseekData.verified_at,
    pricingNote: "离峰 / 高峰按官方 UTC 时段计费；峰时费率为离峰两倍。",
  })),
);

const fixedModel = (id, name, input, hit, output, pricingNote = "") => ({
  id, name, pricing_type: "fixed", prices: { input, input_cache_hit: hit, output }, pricingNote,
});

export const openaiData = {
  provider: "openai", provider_name: "OpenAI", currency: "USD", price_unit: "per_1m_tokens",
  source: "https://developers.openai.com/api/docs/pricing", verified_at: "2026-10-30",
  pricingNote: "Standard 文本价格，短上下文为输入 ≤272K，长上下文为输入 >272K；手动固定档位，不自动跨档；不包含缓存写入、工具调用和地区附加费用。",
  models: [
    ["gpt-6-astra", "GPT-6 Astra", 10, 1, 50, 20, 2, 75],
    ["gpt-6.1-sol", "GPT-6.1 Sol", 2, 0.1, 10, 4, 0.2, 15],
    ["gpt-6-luna", "GPT-6 Luna", 0.1, 0.01, 0.5, 0.2, 0.02, 0.75],
    ["gpt-6.1-terra", "GPT-6.1 Terra", 1, 0.05, 5, 2, 0.1, 7.5],
  ].map(([id, name, input, hit, output, longInput, longHit, longOutput]) => ({
    id, name, pricing_type: "tiered",
    price_tiers: [
      { label: "短上下文", prices: { input, input_cache_hit: hit, output } },
      { label: "长上下文", prices: { input: longInput, input_cache_hit: longHit, output: longOutput } },
    ],
  })),
};

export const claudeData = {
  provider: "anthropic", provider_name: "Anthropic", currency: "USD", price_unit: "per_1m_tokens",
  source: "https://platform.claude.com/docs/en/about-claude/pricing", verified_at: "2026-10-30",
  pricingNote: "Claude API 标准文本价格；命中输入采用缓存读取价格，未命中输入采用基础输入价格，不包含缓存写入、工具调用和地区附加费用。",
  models: [
    fixedModel("claude-fable-5-1", "Claude Fable 5.1", 10, 0.25, 50),
    fixedModel("claude-opus-5-5", "Claude Opus 5.5", 4, 0.2, 20),
    fixedModel("claude-sonnet-5-5", "Claude Sonnet 5.5", 2, 0.1, 10),
    { id: "claude-haiku-5-5", name: "Claude Haiku 5.5", pricing_type: "tiered", price_tiers: [
      { label: "≤100K 输入", input_tokens_gt: 0, input_tokens_lte: 100000, prices: { input: 0.1, input_cache_hit: 0.01, output: 0.5 } },
      { label: ">100K 输入", input_tokens_gt: 100000, input_tokens_lte: Number.MAX_SAFE_INTEGER, prices: { input: 0.5, input_cache_hit: 0.05, output: 2.5 } },
    ] },
  ],
};

export const geminiData = {
  provider: "google", provider_name: "Google Gemini", currency: "USD", price_unit: "per_1m_tokens",
  source: "https://ai.google.dev/gemini-api/docs/pricing", verified_at: "2026-10-30",
  pricingNote: "Gemini API 付费 Standard 文本价格，输出含思考 Token；不包含缓存存储、搜索及其他工具费用。",
  models: [
    fixedModel("gemini-4-argon", "Gemini 4 Argon", 2, 0.1, 10, "优惠价格截至 2026-11-30；仅支持隐式缓存。2026-12-01 起输入 / 命中 / 输出为 $4 / $0.2 / $20。"),
    fixedModel("gemini-3.8-flash", "Gemini 3.8 Flash", 0.75, 0.075, 3.75, "优惠价格截至 2026-12-31；2027-01-01 起输入 / 命中 / 输出为 $1.5 / $0.15 / $7.5，需手动更新费率。"),
    fixedModel("gemini-3.5-flash-lite", "Gemini 3.5 Flash-Lite", 0.3, 0.03, 2.5),
  ],
};

export const mistralData = {
  provider: "mistral", provider_name: "Mistral AI", currency: "USD", price_unit: "per_1m_tokens",
  source: "https://docs.mistral.ai/inference/pricing", verified_at: "2026-10-27",
  pricingNote: "Mistral API 标准文本费率；仅保留当前常用的旗舰、大众与轻量型号。",
  models: [
    fixedModel("mistral-large-3", "Mistral Large 3", 0.5, 0.05, 1.5),
    fixedModel("mistral-medium-3.5", "Mistral Medium 3.5", 1.5, 0.15, 7.5),
    fixedModel("mistral-small-4", "Mistral Small 4", 0.15, 0.015, 0.6),
  ],
};

const grokModel = (id, name, contextWindow, short, long, pricingNote = "") => ({
  id,
  name,
  context_window: contextWindow,
  pricing_type: "tiered",
  price_tiers: [
    { label: "<200K 输入", input_tokens_gt: 0, input_tokens_lte: 199999, prices: { input: short[0], input_cache_hit: short[1], output: short[2] } },
    { label: "≥200K 输入", input_tokens_gt: 199999, input_tokens_lte: contextWindow, prices: { input: long[0], input_cache_hit: long[1], output: long[2] } },
  ],
  pricingNote,
});

export const xaiData = {
  provider: "xai", provider_name: "xAI (Grok)", currency: "USD", price_unit: "per_1m_tokens",
  source: "https://docs.x.ai/developers/pricing", verified_at: "2026-10-27",
  pricingNote: "xAI API 标准文本价格；输入上下文达到 200K 后整次请求按长上下文价格计算。缓存写入不另收费。",
  models: [
    grokModel("grok-4.7", "Grok 4.7", 500000, [2, 0.5, 6], [4, 1, 12]),
    grokModel("grok-4.6", "Grok 4.6", 500000, [2, 0.5, 6], [4, 1, 12]),
    grokModel("grok-4.5", "Grok 4.5", 500000, [2, 0.3, 6], [4, 0.6, 12]),
  ],
};

export const overseasPresets = [openaiData, claudeData, geminiData, xaiData, mistralData].flatMap(provider => provider.models.flatMap(model => {
  const variants = model.price_tiers ?? [{ label: "标准价格", prices: model.prices }];
  return variants.map((variant, index) => ({
    id: `${provider.provider}:${model.id}:${model.price_tiers ? `tier-${index + 1}` : "fixed"}`,
    name: `${provider.provider_name} · ${model.name} · ${variant.label}`,
    actual: model.id, provider: provider.provider, currency: "USD", period: variant.label,
    hit: variant.prices.input_cache_hit, miss: variant.prices.input, output: variant.prices.output,
    ...(Number.isFinite(variant.input_tokens_gt) ? { tier: { input_tokens_gt: variant.input_tokens_gt, input_tokens_lte: variant.input_tokens_lte } } : {}),
    source: provider.source, verified: provider.verified_at, sourceLabel: "官方美元费率快照",
    pricingNote: [provider.pricingNote, model.pricingNote, model.price_tiers ? "整个会话按所选固定档位估算，不自动跨档。" : ""].filter(Boolean).join(" "),
  }));
}));

export const modelPricingData = [deepseekData, bailianData, openaiData, claudeData, geminiData, mistralData, xaiData];

const bailianVendorPriority = { "Alibaba Cloud": 0, "Zhipu AI": 1, "Moonshot AI": 2, MiniMax: 3 };
const rankedBailianPresets = [...bailianPresets].sort(
  (a, b) => (bailianVendorPriority[a.vendor] ?? 99) - (bailianVendorPriority[b.vendor] ?? 99),
);

// 下拉列表按全球厂商影响力排列，默认模型使用第一项。
export const modelPresets = [
  ...overseasPresets.filter((preset) => ["openai", "anthropic", "google", "xai"].includes(preset.provider)),
  ...deepseekPresets,
  ...overseasPresets.filter((preset) => preset.provider === "mistral"),
  ...rankedBailianPresets,
];
export const defaultModelPreset = modelPresets[0];
