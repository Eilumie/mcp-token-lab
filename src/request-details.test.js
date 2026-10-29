import test from 'node:test';
import assert from 'node:assert/strict';
import Session from './session.js';
import { createConfig } from './config.js';
import { buildReport } from './session-report.js';
import { cacheState, indexTurnRequests, modelInputActions, offsetIndex, requestDetailItems, requestInputActions, requestInputTurns, requestTurnLlms, requestRounds, selectedRoundModel } from './request-details.js';

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);
function makeSession(overrides = {}) {
  const config = createConfig();
  const session = new Session({ ...config.simulation, model: config.model, turnTotalCount: 20, compressionThresholdType: 'TURN', compressionKeepTurns: 2, ...overrides });
  session.reset();
  return session;
}

test('动作、轮次的缓存展示仅依据真实请求边界，不应用期望命中率', () => {
  for (const rate of [0, .37, 1]) {
    const session = makeSession({ expectedPrefixCacheHitRate: rate });
    const report = structuredClone(buildReport(session));
    const engineRequests = session.getConsumptionTokens().llms;
    report.requests.forEach((request, index) => {
      const groups = requestInputTurns(report, request);
      const actions = groups.flatMap(group => requestInputActions(report, request, group));
      const input = engineRequests[index].input.turns.flatMap(turn => turn.actions);
      assert.deepEqual(actions.map(action => action.id), input.filter(action => action.type !== 'llm').map(action => action.actionIndex));
      assert.ok(!actions.some(action => action.id === engineRequests[index].output.actionIndex));
      close(groups.reduce((sum, group) => sum + group.hit, 0), request.prefix);
      close(groups.reduce((sum, group) => sum + group.miss, 0), request.input - request.prefix);
      close(actions.reduce((sum, action) => sum + action.hit, 0), request.prefix);
      close(actions.reduce((sum, action) => sum + action.miss, 0), request.input - request.prefix);
      for (const action of actions) {
        const position = input.findIndex(item => item.actionIndex === action.id);
        close(action.hit, position < engineRequests[index].notCachedIndex ? input[position].token : 0);
        close(action.hit + action.miss, action.token);
      }
    });
  }
});

test('压缩后移除被替换的 Turn，保留摘要、保留轮次和历史请求的独立状态', () => {
  const report = buildReport(makeSession());
  const first = report.requests[0];
  assert.deepEqual(requestInputTurns(report, first).map(group => group.label), ['初始上下文', 'Turn 1']);
  const after = report.requests.find(request => request.round === 11);
  const groups = requestInputTurns(report, after);
  assert.deepEqual(groups.map(group => group.label), ['初始上下文', 'Turn 9', 'Turn 10', '压缩上下文 1', 'Turn 11']);
  const summary = groups.find(group => group.kind === 'compression');
  const [action] = requestInputActions(report, after, summary);
  assert.equal(action.label, '压缩上下文 1');
  assert.equal(action.summary, true);
  const compressionRequest = report.requests.find(request => request.compression);
  assert.ok(!requestInputTurns(report, compressionRequest).some(group => group.kind === 'compression'));
  assert.deepEqual(requestInputTurns(report, first).map(group => group.label), ['初始上下文', 'Turn 1']);
  assert.equal(report.requestTrace.contexts.length, report.rounds.length);
});

test('0%、37%、100% 期望命中率的请求明细相同，计费记录保持原值', () => {
  const reports = [0, .37, 1].map(expectedPrefixCacheHitRate => buildReport(makeSession({ expectedPrefixCacheHitRate })));
  const views = reports.map(report => {
    const before = structuredClone(report);
    const turns = requestRounds(report);
    const view = turns.map(turn => ({
      id: turn.id, hit: turn.hit, miss: turn.miss, state: turn.state,
      models: turn.models.map(model => {
        const groups = requestInputTurns(report, model);
        const actions = groups.flatMap(group => requestInputActions(report, model, group));
        assert.ok(actions.every(action => action.state !== 'partial'));
        close(actions.reduce((sum, action) => sum + action.hit, 0), model.hit);
        close(actions.reduce((sum, action) => sum + action.miss, 0), model.miss);
        return { id: model.id, hit: model.hit, miss: model.miss, state: model.state, groups, actions };
      }),
    }));
    assert.deepEqual(report, before);
    return view;
  });
  assert.deepEqual(views[0], views[1]);
  assert.deepEqual(views[1], views[2]);
  assert.equal(reports[0].requests[0].hit, 0);
  assert.ok(views[0][0].models[0].hit > 0);
  assert.ok(reports[0].cost.total > reports[2].cost.total);
});

test('自定义流程的空输入、连续模型调用、零 Token 摘要不丢失动作', () => {
  const session = makeSession({
    turnTotalCount: 4, compressionThresholdTurnCount: 2, compressionKeepTurns: 0, compressionTargetToken: 0,
    flow: { initial: [], turn: [{ type: 'llm', text: 'first', token: 0 }, { type: 'llm', text: 'next', token: 1 }] },
  });
  const report = buildReport(session);
  for (const request of report.requests) {
    const groups = requestInputTurns(report, request);
    const actions = groups.flatMap(group => requestInputActions(report, request, group));
    close(actions.reduce((sum, action) => sum + action.token, 0), request.input);
  }
  const first = report.requests[0];
  assert.equal(requestInputActions(report, first, requestInputTurns(report, first).at(-1)).length, 0);
  assert.ok(report.requestTrace.turns.flatMap(turn => turn.actions).some(action => action.summary && action.token === 0));
  assert.equal(cacheState(0, 0), 'empty');
  assert.equal(cacheState(1, 0), 'hit');
  assert.equal(cacheState(0, 1), 'miss');
  assert.equal(cacheState(.9, .1), 'partial');
});

test('虚拟列表的偏移定位支持变高行、边界和空列表', () => {
  const offsets = [0, 100, 450, 500];
  assert.equal(offsetIndex(offsets, 0), 0);
  assert.equal(offsetIndex(offsets, 99), 0);
  assert.equal(offsetIndex(offsets, 100), 1);
  assert.equal(offsetIndex(offsets, 449), 1);
  assert.equal(offsetIndex(offsets, 500), 2);
  assert.equal(offsetIndex([0], 0), 0);
});

test('Turn 展开为实际 LLM 调用，当前轮不提前显示尚未发生的调用', () => {
  const report = buildReport(makeSession());
  const index = indexTurnRequests(report);
  const first = report.requests[0];
  const firstGroups = requestInputTurns(report, first);
  assert.deepEqual(requestTurnLlms(first, firstGroups.find(group => group.kind === 'initial'), index, report), []);
  const firstModels = requestTurnLlms(first, firstGroups.find(group => group.kind === 'user'), index, report);
  assert.deepEqual(firstModels.map(model => model.id), [first.id]);
  assert.equal(firstModels[0].label, 'LLM1');
  const nextRound = report.requests.find(request => request.round === 2);
  const historical = requestInputTurns(report, nextRound).find(group => group.label === 'Turn 1');
  const models = requestTurnLlms(nextRound, historical, index, report);
  assert.deepEqual(models.map(model => model.label), ['LLM1', 'LLM2', 'LLM3', 'LLM4']);
  assert.deepEqual(models.map(model => model.id), report.rounds[0].requestIds);
  for (const model of models) {
    const actions = modelInputActions(report, model);
    close(actions.reduce((sum, action) => sum + action.hit, 0), model.hit);
    close(actions.reduce((sum, action) => sum + action.miss, 0), model.miss);
    assert.ok(actions.every(action => action.turnLabel));
    assert.equal(model.state, cacheState(model.hit, model.miss));
  }
});

test('压缩调用与所属用户轮次的普通调用分开，LLM 输入保留摘要且排除自身输出', () => {
  const report = buildReport(makeSession());
  const index = indexTurnRequests(report);
  const after = report.requests.find(request => request.round === 11);
  const groups = requestInputTurns(report, after);
  const compressionGroup = groups.find(group => group.kind === 'compression');
  const compressionModels = requestTurnLlms(after, compressionGroup, index, report);
  assert.equal(compressionModels.length, 1);
  assert.equal(compressionModels[0].compression, true);
  assert.equal(compressionModels[0].label, 'LLM1');
  const ordinaryTurn = groups.find(group => group.label === 'Turn 10');
  assert.ok(requestTurnLlms(after, ordinaryTurn, index, report).every(model => !model.compression));
  const userGroup = groups.find(group => group.label === 'Turn 11');
  const [current] = requestTurnLlms(after, userGroup, index, report);
  const actions = modelInputActions(report, current);
  assert.ok(actions.some(action => action.summary && action.label === '压缩上下文 1'));
  close(actions.reduce((sum, action) => sum + action.token, 0), current.input);
  const engine = makeSession().getConsumptionTokens().llms[current.id - 1];
  assert.ok(!actions.some(action => action.id === engine.output.actionIndex));
});

test('第一层每个 Turn 仅有一项，LLM 和压缩调用归入所属轮次且只出现一次', () => {
  const report = buildReport(makeSession());
  const turns = requestRounds(report);
  assert.equal(turns.length, report.rounds.length);
  assert.equal(new Set(turns.map(turn => turn.id)).size, turns.length);
  assert.deepEqual(turns.flatMap(turn => turn.models.map(model => model.id)), report.requests.map(request => request.id));
  for (const turn of turns) {
    assert.ok(turn.models.every(model => model.round === turn.id));
    assert.deepEqual(turn.models.map(model => model.label), turn.models.map((_, index) => `LLM${index + 1}`));
    close(turn.input, turn.models.reduce((sum, model) => sum + model.input, 0));
    close(turn.hit, turn.models.reduce((sum, model) => sum + model.hit, 0));
    close(turn.miss, turn.models.reduce((sum, model) => sum + model.miss, 0));
  }
  assert.equal(turns[0].models.length, 4);
  assert.equal(turns[9].models.length, 5);
  assert.equal(turns[9].models.at(-1).compression, true);
  assert.equal(turns[9].models.at(-1).label, 'LLM5');
});

test('没有模型调用的轮次仍在第一层列表中，零 Token 不伪造缓存命中', () => {
  const report = buildReport(makeSession({ turnTotalCount: 3, flow: { initial: [], turn: [] } }));
  const turns = requestRounds(report);
  assert.deepEqual(turns.map(turn => turn.id), [1, 2, 3]);
  assert.ok(turns.every(turn => turn.models.length === 0 && turn.state === 'empty' && turn.input === 0));
});

test('每轮默认展开最后一次 LLM，包括末尾压缩调用；显式收起只关闭 LLM', () => {
  const report = buildReport(makeSession());
  const turns = requestRounds(report), selections = new Map();
  assert.equal(selectedRoundModel(turns[0], selections).label, 'LLM4');
  assert.equal(selectedRoundModel(turns[9], selections).compression, true);
  selections.set(1, null);
  selections.set(2, turns[1].models[0].id);
  const items = requestDetailItems(report, turns, selections, 6);
  assert.deepEqual(items.filter(item => item.type === 'turn').map(item => item.turn.id), turns.map(turn => turn.id));
  assert.equal(items.find(item => item.turn.id === 1).model, null);
  assert.ok(items.filter(item => item.turn.id === 1).every(item => item.type === 'turn'));
  assert.equal(items.find(item => item.turn.id === 2).model.id, turns[1].models[0].id);
});

test('动作按来源 Turn 分行虚拟化，窄屏换列保持输入顺序、归属和缓存金额不变', () => {
  const session = makeSession(), report = buildReport(session), turns = requestRounds(report);
  const engine = session.getConsumptionTokens().llms;
  for (const columns of [1, 4, 6]) {
    const items = requestDetailItems(report, turns, new Map(), columns);
    assert.equal(new Set(items.map(item => item.key)).size, items.length);
    for (const turn of turns) {
      const rows = items.filter(item => item.turn.id === turn.id && item.type === 'actions');
      const model = turn.models.at(-1);
      const actions = rows.flatMap(row => {
        assert.ok(row.end - row.start <= columns);
        assert.equal(row.group.round, report.requestTrace.turns[row.group.id].round);
        return requestInputActions(report, model, row.group).slice(row.start, row.end);
      });
      const expected = engine[model.id - 1].input.turns.flatMap(source => source.actions).filter(action => action.type !== 'llm');
      assert.deepEqual(actions.map(action => action.id), expected.map(action => action.actionIndex));
      close(actions.reduce((sum, action) => sum + action.hit, 0), model.hit);
      close(actions.reduce((sum, action) => sum + action.miss, 0), model.miss);
      assert.equal(rows.filter(row => row.last).length, 1);
    }
  }
});

test('没有调用和空输入均保留轮次，零长度摘要仍作为输入动作显示', () => {
  const emptyReport = buildReport(makeSession({ turnTotalCount: 3, flow: { initial: [], turn: [] } }));
  const noCalls = requestDetailItems(emptyReport, requestRounds(emptyReport), new Map(), 6);
  assert.equal(noCalls.length, 3);
  assert.ok(noCalls.every(item => item.type === 'turn' && item.model === null));
  const report = buildReport(makeSession({
    turnTotalCount: 3, compressionThresholdTurnCount: 2, compressionKeepTurns: 0, compressionTargetToken: 0,
    flow: { initial: [], turn: [{ type: 'llm', text: 'empty', token: 0 }] },
  }));
  const items = requestDetailItems(report, requestRounds(report), new Map(), 1);
  assert.ok(items.some(item => item.type === 'empty'));
  const summaryRows = items.filter(item => item.type === 'actions' && item.group.kind === 'compression');
  assert.ok(summaryRows.length > 0);
  assert.ok(summaryRows.some(row => requestInputActions(report, row.model, row.group).some(action => action.summary && action.state === 'empty')));
});
