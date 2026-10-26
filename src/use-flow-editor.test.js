import test from 'node:test';
import assert from 'node:assert/strict';
import { effectScope, ref } from 'vue';
import { useFlowEditor } from './use-flow-editor.js';
import { createComparisonConfig, validatePlan } from './comparison.js';

function editor() {
  const scope = effectScope();
  const draft = ref(createComparisonConfig().plans[0]), phase = ref('turn'), selected = ref(1);
  const operations = scope.run(() => useFlowEditor(draft, phase, selected));
  return { ...operations, draft, phase, selected, close: () => scope.stop() };
}

test('移动首尾和其他节点时，属性面板保持原选中节点，配置不增加界面字段', () => {
  const e = editor();
  try {
    const selected = e.steps.value[1], first = e.steps.value[0], last = e.steps.value.at(-1);
    e.reorderStep(0, 7);
    assert.equal(e.steps.value.at(-1), first);
    assert.equal(e.steps.value[e.selected.value], selected);
    e.reorderStep(6, 0);
    assert.equal(e.steps.value[0], last);
    e.reorderStep(e.selected.value, 7);
    assert.equal(e.steps.value[7], selected);
    assert.equal(e.selected.value, 7);
    assert.deepEqual(validatePlan(e.draft.value), {});
  } finally { e.close(); }
});

test('中间插入会选中新节点；复制保留触发规则且嵌套配置独立', () => {
  const e = editor();
  try {
    const next = e.steps.value[2];
    e.insertStep(2, 'llm');
    assert.equal(e.selected.value, 2);
    assert.equal(e.steps.value[3], next);
    e.steps.value[2].trigger = { type: 'interval', value: 3 };
    e.duplicateStep(2);
    assert.equal(e.selected.value, 3);
    assert.deepEqual(e.steps.value[3], e.steps.value[2]);
    e.steps.value[3].trigger.value = 5;
    assert.equal(e.steps.value[2].trigger.value, 3);
    e.phase.value = 'initial';
    const count = e.steps.value.length;
    e.insertStep(0, 'llm');
    assert.equal(e.steps.value.length, count);
    e.insertStep(0, 'action');
    assert.equal(e.steps.value[0].type, 'action');
  } finally { e.close(); }
});

test('删除未选中节点不切换属性，撤销能在跨阶段和重新排序后恢复节点', () => {
  const e = editor();
  try {
    const selected = e.steps.value[1], removed = e.steps.value[3], after = e.steps.value[4];
    e.deleteStep(3);
    assert.equal(e.steps.value[e.selected.value], selected);
    e.reorderStep(3, 0);
    e.phase.value = 'initial';
    e.restoreStep();
    assert.equal(e.phase.value, 'turn');
    assert.equal(e.steps.value[e.selected.value], removed);
    assert.equal(e.steps.value[e.selected.value + 1], after);
    assert.equal(e.deletedStep.value, null);
  } finally { e.close(); }
});

test('删除到空流程仍可撤销或插入；更换草稿清除旧撤销记录', () => {
  const e = editor();
  try {
    while (e.steps.value.length) e.deleteStep(0);
    assert.equal(e.selected.value, 0);
    e.restoreStep();
    assert.equal(e.steps.value.length, 1);
    e.deleteStep();
    e.insertStep(0);
    assert.equal(e.steps.value[0].text, '新的上下文');
    e.draft.value = createComparisonConfig().plans[1];
    assert.equal(e.deletedStep.value, null);
    const count = e.steps.value.length;
    e.restoreStep();
    assert.equal(e.steps.value.length, count);
  } finally { e.close(); }
});
