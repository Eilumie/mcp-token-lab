<div align="center">

# MCP Token Lab

**你的 Agent，你的上下文策略。**

在浏览器里模拟并对比 **MCP 工具加载、上下文增长、前缀缓存与上下文压缩** 对多轮 Agent 会话 Token 消耗及预估成本的影响。

[**在线体验**](https://zhanghongen.github.io/mcp-token-lab/) · [English README](../README.md)

<img src="screenshots/01-overview.webp" alt="MCP Token Lab 首页与操作流程" width="900" />

</div>

## 它能解决什么问题？

当 Agent 接入的工具越来越多、会话越来越长时，开发者需要判断：**全量加载工具 Schema，还是按需发现？缓存是否能抵消更大的上下文？压缩策略什么时候值得启用？**

MCP Token Lab 将这些问题变成一组可以修改、对比、复现的模拟实验，无需 API Key、后端或注册账号。

## 功能一览

### 01 · 全局参数与模型费率

设置会话轮数、工具和技能数量、前缀缓存预期命中率以及压缩触发条件。可以选择静态模型价格预设，也可以通过方案配置使用自定义费率。

![全局设置](screenshots/02-global-settings.webp)

**说明：** 选择模型仅用于估算费用，不会连接该模型。内置费率为静态快照，不能保证始终为当前报价。

### 02 · 最多八个方案对比

同时比较全量工具 Schema、渐进式 Schema 加载、工具搜索等模板策略。展示总费用、初始上下文、峰值请求输入、调用次数及模型化耗时，并支持自动或手动指定对比基准。

![方案对比](screenshots/03-compare-plans.webp)

**说明：** 图中的百分比只对当前参数和基准方案有效，不代表真实项目中可确保节省的比例。

### 03 · 可编辑执行流程

为每个方案设置初始上下文与逐轮流程。可配置上下文动作、LLM 请求、Token 计算表达式、自定义变量、步骤持续时间，以及固定间隔或确定性概率触发条件。

![流程编辑](screenshots/04-execution-flow.webp)

### 04 · 会话成本趋势

按多轮会话查看累计费用和单轮费用，观察不同策略的成本曲线如何变化，包括上下文反复使用和压缩触发带来的影响。

![会话趋势](screenshots/05-session-trend.webp)

### 05 · 成本来源拆解

通过堆叠图拆分工具 Schema、技能上下文、用户消息、工具结果、模型输出等组成部分，判断成本主要来自哪里。

![成本来源](screenshots/06-cost-breakdown.webp)

### 06 · 逐请求 Token 明细

展开每轮会话，检查单次 LLM 请求的上下文组成、缓存命中、缓存未命中及部分命中情况，追踪具体 Token 来源。

![请求明细](screenshots/07-request-details.webp)

### 07 · 模板、配置导入导出与中英文界面

内置六种 JSON 模板，可导入自定义模板、导出当前配置、恢复默认方案，也支持中英文切换。

<img src="screenshots/08-import-export-controls.webp" alt="模板和导出配置入口" width="460" />

**说明：** 此图展示操作入口，没有展示弹窗内容。当前方案配置保存在内存中，刷新前需要手动导出；语言偏好存储在本地。

## 内置策略模板

在方案对比区域点击 **「模板」**，选择模板并查看包含的方案，然后点击 **「使用模板」**。六个模板都可以在加载后继续修改参数和执行流程。使用模板会替换当前全局设置与方案，可撤销；需要另存当前设置时，请先导出配置。

| 内置模板 | 对比方案 | 适用场景 |
|---|---|---|
| [`progressive-tool-no-compress`](../src/config/default-template/progressive-tool-no-compress.json) **（启动默认）** | MCP Full tools/list · Hosted Tool Search · Progressive Tool Schema | 模拟 **25 轮、不压缩上下文**，直观比较不同工具 Schema 加载方式。 |
| [`progressive-tool-100k`](../src/config/default-template/progressive-tool-100k.json) | 同上三种工具加载策略 | 模拟 **100 轮、100K Token 压缩阈值**，观察上下文增长及压缩对费用的影响。 |
| [`progressive-tool-200k`](../src/config/default-template/progressive-tool-200k.json) | 同上三种工具加载策略 | 模拟 **100 轮、200K Token 压缩阈值**，对比更高压缩阈值的影响。 |
| [`tool-search`](../src/config/default-template/tool-search.json) | Full Schema · Regex Search · BM25 Search · Semantic Search（各 Top 5） | 对比全量预加载与不同工具搜索策略下的按需 Schema 加载。 |
| [`tool-namespace-hybrid`](../src/config/default-template/tool-namespace-hybrid.json) | Flat Tools · Namespace（12 组 × 10 工具）· Hybrid（5 个常驻 + Top 5） | 探索工具分组、定期发现与常用工具常驻的混合加载方案。 |
| [`tool-result-shaping`](../src/config/default-template/tool-result-shaping.json) | Raw Tool Result · Field Projection（每工具 1.5K）· Code Aggregation（每批约 1.5K） | 比较原始结果、字段精简与结果聚合对上下文和预估费用的影响。 |

所有模板均位于 [`src/config/default-template/`](../src/config/default-template/)，可作为自定义方案的起点。

## 本地运行

推荐 **Node.js 22.12+**（项目声明支持 Node 20.19+）以及 **pnpm 10.18.3**。

```bash
git clone https://github.com/zhangHongEn/mcp-token-lab.git
cd mcp-token-lab
npm install --global pnpm@10.18.3
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

按 Vite 终端输出的地址访问（通常为 `http://127.0.0.1:5173`）。修改有效参数后会自动重算，不需要执行真实 Agent。

```bash
pnpm test
pnpm build
pnpm preview --host 127.0.0.1
```

## 技术栈

- **前端：** Vue 3、Vite 7、Lucide Vue
- **图表：** Apache ECharts 6
- **模拟引擎：** JavaScript（`src/session.js`、`src/session-flow.js`）
- **计算：** Web Worker（`src/session.worker.js`）
- **场景模板：** `src/config/default-template/`

模拟过程在浏览器内完成。当前版本没有应用内账号体系或埋点收集器，编辑的配置默认不会跨刷新保存。

## 参与贡献

欢迎反馈问题、提供可复现配置和提交 PR。报告问题时请尽量附带配置 JSON、复现步骤、预期结果与实际结果。可以通过 [GitHub Issues](https://github.com/zhangHongEn/mcp-token-lab/issues) 讨论。

## 开源协议

[MIT](../LICENSE) © contributors.