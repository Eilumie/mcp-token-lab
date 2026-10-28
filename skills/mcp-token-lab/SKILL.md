---
name: mcp-token-lab
description: 为 MCP Token Lab 生成或修改可直接导入页面的 v4 多方案 JSON，比较 Agent 流程、工具 Schema 加载、缓存、上下文压缩或模型费用。适用于生成方案对比配置、将 Agent 流程转换为导入 JSON；不用于真实模型调用或通用 JSON 转换。
---

# MCP Token Lab 方案对比

交付 UTF-8 `.json` 配置文件，供用户在 MCP Token Lab 点击「导入配置」后比较方案。页面只在浏览器本地模拟，不需要 API Key；JSON 存储配置，不存储预先计算的费用结果。

## 生成流程

1. 阅读 [导入契约](references/import-format.md)。从用户描述、现有配置或项目中的 Agent 流程提取用户轮次、Skills / Tools 数量、各段预计长度、模型调用顺序、缓存、压缩和费率。关键业务差异不明时询问；可估算的数值采用明确标注的假设继续生成。
2. 默认生成 2–8 个有明确差异的方案；用户只要一个时允许单方案。比较同一任务时统一用户轮次、工具返回量及模型费率，只改实验变量；用户明确比较模型或会话规模时保留对应差异，并说明比较口径。
3. 以 [完整双方案模板](assets/comparison.example.json) 为起点，复制后修改。模板比较按需 Schema 与全量预加载，费率仅为演示假设，不是实际报价。需要其他流程时替换 `flow.initial` 和 `flow.turn`；同时显式提供两个数组，空数组表示不执行该阶段。
4. 设置全局参数及每个方案完整的 `simulation`、`model`、`pricing`。**修改方案独立值时同步将 `useGlobal[字段路径]` 设为 `false`**；修改独立模型时设 `useGlobal.model = false`。全局自定义变量例外：默认继承，独立值需设 `useGlobal["variables.变量名"] = false`。
5. 校验后输出配置文件的可点击链接、方案差异和主要假设，并说明「页面 → 导入配置 → 选择此 JSON」。用户要求纯 JSON 时只返回合法 JSON；不要夹带注释、Markdown、占位符或额外的 `assumptions` / `results` 字段。

## 必须保持的语义

- `version: 4`、`unit: "K"`。所有内容长度和公式结果均为 K Token，1K = 1,000 Token；模型价格是 USD / 百万 Token，`currency: "$"`。
- `expectedPrefixCacheHitRate: 0.9` 是 90%；`trigger.value: 30` 是 30%。两者量纲不同。
- `action` 只追加上下文；`llm` 发送当前上下文，`token` 是该次模型**输出**长度，输出自动追加到历史。不要手工重复追加同一输出或把输入长度填写到 `llm.token`。
- 流程决定内容是否加载；单独设置 `toolsTotalCount` / `skillDetailToken` 等参数不会自动追加内容。全量与按需 Schema 的差异必须体现在步骤中，不能使用旧字段 `toolsMode`。
- 缓存和压缩由引擎计算。轮末才检查压缩，最后一轮的压缩请求也计费；`compressionTargetToken` 只是摘要输出长度。不要再添加一次手工压缩模型调用。
- `trigger` 只控制自身节点；概率节点使用可复现抽样，不是按概率直接折算费用，相关计划与结果不自动联动。
- 使用用户提供或已有配置中的费率，并保留来源。用户要求当前价格时再核对官方来源；无法核对时标明假设，不把示例值称为实时价格。估算长度不等于真实分词计数，费用差异不证明模型质量相同。

## 校验与交付

在能访问 MCP Token Lab 源码及其已安装依赖时，运行随附脚本（`<skill-dir>` 是本 skill 所在目录）：

```sh
node <skill-dir>/scripts/validate-config.mjs --repo <MCP-Token-Lab仓库目录> <输出文件.json>
node <skill-dir>/scripts/validate-config.mjs --repo <MCP-Token-Lab仓库目录> <输出文件.json> --simulate
```

第一条使用页面真实的 `readComparisonConfig` 和校验器，验证导入后的生效配置；第二条完整执行会话，检查后续轮次公式并返回费用摘要。对于含 `turnIndex` / `llmIndex`、触发条件或新流程的配置，应执行完整模拟；大型实验可先做小规模预检，但必须区分预检与完整验证。

没有源码或依赖时，仍可依照契约生成文件并做 JSON 解析、单位、标识、基准、继承和步骤字段检查，明确说明未运行页面导入校验。不要声称已验证成功，也不要因此拒绝生成。

若源码版本与本文不一致，以目标页面对应的 `src/comparison.js`、`src/config.js`、`src/session-flow.js`、`src/variables.js` 和 `src/session-defaults.js` 为准。交付前确认方案没有意外继承掉原定差异。
