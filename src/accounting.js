export const sources = [
  "Agent Prompt",
  "用户消息",
  "Tools List",
  "Tools Schema",
  "Skills List",
  "Skills 内容",
  "Tools Result",
  "读取技能计划",
  "查询 Schema 计划",
  "调用工具计划",
  "Agent 最终回复",
];
export const fees = (hit, miss, output, rate) => {
  const cached = (hit / 1e6) * rate.hit;
  const fresh = (miss / 1e6) * rate.miss;
  const generated = (output / 1e6) * rate.output;
  return { cached, fresh, generated, total: cached + fresh + generated };
};
export const ratio = (a, b) => (b === 0 ? null : a / b);

// 仅按来源保存固定长度累计量，不复制整个会话历史。
export function createLedger(initial) {
  const submitted = Object.fromEntries(
    sources.map((s) => [s, initial[s] || 0]),
  );
  const pending = Object.fromEntries(sources.map((s) => [s, 0]));
  const totals = Object.fromEntries(
    sources.map((s) => [
      s,
      { source: s, first: submitted[s], hit: 0, miss: 0, output: 0 },
    ]),
  );
  return {
    append(source, tokens) {
      pending[source] += tokens;
      totals[source].first += tokens;
    },
    request(outputSource, output, cold) {
      const attribution = sources.map((source) => {
        const hit = cold ? 0 : submitted[source];
        const miss = pending[source] + (cold ? submitted[source] : 0);
        const generated = source === outputSource ? output : 0;
        totals[source].hit += hit;
        totals[source].miss += miss;
        totals[source].output += generated;
        submitted[source] += pending[source];
        pending[source] = 0;
        return { source, hit, miss, output: generated };
      });
      return attribution;
    },
    totals,
  };
}
export function summarize(result, rate) {
  const { total_in_cache, total_in_new, total_out } = result;
  result.cost = fees(total_in_cache, total_in_new, total_out, rate);
  result.input_tokens = total_in_cache + total_in_new;
  result.hitRate = ratio(total_in_cache, result.input_tokens);
  // 费用等值：缓存命中单价 / 未命中单价，与 Token 命中率不同。
  result.cachePriceRatio = ratio(rate.hit, rate.miss);
  result.equivalent =
    result.cachePriceRatio === null
      ? null
      : total_in_cache * result.cachePriceRatio;
  result.sources = Object.values(result.ledger.totals).map((s) => ({
    ...s,
    cost: fees(s.hit, s.miss, s.output, rate),
  }));
  let cumulative = 0;
  result.rounds = [];
  for (const request of result.requests) {
    request.cost = fees(request.in_cache, request.in_new, request.out, rate);
    cumulative += request.cost.total;
    request.cumulativeCost = cumulative;
    let round = result.rounds[request.round - 1];
    if (!round) {
      round = { round: request.round, cost: 0, tokens: 0 };
      result.rounds.push(round);
    }
    round.cost += request.cost.total;
    round.cumulativeCost = cumulative;
    round.context = request.context_after;
    round.tokens =
      request.total_in_cache + request.total_in_new + request.total_out;
  }
  delete result.ledger;
  return result;
}
