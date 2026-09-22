<script setup>
import { computed, onBeforeUnmount, onMounted, reactive, ref, watch } from "vue";
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
  ArrowDown, ArrowUp, Bot, Box, CircleDollarSign, Clock3, Crown, Database,
  FileText, Scale, Search, Sparkles, Target, Upload, Zap,
} from "lucide-vue-next";
import {
  csvCell,
  downloadFile,
  formatMoney,
  formatPercent,
  formatToken,
} from "./utils.js";

const STORAGE_KEY = "token-lab-v1";
const CONTEXT_PROGRESS_MAX = 200_000;
const planNames = ["按需 Tools", "全量 Tools"];
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
const mobileParamsOpen = ref(false);
const mobileChart = ref(false);
let mobileChartQuery;
const updateMobileChart = () => {
  mobileChart.value = mobileChartQuery?.matches ?? false;
};

onMounted(() => {
  mobileChartQuery = window.matchMedia("(max-width: 520px)");
  updateMobileChart();
  mobileChartQuery.addEventListener("change", updateMobileChart);
});
onBeforeUnmount(() => mobileChartQuery?.removeEventListener("change", updateMobileChart));

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
const skillsDiscoveryText = computed(() => {
  if (Object.keys(errors.value).length || hasNumericOverflow.value) return "—";
  return `${state.values.skills_total} × ${state.values.single_skill_discovery}K = ${token(parameters.value.skills_discovery_list)}`;
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
function summaryMoney(value) {
  const symbol = selectedRate.value.currency === "CNY" ? "¥" : "$";
  return `${symbol}${value.toFixed(3)}`;
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
      formatter: (items) => {
        const round = Math.round(Number(items[0]?.axisValue ?? 0));
        const rows = items.map(
          (item) => `${item.marker}${item.seriesName}<span style="float:right;margin-left:20px">${format(item.value[1])}</span>`,
        );
        return [`第 ${round} 轮`, ...rows].join("<br/>");
      },
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
        formatter: (value) => Number.isInteger(value) ? `第 ${Math.round(value)} 轮` : "",
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
  const totals = data.map((result) => result.cost.total);
  const comparisonTotal = Math.max(...totals);
  const colorBySource = new Map(
    data[0].sources.map((source, index) => [source.source, sourceColors[index]]),
  );
  const differenceColor = "#e7eaf1";
  const pies = data.map((result, planIndex) => {
    const slices = result.sources
      .map((source) => ({
        name: source.source,
        value: source.cost.total,
        itemStyle: { color: colorBySource.get(source.source) },
      }))
      .filter((slice) => slice.value > 0);
    const difference = comparisonTotal - result.cost.total;
    if (difference > Math.max(comparisonTotal * Number.EPSILON, 1e-12)) {
      slices.push({
        name: "方案节省",
        value: difference,
        itemStyle: { color: differenceColor },
      });
    }
    slices.sort((a, b) => b.value - a.value);
    return {
      name: planNames[planIndex],
      type: "pie",
      radius: mobileChart.value ? ["31%", "48%"] : ["44%", "68%"],
      center: mobileChart.value
        ? ["50%", planIndex === 0 ? "26%" : "74%"]
        : [planIndex === 0 ? "25%" : "75%", "46%"],
      minAngle: 1,
      avoidLabelOverlap: true,
      itemStyle: { borderColor: "#fff", borderWidth: 2 },
      label: {
        color: "#65738a",
        fontSize: 10,
        formatter: ({ name, percent: share }) => `${name}  ${share}%`,
      },
      labelLine: { length: 9, length2: 7, lineStyle: { color: "#c7ced9" } },
      emphasis: { scaleSize: 5 },
      data: slices,
    };
  });
  const titles = data.map((result, index) => ({
    text: planNames[index],
    subtext: `${summaryMoney(result.cost.total)} · ${percent(ratio(result.cost.total, comparisonTotal))}`,
    left: mobileChart.value ? "50%" : index === 0 ? "25%" : "75%",
    top: mobileChart.value ? (index === 0 ? "22%" : "70%") : "41%",
    textAlign: "center",
    textStyle: { color: "#43516a", fontSize: 13, fontWeight: 600 },
    subtextStyle: { color: "#8c98aa", fontSize: 10, lineHeight: 18 },
  }));
  return {
    animationDuration: 250,
    tooltip: {
      trigger: "item",
      formatter: ({ name, value, percent: share }) =>
        `${name}：${money(value)}（${share}%）`,
    },
    title: titles,
    series: pies,
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
    <aside :class="{ 'mobile-params-open': mobileParamsOpen }">
      <div class="side-title"><h2>实验参数</h2><div class="side-actions"><button class="mobile-params-toggle" :aria-expanded="mobileParamsOpen" @click="mobileParamsOpen = !mobileParamsOpen">{{ mobileParamsOpen ? "收起参数" : "展开参数" }}</button><button class="text-button" @click="resetState">恢复默认</button></div></div>
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
            <span>Skills Discovery List · 自动计算</span><output>{{ skillsDiscoveryText }}</output>
          </div>
          <div v-if="groupIndex === 1" class="field">
            <span>全量 Tools Schema · 自动计算</span><output>{{ fullSchemaText }}</output>
          </div>
        </div>
      </details>

      <p class="hint">1K = 1,000 Token。Skills Discovery List = Skills 总数 × 单个 Skill 索引；全量 Tools Schema = Tools 总数 × 单个 Tool Schema。小数表示每轮平均使用量。</p>
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
          <label v-for="item in [['hit', '输入-缓存'], ['miss', '输入-未缓存'], ['output', '输出']]" :key="item[0]" class="field">
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
      <div class="page-title"><div><h1>每一个 Token，都算清楚。</h1><p>按需 Tools，还是全量 Tools？用同一组参数，看完整会话的费用差异。</p></div><span class="pill">{{ state.values.rounds }} 轮会话 · {{ state.cold ? "冷启动" : "已预热缓存" }}</span></div>
      <div id="notice" role="status">{{ notice }}</div>
      <div v-if="Object.keys(errors).length" class="empty">请修正左侧参数后继续计算。</div>
      <div v-else-if="hasNumericOverflow" class="empty">数值超出可计算范围，请减小参数。</div>

      <template v-else-if="results">
        <div class="model-pricing" aria-label="当前模型价格与费率">
          <div class="model-pricing-title">
            <span class="model-icon" aria-hidden="true"><Box /></span>
            <div><strong>{{ selectedRate.name }}</strong><span class="fixed-price">{{ selectedRate.modified ? "自定义费率" : "固定价格" }}</span><small>实际模型 {{ selectedRate.actual }}</small></div>
          </div>
          <div class="model-pricing-values">
            <span><i class="pricing-icon"><CircleDollarSign /></i><small>输入-缓存</small><b>{{ summaryMoney(selectedRate.hit) }}</b></span>
            <span><i class="pricing-icon"><FileText /></i><small>输入-未缓存</small><b>{{ summaryMoney(selectedRate.miss) }}</b></span>
            <span><i class="pricing-icon"><Upload /></i><small>输出</small><b>{{ summaryMoney(selectedRate.output) }}</b></span>
            <span class="cache-price-ratio" title="缓存费率 = 输入-缓存单价 ÷ 输入-未缓存单价；不是 Token 缓存命中率"><i class="pricing-icon"><Zap /></i><small>缓存费率</small><b>{{ percent(results[0].cachePriceRatio) }}</b><em>缓存 / 未缓存单价</em></span>
            <span class="pricing-unit">{{ selectedRate.currency }} / 1M Token</span>
          </div>
        </div>

        <div class="comparison">
          <section v-for="(result, index) in results" :key="planNames[index]" class="plan" :class="`plan-${index}`">
            <div class="plan-head"><span class="label">方案 0{{ index + 1 }}</span><span class="tag"><Crown v-if="index" aria-hidden="true" /><Search v-else aria-hidden="true" />{{ index ? "全部 Schema 常驻" : "按需发现 Schema" }}</span></div>
            <div class="plan-title"><h2>{{ planNames[index] }}</h2><span>{{ index ? `一次性加载${state.values.tools_total}个Tools Schema` : "按需加载Tools Schema" }}</span></div>
            <div class="price">{{ summaryMoney(result.cost.total) }}<small>{{ selectedRate.currency }} / 会话</small></div>
            <div class="plan-sub"><span><Bot aria-hidden="true" />{{ result.requests.length }} 次 LLM 请求</span><span><Database aria-hidden="true" />初始上下文 {{ token(result.initial_context) }}</span></div>
            <div class="metric-section-title">核心指标</div>
            <div class="metric-grid">
              <div class="metric cached"><span><i><ArrowUp /></i>输入-缓存</span><strong>{{ token(result.total_in_cache) }}</strong><small class="metric-subtext" title="按费用折算，不改变实际上下文长度">{{ result.equivalent === null ? "折算未命中 —（未命中单价为 0）" : `折算未命中 ${token(result.equivalent)}` }}</small></div>
              <div class="metric fresh"><span><i><Sparkles /></i>输入-非缓存</span><strong>{{ token(result.total_in_new) }}</strong></div>
              <div class="metric output"><span><i><Database /></i>输出</span><strong>{{ token(result.total_out) }}</strong></div>
              <div class="metric-progress context"><span><i><Target /></i>最终 context</span><strong>{{ token(result.context) }}</strong><div role="progressbar" aria-label="Context 使用率" :aria-valuenow="Math.min(CONTEXT_PROGRESS_MAX, result.context)" aria-valuemin="0" :aria-valuemax="CONTEXT_PROGRESS_MAX"><b :style="{ width: `${Math.min(100, result.context / CONTEXT_PROGRESS_MAX * 100)}%` }"></b></div></div>
              <div class="metric-progress hit-rate"><span><i><Clock3 /></i>缓存命中率</span><strong>{{ percent(result.hitRate) }}</strong><div><b :style="{ width: `${result.hitRate * 100}%` }"></b></div></div>
            </div>
            <div class="cost-breakdown">
              <div class="cost-breakdown-head"><span>累计费用构成</span><small>金额（{{ selectedRate.currency }}）　　　　　　　占总费用</small></div>
              <span class="cost-row cached"><em>输入-缓存</em><b>{{ summaryMoney(result.cost.cached) }}</b><i><u :style="{ width: `${result.costShare.cached * 100}%` }"></u></i><small>{{ percent(result.costShare.cached) }}</small></span>
              <span class="cost-row fresh"><em>输入-未缓存</em><b>{{ summaryMoney(result.cost.fresh) }}</b><i><u :style="{ width: `${result.costShare.fresh * 100}%` }"></u></i><small>{{ percent(result.costShare.fresh) }}</small></span>
              <span class="cost-row output"><em>输出</em><b>{{ summaryMoney(result.cost.generated) }}</b><i><u :style="{ width: `${result.costShare.output * 100}%` }"></u></i><small>{{ percent(result.costShare.output) }}</small></span>
            </div>
          </section>
        </div>

        <div class="saving"><span class="saving-icon"><Scale /></span><div><small>按需 Tools 相比全量 Tools{{ saving.delta < 0 ? "多花费" : "节省" }}</small><strong>{{ summaryMoney(Math.abs(saving.delta)) }}</strong></div><b><ArrowUp v-if="saving.delta < 0" /><ArrowDown v-else />{{ percent(saving.percent) }}</b></div>

        <section class="panel">
          <div class="section-head"><div><h2>费用占比</h2><p>按费用从高到低排列；低费用方案的灰色区域表示方案节省</p></div><button @click="exportCsv('sources')">导出归因 CSV ↗</button></div>
          <EChart id="source-pies" class="source-chart" :option="sourceChartOption" aria-label="两种方案按费用排序的费用占比饼图" />
        </section>

        <section class="panel">
          <div class="section-head"><div><h2>会话越长，差异如何变化？</h2><p>完整逐轮计算 · 曲线最多展示 250 个采样点</p></div><select v-model="trend" aria-label="趋势指标"><option value="cumulativeCost">累计费用</option><option value="cost">当轮费用</option><option value="tokens">累计 Token</option><option value="context">Context 长度</option></select></div>
          <EChart id="chart" class="trend-chart" :option="trendChartOption" aria-label="两种方案随会话轮次变化的趋势图" />
        </section>

        <section class="panel">
          <div class="section-head"><div><h2>逐步计算明细</h2><p>按原始公式展开，每一笔都可追溯 · Token 单位 K</p></div><button @click="exportCsv('requests')">导出请求 CSV ↗</button></div>
          <div class="detail-toolbar"><div class="segmented"><button :class="{ active: detailPlan === 0 }" @click="detailPlan = 0">按需 Tools</button><button :class="{ active: detailPlan === 1 }" @click="detailPlan = 1">全量 Tools</button></div><div><button :disabled="detailPage === 1" @click="detailPage--">←</button><span id="page-label"> {{ detailPage }} / {{ detailPages }} </span><button :disabled="detailPage === detailPages" @click="detailPage++">→</button></div></div>
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
