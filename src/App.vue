<script setup>
import { computed, reactive, ref, watch } from "vue";
import {
  defaults,
  groups,
  mergePresets,
  presets,
  readConfig,
  toTokens,
  validate,
} from "./config.js";
import { ratio } from "./accounting.js";
import { calculateOnDemand } from "./on-demand.js";
import { calculateFullLoad } from "./full-load.js";
import EChart from "./components/EChart.vue";
import {
  csvCell,
  downloadFile,
  formatMoney,
  formatPercent,
  formatToken,
} from "./utils.js";

const STORAGE_KEY = "token-lab-v1";
const planNames = ["按需加载", "全量加载"];
const sourceColors = [
  "#71819b", "#ce9f54", "#7d94b8", "#7161d5", "#a991cd",
  "#529a90", "#dd8c63", "#b2b969", "#879fb0", "#d7a3a3", "#4358af",
];

function createDefaultState() {
  return {
    version: 1,
    schemaSizingVersion: 1,
    values: { ...defaults },
    rates: structuredClone(presets),
    selected: presets[0].id,
    cold: false,
  };
}

function loadState() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) return createDefaultState();
    const saved = mergePresets(readConfig(JSON.parse(stored)));
    if (!saved.schemaSizingVersion) {
      if (saved.values.single_tool_schema === 0.5) {
        saved.values.single_tool_schema = 0.51;
      }
      saved.schemaSizingVersion = 1;
    }
    delete saved.values.full_tools_schema;
    return saved;
  } catch {
    return createDefaultState();
  }
}

const state = reactive(loadState());
const detailPlan = ref(0);
const detailPage = ref(1);
const trend = ref("cumulativeCost");
const notice = ref("");
const rateDialog = ref(null);
const importInput = ref(null);
const newModelName = ref("");

const selectedRate = computed(() =>
  state.rates.find((item) => item.id === state.selected),
);
const errors = computed(() => validate(state.values, selectedRate.value));
const parameters = computed(() => toTokens(state.values));
const results = computed(() => {
  if (Object.keys(errors.value).length) return null;
  const values = parameters.value;
  const rate = selectedRate.value;
  const calculated = [
    calculateOnDemand(values, rate, state.cold),
    calculateFullLoad(values, rate, state.cold),
  ];
  const invalid = calculated.some(
    (result) =>
      !Number.isFinite(result.cost.total) ||
      !Number.isFinite(result.context) ||
      !Number.isFinite(result.input_tokens),
  );
  return invalid ? null : calculated;
});
const hasNumericOverflow = computed(
  () => !Object.keys(errors.value).length && !results.value,
);
const fullSchemaText = computed(() => {
  if (Object.keys(errors.value).length || hasNumericOverflow.value) return "—";
  return `${state.values.tools_total} × ${state.values.single_tool_schema}K = ${token(parameters.value.full_tools_schema)}`;
});
const rateInfo = computed(() => {
  const rate = selectedRate.value;
  return {
    dateLabel: rate.sourceLabel ? "数据日期" : "核实日期",
    hasLink: rate.source.startsWith("https://"),
  };
});
const canRestoreRate = computed(() =>
  presets.some((item) => item.id === state.selected),
);
const rateWarning = computed(() =>
  +selectedRate.value.hit > +selectedRate.value.miss
    ? "命中单价高于未命中单价，请确认自定义费率。"
    : "",
);
const saving = computed(() => {
  if (!results.value) return null;
  const [onDemand, fullLoad] = results.value;
  const delta = fullLoad.cost.total - onDemand.cost.total;
  return {
    delta,
    percent: ratio(Math.abs(delta), fullLoad.cost.total),
  };
});
const currentDetails = computed(() => {
  if (!results.value) return [];
  const rounds = results.value[detailPlan.value].rounds;
  return rounds.slice((detailPage.value - 1) * 5, detailPage.value * 5);
});
const detailPages = computed(() =>
  results.value
    ? Math.max(1, Math.ceil(results.value[detailPlan.value].rounds.length / 5))
    : 1,
);
const trendChartOption = computed(() => buildTrendChartOption(results.value, trend.value));
const sourceChartOption = computed(() => buildSourceChartOption(results.value));

watch(
  state,
  () => {
    if (!results.value) return;
    try {
      // 预设价格允许临时试算，但写入缓存时始终恢复为代码中的官方价格。
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(mergePresets(structuredClone(state))),
      );
      notice.value = tierNotice();
    } catch {}
  },
  { deep: true, immediate: true },
);
watch([detailPlan, results], () => {
  detailPage.value = 1;
});

function token(value) {
  return formatToken(value);
}
function percent(value) {
  return formatPercent(value);
}
function money(value) {
  return formatMoney(value, selectedRate.value.currency);
}
function updateValue(id, event) {
  state.values[id] = event.target.value === "" ? "" : Number(event.target.value);
}
function updateRate(id, event) {
  selectedRate.value[id] =
    event.target.value === "" ? "" : Number(event.target.value);
  if (!canRestoreRate.value) selectedRate.value.modified = true;
}
function resetState() {
  Object.assign(state, createDefaultState());
  detailPage.value = 1;
  notice.value = "";
}
function restoreRate() {
  const original = presets.find((item) => item.id === state.selected);
  const index = state.rates.findIndex((item) => item.id === state.selected);
  state.rates[index] = structuredClone(original);
}
function deleteRate() {
  state.rates = state.rates.filter((item) => item.id !== state.selected);
  state.selected = state.rates[0].id;
}
function openRateDialog() {
  newModelName.value = "";
  rateDialog.value.showModal();
}
function createRate() {
  const name = newModelName.value.trim();
  if (!name) return;
  const customRate = {
    ...selectedRate.value,
    id: crypto.randomUUID(),
    name,
    actual: name,
    period: "自定义",
    source: "",
    verified: new Date().toISOString().slice(0, 10),
    modified: true,
  };
  state.rates.push(customRate);
  state.selected = customRate.id;
  rateDialog.value.close();
}
function exportConfig() {
  if (!results.value) return;
  downloadFile(
    "token-lab-config.json",
    JSON.stringify(
      {
        ...state,
        simulation: "逐步公式；历史全保留；每轮重新读取；初始缓存由 cold 指定",
      },
      null,
      2,
    ),
    "application/json",
  );
}
async function importConfig(event) {
  try {
    const file = event.target.files[0];
    if (!file) return;
    const imported = mergePresets(readConfig(JSON.parse(await file.text())));
    delete imported.values.full_tools_schema;
    Object.assign(state, imported);
    detailPage.value = 1;
    notice.value = "";
  } catch (error) {
    notice.value = `导入失败：${error.message}`;
  } finally {
    event.target.value = "";
  }
}
function tierNotice() {
  const tier = selectedRate.value.tier;
  if (!tier || !results.value) return "";
  const outsideTier = results.value.some((result) =>
    result.requests.some((request) => {
      const inputTokens = request.in_cache + request.in_new;
      return (
        inputTokens <= tier.input_tokens_gt || inputTokens > tier.input_tokens_lte
      );
    }),
  );
  return outsideTier
    ? "部分请求输入量不在所选价格档位内。当前为固定档位模拟，请选择匹配档位；此结果不是自动阶梯计费账单。"
    : "";
}
function requestRows(round) {
  const requestCount = detailPlan.value ? 3 : 4;
  return results.value[detailPlan.value].requests.slice(
    (round.round - 1) * requestCount,
    round.round * requestCount,
  );
}
function logicalNew(request, result) {
  return request.in_new - (request.cold ? result.initial_context : 0);
}

function metricFormatter(metric) {
  return (value) => {
    if (!["cost", "cumulativeCost"].includes(metric)) return token(value);
    const symbol = selectedRate.value.currency === "CNY" ? "¥" : "$";
    const amount = value === 0 ? "0" : value < 0.00001 ? value.toExponential(1) : value.toFixed(5);
    return `${symbol}${amount}`;
  };
}

function buildTrendChartOption(data, metric) {
  if (!data) return {};
  const format = metricFormatter(metric);
  return {
    animationDuration: 250,
    color: ["#5063d8", "#db9a62"],
    grid: { left: 16, right: 16, top: 42, bottom: 8, containLabel: true },
    legend: { top: 0, right: 0, itemWidth: 13, itemHeight: 7, textStyle: { color: "#8795ad", fontSize: 10 } },
    tooltip: {
      trigger: "axis",
      valueFormatter: format,
      axisPointer: { type: "line", lineStyle: { color: "#aab4c5" } },
    },
    xAxis: {
      type: "value",
      min: state.values.rounds === 1 ? 0.5 : 1,
      max: state.values.rounds === 1 ? 1.5 : state.values.rounds,
      minInterval: 1,
      name: "轮次",
      nameTextStyle: { color: "#97a2b4", fontSize: 10 },
      axisLabel: {
        color: "#97a2b4",
        fontSize: 10,
        formatter: (value) => Number.isInteger(value) ? `第 ${value} 轮` : "",
      },
      axisLine: { lineStyle: { color: "#dfe4ec" } },
      splitLine: { show: false },
    },
    yAxis: {
      type: "value",
      axisLabel: { color: "#97a2b4", fontSize: 10, formatter: format },
      axisLine: { show: false },
      axisTick: { show: false },
      splitLine: { lineStyle: { color: "#e9edf4" } },
    },
    series: data.map((result, index) => {
      const sampleEvery = Math.max(1, Math.ceil(result.rounds.length / 250));
      const rows = result.rounds.filter(
        (_, rowIndex) => rowIndex % sampleEvery === 0 || rowIndex === result.rounds.length - 1,
      );
      return {
        name: planNames[index],
        type: "line",
        showSymbol: rows.length < 30,
        symbolSize: 6,
        lineStyle: { width: 2.5 },
        data: rows.map((row) => [row.round, row[metric]]),
      };
    }),
  };
}

function buildSourceChartOption(data) {
  if (!data) return {};
  return {
    animationDuration: 250,
    color: sourceColors,
    grid: { left: 0, right: 16, top: 4, bottom: 52, containLabel: true },
    legend: { bottom: 0, left: 0, itemWidth: 8, itemHeight: 8, textStyle: { color: "#8893a6", fontSize: 9 } },
    tooltip: { trigger: "item", valueFormatter: (value) => money(value) },
    xAxis: { type: "value", show: false },
    yAxis: {
      type: "category",
      data: planNames,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { color: "#8491a7", fontSize: 10 },
    },
    series: data[0].sources.map((source, sourceIndex, sources) => ({
      name: source.source,
      type: "bar",
      stack: "cost",
      barWidth: 23,
      emphasis: { focus: "series" },
      data: data.map((result) => result.sources[sourceIndex].cost.total),
      label: sourceIndex === sources.length - 1
        ? { show: true, position: "right", color: "#60718b", fontSize: 10, formatter: ({ dataIndex }) => money(data[dataIndex].cost.total) }
        : undefined,
    })),
  };
}

function exportCsv(kind) {
  if (!results.value) return;
  const rate = selectedRate.value;
  const metadata = [
    "方案", "模型", "实际模型", "时段", "币种", "命中单价/M", "未命中单价/M",
    "输出单价/M", "核实日期", "冷启动", "参数快照",
  ];
  const detailHeaders = kind === "sources"
    ? ["来源", "首次Token", "命中Token", "未命中Token", "输出Token", "命中费用", "未命中费用", "输出费用", "总费用", "费用占比"]
    : ["轮次", "阶段", "input前", "context前", "命中Token", "未命中Token", "输出Token", "工具结果", "input后", "context后", "累计命中", "累计未命中", "累计输出", "本次费用", "累计费用"];
  const rows = [metadata.concat(detailHeaders)];
  results.value.forEach((result, planIndex) => {
    const common = [
      planNames[planIndex], rate.name, rate.actual, rate.period, rate.currency,
      rate.hit, rate.miss, rate.output, rate.verified, state.cold,
      JSON.stringify(state.values),
    ];
    if (kind === "sources") {
      result.sources.forEach((source) => rows.push(common.concat([
        source.source, source.first, source.hit, source.miss, source.output,
        source.cost.cached, source.cost.fresh, source.cost.generated,
        source.cost.total, ratio(source.cost.total, result.cost.total),
      ])));
    } else {
      result.requests.forEach((request) => rows.push(common.concat([
        request.round, request.stage, request.input_before, request.context_before,
        request.in_cache, request.in_new, request.out, request.tool_result,
        request.input_after, request.context_after, request.total_in_cache,
        request.total_in_new, request.total_out, request.cost.total,
        request.cumulativeCost,
      ])));
    }
  });
  const csv = "\uFEFF" + rows.map((row) => row.map(csvCell).join(",")).join("\r\n");
  downloadFile(`token-lab-${kind}.csv`, csv, "text/csv;charset=utf-8");
}
</script>

<template>
  <header>
    <div class="brand"><b class="logo">T</b><strong>Token Lab</strong><span class="divider"></span><span>Agent 成本实验室</span></div>
    <div class="header-actions">
      <span class="local">● 本地计算</span>
      <button @click="importInput.click()">导入配置</button>
      <button @click="exportConfig">导出配置 ↗</button>
      <input ref="importInput" type="file" accept=".json" hidden @change="importConfig" />
    </div>
  </header>

  <div class="layout">
    <aside>
      <div class="side-title"><h2>实验参数</h2><button class="text-button" @click="resetState">恢复默认</button></div>
      <p class="muted">修改任意参数，实时对比两种方案。</p>

      <details v-for="(group, groupIndex) in groups" :key="group[0]" class="param-group" :open="groupIndex < 2">
        <summary>{{ group[0] }}</summary>
        <div class="fields">
          <label v-for="field in group[1]" :key="field[0]" class="field">
            <span>{{ field[1] }}</span>
            <div class="input-wrap">
              <input :aria-label="field[1]" type="number" min="0" step="any" :value="state.values[field[0]]" @input="updateValue(field[0], $event)" />
              <em>{{ field[3] }}</em>
            </div>
            <small class="error">{{ errors[field[0]] }}</small>
          </label>
          <div v-if="groupIndex === 1" class="field">
            <span>全量 Tools Schema · 自动计算</span><output>{{ fullSchemaText }}</output>
          </div>
        </div>
      </details>

      <p class="hint">1K = 1,000 Token。全量 Tools Schema = Tools 总数 × 单个 Tool Schema。小数表示每轮平均使用量。</p>
      <label class="toggle"><input v-model="state.cold" type="checkbox" /><span>冷启动<small>首请求初始上下文不命中缓存</small></span></label>

      <div class="param-group">
        <h3>模型与费率</h3>
        <select id="model" v-model="state.selected" aria-label="模型费率">
          <option v-for="item in state.rates" :key="item.id" :value="item.id">{{ item.name }}{{ item.modified ? " · 自定义" : "" }}</option>
        </select>
        <p class="hint">
          实际模型：{{ selectedRate.actual }}<br />
          {{ selectedRate.currency }} · {{ selectedRate.period }} · {{ rateInfo.dateLabel }} {{ selectedRate.verified }}
          <a v-if="rateInfo.hasLink" :href="selectedRate.source" target="_blank" rel="noopener"> · 费率来源 ↗</a>
          <template v-if="selectedRate.modified"> · 已自定义</template>
          <template v-if="selectedRate.provider === 'aliyun-bailian'">
            <br />{{ selectedRate.region }} · {{ selectedRate.sourceLabel }}<br />采用隐式缓存命中价格。
            <template v-if="selectedRate.explicitCacheCreate != null"><br />显式缓存创建 {{ money(selectedRate.explicitCacheCreate) }} / 1M；显式命中 {{ money(selectedRate.explicitCacheHit) }} / 1M（仅供参考，不参与计算）</template>
          </template>
        </p>
        <div class="fields rates">
          <label v-for="item in [['hit', '输入 · 缓存命中'], ['miss', '输入 · 未命中'], ['output', '输出']]" :key="item[0]" class="field">
            <span>{{ item[1] }}</span>
            <div class="input-wrap"><input type="number" min="0" step="any" :value="selectedRate[item[0]]" @input="updateRate(item[0], $event)" /><em>{{ selectedRate.currency === 'CNY' ? '¥' : '$' }}/M</em></div>
            <small class="error">{{ errors[item[0]] }}</small>
          </label>
        </div>
        <div class="button-row"><button @click="openRateDialog">新增模型</button><button :disabled="!canRestoreRate" @click="restoreRate">恢复费率</button><button :disabled="canRestoreRate" @click="deleteRate">删除</button></div>
        <p class="hint">{{ selectedRate.pricingNote || "费率快照非实时更新；整个会话按所选时段计价。高峰：工作日 UTC 01–04、06–10 时，中国法定节假日除外。" }}</p>
        <p class="warning">{{ rateWarning }}</p>
      </div>
    </aside>

    <main>
      <div class="eyebrow">SCHEMA STRATEGY / COST SIMULATOR</div>
      <div class="page-title"><div><h1>每一个 Token，都算清楚。</h1><p>按需发现，还是全量加载？用同一组参数，看完整会话的费用差异。</p></div><span class="pill">{{ state.values.rounds }} 轮会话 · {{ state.cold ? "冷启动" : "已预热缓存" }}</span></div>
      <div id="notice" role="status">{{ notice }}</div>
      <div v-if="Object.keys(errors).length" class="empty">请修正左侧参数后继续计算。</div>
      <div v-else-if="hasNumericOverflow" class="empty">数值超出可计算范围，请减小参数。</div>

      <template v-else-if="results">
        <div class="model-pricing" aria-label="当前模型价格与费率">
          <div class="model-pricing-title"><strong>{{ selectedRate.name }}</strong><span>实际模型 {{ selectedRate.actual }}{{ selectedRate.modified ? " · 自定义费率" : "" }}</span></div>
          <div class="model-pricing-values"><span>命中输入 <b>{{ money(selectedRate.hit) }}</b></span><span>未命中输入 <b>{{ money(selectedRate.miss) }}</b></span><span>输出 <b>{{ money(selectedRate.output) }}</b></span><span class="pricing-unit">{{ selectedRate.currency }} / 1M Token</span><span class="cache-price-ratio" title="缓存费率 = 命中输入单价 ÷ 未命中输入单价；不是 Token 缓存命中率">缓存费率 <b>{{ percent(results[0].cachePriceRatio) }}</b> <small>命中 / 未命中单价</small></span></div>
        </div>

        <div class="comparison">
          <section v-for="(result, index) in results" :key="planNames[index]" class="plan" :class="`plan-${index}`">
            <div class="plan-head"><span class="label">方案 0{{ index + 1 }}</span><span class="tag">{{ index ? "全部 Schema 常驻" : "按需发现 Schema" }}</span></div>
            <h2>{{ planNames[index] }}</h2><div class="price">{{ money(result.cost.total) }}<small>{{ selectedRate.currency }} / 会话</small></div>
            <div class="plan-sub">{{ result.requests.length }} 次 LLM 请求 <span>初始上下文 {{ token(result.initial_context) }}</span></div>
            <div class="metric-grid">
              <div><span>输出 Token</span><strong>{{ token(result.total_out) }}</strong></div>
              <div><span>命中输入</span><strong>{{ token(result.total_in_cache) }}</strong><small class="metric-subtext" title="按费用折算，不改变实际上下文长度">{{ result.equivalent === null ? "折算未命中 —（未命中单价为 0）" : `折算未命中 ${token(result.equivalent)}` }}</small></div>
              <div><span>未命中输入</span><strong>{{ token(result.total_in_new) }}</strong></div><div><span>最终 context</span><strong>{{ token(result.context) }}</strong></div><div><span>缓存命中率</span><strong>{{ percent(result.hitRate) }}</strong></div>
            </div>
            <div class="cost-breakdown">
              <div class="cost-breakdown-head"><span>累计费用构成</span><small>金额 / 占总费用</small></div>
              <span>输出 <b>{{ money(result.cost.generated) }} <small>{{ percent(result.costShare.output) }}</small></b></span>
              <span>命中输入 <b>{{ money(result.cost.cached) }} <small>{{ percent(result.costShare.cached) }}</small></b></span>
              <span>未命中输入 <b>{{ money(result.cost.fresh) }} <small>{{ percent(result.costShare.fresh) }}</small></b></span>
            </div>
          </section>
        </div>

        <div class="saving"><span class="saving-icon">↘</span><div>方案一{{ saving.delta < 0 ? "多花费" : "节省" }} <strong>{{ money(Math.abs(saving.delta)) }}</strong><small>相对全量加载 {{ percent(saving.percent) }}</small></div><span>同一模型 · 同一会话参数</span></div>

        <section class="panel">
          <div class="section-head"><div><h2>会话越长，差异如何变化？</h2><p>完整逐轮计算 · 曲线最多展示 250 个采样点</p></div><select v-model="trend" aria-label="趋势指标"><option value="cumulativeCost">累计费用</option><option value="cost">当轮费用</option><option value="tokens">累计 Token</option><option value="context">Context 长度</option></select></div>
          <EChart id="chart" class="trend-chart" :option="trendChartOption" aria-label="两种方案随会话轮次变化的趋势图" />
        </section>

        <section class="panel">
          <div class="section-head"><div><h2>费用花在哪里</h2><p>含内容生成，以及后续每一次输入的费用</p></div><button @click="exportCsv('sources')">导出归因 CSV ↗</button></div>
          <EChart id="source-bars" class="source-chart" :option="sourceChartOption" aria-label="两种方案的费用来源堆叠图" />
          <div class="table-scroll"><table><thead><tr><th>内容来源 / 方案</th><th>首次内容</th><th>命中输入</th><th>未命中输入</th><th>输出</th><th>命中费用</th><th>未命中费用</th><th>输出费用</th><th>合计 {{ selectedRate.currency }}</th><th>占总费用</th></tr></thead><tbody><template v-for="(source, sourceIndex) in results[0].sources" :key="source.source"><tr v-for="(result, planIndex) in results" :key="planIndex"><td><i class="dot" :style="{ background: sourceColors[sourceIndex] }"></i>{{ result.sources[sourceIndex].source }}<small>{{ planNames[planIndex] }}</small></td><td>{{ token(result.sources[sourceIndex].first) }}</td><td>{{ token(result.sources[sourceIndex].hit) }}</td><td>{{ token(result.sources[sourceIndex].miss) }}</td><td>{{ token(result.sources[sourceIndex].output) }}</td><td>{{ money(result.sources[sourceIndex].cost.cached) }}</td><td>{{ money(result.sources[sourceIndex].cost.fresh) }}</td><td>{{ money(result.sources[sourceIndex].cost.generated) }}</td><td>{{ money(result.sources[sourceIndex].cost.total) }}</td><td>{{ percent(ratio(result.sources[sourceIndex].cost.total, result.cost.total)) }}</td></tr></template></tbody></table></div>
        </section>

        <section class="panel">
          <div class="section-head"><div><h2>逐步计算明细</h2><p>按原始公式展开，每一笔都可追溯 · Token 单位 K</p></div><button @click="exportCsv('requests')">导出请求 CSV ↗</button></div>
          <div class="detail-toolbar"><div class="segmented"><button :class="{ active: detailPlan === 0 }" @click="detailPlan = 0">按需加载</button><button :class="{ active: detailPlan === 1 }" @click="detailPlan = 1">全量加载</button></div><div><button :disabled="detailPage === 1" @click="detailPage--">←</button><span id="page-label"> {{ detailPage }} / {{ detailPages }} </span><button :disabled="detailPage === detailPages" @click="detailPage++">→</button></div></div>
          <div id="details"><details v-for="round in currentDetails" :key="round.round" class="round-detail"><summary><span>第 {{ round.round }} 轮 <small>{{ detailPlan ? 3 : 4 }} 次请求</small></span><span>{{ money(round.cost) }}</span></summary><details v-for="request in requestRows(round)" :key="request.stage" class="request"><summary><span>{{ request.stage }}</span><span>命中 {{ token(request.in_cache) }} · 新增 {{ token(request.in_new) }} · 输出 {{ token(request.out) }}</span></summary><div class="request-body"><div>input：{{ token(request.input_before) }} → {{ token(request.input_after) }}　context：{{ token(request.context_before) }} → {{ token(request.context_after) }}<br/>工具结果 {{ token(request.tool_result) }} · 本次 {{ money(request.cost.total) }} · 累计 {{ money(request.cumulativeCost) }}<br/>累计命中 {{ token(request.total_in_cache) }} / 新增 {{ token(request.total_in_new) }} / 输出 {{ token(request.total_out) }}</div><pre>in_cache = {{ request.cold ? "0（冷启动）" : `input = ${token(request.input_before)}` }}
in_new = {{ request.first ? `用户消息 + context - input = ${token(request.user_message)} + ` : "context - input = " }}{{ token(request.context_before) }} - {{ token(request.input_before) }}{{ request.cold ? ` + 初始上下文 ${token(results[detailPlan].initial_context)}` : "" }} = {{ token(request.in_new) }}
out = {{ token(request.out) }}
total_in_cache += {{ token(request.in_cache) }}
total_in_new += {{ token(request.in_new) }}
total_out += {{ token(request.out) }}
input += {{ token(logicalNew(request, results[detailPlan])) }} → {{ token(request.input_after) }}
context = input + out + tool_result
        = {{ token(request.input_after) }} + {{ token(request.out) }} + {{ token(request.tool_result) }} = {{ token(request.context_after) }}</pre></div></details></details></div>
        </section>
      </template>

      <footer>计算口径：历史完整保留 · 每轮重新读取技能与 Schema · 上轮输出在下次请求中作为新输入<br/>预计费用基于输入参数与费率快照，不代表真实 API 账单。零分母指标显示 —。</footer>
    </main>
  </div>

  <dialog ref="rateDialog"><form @submit.prevent="createRate"><h2>新增自定义模型</h2><label class="field">模型名称<input v-model="newModelName" required maxlength="80" /></label><p class="muted">将复制当前费率；创建后可直接修改三个单价。</p><div class="button-row"><button type="button" @click="rateDialog.close()">取消</button><button class="primary">创建模型</button></div></form></dialog>
</template>
