<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { Check, LayoutTemplate, Upload, X } from 'lucide-vue-next';
import { createBuiltinTemplates, readTemplate } from '../templates.js';
import defaultTemplates from '../config/default-template/index.js';
import { resolvePlanDescription } from '../comparison.js';

const props = defineProps({ customTemplates: Array, initialTemplateId: String });
const emit = defineEmits(['close', 'import', 'apply']);
const builtins = createBuiltinTemplates(defaultTemplates);
const templates = computed(() => [...builtins, ...props.customTemplates]);
const selectedId = ref(templates.value.some(item => item.id === props.initialTemplateId) ? props.initialTemplateId : builtins[0]?.id ?? props.customTemplates[0]?.id);
const selected = computed(() => templates.value.find(item => item.id === selectedId.value));
const dialog = ref(null), fileInput = ref(null), message = ref('');
const titleId = useId();
async function importFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 4000000) throw new Error('文件不能超过 4 MB');
    const template = { ...readTemplate(JSON.parse(await file.text()), file.name.replace(/\.json$/i, '').slice(0, 100)), id: crypto.randomUUID() };
    emit('import', template);
    selectedId.value = template.id;
    message.value = '';
  } catch (error) { message.value = '导入失败：' + error.message; }
  finally { event.target.value = ''; }
}
let previousFocus;
onMounted(() => { previousFocus = document.activeElement; dialog.value.showModal(); });
onBeforeUnmount(() => { dialog.value?.close(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); });
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="templates-dialog" :aria-labelledby="titleId" @cancel.prevent="emit('close')">
      <header><div><h2 :id="titleId"><LayoutTemplate :size="18"/>模板</h2><p>选择一个起点，探索不同的调用策略。</p></div><button type="button" class="close" aria-label="关闭模板" @click="emit('close')"><X :size="18"/></button></header>
      <div class="template-tools"><span>内置模板与自定义模板</span><button type="button" @click="fileInput.click()"><Upload :size="14"/>导入自定义模板</button><input ref="fileInput" type="file" accept=".json,application/json" hidden aria-label="自定义模板文件" @change="importFile"/></div>
      <div class="template-body">
        <div class="template-list" role="group" aria-label="选择模板">
          <button v-for="item in templates" :key="item.id" type="button" class="template-card" :class="{ selected: item.id === selectedId }" :aria-pressed="item.id === selectedId" @click="selectedId=item.id">
            <span class="template-source">{{ item.id.startsWith('builtin-') ? '内置模板' : '自定义模板' }}<Check v-if="item.id === selectedId" :size="13"/></span>
            <strong>{{ item.name }}</strong><span class="template-intro">{{ item.description || '暂无模板介绍' }}</span><small>{{ item.config.plans.length }} {{ '个方案' }}</small>
          </button>
        </div>
        <section v-if="selected" class="template-detail" aria-label="模板详情">
          <span class="eyebrow">TEMPLATE / PREVIEW</span><h3>{{ selected.name }}</h3><p class="detail-intro">{{ selected.description || '暂无模板介绍' }}</p>
          <h4>方案列表 <small>{{ selected.config.plans.length }}</small></h4>
          <ol class="template-plans"><li v-for="(plan, index) in selected.config.plans" :key="plan.id"><span class="plan-number">{{ String(index + 1).padStart(2, '0') }}</span><div><strong>{{ plan.name }}</strong><p v-if="plan.description">{{ resolvePlanDescription(plan, selected.config.globalSimulation) }}</p></div></li></ol>
          <p class="template-note">使用模板将替换当前全局配置和方案，可撤销。</p>
        </section>
      </div>
      <p v-if="message" class="error import-error" role="alert">{{ message }}</p>
      <footer><div><button type="button" @click="emit('close')">取消</button><button type="button" class="primary" :disabled="!selected" @click="emit('apply', selected.config)">使用模板</button></div></footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.templates-dialog { box-sizing: border-box; width: min(960px, calc(100vw - 32px)); max-height: 88dvh; padding: 0; border: 1px solid #dddfd7; border-radius: 2px; background: #fafaf7; color: #242622; box-shadow: 0 24px 80px #24262224; font: 13px Inter,-apple-system,BlinkMacSystemFont,"Segoe UI","PingFang SC",sans-serif; }
.templates-dialog[open] { display: flex; flex-direction: column; }.templates-dialog::backdrop { background: #24262266; backdrop-filter: blur(2px); }
header { display: flex; justify-content: space-between; gap: 16px; padding: 24px 26px 18px; }h2 { display: flex; align-items: center; gap: 9px; margin: 0; font-size: 16px; font-weight: 550; }header p { margin: 7px 0 0; color: #73766e; font-size: 11px; line-height: 1.8; }
button { display: inline-flex; align-items: center; justify-content: center; gap: 6px; min-height: 34px; padding: 8px 12px; border: 1px solid #dddfd7; border-radius: 2px; background: transparent; color: #555950; font: inherit; cursor: pointer; }button:hover:not(:disabled) { background: #eeefe9; }button:disabled { opacity: .5; cursor: not-allowed; }button:focus-visible { outline: 2px solid #b94e30; outline-offset: 2px; }.close { border: 0; align-self: start; padding: 5px; }
.template-tools { display: flex; align-items: center; justify-content: space-between; gap: 12px; margin: 0 26px; padding: 14px 0; border-top: 1px solid #dddfd7; font-size: 11px; color: #73766e; }
.template-body { display: grid; grid-template-columns: minmax(220px, .85fr) minmax(0, 1.15fr); min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 26px 24px; gap: 26px; }.template-list { display: flex; flex-direction: column; gap: 10px; }.template-card { display: flex; flex-direction: column; align-items: stretch; text-align: left; padding: 16px; gap: 10px; }.template-card.selected { border-color: #b94e30; background: #f4eee7; }.template-source { display: flex; align-items: center; justify-content: space-between; color: #9b5137; font-size: 10px; }.template-card strong { color: #242622; font-weight: 550; font-size: 13px; }.template-intro { font-size: 11px; line-height: 1.8; color: #73766e; }.template-card small { font-size: 10px; color: #73766e; }
.template-detail { padding: 18px 0 0; }.eyebrow { font-size: 9px; letter-spacing: .12em; color: #9b5137; }.template-detail h3 { margin: 12px 0; font-size: 20px; font-weight: 550; line-height: 1.5; }.detail-intro { color: #73766e; font-size: 12px; line-height: 1.9; white-space: pre-wrap; }.template-detail h4 { display: flex; gap: 10px; margin: 26px 0 0; padding-bottom: 12px; border-bottom: 1px solid #dddfd7; font-size: 12px; font-weight: 550; }.template-detail h4 small { color: #73766e; }.template-plans { list-style: none; padding: 0; margin: 0; }.template-plans li { display: flex; gap: 14px; padding: 16px 0; border-bottom: 1px solid #e6e7e1; }.plan-number { color: #9b5137; font-size: 11px; }.template-plans strong { font-size: 12px; font-weight: 550; }.template-plans p { margin: 7px 0 0; color: #73766e; font-size: 11px; line-height: 1.8; white-space: pre-wrap; }.template-note { color: #73766e; font-size: 11px; line-height: 1.8; margin: 20px 0 0; }.template-card, .template-detail { overflow-wrap: anywhere; }
.error { color: #a53e32; font-size: 12px; line-height: 1.8; }.import-error { padding: 0 26px; }
footer { display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap; padding: 16px 26px; border-top: 1px solid #dddfd7; background: #f0f1eb; }footer > div { display: flex; gap: 8px; }.primary { background: #242622; border-color: #242622; color: #fff; }.primary:hover:not(:disabled) { background: #42483b; }
@media(max-width: 600px) { header { padding: 20px 18px 14px; }.template-tools { margin: 0 18px; flex-wrap: wrap; }.template-body { grid-template-columns: 1fr; padding: 0 18px 20px; gap: 14px; }footer { padding: 14px 18px; }.template-detail h3 { font-size: 18px; } }
</style>
