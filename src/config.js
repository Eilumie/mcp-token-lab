import { bailianPresets } from "./bailian-pricing.js";
// Token 参数以 K 展示，进入计算器时统一转为 Token。
export const groups = [
  [
    "会话规模",
    [
      ["rounds", "会话轮次", 10, "轮"],
      ["skills_total", "Skills 总数", 30, "个"],
      ["tools_total", "Tools 总数", 90, "个"],
      ["skills_per_round", "每轮平均 Skills", 0.33, "个"],
      ["tools_per_round", "每轮平均 Tools", 1.5, "个"],
    ],
  ],
  [
    "初始上下文",
    [
      ["agent_prompt", "Agent Prompt", 2, "K"],
      ["tools_discovery_list", "Tools Discovery List", 1.2, "K"],
      ["skills_discovery_list", "Skills Discovery List", 3, "K"],
      ["single_tool_schema", "单个 Tool Schema", 0.51, "K"],
    ],
  ],
  [
    "每轮内容",
    [
      ["user_message", "用户消息", 0.1, "K"],
      ["skill_content", "单个 Skill 内容", 3, "K"],
      ["tool_result", "单个 Tool Result", 3, "K"],
      ["read_skills_plan", "读取技能计划", 0.1, "K"],
      ["query_schema_plan", "查询 Schema 计划", 0.1, "K"],
      ["call_tools_plan", "调用工具计划", 0.1, "K"],
      ["agent_reply", "Agent 最终回复", 1, "K"],
    ],
  ],
];
export const fields = groups.flatMap(([, fields]) => fields);
export const defaults = Object.fromEntries(
  fields.map(([id, , value]) => [id, value]),
);
const deepseekPresets = [
  {
    id: "flash-off",
    name: "DeepSeek V4 Flash · 非高峰",
    actual: "DeepSeek-V4.1-Flash",
    period: "非高峰",
    hit: 0.003,
    miss: 0.15,
    output: 0.6,
  },
  {
    id: "flash-peak",
    name: "DeepSeek V4 Flash · 高峰",
    actual: "DeepSeek-V4.1-Flash",
    period: "高峰",
    hit: 0.006,
    miss: 0.3,
    output: 1.2,
  },
  {
    id: "pro-off",
    name: "DeepSeek V4 Pro · 非高峰",
    actual: "DeepSeek-V4-Pro-0813",
    period: "非高峰",
    hit: 0.022,
    miss: 0.66,
    output: 1.98,
  },
  {
    id: "pro-peak",
    name: "DeepSeek V4 Pro · 高峰",
    actual: "DeepSeek-V4-Pro-0813",
    period: "高峰",
    hit: 0.044,
    miss: 1.32,
    output: 3.96,
  },
].map((x) => ({
  ...x,
  currency: "USD",
  source: "https://api-docs.deepseek.com/quick_start/pricing/",
  verified: "2026-09-21",
}));
export const presets = [...deepseekPresets, ...bailianPresets];

// 补充新增预设，同时保留用户已有参数及自定义费率。
export function mergePresets(config) {
  const ids = new Set(config.rates.map((r) => r.id));
  return {
    ...config,
    rates: [
      ...config.rates,
      ...structuredClone(presets.filter((r) => !ids.has(r.id))),
    ],
  };
}

export function validate(values, rate) {
  const errors = {};
  for (const [id, label] of fields) {
    if (
      typeof values[id] !== "number" ||
      !Number.isFinite(values[id]) ||
      Number(values[id]) < 0
    )
      errors[id] = `${label}必须为非负有限数值`;
  }
  for (const id of ["rounds", "skills_total", "tools_total"])
    if (!Number.isInteger(Number(values[id]))) errors[id] = "请输入整数";
  if (values.rounds < 1 || values.rounds > 10000)
    errors.rounds = "轮次范围为 1–10,000";
  if (+values.skills_per_round > +values.skills_total)
    errors.skills_per_round = "不能超过 Skills 总数";
  if (+values.tools_per_round > +values.tools_total)
    errors.tools_per_round = "不能超过 Tools 总数";
  for (const id of ["hit", "miss", "output"])
    if (
      typeof rate[id] !== "number" ||
      !Number.isFinite(rate[id]) ||
      +rate[id] < 0
    )
      errors[id] = "费率必须为非负有限数值";
  return errors;
}
export function toTokens(values) {
  const tokens = Object.fromEntries(
    fields.map(([id, , , unit]) => [
      id,
      Number(values[id]) * (unit === "K" ? 1000 : 1),
    ]),
  );
  tokens.full_tools_schema = tokens.tools_total * tokens.single_tool_schema;
  return tokens;
}

export function readConfig(data) {
  if (
    data.version !== 1 ||
    !data.values ||
    !Array.isArray(data.rates) ||
    !data.rates.length ||
    typeof data.cold !== "boolean"
  )
    throw Error("配置格式不正确");
  if (new Set(data.rates.map((r) => r.id)).size !== data.rates.length)
    throw Error("模型 ID 重复");
  for (const rate of data.rates) {
    if (
      ["id", "name", "actual", "period", "currency", "source", "verified"].some(
        (k) => typeof rate[k] !== "string",
      ) ||
      !["USD", "CNY"].includes(rate.currency) ||
      !rate.id ||
      !rate.name
    )
      throw Error("模型信息不完整");
    if (Object.keys(validate(data.values, rate)).length)
      throw Error("参数或费率不合法");
  }
  if (!data.rates.some((r) => r.id === data.selected))
    throw Error("所选模型不存在");
  return data;
}
