<script setup>
import { computed } from "vue";
import { SlidersHorizontal, RotateCcw, ChevronDown, Layers, Cpu } from "lucide-vue-next";
import { groups, compressionFields, priceFields, createPresetConfig } from "../config.js";
import { modelPresets } from "../model-pricing.js";
import { token } from "../utils.js";
import ParameterField from "./ParameterField.vue";
import FlowEditor from "./FlowEditor.vue";
const props = defineProps({ config: Object, errors: Object });
defineEmits(["reset"]);
const s = computed(() => props.config.simulation);
const visibleCompression = computed(() => compressionFields.filter(([key]) => key !== (s.value.compressionThresholdType === "TURN" ? "compressionThresholdToken" : "compressionThresholdTurnCount")));
const sizing = computed(() => {
  const c = s.value;
  const skills = c.skillsTotalCount * c.skillIndexToken;
  const tools = c.toolsTotalCount * c.toolsIndexToken;
  const allow = tools * c.sessionAvgAllowToolsRate;
  const schema = c.toolsTotalCount * c.toolSchemaToken;
  return { skills, tools, allow, schema };
});
function selectRate(event) {
  const preset = modelPresets.find(p => p.id === event.target.value);
  if (!preset) return;
  Object.assign(props.config, createPresetConfig(preset));
}
function markCustom() {
  props.config.pricing = { id: "custom", label: "手动费率", source: "", date: "" };
}
</script>

<template>
  <aside class="parameters">
    <div class="aside-heading"><div><SlidersHorizontal :size="17" /><h2>当前方案</h2></div><button class="icon-button" title="恢复当前方案默认参数" aria-label="恢复当前方案默认参数" @click="$emit('reset')"><RotateCcw :size="15" /></button></div>
    <p class="aside-intro">修改仅作用于当前选中的方案。</p>
    <div class="parameter-fields plan-identity">
      <label class="field"><span>方案名称</span><input v-model="config.name" maxlength="60" aria-label="方案名称" /><small v-if="errors.planName" class="error">{{ errors.planName }}</small></label>
    </div>
    <details v-for="(group, index) in groups" :key="group.title" class="parameter-group" :open="index === 0">
      <summary><span><i class="group-number">{{ String(index + 1).padStart(2, '0') }}</i>{{ group.title }}</span><ChevronDown :size="14" /></summary>
      <div class="parameter-fields">
        <ParameterField v-for="field in group.fields" :key="field[0]" :object="s" :field="field" :error="errors[field[0]]" />
        <div v-if="index === 0" class="field-note">支持 1–1,000 轮；小数数量表示每轮平均用量。</div>
        <div v-if="index === 1" class="field-note">命中率作用于匹配到的前缀。角色比例只决定允许工具列表的长度。</div>
        <div v-if="index === 2" class="derived-values">
          <span>Skills 索引 <b>{{ token(sizing.skills) }}</b></span>
          <span>Tools 索引 <b>{{ token(sizing.tools) }}</b></span>
          <span>角色允许列表 <b>{{ token(sizing.allow) }}</b></span>
          <span>全量 Schema <b>{{ token(sizing.schema) }}</b></span>
        </div>
      </div>
    </details>
    <FlowEditor :simulation="s" :error="errors.flow" />
    <details class="parameter-group compression-parameters">
      <summary><span><Layers :size="15" />上下文压缩</span><ChevronDown :size="14" /></summary>
      <div class="parameter-fields">
        <label class="field"><span>触发方式</span><select v-model="s.compressionThresholdType" aria-label="压缩触发方式"><option value="TURN">按活跃用户轮次</option><option value="TOKEN">按上下文 Token</option></select></label>
        <ParameterField v-for="field in visibleCompression" :key="field[0]" :object="s" :field="field" :error="errors[field[0]]" />
        <p class="field-note">在每轮流程结束后检查，压缩会额外请求一次模型。摘要长度不等于压缩后的总上下文。</p>
      </div>
    </details>
    <details class="parameter-group">
      <summary><span><Cpu :size="15" />模型与费率</span><ChevronDown :size="14" /></summary>
      <div class="parameter-fields">
        <label class="field"><span>费率预设</span><select :value="config.pricing.id" aria-label="费率预设" @change="selectRate"><option v-if="!modelPresets.some(p => p.id === config.pricing.id)" :value="config.pricing.id">当前自定义费率</option><option v-for="preset in modelPresets" :key="preset.id" :value="preset.id">{{ preset.name }} · {{ preset.currency }}</option></select></label>
        <label class="field"><span>模型名称</span><input v-model="config.model.name" maxlength="100" aria-label="模型名称" @input="markCustom" /><small v-if="errors.name" class="error">{{ errors.name }}</small></label>
        <ParameterField v-for="[key, label] in priceFields" :key="key" :object="config.model" :field="[key, label, config.model.currency + '/M', 0]" :error="errors[key]" @change="markCustom" />
        <p class="field-note">{{ config.pricing.label }}<template v-if="config.pricing.date"> · {{ config.pricing.date }}</template>。单价单位为每百万 Token，修改后使用自定义费率。<a v-if="config.pricing.source?.startsWith('https://')" :href="config.pricing.source" target="_blank" rel="noopener noreferrer">查看来源 ↗</a></p>
      </div>
    </details>
    <div class="aside-footnote">1K = 1,000 Token<br />所有计算在本地完成，不调用模型 API。</div>
  </aside>
</template>
