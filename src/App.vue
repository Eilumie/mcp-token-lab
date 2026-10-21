<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { Asterisk, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, X, Check, LoaderCircle, Plus, Copy, Trash2, Pencil, RotateCcw } from "lucide-vue-next";
import { createComparisonConfig, createPlan, readComparisonConfig, validateComparison, validatePlan, planColors, maxPlans } from "./comparison.js";
import { displayPlanColor } from "./theme.js";
import { downloadFile } from "./utils.js";
import ParameterPanel from "./components/ParameterPanel.vue";
import SummaryCards from "./components/SummaryCards.vue";
import AnalysisPanel from "./components/AnalysisPanel.vue";

const config = ref(createComparisonConfig());
const selectedId = ref(config.value.plans[0].id);
const selectedPlan = computed(() => config.value.plans.find(plan => plan.id === selectedId.value));
const errors = computed(() => validateComparison(config.value));
const selectedErrors = computed(() => {
  if (!selectedPlan.value) return {};
  const local = validatePlan(selectedPlan.value);
  const index = config.value.plans.indexOf(selectedPlan.value);
  const prefix = `plans.${index}.`;
  for (const [key, value] of Object.entries(errors.value)) if (key.startsWith(prefix)) local[key.slice(prefix.length)] = value;
  return local;
});
const notice = ref("");
const removed = shallowRef(null);
const report = shallowRef(null);
const busy = ref(false);
const failure = ref("");
const mobileParams = ref(false);
const importInput = ref(null);
let worker, debounce, deadline;
function cancel() {
  clearTimeout(debounce);
  clearTimeout(deadline);
  worker?.terminate();
  worker = null;
}
watch(config, () => {
  cancel();
  failure.value = "";
  report.value = null;
  busy.value = false;
  if (Object.keys(errors.value).length || !config.value.plans.length) return;
  busy.value = true;
  const snapshot = JSON.parse(JSON.stringify(config.value));
  debounce = setTimeout(() => {
    const currentWorker = new Worker(new URL("./session.worker.js", import.meta.url), { type: "module" });
    worker = currentWorker;
    const finish = () => { clearTimeout(deadline); currentWorker.terminate(); if (worker === currentWorker) worker = null; busy.value = false; };
    currentWorker.onmessage = ({ data }) => {
      if (worker !== currentWorker) return;
      finish();
      if (data.error) { failure.value = data.error; return; }
      report.value = { results: data.results, config: snapshot };
    };
    currentWorker.onerror = () => { if (worker !== currentWorker) return; finish(); failure.value = "计算失败，请检查参数后重试。"; };
    deadline = setTimeout(() => { if (worker !== currentWorker) return; finish(); failure.value = "计算超过 20 秒，请减少方案数量、轮次或压缩阈值。"; }, 20000);
    currentWorker.postMessage(snapshot);
  }, 220);
}, { deep: true, immediate: true });
onBeforeUnmount(cancel);
const warnings = computed(() => {
  if (!report.value) return [];
  const { results } = report.value;
  const messages = [];
  if (new Set(results.map(r => r.rounds.length)).size > 1) messages.push("各方案的用户轮次不同，当前比较的是各自完整会话的总费用；可统一轮次后再评估节省幅度。");
  for (const r of results) {
    if (r.model.inputCachedPrice > r.model.inputNotCachedPrice) messages.push(`${r.planName}：命中单价高于未命中单价，缓存可能增加费用。`);
    if (r.pricing?.contextWindow && r.peakInput * 1000 > r.pricing.contextWindow) messages.push(`${r.planName}：部分请求超过模型上下文上限，当前展示完整模拟消耗。`);
    if (r.pricing?.tier && r.requests.some(q => q.input * 1000 <= r.pricing.tier.input_tokens_gt || q.input * 1000 > r.pricing.tier.input_tokens_lte)) messages.push(`${r.planName}：部分请求不在所选价格档位内，当前使用固定档位。`);
    if (r.compressions.some(c => c.after >= c.before)) messages.push(`${r.planName}：部分压缩没有缩短上下文，可减小摘要长度或保留轮次。`);
  }
  return messages;
});
function editPlan(id) { selectedId.value = id; mobileParams.value = true; }
function uniqueName(base) {
  const names = new Set(config.value.plans.map(p => p.name.trim()));
  let name = base, index = 2;
  while (names.has(name)) name = `${base.slice(0, 50)} ${index++}`;
  return name;
}
function addPlan(source) {
  if (config.value.plans.length >= maxPlans) return;
  const used = new Set(config.value.plans.map(p => p.color));
  const color = planColors.find(c => !used.has(c)) || planColors[config.value.plans.length % planColors.length];
  const plan = createPlan({ source: source ? JSON.parse(JSON.stringify(source)) : undefined, name: uniqueName(source ? `${source.name.slice(0, 45)} 副本` : "自定义方案"), color });
  if (!source && config.value.plans.length) {
    plan.model = JSON.parse(JSON.stringify(config.value.plans[0].model));
    plan.pricing = JSON.parse(JSON.stringify(config.value.plans[0].pricing));
  }
  config.value.plans.push(plan);
  if (!config.value.baselineId) config.value.baselineId = plan.id;
  editPlan(plan.id);
  notice.value = source ? "已复制方案，可独立修改参数与流程。" : "已新增方案，以默认流程作为起点。";
}
function removePlan(plan) {
  const index = config.value.plans.indexOf(plan);
  removed.value = { plan: JSON.parse(JSON.stringify(plan)), index, baseline: config.value.baselineId === plan.id };
  config.value.plans.splice(index, 1);
  if (selectedId.value === plan.id) selectedId.value = config.value.plans[Math.min(index, config.value.plans.length - 1)]?.id ?? null;
  if (config.value.baselineId === plan.id) config.value.baselineId = config.value.plans[0]?.id ?? null;
  notice.value = `已删除「${plan.name}」。`;
}
function undoRemove() {
  if (!removed.value || config.value.plans.length >= maxPlans) return;
  const { plan, index, baseline } = removed.value;
  plan.name = uniqueName(plan.name);
  config.value.plans.splice(Math.min(index, config.value.plans.length), 0, plan);
  if (baseline || !config.value.baselineId) config.value.baselineId = plan.id;
  editPlan(plan.id);
  removed.value = null;
  notice.value = "已恢复删除的方案。";
}
function resetPlan() {
  const current = selectedPlan.value;
  if (!current) return;
  const template = createComparisonConfig().plans.find(plan => plan.id === current.id);
  Object.assign(current, createPlan({ source: template, id: current.id, name: current.name, color: current.color }));
  notice.value = "已恢复当前方案的默认参数和流程。";
}
function reset() {
  config.value = createComparisonConfig();
  selectedId.value = config.value.plans[0].id;
  removed.value = null;
  notice.value = "已恢复默认的按需、全量两个方案。";
}
function exportConfig() {
  downloadFile("token-lab-plans.json", JSON.stringify(config.value, null, 2), "application/json");
  notice.value = "已导出全部方案、对比基准与费率快照。";
}
async function importConfig(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 4000000) throw new Error("配置文件不能超过 4MB。");
    config.value = readComparisonConfig(JSON.parse(await file.text()));
    selectedId.value = config.value.plans[0]?.id ?? null;
    removed.value = null;
    notice.value = "方案已导入。";
  } catch (error) { notice.value = "导入失败：" + error.message; }
  finally { event.target.value = ""; }
}
function editInvalidPlan() {
  const key = Object.keys(errors.value).find(key => key.startsWith("plans."));
  const plan = key ? config.value.plans[Number(key.split(".")[1])] : selectedPlan.value;
  if (plan) editPlan(plan.id);
}
</script>

<template>
  <header class="app-header">
    <a class="brand" href="./"><span class="brand-mark"><Asterisk :size="32" :stroke-width="1.6" /></span><strong>Token Lab<span>A LITTLE CLARITY FOR EVERY TOKEN</span></strong></a>
    <nav class="header-actions" aria-label="配置操作"><span class="local-badge"><i></i>本地模拟</span><button aria-label="导入配置" @click="importInput.click()"><ArrowUpFromLine :size="15" /><span>导入配置</span></button><button aria-label="导出配置" :disabled="!!Object.keys(errors).length" @click="exportConfig"><ArrowDownToLine :size="15" /><span>导出配置</span></button><input ref="importInput" type="file" accept=".json,application/json" hidden @change="importConfig" /></nav>
  </header>
  <div class="workspace">
    <button class="mobile-config-button" @click="mobileParams = !mobileParams"><X v-if="mobileParams" :size="16" /><SlidersHorizontal v-else :size="16" />{{ mobileParams ? '收起实验参数' : '调整实验参数' }}</button>
    <div class="parameter-container" :class="{ 'mobile-open': mobileParams }"><ParameterPanel v-if="selectedPlan" :key="selectedPlan.id" :config="selectedPlan" :errors="selectedErrors" @reset="resetPlan" /><div v-else class="parameters field-note">添加一个方案后，在这里编辑它的参数和流程。</div></div>
    <main>
      <div class="page-heading"><div><p class="eyebrow">会话成本实验室 / TOKEN LAB</p><h1>每一份成本，都更清楚<span>。</span></h1><p>从一个想法，到更好的方案。探索模型、流程与费用之间的关系。</p></div><span class="session-badge">{{ config.plans.length }} 个对比方案</span></div>
      <div v-if="notice" class="notice" role="status"><Check :size="15" /><span>{{ notice }}</span><button class="icon-button" aria-label="关闭通知" @click="notice = ''"><X :size="14" /></button></div>
      <section class="plan-manager" aria-label="方案管理">
        <div class="section-heading"><div><h2>对比方案 <span class="plan-count">{{ config.plans.length }} / {{ maxPlans }}</span></h2><p>选择一个方案，调整参数，看看费用如何变化。</p></div><div class="plan-toolbar"><button @click="reset"><RotateCcw :size="14" />恢复默认方案</button><button class="primary-button" :disabled="config.plans.length >= maxPlans" @click="addPlan()"><Plus :size="15" />新增方案</button></div></div>
        <div class="plan-list">
          <article v-for="plan in config.plans" :key="plan.id" class="plan-tile" :class="{ selected: selectedId === plan.id }" :style="{ '--plan-color': displayPlanColor(plan.color) }">
            <button class="plan-select" :aria-label="'编辑方案 ' + plan.name" :aria-pressed="selectedId === plan.id" @click="editPlan(plan.id)"><span class="plan-tile-name"><i></i><strong>{{ plan.name || '未命名方案' }}</strong><Pencil :size="12" /></span><span>{{ plan.simulation.flow.turn.filter(step => step.enabled !== false).length }} 个流程步骤 · {{ plan.simulation.turnTotalCount }} 轮</span><small>{{ plan.model.name }}</small></button>
            <div class="plan-tile-actions"><span>{{ config.baselineId === plan.id ? '对比基准' : selectedId === plan.id ? '正在编辑' : '独立方案' }}</span><button :aria-label="'复制方案 ' + plan.name" :disabled="config.plans.length >= maxPlans" @click="addPlan(plan)"><Copy :size="13" /></button><button :aria-label="'删除方案 ' + plan.name" @click="removePlan(plan)"><Trash2 :size="13" /></button></div>
          </article>
        </div>
        <div v-if="config.plans.length" class="comparison-controls"><label>对比基准<select v-model="config.baselineId" aria-label="对比基准"><option v-for="plan in config.plans" :key="plan.id" :value="plan.id">{{ plan.name }}</option></select></label><span>费用差额均相对此方案计算</span><span class="auto-indicator"><i></i>修改后自动重算</span></div>
      </section>
      <div v-if="removed" class="notice" role="status"><span>可撤销最近一次方案删除。</span><button :disabled="config.plans.length >= maxPlans" @click="undoRemove">撤销删除</button></div>
      <div v-if="!config.plans.length" class="empty-state"><Plus :size="30" /><h2>从一个方案开始</h2><p>新增自定义方案，或恢复默认的按需、全量方案。</p><button @click="addPlan()">新增方案</button><button @click="reset">恢复默认方案</button></div>
      <div v-else-if="Object.keys(errors).length" class="empty-state" role="alert"><SlidersHorizontal :size="30" /><h2>请修正实验参数</h2><p>{{ Object.values(errors)[0] }}</p><button @click="editInvalidPlan">编辑待修正方案</button></div>
      <div v-else-if="failure" class="empty-state" role="alert"><h2>暂时无法完成模拟</h2><p>{{ failure }}</p><button @click="config = JSON.parse(JSON.stringify(config))">重新计算</button></div>
      <div v-else-if="busy" class="empty-state" role="status"><LoaderCircle class="spinner" :size="30" /><h2>正在模拟完整会话</h2><p>逐次记录请求、缓存与上下文压缩…</p></div>
      <template v-else-if="report">
        <div v-for="warning in warnings" :key="warning" class="warning" role="status">{{ warning }}</div>
        <div class="results-heading"><h2>费用概览</h2><span>完整会话 · 包含压缩费用</span></div>
        <SummaryCards :results="report.results" :config="report.config" @edit="editPlan" />
        <AnalysisPanel :results="report.results" :config="report.config" />
      </template>
      <footer><span class="footer-mark">T / L</span><p>初始前缀按期望命中率计费 · 每轮流程结束后检查压缩 · 最后一轮触发的压缩也计费<br />所有长度以 K Token 计量。预计费用基于当前参数与费率快照，零分母显示「—」。</p><span>COMPARE / V4</span></footer>
    </main>
  </div>
</template>
