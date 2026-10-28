---
name: mcp-token-lab
description: 为 MCP Token Lab 生成或修改含模板名称、模板描述和 v4 多方案配置的可导入 JSON，比较 Agent 流程、工具 Schema 加载、缓存、上下文压缩、模型费用或预估耗时。适用于生成方案对比模板、将 Agent 流程转换为导入 JSON；不用于真实模型调用或通用 JSON 转换。
---

# MCP Token Lab 方案对比

默认交付 UTF-8 `.json` 模板文件，包含模板名称、模板描述和 v4 多方案配置，供用户在 MCP Token Lab 点击「模板 → 导入自定义模板」，预览后点击「使用模板」比较方案。页面只在浏览器本地模拟，不需要 API Key；JSON 存储模板元信息与配置，不存储预先计算的费用结果。用户明确要求普通 v4 配置时只交付内部 `config`，说明该格式没有模板名称和模板描述。

## 生成流程

1. 阅读 [导入契约](references/import-format.md)。从用户描述、现有配置或项目中的 Agent 流程提取用户轮次、Skills / Tools 数量、各段预计长度、模型调用顺序、缓存、压缩、费率和节点预计耗时。未指定且已有配置也未提供时，统一使用 **100 轮、100 个 Tools、100K Token 上下文压缩阈值**：`turnTotalCount: 100`、`toolsTotalCount: 100`、`compressionThresholdType: "TOKEN"`、`compressionThresholdToken: 100`。不要自行改用其他规模或轮次压缩；用户明确指定或比较这些参数时按用户要求。其他关键业务差异不明时询问；可估算的数值采用明确标注的假设继续生成。
2. 默认生成 2–8 个有明确差异的方案；用户只要一个时允许单方案。比较同一任务时统一用户轮次、工具返回量、模型费率和相同步骤的耗时假设，只改实验变量；用户明确比较模型或会话规模时保留对应差异，并说明比较口径。
3. 以 [完整双方案模板](assets/comparison.example.json) 为起点，复制后修改。外层固定 `type: "token-lab-template"`、`version: 1`，填写非空 `name`（去掉两端空白后 1–100 字符）和 `description`（最多 1,000 字符；新模板填写非空描述，概述比较目标、适用场景和关键假设），内部 `config` 保存 `version: 4` 的多方案配置。修改已有模板时保留元信息，只有内容变化导致原描述不再适用时更新。示例比较按需 Schema 与全量预加载，费率仅为演示假设，不是实际报价。需要其他流程时替换各方案的 `simulation.flow.initial` 和 `simulation.flow.turn`；同时显式提供两个数组，空数组表示不执行该阶段。
4. 设置全局参数及每个方案完整的 `simulation`、`model`、`pricing`；在方案顶层 `description` 简述策略、适用场景或关键假设（最多 1,000 字符）。**修改方案独立数值时同步将 `useGlobal[字段路径]` 设为 `false`**；修改独立模型时设 `useGlobal.model = false`。全局自定义变量例外：默认继承，独立值需设 `useGlobal["variables.变量名"] = false`。耗时使用独立的两级开关：`globalSimulation.estimateDuration` 和方案顶层 `estimateDuration`，不能放进 `useGlobal` 或 `simulation`；新文件显式给出两个布尔值，修改已有文件时保留原选择。
5. 校验后输出模板文件的可点击链接、方案差异和主要假设，并说明「页面 → 模板 → 导入自定义模板 → 选择此 JSON → 使用模板」。用户要求纯 JSON 时只返回合法 JSON；不要夹带注释、Markdown、待填写内容或额外的 `assumptions` / `results` 字段；方案说明中的有效 `{{变量名}}` 引用可以保留。

## 必须保持的语义

- 模板外层 `version: 1`，内部 `config.version: 4`、`config.unit: "K"`；下文配置路径均相对于内部 `config`。模板 `description` 说明整个实验，`plans[i].description` 说明单个方案，两者都应填写。所有内容长度和公式结果均为 K Token，1K = 1,000 Token；模型价格是 USD / 百万 Token，`currency: "$"`。
- 方案说明提到可调整数值时，可写 `{{toolsTotalCount}}`、`{{initialContext.agentPromptToken}}` 或 `{{retrievalToken}}`，按本方案继承 / 覆盖后的实际值展示；JSON 保留引用原文。只支持内置数值参数和已定义自定义变量，不执行公式，不用于模板外层 description。单位、未知引用和示例见导入契约的「方案说明中的变量」。
- `expectedPrefixCacheHitRate: 0.9` 是 90%；`trigger.value: 30` 是 30%。两者量纲不同。
- `action` 只追加上下文；`llm` 发送当前上下文，`token` 是该次模型**输出**长度，输出自动追加到历史。不要手工重复追加同一输出或把输入长度填写到 `llm.token`。
- 流程决定内容是否加载；单独设置 `toolsTotalCount` / `skillDetailToken` 等参数不会自动追加内容。全量与按需 Schema 的差异必须体现在步骤中，不能使用旧字段 `toolsMode`。
- 缓存和压缩由引擎计算。轮末才检查压缩，最后一轮的压缩请求也计费；`compressionTargetToken` 只是摘要输出长度。不要再添加一次手工压缩模型调用。
- `trigger` 只控制自身节点；概率节点使用可复现抽样，不是按概率直接折算费用，相关计划与结果不自动联动。
- 节点 `durationSeconds` 是非负有限数值（秒），不支持公式；省略时 action 为 0.3s、llm 为 1.8s，显式 0 有效。全局与方案耗时开关都开启时才统计，开关省略视为 true。全局关闭隐藏耗时列；单方案关闭仅显示「—」，不改变费用或 Token。
- 页面「每轮平均TTFT」按本轮实际执行节点耗时与压缩调用耗时累计后求平均，不是真实首 Token 延迟测量。初始加载不计入；压缩调用固定 1.8s，包含末轮；工具节点按执行一次计时，不乘平均工具数量。详细口径见导入契约。
- 使用用户提供或已有配置中的费率，并保留来源。用户要求当前价格时再核对官方来源；无法核对时标明假设，不把示例值称为实时价格。估算长度不等于真实分词计数，费用差异不证明模型质量相同。

## 校验与交付

在能访问 MCP Token Lab 源码及其已安装依赖时，运行随附脚本（`<skill-dir>` 是本 skill 所在目录）：

```sh
node <skill-dir>/scripts/validate-config.mjs --repo <MCP-Token-Lab仓库目录> <输出文件.json>
node <skill-dir>/scripts/validate-config.mjs --repo <MCP-Token-Lab仓库目录> <输出文件.json> --simulate
```

第一条使用页面真实的 `readTemplate` 校验模板元信息和内部配置（普通配置使用 `readComparisonConfig`），再验证导入后的生效配置；第二条完整执行内部配置的会话，检查后续轮次公式并返回费用、耗时开关与每轮平均耗时摘要。对于含 `turnIndex` / `llmIndex`、触发条件、新流程或自定义耗时的配置，应执行完整模拟；大型实验可先做小规模预检，但必须区分预检与完整验证。

脚本还返回各方案的说明预览和未解析变量警告。页面允许未知引用原样显示，导入通过不代表说明引用完整；新生成文件交付前应修复这些警告。校验脚本要求目标源码提供当前导入与说明变量功能。

没有源码或依赖时，仍可依照契约生成文件并做 JSON 解析、模板类型与版本、模板名称与描述、内部配置版本、单位、标识、基准、继承、方案说明、耗时开关和步骤字段检查，明确说明未运行页面导入校验。不要声称已验证成功，也不要因此拒绝生成。

若源码版本与本文不一致，以目标页面对应的 `src/templates.js`、`src/comparison.js`、`src/config.js`、`src/session-flow.js`、`src/variables.js`、`src/plan-description.js` 和 `src/session-defaults.js` 为准。交付前确认模板描述与方案说明齐全、说明引用可解析，方案没有意外继承掉原定差异。

仅支持当前配置结构；不迁移旧版本，不补齐历史全局字段，不接受旧 Token 参数名数组。导入须提供完整全局配置、globalModelId，以及各方案 flow.initial / flow.turn。
