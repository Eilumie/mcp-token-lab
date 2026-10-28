<script setup>
import { computed, onBeforeUnmount, onMounted, ref } from 'vue';
import { X } from 'lucide-vue-next';
import { resolvePlan, validatePlan } from '../comparison.js';
import { previewStep, tokenFormula } from '../session-flow.js';
import { sourceNames } from '../session-report.js';
import { locale, translateUi } from '../i18n.js';

const props = defineProps({ plan: Object, globalSimulation: Object, globalModelId: String, globalModel: Object, phase: String, index: Number, inserting: Boolean });
const emit = defineEmits(['close', 'save']);
const clone = value => JSON.parse(JSON.stringify(value));
const draft = ref(clone(props.plan));
const flow = draft.value.simulation.flow[props.phase];
if (props.inserting) flow.splice(props.index, 0, { type: 'action', text: '新的上下文', token: 1 });
const step = flow[props.index];
const originalName = step.text;
const name = ref(sourceNames[step.text] || step.text);
const displayedName = computed(() => locale.value === 'en' ? translateUi(name.value) : name.value);
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
function updateDuration(event) {
  if (event.target.value === '') delete step.durationSeconds;
  else step.durationSeconds = event.target.valueAsNumber;
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
          <label>节点名称<input :value="displayedName" maxlength="100" @input="name=$event.target.value;updateName()" /></label>
          <label v-if="phase === 'turn'">节点类型<select v-model="step.type"><option value="action">追加上下文</option><option value="llm">调用模型</option></select></label>
          <label class="enabled"><input type="checkbox" :checked="step.enabled !== false" @change="step.enabled = $event.target.checked" />启用节点</label>
          <label>节点耗时（秒）<input :value="step.durationSeconds ?? ''" type="number" min="0" step="any" :placeholder="step.type === 'llm' ? '1.8' : '0.3'" @input="updateDuration" /><small>留空使用默认值：工具 / 上下文 0.3s，LLM 1.8s；可设为 0。</small></label>
          <label v-if="phase === 'turn'">触发方式<select :value="step.trigger?.type || 'always'" @change="setTrigger($event.target.value)"><option value="always">每轮触发</option><option value="probability">按百分比触发</option><option value="interval">每 N 轮消息触发</option></select></label>
          <label v-if="step.trigger">{{ step.trigger.type === 'probability' ? '触发概率（%）' : '消息轮次间隔' }}<input v-model.number="step.trigger.value" type="number" :min="step.trigger.type === 'probability' ? 0 : 1" :max="step.trigger.type === 'probability' ? 100 : undefined" :step="step.trigger.type === 'probability' ? 'any' : 1" /><small v-if="step.trigger.type === 'interval'">首轮触发，之后每隔 N 轮触发一次；例如 N=3 时在第 1、4、7 轮触发。</small></label>
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
.flow-node-dialog { width: min(440px, calc(100vw - 32px)); max-height: calc(100vh - 32px); border: 1px solid #dddfd7; border-radius: 2px; padding: 0; color: #242622; background: #fafaf7; box-shadow: 0 24px 80px #24262224; }
.flow-node-dialog::backdrop { background: #24262266; backdrop-filter: blur(2px); }
header, footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 20px 22px; }
header { border-bottom: 1px solid #dddfd7; } h2 { margin: 0; color: #242622; font-size: 16px; font-weight: 550; } header p { margin: 6px 0 0; color: #73766e; font-size: 11px; }
button { cursor: pointer; border: 1px solid #dddfd7; border-radius: 2px; background: transparent; color: #555950; padding: 8px 14px; } button:hover:not(:disabled) { background: #eeefe9; } button:disabled { opacity: .5; cursor: not-allowed; } .close { border: 0; padding: 5px; }
.fields { display: grid; gap: 14px; padding: 20px 22px; } label, .field-title { display: grid; gap: 6px; font-size: 12px; color: #73766e; } input:not([type=checkbox]), select, textarea { box-sizing: border-box; width: 100%; border: 1px solid #dddfd7; border-radius: 2px; padding: 9px; background: #fff; color: #242622; font: inherit; } input:focus, select:focus, textarea:focus { outline: none; border-color: #b94e30; box-shadow: 0 0 0 2px #b94e3018; } textarea { resize: vertical; font-family: var(--mono, monospace); } .enabled { display: flex; align-items: center; gap: 8px; }
.modes { display: inline-flex; margin-top: 6px; padding: 2px; border-radius: 2px; background: #eeefe9; } .modes button { border: 0; padding: 6px 11px; background: transparent; font-size: 11px; } .modes .active { background: #fff; color: #b94e30; box-shadow: 0 1px 3px #24262212; }
.preview { margin: 0; color: #73766e; font-size: 12px; } .error { margin: 0; color: #a53e32; font-size: 12px; line-height: 1.6; } footer { justify-content: flex-end; border-top: 1px solid #dddfd7; } .save { background: #242622; border-color: #242622; color: white; } .save:hover:not(:disabled) { background: #42483b; }
</style>
