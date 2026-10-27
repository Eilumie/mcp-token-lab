<script setup>
import { computed, onMounted, onBeforeUnmount, ref, useId } from 'vue';
import { X, Plus, Trash2, Search, SlidersHorizontal } from 'lucide-vue-next';
import { groups, compressionFields } from '../config.js';
import { resolvePlan, validateComparison, validatePlan, deleteVariable } from '../comparison.js';
import { validateVariableName } from '../variables.js';
import ParameterField from './ParameterField.vue';
import PlanVariableField from './PlanVariableField.vue';
const props = defineProps({ config: Object, plan: Object });
const emit = defineEmits(['close', 'save']);
const local = ref(JSON.parse(JSON.stringify(props.config)));
const localPlan = ref(props.plan ? JSON.parse(JSON.stringify(props.plan)) : null);
const dialog = ref(null), search = ref(''), message = ref(''), name = ref(''), label = ref(''), initialValue = ref(0);
const titleId = useId();
const planMode = !!props.plan;
const effective = computed(() => planMode ? resolvePlan(localPlan.value, local.value.globalSimulation).simulation : local.value.globalSimulation);
const errors = computed(() => planMode ? validatePlan(localPlan.value, local.value.globalSimulation, local.value.globalModelId) : validateComparison(local.value));
const matching = (key, text) => `${key} ${text}`.toLowerCase().includes(search.value.trim().toLowerCase());
const sections = computed(() => [...groups, {title:'上下文压缩',fields:compressionFields}].map(group => ({...group,fields:group.fields.filter(([key,text])=>matching(key,text))})).filter(group=>group.fields.length));
const customs = computed(() => Object.entries(effective.value.variables || {}).filter(([key,v])=>matching(key,v.label)));
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
    name.value = ''; label.value = ''; initialValue.value = 0; search.value = ''; message.value = '';
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
  <dialog ref="dialog" class="variables-dialog" :aria-labelledby="titleId" @cancel.prevent="emit('close')">
    <header><div><h2 :id="titleId"><SlidersHorizontal :size="18"/>{{ planMode?'方案全部变量':'全部全局变量' }}</h2><p>{{ planMode?'逐项继承全局或自定义，修改数值会自动切换为自定义。':'首页展示常用配置，其余参数和自定义变量在这里管理。' }}</p></div><button class="close-dialog" aria-label="关闭全部变量" @click="emit('close')"><X :size="18"/></button></header>
    <label class="variable-search"><Search :size="16"/><input v-model="search" type="search" placeholder="搜索名称或变量名" aria-label="搜索变量" autofocus/></label>
    <div class="variables-body">
      <section v-for="group in sections" :key="group.title"><h3>{{ group.title }}<small>内置参数</small></h3><div class="variables-grid"><div v-for="field in group.fields" :key="field[0]" class="variable-item"><PlanVariableField v-if="planMode" :plan="localPlan" :globals="local.globalSimulation" :field="field"/><ParameterField v-else :object="local.globalSimulation" :field="field"/><code>{{ field[0] }}</code></div></div></section>
      <label v-if="matching('compressionThresholdType','压缩阈值类型')" class="field"><span>压缩阈值类型<button v-if="planMode" class="inherit-btn" :aria-pressed="!!localPlan.useGlobal.compressionThresholdType" @click.prevent="toggleType">{{ localPlan.useGlobal.compressionThresholdType?'继承全局':'自定义' }}</button></span><select :value="effective.compressionThresholdType" aria-label="全部变量压缩阈值类型" @change="changeType"><option value="TURN">用户轮次</option><option value="TOKEN">上下文</option></select></label>
      <section><h3>自定义变量<small>{{ Object.keys(effective.variables || {}).length }} / 100</small></h3><p class="variable-note">在公式中直接填写变量名，例如 retrievalToken * 2。长度使用 K Token，比例使用 0–1。</p>
        <div v-for="[key, variable] in customs" :key="key" class="custom-variable">
          <div class="custom-variable-heading"><code>{{ key }}</code><button v-if="planMode && Object.hasOwn(local.globalSimulation.variables || {},key)" class="inherit-btn" :aria-pressed="inherited(key)" :aria-label="'继承全局 '+key" @click="toggleCustom(key)">{{ inherited(key)?'继承全局':'自定义' }}</button><button v-else class="remove-variable" :aria-label="'删除变量 '+key" @click="remove(key)"><Trash2 :size="15"/></button></div>
          <div class="variables-grid"><label class="field">说明<input :value="variable.label" :aria-label="'变量说明 '+key" maxlength="60" @input="setCustom(key,'label',$event.target.value)"/></label><label class="field">数值<input :value="variable.value" :aria-label="'变量值 '+key" type="number" min="0" step="any" @input="setCustom(key,'value',$event.target.value===''?'':Number($event.target.value))"/></label></div>
        </div>
        <p v-if="!customs.length" class="variable-note">{{ search?'没有匹配的自定义变量。':'还没有自定义变量，可在下方新增。' }}</p>
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
.variable-search { margin: 0 26px 18px; display: flex; align-items: center; gap: 9px; padding: 0 12px; border: 1px solid #e5e7ed; border-radius: 8px; color: var(--muted); }
.variable-search input { width: 100%; border: 0; padding: 11px 0; outline: none; font: inherit; }
.variable-search:focus-within { border-color: var(--accent); }
.variables-body { padding: 0 26px 24px; overflow: auto; overscroll-behavior: contain; }
section { padding: 20px 0; border-top: 1px solid #eceef2; }
h3 { display: flex; align-items: center; gap: 10px; font-size: 14px; margin-bottom: 17px; }
h3 small { font-size: 10px; font-weight: 400; color: #9299a5; }
.variables-grid { display: grid; grid-template-columns: repeat(2,minmax(0,1fr)); gap: 16px 22px; }
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
@media(max-width:600px) { .variables-grid { grid-template-columns: 1fr; } header { padding: 20px 18px 14px; } .variable-search { margin: 0 18px 14px; } .variables-body { padding: 0 18px 20px; } footer { padding: 14px 18px; } .variables-dialog :deep(.field input) { font-size: 16px; } }
</style>
