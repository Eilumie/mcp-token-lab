<script setup>
import { computed } from 'vue';
import { FileText, Cpu, ArrowRight, ArrowDown, Layers, Repeat2, Workflow } from 'lucide-vue-next';
import { resolvePlan } from '../comparison.js';
import { previewStep, tokenFormula, triggerLabel } from '../session-flow.js';
import { sourceNames } from '../session-report.js';
const props = defineProps({ plan: Object, globalSimulation: Object });
defineEmits(['edit']);
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
    <div class="flow-preview-heading"><div><h3><Workflow :size="16"/>执行流程</h3></div><button class="flow-edit-link" @click="$emit('edit',plan.id)">编辑流程<ArrowRight :size="13"/></button></div>
    <div class="flow-preview-meta"><div class="flow-key"><span><FileText :size="12"/>追加上下文</span><span><Cpu :size="12"/>调用模型</span></div></div>
    <div class="flow-phase-grid">
      <ArrowRight class="phase-bridge" :size="17" aria-hidden="true"/>
      <section v-for="phase in phases" :key="phase.key" class="preview-phase" :class="phase.key">
        <div class="phase-header"><span class="phase-symbol"><Layers v-if="phase.key==='initial'" :size="16"/><Repeat2 v-else :size="16"/></span><div><h4>{{ phase.key==='initial'?'初始上下文':'每轮流程' }}</h4></div></div>
        <ol class="preview-flow-nodes" :aria-label="phase.key==='initial'?'初始上下文步骤':'每轮执行步骤'">
          <li v-for="(step,index) in phase.steps" :key="index" :class="{'model-node':step.type==='llm','node-disabled':step.enabled===false,'node-error':step.error,'node-skipped':step.enabled!==false && !step.runs && !step.error}">
            <div class="preview-node"><span class="node-order">{{ String(index+1).padStart(2,'0') }}</span><span class="node-kind"><Cpu v-if="step.type==='llm'" :size="14"/><FileText v-else :size="14"/></span><div class="node-text"><strong>{{ step.name }}</strong><small>{{ step.enabled===false?'已停用':step.type==='llm'?'模型输出':'追加内容' }}<span v-if="!step.error"> · {{ typeof step.token==='number'?'固定值':'公式' }}</span></small><small v-if="phase.key==='turn'" class="node-trigger">{{ triggerLabel(step) }}<span v-if="step.enabled!==false && !step.runs && !step.error"> · 本轮未触发</span></small></div><span class="node-value">{{ step.enabled===false?'—':format(step.value) }}<small v-if="step.enabled!==false">K</small></span></div>
            <details v-if="typeof step.token!=='number' || step.error" class="node-expression"><summary>{{ step.error?'查看错误':'查看公式' }}</summary><code>{{ step.formula }}</code><p v-if="step.error" role="alert">{{ step.error }}</p></details>
            <ArrowDown v-if="index<phase.steps.length-1" class="node-arrow" :size="12" aria-hidden="true"/>
          </li>
        </ol>
        <p v-if="!phase.steps.length" class="empty-flow">未配置步骤</p>
        <div class="phase-result"><span>{{ phase.key==='initial'?'初始上下文合计':'本轮新增内容与输出' }}</span><strong>{{ format(phase.total) }}<small>K</small></strong></div>
        <div v-if="phase.key==='turn'" class="turn-exit"><span><Layers :size="13"/>检查压缩条件</span><small>{{ simulation.compressionThresholdType==='TURN'?`活跃轮次 ≥ ${simulation.compressionThresholdTurnCount} 轮`:`上下文 ≥ ${format(simulation.compressionThresholdToken)} K` }}</small><div><Repeat2 :size="12"/>下一轮<span>{{ phase.calls }} 次模型调用 / 本轮</span></div></div>
      </section>
    </div>
    <p class="flow-preview-footnote">单位 K Token。每轮流程展示首轮的内容长度，未触发节点计为 0；模型输入包含此前累计上下文，压缩费用另计。</p>
  </section>
</template>
