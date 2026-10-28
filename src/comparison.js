import { createConfig, createPresetConfig, readConfig, validate, groups, compressionFields, fields, integers, getValue, setValue } from "./config.js";
import { validateVariables, validateVariableName } from "./variables.js";
import { formulaReferences } from "./token-formula.js";
import { defaultModelPreset, modelPresets } from "./model-pricing.js";
import { createPreloadedFlow } from "./session-flow.js";
import { migrateLegacyComparison } from "./legacy-config.js";

export const planColors = ["#5869d9", "#d99b61", "#449b87", "#9a76c3", "#5c9ebd", "#c77891", "#9b9b4d", "#768397"];
export const maxPlans = 8;
export const globalFields = [
  ...groups[0].fields.filter(([key]) => ["turnTotalCount", "toolsTotalCount", "skillsTotalCount"].includes(key)),
  groups[1].fields[0],
  ...compressionFields.filter(([key]) => ["compressionThresholdTurnCount", "compressionThresholdToken"].includes(key)),
];
const legacyGlobalKeys = [...globalFields.map(([key]) => key), "compressionThresholdType"];
export const globalKeys = [...fields.map(([key]) => key), "compressionThresholdType"];
const defaultSimulation = createConfig().simulation;
const deletePath = (object, path) => {
  const keys = path.split(".");
  const key = keys.pop();
  const parent = keys.reduce((value, part) => value?.[part], object);
  if (parent && typeof parent === "object") delete parent[key];
};
export const thresholdKey = simulation => simulation.compressionThresholdType === "TURN" ? "compressionThresholdTurnCount" : "compressionThresholdToken";
export const thresholdField = simulation => {
  const field = globalFields.find(([key]) => key === thresholdKey(simulation));
  return [field[0], "压缩阈值", ...field.slice(2)];
};
export const isGlobalField = key => globalKeys.includes(key);
// Model configurations are JSON data, but may be wrapped in Vue proxies.
const copyConfigValue = value => Array.isArray(value)
  ? value.map(copyConfigValue)
  : value && typeof value === "object"
    ? Object.fromEntries(Object.entries(value).map(([key, item]) => [key, copyConfigValue(item)]))
    : value;
export function resolvePlan(plan, globalSimulation, globalModelId, globalModel) {
  if (!plan?.simulation) return plan;
  const simulation = { ...plan.simulation, initialContext: { ...plan.simulation.initialContext } };
  const removedFields = new Set(Array.isArray(globalSimulation?.removedFields) ? globalSimulation.removedFields : []);
  for (const key of globalKeys) if (!removedFields.has(key) && globalSimulation && plan.useGlobal?.[key] && getValue(globalSimulation, key) !== undefined) setValue(simulation, key, getValue(globalSimulation, key));
  for (const key of removedFields) setValue(simulation, key, getValue(defaultSimulation, key));
  const variables = { ...plan.simulation.variables };
  for (const [key, variable] of Object.entries(globalSimulation?.variables || {})) {
    if (plan.useGlobal?.['variables.' + key] !== false) variables[key] = { ...variable };
  }
  simulation.variables = variables;
  const preset = plan.useGlobal?.model && modelPresets.find(p => p.id === globalModelId);
  return { ...plan, simulation, ...(preset ? createPresetConfig(preset) : plan.useGlobal?.model && globalModelId === 'custom' && globalModel ? copyConfigValue(globalModel) : {}) };
}
export function validateGlobals(globalSimulation) {
  const errors = {};
  if (!globalSimulation || typeof globalSimulation !== "object" || Array.isArray(globalSimulation)) return { global: "全局配置无效" };
  const removedFields = globalSimulation.removedFields;
  if (removedFields !== undefined && (!Array.isArray(removedFields) || removedFields.some(key => !fields.some(([field]) => field === key)) || new Set(removedFields).size !== removedFields.length)) errors.removedFields = "已删除的内置变量列表无效";
  const removed = new Set(Array.isArray(removedFields) ? removedFields : []);
  try { validateVariables(globalSimulation.variables); } catch (error) { errors.variables = error.message; }
  for (const [key, label, unit, min, max] of fields) {
    if (removed.has(key)) continue;
    if (key.startsWith("compressionThreshold") && key !== thresholdKey(globalSimulation || {})) continue;
    const value = getValue(globalSimulation, key);
    if (value === undefined && !legacyGlobalKeys.includes(key)) continue;
    const upper = unit === "%" ? 1 : max;
    if (typeof value !== "number" || !Number.isFinite(value) || value < min || (upper !== undefined && value > upper)) errors[key] = unit === "%" ? "请输入 0–100%" : `${label}请输入 ${min}${max ? `–${max}` : " 及以上的有限"}数值`;
    else if (integers.has(key) && !Number.isSafeInteger(value)) errors[key] = "请输入整数";
    if (key === "compressionThresholdToken" && value <= 0) errors[key] = "压缩阈值必须大于 0";
  }
  if (!["TURN", "TOKEN"].includes(globalSimulation?.compressionThresholdType)) errors.compressionThresholdType = "请选择压缩阈值类型";
  return errors;
}

export function createPlan({ source, name = "自定义方案", id = crypto.randomUUID(), color = planColors[0], removedFields = [] } = {}) {
  const base = source ? structuredClone(source) : createConfig();
  const useGlobal = source ? { ...source.useGlobal } : { ...Object.fromEntries(globalKeys.map(key => [key, true])), model: true };
  for (const key of removedFields) {
    deletePath(base.simulation, key);
    delete useGlobal[key];
  }
  return {
    id, name, color, description: base.description ?? "",
    simulation: base.simulation, model: base.model, pricing: base.pricing,
    useGlobal,
  };
}

export function deleteBuiltinField(config, name) {
  if (!fields.some(([key]) => key === name)) throw new Error("无法删除此内置变量");
  const removed = new Set(config.globalSimulation.removedFields || []);
  if (removed.has(name)) return;
  removed.add(name);
  config.globalSimulation.removedFields = [...removed];
  deletePath(config.globalSimulation, name);
  for (const plan of config.plans) {
    deletePath(plan.simulation, name);
    delete plan.useGlobal?.[name];
  }
}

export function createComparisonConfig() {
  const plans = [
    createPlan({ id: "plan-lazy", name: "渐进式Tools Schema", color: planColors[0] }),
    createPlan({ id: "plan-full", name: "MCP默认全量tools/list", color: planColors[1] }),
  ];
  plans[1].simulation.flow = createPreloadedFlow();
  const globalSimulation = { initialContext: {}, variables: {} };
  for (const key of globalKeys) setValue(globalSimulation, key, getValue(plans[0].simulation, key));
  return { version: 4, unit: "K", baselineId: plans[0].id, baselineMode: "auto", globalSimulation, globalModelId: defaultModelPreset.id, plans };
}

export function resolveBaselineId(config, results) {
  if (!results.length) return null;
  if (config.baselineMode !== "auto" && results.some(result => result.planId === config.baselineId)) return config.baselineId;
  return results.reduce((best, result) => result.cost.total > best.cost.total ? result : best).planId;
}

export function validatePlan(plan, globalSimulation, globalModelId, globalModel) {
  if (!plan || typeof plan !== "object" || !plan.simulation || !plan.model) return { plan: "方案缺少参数或模型配置" };
  const errors = validate(resolvePlan(plan, globalSimulation, globalModelId, globalModel));
  try { validateVariables(plan.simulation.variables); } catch (error) { errors.variables = error.message; }
  if (plan.useGlobal !== undefined && (!plan.useGlobal || typeof plan.useGlobal !== "object" || Array.isArray(plan.useGlobal) || Object.entries(plan.useGlobal).some(([key, value]) => (!isGlobalField(key) && key !== "model" && !(key.startsWith("variables.") && (Object.hasOwn(plan.simulation.variables || {}, key.slice(10)) || Object.hasOwn(globalSimulation?.variables || {}, key.slice(10))))) || typeof value !== "boolean"))) errors.useGlobal = "全局参数设置无效";
  if (typeof plan.id !== "string" || !plan.id.trim()) errors.id = "方案需要唯一标识";
  if (typeof plan.name !== "string" || !plan.name.trim() || plan.name.length > 60) errors.planName = "方案名称需为 1–60 个字符";
  if (plan.description !== undefined && (typeof plan.description !== "string" || plan.description.length > 1000)) errors.description = "方案说明不能超过 1000 个字符";
  const unknown = Object.keys(plan).find(key => !["id", "name", "description", "color", "simulation", "model", "pricing", "useGlobal"].includes(key));
  if (unknown) errors.plan = `方案不支持字段 ${unknown}`;
  if (!planColors.includes(plan.color)) errors.color = "方案颜色无效";
  return errors;
}

export function variableReferences(plan, name) {
  const matches = [];
  for (const phase of ['initial', 'turn']) for (const step of plan.simulation.flow[phase]) {
    let references = [];
    if (Array.isArray(step.token)) references = step.token;
    else if (typeof step.token === 'string') {
      try { references = formulaReferences(step.token); }
      catch { throw new Error(`请先修复「${plan.name} / ${step.text}」的公式再删除变量`); }
    }
    if (references.includes(name)) matches.push(`${plan.name} / ${step.text}`);
  }
  return matches;
}

export function deleteVariable(config, name, plan) {
  validateVariableName(name);
  const consumers = plan ? [plan] : config.plans.filter(p => p.useGlobal?.['variables.' + name] !== false);
  const references = consumers.flatMap(p => variableReferences(p, name));
  if (references.length) throw new Error(`变量仍被引用：${references.join('、')}。请先修改这些公式。`);
  if (plan) {
    delete plan.simulation.variables[name];
    delete plan.useGlobal?.['variables.' + name];
  } else {
    delete config.globalSimulation.variables[name];
    for (const p of consumers) {
      if (p.simulation.variables) delete p.simulation.variables[name];
      delete p.useGlobal?.['variables.' + name];
    }
  }
}

export function validateComparison(config) {
  const errors = {};
  if (config?.version !== 4 || config.unit !== "K") errors.version = "请使用 v4 多方案配置（K Token）";
  if (config?.baselineMode !== undefined && !["auto", "manual"].includes(config.baselineMode)) errors.baselineMode = "Base模式无效";
  if (!Array.isArray(config?.plans) || config.plans.length > maxPlans) return { plans: `最多对比 ${maxPlans} 个方案` };
  if (config.globalSimulation !== undefined) for (const [key, message] of Object.entries(validateGlobals(config.globalSimulation))) errors[`globalSimulation.${key}`] = message;
  if (config.globalModelId !== undefined && !modelPresets.some(p => p.id === config.globalModelId) && config.globalModelId !== 'custom') errors.globalModelId = "请选择有效的全局模型";
  if (config.globalModelId === 'custom') {
    const model = config.globalModel?.model;
    if (!model || !config.globalModel?.pricing || typeof config.globalModel.pricing !== 'object' || typeof model.name !== 'string' || !model.name.trim() || model.currency !== '$' || ['inputCachedPrice', 'inputNotCachedPrice', 'outputPrice'].some(key => !Number.isFinite(model[key]) || model[key] < 0)) errors.globalModelId = '请输入有效的全局模型名称和非负费率';
  }
  const ids = new Set(), names = new Set();
  config.plans.forEach((plan, index) => {
    for (const [key, message] of Object.entries(validatePlan(plan, config.globalSimulation, config.globalModelId, config.globalModel))) errors[`plans.${index}.${key}`] = `方案 ${index + 1}：${message}`;
    if (!plan || typeof plan !== "object") return;
    if (ids.has(plan.id)) errors[`plans.${index}.id`] = "方案标识不能重复";
    if (typeof plan.name === "string" && names.has(plan.name.trim())) errors[`plans.${index}.planName`] = "方案名称不能重复";
    ids.add(plan.id);
    names.add(plan.name?.trim?.());
    if (plan.model?.currency !== config.plans[0]?.model?.currency) errors.currency = "对比方案需使用相同币种";
  });
  if (config.plans.length ? !ids.has(config.baselineId) : config.baselineId !== null) errors.baselineId = "请选择有效的Base";
  return errors;
}

export function readComparisonConfig(data) {
  if (data?.version === 2 || data?.version === 3) data = migrateLegacyComparison(data);
  if (data?.version !== 4 || data.unit !== "K" || !Array.isArray(data.plans)) throw new Error("仅支持 v4 多方案配置，或导入 v2 / v3 旧配置（K Token）。");
  if (data.plans.length > maxPlans) throw new Error(`最多对比 ${maxPlans} 个方案`);
  // Older exports only shared rounds and tools. Fill new global controls without
  // changing those plans' existing independent settings or their inheritance flags.
  let globalSimulation = data.globalSimulation === undefined ? {} : structuredClone(data.globalSimulation);
  if (globalSimulation && typeof globalSimulation === "object" && !Array.isArray(globalSimulation)) {
    const defaults = defaultSimulation;
    globalSimulation.initialContext ??= {};
    const removedFields = new Set(Array.isArray(globalSimulation.removedFields) ? globalSimulation.removedFields : []);
    for (const key of globalKeys) {
      if (!removedFields.has(key) && (data.globalSimulation === undefined || (!["turnTotalCount", "toolsTotalCount"].includes(key) && getValue(globalSimulation, key) === undefined))) setValue(globalSimulation, key, getValue(data.plans[0]?.simulation, key) ?? getValue(defaults, key));
    }
  }
  const plans = data.plans.map(plan => {
    if (!plan || typeof plan !== "object") throw new Error("方案配置无效");
    validateVariables(plan.simulation?.variables);
    const normalized = readConfig({ ...resolvePlan(plan, data.globalSimulation), version: 4, unit: "K" });
    for (const key of globalKeys) setValue(normalized.simulation, key, getValue(plan.simulation, key));
    normalized.simulation.variables = structuredClone(plan.simulation.variables || {});
    const result = { ...plan, simulation: normalized.simulation, model: normalized.model, pricing: normalized.pricing };
    for (const key of globalSimulation?.removedFields || []) {
      deletePath(result.simulation, key);
      delete result.useGlobal?.[key];
    }
    return result;
  });
  const config = { version: 4, unit: "K", baselineId: data.baselineId, plans };
  config.globalSimulation = globalSimulation;
  config.globalModelId = data.globalModelId === undefined ? defaultModelPreset.id : data.globalModelId;
  if (data.globalModel !== undefined) config.globalModel = structuredClone(data.globalModel);
  // Exports predating global models keep each plan's original model and prices.
  if (data.globalModelId === undefined) plans.forEach(plan => { plan.useGlobal = { ...plan.useGlobal, model: false }; });
  if (data.globalSimulation === undefined) plans.forEach(plan => { plan.useGlobal = { ...Object.fromEntries(globalKeys.map(key => [key, false])), model: plan.useGlobal?.model === true }; });
  if (data.baselineMode !== undefined) config.baselineMode = data.baselineMode;
  const errors = validateComparison(config);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  return config;
}

