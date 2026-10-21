<script setup>
import { nextTick, ref, toRaw, watch } from "vue";
import { ArrowUp, ArrowDown, Plus, Trash2, ChevronDown, Copy, Undo2, FileText, Sparkles } from "lucide-vue-next";
import { resolveStepToken, tokenParameters } from "../session-flow.js";
import { sourceNames } from "../session-report.js";
import { token } from "../utils.js";

const props = defineProps({ simulation: Object, error: String });
const container = ref(null);
const phase = ref("initial");
const openId = ref(null);
const removed = ref(null);
const stepIds = new WeakMap();
let nextStepId = 0;
function stepKey(step) {
  if (!stepIds.has(step)) stepIds.set(step, nextStepId++);
  return stepIds.get(step);
}
const phases = [
  { key: "initial", label: "初始上下文", note: "先放入系统提示、业务背景或工具定义，作为会话的起点。" },
  { key: "turn", label: "每轮流程", note: "从上到下执行。模型调用读取当前上下文，流程结束后检查压缩。" },
];
const name = step => Object.hasOwn(sourceNames, step.text) ? sourceNames[step.text] : step.text;
const factors = step => Array.isArray(step.token) ? step.token : [step.token];
function move(index, delta) {
  const steps = props.simulation.flow[phase.value];
  const [step] = steps.splice(index, 1);
  steps.splice(index + delta, 0, step);
}
async function reveal(step) {
  openId.value = stepKey(step);
  await nextTick();
  container.value?.querySelector(`[data-step="${openId.value}"] input[type="text"]`)?.focus();
}
function add(type) {
  const steps = props.simulation.flow[phase.value];
  steps.push({ type, text: type === "llm" ? "模型输出" : "追加内容", token: 1 });
  reveal(steps.at(-1));
}
function duplicate(index) {
  const steps = props.simulation.flow[phase.value];
  const copy = structuredClone(toRaw(steps[index]));
  copy.text = `${name(copy)} 副本`;
  steps.splice(index + 1, 0, copy);
  reveal(steps[index + 1]);
}
function remove(index) {
  const [step] = props.simulation.flow[phase.value].splice(index, 1);
  removed.value = { phase: phase.value, index, step };
}
function undoRemove() {
  const entry = removed.value;
  phase.value = entry.phase;
  const steps = props.simulation.flow[entry.phase];
  const index = Math.min(entry.index, steps.length);
  steps.splice(index, 0, entry.step);
  removed.value = null;
  reveal(steps[index]);
}
watch(() => props.simulation.flow, () => { removed.value = null; openId.value = null; });
function changeTokenMode(step, event) { step.token = event.target.value === "fixed" ? 1 : ["userMessageToken"]; }
function changeFactor(step, index, value) {
  const next = factors(step).slice();
  next[index] = value;
  step.token = next;
}
function size(step) {
  try { return token(resolveStepToken(step.token, props.simulation)); } catch { return "待修正"; }
}
</script>

<template>
  <div ref="container" class="flow-editor">
    <nav class="flow-phases" aria-label="流程阶段"><button v-for="item in phases" :key="item.key" :class="{ active: phase === item.key }" :aria-pressed="phase === item.key" @click="phase = item.key">{{ item.label }}<span>{{ simulation.flow[item.key].length }} 步</span></button></nav>
    <p class="flow-description">{{ phases.find(item => item.key === phase).note }}</p>
    <p v-if="error" class="error" role="alert">{{ error }}</p>
    <div v-if="removed" class="flow-undo" role="status"><span>已删除「{{ name(removed.step) }}」</span><button @click="undoRemove"><Undo2 :size="13" />撤销删除步骤</button></div>
    <section :aria-label="(phase === 'initial' ? '初始上下文' : '每轮流程') + '流程编辑'">
      <article v-for="(step, index) in simulation.flow[phase]" :key="stepKey(step)" :data-step="stepKey(step)" class="flow-step" :class="{ 'flow-disabled': step.enabled === false, expanded: openId === stepKey(step) }">
        <div class="flow-row">
          <button class="step-expand" :aria-expanded="openId === stepKey(step)" :aria-label="'编辑第 ' + (index + 1) + ' 步 ' + name(step)" @click="openId = openId === stepKey(step) ? null : stepKey(step)"><span class="step-index">{{ String(index + 1).padStart(2, '0') }}</span><span class="step-title"><strong>{{ name(step) || '未命名步骤' }}</strong><small><component :is="step.type === 'llm' ? Sparkles : FileText" :size="11" />{{ step.type === 'llm' ? '模型调用' : '追加内容' }} · {{ size(step) }}</small></span><ChevronDown :size="14" /></button>
          <div class="flow-step-actions">
            <label class="flow-enabled"><input type="checkbox" :aria-label="'启用第 ' + (index + 1) + ' 步'" :checked="step.enabled !== false" @change="step.enabled = $event.target.checked" /><span>启用</span></label>
            <button class="icon-button" :disabled="index === 0" :aria-label="'上移第 ' + (index + 1) + ' 步'" title="上移" @click="move(index, -1)"><ArrowUp :size="14" /></button>
            <button class="icon-button" :disabled="index === simulation.flow[phase].length - 1" :aria-label="'下移第 ' + (index + 1) + ' 步'" title="下移" @click="move(index, 1)"><ArrowDown :size="14" /></button>
            <button class="icon-button" :aria-label="'复制第 ' + (index + 1) + ' 步'" title="复制" @click="duplicate(index)"><Copy :size="14" /></button>
            <button class="icon-button" :aria-label="'删除第 ' + (index + 1) + ' 步'" title="删除" @click="remove(index)"><Trash2 :size="14" /></button>
          </div>
        </div>
        <div v-if="openId === stepKey(step)" class="flow-step-fields">
          <label class="field"><span>步骤名称 / 费用来源</span><input type="text" :value="name(step)" @input="step.text = $event.target.value" /></label>
          <label v-if="phase === 'turn'" class="field"><span>步骤类型</span><select v-model="step.type"><option value="action">追加内容（消息 / 工具结果）</option><option value="llm">模型调用（生成内容）</option></select></label>
          <label class="field"><span>长度设置</span><select :value="typeof step.token === 'number' ? 'fixed' : 'parameters'" @change="changeTokenMode(step, $event)"><option value="fixed">固定 Token</option><option value="parameters">引用参数 / 参数相乘</option></select></label>
          <label v-if="typeof step.token === 'number'" class="field"><span>{{ step.type === 'llm' ? '输出长度（K Token）' : '内容长度（K Token）' }}</span><input type="number" min="0" step="any" :value="Number.isFinite(step.token) ? step.token : ''" @input="step.token = $event.target.value === '' ? NaN : Number($event.target.value)" /></label>
          <div v-else class="flow-factors"><div v-for="(factor, i) in factors(step)" :key="i" class="flow-factor"><span>{{ i ? '×' : '=' }}</span><select :aria-label="'参数因子 ' + (i + 1)" :value="factor" @change="changeFactor(step, i, $event.target.value)"><option v-for="(label, key) in tokenParameters" :key="key" :value="key">{{ label }}</option></select><button class="icon-button" :disabled="factors(step).length === 1" :aria-label="'移除参数因子 ' + (i + 1)" @click="step.token = factors(step).filter((_, n) => n !== i)"><Trash2 :size="13" /></button></div><button @click="step.token = [...factors(step), 'turnAvgToolsCount']"><Plus :size="13" />乘以参数</button></div>
          <p class="field-note flow-step-note">当前{{ step.type === 'llm' ? '输出' : '内容' }} {{ size(step) }}。{{ step.type === 'llm' ? '输入取当前有效上下文，输出追加到后续上下文。' : '这一步仅追加内容，在后续模型调用时产生输入费用。' }}</p>
        </div>
      </article>
      <div v-if="!simulation.flow[phase].length" class="flow-empty"><FileText :size="26" /><h3>从第一个步骤开始</h3><p>{{ phase === 'initial' ? '添加系统提示、业务背景或工具定义。' : '添加消息、工具结果或模型调用。空流程仍会按轮次检查压缩。' }}</p></div>
    </section>
    <div class="flow-add-actions"><button @click="add('action')"><Plus :size="15" />添加内容</button><button v-if="phase === 'turn'" @click="add('llm')"><Sparkles :size="15" />添加模型调用</button><span>{{ simulation.flow[phase].filter(step => step.enabled !== false).length }} / {{ simulation.flow[phase].length }} 步已启用</span></div>
  </div>
</template>
