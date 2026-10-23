<script setup>
import { modelPresets } from "../model-pricing.js";
defineProps({ config: Object, error: String });
</script>

<template>
  <label class="field global-model-field"><span>模型</span><select v-model="config.globalModelId" aria-label="全局模型" :aria-invalid="!!error"><option v-for="preset in modelPresets" :key="preset.id" :value="preset.id">{{ preset.name }}</option></select><small v-if="error" class="error">{{ error }}</small></label>
</template>

<style scoped>
.global-model-field { grid-column: 1 / -1; }
</style>
