// 流程只包含 JSON 数据，可直接经过 Worker 和配置导入导出。
export const tokenParameters = {
  "initialContext.agentPromptToken": "Agent Prompt",
  skillIndexToken: "单个 Skill 索引",
  toolsIndexToken: "单个 Tool 索引",
  toolSchemaToken: "单个 Tool Schema",
  userMessageToken: "用户消息",
  skillDetailToken: "单个 Skill 内容",
  toolResultToken: "单个 Tool Result",
  readSkillPlanToken: "读取技能计划",
  schemaPlanToken: "查询 Schema 计划",
  callToolsPlanToken: "调用工具计划",
  agentResult: "Agent 最终回复",
  skillsTotalCount: "Skills 总数",
  toolsTotalCount: "Tools 总数",
  turnAvgSkillsCount: "每轮平均 Skills",
  turnAvgToolsCount: "每轮平均 Tools",
  sessionAvgAllowToolsRate: "角色允许工具比例",
};

export const toolsModes = ["LAZY_TOOLS_SCHEMA", "FULL_TOOLS_SCHEMA"];

export function createDefaultFlow() {
  return {
    initial: [
      { type: "action", text: "agent prompt", token: "initialContext.agentPromptToken" },
      { type: "action", text: "skills discover list", token: ["skillIndexToken", "skillsTotalCount"] },
      { type: "action", text: "tools discover list", token: ["toolsTotalCount", "toolsIndexToken"] },
      { type: "action", text: "tools schema list", token: ["toolsTotalCount", "toolSchemaToken"], toolsMode: "FULL_TOOLS_SCHEMA" },
      { type: "action", text: "role allow tools", token: ["toolsTotalCount", "toolsIndexToken", "sessionAvgAllowToolsRate"] },
    ],
    turn: [
      { type: "action", text: "user_message", token: "userMessageToken" },
      { type: "llm", text: "read_skills_plan", token: "readSkillPlanToken" },
      { type: "action", text: "read_skills", token: ["skillDetailToken", "turnAvgSkillsCount"] },
      { type: "llm", text: "get_tools_schema_plan", token: "schemaPlanToken", toolsMode: "LAZY_TOOLS_SCHEMA" },
      { type: "action", text: "get_tools_schema", token: ["toolSchemaToken", "turnAvgToolsCount"], toolsMode: "LAZY_TOOLS_SCHEMA" },
      { type: "llm", text: "call_tools_plan", token: "callToolsPlanToken" },
      { type: "action", text: "call_tools", token: ["toolResultToken", "turnAvgToolsCount"] },
      { type: "llm", text: "agent_result", token: "agentResult" },
    ],
  };
}

export function resolveStepToken(token, config) {
  if (typeof token === "number") {
    if (Number.isFinite(token) && token >= 0) return token;
    throw new RangeError("Token 必须是非负有限数值");
  }
  const factors = typeof token === "string" ? [token] : token;
  if (!Array.isArray(factors) || factors.length === 0) {
    throw new TypeError("Token 必须是数值、参数名或非空参数名数组");
  }
  const result = factors.reduce((total, path) => {
    if (typeof path !== "string" || !Object.hasOwn(tokenParameters, path)) {
      throw new RangeError(`未知 Token 参数：${String(path)}`);
    }
    const value = path.split(".").reduce((parent, key) => parent?.[key], config);
    if (!Number.isFinite(value) || value < 0) throw new RangeError(`${path} 必须是非负有限数值`);
    return total * value;
  }, 1);
  if (!Number.isFinite(result)) throw new RangeError("Token 乘积超出可计算范围");
  return result;
}

export function isStepEnabled(step, toolsMode) {
  return step.enabled !== false && (step.toolsMode === undefined || step.toolsMode === toolsMode);
}

export function validateFlow(flow, config) {
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
      if (step.toolsMode !== undefined && !toolsModes.includes(step.toolsMode)) throw new RangeError(`${prefix} toolsMode 无效`);
      try {
        resolveStepToken(step.token, config);
      } catch (error) {
        throw new RangeError(`${prefix}：${error.message}`);
      }
    });
  }
}
