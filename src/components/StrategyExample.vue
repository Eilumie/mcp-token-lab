<script setup>
import { useId } from 'vue';
import { locale } from '../i18n.js';
import inputCsv from '../../docs/examples/input-trend.csv?raw';
import exampleUrl from '../../docs/examples/strategy-comparison.json?url';
import dataUrl from '../../docs/examples/input-trend.csv?url';
const chartId = useId();
const rows = inputCsv.trim().split('\n').slice(1).map(row => row.split(','));
const series = ['Progressive loading', 'Full schemas'].map((name,index) => ({
  name, color: index === 0 ? '#286e67' : '#a95536',
  points: rows.filter(row => row[0] === name).map(row => `${48 + Number(row[1]) / 100 * 532},${132 - Number(row[2]) / 30000 * 116}`).join(' '),
}));
</script>

<template>
  <figure class="strategy-example">
    <div class="example-heading"><strong>{{ locale === 'zh' ? '累计输入 Token（K）' : 'Cumulative input tokens (K)' }}</strong><span class="example-badge">{{ locale === 'zh' ? '示意模拟' : 'ILLUSTRATIVE SIMULATION' }}</span></div>
    <div class="example-legend"><span><i></i>{{ locale === 'zh' ? '渐进加载' : 'Progressive loading' }}</span><span><i></i>{{ locale === 'zh' ? '全量 Schema' : 'Full schemas' }}</span></div>
    <svg class="example-plot" viewBox="0 0 600 172" role="img" :aria-labelledby="chartId">
      <title :id="chartId">{{ locale === 'zh' ? '100 轮累计输入：渐进加载 26,497.64K，全量 Schema 29,339.50K。含缓存和压缩请求，不含输出。' : 'Input over 100 turns: progressive loading 26,497.64K; full schemas 29,339.50K. Includes cached input and compression requests; excludes output.' }}</title>
      <g v-for="tick in [0,10000,20000,30000]" :key="tick"><path :d="`M48 ${132-tick/30000*116}H580`" stroke="#dfe3da"/><text x="39" :y="136-tick/30000*116" text-anchor="end">{{ tick.toLocaleString('en-US') }}</text></g>
      <text v-for="turn in [0,25,50,75,100]" :key="turn" :x="48+turn/100*532" y="149" text-anchor="middle">{{ turn }}</text>
      <text x="580" y="169" text-anchor="end">{{ locale === 'zh' ? '模拟用户轮次' : 'Simulated user turn' }}</text>
      <polyline v-for="(line,index) in series" :key="line.name" :points="line.points" fill="none" :stroke="line.color" stroke-width="2.5" :stroke-dasharray="index === 1 ? '7 4' : undefined"/>
    </svg>
    <figcaption>
      <p>{{ locale === 'zh' ? '100 轮 · 100 工具 · 30 技能 · 90% 期望前缀命中' : '100 turns · 100 tools · 30 skills · 90% expected prefix hit' }}</p>
      <p>{{ locale === 'zh' ? '100K 压缩阈值 · 保留 2 轮 · 摘要 4K' : '100K compression threshold · keep 2 turns · 4K summary' }}</p>
      <div class="example-links"><span>{{ locale === 'zh' ? '固定示例，不随下方配置变化' : 'Fixed example, independent of settings below' }}</span><a :href="exampleUrl" download="strategy-comparison.json">{{ locale === 'zh' ? '示例配置 ↓' : 'Config ↓' }}</a><a :href="dataUrl" download="input-trend.csv">CSV ↓</a></div>
    </figcaption>
  </figure>
</template>

<style scoped>
.strategy-example{margin:0;min-width:0}
.example-heading{display:flex;align-items:center;justify-content:space-between;gap:12px;color:#525e51;font-size:12px}
.example-badge{white-space:nowrap;font:9px/1.6 var(--mono);letter-spacing:.6px;background:#e9eee3;padding:4px 8px;border-radius:3px}
.example-legend{display:flex;flex-wrap:wrap;gap:18px;margin-top:12px;font-size:10px;color:#62695e}
.example-legend span{display:flex;gap:7px;align-items:center}.example-legend i{width:18px;border-top:2px solid #286e67}.example-legend span+span i{border-top:2px dashed #a95536}
.example-plot{display:block;width:100%;margin:10px 0 8px;overflow:visible}.example-plot text{font:10px Arial,sans-serif;fill:#62695e}
.strategy-example figcaption{font-size:10px;line-height:1.7;color:#62695e}
.strategy-example figcaption p{margin:0}
.example-links{display:flex;flex-wrap:wrap;gap:6px 12px;margin-top:5px;font-size:10px}
.example-links span{margin-right:auto}
.example-links a{color:#286e67;text-decoration:underline;text-underline-offset:3px}
.example-links a:focus-visible{outline:2px solid #286e67;outline-offset:3px}
@media(max-width:760px){.example-heading{font-size:11px}.example-links a{padding:8px 0}.strategy-example figcaption{font-size:11px}}
</style>
