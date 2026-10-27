<script setup>
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue';
import { Archive, ArrowRight, ChevronDown, ChevronUp, Cpu, Layers, Workflow } from 'lucide-vue-next';
import { offsetIndex, requestDetailItems, requestInputActions, requestRounds } from '../request-details.js';
import { percent, token } from '../utils.js';

const props = defineProps({ results: { type: Array, required: true } });
const selectedPlan = ref(props.results[0]?.planId);
const report = computed(() => props.results.find(result => result.planId === selectedPlan.value) ?? props.results[0]);
const turns = computed(() => requestRounds(report.value));
const requestCount = computed(() => report.value?.requests.length ?? 0);
const viewport = ref(null), scrollTop = ref(0), viewportWidth = ref(1000), viewportHeight = ref(840);
const expandedModels = shallowRef(new Map());
const jumpRound = ref(1), announcement = ref('');
const actionCache = new Map();
let viewportObserver, anchorRevision = 0;
const narrow = computed(() => viewportWidth.value < 560);
const bodyWidth = computed(() => Math.max(120, viewportWidth.value - (narrow.value ? 76 : 116)));
const actionColumns = computed(() => Math.max(1, Math.min(6, Math.floor((bodyWidth.value - (narrow.value ? 0 : 64) + 7) / 124))));
const modelColumns = computed(() => Math.max(1, Math.min(5, Math.floor((bodyWidth.value + 8) / 166))));
const items = computed(() => requestDetailItems(report.value, turns.value, expandedModels.value, actionColumns.value));
const headerIndices = computed(() => new Map(items.value.flatMap((item, index) => item.type === 'turn' ? [[item.turn.id, index]] : [])));
const itemIndices = computed(() => new Map(items.value.map((item, index) => [item.key, index])));
function estimatedHeight(item) {
  if (item.type === 'empty') return 58;
  if (item.type === 'actions') return (narrow.value ? (item.start === 0 ? 91 : 65) : 61) + (item.last ? 20 : 0);
  const rows = Math.ceil(item.turn.models.length / modelColumns.value);
  return 30 + 26 + 13 + (rows ? rows * 74 + (rows - 1) * 8 : 30) + (item.model ? (narrow.value ? 58 : 38) : 5);
}
const offsets = computed(() => {
  const values = [0];
  for (const item of items.value) values.push(values.at(-1) + estimatedHeight(item));
  return values;
});
const visibleRange = computed(() => {
  if (!items.value.length) return { first: 0, last: 0, start: 0, end: 0 };
  const first = offsetIndex(offsets.value, scrollTop.value);
  const last = offsetIndex(offsets.value, scrollTop.value + viewportHeight.value - 1);
  return { first, last, start: Math.max(0, first - 2), end: Math.min(items.value.length, last + 3) };
});
const visibleItems = computed(() => items.value.slice(visibleRange.value.start, visibleRange.value.end).map((item, index) => {
  let actions = [];
  if (item.type === 'actions') {
    const key = `${item.model.id}:${item.group.id}`;
    if (!actionCache.has(key)) actionCache.set(key, requestInputActions(report.value, item.model, item.group));
    actions = actionCache.get(key).slice(item.start, item.end);
  }
  return { ...item, index: visibleRange.value.start + index, actions };
}));
const visibleRounds = computed(() => {
  if (!items.value.length) return '0 轮';
  const first = items.value[visibleRange.value.first].turn.id, last = items.value[visibleRange.value.last].turn.id;
  return `Turn ${first}${last !== first ? '–' + last : ''} / ${turns.value.length}`;
});
const labels = { hit: '命中缓存', miss: '未命中缓存', partial: '部分命中', empty: '零 Token' };
const cacheStyle = item => ({ '--request-hit': `${item.hit + item.miss ? item.hit / (item.hit + item.miss) * 100 : 0}%` });
const cacheDescription = item => `${labels[item.state]}，命中 ${token(item.hit)}，未命中 ${token(item.miss)}`;
const sourceLabel = group => group.kind === 'initial' ? '初始上下文' : `Turn ${group.round}`;
const sourceNote = group => group.kind === 'initial' ? 'Turn 0' : group.kind === 'compression' ? group.label : '';
const totalHeight = computed(() => offsets.value.at(-1));

watch(() => props.results.map(result => result.planId), ids => {
  if (!ids.includes(selectedPlan.value)) selectedPlan.value = ids[0];
});
function scrollAnchor() {
  const index = offsetIndex(offsets.value, viewport.value?.scrollTop ?? 0), item = items.value[index];
  return { key: item?.key, turn: item?.turn.id, offset: (viewport.value?.scrollTop ?? 0) - offsets.value[index] };
}
async function restoreAnchor(anchor) {
  const revision = ++anchorRevision;
  await nextTick();
  if (!viewport.value || revision !== anchorRevision) return;
  const index = itemIndices.value.get(anchor.key) ?? headerIndices.value.get(anchor.turn) ?? 0;
  const height = (offsets.value[index + 1] ?? 0) - (offsets.value[index] ?? 0);
  viewport.value.scrollTop = (offsets.value[index] ?? 0) + Math.min(anchor.offset, Math.max(0, height - 1));
  scrollTop.value = viewport.value.scrollTop;
}
function onScroll(event) { anchorRevision++; scrollTop.value = event.currentTarget.scrollTop; }
function toggleModel(turn, model) {
  const anchor = scrollAnchor(), next = new Map(expandedModels.value);
  const current = next.has(turn.id) ? next.get(turn.id) : turn.models.at(-1)?.id;
  const close = current === model.id;
  next.set(turn.id, close ? null : model.id);
  expandedModels.value = next;
  announcement.value = `Turn ${turn.id} ${model.label} 已${close ? '收起' : '展开，动作按来源 Turn 分组'}`;
  restoreAnchor(anchor);
}
function goToRound() {
  anchorRevision++;
  const round = Math.max(1, Math.min(turns.value.length, Math.trunc(Number(jumpRound.value)) || 1));
  jumpRound.value = round;
  if (!viewport.value) return;
  viewport.value.scrollTop = offsets.value[headerIndices.value.get(round) ?? 0];
  scrollTop.value = viewport.value.scrollTop;
  announcement.value = `已定位到 Turn ${round}`;
}
watch(report, async () => {
  anchorRevision++;
  actionCache.clear(); expandedModels.value = new Map();
  jumpRound.value = 1; scrollTop.value = 0;
  await nextTick();
  if (viewport.value) viewport.value.scrollTop = 0;
});
onMounted(() => {
  viewportObserver = new ResizeObserver(([entry]) => {
    const width = entry.contentRect.width;
    viewportHeight.value = entry.target.clientHeight;
    if (Math.abs(width - viewportWidth.value) > .5) {
      const anchor = scrollAnchor();
      viewportWidth.value = width; restoreAnchor(anchor);
    }
  });
  viewportObserver.observe(viewport.value);
});
onBeforeUnmount(() => { viewportObserver?.disconnect(); });
</script>

<template>
  <section class="request-details" aria-labelledby="request-details-title">
    <div class="request-details-heading">
      <div><h2 id="request-details-title">请求明细</h2><p>{{ turns.length }} 轮 · {{ requestCount }} 次 LLM 调用 · 默认展开每轮最后一次调用</p></div>
      <div class="request-details-controls">
        <label class="request-plan-field"><span>方案</span><select v-model="selectedPlan" aria-label="请求明细方案"><option v-for="result in results" :key="result.planId" :value="result.planId">{{ result.planName }}</option></select></label>
        <div class="request-jump"><label for="request-jump-round">定位轮次</label><input id="request-jump-round" v-model="jumpRound" type="number" min="1" :max="turns.length || 1" :disabled="!turns.length" @keydown.enter.prevent="goToRound"><button :disabled="!turns.length" @click="goToRound">跳转<ArrowRight :size="13"/></button></div>
      </div>
    </div>
    <div class="request-cache-legend"><div><span><i class="request-cache-swatch cache-hit"></i>命中缓存</span><span><i class="request-cache-swatch cache-miss"></i>未命中缓存</span><span><i class="request-cache-swatch cache-partial"></i>部分命中</span></div><span>按所选 LLM 的输入前缀边界展示 · 单位 K Token</span></div>
    <div ref="viewport" class="request-viewport" role="region" aria-label="可滚动的请求明细列表" tabindex="0" @scroll.passive="onScroll">
      <div v-if="items.length" class="request-virtual-canvas" role="list" aria-label="模型调用与输入动作" :style="{ height: totalHeight + 'px' }">
        <article v-for="row in visibleItems" :key="row.key" class="request-virtual-item" :class="{ 'request-turn-header': row.type === 'turn', 'request-turn-closed': row.type === 'turn' && !row.model, 'request-source-row': row.type === 'actions', 'request-source-continuation': row.type === 'actions' && row.start > 0, 'request-source-group-end': row.type === 'actions' && row.end === row.group.actionCount, 'request-source-last': row.last, 'request-empty-input': row.type === 'empty' }" :data-item-key="row.key" :data-round-id="row.turn.id" :data-source-turn="row.group?.round" role="listitem" :aria-label="row.type === 'turn' ? `Turn ${row.turn.id}，${row.turn.models.length} 次模型调用` : `Turn ${row.turn.id} ${row.model.label}，${row.group ? row.group.label + '的输入动作' : '没有输入动作'}`" :aria-posinset="row.index + 1" :aria-setsize="items.length" :style="{ top: offsets[row.index] + 'px', height: estimatedHeight(row) + 'px' }">
          <div class="request-round-rail"><template v-if="row.type === 'turn'"><strong>Turn {{ row.turn.id }}</strong><small>#{{ String(row.turn.id).padStart(3, '0') }}</small></template></div>
          <div class="request-item-body">
            <template v-if="row.type === 'turn'">
              <div class="request-turn-heading"><h3><Workflow :size="14"/>模型调用</h3><span>{{ row.turn.models.length }} 次调用</span></div>
              <div v-if="row.turn.models.length" class="request-model-grid" :style="{ gridTemplateColumns: `repeat(${modelColumns}, minmax(0, 1fr))` }">
                <button v-for="model in row.turn.models" :key="model.id" class="request-model-chip" :class="'cache-' + model.state" :style="cacheStyle(model)" :aria-label="`${row.model?.id === model.id ? '收起' : '展开'} Turn ${row.turn.id} ${model.label} ${model.stage}，${cacheDescription(model)}`" :aria-expanded="row.model?.id === model.id" @click="toggleModel(row.turn, model)">
                  <strong><Archive v-if="model.compression" :size="13"/><Cpu v-else :size="13"/>{{ model.label }}<small v-if="model.id === row.turn.models.at(-1).id">最后一次调用</small><ChevronUp v-if="row.model?.id === model.id" :size="12"/><ChevronDown v-else :size="12"/></strong>
                  <span><span :title="model.stage">{{ model.stage }}</span><small>命中 {{ percent(model.input ? model.hit / model.input : null) }}</small></span>
                </button>
              </div>
              <p v-else class="request-context-empty">本轮没有模型调用。</p>
              <div v-if="row.model" class="request-input-heading"><span><strong>{{ row.model.label }}</strong> 的输入动作 <small>· 按来源 Turn 排列</small></span><span><span>命中 {{ token(row.model.hit) }}</span> / <span>未命中 {{ token(row.model.miss) }}</span></span></div>
            </template>
            <template v-else-if="row.type === 'actions'">
              <div class="request-source-label" :aria-hidden="row.start > 0 ? true : undefined"><template v-if="row.start === 0"><strong :title="row.group.label">{{ sourceLabel(row.group) }}</strong><small v-if="sourceNote(row.group)">{{ sourceNote(row.group) }}</small></template></div>
              <div class="request-action-grid" :style="{ gridTemplateColumns: `repeat(${actionColumns}, minmax(0, 1fr))` }">
                <div v-for="action in row.actions" :key="action.id" class="request-action-chip" :class="'cache-' + action.state" :style="cacheStyle(action)" :aria-label="`${row.group.label}，${action.summary ? action.label : action.name}，${cacheDescription(action)}`" :title="`${row.group.label} · ${action.summary ? action.label : action.name}\n${cacheDescription(action)}`"><strong><Archive v-if="action.summary" :size="12"/><span>{{ action.summary ? action.label : action.name }}</span></strong><span>{{ token(action.token) }}</span></div>
              </div>
            </template>
            <p v-else class="request-context-empty">该次调用没有输入动作。</p>
          </div>
        </article>
      </div>
      <p v-else class="request-empty-state"><Layers :size="22"/>当前方案没有用户轮次。</p>
    </div>
    <div class="request-details-footer"><span>{{ visibleRounds }}</span><span>仅 LLM 可展开 · Action 按来源 Turn 分组</span></div>
    <span class="sr-only" aria-live="polite">{{ announcement }}</span>
  </section>
</template>

<style>
.home-page .request-details{border-top:1px solid var(--line);--request-hit-bg:#edf5ef;--request-hit-ink:#3e7657;--request-miss-bg:#fcf2e3;--request-miss-ink:#9c7036}
.home-page .request-details-heading{padding:24px;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap}
.home-page .request-details-heading h2{font-size:17px}
.home-page .request-details-heading p{margin-top:7px;font-size:11px;color:var(--muted);line-height:1.7}
.home-page .request-details-controls{display:flex;align-items:center;gap:18px;flex-wrap:wrap}
.home-page .request-plan-field,.home-page .request-jump{display:flex;align-items:center;gap:8px;font-size:11px;color:var(--muted)}
.home-page .request-plan-field>span,.home-page .request-jump label{white-space:nowrap}
.home-page .request-plan-field select{width:auto;max-width:200px;font-size:12px;padding:7px 28px 7px 10px}
.home-page .request-jump input{width:65px;font-size:12px;padding:7px 8px}
.home-page .request-jump button{min-height:33px;font-size:11px;padding:7px 10px;white-space:nowrap;background:var(--accent);border-color:var(--accent);color:white}
.home-page .request-cache-legend{padding:12px 24px;background:#fafbfc;border-block:1px solid var(--line);display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap;font-size:11px;color:var(--muted)}
.home-page .request-cache-legend>div{display:flex;gap:18px;align-items:center;flex-wrap:wrap}
.home-page .request-cache-legend>div>span{display:flex;align-items:center;gap:6px}
.home-page .request-cache-swatch{width:11px;height:11px;border-radius:3px;display:inline-block;--request-hit:50%}
.home-page .request-details .cache-hit,.home-page .request-details button.cache-hit{background:var(--request-hit-bg);color:var(--request-hit-ink)}
.home-page .request-details .cache-miss,.home-page .request-details button.cache-miss{background:var(--request-miss-bg);color:var(--request-miss-ink)}
.home-page .request-details .cache-partial,.home-page .request-details button.cache-partial{background:linear-gradient(90deg,var(--request-hit-bg) var(--request-hit),var(--request-miss-bg) var(--request-hit));color:#526555}
.home-page .request-details .cache-empty,.home-page .request-details button.cache-empty{background:#f1f3f6;color:var(--muted)}
.home-page .request-viewport{height:840px;overflow:auto;overscroll-behavior:contain;overflow-anchor:none;scrollbar-width:thin;scrollbar-color:#dbe0e7 transparent;position:relative;outline-offset:-3px}
.home-page .request-virtual-canvas{position:relative;width:100%}
.home-page .request-virtual-item{box-sizing:border-box;position:absolute;left:0;right:0;display:grid;grid-template-columns:75px minmax(0,1fr);padding:0 24px 0 0;background:var(--paper)}
.home-page .request-round-rail{display:flex;flex-direction:column;align-items:center;gap:5px;border-right:1px solid var(--line);font-variant-numeric:tabular-nums}
.home-page .request-round-rail>strong{font-size:13px;font-weight:550;white-space:nowrap}
.home-page .request-round-rail>small{font-size:10px;color:var(--muted)}
.home-page .request-item-body{min-width:0;margin-left:17px}
.home-page .request-turn-header{padding-top:18px;padding-bottom:12px}
.home-page .request-turn-closed{border-bottom:5px solid #f8fafc}
.home-page .request-turn-heading{height:26px;margin-bottom:13px;display:flex;align-items:center;justify-content:space-between;gap:8px}
.home-page .request-turn-heading h3{margin:0;font-size:12px;font-weight:500;display:flex;align-items:center;gap:7px}
.home-page .request-turn-heading h3>svg{color:var(--muted)}
.home-page .request-turn-heading>span{font-size:10px;color:var(--muted)}
.home-page .request-model-grid{display:grid;gap:8px;align-items:stretch}
.home-page .request-details button.request-model-chip{min-width:0;height:74px;padding:10px 12px;border:1px solid transparent;border-radius:7px;display:flex;align-items:stretch;justify-content:center;flex-direction:column;gap:8px;text-align:left;box-sizing:border-box;box-shadow:none}
.home-page .request-details button.request-model-chip:hover{border-color:#aab4ae}
.home-page .request-details button.request-model-chip[aria-expanded=true]{border-color:var(--accent);box-shadow:0 0 0 1px var(--accent)}
.home-page .request-model-chip>strong{font-size:12px;font-weight:550;display:flex;align-items:center;gap:6px;min-width:0}
.home-page .request-model-chip>strong>small{font-size:9px;font-weight:400;opacity:.8;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.home-page .request-model-chip>strong>svg{flex-shrink:0}
.home-page .request-model-chip>strong>svg:last-child{margin-left:auto}
.home-page .request-model-chip>span{font-size:10px;display:flex;justify-content:space-between;align-items:center;gap:7px;min-width:0}
.home-page .request-model-chip>span>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.home-page .request-model-chip>span>small{font-size:10px;white-space:nowrap;opacity:.85}
.home-page .request-input-heading{display:flex;align-items:center;justify-content:space-between;gap:10px;margin-top:14px;height:24px;font-size:11px;color:var(--muted)}
.home-page .request-input-heading strong{font-weight:500;color:var(--ink)}
.home-page .request-input-heading small{font-size:10px}
.home-page .request-input-heading>span:last-child{font-size:10px;font-variant-numeric:tabular-nums}
.home-page .request-input-heading>span:last-child>span:first-child{color:var(--request-hit-ink)}
.home-page .request-input-heading>span:last-child>span:last-child{color:var(--request-miss-ink)}
.home-page .request-source-row .request-item-body{display:grid;grid-template-columns:55px minmax(0,1fr);gap:9px;align-items:start;padding-block:8px;border-bottom:1px solid transparent}
.home-page .request-source-group-end .request-item-body{border-bottom-color:var(--line)}
.home-page .request-source-label{height:44px;display:flex;flex-direction:column;justify-content:center;gap:3px;min-width:0;color:var(--muted)}
.home-page .request-source-label>strong{font-size:11px;font-weight:500;overflow-wrap:anywhere}
.home-page .request-source-label>small{font-size:9px;overflow-wrap:anywhere}
.home-page .request-action-grid{display:grid;gap:7px;min-width:0}
.home-page .request-action-chip{box-sizing:border-box;min-width:0;height:44px;padding:6px 8px;border-radius:5px;display:flex;flex-direction:column;justify-content:center;gap:4px}
.home-page .request-action-chip>strong{font-size:10px;font-weight:500;display:flex;align-items:center;gap:4px;min-width:0}
.home-page .request-action-chip>strong>svg{flex:none}
.home-page .request-action-chip>strong>span,.home-page .request-action-chip>span{overflow:hidden;text-overflow:ellipsis;white-space:nowrap}
.home-page .request-action-chip>span{font-size:10px;opacity:.9}
.home-page .request-source-last{padding-bottom:15px;border-bottom:5px solid #f8fafc}
.home-page .request-source-last .request-item-body{border-bottom:0}
.home-page .request-details-footer{display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;padding:12px 24px;background:#fafbfc;border-top:1px solid var(--line);font-size:11px;color:var(--muted);font-variant-numeric:tabular-nums}
.home-page .request-context-empty{font-size:11px;color:var(--muted);padding:8px 0}
.home-page .request-empty-input{padding-bottom:15px;border-bottom:5px solid #f8fafc}
.home-page .request-empty-state{min-height:260px;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:12px;color:var(--muted);padding:24px;text-align:center;font-size:12px}
@media(max-width:700px){.home-page .request-details-heading{padding:20px 16px}.home-page .request-details-controls{gap:12px}.home-page .request-cache-legend{padding:12px 16px}.home-page .request-virtual-item{grid-template-columns:64px minmax(0,1fr);padding-right:16px}.home-page .request-item-body{margin-left:12px}.home-page .request-details-footer{padding:12px 16px}}
@container request-viewport (max-width:559px){.home-page .request-virtual-item{grid-template-columns:52px minmax(0,1fr);padding-right:12px}.home-page .request-item-body{margin-left:10px}.home-page .request-round-rail>strong{font-size:11px}.home-page .request-source-row .request-item-body{grid-template-columns:minmax(0,1fr);gap:5px}.home-page .request-source-label{height:21px;flex-direction:row;justify-content:flex-start;align-items:center;gap:5px}.home-page .request-source-label>strong{font-size:10px}.home-page .request-action-chip{height:48px}.home-page .request-input-heading{height:44px;align-items:flex-start;flex-direction:column;justify-content:center;gap:5px}.home-page .request-input-heading small{display:none}}
.home-page .request-viewport{container-type:inline-size;container-name:request-viewport}
@container request-viewport (max-width:559px){.home-page .request-source-continuation .request-source-label{display:none}}
@media(max-width:480px){.home-page .request-details-controls{align-items:flex-start;flex-direction:column;width:100%}.home-page .request-plan-field{width:100%}.home-page .request-plan-field select{max-width:none;flex:1}.home-page .request-cache-legend>div{gap:12px}}
</style>
