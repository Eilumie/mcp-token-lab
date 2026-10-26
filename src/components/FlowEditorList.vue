<script setup>
import { ref, nextTick, onBeforeUnmount } from 'vue';
import { Plus, X, GripVertical, ArrowUp, ArrowDown, Copy, Trash2, Cpu, FileText, ChevronRight, Workflow } from 'lucide-vue-next';
import { sourceNames } from '../session-report.js';
import { triggerLabel } from '../session-flow.js';

const props = defineProps({ steps: Array, phase: String, selected: Number, previews: Array });
const emit = defineEmits(['select', 'insert', 'reorder', 'duplicate', 'remove']);
const board = ref(null), insertAt = ref(null), dragged = ref(null), targetGap = ref(null), announcement = ref('');
const keys = new WeakMap();
let nextKey = 0;
const keyOf = step => { if (!keys.has(step)) keys.set(step, ++nextKey); return keys.get(step); };
const nameOf = step => sourceNames[step.text] || step.text;
const amount = index => props.previews[index]?.value === null ? '—' : Number(props.previews[index]?.value || 0).toLocaleString('en-US', { maximumFractionDigits: 2 });
async function focusSelected() {
  await nextTick();
  const step = props.steps[props.selected];
  const target = step ? board.value?.querySelector(`[data-node-key="${keyOf(step)}"] .node-select`) : board.value?.querySelector('.insert-node');
  target?.focus({ preventScroll: true });
}
async function openInsert(index) {
  insertAt.value = insertAt.value === index ? null : index;
  if (insertAt.value !== null) { await nextTick(); board.value?.querySelector('.node-insert-options button')?.focus(); }
}
function insert(type) {
  emit('insert', insertAt.value, type);
  insertAt.value = null;
  announcement.value = '已插入新节点，可以在右侧编辑属性。';
  focusSelected();
}
function move(from, to) {
  if (to < 0 || to >= props.steps.length || from === to) return;
  insertAt.value = null;
  const name = nameOf(props.steps[from]);
  emit('reorder', from, to);
  announcement.value = `已将${name}移到第 ${to + 1} 步。`;
  focusSelected();
}
function remove(index) {
  insertAt.value = null;
  announcement.value = `已删除${nameOf(props.steps[index])}，可在画布上方撤销。`;
  emit('remove', index); focusSelected();
}
function duplicate(index) { insertAt.value = null; emit('duplicate', index); announcement.value = '已复制节点。'; focusSelected(); }
let pointer = null, scrollFrame = 0, suppressClick = false;
function updateTarget() {
  if (!pointer || dragged.value === null) return;
  const bounds = board.value.getBoundingClientRect();
  if (pointer.x < bounds.left - 30 || pointer.x > bounds.right + 30 || pointer.y < bounds.top || pointer.y > bounds.bottom) {
    targetGap.value = null; return;
  }
  const cards = [...board.value.querySelectorAll('.flow-node')];
  const index = cards.findIndex(card => { const r = card.getBoundingClientRect(); return pointer.y < r.top + r.height / 2; });
  targetGap.value = index < 0 ? props.steps.length : index;
}
function scrollWhileDragging() {
  if (!pointer || dragged.value === null) return;
  const direction = pointer.y < 110 ? -1 : pointer.y > window.innerHeight - 60 ? 1 : 0;
  if (direction) { window.scrollBy(0, direction * 10); updateTarget(); }
  scrollFrame = requestAnimationFrame(scrollWhileDragging);
}
function startPointer(event, index) {
  if (!event.isPrimary || event.button !== 0) return;
  suppressClick = false;
  pointer = { index, id: event.pointerId, element: event.currentTarget, startX: event.clientX, startY: event.clientY, x: event.clientX, y: event.clientY };
  event.currentTarget.setPointerCapture(event.pointerId);
}
function movePointer(event) {
  if (!pointer || event.pointerId !== pointer.id) return;
  pointer.x = event.clientX; pointer.y = event.clientY;
  if (dragged.value === null) {
    if (Math.hypot(pointer.x - pointer.startX, pointer.y - pointer.startY) < 5) return;
    dragged.value = pointer.index; insertAt.value = null;
    scrollFrame = requestAnimationFrame(scrollWhileDragging);
  }
  updateTarget();
}
function endDrag() {
  cancelAnimationFrame(scrollFrame);
  const current = pointer; pointer = null;
  if (current?.element.hasPointerCapture(current.id)) current.element.releasePointerCapture(current.id);
  dragged.value = null; targetGap.value = null;
}
function dropPointer(event) {
  if (!pointer || pointer.id !== event.pointerId) return;
  const from = dragged.value, gap = targetGap.value;
  suppressClick = from !== null;
  endDrag();
  if (from !== null && gap !== null) move(from, gap > from ? gap - 1 : gap);
}
function clickGrip(index) {
  if (!suppressClick) emit('select', index);
  suppressClick = false;
}
onBeforeUnmount(endDrag);
async function cancel() {
  const gap = insertAt.value;
  suppressClick = dragged.value !== null;
  insertAt.value = null; endDrag();
  if (gap !== null) { await nextTick(); board.value?.querySelector(`[data-gap="${gap}"] .insert-node`)?.focus(); }
}
</script>

<template>
  <div ref="board" class="flow-node-board" :class="{ 'is-dragging': dragged !== null }" @keydown.esc.stop.prevent="cancel">
    <p class="flow-edit-hint"><GripVertical :size="13"/>拖动手柄排序，点击连线上的 ＋ 插入节点</p>
    <div class="flow-boundary"><span></span>{{ phase==='initial'?'会话开始':'用户消息轮次开始' }}</div>
    <template v-for="position in steps.length + 1" :key="position <= steps.length ? keyOf(steps[position - 1]) : 'end'">
      <div class="node-insert-gap" :data-gap="position-1" :class="{ 'drop-target': targetGap===position-1, 'is-open': insertAt===position-1 }">
        <button class="insert-node" :aria-label="`在第 ${position} 步位置插入节点`" :aria-expanded="insertAt===position-1" @click="openInsert(position-1)"><Plus :size="14"/><span v-if="!steps.length">添加第一个节点</span></button>
        <div v-if="insertAt===position-1" class="node-insert-options" role="group" aria-label="选择新节点类型">
          <button @click="insert('action')"><FileText :size="15"/>追加上下文</button>
          <button v-if="phase==='turn'" @click="insert('llm')"><Cpu :size="15"/>调用模型</button>
          <button class="close-insert" aria-label="取消插入" @click="cancel"><X :size="14"/></button>
        </div>
      </div>
      <article v-if="position <= steps.length" class="flow-node" :data-node-key="keyOf(steps[position-1])" :class="{ selected: selected===position-1, 'node-muted': steps[position-1].enabled===false, 'drag-source': dragged===position-1, 'has-error': previews[position-1]?.error }">
        <div class="node-main">
          <button class="node-grip" :aria-label="`拖动排序第 ${position} 步 ${nameOf(steps[position-1])}`" title="拖动排序；Alt + ↑ / ↓ 移动" @pointerdown="startPointer($event,position-1)" @pointermove="movePointer" @pointerup="dropPointer" @pointercancel="endDrag" @lostpointercapture="endDrag" @keydown.alt.up.prevent="move(position-1,position-2)" @keydown.alt.down.prevent="move(position-1,position)" @click="clickGrip(position-1)"><GripVertical :size="17"/></button>
          <button class="node-select" :aria-label="`编辑第 ${position} 步 ${nameOf(steps[position-1])}`" :aria-pressed="selected===position-1" @click="emit('select',position-1)">
            <span class="step-icon" :class="{ llm: steps[position-1].type==='llm' }"><Cpu v-if="steps[position-1].type==='llm'" :size="17"/><FileText v-else :size="17"/></span>
            <span class="node-copy"><strong>{{ nameOf(steps[position-1]) }}</strong><small>{{ steps[position-1].enabled===false?'已停用':steps[position-1].type==='llm'?'调用模型':'追加上下文' }} · {{ typeof steps[position-1].token==='number'?'固定长度':'公式' }}</small><small v-if="phase==='turn'" class="node-trigger-label">{{ triggerLabel(steps[position-1]) }}<span v-if="steps[position-1].enabled!==false && !previews[position-1]?.runs && !previews[position-1]?.error"> · 本轮未触发</span></small></span>
            <span class="node-amount">{{ amount(position-1) }}<small>K</small></span><ChevronRight :size="13"/>
          </button>
        </div>
        <div class="node-controls"><span class="node-position">{{ String(position).padStart(2,'0') }} / {{ String(steps.length).padStart(2,'0') }}</span><span v-if="previews[position-1]?.error" class="node-error-label">配置有误</span><div class="node-control-buttons">
          <button :disabled="position===1" :aria-label="`上移第 ${position} 步`" title="上移" @click="move(position-1,position-2)"><ArrowUp :size="14"/></button>
          <button :disabled="position===steps.length" :aria-label="`下移第 ${position} 步`" title="下移" @click="move(position-1,position)"><ArrowDown :size="14"/></button>
          <button :aria-label="`复制第 ${position} 步`" title="复制" @click="duplicate(position-1)"><Copy :size="14"/></button>
          <button class="remove-node" :aria-label="`删除第 ${position} 步 ${nameOf(steps[position-1])}`" title="删除，可撤销" @click="remove(position-1)"><Trash2 :size="14"/></button>
        </div></div>
      </article>
    </template>
    <p v-if="!steps.length" class="flow-empty-hint"><Workflow :size="22"/>还没有节点，从上方 ＋ 开始搭建流程。</p>
    <div class="flow-boundary"><span></span>{{ phase==='initial'?'上下文就绪':'检查压缩，进入下一轮' }}</div>
    <span class="flow-sr-only" role="status" aria-live="polite">{{ announcement }}</span>
  </div>
</template>

<style scoped>
.flow-node-board { min-width: 0; }
.flow-edit-hint { display: flex; align-items: center; gap: 6px; margin-bottom: 20px; color: var(--muted); font-size: 11px; line-height: 1.7; }
.flow-boundary { display: flex; align-items: center; gap: 8px; color: #89919c; font-size: 10px; padding-left: 12px; }
.flow-boundary > span { width: 7px; height: 7px; border: 2px solid #c9cfd7; border-radius: 50%; }
.node-insert-gap { position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center; min-height: 36px; padding: 5px 0; gap: 8px; }
.node-insert-gap::before { content: ''; position: absolute; top: 0; bottom: 0; left: 50%; width: 1px; background: #e1e5eb; }
.insert-node { z-index: 1; display: flex; align-items: center; justify-content: center; gap: 6px; min-width: 24px; min-height: 24px; padding: 3px 6px; border: 1px solid #e1e5eb; background: #fff; color: #9299a5; border-radius: 20px; font-size: 11px; }
.insert-node:hover, .insert-node[aria-expanded=true] { background: var(--accent-soft); border-color: #c9957f; color: var(--accent); }
.node-insert-options { z-index: 2; display: flex; flex-wrap: wrap; justify-content: center; gap: 5px; padding: 7px; border: 1px solid #eadbd3; border-radius: 10px; background: #fff; box-shadow: 0 4px 14px #18203908; }
.node-insert-options button { display: flex; align-items: center; justify-content: center; gap: 6px; border: 0; border-radius: 6px; padding: 8px; background: var(--accent-soft); color: var(--accent-ink); font-size: 11px; }
.node-insert-options .close-insert { background: transparent; color: var(--muted); }
.flow-node { border: 1px solid var(--line); border-radius: 11px; background: #fff; transition: border-color .15s, box-shadow .15s; overflow: hidden; }
.flow-node:hover { border-color: #cbd0d9; }
.flow-node.selected { border-color: #c9957f; background: #fcf8f5; box-shadow: 0 0 0 2px #c2553608; }
.flow-node.has-error { border-color: #b3483d; }
.node-main { display: flex; align-items: stretch; }
.node-grip { display: grid; place-items: center; flex: none; width: 28px; padding: 0; border: 0; background: transparent; color: #adb4bf; cursor: grab; touch-action: none; user-select: none; }
.node-grip:active { cursor: grabbing; }
.node-grip:hover { color: var(--accent); background: #c2553608; }
.node-select { display: flex; align-items: center; gap: 10px; flex: 1; min-width: 0; border: 0; background: transparent; text-align: left; padding: 15px 13px 15px 0; }
.node-select:focus-visible, .node-grip:focus-visible { outline-offset: -3px; }
.node-select > svg { flex: none; color: #a3aab5; }
.node-copy { flex: 1; min-width: 0; }
.node-copy strong { display: block; font-size: 13px; font-weight: 500; color: #303848; overflow-wrap: anywhere; }
.node-copy small { display: block; margin-top: 5px; font-size: 10px; color: #9299a5; line-height: 1.6; }
.node-copy .node-trigger-label { color: var(--accent-ink); }
.node-amount { white-space: nowrap; color: #555e6e; font-size: 13px; font-variant-numeric: tabular-nums; }
.node-amount small { margin-left: 4px; font-size: 9px; color: var(--muted); }
.node-controls { display: flex; align-items: center; gap: 8px; padding: 4px 9px 4px 13px; border-top: 1px solid #eceef266; }
.node-position { color: #9da5b1; font-size: 9px; font-variant-numeric: tabular-nums; }
.node-control-buttons { display: flex; margin-left: auto; gap: 4px; }
.node-control-buttons button { display: grid; place-items: center; width: 28px; height: 28px; border: 0; border-radius: 5px; background: transparent; color: #89919c; }
.node-control-buttons button:hover:not(:disabled) { background: #f0f2f5; color: #303848; }
.node-control-buttons .remove-node:hover { background: #fdf1ef; color: #b3483d; }
.node-error-label { color: #b3483d; font-size: 10px; }
.node-muted .node-select { opacity: .48; }
.drag-source { opacity: .4; }
.drop-target::after { content: ''; position: absolute; inset: calc(50% - 1px) 0 auto; height: 2px; background: var(--accent); box-shadow: 0 0 0 3px #c2553610; }
.drop-target .insert-node { background: var(--accent); border-color: var(--accent); color: #fff; }
.is-dragging { user-select: none; cursor: grabbing; }
.is-dragging .insert-node { pointer-events: none; }
.flow-empty-hint { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 28px 12px; color: var(--muted); font-size: 12px; line-height: 1.8; text-align: center; }
.flow-sr-only { position: absolute; width: 1px; height: 1px; overflow: hidden; clip-path: inset(50%); white-space: nowrap; }
@media (max-width: 600px) {
  .node-select { gap: 8px; }
  .node-copy strong { font-size: 12px; }
  .node-control-buttons button { width: 34px; height: 32px; }
  .node-insert-gap { min-height: 42px; }
  .insert-node { min-height: 30px; min-width: 30px; }
}
</style>
