<script setup>
import { ArrowUp, ArrowDown, Plus, Trash2, ChevronDown, Workflow } from "lucide-vue-next";
import { createDefaultFlow, resolveStepToken, tokenParameters } from "../session-flow.js";
import { sourceNames } from "../session-report.js";
import { token } from "../utils.js";

const props = defineProps({ simulation: Object, error: String });
const stepIds = new WeakMap();
let nextStepId = 0;
function stepKey(step) {
  if (!stepIds.has(step)) stepIds.set(step, nextStepId++);
  return stepIds.get(step);
}
const phases = [
  { key: "initial", label: "初始上下文", note: "按顺序加入会话，作为首次请求的缓存前缀。" },
  { key: "turn", label: "每轮流程", note: "每轮按顺序执行；模型调用读取此前的全部有效上下文，生成内容后继续下一步。轮末检查压缩。" },
];
const name = step => Object.hasOwn(sourceNames, step.text) ? sourceNames[step.text] : step.text;
const factors = step => Array.isArray(step.token) ? step.token : [step.token];
function move(phase, index, delta) {
  const steps = props.simulation.flow[phase];
  const [step] = steps.splice(index, 1);
  steps.splice(index + delta, 0, step);
}
function add(phase) {
  props.simulation.flow[phase].push({ type: "action", text: phase === "initial" ? "自定义上下文" : "自定义步骤", token: 1 });
}
function changeTokenMode(step, event) {
  step.token = event.target.value === "fixed" ? 1 : ["userMessageToken"];
}
function changeFactor(step, index, value) {
  const next = factors(step).slice();
  next[index] = value;
  step.token = next;
}
function removeFactor(step, index) {
  step.token = factors(step).filter((_, i) => i !== index);
}
function size(step) {
  try { return token(resolveStepToken(step.token, props.simulation)); } catch { return "待修正"; }
}
</script>

<template>
  <details class="parameter-group flow-editor">
    <summary><span><Workflow :size="15" />自定义流程</span><ChevronDown :size="14" /></summary>
    <div class="parameter-fields">
      <p class="field-note">两种方案共用流程。可调整顺序、停用步骤，或指定仅在某种方案执行。</p>
      <small v-if="error" class="error" role="alert">{{ error }}</small>
      <section v-for="phase in phases" :key="phase.key" class="flow-phase" :aria-label="phase.label + '流程编辑'">
        <div class="flow-heading"><h3>{{ phase.label }}</h3><button type="button" @click="simulation.flow[phase.key] = createDefaultFlow()[phase.key]">恢复默认</button></div>
        <p class="field-note">{{ phase.note }}</p>
        <details v-for="(step, index) in simulation.flow[phase.key]" :key="stepKey(step)" class="flow-step" :class="{ 'flow-disabled': step.enabled === false }">
          <summary><span>{{ index + 1 }}. {{ name(step) || '未命名步骤' }}</span><ChevronDown :size="12" /></summary>
          <div class="flow-step-fields">
            <div class="flow-step-actions">
              <label class="flow-enabled"><input type="checkbox" :checked="step.enabled !== false" @change="step.enabled = $event.target.checked" />启用</label>
              <button type="button" :disabled="index === 0" :aria-label="'上移第 ' + (index + 1) + ' 步'" @click="move(phase.key, index, -1)"><ArrowUp :size="13" /></button>
              <button type="button" :disabled="index === simulation.flow[phase.key].length - 1" :aria-label="'下移第 ' + (index + 1) + ' 步'" @click="move(phase.key, index, 1)"><ArrowDown :size="13" /></button>
              <button type="button" :aria-label="'删除第 ' + (index + 1) + ' 步'" @click="simulation.flow[phase.key].splice(index, 1)"><Trash2 :size="13" /></button>
            </div>
            <label class="field"><span>步骤名称 / 费用来源</span><input :value="name(step)" @input="step.text = $event.target.value" /></label>
            <label v-if="phase.key === 'turn'" class="field"><span>步骤类型</span><select v-model="step.type"><option value="action">追加内容（消息 / 工具结果）</option><option value="llm">模型调用（生成内容）</option></select></label>
            <label class="field"><span>适用方案</span><select :value="step.toolsMode || ''" @change="$event.target.value ? step.toolsMode = $event.target.value : delete step.toolsMode"><option value="">两种方案</option><option value="LAZY_TOOLS_SCHEMA">仅按需 Tools</option><option value="FULL_TOOLS_SCHEMA">仅全量 Tools</option></select></label>
            <label class="field"><span>{{ step.type === 'llm' ? '输出长度' : '内容长度' }}</span><select :value="typeof step.token === 'number' ? 'fixed' : 'parameters'" @change="changeTokenMode(step, $event)"><option value="fixed">固定 Token</option><option value="parameters">引用参数 / 参数相乘</option></select></label>
            <label v-if="typeof step.token === 'number'" class="field"><span>Token（K）</span><input type="number" min="0" step="any" :value="Number.isFinite(step.token) ? step.token : ''" @input="step.token = $event.target.value === '' ? NaN : Number($event.target.value)" /></label>
            <template v-else>
              <div v-for="(factor, i) in factors(step)" :key="i" class="flow-factor">
                <select :aria-label="'参数因子 ' + (i + 1)" :value="factor" @change="changeFactor(step, i, $event.target.value)"><option v-for="(label, key) in tokenParameters" :key="key" :value="key">{{ label }}</option></select>
                <button type="button" :disabled="factors(step).length === 1" :aria-label="'移除参数因子 ' + (i + 1)" @click="removeFactor(step, i)"><Trash2 :size="12" /></button>
              </div>
              <button type="button" @click="step.token = [...factors(step), 'turnAvgToolsCount']"><Plus :size="12" />乘以参数</button>
            </template>
            <p class="field-note">当前长度 {{ size(step) }}<template v-if="step.type === 'llm'">，计入模型输出费用。</template></p>
          </div>
        </details>
        <p v-if="simulation.flow[phase.key].length === 0" class="field-note">暂无步骤。{{ phase.key === 'initial' ? '会话将从空上下文开始。' : '每轮不追加内容，仍按轮次检查压缩。' }}</p>
        <button type="button" class="flow-add" @click="add(phase.key)"><Plus :size="13" />添加步骤</button>
      </section>
    </div>
  </details>
</template>

<style scoped>
.flow-phase { display: grid; gap: 8px; }
.flow-phase + .flow-phase { margin-top: 12px; }
.flow-heading, .flow-step > summary, .flow-step-actions, .flow-factor { display: flex; align-items: center; gap: 6px; }
.flow-heading, .flow-step > summary { justify-content: space-between; }
.flow-editor button { font-size: 10px; padding: 5px 7px; }
.flow-step { border: 1px solid var(--line); border-radius: 6px; }
.flow-step > summary { padding: 9px; font-size: 11px; overflow-wrap: anywhere; }
.flow-step-fields { display: grid; gap: 9px; padding: 0 9px 10px; }
.flow-disabled > summary { color: var(--muted); text-decoration: line-through; }
.flow-enabled { display: flex; align-items: center; gap: 5px; margin-right: auto; font-size: 11px; }
.flow-enabled input { width: auto; }
.flow-factor select { font-size: 11px; }
.flow-factor button { flex-shrink: 0; }
.flow-add { justify-self: start; }
</style>
