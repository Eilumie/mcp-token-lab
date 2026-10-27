<script setup>
import { computed, ref } from 'vue';
import { FileText, Cpu, ArrowRight, ArrowDown, Layers, Repeat2, Workflow, Plus, X, GripVertical } from 'lucide-vue-next';
import { resolvePlan, validatePlan } from '../comparison.js';
import FlowNodeDialog from './FlowNodeDialog.vue';
import { previewStep, tokenFormula, triggerLabel } from '../session-flow.js';
import { sourceNames } from '../session-report.js';
const props = defineProps({ plan: Object, globalSimulation: Object, globalModelId: String, globalModel: Object });
const emit = defineEmits(['settings', 'update-flow']);
const dialog = ref(null), drag = ref(null), dragTarget = ref(null), message = ref('');
const clone = value => JSON.parse(JSON.stringify(value));
function commit(flow) {
  const candidate = clone(props.plan);
  candidate.simulation.flow = flow;
  const errors = validatePlan(candidate, props.globalSimulation, props.globalModelId, props.globalModel);
  if (Object.keys(errors).length) { message.value = Object.values(errors)[0]; return false; }
  message.value = '';
  emit('update-flow', props.plan.id, flow);
  return true;
}
function openNode(phase, index, inserting = false) { dialog.value = { phase, index, inserting }; }
function saveNode(flow) { if (commit(flow)) dialog.value = null; }
function removeNode(phase, index) {
  const flow = clone(props.plan.simulation.flow);
  flow[phase].splice(index, 1);
  commit(flow);
}
function moveNode(phase, from, to) {
  const flow = clone(props.plan.simulation.flow);
  if (from === to || to < 0 || to >= flow[phase].length) return;
  const [step] = flow[phase].splice(from, 1);
  flow[phase].splice(to, 0, step);
  commit(flow);
}
function startDrag(event, phase, index) {
  drag.value = { phase, index };
  event.dataTransfer.effectAllowed = 'move';
  event.dataTransfer.setData('text/plain', String(index));
}
function dragOver(event, phase, index) {
  if (drag.value?.phase !== phase) return;
  event.preventDefault();
  const rect = event.currentTarget.getBoundingClientRect();
  dragTarget.value = { phase, gap: index + (event.clientY > rect.top + rect.height / 2 ? 1 : 0) };
}
function drop(event, phase) {
  if (drag.value?.phase !== phase || dragTarget.value?.phase !== phase) return;
  event.preventDefault();
  const { index } = drag.value, gap = dragTarget.value.gap;
  moveNode(phase, index, gap > index ? gap - 1 : gap);
  endDrag();
}
function endDrag() { drag.value = null; dragTarget.value = null; }

const resolved = computed(() => resolvePlan(props.plan, props.globalSimulation));
const simulation = computed(() => resolved.value.simulation);
const format = value => value === null ? '—' : Number(value).toLocaleString('en-US',{maximumFractionDigits:3});
const phases = computed(() => ['initial','turn'].map(key => {
  const steps=simulation.value.flow[key].map((step,index)=>{
    return {...step,...previewStep(simulation.value.flow,key,index,simulation.value),name:sourceNames[step.text]||step.text,formula:tokenFormula(step.token)};
  });
  const active=steps.filter(s=>s.runs);
  return {key,steps,calls:active.filter(s=>s.type==='llm').length,total:steps.some(s=>s.error)?null:active.reduce((sum,s)=>sum+s.value,0)};
}));
</script>

<template>
  <section class="plan-flow-preview" :aria-label="plan.name+' 执行流程'">
    <div class="flow-preview-heading"><div><h3><Workflow :size="16"/>执行流程</h3></div><button class="flow-edit-link" @click="$emit('settings',plan.id)">方案配置<ArrowRight :size="13"/></button></div>
    <div class="flow-preview-meta"><div class="flow-key"><span><FileText :size="12"/>追加上下文</span><span><Cpu :size="12"/>调用模型</span></div></div>
    <div class="flow-phase-grid">
      <ArrowRight class="phase-bridge" :size="17" aria-hidden="true"/>
      <section v-for="phase in phases" :key="phase.key" class="preview-phase" :class="phase.key">
        <div class="phase-header"><span class="phase-symbol"><Layers v-if="phase.key==='initial'" :size="16"/><Repeat2 v-else :size="16"/></span><div><h4>{{ phase.key==='initial'?'初始上下文':'每轮流程' }}</h4></div></div>
        <ol class="preview-flow-nodes" :aria-label="phase.key==='initial'?'初始上下文步骤':'每轮执行步骤'">
          <li v-for="(step,index) in phase.steps" :key="index" :class="{'model-node':step.type==='llm','node-disabled':step.enabled===false,'node-error':step.error,'node-skipped':step.enabled!==false && !step.runs && !step.error,'drag-source':drag?.phase===phase.key && drag.index===index,'drop-before':dragTarget?.phase===phase.key && dragTarget.gap===index,'drop-after':dragTarget?.phase===phase.key && dragTarget.gap===index+1}" draggable="true" @dragstart="startDrag($event,phase.key,index)" @dragover="dragOver($event,phase.key,index)" @drop="drop($event,phase.key)" @dragend="endDrag">
            <button class="preview-insert preview-insert-before" :aria-label="`在第 ${index+1} 步之前新增节点`" @click.stop="openNode(phase.key,index,true)"><Plus :size="13"/></button>
            <button class="preview-insert preview-insert-after" :aria-label="`在第 ${index+1} 步之后新增节点`" @click.stop="openNode(phase.key,index+1,true)"><Plus :size="13"/></button>
            <button class="preview-remove" :aria-label="`删除第 ${index+1} 步 ${step.name}`" @click.stop="removeNode(phase.key,index)"><X :size="13"/></button>
            <div class="preview-node" role="button" tabindex="0" :aria-label="`编辑第 ${index+1} 步 ${step.name}，按 Alt 加上下方向键排序`" @click="openNode(phase.key,index)" @keydown.enter.prevent="openNode(phase.key,index)" @keydown.space.prevent="openNode(phase.key,index)" @keydown.alt.up.prevent="moveNode(phase.key,index,index-1)" @keydown.alt.down.prevent="moveNode(phase.key,index,index+1)"><GripVertical class="preview-grip" :size="13"/><span class="node-order">{{ String(index+1).padStart(2,'0') }}</span><span class="node-kind"><Cpu v-if="step.type==='llm'" :size="14"/><FileText v-else :size="14"/></span><div class="node-text"><strong>{{ step.name }}</strong><small>{{ step.enabled===false?'已停用':step.type==='llm'?'模型输出':'追加内容' }}<span v-if="!step.error"> · {{ typeof step.token==='number'?'固定值':'公式' }}</span></small><small v-if="phase.key==='turn'" class="node-trigger">{{ triggerLabel(step) }}<span v-if="step.enabled!==false && !step.runs && !step.error"> · 本轮未触发</span></small></div><span class="node-value">{{ step.enabled===false?'—':format(step.value) }}<small v-if="step.enabled!==false">K</small></span></div>
            <details v-if="typeof step.token!=='number' || step.error" class="node-expression"><summary>{{ step.error?'查看错误':'查看公式' }}</summary><code>{{ step.formula }}</code><p v-if="step.error" role="alert">{{ step.error }}</p></details>
            <ArrowDown v-if="index<phase.steps.length-1" class="node-arrow" :size="12" aria-hidden="true"/>
          </li>
        </ol>
        <p v-if="!phase.steps.length" class="empty-flow">未配置步骤 <button class="preview-add-empty" @click="openNode(phase.key,0,true)"><Plus :size="13"/>新增节点</button></p>
        <div class="phase-result"><span>{{ phase.key==='initial'?'初始上下文合计':'本轮新增内容与输出' }}</span><strong>{{ format(phase.total) }}<small>K</small></strong></div>
        <div v-if="phase.key==='turn'" class="turn-exit"><span><Layers :size="13"/>检查压缩条件</span><small>{{ simulation.compressionThresholdType==='TURN'?`活跃轮次 ≥ ${simulation.compressionThresholdTurnCount} 轮`:`上下文 ≥ ${format(simulation.compressionThresholdToken)} K` }}</small><div><Repeat2 :size="12"/>下一轮<span>{{ phase.calls }} 次模型调用 / 本轮</span></div></div>
      </section>
    </div>
    <p v-if="message" class="flow-preview-error" role="alert">{{ message }}</p>
    <FlowNodeDialog v-if="dialog" :plan="plan" :global-simulation="globalSimulation" :global-model-id="globalModelId" :global-model="globalModel" :phase="dialog.phase" :index="dialog.index" :inserting="dialog.inserting" @close="dialog=null" @save="saveNode" />
    <p class="flow-preview-footnote">单位 K Token。每轮流程展示首轮的内容长度，未触发节点计为 0；模型输入包含此前累计上下文，压缩费用另计。</p>
  </section>
</template>
