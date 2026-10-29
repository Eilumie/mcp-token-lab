# Simulation model, assumptions and limits

Audited against the working tree based on `03ce7da`, 2026-10-29. Implementation references are repository paths below; the reproduction output records SHA-256 hashes of the accounting files and full fixture.

## What is simulated

`src/session.js` is a deterministic token ledger. A plan is a list of initial-context actions and per-user-turn steps. An `action` appends a configured number of tokens; an `llm` step takes a context snapshot and appends a configured output. Neither step executes external code or calls a model/tool. A model preset supplies prices only.

`src/comparison.js` resolves global values only for fields whose plan inheritance is enabled. Custom variables can also be inherited or overridden. `src/App.vue` validates changes and recalculates through a Web Worker after a short debounce. Invalid settings clear results. The UI accepts up to eight plans and 1–1,000 user turns. Low-level `Session` accepts zero turns, but that is not a normal UI experiment.

## Units and costs

All token quantities in configurations and reports are in **K**, where 1K = 1,000 tokens. A value of `toolSchemaToken: 0.51` means 510 tokens. Prices are USD per **1M** tokens. Do not pass raw token counts into a field expecting K.

For one request, with cached input H, fresh input M and output O in K:

```text
inputK = H + M
costUSD = (H × cachedRate + M × freshRate + O × outputRate) / 1000
sessionCostUSD = sum(request costs, including compression)
```

For example, 2K cached input, 3K fresh input and 1K output at the example rates 0.2 / 2 / 8 give `(2×0.2 + 3×2 + 1×8)/1000 = $0.0144`.

`src/session-report.js` aggregates each request into its user round and source attribution. Compression requests belong to the user turn that triggered them. `round.cumulativeTokens` includes **input plus output**; it must not be relabeled “cumulative input”. The design/example chart instead sums `request.input` for each round's `requestIds`. Cached input still counts in input volume even though it has a different price.

## Prefix-cache model

`matchCached` in `src/session.js` compares action references against the previous visible request's input prefix. For matched content:

```text
expected cached tokens = prefix tokens × expectedPrefixCacheHitRate
expected fresh tokens = remaining prefix tokens + newly appended tokens
```

This is fractional accounting, not random cache sampling. The first request treats the initial context as prefix-eligible, so a 90% setting assumes a warm initial prefix. Set the rate to zero to model all-uncached input; a realistic cold-first/warm-later cache policy would require a model extension.

The engine does not model provider cache block sizes, minimum token thresholds, TTLs, eviction, routing, storage fees, cache writes, regional billing or cache-dependent latency. A previous request that falls outside retained context may change the next prefix match. Expected prefix hit rate is not the same as the aggregate hit fraction across all input.

## Compression model

After all steps in each user turn, the engine checks either total visible content size (`TOKEN`, >= threshold) or active user-turn count (`TURN`, >= threshold). It does not check before each request. As a result, requests may exceed a configured threshold or a provider context window before compression occurs.

Compression requires at least one eligible old user turn beyond `compressionKeepTurns`. It uses the pre-compression snapshot as input and emits a fixed `compressionTargetToken` summary. Initial context remains; recent user turns remain; older eligible turns and superseded summaries are excluded from later snapshots. The summary becomes future context. The compression request and output are charged, including one triggered after the final user turn. This model does not measure summary quality or recoverability of dropped information.

The reported average turns per compression is **total user turns / compression count**, not the mean distance between successive events. With no compression it is null.

## Flows, fractional workloads and timing

The default progressive flow has four model requests per turn (skill planning, schema planning, tool planning and final response). The preloaded flow adds all tool schemas to initial context and removes schema planning/loading, leaving three model requests. Therefore the example compares two complete strategy assumptions, not a controlled experiment with identical request counts.

Averages such as 1.5 tools and 0.33 skills per turn scale token amounts. They are not sampled integer tool invocations. Progressive schemas are appended each turn; there is no real per-tool identity, deduplicating schema cache or actual discovery service. Full schemas also retain the tool index in this example, making that overhead explicit rather than assuming it disappears.

Step formulas use supported expressions evaluated by `src/token-formula.js`; runtime indices are zero-based `turnIndex` and `llmIndex`. Interval triggers run on turn index 0 and then every N turns. Probability triggers use a fixed hash of user-turn and step index, producing reproducible draws; moving a step can change its draws. This is not a distribution of many real runs, and there are no confidence intervals.

Durations are additive: absent an override, an LLM step contributes 1.8 seconds and an action 0.3 seconds. Compression adds a default LLM duration. The average sums turn durations and divides by user-turn count. It does not infer latency from token count or model identity, model parallel scheduling, or measure time to first token. The existing “TTFT” label should be read with this limitation; renaming it is a separate proposed UI improvement.

## Pricing snapshots

`src/model-pricing.js` holds static preset data and source links, including fixed, manually selected tier, and time-period variants. Neither prices nor the stored CNY/USD conversion factor update online. Selecting a tier/period fixes rates across the simulated session; no automatic threshold/time crossing occurs. Metadata about context windows and tiers does not enforce execution limits.

This documentation does not certify provider names, availability or rates in that catalog as current. Before a provider-specific cost claim, verify its official pricing page, billing region, currency, date, tier boundaries, cache billing and omitted fees; record the source beside the experiment. Do not infer validity from a stored `verified_at` field. The committed publication experiment uses synthetic rates instead, so it remains reproducible when market prices change.

A known preset ID on an imported configuration resolves to the current local catalog when inherited. For a frozen publication experiment, use `globalModelId: "custom"` with full `globalModel.model` and `globalModel.pricing`, as in the example, or disable model inheritance and supply explicit per-plan rates.

## Interpretation and scope

Results are conditional accounting estimates. They do not demonstrate answer quality, success rate, a faster model, protocol compliance, universal savings, actual agent execution or real billing accuracy. More tools can change compression frequency; even cumulative input need not vary monotonically with a single parameter. A favorable result may come with more modeled requests or worse unmeasured quality.

The [versioned MCP tools specification](https://modelcontextprotocol.io/specification/2025-06-18/server/tools) describes `tools/list` discovery and `tools/call` invocation. It does not establish the project's preloaded flow as the only client implementation. Use **Full schemas** / **Full tool-schema loading** in outward-facing copy; the current built-in label “MCP默认全量tools/list” is an implementation/template label, not evidence of a universal MCP default. Source checked 2026-10-29.

## Reproducibility contract

Keep the complete JSON configuration, actual engine version/hashes, all token units and rates, baseline selection and full results with any claim. The [example](examples/README.md) provides these, plus a negative case in which the preferred strategy reverses. A config export preserves inputs, not a frozen HTML report, shared URL or provider trace. Current configurations and imported templates are not persisted across refreshes.
