<script setup>
import { computed, onBeforeUnmount, onMounted, ref, useId } from 'vue';
import { X } from 'lucide-vue-next';
import { translateUi } from '../i18n.js';

const props = defineProps({ variables: { type: Array, required: true } });
const emit = defineEmits(['close', 'insert']);
const dialog = ref(null), search = ref('');
const titleId = useId();
const groups = computed(() => {
  const query = search.value.trim().toLowerCase();
  return ['内置变量', '自定义变量', '运行时变量'].map(title => ({
    title,
    items: props.variables.filter(variable => variable.group === title &&
      `${variable.name} ${variable.label} ${translateUi(variable.label)}`.toLowerCase().includes(query)),
  })).filter(group => group.items.length);
});
let previousFocus;
onMounted(() => { previousFocus = document.activeElement; dialog.value.showModal(); });
onBeforeUnmount(() => { dialog.value?.close(); if (previousFocus?.isConnected) previousFocus.focus({ preventScroll: true }); });
</script>

<template>
  <Teleport to="body">
    <dialog ref="dialog" class="formula-variable-dialog" :aria-labelledby="titleId" @cancel.prevent="emit('close')">
      <header><h2 :id="titleId">插入变量</h2><button type="button" class="close" aria-label="关闭插入变量" @click="emit('close')"><X :size="18" /></button></header>
      <div class="search"><input v-model="search" type="search" autofocus placeholder="搜索变量名或说明" aria-label="搜索变量名或说明" /><p>选择变量，插入到公式光标位置；数值为当前节点首轮参考值。</p></div>
      <div class="variable-list">
        <section v-for="group in groups" :key="group.title"><h3>{{ group.title }}</h3><button v-for="variable in group.items" :key="variable.name" type="button" class="variable" @click="emit('insert', variable.name)"><span><code>{{ variable.name }}</code><small>{{ translateUi(variable.label) }}</small></span><span class="value">{{ variable.value }}</span></button></section>
        <p v-if="!groups.length" class="empty" role="status">没有匹配的变量</p>
      </div>
      <footer><button type="button" @click="emit('close')">取消</button></footer>
    </dialog>
  </Teleport>
</template>

<style scoped>
.formula-variable-dialog { box-sizing: border-box; width: min(900px, calc(100vw - 32px)); max-height: calc(100dvh - 48px); padding: 0; border: 1px solid #dddfd7; border-radius: 2px; color: #242622; background: #fafaf7; box-shadow: 0 24px 80px #24262224; }
.formula-variable-dialog[open] { display: flex; flex-direction: column; }
.formula-variable-dialog::backdrop { background: #24262266; backdrop-filter: blur(2px); }
header, footer { display: flex; align-items: center; justify-content: space-between; gap: 12px; padding: 16px 22px; flex-shrink: 0; }
header { border-bottom: 1px solid #dddfd7; } h2 { margin: 0; font-size: 16px; font-weight: 550; }
button { cursor: pointer; border: 1px solid #dddfd7; border-radius: 2px; background: transparent; color: #555950; padding: 8px 14px; font: inherit; } button:hover { background: #eeefe9; } button:focus-visible { outline: 2px solid #b94e30; outline-offset: -2px; } .close { border: 0; padding: 5px; }
.search { padding: 16px 22px 8px; } input { box-sizing: border-box; width: 100%; padding: 9px; border: 1px solid #dddfd7; border-radius: 2px; background: #fff; color: #242622; font: inherit; } input:focus { outline: none; border-color: #b94e30; box-shadow: 0 0 0 2px #b94e3018; }
.search p, .empty { color: #73766e; font-size: 11px; line-height: 1.8; }
.variable-list { min-height: 0; overflow: auto; overscroll-behavior: contain; padding: 0 22px 16px; } .variable-list section { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 230px), 1fr)); gap: 8px; } h3 { grid-column: 1 / -1; margin: 16px 0 0; color: #73766e; font-size: 12px; font-weight: 500; }
.variable { display: flex; align-items: center; justify-content: space-between; gap: 16px; box-sizing: border-box; min-width: 0; width: 100%; padding: 12px; text-align: left; } .variable > span:first-child { min-width: 0; } code { display: block; color: #242622; font-size: 12px; overflow-wrap: anywhere; } small { display: block; color: #73766e; font-size: 11px; margin-top: 5px; } .value { color: #b94e30; font-size: 12px; overflow-wrap: anywhere; max-width: 40%; }
footer { justify-content: flex-end; border-top: 1px solid #dddfd7; font-size: 12px; }
</style>
