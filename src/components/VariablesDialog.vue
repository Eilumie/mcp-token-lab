<script setup>
import { computed, onMounted, onBeforeUnmount, ref, useId } from 'vue';
import { X, Plus, Trash2, SlidersHorizontal } from 'lucide-vue-next';
import { groups, compressionFields, createPresetConfig, priceFields } from '../config.js';
import { modelPresets } from '../model-pricing.js';
import PlanModelSettings from './PlanModelSettings.vue';
import { resolvePlan, validateComparison, validatePlan, deleteVariable } from '../comparison.js';
import { validateVariableName } from '../variables.js';
import ParameterField from './ParameterField.vue';
import PlanVariableField from './PlanVariableField.vue';
const props = defineProps({ config: Object, plan: Object });
const emit = defineEmits(['close', 'save']);
const local = ref(JSON.parse(JSON.stringify(props.config)));
const localPlan = ref(props.plan ? JSON.parse(JSON.stringify(props.plan)) : null);
const dialog = ref(null), message = ref(''), name = ref(''), label = ref(''), initialValue = ref(0);
const titleId = useId();
const planMode = !!props.plan;
const effective = computed(() => planMode ? resolvePlan(localPlan.value, local.value.globalSimulation).simulation : local.value.globalSimulation);
const errors = computed(() => planMode ? validatePlan(localPlan.value, local.value.globalSimulation, local.value.globalModelId, local.value.globalModel) : validateComparison(local.value));
function editGlobalModel() {
  if (local.value.globalModelId !== 'custom') {
    const preset = modelPresets.find(p => p.id === local.value.globalModelId);
    local.value.globalModel = createPresetConfig(preset);
    local.value.globalModel.pricing = { id: 'custom', label: '手动费率', source: '', date: '' };
    local.value.globalModelId = 'custom';
  }
}
const sections = [...groups, {title:'上下文压缩',fields:compressionFields}];
const customs = computed(() => Object.entries(effective.value.variables || {}));
const inherited = key => planMode && Object.hasOwn(local.value.globalSimulation.variables || {}, key) && localPlan.value.useGlobal?.['variables.'+key] !== false;
function target() { return planMode ? localPlan.value.simulation : local.value.globalSimulation; }
function setCustom(key, field, value) {
  const previous = effective.value.variables[key];
  target().variables ??= {};
  target().variables[key] = {...previous, [field]:value};
  if (planMode) { localPlan.value.useGlobal ??= {}; localPlan.value.useGlobal['variables.'+key] = false; }
  message.value = '';
}
function toggleCustom(key) {
  const wasInherited = inherited(key);
  if (wasInherited) setCustom(key, 'value', effective.value.variables[key].value);
  else { localPlan.value.useGlobal ??= {}; localPlan.value.useGlobal['variables.'+key] = true; }
}
function add() {
  try {
    const key = name.value.trim(); validateVariableName(key);
    if (Object.hasOwn(effective.value.variables || {}, key)) throw new Error('变量名已存在');
    if (Object.keys(effective.value.variables || {}).length >= 100) throw new Error('最多支持 100 个自定义变量');
    if (!Number.isFinite(initialValue.value) || initialValue.value < 0) throw new Error('请输入非负数值');
    target().variables ??= {};
    target().variables[key] = {label:label.value.trim() || key,value:initialValue.value};
    if (planMode) { localPlan.value.useGlobal ??= {}; localPlan.value.useGlobal['variables.'+key] = false; }
    name.value = ''; label.value = ''; initialValue.value = 0; message.value = '';
  } catch (error) { message.value = error.message; }
}
function remove(key) {
  try { deleteVariable(local.value, key, planMode ? localPlan.value : undefined); message.value = ''; }
  catch (error) { message.value = error.message; }
}
function changeType(event) {
  target().compressionThresholdType = event.target.value;
  if (planMode) localPlan.value.useGlobal.compressionThresholdType = false;
}
function toggleType() {
  const plan = localPlan.value;
  if (plan.useGlobal.compressionThresholdType) plan.simulation.compressionThresholdType = effective.value.compressionThresholdType;
  plan.useGlobal.compressionThresholdType = !plan.useGlobal.compressionThresholdType;
}
let previousFocus;
onMounted(() => { previousFocus = document.activeElement; dialog.value.showModal(); });
onBeforeUnmount(() => { dialog.value?.close(); if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true}); });
function save() { if (!Object.keys(errors.value).length) emit('save', planMode ? localPlan.value : local.value); }
</script>

<template>
  <dialog ref="dialog" class="variables-dialog" :class="{ 'global-variables-dialog': !planMode }" :aria-labelledby="titleId" @cancel.prevent="emit('close')">
    <header><div><h2 :id="titleId"><SlidersHorizontal :size="18"/>{{ planMode?'方案全部变量':'全部全局变量' }}</h2><p>{{ planMode?'逐项继承全局或自定义，修改数值会自动切换为自定义。':'首页展示常用配置，其余参数和自定义变量在这里管理。' }}</p></div><button class="close-dialog" aria-label="关闭全部变量" @click="emit('close')"><X :size="18"/></button></header>
    <div class="variables-body">
      <section><h3>模型与费率</h3>
        <PlanModelSettings v-if="planMode" :plan="localPlan" :global-model-id="local.globalModelId" :global-model="local.globalModel" :errors="errors" />
        <div v-else class="variables-grid">
          <label class="field">模型<select v-model="local.globalModelId" aria-label="全部变量全局模型"><option v-if="local.globalModel" value="custom">{{ local.globalModel.model.name }} · 手动费率</option><option v-for="preset in modelPresets" :key="preset.id" :value="preset.id">{{ preset.name }}</option></select></label>
          <label class="field">模型名称<input :value="(local.globalModelId === 'custom' ? local.globalModel : createPresetConfig(modelPresets.find(p=>p.id===local.globalModelId))).model.name" aria-label="全局模型名称" maxlength="100" @input="editGlobalModel(); local.globalModel.model.name=$event.target.value" /></label><label v-for="[key,label] in priceFields" :key="key" class="field">{{ label }} · USD / 1M Token<input type="number" min="0" step="any" :aria-label="'全局'+label+'单价'" :value="(local.globalModelId === 'custom' ? local.globalModel : createPresetConfig(modelPresets.find(p=>p.id===local.globalModelId))).model[key]" @input="editGlobalModel(); local.globalModel.model[key]=$event.target.value===''?'':Number($event.target.value)" /></label>
        </div>
      </section>
      <section v-for="group in sections" :key="group.title"><h3>{{ group.title }}<small>内置参数</small></h3><div class="variables-grid"><label v-if="group.title === '上下文压缩'" class="field"><span>压缩阈值类型<button v-if="planMode" class="inherit-btn" :aria-pressed="!!localPlan.useGlobal.compressionThresholdType" @click.prevent="toggleType">{{ localPlan.useGlobal.compressionThresholdType?'继承全局':'自定义' }}</button></span><select :value="effective.compressionThresholdType" aria-label="全部变量压缩阈值类型" @change="changeType"><option value="TURN">用户轮次</option><option value="TOKEN">上下文</option></select></label><div v-for="field in group.fields" :key="field[0]" class="variable-item"><PlanVariableField v-if="planMode" :plan="localPlan" :globals="local.globalSimulation" :field="field"/><ParameterField v-else :object="local.globalSimulation" :field="field"/><code>{{ field[0] }}</code></div></div></section>
      <section><h3>自定义变量<small>{{ Object.keys(effective.variables || {}).length }} / 100</small></h3><p class="variable-note">在公式中直接填写变量名，例如 retrievalToken * 2。长度使用 K Token，比例使用 0–1。</p>
        <div v-for="[key, variable] in customs" :key="key" class="custom-variable">
          <div class="custom-variable-heading"><code>{{ key }}</code><button v-if="planMode && Object.hasOwn(local.globalSimulation.variables || {},key)" class="inherit-btn" :aria-pressed="inherited(key)" :aria-label="'继承全局 '+key" @click="toggleCustom(key)">{{ inherited(key)?'继承全局':'自定义' }}</button><button v-else class="remove-variable" :aria-label="'删除变量 '+key" @click="remove(key)"><Trash2 :size="15"/></button></div>
          <div class="variables-grid"><label class="field">说明<input :value="variable.label" :aria-label="'变量说明 '+key" maxlength="60" @input="setCustom(key,'label',$event.target.value)"/></label><label class="field">数值<input :value="variable.value" :aria-label="'变量值 '+key" type="number" min="0" step="any" @input="setCustom(key,'value',$event.target.value===''?'':Number($event.target.value))"/></label></div>
        </div>
        <p v-if="!customs.length" class="variable-note">还没有自定义变量，可在下方新增。</p>
        <form class="new-variable" @submit.prevent="add"><h4>新增变量</h4><div class="variables-grid"><label class="field">变量名<input v-model="name" aria-label="新变量名" placeholder="例如 retrievalToken" maxlength="64"/></label><label class="field">说明<input v-model="label" aria-label="新变量说明" placeholder="例如检索内容长度" maxlength="60"/></label><label class="field">初始数值<input v-model.number="initialValue" aria-label="新变量初始值" type="number" min="0" step="any"/></label><button type="submit" class="add-variable"><Plus :size="15"/>添加变量</button></div></form>
      </section>
    </div>
    <footer><p v-if="message || Object.keys(errors).length" class="variable-error" role="alert">{{ message || Object.values(errors)[0] }}</p><p v-else class="variable-note">内置参数保留，未引用的自定义变量可删除。关闭弹框会放弃本次修改。</p><div><button @click="emit('close')">取消</button><button class="save-variables" :disabled="!!Object.keys(errors).length" @click="save">{{ planMode?'应用到草稿':'保存变量' }}</button></div></footer>
  </dialog>
</template>

<style scoped>
.variables-dialog { width: min(880px, calc(100vw - 32px)); max-height: 88dvh; border: 1px solid #e9ebef; border-radius: 18px; padding: 0; color: #303848; background: #fff; box-shadow: 0 24px 90px #18203930; font: 13px -apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif; --muted:#7d8492; --accent:#c25536; }
.variables-dialog[open] { display: flex; flex-direction: column; }
.variables-dialog::backdrop { background: #18203966; backdrop-filter: blur(3px); }
header { display: flex; justify-content: space-between; gap: 16px; padding: 24px 26px 18px; }
h2 { display: flex; align-items: center; gap: 9px; font-size: 19px; }
header p, .variable-note { color: var(--muted); font-size: 11px; line-height: 1.8; margin: 7px 0 0; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 8px 12px; min-height: 34px; background: #fff; border: 1px solid #e5e7ed; border-radius: 7px; color: #555e6e; font: inherit; }
button:hover:not(:disabled) { background: #f7f8fa; }
.close-dialog { border: 0; align-self: start; padding: 5px; }
.variables-body { padding: 0 26px 24px; overflow: auto; overscroll-behavior: contain; }
section { padding: 20px 0; border-top: 1px solid #eceef2; }
h3 { display: flex; align-items: center; gap: 10px; font-size: 14px; margin-bottom: 17px; }
h3 small { font-size: 10px; font-weight: 400; color: #9299a5; }
.variables-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px 22px; }
.variables-grid > * { min-width: 0; }
.variable-item { min-width: 0; }
code { font-size: 10px; color: #89919c; overflow-wrap: anywhere; }
.variables-dialog :deep(.field) { color: #737c8d; font-size: 11px; margin-bottom: 0; gap: 7px; }
.variables-dialog :deep(.field > span:first-child) { display: flex; align-items: center; justify-content: space-between; min-height: 24px; }
.variables-dialog :deep(.field input), .variables-dialog :deep(.field select) { width: 100%; height: 38px; font: inherit; color: #303848; border: 1px solid #e5e7ed; border-radius: 7px; background: #fff; padding: 8px 10px; }
.variables-dialog :deep(.input-wrap) { display: flex; align-items: center; position: relative; }
.variables-dialog :deep(.input-wrap .input-unit) { position: absolute; right: 10px; width: auto; color: #9299a5; pointer-events: none; }
.variables-dialog :deep(.input-wrap input), .variables-dialog :deep(.input-unit input) { padding-right: 45px; }
.variables-dialog :deep(.inherit-btn) { border: 0; background: #f8f1ed; color: #91492f; padding: 4px 6px; min-height: 24px; font-size: 10px; margin-left: auto; }
.variables-dialog :deep(input:focus), .variables-dialog :deep(select:focus) { outline: none; border-color: var(--accent); box-shadow: 0 0 0 3px #c2553614; }
.variables-dialog :deep(button:focus-visible) { outline: 2px solid var(--accent); outline-offset: 2px; }
.variable-item code { display: block; margin-top: 6px; }
.custom-variable { padding: 15px; border: 1px solid #e9ebef; border-radius: 9px; margin-top: 14px; }
.custom-variable-heading { display: flex; align-items: center; gap: 10px; margin-bottom: 10px; }
.custom-variable-heading code { font-size: 12px; color: #555e6e; }
.remove-variable { margin-left: auto; border: 0; padding: 5px; color: #b3483d; }
.new-variable { margin-top: 20px; padding: 18px; border: 1px dashed #d9dee5; border-radius: 9px; background: #fafbfc; }
h4 { margin: 0 0 12px; font-size: 12px; }
.add-variable { align-self: end; }
footer { padding: 16px 26px; border-top: 1px solid #e9ebef; background: #fafbfc; }
footer > div { display: flex; justify-content: flex-end; gap: 8px; margin-top: 10px; }
.variable-error { color: #b3483d; font-size: 12px; line-height: 1.7; overflow-wrap: anywhere; }
.save-variables { background: #91492f; border-color: #91492f; color: #fff; }
.save-variables:hover:not(:disabled) { background: #803b25; }
@media(max-width:600px) { .variables-grid { grid-template-columns: 1fr; } header { padding: 20px 18px 14px; } .variables-body { padding: 0 18px 20px; } footer { padding: 14px 18px; } .variables-dialog :deep(.field input) { font-size: 16px; } }
@media(max-width:600px) { .global-variables-dialog .variables-grid { grid-template-columns: repeat(2,minmax(0,1fr)); gap: 14px 12px; } }
</style>
