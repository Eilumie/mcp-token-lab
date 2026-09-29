<script setup>
import { computed, onBeforeUnmount, ref, shallowRef, watch } from "vue";
import { Activity, ArrowDownToLine, ArrowUpFromLine, SlidersHorizontal, X, Check, LoaderCircle } from "lucide-vue-next";
import { createConfig, readConfig, validate } from "./config.js";
import { downloadFile } from "./utils.js";
import ParameterPanel from "./components/ParameterPanel.vue";
import SummaryCards from "./components/SummaryCards.vue";
import AnalysisPanel from "./components/AnalysisPanel.vue";

const notice = ref("");
const config = ref(createConfig());
const errors = computed(() => validate(config.value));
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
  if (Object.keys(errors.value).length) return;
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
    deadline = setTimeout(() => { if (worker !== currentWorker) return; finish(); failure.value = "计算超过 20 秒，请减少轮次或降低压缩阈值。"; }, 20000);
    currentWorker.postMessage(snapshot);
  }, 220);
}, { deep: true, immediate: true });
onBeforeUnmount(cancel);
const warnings = computed(() => {
  if (!report.value) return [];
  const { results, config: c } = report.value;
  const messages = [];
  if (c.model.inputCachedPrice > c.model.inputNotCachedPrice) messages.push("命中单价高于未命中单价，缓存可能增加费用。");
  if (c.pricing.contextWindow && results.some(r => r.peakInput * 1000 > c.pricing.contextWindow)) messages.push("部分请求输入超过所选模型的上下文上限；当前展示完整模拟消耗。");
  if (c.pricing.tier && results.some(r => r.requests.some(q => q.input * 1000 <= c.pricing.tier.input_tokens_gt || q.input * 1000 > c.pricing.tier.input_tokens_lte))) messages.push("部分请求不在所选价格档位内。当前使用固定档位，不自动跨档计费。");
  if (results.some(r => r.compressions.some(c => c.after >= c.before))) messages.push("部分压缩没有缩短上下文，可减小摘要长度或保留轮次。");
  return messages;
});
function reset() { config.value = createConfig(); notice.value = "已恢复默认参数，并选择第一个模型。"; }
function exportConfig() {
  downloadFile("token-lab-session.json", JSON.stringify(config.value, null, 2), "application/json");
  notice.value = "已导出配置及当前费率快照。";
}
async function importConfig(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  try {
    if (file.size > 500000) throw new Error("配置文件不能超过 500KB。");
    config.value = readConfig(JSON.parse(await file.text()));
    notice.value = "配置已导入。";
  } catch (error) { notice.value = "导入失败：" + error.message; }
  finally { event.target.value = ""; }
}
</script>

<template>
  <header class="app-header">
    <a class="brand" href="./"><span class="brand-mark"><Activity :size="24" /></span><strong>Token Lab<span>AGENT COST SIMULATOR</span></strong></a>
    <nav class="header-actions" aria-label="配置操作"><span class="local-badge"><i></i>本地模拟</span><button aria-label="导入配置" @click="importInput.click()"><ArrowUpFromLine :size="15" /><span>导入配置</span></button><button aria-label="导出配置" :disabled="!!Object.keys(errors).length" @click="exportConfig"><ArrowDownToLine :size="15" /><span>导出配置</span></button><input ref="importInput" type="file" accept=".json,application/json" hidden @change="importConfig" /></nav>
  </header>
  <div class="workspace">
    <button class="mobile-config-button" @click="mobileParams = !mobileParams"><X v-if="mobileParams" :size="16" /><SlidersHorizontal v-else :size="16" />{{ mobileParams ? '收起实验参数' : '调整实验参数' }}</button>
    <div class="parameter-container" :class="{ 'mobile-open': mobileParams }"><ParameterPanel :config="config" :errors="errors" @reset="reset" /></div>
    <main>
      <div class="page-heading"><div><p class="eyebrow">MEASURE. COMPARE. UNDERSTAND.</p><h1>让每一个 Token 有据可循<span>。</span></h1><p>从工具加载到上下文压缩，看清完整会话的成本。</p></div><span class="session-badge">{{ config.simulation.turnTotalCount || '—' }} 轮会话</span></div>
      <div v-if="notice" class="notice" role="status"><Check :size="15" /><span>{{ notice }}</span><button class="icon-button" aria-label="关闭通知" @click="notice = ''"><X :size="14" /></button></div>
      <div class="scenario-strip"><span class="scenario-label">当前实验</span><strong>{{ config.model.name }}</strong><span class="separator">/</span><span>{{ config.simulation.compressionThresholdType === 'TURN' ? '按轮次压缩' : '按 Token 压缩' }}</span><span class="separator">/</span><span>保留最近 {{ config.simulation.compressionKeepTurns }} 轮</span><span class="auto-indicator"><i></i>自动重算</span></div>
      <div v-if="Object.keys(errors).length" class="empty-state" role="alert"><SlidersHorizontal :size="30" /><h2>请修正实验参数</h2><p>{{ Object.values(errors)[0] }}</p><button class="mobile-only" @click="mobileParams = true">打开参数面板</button></div>
      <div v-else-if="failure" class="empty-state" role="alert"><h2>暂时无法完成模拟</h2><p>{{ failure }}</p><button @click="config = JSON.parse(JSON.stringify(config))">重新计算</button></div>
      <div v-else-if="busy" class="empty-state" role="status"><LoaderCircle class="spinner" :size="30" /><h2>正在模拟完整会话</h2><p>逐次记录请求、缓存与上下文压缩…</p></div>
      <template v-else-if="report">
        <div v-for="warning in warnings" :key="warning" class="warning" role="status">{{ warning }}</div>
        <SummaryCards :results="report.results" :config="report.config" />
        <AnalysisPanel :results="report.results" :config="report.config" />
      </template>
      <footer><span class="footer-mark">T / L</span><p>初始前缀按期望命中率计费 · 每轮回复后检查压缩 · 最后一轮触发的压缩也计费<br />所有长度以 K Token 计量。预计费用基于当前参数与费率快照，零分母显示「—」。</p><span>SESSION / V2</span></footer>
    </main>
  </div>
</template>
