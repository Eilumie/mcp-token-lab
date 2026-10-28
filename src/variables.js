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
  turnTotalCount: "会话总轮次",
  skillsTotalCount: "Skills 总数",
  toolsTotalCount: "Tools 总数",
  turnAvgSkillsCount: "每轮平均 Skills",
  turnAvgToolsCount: "每轮平均 Tools",
  expectedPrefixCacheHitRate: "Prefix 命中率",
  compressionThresholdTurnCount: "活跃用户轮次阈值",
  compressionThresholdToken: "上下文触发阈值",
  compressionKeepTurns: "保留最近用户轮次",
  compressionTargetToken: "压缩摘要长度",
};

const reserved = new Set([...Object.keys(tokenParameters), ...Object.keys(tokenParameters).map(key => key.split('.')[0]),
  'turnIndex', 'llmIndex', 'Math', 'Infinity', 'NaN', 'undefined', 'true', 'false', 'null',
  '__proto__', 'prototype', 'constructor', 'window', 'globalThis', 'process', 'model', 'flow', 'variables', 'compressionThresholdType',
  'new', 'return', 'this', 'function', 'var', 'let', 'const', 'class', 'delete', 'typeof', 'void', 'in', 'instanceof', 'await', 'yield', 'if', 'else', 'for', 'while', 'switch', 'case', 'default', 'try', 'catch', 'throw', 'import', 'export', 'super',
  'break', 'continue', 'do', 'with', 'debugger', 'finally', 'extends', 'enum', 'implements', 'interface', 'package', 'private', 'protected', 'public', 'static']);

export function validateVariableName(name) {
  if (typeof name !== 'string' || !/^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(name)) throw new Error('变量名需以英文字母或下划线开头，只能包含字母、数字、下划线，最长 64 字符');
  if (reserved.has(name)) throw new Error(`变量名 ${name} 与内置参数或保留名称冲突`);
}
export function validateVariables(variables) {
  if (variables === undefined) return;
  if (!variables || typeof variables !== 'object' || Array.isArray(variables)) throw new Error('variables 必须是变量对象');
  if (Object.keys(variables).length > 100) throw new Error('最多支持 100 个自定义变量');
  for (const [name, variable] of Object.entries(variables)) {
    validateVariableName(name);
    if (!variable || typeof variable !== 'object' || Array.isArray(variable)) throw new Error(`${name} 缺少变量配置`);
    if (Object.keys(variable).some(key => !['label', 'value'].includes(key))) throw new Error(`${name} 包含未知变量字段`);
    if (typeof variable.label !== 'string' || !variable.label.trim() || variable.label.length > 60) throw new Error(`${name} 的说明需为 1–60 个字符`);
    if (!Number.isFinite(variable.value) || variable.value < 0) throw new Error(`${name} 的值必须是非负有限数值`);
  }
}
export function customVariableValues(variables) {
  validateVariables(variables);
  return Object.fromEntries(Object.entries(variables || {}).map(([name, variable]) => [name, variable.value]));
}
