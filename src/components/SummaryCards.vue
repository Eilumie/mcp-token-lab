<script setup>
import { computed } from "vue";
import { ArrowDownRight, Layers, Zap, Database, Pencil } from "lucide-vue-next";
import { ratio } from "../session-report.js";
import { money, token, percent, number } from "../utils.js";
const props = defineProps({ results: Array, config: Object });
defineEmits(["edit"]);
const baseline = computed(() => props.results.find(r => r.planId === props.config.baselineId) || props.results[0]);
const cheapest = computed(() => props.results.reduce((best, r) => r.cost.total < best.cost.total ? r : best));
const allEqual = computed(() => props.results.every(r => r.cost.total === props.results[0].cost.total));
const currency = computed(() => props.results[0].model.currency);
const savings = computed(() => baseline.value.cost.total - cheapest.value.cost.total);
const m = value => money(value, currency.value);
function difference(result) {
  if (result.planId === baseline.value.planId) return "对比基准";
  const delta = result.cost.total - baseline.value.cost.total;
  if (delta === 0) return "与基准费用相同";
  return `比基准${delta > 0 ? "多" : "少"} ${m(Math.abs(delta))} · ${percent(ratio(Math.abs(delta), baseline.value.cost.total))}`;
}
const costParts = [["cached", "命中输入"], ["fresh", "未命中输入"], ["generated", "模型输出"]];
</script>

<template>
  <div class="comparison-cards">
    <article v-for="result in results" :key="result.planId" class="strategy-card" :style="{ borderTop: '3px solid ' + result.color }">
      <div class="strategy-heading"><span class="strategy-icon" :style="{ color: result.color }"><Database v-if="result.mode === 'FULL_TOOLS_SCHEMA'" :size="20" /><Zap v-else :size="20" /></span><div><h2>{{ result.planName }}</h2><span>{{ result.rounds.length }} 轮 · {{ result.mode === 'FULL_TOOLS_SCHEMA' ? '全量加载' : '按需加载' }}</span></div><button class="icon-button" :aria-label="'编辑参数 ' + result.planName" @click="$emit('edit', result.planId)"><Pencil :size="14" /></button></div>
      <p class="result-model">{{ result.model.name }}</p>
      <div class="total-cost" :title="money(result.cost.total, currency, true)">{{ m(result.cost.total) }}<span>/ 会话</span></div>
      <p class="plan-difference" :class="{ saving: result.cost.total < baseline.cost.total }">{{ difference(result) }}</p>
      <div class="request-count">{{ result.requests.length - result.compressions.length }} 次普通请求<span>+</span>{{ result.compressions.length }} 次压缩请求</div>
      <div class="request-count" title="用户消息总轮数 ÷ 实际压缩次数；包含末次压缩后尚未再次触发压缩的用户轮次。">
        {{ result.averageUserTurnsPerCompression === null ? '未触发压缩' : `平均每 ${number(result.averageUserTurnsPerCompression)} 轮用户消息触发一次压缩` }}
      </div>
      <div class="token-metrics">
        <div><span><i class="dot cached"></i>命中输入</span><strong>{{ token(result.hit) }}</strong></div>
        <div><span><i class="dot fresh"></i>未命中输入</span><strong>{{ token(result.miss) }}</strong></div>
        <div><span><i class="dot generated"></i>模型输出</span><strong>{{ token(result.output) }}</strong></div>
      </div>
      <div class="cost-bar" :aria-label="'费用构成：命中输入 ' + m(result.cost.cached) + '，未命中输入 ' + m(result.cost.fresh) + '，输出 ' + m(result.cost.generated)">
        <span v-for="[key] in costParts" :key="key" :class="key" :style="{ width: (ratio(result.cost[key], result.cost.total) || 0) * 100 + '%' }"></span>
      </div>
      <div class="cost-labels"><div v-for="[key, label] in costParts" :key="key"><span>{{ label }}</span><b :title="money(result.cost[key], currency, true)">{{ m(result.cost[key]) }}</b><small>{{ percent(ratio(result.cost[key], result.cost.total)) }}</small></div></div>
      <dl class="context-metrics"><div><dt>初始上下文</dt><dd>{{ token(result.initialContext) }}</dd></div><div><dt>峰值请求输入</dt><dd>{{ token(result.peakInput) }}</dd></div><div><dt>最终有效上下文</dt><dd>{{ token(result.finalContext) }}</dd></div><div><dt>整体输入命中率</dt><dd>{{ percent(result.hitRate) }}</dd></div></dl>
      <div class="compression-cost"><Layers :size="14" />压缩请求费用 <b>{{ m(result.compressionCost) }}</b><span>已计入总费用</span></div>
    </article>
  </div>
  <div v-if="results.length > 1" class="savings-strip">
    <span class="saving-symbol"><ArrowDownRight :size="23" /></span>
    <div><strong>{{ allEqual ? '所有方案费用相同' : `最低总费用：${cheapest.planName}` }}</strong><span>以「{{ baseline.planName }}」为基准 · 包含上下文压缩费用</span></div>
    <b>{{ m(savings) }}</b><span class="saving-percent">{{ percent(ratio(savings, baseline.cost.total)) }}</span>
  </div>
  <p v-else class="single-plan-note">当前为单方案模拟，新增方案后即可比较费用差异。</p>
</template>
