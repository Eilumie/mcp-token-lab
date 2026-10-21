<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { Asterisk, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, X, Check, LoaderCircle, Plus, Copy, Trash2, Pencil, RotateCcw, Undo2, Star } from "lucide-vue-next";
import { createComparisonConfig, createPlan, readComparisonConfig, validateComparison, validatePlan, planColors, maxPlans } from "./comparison.js";
import { displayPlanColor } from "./theme.js";
import { downloadFile } from "./utils.js";
import PlanEditor from "./components/PlanEditor.vue";
import SummaryCards from "./components/SummaryCards.vue";
import AnalysisPanel from "./components/AnalysisPanel.vue";

const config = ref(createComparisonConfig());
const draft = ref(null);
const draftIsNew = ref(false);
const draftErrors = computed(() => {
  if (!draft.value) return {};
  const errors = validatePlan(draft.value);
  const others = config.value.plans.filter(plan => plan.id !== draft.value.id);
  if (others.some(plan => plan.name.trim() === draft.value.name.trim())) errors.planName = "方案名称已存在，请换一个名称";
  if (others.some(plan => plan.model.currency !== draft.value.model.currency)) errors.currency = "对比方案需使用相同币种";
  return errors;
});
const errors = computed(() => validateComparison(config.value));
const notice = ref("");
const undo = shallowRef(null);
const clone = value => JSON.parse(JSON.stringify(value));
function remember(label) { undo.value = { config: clone(config.value), label }; }
function undoChange() {
  if (!undo.value) return;
  config.value = undo.value.config;
  notice.value = `已撤销${undo.value.label}。`;
  undo.value = null;
}
const report = shallowRef(null);
const busy = ref(false);
const failure = ref("");
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
function editPlan(id) {
  const plan = config.value.plans.find(plan => plan.id === id);
  if (!plan) return;
  draftIsNew.value = false;
  draft.value = clone(plan);
}
function savePlan() {
  if (!draft.value || Object.keys(draftErrors.value).length) return;
  if (draftIsNew.value && config.value.plans.length >= maxPlans) return;
  remember(draftIsNew.value ? "新增方案" : "编辑方案");
  const plan = clone(draft.value);
  plan.name = plan.name.trim();
  const index = config.value.plans.findIndex(item => item.id === plan.id);
  if (index < 0) config.value.plans.push(plan);
  else config.value.plans.splice(index, 1, plan);
  if (!config.value.baselineId) config.value.baselineId = plan.id;
  notice.value = `已保存「${plan.name}」，正在更新对比。`;
  draft.value = null;
}
function setBaseline(plan) {
  if (config.value.baselineId === plan.id) return;
  remember("切换基准");
  config.value.baselineId = plan.id;
  notice.value = `已将「${plan.name}」设为对比基准。`;
}
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
  draftIsNew.value = true;
  draft.value = plan;
}
function removePlan(plan) {
  remember("删除方案");
  config.value.plans.splice(config.value.plans.indexOf(plan), 1);
  if (config.value.baselineId === plan.id) config.value.baselineId = config.value.plans[0]?.id ?? null;
  notice.value = `已删除「${plan.name}」。`;
}
function reset() {
  remember("恢复默认方案");
  config.value = createComparisonConfig();
  notice.value = "已恢复两套默认方案，可撤销以找回之前的配置。";
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
    const imported = readComparisonConfig(JSON.parse(await file.text()));
    remember("导入配置");
    config.value = imported;
    notice.value = "方案已导入。";
  } catch (error) { notice.value = "导入失败：" + error.message; }
  finally { event.target.value = ""; }
}
function editInvalidPlan() {
  const key = Object.keys(errors.value).find(key => key.startsWith("plans."));
  const plan = key ? config.value.plans[Number(key.split(".")[1])] : config.value.plans[0];
  if (plan) editPlan(plan.id);
}
</script>

<template>
  <header class="app-header">
    <a class="brand" href="./"><span class="brand-mark"><Asterisk :size="32" :stroke-width="1.6" /></span><strong>Token Lab<span>A LITTLE CLARITY FOR EVERY TOKEN</span></strong></a>
    <nav class="header-actions" aria-label="配置操作"><span class="local-badge"><i></i>本地模拟</span><button aria-label="导入配置" @click="importInput.click()"><ArrowUpFromLine :size="15" /><span>导入配置</span></button><button aria-label="导出配置" :disabled="!!Object.keys(errors).length" @click="exportConfig"><ArrowDownToLine :size="15" /><span>导出配置</span></button><input ref="importInput" type="file" accept=".json,application/json" hidden @change="importConfig" /></nav>
  </header>
  <div class="workspace comparison-workspace">
    <main>
      <div class="page-heading"><div><p class="eyebrow">会话成本实验室 / TOKEN LAB</p><h1>每一份成本，都更清楚<span>。</span></h1><p>从一个想法，到更好的方案。探索模型、流程与费用之间的关系。</p></div><span class="session-badge">{{ config.plans.length }} 个对比方案</span></div>
      <div v-if="notice || undo" class="notice" role="status"><Check :size="15" /><span>{{ notice || '可以撤销最近一次修改。' }}</span><button v-if="undo" class="undo-button" @click="undoChange"><Undo2 :size="14" />撤销{{ undo.label }}</button><button class="icon-button" aria-label="关闭通知" @click="notice = ''; undo = null"><X :size="14" /></button></div>
      <section class="plan-manager" aria-label="方案管理">
        <div class="section-heading"><div><h2>对比方案 <span class="plan-count">{{ config.plans.length }} / {{ maxPlans }}</span></h2><p>编辑流程与参数，保存后更新费用对比。</p></div><div class="plan-toolbar"><button @click="reset"><RotateCcw :size="14" />恢复默认方案</button><button class="primary-button" :disabled="config.plans.length >= maxPlans" @click="addPlan()"><Plus :size="15" />新增方案</button></div></div>
        <div class="plan-list">
          <article v-for="plan in config.plans" :key="plan.id" class="plan-tile" :class="{ baseline: config.baselineId === plan.id }" :style="{ '--plan-color': displayPlanColor(plan.color) }">
            <button class="plan-select" :aria-label="'编辑方案 ' + plan.name" @click="editPlan(plan.id)"><span class="plan-tile-name"><i></i><strong>{{ plan.name || '未命名方案' }}</strong><Pencil :size="12" /></span><span>{{ plan.simulation.flow.turn.filter(step => step.enabled !== false).length }} 个流程步骤 · {{ plan.simulation.turnTotalCount }} 轮</span><small>{{ plan.model.name }}</small></button>
            <div class="plan-tile-actions"><button class="baseline-button" :aria-label="'设为基准 ' + plan.name" :aria-pressed="config.baselineId === plan.id" @click="setBaseline(plan)"><Star :size="13" />{{ config.baselineId === plan.id ? '对比基准' : '设为基准' }}</button><button :aria-label="'复制方案 ' + plan.name" :disabled="config.plans.length >= maxPlans" @click="addPlan(plan)"><Copy :size="13" /><span>复制</span></button><button :aria-label="'删除方案 ' + plan.name" @click="removePlan(plan)"><Trash2 :size="13" /><span>删除</span></button></div>
          </article>
        </div>
        <div class="comparison-controls"><span>最多 {{ maxPlans }} 个独立方案 · 点击星标选择对比基准</span><span class="auto-indicator"><i></i>本地计算，无需 API Key</span></div>
      </section>
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
  <PlanEditor v-if="draft" :plan="draft" :is-new="draftIsNew" :errors="draftErrors" @save="savePlan" @close="draft = null" />
</template>
