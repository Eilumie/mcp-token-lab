<div align="center">

# MCP Token Lab

**你的 Agent，你的上下文策略。**

在浏览器里模拟并对比 **MCP 工具加载、上下文增长、前缀缓存与上下文压缩** 对多轮 Agent 会话 Token 消耗及预估成本的影响。

[**在线体验**](https://zhanghongen.github.io/mcp-token-lab/) · [English README](../README.md)

</div>

## 它能解决什么问题？

当 Agent 接入的工具越来越多、会话越来越长时，开发者需要判断：**全量加载工具 Schema，还是按需发现？缓存是否能抵消更大的上下文？压缩策略什么时候值得启用？**

MCP Token Lab 将这些问题变成一组可以修改、对比、复现的模拟实验，无需 API Key、后端或注册账号。

## 功能一览

### 01 · 全局设置与多方案对比

在 **全局设置** 中配置模型费率、会话轮数、Skills 与 Tools 数量、预期前缀缓存命中率及压缩阈值。最多同时对比 **8 个方案**，查看总费用、初始上下文、峰值请求输入、LLM 调用次数、预估每轮耗时和上下文压缩情况。方案默认继承全局设置，也可独立覆盖，并支持自动或手动选择对比基准。

<img src="features/compare-plans.png" alt="全局设置与不同 MCP 工具加载策略的方案对比" width="1100" />

### 02 · 编辑方案执行流程

展开任意方案，查看费用摘要、**初始上下文** 和 **逐轮执行流程**。可增加上下文动作和 LLM 请求，编辑 Token 表达式、自定义变量与节点耗时，通过间隔或概率条件控制执行，描述工具发现、工具返回和 Agent 回复等环节。

<img src="features/execution-flow..png" alt="方案费用摘要、初始上下文和逐轮执行流程" width="1100" />

### 03 · 查看会话成本趋势

切换 **累计费用** 与 **单轮费用**，对比多种策略在会话过程中产生的成本变化；发生上下文压缩时，趋势图也可标记对应轮次。

<img src="features/session-trend.png" alt="不同工具加载策略的会话费用趋势图" width="1100" />

### 04 · 拆解 Token 成本来源

通过 **成本拆解** 堆叠图查看工具 Schema、技能上下文、工具结果、模型输出等来源的费用组成，定位主要成本来源。

<img src="features/cost-breakdown.png" alt="不同上下文来源的成本拆解堆叠图" width="1100" />

### 05 · 前缀缓存与逐请求明细

在 **请求明细** 中选择方案、跳转轮次、展开单次 LLM 调用。按来源轮次查看输入上下文，区分 **缓存命中、未命中和部分命中**，追踪上下文在请求之间的复用情况。

<img src="features/prefix-cache-detail.png" alt="LLM 请求的前缀缓存命中、未命中与逐轮上下文明细" width="1100" />

### 06 · 选择内置策略模板

打开 **模板** 弹窗浏览六种内置策略场景，查看各模板的对比方案并应用。支持 **导入自定义 JSON 模板**，也能从方案工具栏 **导出当前配置**；界面可切换中英文。

<img src="features/templates.png" alt="展示六种内置策略场景、方案预览和自定义模板导入入口的模板弹窗" width="900" />

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