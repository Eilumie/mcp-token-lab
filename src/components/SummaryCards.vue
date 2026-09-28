<script setup>
import { computed } from "vue";
import { ArrowDownRight, ArrowUpRight, Layers, Zap, Database } from "lucide-vue-next";
import { planNames, ratio } from "../session-report.js";
import { money, token, percent } from "../utils.js";
const props = defineProps({ results: Array, config: Object });
const delta = computed(() => props.results[1].cost.total - props.results[0].cost.total);
const savings = computed(() => ratio(Math.abs(delta.value), props.results[1].cost.total));
const m = value => money(value, props.config.model.currency);
const costParts = [["cached", "命中输入"], ["fresh", "未命中输入"], ["generated", "模型输出"]];
</script>

<template>
  <div class="comparison-cards">
    <article v-for="(result, index) in results" :key="result.mode" class="strategy-card" :class="index ? 'full' : 'lazy'">
      <div class="strategy-heading"><span class="strategy-icon"><Database v-if="index" :size="20" /><Zap v-else :size="20" /></span><div><h2>{{ planNames[index] }}</h2><span>{{ index ? '预先加载全部工具 Schema' : '每轮按需查询工具 Schema' }}</span></div><span class="strategy-tag">{{ index ? 'FULL' : 'ON DEMAND' }}</span></div>
      <div class="total-cost" :title="money(result.cost.total, config.model.currency, true)">{{ m(result.cost.total) }}<span>/ 会话</span></div>
      <div class="request-count">{{ result.requests.length - result.compressions.length }} 次普通请求<span>+</span>{{ result.compressions.length }} 次压缩请求</div>
      <div class="token-metrics">
        <div><span><i class="dot cached"></i>命中输入</span><strong>{{ token(result.hit) }}</strong></div>
        <div><span><i class="dot fresh"></i>未命中输入</span><strong>{{ token(result.miss) }}</strong></div>
        <div><span><i class="dot generated"></i>模型输出</span><strong>{{ token(result.output) }}</strong></div>
      </div>
      <div class="cost-bar" :aria-label="'费用构成：命中输入 ' + m(result.cost.cached) + '，未命中输入 ' + m(result.cost.fresh) + '，输出 ' + m(result.cost.generated)">
        <span v-for="[key] in costParts" :key="key" :class="key" :style="{ width: (ratio(result.cost[key], result.cost.total) || 0) * 100 + '%' }"></span>
      </div>
      <div class="cost-labels"><div v-for="[key, label] in costParts" :key="key"><span>{{ label }}</span><b :title="money(result.cost[key], config.model.currency, true)">{{ m(result.cost[key]) }}</b><small>{{ percent(ratio(result.cost[key], result.cost.total)) }}</small></div></div>
      <dl class="context-metrics"><div><dt>初始上下文</dt><dd>{{ token(result.initialContext) }}</dd></div><div><dt>峰值请求输入</dt><dd>{{ token(result.peakInput) }}</dd></div><div><dt>最终有效上下文</dt><dd>{{ token(result.finalContext) }}</dd></div><div><dt>整体输入命中率</dt><dd>{{ percent(result.hitRate) }}</dd></div></dl>
      <div class="compression-cost"><Layers :size="14" />压缩请求费用 <b>{{ m(result.compressionCost) }}</b><span>已计入总费用</span></div>
    </article>
  </div>
  <div class="savings-strip" :class="{ negative: delta < 0 }">
    <span class="saving-symbol"><ArrowUpRight v-if="delta < 0" :size="23" /><ArrowDownRight v-else :size="23" /></span>
    <div><strong>{{ delta === 0 ? '两种方案费用相同' : delta > 0 ? '按需加载节省' : '按需加载多花费' }}</strong><span>以全量方案为比较基准，包含历史压缩费用</span></div>
    <b :title="money(Math.abs(delta), config.model.currency, true)">{{ m(Math.abs(delta)) }}</b><span class="saving-percent">{{ percent(savings) }}</span>
  </div>
</template>
