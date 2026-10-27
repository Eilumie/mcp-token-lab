<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { ArrowRight, ArrowLeft, RotateCcw, Plus, Check, ChevronRight, ChevronDown, SlidersHorizontal, Layers, Workflow, Cpu, X, CircleHelp, PanelRight, Code2, FileText, Braces, CheckCheck } from 'lucide-vue-next';
import { createComparisonConfig, createPlan, resolvePlan, validateComparison, validatePlan, readComparisonConfig, planColors } from './comparison.js';
import { sourceNames } from './session-report.js';
import { resolveStepToken, stepRuntime, runtimeParameters, formulaVariables, previewStep } from './session-flow.js';
import { groups, compressionFields, getValue, setValue } from './config.js';
import PlanModelSettings from './components/PlanModelSettings.vue';
import VariablesDialog from './components/VariablesDialog.vue';
import PlanVariableField from './components/PlanVariableField.vue';
import { parameterLabels } from './variables.js';
import { downloadFile } from './utils.js';
import Home from './components/Home.vue';
import FlowEditorList from './components/FlowEditorList.vue';
import { useFlowEditor } from './use-flow-editor.js';
import GlyphBackground from './components/GlyphBackground.vue';
import { useHeaderOpacity } from './use-header-opacity.js';
const headerSurfaceOpacity = useHeaderOpacity();
const clone = x => JSON.parse(JSON.stringify(x));
const config = ref(createComparisonConfig());
const results = ref([]), busy = ref(false), failure = ref(''), toast = ref('');
const draft = ref(null), draftReport = ref(null), draftBusy = ref(false), draftFailure = ref(''), section = ref('flow'), phase = ref('initial'), stepIndex = ref(0), showVars = ref(false), help = ref(false), fileInput = ref(null);
const previewRound = ref(1);
const variablesMode = ref(null);
const { steps: flowSteps, deletedStep, insertStep, reorderStep, duplicateStep, deleteStep, restoreStep } = useFlowEditor(draft, phase, stepIndex);
watch([phase, stepIndex], () => { showVars.value = false; });
const lastConfig = ref(null), isNew = ref(false), originalCost = ref(0);
const shortName = name => name.replace('百炼 · ', '').replace(' · 固定价格', '');
const m = n => '$' + Number(n || 0).toLocaleString('en-US',{minimumFractionDigits:2,maximumFractionDigits:2});
const n = value => Number(value || 0).toLocaleString('en-US',{maximumFractionDigits:2});
const label = step => sourceNames[step.text] || step.text;
const errors = computed(() => validateComparison(config.value));
const draftErrors = computed(() => {
  if (!draft.value) return {};
  const e = validatePlan(draft.value, config.value.globalSimulation, config.value.globalModelId);
  if(config.value.plans.some(p => p.id !== draft.value.id && p.name.trim() === draft.value.name.trim())) e.planName = '方案名称已存在';
  return e;
});
const currentStep = computed(() => draft.value?.simulation.flow[phase.value][stepIndex.value]);
const effectiveDraft = computed(() => draft.value ? resolvePlan(draft.value, config.value.globalSimulation, config.value.globalModelId) : null);
const availableParameters = computed(() => ({ ...parameterLabels(effectiveDraft.value?.simulation), ...runtimeParameters }));
function parameterValue(key) {
  try { return formulaVariables(effectiveDraft.value.simulation, stepRuntime(draft.value.simulation.flow, phase.value, stepIndex.value, previewTurnIndex.value))[key]; }
  catch { return '—'; }
}
function saveVariables(next) {
  if (variablesMode.value === 'global') { remember(); config.value = next; }
  else { draft.value.simulation = { ...next.simulation, flow: draft.value.simulation.flow }; draft.value.useGlobal = next.useGlobal; }
  variablesMode.value = null;
}
const previewTurnIndex = computed(() => Math.max(0, Math.min(Number(previewRound.value) || 1, effectiveDraft.value?.simulation.turnTotalCount || 1) - 1));
const stepPreview = (i, p = phase.value) => previewStep(draft.value.simulation.flow, p, i, effectiveDraft.value.simulation, previewTurnIndex.value);
const stepAmount = (s, i, p = phase.value) => { const result = stepPreview(i,p); return result.value === null ? '—' : n(result.value); };
const flowPreviews = computed(() => flowSteps.value.map((s,i) => stepPreview(i)));
const phaseTotal = p => {
  const steps = draft.value.simulation.flow[p].map((s,i) => stepPreview(i,p));
  return steps.some(s => s.error) ? '—' : n(steps.reduce((sum,s) => sum+s.value,0));
};
function setTrigger(type) {
  if (type === 'always') delete currentStep.value.trigger;
  else currentStep.value.trigger = { type, value: type === 'probability' ? 100 : 2 };
}
let reportWorker, draftWorker, reportTimer, draftTimer, toastTimer;
function notify(text) { toast.value=text; clearTimeout(toastTimer); toastTimer=setTimeout(()=>toast.value='',3500); }
function remember() { lastConfig.value=clone(config.value); }
function undo() { if(lastConfig.value) { config.value=lastConfig.value; lastConfig.value=null; notify('已撤销上一次修改'); } }
watch(config,()=>{
  clearTimeout(reportTimer); reportWorker?.terminate(); busy.value=false; failure.value='';
  if(Object.keys(errors.value).length){ results.value=[]; return; }
  busy.value=true;
  reportTimer=setTimeout(()=>{
    const w=new Worker(new URL('./session.worker.js',import.meta.url),{type:'module'}); reportWorker=w;
    w.onmessage=({data})=>{ if(reportWorker!==w)return; busy.value=false; failure.value=data.error||''; results.value=data.results||[]; w.terminate(); };
    w.onerror=()=>{busy.value=false;failure.value='模拟暂时失败，请调整参数重试';w.terminate();};
    w.postMessage(clone(config.value));
  },120);
},{deep:true,immediate:true});
watch(draft,()=>{
  clearTimeout(draftTimer); draftWorker?.terminate(); draftReport.value=null; draftBusy.value=false; draftFailure.value='';
  if(!draft.value || Object.keys(draftErrors.value).length)return;
  draftBusy.value=true;
  draftTimer=setTimeout(()=>{
    const w=new Worker(new URL('./session.worker.js',import.meta.url),{type:'module'}); draftWorker=w;
    w.onmessage=({data})=>{ if(draftWorker!==w)return; draftBusy.value=false; draftReport.value=data.results?.[0]; draftFailure.value=data.error||''; w.terminate(); };
    w.onerror=()=>{draftBusy.value=false;draftFailure.value='预览计算失败，请调整参数重试';w.terminate();};
    w.postMessage({...clone(config.value),plans:[clone(draft.value)],baselineId:draft.value.id});
  },240);
},{deep:true});
onBeforeUnmount(()=>{reportWorker?.terminate();draftWorker?.terminate();clearTimeout(reportTimer);clearTimeout(draftTimer);clearTimeout(toastTimer);});
function edit(plan, add=false) {
  isNew.value=add; originalCost.value=results.value.find(r=>r.planId===plan.id)?.cost.total||0;
  draft.value=clone(resolvePlan(plan,config.value.globalSimulation)); section.value='flow'; phase.value='initial'; stepIndex.value=0; previewRound.value=1; showVars.value=false; window.scrollTo(0,0);
}
function add(source) {
  if(config.value.plans.length>=8)return;
  const names=new Set(config.value.plans.map(p=>p.name)); let name=source ? source.name+' 副本' : '新方案'; let i=2; const base=name;
  while(names.has(name))name=base+' '+i++;
  edit(createPlan({source:source?clone(source):undefined,name,color:planColors[config.value.plans.length%8]}),true);
}
function save() {
  if(Object.keys(draftErrors.value).length)return;
  remember(); const p=clone(draft.value); p.name=p.name.trim(); const i=config.value.plans.findIndex(x=>x.id===p.id);
  if(i>=0)config.value.plans.splice(i,1,p); else config.value.plans.push(p);
  if(!config.value.baselineId)config.value.baselineId=p.id;
  draft.value=null; notify('方案已保存，对比已更新');
}
function setBase(id) { remember();config.value.baselineId=id;config.value.baselineMode='manual';notify('已更新对比基准'); }
function remove(id) {
  remember(); config.value.plans=config.value.plans.filter(p=>p.id!==id);
  if(config.value.baselineId===id)config.value.baselineId=config.value.plans[0]?.id||null;
  notify('已删除方案，可撤销');
}
function inherit(key) { if(draft.value.useGlobal[key]) setValue(draft.value.simulation,key,getValue(effectiveDraft.value.simulation,key)); draft.value.useGlobal[key]=!draft.value.useGlobal[key]; }
function fixedToken() { try { currentStep.value.token=resolveStepToken(currentStep.value.token,effectiveDraft.value.simulation,stepRuntime(draft.value.simulation.flow,phase.value,stepIndex.value,previewTurnIndex.value)); } catch { currentStep.value.token=0; } }
function exportConfig(){ downloadFile('token-lab.json',JSON.stringify(config.value,null,2),'application/json');notify('已导出实验配置'); }
async function importConfig(e){const f=e.target.files?.[0];if(!f)return;try{if(f.size>4000000)throw new Error('文件不能超过 4 MB');const c=readComparisonConfig(JSON.parse(await f.text()));remember();config.value=c;notify('配置已导入');}catch(e){notify('导入失败：'+e.message);}finally{e.target.value='';}}
const sections=[['flow','执行流程',Workflow],['params','基本参数',SlidersHorizontal],['cache','缓存与压缩',Layers],['model','模型与费率',Cpu]];
const paramFields=computed(()=>groups.filter(g=>!['缓存与权限'].includes(g.title)));
</script>

<template>
  <div class="app-shell" :class="{ 'editor-page': draft }">
    <GlyphBackground v-if="draft" />
    <header v-if="draft" class="app-header" :style="{ '--header-surface-opacity': headerSurfaceOpacity }">
      <a class="brand" href="./" @click.prevent="draft=null"><span class="brand-mark header-floating"><img src="/icon/mcp-token-lab-t.svg" width="36" height="36" alt="" /></span><strong><b class="brand-title header-floating">Token Lab</b><span class="brand-tagline header-floating">A LITTLE CLARITY FOR EVERY TOKEN</span></strong></a>
      <div class="header-actions"><span class="local-state header-floating"><i></i>本地模拟</span><button class="btn header-floating" aria-label="使用说明" @click="help=true"><CircleHelp :size="17" /><span>使用说明</span></button></div>
    </header>

    <Home v-if="!draft" :config="config" :results="results" :busy="busy" :errors="errors" :failure="failure" :can-undo="!!lastConfig"
      @variables="variablesMode='global'" @import="fileInput.click()" @export="exportConfig" @remember="remember" @undo="undo"
      @reset="remember();config=createComparisonConfig();notify('已恢复默认方案')"
      @add="add()" @edit="edit(config.plans.find(p=>p.id===$event))" @baseline="setBase"
      @copy="add(config.plans.find(p=>p.id===$event))" @remove="remove" />

    <main v-else class="editor-workspace">
      <div class="editor-top"><div class="editor-title"><button class="icon-btn back-btn" aria-label="取消编辑并返回" @click="draft=null"><ArrowLeft :size="18" /></button><div><div class="eyebrow">{{ isNew?'NEW SCENARIO':'EDIT SCENARIO' }}</div><h1>{{ draft.name }}</h1></div><span class="badge">独立草稿</span></div><div class="inline-actions"><button class="btn" @click="variablesMode='plan'"><SlidersHorizontal :size="15"/>全部变量</button><button class="btn" @click="draft=null">取消</button><button class="btn primary" :disabled="!!Object.keys(draftErrors).length" @click="save"><Check :size="15"/>保存并对比</button></div></div>
      <div class="editor-layout">
        <aside class="editor-nav"><span class="nav-caption">方案设置</span><button v-for="[key,text,icon] in sections" :class="{active:section===key}" @click="section=key"><component :is="icon" :size="16"/>{{ text }}<ChevronRight v-if="section===key" :size="13" /></button><div class="nav-context"><span class="nav-caption">当前实验条件</span><p><span>会话轮次</span><strong>{{ effectiveDraft.simulation.turnTotalCount }} 轮</strong></p><p><span>Tools / Skills</span><strong>{{ effectiveDraft.simulation.toolsTotalCount }} / {{ effectiveDraft.simulation.skillsTotalCount }}</strong></p><p><span>当前模型</span></p><strong class="model-caption">{{ shortName(effectiveDraft.model.name) }}</strong></div><div class="nav-note"><CheckCheck :size="15"/><span>修改先在草稿中预览<br/>保存后更新对比结果</span></div></aside>
        <div class="editor-main">
          <div v-if="section==='flow'" class="flow-layout">
            <section class="flow-canvas"><div class="editor-section-head"><h2>执行流程</h2><p>先建立上下文，再定义每一轮的执行路径。</p></div><div class="phase-switch"><button :class="{active:phase==='initial'}" @click="phase='initial';stepIndex=0"><span>初始上下文</span><small>{{ draft.simulation.flow.initial.length }} 步</small></button><button :class="{active:phase==='turn'}" @click="phase='turn';stepIndex=0"><span>每轮流程</span><small>{{ draft.simulation.flow.turn.length }} 步</small></button></div>
              <label v-if="phase==='turn'" class="flow-round-preview">预览第 <input type="number" min="1" :max="effectiveDraft.simulation.turnTotalCount" step="1" :value="previewTurnIndex+1" aria-label="编辑流程预览轮次" @input="previewRound=Math.max(1,Math.min(effectiveDraft.simulation.turnTotalCount,Math.trunc(Number($event.target.value))||1))" /> 轮消息</label>
              <div class="flow-section-label"><span>{{ phase==='initial'?'会话开始时执行一次':`第 ${previewTurnIndex+1} 轮实际触发` }}</span><span>{{ phaseTotal(phase) }} K 合计</span></div>
              <div v-if="deletedStep" class="flow-undo" role="status"><span>已删除「{{ label(deletedStep.step) }}」</span><button @click="restoreStep"><RotateCcw :size="13"/>撤销删除</button></div>
              <FlowEditorList :key="phase" :steps="flowSteps" :phase="phase" :selected="stepIndex" :previews="flowPreviews" @select="stepIndex=$event;showVars=false" @insert="insertStep" @reorder="reorderStep" @duplicate="duplicateStep" @remove="deleteStep" />
              <div class="flow-tip"><Layers :size="15"/><span>{{ phase==='initial'?'初始内容会被后续模型调用重复读取。':'调整顺序后，Token 公式和触发预览会同步更新。每轮结束时检查压缩条件。' }}</span></div>
            </section>
            <aside v-if="currentStep" class="inspector"><div class="inspector-top"><span><PanelRight :size="15"/>步骤属性</span><span class="micro">{{ String(stepIndex+1).padStart(2,'0') }}</span></div><div class="inspector-body"><div class="inspector-summary"><span class="large-step-icon"><Cpu v-if="currentStep.type==='llm'" :size="22"/><FileText v-else :size="22"/></span><div><h3>{{ label(currentStep) }}</h3><span class="micro">{{ phase==='initial'?'初始上下文':'每轮流程' }} / 步骤 {{ stepIndex+1 }}</span></div><label class="toggle"><input type="checkbox" aria-label="启用当前步骤" :checked="currentStep.enabled!==false" @change="currentStep.enabled=$event.target.checked"/><span></span></label></div>
              <label class="field">步骤名称<input :value="label(currentStep)" @input="currentStep.text=$event.target.value" aria-label="步骤名称" /></label>
              <label v-if="phase==='turn'" class="field">步骤类型<select v-model="currentStep.type"><option value="action">追加上下文</option><option value="llm">调用模型</option></select></label>
              <div v-if="phase==='turn'" class="trigger-settings">
                <label class="field">触发方式<select :value="currentStep.trigger?.type || 'always'" aria-label="触发方式" @change="setTrigger($event.target.value)"><option value="always">每轮触发</option><option value="probability">按百分比触发</option><option value="interval">每 N 轮消息触发</option></select></label>
                <label v-if="currentStep.trigger" class="field">{{ currentStep.trigger.type==='probability'?'触发概率':'消息轮次间隔' }}<span class="input-unit"><input v-model.number="currentStep.trigger.value" type="number" :min="currentStep.trigger.type==='probability'?0:1" :max="currentStep.trigger.type==='probability'?100:undefined" :step="currentStep.trigger.type==='probability'?'any':1" :aria-label="currentStep.trigger.type==='probability'?'触发概率':'消息轮次间隔'"/><span>{{ currentStep.trigger.type==='probability'?'%':'轮' }}</span></span></label>
                <p v-if="currentStep.trigger" class="field-help">{{ currentStep.trigger.type==='probability'?'每轮独立抽样，重复预览结果一致；实际触发比例可能有波动。':'从第 N 轮开始，在第 N、2N、3N…轮触发，压缩不重置计数。' }}仅控制当前节点，其他节点按各自设置执行。</p>
              </div>
              <div class="field"><span>Token 长度</span><div class="segmented token-mode"><button :class="{active:typeof currentStep.token!=='number'}" @click="currentStep.token=String(currentStep.token)"><Braces :size="13"/>公式</button><button :class="{active:typeof currentStep.token==='number'}" @click="fixedToken">固定数值</button></div></div>
              <div v-if="typeof currentStep.token!=='number'" class="formula-block"><div class="code-caption"><Code2 :size="12"/>EXPRESSION<span>K TOKEN</span></div><textarea v-model="currentStep.token" aria-label="Token 公式" spellcheck="false"></textarea><button class="text-btn" @click="showVars=!showVars"><Plus :size="12"/>插入变量<ChevronDown :size="12"/></button><div v-if="showVars" class="variable-list"><button v-for="(name,key) in availableParameters" @click="currentStep.token=String(currentStep.token).trim() ? String(currentStep.token)+' + '+key : key;showVars=false"><span>{{ name }}</span><code>{{ key }}</code></button></div></div>
              <label v-else class="field"><span class="input-unit"><input type="number" min="0" v-model.number="currentStep.token" aria-label="固定 Token 长度"/><span>K Token</span></span></label>
              <div class="preview-result"><span><Check :size="13"/>{{ currentStep.enabled===false?'已停用':phase==='turn' && !stepPreview(stepIndex).runs && !stepPreview(stepIndex).error?'本轮未触发':'当前预览' }}</span><strong>{{ stepAmount(currentStep,stepIndex) }}<small>K Token</small></strong></div><p class="field-help">1 K = 1,000 Token。公式会随实验参数自动更新。</p>
              <button class="text-btn manage-flow-variables" @click="variablesMode='plan'"><SlidersHorizontal :size="13"/>设置变量 · 自定义或继承</button><details class="context-vars"><summary>可用参数值<ChevronDown :size="12"/></summary><div v-for="(name,key) in availableParameters"><span>{{ name }}</span><code>{{ parameterValue(key) }}</code></div></details>

            </div></aside>
            <aside v-else class="inspector empty-state">添加一个步骤开始配置。</aside>
          </div>
          <section v-if="section==='params'" class="settings-page"><div class="editor-section-head"><h2>基本参数</h2><p>每项可继承全局或自定义，统一单位为 K Token。</p></div><label class="field name-field">方案名称<input v-model="draft.name" maxlength="60" aria-label="方案名称"/></label><div v-for="group in paramFields" :key="group.title" class="settings-group"><h3>{{ group.title }}</h3><div class="fields-grid"><PlanVariableField v-for="field in group.fields" :key="field[0]" :plan="draft" :globals="config.globalSimulation" :field="field"/></div></div><button class="btn" @click="variablesMode='plan'">管理全部变量与自定义变量</button></section>
          <section v-if="section==='cache'" class="settings-page"><div class="editor-section-head"><h2>缓存与压缩</h2><p>在缓存收益与上下文长度之间，找到合适的平衡。</p></div><div class="settings-group"><h3>前缀缓存</h3><div class="fields-grid"><PlanVariableField v-for="field in groups[1].fields" :key="field[0]" :plan="draft" :globals="config.globalSimulation" :field="field"/></div></div><div class="settings-group"><h3>上下文压缩</h3><label class="field"><span>压缩阈值类型<button class="inherit-btn" :aria-pressed="!!draft.useGlobal.compressionThresholdType" @click.prevent="inherit('compressionThresholdType')">{{ draft.useGlobal.compressionThresholdType?'继承全局':'自定义' }}</button></span><select :value="effectiveDraft.simulation.compressionThresholdType" @change="draft.simulation.compressionThresholdType=$event.target.value;draft.useGlobal.compressionThresholdType=false"><option value="TURN">用户轮次</option><option value="TOKEN">上下文</option></select></label><div class="fields-grid"><PlanVariableField v-for="field in compressionFields.filter(([key])=>!key.startsWith('compressionThreshold') || key===(effectiveDraft.simulation.compressionThresholdType==='TURN'?'compressionThresholdTurnCount':'compressionThresholdToken'))" :key="field[0]" :plan="draft" :globals="config.globalSimulation" :field="field"/></div><p class="field-help">每轮结束后检查压缩条件。压缩模型调用产生的费用会计入总成本。</p></div></section>
          <section v-if="section==='model'" class="settings-page"><div class="editor-section-head"><h2>模型与费率</h2><p>默认继承全局模型，也可为当前方案独立设置。</p></div><PlanModelSettings :plan="draft" :global-model-id="config.globalModelId" :errors="draftErrors" /></section>
        </div>
      </div>
      <div class="editor-result-bar" aria-live="polite"><div class="live-label"><span class="footer-dot"></span>实时成本预览</div><div v-if="Object.keys(draftErrors).length || draftFailure" class="error-text" role="alert">{{ Object.values(draftErrors)[0] || draftFailure }}</div><template v-else><div class="live-cost">{{ draftBusy?'计算中…':m(draftReport?.cost.total) }}<span>/ 会话</span></div><span v-if="draftReport && originalCost" class="live-delta">较编辑前 {{ draftReport.cost.total-originalCost>=0?'+':'−' }}{{ m(Math.abs(draftReport.cost.total-originalCost)) }}</span><div class="live-metrics"><span>初始上下文 <strong>{{ n(draftReport?.initialContext) }} K</strong></span><span>模型请求 <strong>{{ draftReport?.requests.length || '—' }} 次</strong></span></div></template><button class="text-btn" :disabled="!!Object.keys(draftErrors).length" @click="save">保存并返回对比<ArrowRight :size="14"/></button></div>
    </main>
    <VariablesDialog v-if="variablesMode" :config="config" :plan="variablesMode==='plan'?draft:undefined" @close="variablesMode=null" @save="saveVariables" />
    <input ref="fileInput" type="file" accept=".json" hidden @change="importConfig"/>
    <div v-if="toast" class="toast" role="status"><Check :size="15"/>{{ toast }}<button v-if="lastConfig" @click="undo">撤销</button><button class="icon-btn" aria-label="关闭提示" @click="toast=''"><X :size="13"/></button></div>
    <div v-if="help" class="help-overlay" @click.self="help=false"><section class="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="icon-btn help-close" aria-label="关闭说明" @click="help=false"><X :size="18"/></button><span class="eyebrow">TOKEN LAB / GUIDE</span><h2 id="help-title">从假设，到成本。</h2><p>1. 设置统一的会话轮次与工具规模。</p><p>2. 编辑方案，定义内容与模型调用流程。</p><p>3. 选择基准，比较成本和上下文变化。</p><p class="field-help">配置仅保存在本次页面会话，刷新前请导出。所有计算在浏览器内完成。</p><button class="btn primary" @click="help=false">开始探索<ArrowRight :size="14"/></button></section></div>
  </div>
</template>
