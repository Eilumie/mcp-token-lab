<script setup>
import { computed } from 'vue';
import { ArrowDown } from 'lucide-vue-next';
import { locale } from '../i18n.js';
import { basePath } from '../seo/site.js';
const steps = computed(() => locale.value === 'zh'
  ? [['选择模板', '或自定义配置'], ['配置规模', '会话与压缩策略'], ['查看费用趋势', 'Token 分布与缓存命中'], ['定制合适的上下文策略', '适配你的使用场景']]
  : [['Choose a template', 'or customize your own'], ['Configure scale', 'sessions and compression'], ['View cost trend', 'token breakdown and cache hits'], ['Customize the right context strategy', 'for your scenario']]);
function focusSettings(event) {
  event.preventDefault();
  document.getElementById('global-settings')?.scrollIntoView({ block: 'start' });
  document.getElementById('global-settings-title')?.focus({ preventScroll: true });
}
</script>

<template>
  <section class="strategy-intro" aria-labelledby="strategy-title">
    <div class="strategy-copy">
      <p class="strategy-kicker"><span aria-hidden="true"></span>MCP CONTEXT STRATEGY LAB</p>
      <h1 id="strategy-title">{{ locale === 'zh' ? 'MCP Token 计算器' : 'MCP Token Calculator' }}<br/><span>{{ locale === 'zh' ? '与 Agent 成本模拟。' : '& Agent Cost Simulator.' }}</span></h1>
      <p class="strategy-description">{{ locale === 'zh' ? '改变工具规模、加载与压缩策略，比较多轮上下文、缓存复用、Token 与预估费用。' : 'Vary tool count, loading and compression. Compare context growth, cache reuse, tokens and estimated costs across simulated turns.' }}</p>
      <a class="strategy-cta" href="#global-settings" @click="focusSettings">{{ locale === 'zh' ? '配置并比较' : 'Configure & compare' }}<ArrowDown :size="14"/></a>
      <p class="strategy-boundary">{{ locale === 'zh' ? '基于可配置假设的模拟，不执行 Agent 或调用模型 API。' : 'Simulated from your assumptions. No agents or model APIs run.' }}</p>
    </div>
    <div class="strategy-desktop-chart" :aria-label="locale === 'zh' ? '使用步骤' : 'How it works'">
      <img class="steps-art" :src="basePath + 'strategy-steps.png'" alt="" />
      <div class="steps-labels">
        <div v-for="(step, index) in steps" :key="index" class="step-label">
          <span>{{ String(index + 1).padStart(2, '0') }}</span><strong>{{ step[0] }}</strong><small>{{ step[1] }}</small>
        </div>
      </div>
    </div>
    <div class="strategy-mobile-chart" :aria-label="locale === 'zh' ? '使用步骤' : 'How it works'">
      <ol class="strategy-mobile-steps">
        <li v-for="(step, index) in steps" :key="index"><span>{{ String(index + 1).padStart(2, '0') }}</span><div><strong>{{ step[0] }}</strong><small>{{ step[1] }}</small></div></li>
      </ol>
    </div>
  </section>
</template>

<style scoped>
.strategy-intro{display:grid;grid-template-columns:minmax(0, 0.8fr) minmax(0, 1.2fr);gap:24px 40px;padding:22px 0 4px;color:#242622}
.strategy-kicker{display:flex;gap:8px;align-items:center;font:10px/1.5 var(--mono);letter-spacing:1.1px;color:#62695e;margin:0 0 17px}
.strategy-kicker>span{width:6px;height:6px;background:#a95536}
.strategy-copy h1{font-size:clamp(32px,3vw,44px);font-weight:550;line-height:1.08;letter-spacing:-1.7px;margin:0 0 16px}
.strategy-copy h1>span{color:#52674d}
.strategy-description{max-width:460px;font-size:13px;line-height:1.75;color:#62695e;margin:0 0 17px}
.strategy-cta{display:inline-flex;align-items:center;justify-content:center;gap:12px;min-height:40px;padding:8px 16px;border-radius:4px;background:#242622;color:white;text-decoration:none;font-size:12px;font-weight:550}
.strategy-cta:hover{background:#42483b}
.strategy-boundary{font-size:10px;line-height:1.6;color:#62695e;margin:10px 0 0}
.strategy-desktop-chart{align-self:center;min-width:0;position:relative;width:110%;margin-left:-3%;aspect-ratio:1.95;}
.steps-art{position:absolute;width:100%;height:auto;left:0;bottom:0}
.steps-labels{position:absolute;inset:0;}
.step-label{position:absolute;width:23%;top:0;left:8%}.step-label:nth-child(2){left:31%;top:9%}.step-label:nth-child(3){left:54%;top:18%}.step-label:nth-child(4){left:77%;top:27%}
.step-label span,.step-label strong,.step-label small{display:block}.step-label span{font-size:20px;color:#858c98;margin-bottom:5px}.step-label strong{font-size:14px;line-height:1.35;color:#242622}.step-label small{font-size:13px;line-height:1.4;color:#858c98;margin-top:2px;max-width:155px}
.strategy-mobile-chart{display:none}
.strategy-intro a:focus-visible{outline:2px solid #286e67;outline-offset:5px}
.strategy-mobile-steps{list-style:none;padding:0;margin:0;display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
.strategy-mobile-steps li{display:flex;gap:10px;padding:12px;border:1px solid #dddfd7;border-radius:4px}
.strategy-mobile-steps li>span{color:#858c98;font-size:15px}
.strategy-mobile-steps strong,.strategy-mobile-steps small{display:block;line-height:1.45}
.strategy-mobile-steps strong{font-size:12px;font-weight:550}
.strategy-mobile-steps small{margin-top:3px;font-size:11px;color:#858c98}
@media(max-width:1080px){.strategy-intro{gap:20px 28px}.strategy-copy h1{font-size:36px}}
@media(max-width:760px){.strategy-intro{grid-template-columns:1fr;gap:12px;padding:12px 0 4px}.strategy-copy h1{font-size:32px;letter-spacing:-1px;margin-bottom:12px}.strategy-kicker{font-size:9px;margin-bottom:13px}.strategy-description{font-size:12px;margin-bottom:12px;max-width:470px}.strategy-cta{min-height:44px}.strategy-boundary{font-size:10px}.strategy-desktop-chart{display:none}.strategy-mobile-chart{display:block;border-top:1px solid #dddfd7;padding-top:14px}}
</style>
