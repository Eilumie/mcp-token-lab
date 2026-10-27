import { evaluateFormula } from "./token-formula.js";

// 流程只包含 JSON 数据，可直接经过 Worker 和配置导入导出。
export { tokenParameters } from "./variables.js";
import { tokenParameters, customVariableValues, validateVariables } from "./variables.js";

export const runtimeParameters = {
  turnIndex: "当前用户轮次索引（从 0 开始）",
  llmIndex: "当前步骤前已执行的模型调用数",
};

export function validateStepTrigger(trigger) {
  if (!trigger || typeof trigger !== "object" || Array.isArray(trigger)) throw new TypeError("trigger 必须是触发配置对象");
  if (!["probability", "interval"].includes(trigger.type)) throw new RangeError("trigger.type 必须是 probability 或 interval");
  const unknown = Object.keys(trigger).find(key => !["type", "value"].includes(key));
  if (unknown) throw new RangeError(`trigger 不支持字段 ${unknown}`);
  if (trigger.type === "probability" && (!Number.isFinite(trigger.value) || trigger.value < 0 || trigger.value > 100)) {
    throw new RangeError("触发概率必须是 0–100 的有限数值（%）");
  }
  if (trigger.type === "interval" && (!Number.isSafeInteger(trigger.value) || trigger.value < 1)) {
    throw new RangeError("触发间隔必须是正整数（用户消息轮次）");
  }
}

// 固定种子的无状态抽样：只依赖用户轮次和节点位置，预览、Worker、reset 结果一致。
// 不消耗随机序列，跳过其他节点或插入压缩请求不会改变同一位置的抽样结果。
function triggerSample(turnIndex, stepIndex) {
  let seed = Math.imul(turnIndex + 1, 0x9e3779b1) ^ Math.imul(stepIndex + 1, 0x85ebca6b);
  seed = Math.imul(seed ^ (seed >>> 16), 0x21f0aaad);
  seed = Math.imul(seed ^ (seed >>> 15), 0x735a2d97);
  return ((seed ^ (seed >>> 15)) >>> 0) / 0x100000000;
}

export function shouldRunStep(step, turnIndex, stepIndex) {
  if (step.enabled === false) return false;
  if (step.trigger === undefined) return true;
  validateStepTrigger(step.trigger);
  return step.trigger.type === "interval"
    ? (turnIndex + 1) % step.trigger.value === 0
    : triggerSample(turnIndex, stepIndex) < step.trigger.value / 100;
}

export function triggerLabel(step) {
  if (!step.trigger) return "每轮触发";
  return step.trigger.type === "interval" ? `每 ${step.trigger.value} 轮触发` : `${step.trigger.value}% 概率触发`;
}

// 预览与执行使用相同计数规则：停用和未触发的调用不计数，初始阶段固定为 0。
export function stepRuntime(flow, phase, index, turnIndex = 0) {
  return phase === "initial" ? { turnIndex: 0, llmIndex: 0 } : {
    turnIndex,
    llmIndex: flow.turn.slice(0, index).filter((step, i) => step?.type === "llm" && shouldRunStep(step, turnIndex, i)).length,
  };
}

export function previewStep(flow, phase, index, config, turnIndex = 0) {
  const step = flow[phase][index];
  try {
    const runs = phase === "initial" ? step.enabled !== false : shouldRunStep(step, turnIndex, index);
    return { runs, value: runs ? resolveStepToken(step.token, config, stepRuntime(flow, phase, index, turnIndex)) : 0, error: "" };
  } catch (error) {
    return { runs: false, value: null, error: error.message };
  }
}

export function createDefaultFlow() {
  return {
    initial: [
      { type: "action", text: "agent prompt", token: "initialContext.agentPromptToken" },
      { type: "action", text: "skills discover list", token: "skillIndexToken * skillsTotalCount" },
      { type: "action", text: "tools discover list", token: "toolsTotalCount * toolsIndexToken" },
      { type: "action", text: "role allow tools", token: "toolsTotalCount * toolsIndexToken * sessionAvgAllowToolsRate" },
    ],
    turn: [
      { type: "action", text: "user_message", token: "userMessageToken" },
      { type: "llm", text: "read_skills_plan", token: "readSkillPlanToken" },
      { type: "action", text: "read_skills", token: "skillDetailToken * turnAvgSkillsCount" },
      { type: "llm", text: "get_tools_schema_plan", token: "schemaPlanToken" },
      { type: "action", text: "get_tools_schema", token: "toolSchemaToken * turnAvgToolsCount" },
      { type: "llm", text: "call_tools_plan", token: "callToolsPlanToken" },
      { type: "action", text: "call_tools", token: "toolResultToken * turnAvgToolsCount" },
      { type: "llm", text: "agent_result", token: "agentResult" },
    ],
  };
}

// 这是另一套可编辑流程模板；引擎无需知道模板名称或工具加载策略。
export function createPreloadedFlow() {
  const flow = createDefaultFlow();
  flow.initial.splice(3, 0, { type: "action", text: "tools schema list", token: "toolsTotalCount * toolSchemaToken" });
  flow.turn.splice(3, 2);
  return flow;
}

export function tokenFormula(token) {
  return Array.isArray(token) ? token.join(" * ") : String(token);
}

export function formulaVariables(config, runtime = {}) {
  return {
    ...Object.fromEntries(Object.keys(tokenParameters).map(path => [path, path.split(".").reduce((parent, key) => parent?.[key], config)])),
    ...customVariableValues(config.variables),
    turnIndex: runtime.turnIndex ?? 0,
    llmIndex: runtime.llmIndex ?? 0,
  };
}

export function resolveStepToken(token, config, runtime) {
  if (typeof token === "number") {
    if (Number.isFinite(token) && token >= 0) return token;
    throw new RangeError("Token 必须是非负有限数值");
  }
  if (typeof token === "string") return evaluateFormula(token, formulaVariables(config, runtime));
  // 兼容旧版参数乘积数组；页面编辑后保存为公式字符串。
  const factors = token;
  if (!Array.isArray(factors) || factors.length === 0) {
    throw new TypeError("Token 必须是数值、公式字符串或非空参数名数组");
  }
  const result = factors.reduce((total, path) => {
    if (typeof path !== "string" || !Object.hasOwn(formulaVariables(config, runtime), path)) {
      throw new RangeError(`未知 Token 参数：${String(path)}`);
    }
    const value = formulaVariables(config, runtime)[path];
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`${path} 必须是非负有限数值`);
    return total * value;
  }, 1);
  if (!Number.isFinite(result)) throw new RangeError("Token 乘积超出可计算范围");
  return result;
}

export function validateFlow(flow, config) {
  validateVariables(config.variables);
  if (!flow || typeof flow !== "object" || Array.isArray(flow)) throw new TypeError("flow 必须是流程配置对象");
  for (const phase of ["initial", "turn"]) {
    const steps = flow[phase];
    if (!Array.isArray(steps)) throw new TypeError(`flow.${phase} 必须是步骤数组`);
    steps.forEach((step, index) => {
      const prefix = `flow.${phase} 第 ${index + 1} 步`;
      if (!step || typeof step !== "object" || Array.isArray(step)) throw new TypeError(`${prefix} 必须是步骤对象`);
      if (!["action", "llm"].includes(step.type) || (phase === "initial" && step.type !== "action")) {
        throw new RangeError(`${prefix} 类型无效；initial 仅支持 action，turn 支持 action / llm`);
      }
      if (typeof step.text !== "string" || !step.text.trim()) throw new TypeError(`${prefix} 需要非空名称`);
      if (step.enabled !== undefined && typeof step.enabled !== "boolean") throw new TypeError(`${prefix} enabled 必须是布尔值`);
      const unknown = Object.keys(step).find(key => !["type", "text", "token", "enabled", "trigger"].includes(key));
      if (unknown) throw new RangeError(`${prefix} 不支持字段 ${unknown}`);
      try {
        if (step.trigger !== undefined) {
          if (phase === "initial") throw new RangeError("初始上下文不支持 trigger；请在每轮流程中设置触发方式");
          validateStepTrigger(step.trigger);
        }
        // 间隔节点以首次触发轮次校验，避免将只在后续轮次有效的公式按首轮误判。
        let turnIndex = step.trigger?.type === "interval" ? step.trigger.value - 1 : 0;
        if (step.trigger?.type === "probability" && step.trigger.value > 0 && step.enabled !== false) {
          // 只寻找有限的代表轮次；完整运行仍会检查后续所有实际执行的公式。
          const limit = Math.min(config.turnTotalCount || 1, 1000);
          for (let candidate = 0; candidate < limit; candidate++) {
            if (shouldRunStep(step, candidate, index)) { turnIndex = candidate; break; }
          }
        }
        resolveStepToken(step.token, config, stepRuntime(flow, phase, index, turnIndex));
      } catch (error) {
        throw new RangeError(`${prefix}：${error.message}`);
      }
    });
  }
}
