# v4 页面导入契约

这是多方案页面配置，不是单独的 Session 配置。完整可导入文件见 [comparison.example.json](../assets/comparison.example.json)。

## 顶层及方案

| 路径 | 生成规则 |
| --- | --- |
| `version` / `unit` | 固定为数字 `4` / 字符串 `"K"` |
| `plans` | 最多 8 项；方案对比通常至少 2 项 |
| `baselineId` | 某个方案的 `id`；空方案数组才使用 `null` |
| `baselineMode` | `"manual"` 固定指定基准；`"auto"` 运行后选择总费用最高的方案，同价取首个。auto 下仍需有效 baselineId |
| `globalSimulation` | 共享数值参数，与 simulation 同名；initialContext 是嵌套对象，variables 是自定义变量表。不放 flow 或 model |
| `globalModelId` | 推荐 `"custom"` 并完整提供 globalModel，避免依赖可能变化的内置模型 ID |
| `globalModel` | `{ "model": { ... }, "pricing": { ... } }`，供 useGlobal.model 为 true 的方案继承 |
| `plans[i].id` | 唯一非空字符串，可使用 `"plan-lazy"` 等稳定 ID |
| `plans[i].name` | 1–60 字符，去掉两端空白后不能重名 |
| `plans[i].color` | 只能选下方调色板值 |
| `plans[i].simulation` | 下表完整参数和 flow，即使继承全局也保留完整本地值 |
| `plans[i].model` / `.pricing` | 完整模型及价格来源，即使继承全局也保留 |
| `plans[i].useGlobal` | 可选布尔映射，键为内置参数路径、`"model"` 或 `"variables.变量名"` |

方案只允许 id、name、color、simulation、model、pricing、useGlobal。不要在方案添加说明、结果或其他字段。

调色板（按顺序选用）：

```json
["#5869d9", "#d99b61", "#449b87", "#9a76c3", "#5c9ebd", "#c77891", "#9b9b4d", "#768397"]
```

## simulation 参数

这些字段全部显式生成，包括当前不使用的另一种压缩阈值。下列数值是仓库初始参数示例，不代表用户实际场景；完整模板调整了部分规模参数。

| 字段 | 示例 | 单位 / 约束 |
| --- | --- | --- |
| `initialContext.agentPromptToken` | 4 | K Token；嵌套字段 |
| `turnTotalCount` | 100 | 用户消息轮次，整数 1–1,000 |
| `skillsTotalCount` | 30 | 非负安全整数 |
| `toolsTotalCount` | 90 | 非负安全整数 |
| `turnAvgSkillsCount` | 0.33 | 非负数，可为小数；不超过 Skills 总数 |
| `turnAvgToolsCount` | 1.5 | 非负数，可为小数；不超过 Tools 总数 |
| `expectedPrefixCacheHitRate` | 0.9 | 0–1，仅对引擎识别到的相同前缀生效 |
| `skillIndexToken` | 0.1 | 单个 Skill 索引，K |
| `toolsIndexToken` | 0.013 | 单个 Tool 索引，K |
| `toolSchemaToken` | 0.51 | 单个 Tool Schema，K |
| `userMessageToken` | 0.1 | 每轮用户消息，K |
| `skillDetailToken` | 3 | 单个 Skill 内容，K |
| `toolResultToken` | 3 | 单个工具返回，K |
| `readSkillPlanToken` | 0.1 | 读取 Skill 计划的模型输出，K |
| `schemaPlanToken` | 0.1 | 查询 Schema 计划的模型输出，K |
| `callToolsPlanToken` | 0.3 | 调用工具计划的模型输出，K |
| `agentResult` | 1 | 最终回复的模型输出，K；字段名没有 Token 后缀 |
| `compressionThresholdType` | `"TURN"` | `"TURN"` 或 `"TOKEN"` |
| `compressionThresholdTurnCount` | 10 | 正安全整数；TURN 模式须大于保留轮次 |
| `compressionThresholdToken` | 200 | K；TOKEN 模式必须大于 0 |
| `compressionKeepTurns` | 2 | 非负安全整数 |
| `compressionTargetToken` | 4 | 摘要输出长度，非负 K；不是压缩后总上下文 |
| `variables` | `{}` | 自定义变量表，可为空 |
| `flow` | 见下文 | 显式提供 initial / turn 数组 |

所有数值须有限，所有长度须非负。JSON 不允许 NaN / Infinity。

内置参数只有 `useGlobal[字段] === true` 才继承全局；缺省或 false 使用方案值。嵌套长度使用平铺路径键 `"initialContext.agentPromptToken"`。flow 始终属于方案，不支持 useGlobal.flow。

自定义变量全局默认继承，包括与本地同名时也覆盖；用 `useGlobal["variables.retrievalToken"]: false` 保留本地值。全局与本地变量合并后每个生效方案最多 100 项。

## 模型和来源

```json
{
  "model": {
    "name": "演示模型（假设费率）",
    "currency": "$",
    "inputCachedPrice": 0.2,
    "inputNotCachedPrice": 2,
    "outputPrice": 8
  },
  "pricing": {
    "id": "custom",
    "label": "演示假设，非实际报价",
    "source": "",
    "date": "",
    "note": "仅用于演示配置格式；请替换为目标模型的 USD / 百万 Token 单价"
  }
}
```

上述为格式示例，不能当成已核对报价。三个价格均为非负 USD / 百万 Token；不支持自动换汇。source 可填写官方价格链接，date 填实际核对日期，未知时留空。修改费率后使用 pricing.id 为 custom，避免混淆为未修改的预设。

pricing.contextWindow 可选，单位为原始 Token；pricing.tier 可选，格式为 `{ "input_tokens_gt": 0, "input_tokens_lte": 128000 }`，也是原始 Token。这些是来源元数据，不会自动选价格档位或限制上下文。跨档位的实验应选用适用费率并说明假设。

## 流程与公式

```json
{
  "initial": [
    { "type": "action", "text": "agent prompt", "token": "initialContext.agentPromptToken" }
  ],
  "turn": [
    { "type": "action", "text": "user_message", "token": "userMessageToken" },
    { "type": "llm", "text": "检索计划", "token": 0.2 },
    { "type": "action", "text": "检索结果", "token": "retrievalToken" },
    { "type": "llm", "text": "agent_result", "token": "agentResult" }
  ]
}
```

该片段引用 retrievalToken 时须同时按下文定义变量。initial 仅允许 action，turn 允许 action / llm。步骤只允许以下字段：

| 字段 | 规则 |
| --- | --- |
| `type` | `"action"` 或 `"llm"` |
| `text` | 非空步骤名，同时是费用来源归因键；同名合并统计 |
| `token` | 非负有限数字（K）或公式字符串；数字字符串如 `"0.5"` 也作为公式解析 |
| `enabled` | 可选布尔值，缺省为启用 |
| `trigger` | 可选，仅 turn 允许；省略表示每轮执行 |

常用归因键可沿用完整模板的英文 text，页面有对应显示名称；自定义名称也可正常显示。

按需 Schema 模板：初始加载 Prompt、Skill 索引、Tool 索引；每轮执行用户消息 → LLM 读取技能计划 → Skill 内容 → LLM 查询 Schema 计划 → 所需 Schema → LLM 调用工具计划 → 工具返回 → LLM 最终回复。

全量模板：初始阶段额外追加 `toolsTotalCount * toolSchemaToken`；每轮删除「查询 Schema 计划」及「所需 Schema」两个节点。其余相同。这比较的是两种具体流程的总成本，不只是 Schema 大小。

### 可引用的值

公式可直接引用上表所有数值字段、自定义变量，以及 turnIndex（用户轮次索引，从 0 开始）和 llmIndex（本轮当前步骤前已执行的模型调用数，从 0 开始）。初始阶段两者均为 0。压缩不计入用户轮次，停用或未触发的 LLM 不增加 llmIndex。

不能引用其他节点输出对象、累计上下文、模型单价、其他方案或 compressionThresholdType；需要的常量放进自定义变量。参数表达式不递归引用其他公式。

支持 `+ - * / % **`、括号、比较、`! && || ??` 和三元表达式。Math 函数仅支持 min、max、ceil、floor、round、trunc、abs、sqrt、pow、log、log2、log10、exp，常量支持 Math.PI / Math.E。必须写 `Math.min(...)`，不能写裸 `min(...)`。

```text
toolResultToken * turnAvgToolsCount
Math.min(toolResultToken * turnAvgToolsCount, 10)
turnIndex === 0 ? toolSchemaToken * turnAvgToolsCount : 0
llmIndex === 0 ? callToolsPlanToken : agentResult
```

每条公式最多 2,000 字符、256 个求值节点、32 层嵌套；不支持赋值、函数定义、随机数、任意对象访问或执行代码。结果在每个实际执行轮次都须为非负有限数；例如 `1 / turnIndex` 首轮就无效。不要只用首轮预览判断后续公式安全。

### 自定义变量

放在 globalSimulation.variables 或 plans[i].simulation.variables：

```json
{ "retrievalToken": { "label": "检索返回长度（K）", "value": 2.5 } }
```

变量名须匹配 `^[A-Za-z_][A-Za-z0-9_]{0,63}$`，不能与内置字段、运行变量、Math、model、flow、variables、JS 关键字、__proto__、constructor 等保留名称冲突。label 为 1–60 字符，value 为非负有限数。变量项只允许 label / value，单位写进 label 或文件外的假设说明。

### 触发规则

- `{ "type": "interval", "value": 3 }`：在第 3、6、9…轮执行；value 为正安全整数。压缩不重置计数。
- `{ "type": "probability", "value": 30 }`：每轮 30% 触发；value 为 0–100 有限数。每个节点独立按轮次及节点位置确定抽样，实际比例可能不同于设定值。
- trigger 只允许 type / value，initial 不接受 trigger。
- 计划 LLM 未触发不会自动跳过后面的工具结果节点。需要联动时可给相关节点相同 interval，或按 turnIndex 写确定性条件；不要给两个概率节点相同百分比就当成相关事件。
- `token: 0` 的 LLM 仍会发起请求并计输入费用；要跳过请求应使用 enabled 或 trigger。

## 最后检查

确认 JSON 可解析、所有方案参数完整、ID / 名称唯一、颜色有效、基准存在、价格单位正确、平均数量不超过总数、压缩阈值有效、变量全部定义，以及各方案继承开关确实保留实验差异。导入会替换页面当前整份配置，不是追加方案；需要保留旧实验时先导出。
