# Token Lab

基于 `src/session.js` 的 Vue 3 会话成本模拟页面，比较按需加载与全量加载 Tools Schema。所有计算在浏览器本地完成。

## 开发与验证

需要 Node.js 20.19+ 或 22.12+。

```sh
npm install
npm run dev
npm test
npx vite build
```

**现有 `npm run build` 同时上传 CDN。仅验证本地构建时使用 `npx vite build`。**

## 结构

- `session.js`：计算核心，页面直接导入；计费需显式传入模型费率。
- `session-flow.js`：默认初始 / 每轮流程、步骤条件、Token 参数引用与校验。
- `config.js`：从 Session 读取默认参数，定义表单与输入校验；只接受 Session v2 配置。
- `session-report.js`：将真实请求转换为可序列化的概览、逐轮汇总、费用来源与压缩事件；不重算缓存匹配。
- `session.worker.js`：在独立 Worker 内执行两种方案；变更参数后取消旧任务。
- `App.vue`：配置状态、计算生命周期及 JSON 导入导出，不读写 localStorage。
- `components/`：参数表单、对比卡片、分析视图和 ECharts 封装。
- `charts.js`、`export.js`、`utils.js`：图表、CSV 导出和显示工具。
- `model-pricing.js`：已有模型费率快照，不联网更新。
- `session-report.test.js`：会话基准、重复压缩、Token 阈值、归因守恒、配置和边界验证。

## 计算与展示口径

所有长度参数与 Session 结果均使用 **K Token**（1K = 1,000 Token），模型价格是每百万 Token 单价。费用 = K Token ÷ 1,000 × 单价。

币种由模型内置，页面不提供手动切换。现有模型均使用人民币（CNY），单价显示为 ¥/M。

两个 Session 共享参数、流程和模型，仅 `toolsMode` 不同。初始上下文、缓存命中、压缩触发和保留顺序都由 Session 决定。默认流程中角色允许工具比例只影响允许工具列表长度。每轮流程结束后检查压缩，最后一轮触发的压缩请求也计费。

用户轮次不包括初始上下文和压缩摘要的内部 Turn。压缩请求归入触发它的用户轮次，显示压缩前后长度、删除轮次及保留轮次。摘要输出长度不等于压缩后的总上下文。

“平均每 X 轮用户消息触发一次压缩” = 实际用户消息总轮数 ÷ 实际压缩次数，包含末次压缩后的用户轮次。由 `Session.getConsumptionTokens()` 返回 `averageUserTurnsPerCompression`，未触发压缩时为 `null`，页面显示“未触发压缩”。

输入归因直接读取每次请求的 `actionGroupTokens`，输出归入对应输出 Action 的 group。保留轮次在压缩后的请求中归入“压缩保留轮次”，历史归因不改变。“压缩摘要”是内容来源，“压缩请求费用”是请求分类，两者不可相加。

页面支持 1–1,000 轮，计算在 Worker 中执行，超过 20 秒可减少轮次或压缩阈值重试。不会为了提高性能改变 Session 的快照或引用匹配机制。图表采样保留压缩事件和峰值，明细每页 5 个用户轮次。

仅导出和导入 v2 配置，不迁移旧计算器数据。导出的费率保持原值，重新导入不会被预设覆盖。编辑模型或价格后标记为自定义费率。首次打开、刷新和重置时均选择模型列表第一项，当前为百炼 Qwen3.8 Max；Session 不内置默认费率。配置仅保留在当前页面内存中，需要留存时可导出 JSON。

## 自定义会话流程

页面参数面板的「自定义流程」可分别编辑初始上下文与每轮流程：新增、删除、改名、调整顺序、启用 / 停用、选择适用方案，以及设置固定 Token 或引用参数乘积。两个阶段各自支持恢复默认，配置导出会包含完整流程。

直接调用 Session 时使用 `config.flow.initial` 和 `config.flow.turn`；页面导入 JSON 时位于 `simulation.flow`。不提供流程或省略某个阶段时使用该阶段默认流程，显式传入 `[]` 表示空流程。之前不含 `flow` 的 v2 配置仍可导入。

```js
import Session from "./src/session.js";

const session = new Session({
  turnTotalCount: 10,
  model: { inputCachedPrice: 1.5, inputNotCachedPrice: 12, outputPrice: 36 },
  flow: {
    initial: [
      { type: "action", text: "系统提示", token: "initialContext.agentPromptToken" },
      { type: "action", text: "业务背景", token: 2 },
      {
        type: "action",
        text: "工具定义",
        token: ["toolsTotalCount", "toolSchemaToken"],
        toolsMode: "FULL_TOOLS_SCHEMA",
      },
    ],
    turn: [
      { type: "action", text: "用户提问", token: "userMessageToken" },
      { type: "llm", text: "检索计划", token: 0.2 },
      { type: "action", text: "检索结果", token: ["toolResultToken", "turnAvgToolsCount"] },
      { type: "llm", text: "最终回复", token: "agentResult" },
    ],
  },
});
session.reset();
const totals = session.getConsumptionTokens();
```

| 步骤字段 | 含义 |
|---|---|
| `type` | `action` 追加上下文；`llm` 请求当前有效上下文，并将输出追加到上下文。初始阶段只接受 `action`。 |
| `text` | 非空名称，同时作为费用归因来源；相同名称合并统计。 |
| `token` | 非负有限数字（K Token）、参数名字符串，或非空参数名数组（依次相乘）。`llm` 的 Token 表示输出长度，输入长度自动取当前上下文。 |
| `enabled` | 可选布尔值，`false` 跳过该步骤，默认启用。 |
| `toolsMode` | 可选 `LAZY_TOOLS_SCHEMA` / `FULL_TOOLS_SCHEMA`，省略则两种方案均执行。 |

可引用参数见 `session-flow.js` 的 `tokenParameters`：现有内容长度、Skills / Tools 总数、每轮平均数量、角色允许工具比例。流程为纯 JSON 数据，不执行字符串脚本或回调，可以传入 Worker。

轮次通过 `kind`（`initial` / `user` / `compression`）区分，不依赖步骤名称。每次 `startNewTurn()` 算一轮，即使没有用户消息步骤或模型调用，也会在轮末检查压缩。Token 阈值包含最后一次模型调用之后追加的内容。初始上下文的引用在本次运行中保持稳定，`reset()` 会按最新参数和流程重新创建初始上下文。

## 基准

将 Session 轮次设为 10、Skills 总数设为 1，其他参数不变：

| 方案 | 普通请求 / 压缩请求 | 最终上下文 K | 费用 CNY |
|---|---:|---:|---:|
| 按需 | 40 / 1 | 25.799 | 6.12874995 |
| 全量 | 30 / 1 | 69.969 | 8.18847795 |

费用采用列表第一个模型（百炼 Qwen3.8 Max）的单价 1.5 / 12 / 36 CNY 每百万 Token。
