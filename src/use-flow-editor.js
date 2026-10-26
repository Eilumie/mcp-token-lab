import { computed, shallowRef, toRaw, watch } from 'vue';

// Keep UI identity outside the serializable flow schema.
export function useFlowEditor(draft, phase, selectedIndex) {
  const deletedStep = shallowRef(null);
  const steps = computed(() => draft.value?.simulation.flow[phase.value] || []);
  watch(draft, () => { deletedStep.value = null; }, { flush: 'sync' });

  function insertStep(index, type = 'action') {
    if (phase.value === 'initial' && type !== 'action') return;
    const position = Math.max(0, Math.min(index, steps.value.length));
    steps.value.splice(position, 0, { type, text: type === 'llm' ? '新的模型调用' : '新的上下文', token: 1 });
    selectedIndex.value = position;
  }
  function reorderStep(from, to) {
    if (from === to || from < 0 || to < 0 || from >= steps.value.length || to >= steps.value.length) return;
    const selected = steps.value[selectedIndex.value];
    const [step] = steps.value.splice(from, 1);
    steps.value.splice(to, 0, step);
    selectedIndex.value = steps.value.indexOf(selected);
  }
  function duplicateStep(index) {
    if (!steps.value[index]) return;
    steps.value.splice(index + 1, 0, structuredClone(toRaw(steps.value[index])));
    selectedIndex.value = index + 1;
  }
  function deleteStep(index = selectedIndex.value) {
    if (!steps.value[index]) return;
    const selected = steps.value[selectedIndex.value];
    deletedStep.value = { step: steps.value[index], phase: phase.value, index, before: steps.value[index - 1], after: steps.value[index + 1] };
    steps.value.splice(index, 1);
    const retained = steps.value.indexOf(selected);
    selectedIndex.value = retained >= 0 ? retained : Math.max(0, Math.min(index, steps.value.length - 1));
  }
  function restoreStep() {
    const deleted = deletedStep.value;
    if (!deleted || !draft.value) return;
    phase.value = deleted.phase;
    const after = steps.value.indexOf(deleted.after), before = steps.value.indexOf(deleted.before);
    const position = after >= 0 ? after : before >= 0 ? before + 1 : Math.min(deleted.index, steps.value.length);
    steps.value.splice(position, 0, deleted.step);
    selectedIndex.value = position;
    deletedStep.value = null;
  }
  return { steps, deletedStep, insertStep, reorderStep, duplicateStep, deleteStep, restoreStep };
}
