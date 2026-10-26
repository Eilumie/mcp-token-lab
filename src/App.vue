<script setup>
import { ref, computed, watch, onBeforeUnmount } from 'vue';
import { ArrowRight, ArrowLeft, ArrowDown, ArrowUp, Plus, Check, ChevronRight, ChevronDown, SlidersHorizontal, Layers, Workflow, Cpu, Copy, Trash2, X, CircleHelp, PanelRight, Code2, FileText, Braces, CheckCheck } from 'lucide-vue-next';
import { createComparisonConfig, createPlan, resolvePlan, validateComparison, validatePlan, readComparisonConfig, planColors, globalKeys } from './comparison.js';
import { sourceNames } from './session-report.js';
import { resolveStepToken, stepRuntime, tokenParameters } from './session-flow.js';
import { groups, getValue, setValue } from './config.js';
import PlanModelSettings from './components/PlanModelSettings.vue';
import FieldHint from './components/FieldHint.vue';
import { downloadFile } from './utils.js';
import Home from './components/Home.vue';
import GlyphBackground from './components/GlyphBackground.vue';
import { useHeaderOpacity } from './use-header-opacity.js';
const headerSurfaceOpacity = useHeaderOpacity();
const clone = x => JSON.parse(JSON.stringify(x));
const config = ref(createComparisonConfig());
const results = ref([]), busy = ref(false), failure = ref(''), toast = ref('');
const draft = ref(null), draftReport = ref(null), draftBusy = ref(false), draftFailure = ref(''), section = ref('flow'), phase = ref('initial'), stepIndex = ref(0), showVars = ref(false), help = ref(false), fileInput = ref(null);
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
const stepAmount = (s, i, p = phase.value) => { try { return n(resolveStepToken(s.token, effectiveDraft.value.simulation, stepRuntime(draft.value.simulation.flow,p,i))); } catch { return '—'; } };
const phaseTotal = p => draft.value?.simulation.flow[p].reduce((total,s,i) => {try{return total+(s.enabled === false ? 0 : resolveStepToken(s.token,effectiveDraft.value.simulation,stepRuntime(draft.value.simulation.flow,p,i)));}catch{return total;}},0);
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
  draft.value=clone(resolvePlan(plan,config.value.globalSimulation)); section.value='flow'; phase.value='initial'; stepIndex.value=0; showVars.value=false; window.scrollTo(0,0);
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
function addStep(type='action') { const steps=draft.value.simulation.flow[phase.value]; steps.push({type,text:type==='llm'?'新的模型调用':'新的上下文',token:1});stepIndex.value=steps.length-1; }
function moveStep(dir) {const steps=draft.value.simulation.flow[phase.value],i=stepIndex.value,j=i+dir;if(j<0||j>=steps.length)return;[steps[i],steps[j]]=[steps[j],steps[i]];stepIndex.value=j;}
function deleteStep() {draft.value.simulation.flow[phase.value].splice(stepIndex.value,1);stepIndex.value=Math.max(0,stepIndex.value-1);}
function setParam(key,event,unit) { const v=Number(event.target.value)/(unit==='%'?100:1);setValue(draft.value.simulation,key,v); if(globalKeys.includes(key))draft.value.useGlobal[key]=false; }
function inherit(key) {draft.value.useGlobal[key]=!draft.value.useGlobal[key];if(draft.value.useGlobal[key])draft.value.simulation[key]=config.value.globalSimulation[key];}
function fixedToken() { try { currentStep.value.token=resolveStepToken(currentStep.value.token,effectiveDraft.value.simulation,stepRuntime(draft.value.simulation.flow,phase.value,stepIndex.value)); } catch { currentStep.value.token=0; } }
function exportConfig(){ downloadFile('token-lab.json',JSON.stringify(config.value,null,2),'application/json');notify('已导出实验配置'); }
async function importConfig(e){const f=e.target.files?.[0];if(!f)return;try{if(f.size>4000000)throw new Error('文件不能超过 4 MB');const c=readComparisonConfig(JSON.parse(await f.text()));remember();config.value=c;notify('配置已导入');}catch(e){notify('导入失败：'+e.message);}finally{e.target.value='';}}
const sections=[['flow','执行流程',Workflow],['params','基本参数',SlidersHorizontal],['cache','缓存与压缩',Layers],['model','模型与费率',Cpu]];
const paramFields=computed(()=>groups.filter(g=>!['缓存与权限'].includes(g.title)));
</script>

<template>
  <div class="app-shell" :class="{ 'editor-page': draft }">
    <GlyphBackground v-if="draft" />
    <header v-if="draft" class="app-header" :style="{ '--header-surface-opacity': headerSurfaceOpacity }">
      <a class="brand" href="./" @click.prevent="draft=null"><span class="brand-mark header-floating"><img src="/token-lab.svg" width="36" height="36" alt="" /></span><strong><b class="brand-title header-floating">Token Lab</b><span class="brand-tagline header-floating">A LITTLE CLARITY FOR EVERY TOKEN</span></strong></a>
      <div class="header-actions"><span class="local-state header-floating"><i></i>本地模拟</span><button class="btn header-floating" aria-label="使用说明" @click="help=true"><CircleHelp :size="17" /><span>使用说明</span></button></div>
    </header>

    <Home v-if="!draft" :config="config" :results="results" :busy="busy" :errors="errors" :failure="failure" :can-undo="!!lastConfig"
      @import="fileInput.click()" @export="exportConfig" @remember="remember" @undo="undo"
      @reset="remember();config=createComparisonConfig();notify('已恢复默认方案')"
      @add="add()" @edit="edit(config.plans.find(p=>p.id===$event))" @baseline="setBase"
      @copy="add(config.plans.find(p=>p.id===$event))" @remove="remove" />

    <main v-else class="editor-workspace">
      <div class="editor-top"><div class="editor-title"><button class="icon-btn back-btn" aria-label="取消编辑并返回" @click="draft=null"><ArrowLeft :size="18" /></button><div><div class="eyebrow">{{ isNew?'NEW SCENARIO':'EDIT SCENARIO' }}</div><h1>{{ draft.name }}</h1></div><span class="badge">独立草稿</span></div><div class="inline-actions"><button class="btn" @click="draft=null">取消</button><button class="btn primary" :disabled="!!Object.keys(draftErrors).length" @click="save"><Check :size="15"/>保存并对比</button></div></div>
      <div class="editor-layout">
        <aside class="editor-nav"><span class="nav-caption">方案设置</span><button v-for="[key,text,icon] in sections" :class="{active:section===key}" @click="section=key"><component :is="icon" :size="16"/>{{ text }}<ChevronRight v-if="section===key" :size="13" /></button><div class="nav-context"><span class="nav-caption">当前实验条件</span><p><span>会话轮次</span><strong>{{ effectiveDraft.simulation.turnTotalCount }} 轮</strong></p><p><span>Tools / Skills</span><strong>{{ effectiveDraft.simulation.toolsTotalCount }} / {{ effectiveDraft.simulation.skillsTotalCount }}</strong></p><p><span>当前模型</span></p><strong class="model-caption">{{ shortName(effectiveDraft.model.name) }}</strong></div><div class="nav-note"><CheckCheck :size="15"/><span>修改先在草稿中预览<br/>保存后更新对比结果</span></div></aside>
        <div class="editor-main">
          <div v-if="section==='flow'" class="flow-layout">
            <section class="flow-canvas"><div class="editor-section-head"><h2>执行流程</h2><p>先建立上下文，再定义每一轮的执行路径。</p></div><div class="phase-switch"><button :class="{active:phase==='initial'}" @click="phase='initial';stepIndex=0"><span>初始上下文</span><small>{{ draft.simulation.flow.initial.length }} 步</small></button><button :class="{active:phase==='turn'}" @click="phase='turn';stepIndex=0"><span>每轮流程</span><small>{{ draft.simulation.flow.turn.length }} 步</small></button></div>
              <div class="flow-section-label"><span>{{ phase==='initial'?'会话开始时执行一次':'每个用户轮次重复执行' }}</span><span>{{ n(phaseTotal(phase)) }} K 合计</span></div>
              <div class="flow-list"><button v-for="(s,i) in draft.simulation.flow[phase]" class="flow-step" :class="{selected:i===stepIndex,disabled:s.enabled===false}" @click="stepIndex=i;showVars=false"><span class="step-number">{{ String(i+1).padStart(2,'0') }}</span><span class="step-icon" :class="{llm:s.type==='llm'}"><Cpu v-if="s.type==='llm'" :size="16"/><FileText v-else :size="16"/></span><span class="step-text"><strong>{{ label(s) }}</strong><small>{{ s.enabled===false?'已停用':s.type==='llm'?'调用模型':'追加上下文' }}<span>·</span>{{ typeof s.token==='number'?'固定长度':'公式' }}</small></span><span class="step-token">{{ stepAmount(s,i) }}<small>K</small></span><ChevronRight :size="13"/></button></div>
              <div class="add-steps"><button class="btn" @click="addStep()"><Plus :size="14"/>追加上下文</button><button v-if="phase==='turn'" class="btn" @click="addStep('llm')"><Cpu :size="14"/>调用模型</button></div><div class="flow-tip"><Layers :size="15"/><span>{{ phase==='initial'?'初始内容会被后续模型调用重复读取。':'每轮流程结束后，系统按配置检查并压缩上下文。' }}</span></div>
            </section>
            <aside v-if="currentStep" class="inspector"><div class="inspector-top"><span><PanelRight :size="15"/>步骤属性</span><span class="micro">{{ String(stepIndex+1).padStart(2,'0') }}</span></div><div class="inspector-body"><div class="inspector-summary"><span class="large-step-icon"><Cpu v-if="currentStep.type==='llm'" :size="22"/><FileText v-else :size="22"/></span><div><h3>{{ label(currentStep) }}</h3><span class="micro">{{ phase==='initial'?'初始上下文':'每轮流程' }} / 步骤 {{ stepIndex+1 }}</span></div><label class="toggle"><input type="checkbox" aria-label="启用当前步骤" :checked="currentStep.enabled!==false" @change="currentStep.enabled=$event.target.checked"/><span></span></label></div>
              <label class="field">步骤名称<input :value="label(currentStep)" @input="currentStep.text=$event.target.value" aria-label="步骤名称" /></label>
              <label v-if="phase==='turn'" class="field">步骤类型<select v-model="currentStep.type"><option value="action">追加上下文</option><option value="llm">调用模型</option></select></label>
              <div class="field"><span>Token 长度</span><div class="segmented token-mode"><button :class="{active:typeof currentStep.token!=='number'}" @click="currentStep.token=String(currentStep.token)"><Braces :size="13"/>公式</button><button :class="{active:typeof currentStep.token==='number'}" @click="fixedToken">固定数值</button></div></div>
              <div v-if="typeof currentStep.token!=='number'" class="formula-block"><div class="code-caption"><Code2 :size="12"/>EXPRESSION<span>K TOKEN</span></div><textarea v-model="currentStep.token" aria-label="Token 公式" spellcheck="false"></textarea><button class="text-btn" @click="showVars=!showVars"><Plus :size="12"/>插入变量<ChevronDown :size="12"/></button><div v-if="showVars" class="variable-list"><button v-for="(name,key) in tokenParameters" @click="currentStep.token=String(currentStep.token).trim() ? String(currentStep.token)+' + '+key : key;showVars=false"><span>{{ name }}</span><code>{{ key }}</code></button></div></div>
              <label v-else class="field"><span class="input-unit"><input type="number" min="0" v-model.number="currentStep.token" aria-label="固定 Token 长度"/><span>K Token</span></span></label>
              <div class="preview-result"><span><Check :size="13"/>当前预览</span><strong>{{ stepAmount(currentStep,stepIndex) }}<small>K Token</small></strong></div><p class="field-help">1 K = 1,000 Token。公式会随实验参数自动更新。</p>
              <details class="context-vars"><summary>可用参数值<ChevronDown :size="12"/></summary><div v-for="(name,key) in tokenParameters"><span>{{ name }}</span><code>{{ getValue(effectiveDraft.simulation,key) }}</code></div></details>
              <div class="step-tools"><button class="icon-btn" aria-label="上移步骤" :disabled="stepIndex===0" @click="moveStep(-1)"><ArrowUp :size="15"/></button><button class="icon-btn" aria-label="下移步骤" :disabled="stepIndex===draft.simulation.flow[phase].length-1" @click="moveStep(1)"><ArrowDown :size="15"/></button><button class="icon-btn" aria-label="复制步骤" @click="draft.simulation.flow[phase].splice(stepIndex+1,0,clone(currentStep));stepIndex++"><Copy :size="15"/></button><button class="text-btn delete-step" @click="deleteStep"><Trash2 :size="14"/>删除步骤</button></div>
            </div></aside>
            <aside v-else class="inspector empty-state">添加一个步骤开始配置。</aside>
          </div>
          <section v-if="section==='params'" class="settings-page"><div class="editor-section-head"><h2>基本参数</h2><p>统一单位为 K Token，1 K = 1,000 Token。</p></div><label class="field name-field">方案名称<input v-model="draft.name" maxlength="60" aria-label="方案名称"/></label><div v-for="group in paramFields" class="settings-group"><h3>{{ group.title }}</h3><div class="fields-grid"><label v-for="[key,text,unit,min,max,help] in group.fields" class="field"><span>{{ text }}<FieldHint v-if="help" :text="help"/><button v-if="globalKeys.includes(key)" class="inherit-btn" :class="{inherited:draft.useGlobal[key]}" @click.prevent="inherit(key)">{{ draft.useGlobal[key]?'继承全局':'独立设置' }}</button></span><span class="input-unit"><input type="number" :aria-label="text" :min="min" :max="max" :value="getValue(effectiveDraft.simulation,key)" @input="setParam(key,$event,unit)"/><span>{{ unit }}</span></span></label></div></div></section>
          <section v-if="section==='cache'" class="settings-page"><div class="editor-section-head"><h2>缓存与压缩</h2><p>在缓存收益与上下文长度之间，找到合适的平衡。</p></div><div class="settings-group"><h3>前缀缓存</h3><div class="fields-grid"><label v-for="[key,text,unit,min,max,help] in groups[1].fields" class="field"><span>{{ text }}<FieldHint v-if="help" :text="help"/><button v-if="globalKeys.includes(key)" class="inherit-btn" :class="{inherited:draft.useGlobal[key]}" @click.prevent="inherit(key)">{{ draft.useGlobal[key]?'继承全局':'独立设置' }}</button></span><span class="input-unit"><input type="number" min="0" max="100" :value="getValue(effectiveDraft.simulation,key)*100" @input="setParam(key,$event,'%')"/><span>%</span></span></label></div></div><div class="settings-group"><h3>上下文压缩</h3><div class="fields-grid"><label class="field">压缩阈值类型<select v-model="draft.simulation.compressionThresholdType" @change="draft.useGlobal.compressionThresholdType=false"><option value="TURN">用户轮次</option><option value="TOKEN">上下文</option></select></label><label class="field">压缩阈值<input v-if="draft.simulation.compressionThresholdType==='TURN'" type="number" :value="effectiveDraft.simulation.compressionThresholdTurnCount" @input="setParam('compressionThresholdTurnCount',$event)"/><input v-else type="number" :value="effectiveDraft.simulation.compressionThresholdToken" @input="setParam('compressionThresholdToken',$event)"/></label><label class="field">保留最近轮次<span class="input-unit"><input type="number" min="0" v-model.number="draft.simulation.compressionKeepTurns"/><span>轮</span></span></label><label class="field">摘要长度<span class="input-unit"><input type="number" min="0" v-model.number="draft.simulation.compressionTargetToken"/><span>K</span></span></label></div><p class="field-help">每轮结束后检查压缩条件。压缩模型调用产生的费用会计入总成本。</p></div></section>
          <section v-if="section==='model'" class="settings-page"><div class="editor-section-head"><h2>模型与费率</h2><p>默认继承全局模型，也可为当前方案独立设置。</p></div><PlanModelSettings :plan="draft" :global-model-id="config.globalModelId" :errors="draftErrors" /></section>
        </div>
      </div>
      <div class="editor-result-bar" aria-live="polite"><div class="live-label"><span class="footer-dot"></span>实时成本预览</div><div v-if="Object.keys(draftErrors).length || draftFailure" class="error-text" role="alert">{{ Object.values(draftErrors)[0] || draftFailure }}</div><template v-else><div class="live-cost">{{ draftBusy?'计算中…':m(draftReport?.cost.total) }}<span>/ 会话</span></div><span v-if="draftReport && originalCost" class="live-delta">较编辑前 {{ draftReport.cost.total-originalCost>=0?'+':'−' }}{{ m(Math.abs(draftReport.cost.total-originalCost)) }}</span><div class="live-metrics"><span>初始上下文 <strong>{{ n(draftReport?.initialContext) }} K</strong></span><span>模型请求 <strong>{{ draftReport?.requests.length || '—' }} 次</strong></span></div></template><button class="text-btn" :disabled="!!Object.keys(draftErrors).length" @click="save">保存并返回对比<ArrowRight :size="14"/></button></div>
    </main>
    <input ref="fileInput" type="file" accept=".json" hidden @change="importConfig"/>
    <div v-if="toast" class="toast" role="status"><Check :size="15"/>{{ toast }}<button v-if="lastConfig" @click="undo">撤销</button><button class="icon-btn" aria-label="关闭提示" @click="toast=''"><X :size="13"/></button></div>
    <div v-if="help" class="help-overlay" @click.self="help=false"><section class="help-panel" role="dialog" aria-modal="true" aria-labelledby="help-title"><button class="icon-btn help-close" aria-label="关闭说明" @click="help=false"><X :size="18"/></button><span class="eyebrow">TOKEN LAB / GUIDE</span><h2 id="help-title">从假设，到成本。</h2><p>1. 设置统一的会话轮次与工具规模。</p><p>2. 编辑方案，定义内容与模型调用流程。</p><p>3. 选择基准，比较成本和上下文变化。</p><p class="field-help">配置仅保存在本次页面会话，刷新前请导出。所有计算在浏览器内完成。</p><button class="btn primary" @click="help=false">开始探索<ArrowRight :size="14"/></button></section></div>
  </div>
</template>
