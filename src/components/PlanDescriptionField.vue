<script setup>
import { computed, nextTick, ref, useId } from 'vue';
import { descriptionReferences, descriptionVariables, renderPlanDescription } from '../plan-description.js';
import { locale, translateUi } from '../i18n.js';

const props = defineProps({ modelValue: String, simulation: Object });
const emit = defineEmits(['update:modelValue']);
const input = ref(null);
const insertionError = ref(false);
const id = useId();
const hint = computed(() => locale.value === 'zh'
  ? '使用 {{变量名}} 引用配置值，随当前方案配置更新。Token 单位为 K，命中率为 0–1。'
  : 'Use {{variableName}} for values from this plan. Tokens use K; hit rates use 0–1.');
const variables = computed(() => descriptionVariables(props.simulation));
const preview = computed(() => renderPlanDescription(props.modelValue, props.simulation));
const missing = computed(() => descriptionReferences(props.modelValue).filter(name => !variables.value.some(variable => variable.name === name)));
async function insertVariable(event) {
  const name = event.target.value;
  event.target.value = '';
  if (!name) return;
  const value = props.modelValue || '';
  const start = input.value.selectionStart, end = input.value.selectionEnd;
  const placeholder = `{{${name}}}`;
  const next = value.slice(0, start) + placeholder + value.slice(end);
  insertionError.value = next.length > 1000;
  if (insertionError.value) return;
  emit('update:modelValue', next);
  await nextTick();
  input.value.focus();
  input.value.setSelectionRange(start + placeholder.length, start + placeholder.length);
}
</script>

<template>
  <div class="plan-description-field">
    <label :for="id"><span>方案说明</span><small>{{ (modelValue || '').length }} / 1000</small></label>
    <textarea :id="id" ref="input" :value="modelValue || ''" rows="3" maxlength="1000" :aria-describedby="id + '-hint'" placeholder="描述方案的目标、策略或适用场景" @input="insertionError = false; emit('update:modelValue', $event.target.value)" />
    <div class="description-tools">
      <p :id="id + '-hint'">{{ hint }}</p>
      <select aria-label="插入说明变量" @change="insertVariable">
        <option value="">插入变量</option>
        <option v-for="variable in variables" :key="variable.name" :value="variable.name">{{ variable.name }} · {{ translateUi(variable.label) }} = {{ variable.value }}</option>
      </select>
    </div>
    <p v-if="modelValue" class="description-preview"><span>说明预览</span>{{ preview }}</p>
    <p v-if="missing.length" class="description-warning" role="status">{{ locale === 'zh' ? '未找到变量，保留原文：' : 'Unknown variables kept as written: ' }}{{ missing.join(', ') }}</p>
    <p v-if="insertionError" class="description-warning" role="status">方案说明不能超过 1000 个字符</p>
  </div>
</template>

<style scoped>
.plan-description-field { display: grid; gap: 8px; margin-bottom: 20px; font-size: 11px; color: #73766e; }
label { display: flex; align-items: center; justify-content: space-between; min-height: 24px; } small { font-size: 10px; }
textarea, select { box-sizing: border-box; width: 100%; padding: 10px; border: 1px solid #dddfd7; border-radius: 2px; background: #fff; color: #242622; font: inherit; }
textarea { resize: vertical; min-height: 88px; line-height: 1.8; } textarea:focus, select:focus { outline: none; border-color: #b94e30; box-shadow: 0 0 0 2px #b94e3018; }
.description-tools { display: flex; gap: 16px; align-items: center; } .description-tools p { flex: 1; margin: 0; line-height: 1.8; } select { width: 240px; min-width: 0; }
.description-preview { margin: 0; padding: 10px; background: #eeefe9; color: #242622; line-height: 1.8; white-space: pre-wrap; overflow-wrap: anywhere; } .description-preview span { display: block; color: #73766e; margin-bottom: 4px; } .description-warning { margin: 0; color: #a53e32; overflow-wrap: anywhere; }
</style>
