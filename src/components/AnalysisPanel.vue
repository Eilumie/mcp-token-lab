<script setup>
import { computed, ref } from "vue";
import { sourceOption, trendOption } from "../charts.js";
import EChart from "./EChart.vue";
import RequestDetails from "./RequestDetails.vue";

const props = defineProps({ results: Array });
const metric = ref("cumulativeCost");
const metrics = [["cumulativeCost", "累计费用"], ["cost", "当轮费用"], ["peakInput", "每轮峰值输入"], ["context", "轮末上下文"], ["cumulativeTokens", "累计 Token"]];
const currency = computed(() => props.results[0].model.currency);
const trend = computed(() => trendOption(props.results, metric.value, currency.value));
const sourceChart = computed(() => sourceOption(props.results, currency.value));
</script>

<template>
  <section class="analysis-panel" aria-label="结果分析">
    <div class="analysis-body">
      <div class="section-heading"><div><h2>会话趋势</h2><p>圆点标记上下文压缩。</p></div><select v-model="metric" aria-label="趋势指标"><option v-for="[key, label] in metrics" :key="key" :value="key">{{ label }}</option></select></div>
      <EChart class="trend-chart" :option="trend" aria-label="各方案的会话趋势图" />
      <p class="chart-note">普通点最多采样 250 个，另保留全部压缩点、相邻轮次及峰值；费用统计使用完整数据。</p>
    </div>
    <div class="analysis-body analysis-sources">
      <div class="section-heading"><div><h2>费用归因</h2></div></div>
      <EChart :style="{ height: Math.max(220, results.length * 65 + 80) + 'px' }" class="source-chart" :option="sourceChart" aria-label="各方案费用来源堆叠条形图" />
    </div>
    <RequestDetails :results="results" />
  </section>
</template>
