// Display cache membership using only the engine's recorded notCachedIndex
// boundary (cacheBoundary), including model-call marker positions. Expected
// cache hit rates remain a billing concern and do not affect this view.
export function cacheState(hit, miss) {
  if (hit === 0 && miss === 0) return "empty";
  if (hit === 0) return "miss";
  if (miss === 0) return "hit";
  return "partial";
}

export function requestInputTurns(report, request) {
  const trace = report?.requestTrace;
  const ids = trace?.contexts[request?.contextId];
  if (!ids) return [];
  let offset = 0;
  return ids.map((id, index) => {
    const turn = trace.turns[id];
    const limit = index === ids.length - 1 ? request.inputEnd : turn.actionCount;
    let hit = 0, miss = 0, actionCount = 0;
    for (const action of turn.actions) {
      if (action.position >= limit) break;
      const cached = offset + action.position < request.cacheBoundary ? action.token : 0;
      hit += cached;
      miss += action.token - cached;
      actionCount++;
    }
    const group = { id, label: turn.label, kind: turn.kind, round: turn.round, hit, miss, actionCount, limit, offset, state: cacheState(hit, miss) };
    offset += limit;
    return group;
  });
}

export function requestInputActions(report, request, group) {
  if (!group) return [];
  const trace = report.requestTrace;
  return trace.turns[group.id].actions.filter(action => action.position < group.limit).map(action => {
    const hit = group.offset + action.position < request.cacheBoundary ? action.token : 0;
    const miss = action.token - hit;
    return { ...action, hit, miss, state: cacheState(hit, miss) };
  });
}

export function indexTurnRequests(report) {
  const index = new Map();
  for (const request of report?.requests ?? []) {
    if (!index.has(request.turnId)) index.set(request.turnId, []);
    index.get(request.turnId).push(request);
  }
  return index;
}

function requestCacheView(report, request) {
  // Sum the boundary-classified input directly, rather than reusing weighted
  // billing totals (even their floating-point sums can vary with the hit rate).
  const groups = requestInputTurns(report, request);
  const hit = groups.reduce((sum, group) => sum + group.hit, 0);
  const miss = groups.reduce((sum, group) => sum + group.miss, 0);
  return { ...request, hit, miss, input: hit + miss, state: cacheState(hit, miss) };
}

// A history turn may contain several calls. Include only calls that have
// happened by the outer request, including the outer call itself.
export function requestTurnLlms(outerRequest, group, index, report) {
  if (!group) return [];
  return (index.get(group.id) ?? []).filter(request => request.id <= outerRequest.id).map((request, ordinal) => ({
    ...requestCacheView(report, request), label: `LLM${ordinal + 1}`,
  }));
}

export function modelInputActions(report, request) {
  return requestInputTurns(report, request).flatMap(group => requestInputActions(report, request, group).map(action => ({
    ...action, turnLabel: group.label,
  })));
}

export function requestRounds(report) {
  const requests = new Map((report?.requests ?? []).map(request => [request.id, request]));
  return (report?.rounds ?? []).map(round => {
    const models = round.requestIds.map(id => requests.get(id)).filter(Boolean).map((request, index) => ({
      ...requestCacheView(report, request), label: `LLM${index + 1}`,
    }));
    const hit = models.reduce((sum, model) => sum + model.hit, 0);
    const miss = models.reduce((sum, model) => sum + model.miss, 0);
    return { id: round.round, models, hit, miss, input: hit + miss, state: cacheState(hit, miss) };
  });
}

// Missing selections open the final call, while an explicit null keeps it closed.
export function selectedRoundModel(turn, selections) {
  if (!selections.has(turn.id)) return turn.models.at(-1) ?? null;
  return turn.models.find(model => model.id === selections.get(turn.id)) ?? null;
}

// Virtualize action rows as well as round headers: a long input must not mount
// every historical action just because its model call is expanded.
export function requestDetailItems(report, turns, selections, columns) {
  const items = [], width = Math.max(1, Math.floor(columns) || 1);
  for (const turn of turns) {
    const model = selectedRoundModel(turn, selections);
    items.push({ key: `turn-${turn.id}`, type: 'turn', turn, model });
    if (!model) continue;
    let count = 0;
    const groups = requestInputTurns(report, model).filter(group => group.actionCount > 0);
    for (const [index, group] of groups.entries()) {
      for (let start = 0; start < group.actionCount; start += width) {
        items.push({
          key: `model-${model.id}-source-${group.id}-${start}`, type: 'actions', turn, model, group,
          start, end: Math.min(start + width, group.actionCount),
          last: index === groups.length - 1 && start + width >= group.actionCount,
        });
        count++;
      }
    }
    if (!count) items.push({ key: `model-${model.id}-empty`, type: 'empty', turn, model });
  }
  return items;
}

export function offsetIndex(offsets, position) {
  let low = 0, high = offsets.length - 1;
  while (low < high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle + 1] <= position) low = middle + 1;
    else high = middle;
  }
  return Math.min(low, Math.max(0, offsets.length - 2));
}
