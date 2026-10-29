<div align="center">

# MCP Token Lab

**Your agent. Your context strategy.**

An interactive playground for exploring how **MCP tool loading, context growth, prefix caching, and compression** change token usage and estimated LLM costs across multi-turn agent sessions.

[**Live demo**](https://zhanghongen.github.io/mcp-token-lab/) · [中文文档](docs/README.zh-CN.md)

<img src="docs/screenshots/01-overview.webp" alt="MCP Token Lab interface: choose a strategy, configure the simulation, compare results" width="900" />

</div>

## Why MCP Token Lab?

As an agent gains tools and takes more turns, its context can become expensive. Should you preload every tool schema, discover tools on demand, or selectively load schemas? How much could prefix caching help? When does context compression pay for itself?

MCP Token Lab makes those trade-offs **visible, configurable, and comparable** without an API key, backend, or cloud account. Change a parameter and see the model recalculate.

- **Compare strategies** — full tool-schema loading, progressive schema loading, tool-search and related scenario templates.
- **Tune the workload** — turns, tool/skill counts, token sizes, custom variables and per-plan overrides.
- **Inspect the mechanics** — initial context, per-turn steps, model requests, caching and compression.
- **Understand the bill** — total cost, token attribution, trend lines, peak input and request-level breakdowns.

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

Use the six built-in JSON templates, import a custom scenario, export a configuration for review, or restore the default plans. The interface supports English and Chinese.

<img src="docs/screenshots/08-import-export-controls.webp" alt="Controls for restoring plans, exporting configuration, opening templates and adding a plan" width="460" />

<sub>Screenshot shows the available controls, not an opened template dialog. Configuration edits and imported templates are kept in memory: export before refreshing the page. The language preference is stored locally.</sub>

## Built-in strategy templates

Open **Templates** in the plan toolbar, select a template, review its plans, then click **Use template**. Each template provides editable settings and workflows. Applying one replaces the current settings and plans; you can undo that change or export your configuration first.

| Template | Strategies compared | What to explore |
|---|---|---|
| [`progressive-tool-no-compress`](src/config/default-template/progressive-tool-no-compress.json) **(startup default)** | MCP Full tools/list · Hosted Tool Search · Progressive Tool Schema | Compare schema-loading approaches over 25 turns without compression. |
| [`progressive-tool-100k`](src/config/default-template/progressive-tool-100k.json) | Same three loading strategies | Explore how a **100K-token** compression threshold affects context growth and cost over 100 turns. |
| [`progressive-tool-200k`](src/config/default-template/progressive-tool-200k.json) | Same three loading strategies | Contrast a higher **200K-token** compression threshold over 100 turns. |
| [`tool-search`](src/config/default-template/tool-search.json) | Full Schema · Regex Search · BM25 Search · Semantic Search (Top 5 each) | Compare full preload with modeled Top-5 discovery and selective schema loading. |
| [`tool-namespace-hybrid`](src/config/default-template/tool-namespace-hybrid.json) | Flat Tools · Namespace (12 groups × 10 tools) · Hybrid (5 pinned + Top 5) | Explore namespace grouping, periodic discovery, and keeping frequently used tool schemas loaded. |
| [`tool-result-shaping`](src/config/default-template/tool-result-shaping.json) | Raw Tool Result · Field Projection (1.5K/tool) · Code Aggregation (~1.5K/batch) | Compare how trimming or aggregating tool results changes context size and estimated cost. |

All six templates are stored as JSON files in [`src/config/default-template/`](src/config/default-template/) and can be customized in the interface.

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

```

The production build is generated in `dist/` and can be served as static files.

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