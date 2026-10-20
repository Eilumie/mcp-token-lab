import { createConfig, readConfig, validate } from "./config.js";
import { toolsModes } from "./session-flow.js";

export const planColors = ["#5869d9", "#d99b61", "#449b87", "#9a76c3", "#5c9ebd", "#c77891", "#9b9b4d", "#768397"];
export const maxPlans = 8;
export const modeLabel = mode => mode === "FULL_TOOLS_SCHEMA" ? "全量加载" : "按需加载";

export function createPlan({ source, name = "自定义方案", toolsMode = "LAZY_TOOLS_SCHEMA", id = crypto.randomUUID(), color = planColors[0] } = {}) {
  const base = source ? structuredClone(source) : createConfig();
  return {
    id, name, color, toolsMode: source?.toolsMode ?? toolsMode,
    simulation: base.simulation, model: base.model, pricing: base.pricing,
  };
}

export function createComparisonConfig(legacy) {
  const plans = toolsModes.map((toolsMode, index) => {
    const plan = createPlan({
      source: legacy, toolsMode, id: index ? "plan-full" : "plan-lazy",
      name: index ? "全量 Tools" : "按需 Tools", color: planColors[index],
    });
    plan.toolsMode = toolsMode;
    return plan;
  });
  return { version: 3, unit: "K", baselineId: plans[1].id, plans };
}

export function validatePlan(plan) {
  if (!plan || typeof plan !== "object" || !plan.simulation || !plan.model) return { plan: "方案缺少参数或模型配置" };
  const errors = validate(plan);
  if (typeof plan.id !== "string" || !plan.id.trim()) errors.id = "方案需要唯一标识";
  if (typeof plan.name !== "string" || !plan.name.trim() || plan.name.length > 60) errors.planName = "方案名称需为 1–60 个字符";
  if (!toolsModes.includes(plan.toolsMode)) errors.toolsMode = "请选择工具加载方式";
  if (!planColors.includes(plan.color)) errors.color = "方案颜色无效";
  return errors;
}

export function validateComparison(config) {
  const errors = {};
  if (!Array.isArray(config?.plans) || config.plans.length > maxPlans) return { plans: `最多对比 ${maxPlans} 个方案` };
  const ids = new Set(), names = new Set();
  config.plans.forEach((plan, index) => {
    for (const [key, message] of Object.entries(validatePlan(plan))) errors[`plans.${index}.${key}`] = `方案 ${index + 1}：${message}`;
    if (!plan || typeof plan !== "object") return;
    if (ids.has(plan.id)) errors[`plans.${index}.id`] = "方案标识不能重复";
    if (typeof plan.name === "string" && names.has(plan.name.trim())) errors[`plans.${index}.planName`] = "方案名称不能重复";
    ids.add(plan.id);
    names.add(plan.name?.trim?.());
    if (plan.model?.currency !== config.plans[0]?.model?.currency) errors.currency = "对比方案需使用相同币种";
  });
  if (config.plans.length ? !ids.has(config.baselineId) : config.baselineId !== null) errors.baselineId = "请选择有效的对比基准";
  return errors;
}

export function readComparisonConfig(data) {
  if (data?.version === 2) return createComparisonConfig(readConfig(data));
  if (data?.version !== 3 || data.unit !== "K" || !Array.isArray(data.plans)) throw new Error("仅支持 v2 会话配置或 v3 多方案配置（K Token）。");
  if (data.plans.length > maxPlans) throw new Error(`最多对比 ${maxPlans} 个方案`);
  const plans = data.plans.map(plan => {
    if (!plan || typeof plan !== "object") throw new Error("方案配置无效");
    const normalized = readConfig({ ...plan, version: 2, unit: "K" });
    return { id: plan.id, name: plan.name, color: plan.color, toolsMode: plan.toolsMode, simulation: normalized.simulation, model: normalized.model, pricing: normalized.pricing };
  });
  const config = { version: 3, unit: "K", baselineId: data.baselineId, plans };
  const errors = validateComparison(config);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  return config;
}

// 以来源 key 对齐，独立流程的来源数量与顺序可以不同。
export function compareSources(results, selectedIndex) {
  const sources = new Map();
  results.forEach(result => result.sources.forEach(source => sources.set(source.key, source.name)));
  return [...sources].map(([key, name]) => {
    const values = results.map(result => result.sources.find(source => source.key === key));
    const selected = values[selectedIndex];
    return {
      key, name, hit: selected?.hit ?? 0, miss: selected?.miss ?? 0, output: selected?.output ?? 0,
      costs: values.map(source => source?.cost.total ?? 0), cost: selected?.cost.total ?? 0,
    };
  }).sort((a, b) => Math.max(...b.costs) - Math.max(...a.costs));
}
