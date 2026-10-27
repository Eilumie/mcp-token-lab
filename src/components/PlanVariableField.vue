<script setup>
import { computed } from 'vue';
import { getValue, setValue, integers } from '../config.js';
import { resolvePlan } from '../comparison.js';
import FieldHint from './FieldHint.vue';
const props = defineProps({ plan: Object, globals: Object, field: Array });
const inherited = computed(() => props.plan.useGlobal?.[props.field[0]] === true);
const value = computed(() => getValue(resolvePlan(props.plan, props.globals).simulation, props.field[0]));
const display = computed(() => value.value === '' ? '' : props.field[2] === '%' ? Number((value.value * 100).toFixed(8)) : value.value);
function toggle() {
  props.plan.useGlobal ??= {};
  if (inherited.value) setValue(props.plan.simulation, props.field[0], value.value);
  props.plan.useGlobal[props.field[0]] = !inherited.value;
}
function update(event) {
  const value = event.target.value === '' ? '' : Number(event.target.value) / (props.field[2] === '%' ? 100 : 1);
  setValue(props.plan.simulation, props.field[0], value);
  props.plan.useGlobal ??= {};
  props.plan.useGlobal[props.field[0]] = false;
}
</script>
<template>
  <label class="field plan-variable-field">
    <span>{{ field[1] }}<FieldHint v-if="field[5]" :text="field[5]"/><button type="button" class="inherit-btn" :class="{inherited}" :aria-pressed="inherited" :aria-label="'继承全局 '+field[1]" @click.prevent="toggle">{{ inherited?'继承全局':'自定义' }}</button></span>
    <span class="input-unit"><input type="number" :aria-label="field[1]" :min="field[3]" :max="field[4]" :step="integers.has(field[0])?1:'any'" :value="display" @input="update"/><span>{{ field[2] }}</span></span>
  </label>
</template>
