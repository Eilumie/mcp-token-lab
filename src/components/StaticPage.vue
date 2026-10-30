<script setup>
import { computed } from 'vue';
import SiteHeader from './SiteHeader.vue';
import StrategyIntro from './StrategyIntro.vue';
import SeoGuide from './SeoGuide.vue';
import { locale } from '../i18n.js';
import { guides, homeContent } from '../seo/content.js';
import { basePath, guidePath, homePath } from '../seo/site.js';
const props = defineProps({ guide: Object, template: Object, results: Array });
const copy = computed(() => props.guide?.[locale.value]);
const zh = computed(() => locale.value === 'zh');
const number = value => Number(value).toLocaleString('en-US', { maximumFractionDigits: 2 });
const money = value => '$' + Number(value).toFixed(4);
const model = computed(() => props.results?.[0]?.model);
const variables = computed(() => Object.entries(props.template?.config.globalSimulation.variables || {}));
</script>

<template>
  <div class="home-page static-page">
    <SiteHeader static-page :guide="guide?.slug" />
    <div class="workspace comparison-workspace"><main>
      <template v-if="!guide">
        <StrategyIntro />
        <div id="global-settings" class="seo-interactive-note"><p>{{ homeContent[locale].enable }}</p></div>
        <SeoGuide />
      </template>
      <article v-else class="strategy-article">
        <nav class="seo-breadcrumb" :aria-label="zh ? '当前位置' : 'Breadcrumb'"><a :href="homePath(locale)">{{ zh ? 'Token 计算器' : 'Token calculator' }}</a><span aria-hidden="true">/</span><span>{{ zh ? '策略说明' : 'Strategy guide' }}</span></nav>
        <p class="seo-kicker">MCP CONTEXT STRATEGIES</p>
        <h1>{{ copy.title }}</h1><p class="article-lead">{{ copy.summary }}</p>
        <div class="article-actions"><a class="seo-primary" :href="homePath(locale) + '?template=' + guide.slug + '#global-settings'">{{ zh ? '在计算器中使用此模板' : 'Use this template in the calculator' }} →</a><a :href="basePath + 'examples/' + guide.slug + '.json'" download>{{ zh ? '下载完整 JSON 模板' : 'Download the JSON template' }}</a></div>
        <section><h2>{{ zh ? '比较什么，如何解读' : 'What this experiment compares' }}</h2><p v-for="paragraph in copy.paragraphs" :key="paragraph">{{ paragraph }}</p></section>
        <section><h2>{{ zh ? '可复现的示例参数' : 'Reproducible example assumptions' }}</h2><dl class="article-assumptions">
          <div><dt>{{ zh ? '用户轮次' : 'User turns' }}</dt><dd>{{ template.config.globalSimulation.turnTotalCount }}</dd></div>
          <div><dt>{{ zh ? '工具总数' : 'Tools' }}</dt><dd>{{ template.config.globalSimulation.toolsTotalCount }}</dd></div>
          <div><dt>{{ zh ? '平均工具数 / 轮' : 'Average tools / turn' }}</dt><dd>{{ template.config.globalSimulation.turnAvgToolsCount }}</dd></div>
          <div><dt>{{ zh ? '压缩策略' : 'Compression policy' }}</dt><dd>{{ template.config.globalSimulation.compressionThresholdType === 'TOKEN' ? template.config.globalSimulation.compressionThresholdToken + 'K tokens' : (zh ? '每 ' + template.config.globalSimulation.compressionThresholdTurnCount + ' 轮' : 'Every ' + template.config.globalSimulation.compressionThresholdTurnCount + ' turns') }}</dd></div>
          <div><dt>{{ zh ? '预期前缀缓存命中率' : 'Expected prefix cache hit rate' }}</dt><dd>{{ number(template.config.globalSimulation.expectedPrefixCacheHitRate * 100) }}%</dd></div>
          <div v-for="[name, variable] in variables" :key="name"><dt>{{ name }}</dt><dd>{{ variable.value }}</dd></div>
        </dl><p>{{ model.name }} · {{ zh ? '本次配置费率，单位 USD / 百万 Token：缓存输入' : 'Configured USD rates per million tokens: cached input' }} {{ model.inputCachedPrice }} · {{ zh ? '未命中输入' : 'uncached input' }} {{ model.inputNotCachedPrice }} · {{ zh ? '输出' : 'output' }} {{ model.outputPrice }}.</p><p v-if="template.config.globalModel.pricing.source"><a :href="template.config.globalModel.pricing.source" rel="noopener noreferrer" target="_blank">{{ zh ? '配置中记录的价格来源' : 'Price source recorded in the configuration' }} ↗</a> · {{ template.config.globalModel.pricing.date }} · {{ zh ? '未在此页面实时核对。' : 'Not verified live on this page.' }}</p></section>
        <section><h2>{{ zh ? '按此模板计算的示例结果' : 'Simulation results for this template' }}</h2><p>{{ zh ? '下列结果在构建页面时由应用真实模拟引擎计算。费用只对应上述配置，不是实际报价或账单。' : 'These results are calculated by the application’s simulation engine when the page is built. Costs apply only to the configuration above; they are not provider quotes or invoices.' }}</p>
          <div class="article-table-wrap"><table class="article-table"><thead><tr><th>{{ zh ? '方案' : 'Plan' }}</th><th>{{ zh ? '会话费用 / USD' : 'Session cost / USD' }}</th><th>{{ zh ? '初始上下文 / K' : 'Initial context / K' }}</th><th>{{ zh ? '峰值输入 / K' : 'Peak input / K' }}</th><th>{{ zh ? 'LLM 调用' : 'LLM calls' }}</th></tr></thead><tbody><tr v-for="result in results" :key="result.planId"><th scope="row">{{ result.planName }}</th><td>{{ money(result.cost.total) }}</td><td>{{ number(result.initialContext) }}</td><td>{{ number(result.peakInput) }}</td><td>{{ result.requests.length }}</td></tr></tbody></table></div>
        </section>
        <section><h2>{{ copy.question }}</h2><p>{{ copy.answer }}</p><p>{{ zh ? '在计算器中改变参数后重新运行，并使用导出配置保存实验条件。模板会替换当前全局设置和方案；操作前可先导出已有实验。' : 'Change the parameters in the calculator and export the configuration to preserve your experiment. Applying a template replaces global settings and plans; export existing work before switching.' }}</p></section>
        <nav class="article-related" :aria-label="zh ? '相关策略' : 'Related strategies'"><h2>{{ zh ? '继续比较其他策略' : 'Explore related strategies' }}</h2><a v-for="related in guides.filter(item => item.slug !== guide.slug)" :key="related.slug" :href="guidePath(related.slug, locale)">{{ related[locale].title }} →</a></nav>
      </article>
      <footer class="seo-footer"><a :href="homePath(locale)">MCP Token Lab</a><span>{{ zh ? '本地模拟 · 无需 API Key · 开源工具' : 'Local simulation · No API key · Open source' }}</span><a href="https://github.com/Eilumie/mcp-token-lab">GitHub</a></footer>
    </main></div>
  </div>
</template>
