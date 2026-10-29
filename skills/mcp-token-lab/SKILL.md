---
name: mcp-token-lab
description: 为 MCP Token Lab 生成或修改含模板名称、模板描述和多方案配置的可导入 JSON，比较 Agent 流程、工具 Schema 加载、缓存、上下文压缩、模型费用或预估耗时。适用于生成方案对比模板、将 Agent 流程转换为导入 JSON；不用于真实模型调用或通用 JSON 转换。
---

# MCP Token Lab 方案对比

默认交付 UTF-8 `.json` 模板文件，包含模板名称、模板描述和多方案配置，供用户在 MCP Token Lab 点击「模板 → 导入自定义模板」，预览后点击「使用模板」比较方案。页面只在浏览器本地模拟，不需要 API Key；JSON 存储模板元信息与配置，不存储预先计算的费用结果。用户明确要求普通配置时只交付内部 `config`，说明该格式没有模板名称和模板描述。

## 生成流程

1. 阅读 [导入契约](references/import-format.md)。从用户描述、现有配置或项目中的 Agent 流程提取用户轮次、Skills / Tools 数量、各段预计长度、模型调用顺序、缓存、压缩、费率和节点预计耗时。未指定且已有配置也未提供时，统一使用 **100 轮、100 个 Tools、100K Token 上下文压缩阈值**：`turnTotalCount: 100`、`toolsTotalCount: 100`、`compressionThresholdType: "TOKEN"`、`compressionThresholdToken: 100`。不要自行改用其他规模或轮次压缩；用户明确指定或比较这些参数时按用户要求。其他关键业务差异不明时询问；可估算的数值采用明确标注的假设继续生成。
2. 默认生成 2–8 个有明确差异的方案；用户只要一个时允许单方案。比较同一任务时统一用户轮次、工具返回量、模型费率和相同步骤的耗时假设，只改实验变量；用户明确比较模型或会话规模时保留对应差异，并说明比较口径。
3. 以 [完整双方案模板](assets/comparison.example.json) 为起点，复制后修改。外层固定 `type: "token-lab-template"`、`version: 1`，填写非空 `name`（去掉两端空白后 1–100 字符）和 `description`（最多 1,000 字符；新模板填写非空描述，概述比较目标、适用场景和关键假设），内部 `config` 保存多方案配置（`unit: "K"`）。修改已有模板时保留元信息，只有内容变化导致原描述不再适用时更新。示例比较按需 Schema 与全量预加载，费率仅为演示假设，不是实际报价。需要其他流程时替换各方案的 `simulation.flow.initial` 和 `simulation.flow.turn`；同时显式提供两个数组，空数组表示不执行该阶段。
4. 设置全局参数及每个方案完整的 `simulation`、`model`、`pricing`；在方案顶层 `description` 简述策略、适用场景或关键假设（最多 1,000 字符）。**修改方案独立数值时同步将 `useGlobal[字段路径]` 设为 `false`**；修改独立模型时设 `useGlobal.model = false`。全局自定义变量例外：默认继承，独立值需设 `useGlobal["variables.变量名"] = false`。耗时使用独立的两级开关：`globalSimulation.estimateDuration` 和方案顶层 `estimateDuration`，不能放进 `useGlobal` 或 `simulation`；新文件显式给出两个布尔值，修改已有文件时保留原选择。
5. 在完整模拟与严格校验通过后，输出模板文件的可点击链接、方案差异和主要假设，并说明「页面 → 模板 → 导入自定义模板 → 选择此 JSON → 使用模板」。用户要求纯 JSON 时只返回合法 JSON；不要夹带注释、Markdown、待填写内容或额外的 `assumptions` / `results` 字段；方案说明中的有效 `{{变量名}}` 引用可以保留。

## 必须保持的语义

- 模板外层 `version: 1`，内部 `config.unit: "K"`；下文配置路径均相对于内部 `config`。模板 `description` 说明整个实验，`plans[i].description` 说明单个方案，两者都应填写。所有内容长度和公式结果均为 K Token，1K = 1,000 Token；模型价格是 USD / 百万 Token，`currency: "$"`。
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

有目标仓库源码和已安装依赖时，**交付前必须运行完整模拟与严格校验**（从仓库根目录执行）：

```bash
node skills/mcp-token-lab/scripts/validate-config.mjs --repo . <输出文件.json> --simulate --strict
```

- `--simulate` 使用应用真实的模拟引擎执行全部轮次，发现只在后续轮次、条件触发或压缩后才出现的公式错误。导入校验通过不代表完整模拟成功。
- `--strict` 对未解析的说明变量、不支持的 `{{表达式}}` 和未配对的双花括号报错，返回非零退出码；缺省模式仅输出 warnings。检查脚本还遵循网页 4 MB 文件大小限制。
- 脚本复用页面的 `src/templates.js`、`src/comparison.js`、`src/session-report.js`；不要在 Skill 里重新定义独立 Schema。参见 [导入契约](references/import-format.md) 和 [完整示例](assets/comparison.example.json)。可运行 `pnpm test` 执行包括 Skill 校验器在内的回归测试。
- 如果缺少源码或依赖，仍可检查 JSON 语法、配置单位、字段结构、参数继承、方案差异、变量引用与流程节点；**必须说明尚未进行应用导入和完整模拟验证**，不能声称已通过。
- 费率应使用用户提供或经过核实的来源；未知时标注演示假设。费用估算不等同于真实 Agent 执行或计费数据。

交付默认包含完整模板 JSON、关键参数、方案差异和「页面 → 模板 → 导入自定义模板 → 选择 JSON → 使用模板」操作说明。用户明确要求普通配置时只提供内部配置对象，不附加模板元信息。
