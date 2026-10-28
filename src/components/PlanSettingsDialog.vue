<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { SlidersHorizontal, X } from 'lucide-vue-next';
import { compressionFields, groups, isFieldVisible } from '../config.js';
import { resolvePlan, validatePlan } from '../comparison.js';
import PlanVariableField from './PlanVariableField.vue';
import PlanDescriptionField from './PlanDescriptionField.vue';
import VariablesDialog from './VariablesDialog.vue';
import { locale, translateUi } from '../i18n.js';

const props = defineProps({ config: Object, plan: Object });
const emit = defineEmits(['close', 'save']);
const local = ref(JSON.parse(JSON.stringify(props.plan)));
const displayedName = computed(() => locale.value === 'en' && ['按需 Tools', '全量 Tools', 'MCP渐进式Tools Schema', '渐进式Tools Schema', 'MCP默认全量tools/list'].includes(local.value.name) ? translateUi(local.value.name) : local.value.name);
const dialog = ref(null), showVariables = ref(false);
const titleId = useId();
const sections = computed(() => {
  const removed = new Set(props.config.globalSimulation.removedFields || []);
  return [...groups, { title: '上下文压缩', fields: compressionFields }]
    .map(group => ({ ...group, fields: group.fields.filter(([key]) => !removed.has(key) && isFieldVisible(key, effective.value.compressionThresholdType)) }))
    .filter(group => group.fields.length || ['会话规模', '上下文压缩'].includes(group.title));
});
const effective = computed(() => resolvePlan(local.value, props.config.globalSimulation).simulation);
const compressionTypeInherited = computed(() => local.value.useGlobal?.compressionThresholdType === true);
function toggleCompressionType() {
  local.value.useGlobal ??= {};
  if (compressionTypeInherited.value) local.value.simulation.compressionThresholdType = effective.value.compressionThresholdType;
  local.value.useGlobal.compressionThresholdType = !compressionTypeInherited.value;
}
function changeCompressionType(event) {
  local.value.simulation.compressionThresholdType = event.target.value;
  local.value.useGlobal ??= {};
  local.value.useGlobal.compressionThresholdType = false;
}
const errors = computed(() => {
  const result = validatePlan(local.value, props.config.globalSimulation, props.config.globalModelId, props.config.globalModel);
  if (props.config.plans.some(plan => plan.id !== local.value.id && plan.name.trim() === local.value.name.trim())) result.planName = '方案名称已存在';
  return result;
});
function save() {
  if (Object.keys(errors.value).length) return;
  local.value.name = local.value.name.trim();
  emit('save', local.value);
}
function saveVariables(plan) { local.value = plan; showVariables.value = false; }
let previousFocus;
onMounted(() => { previousFocus = document.activeElement; dialog.value.showModal(); });
onBeforeUnmount(() => { dialog.value?.close(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); });
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="plan-settings-dialog" :aria-labelledby="titleId" @cancel.prevent="emit('close')">
      <header><div><h2 :id="titleId"><SlidersHorizontal :size="18" />方案配置</h2><p>每项可继承全局或自定义，统一单位为 K Token。</p></div><button class="close" type="button" aria-label="关闭方案配置" @click="emit('close')"><X :size="18" /></button></header>
      <div class="settings-body">
        <label class="field name-field">方案名称<input :value="displayedName" @input="local.name=$event.target.value" maxlength="60" aria-label="方案名称" /></label>
        <PlanDescriptionField v-model="local.description" :simulation="{ ...effective, removedFields: config.globalSimulation.removedFields }" />
        <section v-for="group in sections" :key="group.title"><h3>{{ group.title }}</h3><div class="settings-grid">
          <label v-if="group.title === '会话规模'" class="field"><span>是否模拟耗时</span><select :value="local.estimateDuration !== false" aria-label="是否模拟耗时" @change="local.estimateDuration = $event.target.value === 'true'"><option value="true">{{ locale === 'zh' ? '是' : 'Yes' }}</option><option value="false">{{ locale === 'zh' ? '否' : 'No' }}</option></select></label>
          <label v-if="group.title === '上下文压缩'" class="field"><span>压缩阈值类型<button type="button" class="inherit-btn" :aria-pressed="compressionTypeInherited" @click.prevent="toggleCompressionType">{{ compressionTypeInherited ? '继承全局' : '自定义' }}</button></span><select :value="effective.compressionThresholdType" aria-label="压缩阈值类型" @change="changeCompressionType"><option value="TURN">用户轮次</option><option value="TOKEN">上下文</option></select></label>
          <PlanVariableField v-for="field in group.fields" :key="field[0]" :plan="local" :globals="config.globalSimulation" :field="field" />
        </div></section>
        <button type="button" @click="showVariables = true">管理全部变量与自定义变量</button>
      </div>
      <footer><p v-if="Object.keys(errors).length" class="error" role="alert">{{ Object.values(errors)[0] }}</p><p v-else>关闭弹框会放弃本次修改。</p><div><button type="button" @click="emit('close')">取消</button><button type="button" class="save" :disabled="!!Object.keys(errors).length" @click="save">保存配置</button></div></footer>
    </dialog>
    <VariablesDialog v-if="showVariables" :config="config" :plan="local" @close="showVariables = false" @save="saveVariables" />
  </Teleport>
</template>

<style scoped>
.plan-settings-dialog { width: min(880px, calc(100vw - 32px)); max-height: 88dvh; border: 1px solid #dddfd7; border-radius: 2px; padding: 0; color: #242622; background: #fafaf7; box-shadow: 0 24px 80px #24262224; font: 13px Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif; --muted:#73766e; --accent:#b94e30; }
.plan-settings-dialog[open] { display:flex; flex-direction:column; }
.plan-settings-dialog::backdrop { background:#24262266; backdrop-filter:blur(2px); }
header { display:flex; justify-content:space-between; gap:16px; padding:24px 26px 18px; }
h2 { display:flex; align-items:center; gap:9px; margin:0; color:#242622; font-size:16px; font-weight:550; }
header p, footer p { color:var(--muted); font-size:11px; line-height:1.8; margin:7px 0 0; }
button { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:8px 12px; min-height:34px; background:transparent; border:1px solid #dddfd7; border-radius:2px; color:#555950; font:inherit; cursor:pointer; }
button:hover:not(:disabled) { background:#eeefe9; } button:disabled { opacity:.5; cursor:not-allowed; } .close { border:0; align-self:start; padding:5px; }
.settings-body { padding:0 26px 24px; overflow:auto; overscroll-behavior:contain; }
section { padding:20px 0; border-top:1px solid #dddfd7; } h3 { color:#242622; font-size:13px; font-weight:550; margin:0 0 17px; }
.settings-grid { display:grid; grid-template-columns:repeat(2,minmax(0,1fr)); gap:16px 22px; }.settings-grid > * { min-width:0; }.name-field { max-width:430px; margin-bottom:20px; }
.description-field { margin-bottom: 20px !important; }.description-field small { margin-left: auto; font-size: 10px; font-weight: 400; }.description-field textarea { box-sizing: border-box; width: 100%; padding: 10px; resize: vertical; min-height: 88px; border: 1px solid #dddfd7; border-radius: 2px; background: #fff; color: #242622; font: inherit; line-height: 1.8; }.description-field textarea:focus { outline: none; border-color: var(--accent); box-shadow: 0 0 0 2px #b94e3018; }
.plan-settings-dialog :deep(.field) { display:flex; flex-direction:column; color:#73766e; font-size:11px; margin-bottom:0; gap:7px; }
.plan-settings-dialog :deep(.field > span:first-child) { display:flex; align-items:center; min-height:24px; }
.plan-settings-dialog :deep(.field input), .plan-settings-dialog :deep(.field select) { box-sizing:border-box; width:100%; height:38px; font:inherit; color:#242622; border:1px solid #dddfd7; border-radius:2px; background:#fff; padding:8px 10px; }
.plan-settings-dialog :deep(.input-unit) { display:flex; align-items:center; position:relative; }.plan-settings-dialog :deep(.input-unit > span) { position:absolute; right:10px; color:#73766e; pointer-events:none; }.plan-settings-dialog :deep(.input-unit input) { padding-right:45px; }
.plan-settings-dialog :deep(.inherit-btn) { border:0; background:#eeefe9; color:#8f4029; padding:4px 6px; min-height:24px; font-size:10px; margin-left:auto; }
.plan-settings-dialog :deep(input:focus), .plan-settings-dialog :deep(select:focus) { outline:none; border-color:var(--accent); box-shadow:0 0 0 2px #b94e3018; }.plan-settings-dialog :deep(button:focus-visible) { outline:2px solid var(--accent); outline-offset:2px; }
footer { padding:16px 26px; border-top:1px solid #dddfd7; background:#f0f1eb; } footer > div { display:flex; justify-content:flex-end; gap:8px; margin-top:10px; } footer .error { color:#a53e32; font-size:12px; }.save { background:#242622; border-color:#242622; color:#fff; }.save:hover:not(:disabled) { background:#42483b; }
@media(max-width:600px) { .settings-grid { grid-template-columns:1fr; } header { padding:20px 18px 14px; } .settings-body { padding:0 18px 20px; } footer { padding:14px 18px; }.plan-settings-dialog :deep(.field input) { font-size:16px; } }
</style>
