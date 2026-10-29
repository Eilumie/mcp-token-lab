# 页面配置导入契约

默认交付带模板元信息的文件，内部 `config` 是多方案页面配置。完整可导入文件见 [comparison.example.json](../assets/comparison.example.json)。

## 模板外层

| 路径 | 生成规则 |
| --- | --- |
| `type` | 固定字符串 `"token-lab-template"` |
| `version` | 固定数字 `1`，是模板格式版本 |
| `name` | 字符串，去掉两端空白后 1–100 字符，作为模板卡片和详情的名称 |
| `description` | 字符串，最多 1,000 字符，说明整体比较目标、适用场景或关键假设；新生成模板填写非空描述。导入器允许省略或为空，页面会显示「暂无模板介绍」 |
| `config` | 完整的多方案配置，字段见下文 |

结构为 `{ "type": "token-lab-template", "version": 1, "name": "…", "description": "…", "config": { "unit": "K", … } }`，完整 JSON 以示例文件为准。外层模板版本与内部配置不是同一个概念。模板描述与单个方案的说明分别填写在外层 `description` 和 `config.plans[i].description`。

导入入口为「模板 → 导入自定义模板 → 选择 JSON → 使用模板」。普通配置仍可从同一入口导入，此时模板名称取文件名，若顶层存在 `description` 则使用该描述，否则模板介绍为空；只有用户明确要求普通配置时才省略模板外层。修改已有文件时先识别两种格式，不要把模板元信息塞进普通配置。

## config 顶层及方案

以下路径均相对于模板的 `config`；普通配置中则直接位于文件顶层。

| 路径 | 生成规则 |
| --- | --- |
| `unit` | 固定字符串 `"K"`，所有长度均以千 Token 为单位 |
| `plans` | 最多 8 项；方案对比通常至少 2 项 |
| `baselineId` | 某个方案的 `id`；空方案数组才使用 `null` |
| `baselineMode` | `"manual"` 固定指定基准；`"auto"` 运行后选择总费用最高的方案，同价取首个。auto 下仍需有效 baselineId |
| `globalSimulation` | 共享数值参数，与 simulation 同名；initialContext 是嵌套对象，variables 是自定义变量表。另支持 estimateDuration 和 removedFields；不放 flow 或 model |
| `globalSimulation.estimateDuration` | 可选布尔值，省略为 true；false 隐藏整列耗时并关闭所有方案的耗时统计 |
| `globalSimulation.removedFields` | 可选的已删除内置数值参数路径数组，不重复且只能包含内置数值字段；计算改用系统默认值。修改已有配置时保留，不要为新实验随意删除参数 |
| `globalModelId` | 推荐 `"custom"` 并完整提供 globalModel，避免依赖可能变化的内置模型 ID |
| `globalModel` | `{ "model": { ... }, "pricing": { ... } }`，供 useGlobal.model 为 true 的方案继承 |
| `plans[i].id` | 唯一非空字符串，可使用 `"plan-lazy"` 等稳定 ID |
| `plans[i].name` | 1–60 字符，去掉两端空白后不能重名 |
| `plans[i].description` | 可选字符串，原文最多 1,000 字符，可为空；说明方案目标、策略、适用场景或关键假设，支持下文的 `{{变量名}}` 引用 |
| `plans[i].estimateDuration` | 可选布尔值，省略为 true；false 仅关闭本方案耗时，单元格显示「—」，不改变全局列显隐或其他方案 |
| `plans[i].color` | 只能选下方调色板值 |
| `plans[i].simulation` | 下表完整参数和 flow，即使继承全局也保留完整本地值 |
| `plans[i].model` / `.pricing` | 完整模型及价格来源，即使继承全局也保留 |
| `plans[i].useGlobal` | 可选布尔映射，键为内置参数路径、`"model"` 或 `"variables.变量名"` |

方案只允许 id、name、description、color、simulation、model、pricing、useGlobal、estimateDuration。说明写入 description，不使用自造字段；计算结果仍不能放进配置。

调色板（按顺序选用）：

```json
["#5869d9", "#d99b61", "#449b87", "#9a76c3", "#5c9ebd", "#c77891", "#9b9b4d", "#768397"]
```

## simulation 参数

这些字段全部显式生成，包括当前不使用的另一种压缩阈值。用户未指定且已有配置也未提供时，本 skill 统一使用 100 轮、100 个 Tools、TOKEN 模式的 100K 上下文压缩阈值，完整模板采用相同口径；其余数值为示例，不代表用户实际场景。用户明确指定或比较这些参数时按用户要求。

| 字段 | 示例 | 单位 / 约束 |
| --- | --- | --- |
| `initialContext.agentPromptToken` | 4 | K Token；嵌套字段 |
| `turnTotalCount` | 100 | 用户消息轮次，整数 1–1,000 |
| `skillsTotalCount` | 30 | 非负安全整数 |
| `toolsTotalCount` | 100 | 非负安全整数 |
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
| `compressionThresholdType` | `"TOKEN"` | 默认 TOKEN；也支持用户明确指定的 TURN |
| `compressionThresholdTurnCount` | 10 | 正安全整数；TURN 模式须大于保留轮次 |
| `compressionThresholdToken` | 100 | K；默认 100K，TOKEN 模式必须大于 0 |
| `compressionKeepTurns` | 2 | 非负安全整数 |
| `compressionTargetToken` | 4 | 摘要输出长度，非负 K；不是压缩后总上下文 |
| `variables` | `{}` | 自定义变量表，可为空 |
| `flow` | 见下文 | 显式提供 initial / turn 数组 |

所有数值须有限，所有长度须非负。JSON 不允许 NaN / Infinity。

内置参数只有 `useGlobal[字段] === true` 才继承全局；缺省或 false 使用方案值。嵌套长度使用平铺路径键 `"initialContext.agentPromptToken"`。flow 始终属于方案，不支持 useGlobal.flow。

耗时开关是例外：方案开关位于 `plans[i].estimateDuration`，不在 simulation 内，也不支持 `useGlobal.estimateDuration`。全局开关位于 globalSimulation，不能当成数值变量或 Token 公式参数。

自定义变量全局默认继承，包括与本地同名时也覆盖；用 `useGlobal["variables.retrievalToken"]: false` 保留本地值。全局与本地变量合并后每个生效方案最多 100 项。

## 方案说明中的变量

`plans[i].description` 支持 `{{变量名}}`，变量名与步骤公式使用同一个配置参数名，但这里只替换数值，不计算表达式。例如：

```json
{
  "description": "共 {{toolsTotalCount}} 个工具，每轮平均调用 {{turnAvgToolsCount}} 个；Prompt 为 {{initialContext.agentPromptToken}} K。"
}
```

该片段放在方案顶层；引用上面完整示例的配置时显示「共 100 个工具，每轮平均调用 1.5 个；Prompt 为 4 K。」。自定义变量直接按名引用，如 `{{retrievalToken}}`，先在 globalSimulation.variables 或方案 simulation.variables 定义它，不写 `{{variables.retrievalToken}}`。

- 可引用 simulation 表内的数值参数，包括点号路径 `initialContext.agentPromptToken`，以及自定义变量。`{{ toolsTotalCount }}` 两侧空白有效；变量名区分大小写。
- 使用当前方案的实际生效值，遵守内置参数的 useGlobal 开关和自定义变量的默认全局继承规则。修改全局值、独立覆盖或恢复继承后，方案列表、详情卡片和模板预览同步更新。
- 数值按配置原值显示，零值有效；Token 长度仍为 K，说明中手工写单位。`{{expectedPrefixCacheHitRate}}` 在值为 0.9 时显示 `0.9`，不能在后面直接加 `%` 当作 90%。可写「命中率 {{expectedPrefixCacheHitRate}}（0–1）」；不支持百分比格式指令。
- 不支持 `{{toolsTotalCount * toolSchemaToken}}`、Math 函数或格式过滤器，也不读取 turnIndex / llmIndex、模型单价、compressionThresholdType、耗时开关、节点字段或模拟结果。需要展示计算后的常量时，将数值明确存进自定义变量；它不会自动随其他变量重算。
- 未知变量、没有有效数值的变量及 removedFields 内已删除的内置变量保留占位原文；编辑器提示未知引用，导入不会因此失败。不支持的表达式同样原样显示；新生成说明不要依赖这种行为，应使用可解析的引用。
- 原文（含花括号和变量名）总长最多 1,000 字符；导入、导出和复制保留原文，不把预览值写回 JSON。该语法仅用于方案说明，模板外层 description 和方案名称不替换变量。
- 页面可用「插入变量」选择当前方案可用参数，并查看「说明预览」。自定义变量在方案说明中仍被引用时不可删除；先修改引用，独立覆盖方案不受全局变量删除影响。

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
    { "type": "action", "text": "user_message", "token": "userMessageToken", "durationSeconds": 0 },
    { "type": "llm", "text": "检索计划", "token": 0.2, "durationSeconds": 1.8 },
    { "type": "action", "text": "检索结果", "token": "retrievalToken", "durationSeconds": 0.3 },
    { "type": "llm", "text": "agent_result", "token": "agentResult", "durationSeconds": 1.8 }
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
| `durationSeconds` | 可选非负有限数字，单位秒；省略时 action 为 0.3、llm 为 1.8；显式 0 有效。不接受字符串、null 或公式，initial 中也允许保存该字段 |

常用归因键可沿用完整模板的英文 text，页面有对应显示名称；自定义名称也可正常显示。

按需 Schema 模板：初始加载 Prompt、Skill 索引、Tool 索引；每轮执行用户消息 → LLM 读取技能计划 → Skill 内容 → LLM 查询 Schema 计划 → 所需 Schema → LLM 调用工具计划 → 工具返回 → LLM 最终回复。

全量模板：初始阶段额外追加 `toolsTotalCount * toolSchemaToken`；每轮删除「查询 Schema 计划」及「所需 Schema」两个节点。其余相同。这比较的是两种具体流程的总成本，不只是 Schema 大小。

### 耗时开关与计算口径

开关必须使用 JSON 布尔值 true / false，不能用 `"false"`、0、1 或 null。新文件建议显式写出两个开关；开关省略时默认开启。

| 全局 estimateDuration | 方案 estimateDuration | 实际统计与页面行为 |
| --- | --- | --- |
| true / 省略 | true / 省略 | 统计本方案耗时，展示「每轮平均TTFT」 |
| true / 省略 | false | 本方案耗时显示「—」，保留整列，其他方案不变 |
| false | 任意有效值 / 省略 | 所有方案关闭耗时统计，整列隐藏；保留各方案的独立开关和节点耗时 |

即使所有方案都设为 false，只要全局仍开启，耗时列仍保留。开关不影响 Token 和费用；关闭统计也不能填写非法节点耗时，导入仍会校验。

页面「每轮平均TTFT」实际采用串行累计耗时估算：

```text
每轮耗时 = 本轮实际执行的 turn 节点 durationSeconds 之和 + 本轮压缩调用数 × 1.8 秒
每轮平均耗时 = 所有用户轮次的耗时之和 ÷ 用户轮次总数
```

- 只统计实际启用且触发的 turn 节点；初始上下文的一次性加载不计入，即使设置了耗时。
- 每个 LLM 节点只计时一次，自动追加的模型输出不会重复计时。
- 工具 / 上下文节点每执行一次只加一次耗时，不随 Token 数或 turnAvgToolsCount 倍增；若耗时已包含整批工具执行时间，直接填写该批总秒数。
- 压缩请求固定 1.8 秒，计入触发它的用户轮次，包括最后一轮；不手工增加压缩节点。
- 该指标不是实际测量的首 Token 延迟，也不自动按模型速度、Token 长度或并行调用推导耗时。使用默认值或估算值时明确说明假设。
- 模拟报告返回 `averageTurnDurationSeconds` 和 `rounds[i].durationSeconds`；关闭时均为 null，不能当成 0 秒。空流程且不触发压缩时为 0；无用户轮次平均值为 null（页面配置仍要求至少 1 轮）。这些是运行结果，不写回导入 JSON。

### 可引用的值

公式可直接引用上表所有数值字段、自定义变量，以及 turnIndex（用户轮次索引，从 0 开始）和 llmIndex（本轮当前步骤前已执行的模型调用数，从 0 开始）。初始阶段两者均为 0。压缩不计入用户轮次，停用或未触发的 LLM 不增加 llmIndex。

不能引用其他节点输出对象、累计上下文、模型单价、其他方案、compressionThresholdType、description、estimateDuration 或 durationSeconds；需要的常量放进自定义变量。参数表达式不递归引用其他公式。

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

- `{ "type": "interval", "value": 3 }`：从首轮开始，在第 1、4、7…轮执行；value 为正安全整数。间隔超过会话轮数时仍在首轮执行一次，压缩不重置计数。
- `{ "type": "probability", "value": 30 }`：每轮 30% 触发；value 为 0–100 有限数。每个节点独立按轮次及节点位置确定抽样，实际比例可能不同于设定值。
- trigger 只允许 type / value，initial 不接受 trigger。
- 计划 LLM 未触发不会自动跳过后面的工具结果节点。需要联动时可给相关节点相同 interval，或按 turnIndex 写确定性条件；不要给两个概率节点相同百分比就当成相关事件。
- `token: 0` 的 LLM 仍会发起请求并计输入费用；要跳过请求应使用 enabled 或 trigger。

## 校验生成结果

从仓库根目录执行，检查页面导入、全部轮次模拟及说明占位符：

```bash
node skills/mcp-token-lab/scripts/validate-config.mjs --repo . ./my-scenario.json --simulate --strict
```

省略 `--simulate` 时只验证导入结构与说明，不保证后续轮次的公式安全；省略 `--strict` 时未解析变量、不支持的占位表达式和未配对的双花括号仅显示警告。文件最大支持 4 MB。脚本报告的 `valid: true` 表示已执行的检查通过，不代表真实 Agent 的费用或回答质量。

## 最后检查

确认 JSON 可解析；模板外层类型和版本正确，名称有效且新模板描述非空，内部配置字段完整；所有方案参数完整、ID / 名称唯一、颜色有效、基准存在、价格单位正确、平均数量不超过总数、压缩阈值有效、变量全部定义、模板描述和各方案说明原文均为最多 1,000 字符的字符串、说明引用按本方案实际配置可解析且单位正确、两级耗时开关位置和类型正确、节点耗时为非负有限数，以及各方案继承开关确实保留实验差异。导入先添加自定义模板，点击「使用模板」才替换页面当前整份配置，不是追加方案；需要保留旧实验时先导出。

仅支持当前配置字段结构，不自动补齐缺失的全局字段；globalSimulation 和 globalModelId 须提供。导入流程必须同时包含 initial / turn 数组，Token 仅支持数值或公式字符串，不接受参数名数组。
