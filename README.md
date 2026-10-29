<div align="center">

# MCP Token Lab

**Your agent. Your context strategy.**

An interactive playground for exploring how **MCP tool loading, context growth, prefix caching, and compression** change token usage and estimated LLM costs across multi-turn agent sessions.

[**Live demo**](https://zhanghongen.github.io/mcp-token-lab/) · [中文文档](docs/README.zh-CN.md) · [Reproducible experiment](docs/examples/README.md) · [Simulation model](docs/simulation-model.md)

<img src="docs/screenshots/01-overview.webp" alt="MCP Token Lab interface: choose a strategy, configure the simulation, compare results" width="900" />

</div>

## Why MCP Token Lab?

As an agent gains tools and takes more turns, its context can become expensive. Should you preload every tool schema, discover tools on demand, or selectively load schemas? How much could prefix caching help? When does context compression pay for itself?

MCP Token Lab makes those trade-offs **visible, configurable, and comparable** without an API key, backend, or cloud account. Change a parameter and see the model recalculate.

- **Compare strategies** — full tool-schema loading, progressive schema loading, tool-search and related scenario templates.
- **Tune the workload** — turns, tool/skill counts, token sizes, custom variables and per-plan overrides.
- **Inspect the mechanics** — initial context, per-turn steps, model requests, caching and compression.
- **Understand the bill** — total cost, token attribution, trend lines, peak input and request-level breakdowns.
- **Reproduce the experiment** — import/export configurations and verify a committed fixture against the simulation engine.

## Feature tour

### 01 · Configure the workload

Set the model **pricing preset** and shared assumptions, including user turns, tool and skill counts, expected prefix-cache hit rate, and compression trigger. Override inherited values in individual plans when you need a controlled comparison.

<img src="docs/screenshots/02-global-settings.webp" alt="Global settings for model rates, turns, tools, cache hit rate and compression" width="900" />

<sub>Model selection controls accounting rates; it does not establish a live connection to that model. Built-in rates are static snapshots and may be outdated.</sub>

### 02 · Compare up to eight plans

Start from built-in strategy templates, add or duplicate plans, choose a baseline, and compare total estimated session cost, initial context, peak request input, call count and modeled timing. The automatic baseline is the highest-cost plan, and you can choose a manual baseline instead.

<img src="docs/screenshots/03-compare-plans.webp" alt="Comparison of full tool schemas, hosted tool search, and progressive schema loading" width="900" />

<sub>The displayed percentages are relative to the selected baseline for that particular scenario—not universal savings claims.</sub>

### 03 · Build an execution flow

Inspect and edit the **initial context** and **per-user-turn flow**. Add context actions or model requests, set token expressions and durations, define custom variables, disable steps, and use deterministic interval or probability triggers. Model schema discovery, tool results and agent responses as explicit steps.

<img src="docs/screenshots/04-execution-flow.webp" alt="Plan details with initial context, per-turn execution steps, and estimated token costs" width="900" />

### 04 · Track cost across turns

Switch between **cumulative** and **per-turn** estimated cost to see how strategies diverge over the simulated conversation. Useful for spotting nonlinear effects of repeated context consumption and compression events.

<img src="docs/screenshots/05-session-trend.webp" alt="Session cost trend chart comparing three simulated strategies" width="900" />

### 05 · Attribute the cost

Compare stacked cost breakdowns by context source and workflow step. See whether the modeled spend comes from tool schemas, skill content, user messages, tool results, model responses or other inputs.

<img src="docs/screenshots/06-cost-breakdown.webp" alt="Stacked cost breakdown across strategies and token sources" width="900" />

### 06 · Inspect individual requests

Open a user turn to explore modeled LLM calls and their input composition. Distinguish **cache-hit**, **cache-miss** and **partial-hit** portions, and inspect which context actions contributed to a request.

<img src="docs/screenshots/07-request-details.webp" alt="Per-turn model requests and token accounting details" width="900" />

### 07 · Reuse templates and exchange configurations

Use the five built-in JSON templates, import a custom scenario, export a configuration for review, or restore the default plans. The interface supports English and Chinese.

<img src="docs/screenshots/08-import-export-controls.webp" alt="Controls for restoring plans, exporting configuration, opening templates and adding a plan" width="460" />

<sub>Screenshot shows the available controls, not an opened template dialog. Configuration edits and imported templates are kept in memory: export before refreshing the page. The language preference is stored locally.</sub>

## Try a reproducible comparison

The repository includes a fixture comparing **full tool-schema loading** with **progressive loading**, using 100 simulated turns, 100 tools, 30 skills, a 90% expected prefix-cache hit rate and a 100K context compression threshold. The fixture uses **synthetic** USD-per-million-token rates, not a provider quote.

| Fixture result | Progressive loading | Full schemas |
|---|---:|---:|
| Initial context | 8.3K | 59.3K |
| Cumulative input, cached + fresh | 26,497.64K | 29,339.50K |
| Model requests (including compression) | 409 | 324 |
| Compression events | 9 | 24 |
| Estimated total | **$13.115365** | **$14.866832** |

**The outcome depends on the assumptions.** In the same fixture, changing only the tool count from 100 to 10 reverses the cost ranking: full schemas become cheaper. The strategies also have different numbers of modeled requests; no equal-quality conclusion follows.


## Quick start

**Requirements:** Node.js **22.12+ recommended** (Node 20.19+ is declared supported) and **pnpm 10.18.3**. No API key, environment file or backend is needed.

```bash
git clone https://github.com/zhangHongEn/mcp-token-lab.git
cd mcp-token-lab
npm install --global pnpm@10.18.3
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

Open the address printed by Vite (normally `http://127.0.0.1:5173`). The app loads a built-in template and automatically recalculates after valid edits. There is no agent execution button.

```bash
pnpm test
pnpm build
pnpm preview --host 127.0.0.1

# Verify the committed experiment against the engine
node scripts/reproduce-example.mjs --check
```

The production build is generated in `dist/` and can be served as static files.

## How the accounting works

Each scenario defines initial context plus a sequence of context actions and model-request steps per turn. A deterministic engine accounts for token additions, repeated request inputs, expected prefix-cache matches, output tokens and optional compression requests. Cost is calculated from configured rates:

```text
request cost (USD) =
  (cached input K × cached rate
 + fresh input K × fresh rate
 + output K × output rate) / 1000
```

- **Units:** `1K = 1,000 tokens`; pricing rates are in **USD per 1M tokens**.
- **Caching:** Expected cache reuse is a fractional accounting assumption, not an observed provider cache hit.
- **Compression:** Evaluated after a completed user turn; it adds another modeled request and can exceed the threshold before triggering.
- **Timing:** Durations are configured step estimates. The UI's **Avg. TTFT per turn** currently represents aggregate modeled step duration, **not measured time to first token**.
- **Limits:** No real tokenization, production traces, model execution, tool success scoring, provider window enforcement, automatic rate-tier transitions or billing reconciliation.

Read [Simulation model, assumptions and limits](docs/simulation-model.md) before interpreting the numbers as engineering evidence.

## Under the hood

| Layer | Implementation |
|---|---|
| Interface | Vue 3, Vite 7, Lucide Vue |
| Charts | Apache ECharts 6 |
| Simulation engine | JavaScript modules (`src/session.js`, `src/session-flow.js`) |
| Aggregation and reporting | `src/session-report.js`, `src/comparison.js` |
| Background computation | Web Worker (`src/session.worker.js`) |
| Scenario templates | `src/config/default-template/` |

The simulation runs locally in your browser. Current configuration is not persisted between reloads; export it if needed. There is no application account system or analytics collector in the current source.

## Contributing

Issues, bug reports, reproducible scenario files and pull requests are welcome. Include the exported configuration, steps to reproduce, and expected versus actual results. Discuss contributions in [GitHub Issues](https://github.com/zhangHongEn/mcp-token-lab/issues).

## License

[MIT](LICENSE) © contributors.

---

<div align="center">
  <a href="https://zhanghongen.github.io/mcp-token-lab/">Explore the simulator</a> ·
  <a href="https://github.com/zhangHongEn/mcp-token-lab/issues">Report an issue</a>
</div>