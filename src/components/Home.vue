<script setup>
import { computed, nextTick, ref, watch } from 'vue';
import { Github, LayoutTemplate, Languages, Download, SlidersHorizontal, Plus, RotateCcw, Workflow, ArrowDown, ArrowUp, Star, Copy, Trash2, ChevronRight, ChevronDown } from 'lucide-vue-next';
import { globalFields, thresholdField, resolveBaselineId, maxPlans } from '../comparison.js';
import ParameterField from './ParameterField.vue';
import FieldHint from './FieldHint.vue';
import GlobalModelField from './GlobalModelField.vue';
import AnalysisPanel from './AnalysisPanel.vue';
import SummaryCards from './SummaryCards.vue';
import PlanFlowPreview from './PlanFlowPreview.vue';
import PlanSettingsDialog from './PlanSettingsDialog.vue';
import GlyphBackground from './GlyphBackground.vue';
import { locale, setLocale } from '../i18n.js';
import { displayPlanColor } from '../theme.js';
const brandIcon = `${import.meta.env.BASE_URL}icon/mcp-token-lab-logo.svg`;
const props = defineProps({ config: Object, results: Array, busy: Boolean, errors: Object, failure: String, canUndo: Boolean });
const emit = defineEmits(['templates','export','remember','reset','add','baseline','copy','remove','undo','variables']);
const settingsPlanId = ref(null);
const settingsPlan = computed(() => props.config.plans.find(plan => plan.id === settingsPlanId.value));
const showDuration = computed(() => props.config.globalSimulation?.estimateDuration !== false);
const expanded = ref(new Set());
const pendingAdd = ref(false);
const pendingScrollPlanId = ref(null);
let previousPlanIds = new Set(props.config.plans.map(plan => plan.id));
function togglePlan(id) { const next=new Set(expanded.value);next.has(id)?next.delete(id):next.add(id);expanded.value=next; }
watch(() => props.config.plans.map(p=>p.id), ids => {
  expanded.value=new Set([...expanded.value].filter(id=>ids.includes(id)));
  if (pendingAdd.value) {
    const addedId = ids.find(id => !previousPlanIds.has(id));
    pendingAdd.value = false;
    if (addedId) {
      expanded.value = new Set([...expanded.value, addedId]);
      pendingScrollPlanId.value = addedId;
    }
  }
  previousPlanIds = new Set(ids);
});
watch(() => props.results.find(result => result.planId === pendingScrollPlanId.value), async result => {
  if (!result) return;
  await nextTick();
  document.getElementById('plan-row-' + result.planId)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  pendingScrollPlanId.value = null;
}, { flush: 'post' });
function addPlan() { pendingAdd.value = true; emit('add'); }
const baselineId = computed(() => resolveBaselineId(props.config, props.results));
const baseline = computed(() => props.results.find(r => r.planId === baselineId.value));
const analysisConfig = computed(() => ({...props.config, baselineId:baselineId.value}));
const bestPlan = computed(() => props.results.reduce((best, result) => !best || result.cost.total < best.cost.total ? result : best, null));
const savings = computed(() => baseline.value?.cost.total > 0 && bestPlan.value ? Math.max(0, 1 - bestPlan.value.cost.total / baseline.value.cost.total) : null);
const insightPlans = computed(() => bestPlan.value ? [bestPlan.value, ...(baseline.value && baseline.value.planId !== bestPlan.value.planId ? [baseline.value] : [])] : []);
const insightMax = computed(() => Math.max(0, ...insightPlans.value.map(result => result.cost.total)));
const planColor = result => displayPlanColor(result.color || '#5869d9');
const shortName = name => name.replace('百炼 · ', '').replace(' · 固定价格', '');
const m = n => '$' + Number(n || 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const n = value => Number(value || 0).toLocaleString('en-US',{maximumFractionDigits:2});
const pct = value => value == null ? '—' : (value * 100).toFixed(1) + '%';
function savePlanSettings(plan, estimateDuration) {
  const index = props.config.plans.findIndex(item => item.id === plan.id);
  if (index < 0) return;
  emit('remember');
  props.config.plans.splice(index, 1, plan);
  props.config.globalSimulation.estimateDuration = estimateDuration;
  settingsPlanId.value = null;
}
function updateFlow(id, flow) {
  const plan = props.config.plans.find(p => p.id === id);
  if (!plan) return;
  emit('remember');
  plan.simulation.flow = flow;
}
</script>

<template>
  <div class="home-page">
    <GlyphBackground />
    <header class="app-header">
      <a class="brand" href="./"><span class="brand-mark header-floating"><img :src="brandIcon" width="36" height="36" alt="" /></span><strong><b class="brand-title header-floating">MCP Token Lab</b><span class="brand-tagline header-floating">A LITTLE CLARITY FOR EVERY TOKEN</span></strong></a>
      <nav class="header-actions" aria-label="配置操作"><button type="button" class="language-toggle header-floating" :aria-label="locale==='zh'?'Switch to English':'切换为中文'" @click="setLocale(locale==='zh'?'en':'zh')"><Languages :size="15"/><span>{{ locale==='zh'?'中文':'EN' }}</span></button><a class="header-github header-floating" href="https://github.com/zhangHongEn/token-lab" target="_blank" rel="noopener noreferrer" aria-label="在新标签页打开 GitHub 仓库"><Github :size="16" /><span>GitHub</span></a><button class="header-floating" @click="emit('templates')"><LayoutTemplate :size="15"/><span>模板</span></button><button class="header-floating" :disabled="!!Object.keys(errors).length" @click="emit('export')"><Download :size="15"/><span>导出配置</span></button></nav>
    </header>
    <div class="workspace comparison-workspace"><main>
      <section class="lab-intro" aria-labelledby="lab-title">
        <div class="lab-intro-copy">
          <p class="lab-kicker"><span class="lab-status-dot" aria-hidden="true"></span> SESSION COST LAB <span class="lab-edition">/ 01</span></p>
          <h1 id="lab-title"><span>{{ locale === 'zh' ? '每一枚 Token，' : 'Every token.' }}</span><span>{{ locale === 'zh' ? '都心中有数。' : 'In perspective.' }}</span></h1>
          <p class="lab-description">{{ locale === 'zh' ? '对比模型、缓存与上下文策略，让每一次调用都有据可依。' : 'Explore models, caching, and context. Find the cost of every decision.' }}</p>
        </div>
        <div class="lab-insight" :aria-busy="busy">
          <div class="lab-insight-heading"><span>{{ locale === 'zh' ? '当前最低预计费用' : 'LOWEST ESTIMATED COST' }}</span><span class="lab-live">{{ busy ? (locale === 'zh' ? '计算中' : 'COMPUTING') : (locale === 'zh' ? '实时估算' : 'LIVE ESTIMATE') }}</span></div>
          <div class="lab-insight-value"><strong>{{ bestPlan ? m(bestPlan.cost.total) : '—' }}</strong><span>USD <span>/ {{ locale === 'zh' ? '会话' : 'session' }}</span></span></div>
          <p class="lab-savings" v-if="savings !== null && results.length > 1"><ArrowDown :size="14"/><strong>{{ pct(savings) }}</strong><span>{{ locale === 'zh' ? '相对基准方案可节省' : 'less than the baseline' }}</span></p>
          <p class="lab-savings lab-savings-neutral" v-else>{{ locale === 'zh' ? '添加方案，探索更多成本可能。' : 'Add a plan to explore the possibilities.' }}</p>
          <div class="lab-mini-comparison" v-if="insightPlans.length">
            <div v-for="result in insightPlans" :key="result.planId" class="lab-mini-row">
              <span :title="result.planName">{{ result.planName }}</span><div class="lab-mini-track"><i :style="{ width: (insightMax ? result.cost.total / insightMax * 100 : 0) + '%', background: planColor(result) }"></i></div><span>{{ m(result.cost.total) }}</span>
            </div>
          </div>
        </div>
      </section>
      <section class="global-settings" aria-labelledby="global-settings-title">
        <div class="global-settings-heading"><div><h2 id="global-settings-title"><span class="section-index" aria-hidden="true">01</span>全局配置</h2><p>各方案默认使用以下数值，也可在方案内单独设置。</p></div><button @click="emit('variables')"><SlidersHorizontal :size="14"/>全部变量</button></div>
        <div class="global-settings-fields" @focusin="emit('remember')">
          <GlobalModelField :config="config" :error="errors.globalModelId" />
          <ParameterField v-for="field in globalFields.filter(([key]) => !key.startsWith('compression') && !(config.globalSimulation.removedFields || []).includes(key))" :key="field[0]" :object="config.globalSimulation" :field="field" :error="errors['globalSimulation.' + field[0]]"/>
          <label class="field"><span>压缩阈值类型</span><select v-model="config.globalSimulation.compressionThresholdType" aria-label="压缩阈值类型"><option value="TURN">用户轮次</option><option value="TOKEN">上下文</option></select></label>
          <ParameterField v-if="!(config.globalSimulation.removedFields || []).includes(thresholdField(config.globalSimulation)[0])" :key="thresholdField(config.globalSimulation)[0]" :object="config.globalSimulation" :field="thresholdField(config.globalSimulation)" :error="errors['globalSimulation.' + thresholdField(config.globalSimulation)[0]]"/>
        </div>
      </section>
      <div class="results-heading comparison-heading"><div><h2><span class="section-index" aria-hidden="true">02</span>对比方案 <span class="plan-count">{{ config.plans.length }}/8</span></h2></div><div class="plan-toolbar"><button @click="emit('reset')"><RotateCcw :size="14"/>恢复默认方案</button><button class="primary-button" :disabled="config.plans.length>=8" @click="addPlan"><Plus :size="15"/>新增方案</button></div></div>
      <div v-if="Object.keys(errors).length || failure" class="error-box" role="alert">{{ Object.values(errors)[0] || failure }}</div>
      <div class="comparison-table-wrap" :aria-busy="busy">
        <table class="comparison-table"><thead><tr><th>方案 / 模型</th><th>会话总费用</th><th>相对基准</th><th>初始上下文</th><th>峰值输入</th><th>LLM次数</th><th v-if="showDuration">每轮平均TTFT<FieldHint text="仅预计时间, 实际LLM可能受prompt或上下文大小影响响应速度" /></th><th title="用户消息总轮数 ÷ 实际压缩次数；包含末次压缩后尚未再次触发压缩的用户轮次。">上下文压缩</th></tr></thead><tbody>
          <template v-for="r in results" :key="r.planId">
          <tr :id="'plan-row-'+r.planId" class="plan-summary-row" :class="{'row-expanded':expanded.has(r.planId)}" @click="togglePlan(r.planId)">
            <td><div class="plan-identity"><button class="row-expand-button" :aria-label="(expanded.has(r.planId)?'收起':'展开')+'方案详情 '+r.planName" :aria-expanded="expanded.has(r.planId)" :aria-controls="'plan-detail-'+r.planId" @click.stop="togglePlan(r.planId)"><ChevronDown v-if="expanded.has(r.planId)" :size="15"/><ChevronRight v-else :size="15"/></button><span class="plan-icon" :style="{color:planColor(r)}"><Workflow :size="19"/></span><div><button class="plan-title" :aria-expanded="expanded.has(r.planId)" @click.stop="togglePlan(r.planId)">{{ r.planName }}</button><span v-if="r.planId===baselineId" class="badge">基准</span><small>{{ shortName(r.model.name) }}</small></div></div></td>
            <td class="price-cell">{{ m(r.cost.total) }}<span class="micro">USD</span></td>
            <td><span v-if="r.planId===baselineId" class="muted">—</span><span v-else class="delta" :class="{positive:r.cost.total>baseline.cost.total}"><ArrowDown v-if="r.cost.total<baseline.cost.total" :size="12"/><ArrowUp v-else :size="12"/>{{ baseline.cost.total ? pct(Math.abs(r.cost.total-baseline.cost.total)/baseline.cost.total) : '—' }}</span></td>
            <td>{{ n(r.initialContext) }}<span class="unit">K</span></td>
            <td>{{ n(r.peakInput) }}<span class="unit">K</span></td>
            <td>{{ r.requests.length }}<span class="unit">次</span></td>
            <td v-if="showDuration">{{ r.averageTurnDurationSeconds == null ? '—' : n(r.averageTurnDurationSeconds) + 's' }}</td>
            <td>{{ r.averageUserTurnsPerCompression === null ? '未触发压缩' : `平均 ${n(r.averageUserTurnsPerCompression)} 轮` }}</td>
          </tr>
          <tr v-if="expanded.has(r.planId)" class="plan-detail-row"><td :colspan="showDuration ? 8 : 7">
            <div :id="'plan-detail-'+r.planId" class="plan-expanded-content">
              <p v-if="config.plans.find(p=>p.id===r.planId)?.description" class="plan-description">{{ config.plans.find(p=>p.id===r.planId).description }}</p>
              <div class="expanded-cost-card"><SummaryCards :results="results" :config="analysisConfig" :visible-plan-id="r.planId" /></div>
              <PlanFlowPreview v-if="config.plans.some(p=>p.id===r.planId)" :plan="config.plans.find(p=>p.id===r.planId)" :global-simulation="config.globalSimulation" :global-model-id="config.globalModelId" :global-model="config.globalModel" @settings="settingsPlanId=$event" @update-flow="updateFlow">
                <template #actions>
                  <button class="flow-plan-action baseline-button" :style="{'--plan-color':planColor(r)}" :aria-label="'设为Base ' + r.planName" :aria-pressed="r.planId===baselineId" @click="emit('baseline',r.planId)"><Star :size="13"/>{{ r.planId===baselineId?'Base':'设为Base' }}</button>
                  <button class="flow-plan-action" :aria-label="'复制方案 ' + r.planName" :disabled="config.plans.length>=maxPlans" @click="emit('copy',r.planId)"><Copy :size="13"/>复制</button>
                  <button class="flow-plan-action" :aria-label="'删除方案 ' + r.planName" @click="emit('remove',r.planId)"><Trash2 :size="13"/>删除</button>
                </template>
              </PlanFlowPreview>
            </div>
          </td></tr>
          </template>
        </tbody></table>
        <div v-if="!results.length" class="empty-state">{{ busy?'正在计算会话成本…':'新增一个方案，开始探索成本。' }}</div>
      </div>
      <AnalysisPanel v-if="results.length" :results="results"/>
      <PlanSettingsDialog v-if="settingsPlan" :config="config" :plan="settingsPlan" @close="settingsPlanId=null" @save="savePlanSettings" />
      <footer><span class="footer-mark">T / L</span><p>初始前缀按期望命中率计费 · 每轮流程结束后检查压缩 · 最后一轮触发的压缩也计费<br/>所有长度以 K Token 计量。预计费用基于当前参数与费率快照，零分母显示「—」。</p><button v-if="canUndo" class="undo-button" @click="emit('undo')"><RotateCcw :size="13"/>撤销修改</button><span>LESS GUESSWORK. MORE CLARITY.</span></footer>
    </main></div>
  </div>
</template>
