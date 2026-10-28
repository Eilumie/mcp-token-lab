<script setup>
import { computed, onBeforeUnmount, ref, watch } from 'vue';
import { ArrowRight, Check, CircleHelp, X } from 'lucide-vue-next';
import { createComparisonConfig, createPlan, planColors, readComparisonConfig, validateComparison } from './comparison.js';
import VariablesDialog from './components/VariablesDialog.vue';
import TemplatesDialog from './components/TemplatesDialog.vue';
import Home from './components/Home.vue';
import { downloadFile } from './utils.js';

const config = ref(createComparisonConfig());
const results = ref([]), busy = ref(false), failure = ref(''), toast = ref('');
const variablesMode = ref(false), help = ref(false), templatesMode = ref(false), customTemplates = ref([]), lastConfig = ref(null);
const errors = computed(() => validateComparison(config.value));
let reportWorker, reportTimer, toastTimer;
function notify(text) { toast.value = text; clearTimeout(toastTimer); toastTimer = setTimeout(() => toast.value = '', 3500); }
function clone(value) { return JSON.parse(JSON.stringify(value)); }
function remember() { lastConfig.value = clone(config.value); }
function undo() { if (lastConfig.value) { config.value = lastConfig.value; lastConfig.value = null; notify('已撤销上一次修改'); } }
function add(source) {
  if (config.value.plans.length >= 8) return;
  const names = new Set(config.value.plans.map(plan => plan.name));
  let name = source ? source.name + ' 副本' : '新方案', index = 2;
  const base = name;
  while (names.has(name)) name = base + ' ' + index++;
  remember();
  const plan = createPlan({ source: source ? clone(source) : undefined, name, color: planColors[config.value.plans.length % planColors.length], removedFields: config.value.globalSimulation.removedFields || [] });
  config.value.plans.push(plan);
  if (!config.value.baselineId) config.value.baselineId = plan.id;
  notify(source ? '已复制方案' : '已新增方案');
}
function setBase(id) { remember(); config.value.baselineId = id; config.value.baselineMode = 'manual'; notify('已更新对比基准'); }
function remove(id) {
  remember(); config.value.plans = config.value.plans.filter(plan => plan.id !== id);
  if (config.value.baselineId === id) config.value.baselineId = config.value.plans[0]?.id || null;
  notify('已删除方案，可撤销');
}
function saveVariables(next) { remember(); config.value = next; variablesMode.value = false; }
function exportConfig() { downloadFile('token-lab.json', JSON.stringify(config.value, null, 2), 'application/json'); notify('已导出实验配置'); }
function applyTemplate(templateConfig) {
  try {
    const next = readComparisonConfig(clone(templateConfig));
    remember(); config.value = next; templatesMode.value = false; notify('已应用模板，可撤销');
  } catch (error) { notify('导入失败：' + error.message); }
}
watch(config, () => {
  clearTimeout(reportTimer); reportWorker?.terminate(); busy.value = false; failure.value = '';
  if (Object.keys(errors.value).length) { results.value = []; return; }
  busy.value = true;
  reportTimer = setTimeout(() => {
    const worker = new Worker(new URL('./session.worker.js', import.meta.url), { type: 'module' }); reportWorker = worker;
    worker.onmessage = ({ data }) => {
      if (reportWorker !== worker) return;
      busy.value = false; failure.value = data.error || ''; results.value = data.results || []; worker.terminate();
    };
    worker.onerror = () => { busy.value = false; failure.value = '模拟暂时失败，请调整参数重试'; worker.terminate(); };
    worker.postMessage(clone(config.value));
  }, 120);
}, { deep: true, immediate: true });
onBeforeUnmount(() => { reportWorker?.terminate(); clearTimeout(reportTimer); clearTimeout(toastTimer); });
</script>

<template>
  <Home :config="config" :results="results" :busy="busy" :errors="errors" :failure="failure" :can-undo="!!lastConfig"
    @variables="variablesMode=true" @templates="templatesMode=true" @export="exportConfig" @remember="remember" @undo="undo"
    @reset="remember();config=createComparisonConfig();notify('已恢复默认方案')"
    @add="add()" @baseline="setBase" @copy="add(config.plans.find(plan=>plan.id===$event))" @remove="remove" />
  <VariablesDialog v-if="variablesMode" :config="config" @close="variablesMode=false" @save="saveVariables" />
  <TemplatesDialog v-if="templatesMode" :custom-templates="customTemplates" @close="templatesMode=false" @import="customTemplates.push($event)" @apply="applyTemplate" />
  <div v-if="toast" class="toast" role="status"><Check :size="15" />{{ toast }}<button v-if="lastConfig" @click="undo">撤销</button><button class="icon-btn" aria-label="关闭提示" @click="toast='' "><X :size="13" /></button></div>
  <div v-if="help" class="help-overlay" @click.self="help=false"><section class="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="icon-btn help-close" aria-label="关闭说明" @click="help=false"><X :size="18" /></button><span class="eyebrow">MCP TOKEN LAB / GUIDE</span><h2 id="help-title">从假设，到成本。</h2><p>1. 设置统一的会话轮次与工具规模。</p><p>2. 配置方案变量和执行流程。</p><p>3. 选择基准，比较成本和上下文变化。</p><p class="field-help">配置仅保存在本次页面会话，刷新前请导出。所有计算在浏览器内完成。</p><button class="btn primary" @click="help=false">开始探索<ArrowRight :size="14" /></button></section></div>
</template>
