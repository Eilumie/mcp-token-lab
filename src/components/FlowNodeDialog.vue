<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { X } from 'lucide-vue-next';
import { resolvePlan, validatePlan } from '../comparison.js';
import { previewStep, tokenFormula } from '../session-flow.js';
import { sourceNames } from '../session-report.js';

const props = defineProps({ plan: Object, globalSimulation: Object, globalModelId: String, globalModel: Object, phase: String, index: Number, inserting: Boolean });
const emit = defineEmits(['close', 'save']);
const clone = value => JSON.parse(JSON.stringify(value));
const draft = ref(clone(props.plan));
const flow = draft.value.simulation.flow[props.phase];
if (props.inserting) flow.splice(props.index, 0, { type: 'action', text: '新的上下文', token: 1 });
const step = flow[props.index];
const originalName = step.text;
const name = ref(sourceNames[step.text] || step.text);
const formulaMode = ref(typeof step.token !== 'number');
const formula = ref(tokenFormula(step.token));
const dialog = ref(null);
const effective = computed(() => resolvePlan(draft.value, props.globalSimulation, props.globalModelId, props.globalModel));
const errors = computed(() => validatePlan(draft.value, props.globalSimulation, props.globalModelId, props.globalModel));
const preview = computed(() => previewStep(draft.value.simulation.flow, props.phase, props.index, effective.value.simulation));
function updateName() { step.text = name.value === (sourceNames[originalName] || originalName) ? originalName : name.value; }
function setMode(asFormula) {
  if (asFormula === formulaMode.value) return;
  if (asFormula) { formula.value = String(step.token); step.token = formula.value; }
  else step.token = preview.value.value ?? 0;
  formulaMode.value = asFormula;
}
function setTrigger(type) {
  if (type === 'always') delete step.trigger;
  else step.trigger = { type, value: type === 'probability' ? 100 : 2 };
}
function save() { updateName(); if (!Object.keys(errors.value).length) emit('save', clone(draft.value.simulation.flow)); }
let previousFocus;
onMounted(() => { previousFocus = document.activeElement; dialog.value.showModal(); });
onBeforeUnmount(() => previousFocus?.isConnected && previousFocus.focus());
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="flow-node-dialog" aria-labelledby="flow-node-dialog-title" @cancel.prevent="emit('close')">
      <form @submit.prevent="save">
        <header><div><h2 id="flow-node-dialog-title">{{ inserting ? '新增节点' : '编辑节点' }}</h2><p>{{ phase === 'initial' ? '初始上下文' : '每轮流程' }} · 第 {{ index + 1 }} 步</p></div><button type="button" class="close" aria-label="关闭" @click="emit('close')"><X :size="18" /></button></header>
        <div class="fields">
          <label>节点名称<input v-model="name" maxlength="100" @input="updateName" /></label>
          <label v-if="phase === 'turn'">节点类型<select v-model="step.type"><option value="action">追加上下文</option><option value="llm">调用模型</option></select></label>
          <label class="enabled"><input type="checkbox" :checked="step.enabled !== false" @change="step.enabled = $event.target.checked" />启用节点</label>
          <label v-if="phase === 'turn'">触发方式<select :value="step.trigger?.type || 'always'" @change="setTrigger($event.target.value)"><option value="always">每轮触发</option><option value="probability">按百分比触发</option><option value="interval">每 N 轮消息触发</option></select></label>
          <label v-if="step.trigger">{{ step.trigger.type === 'probability' ? '触发概率（%）' : '消息轮次间隔' }}<input v-model.number="step.trigger.value" type="number" :min="step.trigger.type === 'probability' ? 0 : 1" :max="step.trigger.type === 'probability' ? 100 : undefined" :step="step.trigger.type === 'probability' ? 'any' : 1" /></label>
          <div><span class="field-title">Token 长度</span><div class="modes"><button type="button" :class="{ active: formulaMode }" :aria-pressed="formulaMode" @click="setMode(true)">公式</button><button type="button" :class="{ active: !formulaMode }" :aria-pressed="!formulaMode" @click="setMode(false)">固定数值</button></div></div>
          <label v-if="formulaMode">Token 公式<textarea v-model="formula" rows="3" spellcheck="false" @input="step.token = formula"></textarea></label>
          <label v-else>固定 Token 长度（K）<input v-model.number="step.token" type="number" min="0" step="any" /></label>
          <p class="preview">当前预览：{{ preview.value === null ? '—' : Number(preview.value).toLocaleString('en-US', { maximumFractionDigits: 3 }) }} K Token</p>
          <p v-if="Object.keys(errors).length" class="error" role="alert">{{ Object.values(errors)[0] }}</p>
        </div>
        <footer><button type="button" @click="emit('close')">取消</button><button class="save" type="submit" :disabled="!!Object.keys(errors).length">保存节点</button></footer>
      </form>
    </dialog>
  </Teleport>
</template>

<style scoped>
.flow-node-dialog { width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); border: 1px solid #e4e7eb; border-radius: 14px; padding: 0; color: #354050; box-shadow: 0 18px 60px #18203930; }
.flow-node-dialog::backdrop { background: #18203970; }
header, footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 22px; }
header { border-bottom: 1px solid #eceef2; } h2 { margin: 0; font-size: 17px; } header p { margin: 6px 0 0; color: #89919c; font-size: 11px; }
button { cursor: pointer; border: 1px solid #e1e5eb; border-radius: 7px; background: #fff; color: #566170; padding: 8px 14px; } button:disabled { opacity: .5; cursor: not-allowed; } .close { border: 0; padding: 5px; }
.fields { display: grid; gap: 14px; padding: 20px 22px; } label, .field-title { display: grid; gap: 6px; font-size: 12px; color: #687384; } input:not([type=checkbox]), select, textarea { box-sizing: border-box; width: 100%; border: 1px solid #dfe4e9; border-radius: 7px; padding: 9px; background: #fff; color: #354050; font: inherit; } textarea { resize: vertical; font-family: monospace; } .enabled { display: flex; align-items: center; gap: 8px; }
.modes { display: inline-flex; margin-top: 6px; padding: 3px; border-radius: 8px; background: #f1f3f6; } .modes button { border: 0; padding: 6px 11px; background: transparent; font-size: 11px; } .modes .active { background: #fff; color: #91492f; box-shadow: 0 1px 4px #18203918; }
.preview { margin: 0; color: #778777; font-size: 12px; } .error { margin: 0; color: #b3483d; font-size: 12px; line-height: 1.6; } footer { justify-content: flex-end; border-top: 1px solid #eceef2; } .save { background: #98583e; border-color: #98583e; color: white; }
</style>
