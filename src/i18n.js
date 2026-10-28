import { ref } from 'vue';

const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem('token-lab-language');
export const locale = ref(typeof window === 'undefined' || saved === 'zh' ? 'zh' : 'en');
export function setLocale(value) {
  locale.value = value === 'zh' ? 'zh' : 'en';
  document.documentElement.lang = locale.value === 'zh' ? 'zh-CN' : 'en';
  document.title = locale.value === 'zh' ? 'MCP Token Lab — 工作台' : 'MCP Token Lab — Workspace';
  localStorage.setItem('token-lab-language', locale.value);
}

// Keep configuration, model IDs, and user input in their original form. These are
// display translations for the Chinese labels used by the existing application.
const english = {
  '每轮平均TTFT': 'Avg. TTFT per turn', '预估耗时': 'Estimate duration', '已关闭': 'Off',
  '是否模拟耗时': 'Simulate duration',
  '节点耗时（秒）': 'Node duration (seconds)',
  '留空使用默认值：工具 / 上下文 0.3s，LLM 1.8s；可设为 0。': 'Leave blank for defaults: tools / context 0.3s, LLM 1.8s. Zero is allowed.',
  '按实际执行节点累计，含压缩调用（1.8s），不含初始上下文；未配置时工具 / 上下文 0.3s，LLM 1.8s。': 'Sum executed nodes, including compression calls (1.8s), excluding initial context. Defaults: tools / context 0.3s, LLM 1.8s.',
  '仅预计时间, 实际LLM可能受prompt或上下文大小影响响应速度': 'Estimated time only. Actual LLM response speed may vary with the prompt or context size.',
  '节点耗时必须是非负有限数值（秒）': 'Node duration must be finite and non-negative (seconds)',
  '预估耗时开关必须是布尔值': 'Estimate duration must be a boolean',
  '耗时超出可计算范围，请减小节点耗时。': 'Duration exceeds the calculation range. Reduce node durations.',
  '模板': 'Templates', '关闭模板': 'Close templates', '选择模板': 'Choose a template',
  '选择一个起点，探索不同的调用策略。': 'Choose a starting point to explore different calling strategies.',
  '内置模板与自定义模板': 'Built-in and custom templates', '内置模板': 'Built-in template', '自定义模板': 'Custom template',
  '导入自定义模板': 'Import custom template', '自定义模板文件': 'Custom template file',
  '导出为模板': 'Export as template', '使用模板': 'Use template', '模板详情': 'Template details',
  '模板名称': 'Template name', '模板介绍': 'Template description', '方案列表': 'Plans',
  '暂无模板介绍': 'No description provided', '将当前配置导出为模板': 'Export current configuration as a template',
  '为当前配置命名': 'Name this configuration', '描述用途和方案差异': 'Describe its purpose and plan differences',
  '使用模板将替换当前全局配置和方案，可撤销。': 'Using a template replaces the current global settings and plans. You can undo this.',
  '已应用模板，可撤销': 'Template applied. You can undo this.', '已导出模板': 'Template exported',
  '模板名称需为 1–100 个字符': 'Template name must have 1–100 characters',
  '模板介绍不能超过 1000 个字符': 'Template description must be at most 1000 characters',
  '不支持的模板版本': 'Unsupported template version',
  '方案说明': 'Plan description', '方案说明不能超过 1000 个字符': 'Plan description must be at most 1000 characters',
  '描述方案的目标、策略或适用场景': 'Describe the goals, strategy, or use cases of this plan',
  'Tools Schema 加载策略': 'Tools Schema loading strategies',
  '对比渐进式按需加载与默认全量加载，观察初始上下文和调用成本的差异。': 'Compare progressive on-demand loading with full loading to see differences in initial context and calling costs.',
  '先加载工具索引，每轮按需读取工具 Schema，减少初始上下文。': 'Load the tool index first, then read schemas on demand each turn to reduce initial context.',
  '初始加载全部工具 Schema，每轮直接调用工具，减少查询步骤。': 'Load all tool schemas initially, then call tools directly each turn to reduce lookup steps.',
  'Prefix 缓存收益': 'Prefix cache savings',
  '使用相同流程，对比 0%、50% 和 90% 三档缓存命中率的费用变化。': 'Compare costs at 0%, 50%, and 90% cache hit rates using the same flow.',
  '上下文压缩频率': 'Context compression frequency',
  '对比每 5、10、20 轮压缩的策略，观察上下文峰值与压缩费用的变化。': 'Compare compression every 5, 10, and 20 turns to explore peak context and compression costs.',
  '用户消息总轮数 ÷ 实际压缩次数；包含末次压缩后尚未再次触发压缩的用户轮次。': 'Total user turns ÷ actual compressions; includes turns after the last compression.',
  '初始前缀按期望命中率计费 · 每轮流程结束后检查压缩 · 最后一轮触发的压缩也计费': 'The initial prefix uses the expected cache hit rate · Compression is checked after each turn · Compression on the final turn is billed',
  '所有长度以 K Token 计量。预计费用基于当前参数与费率快照，零分母显示「—」。': 'All lengths use K tokens. Estimated costs use the current settings and rate snapshot; undefined ratios show “—”.',
  '普通点最多采样 250 个，另保留全部压缩点、相邻轮次及峰值；费用统计使用完整数据。': 'Up to 250 regular points are sampled. Compression points, adjacent turns, and the peak are retained; costs use all data.',
  '单位 K Token。节点按配置展示触发条件、单次内容长度与耗时，动态公式为参考值；合计为已启用节点的配置值，实际执行取决于触发条件。模型输入包含此前累计上下文，压缩费用另计。': 'Unit: K tokens. Nodes show configured triggers, per-execution lengths and durations; dynamic formulas are estimates. Totals include enabled nodes; execution depends on trigger conditions. Model input includes prior context. Compression is billed separately.',
  '已启用节点内容与输出合计': 'Configured content and output total',
  '内置参数保留，未引用的自定义变量可删除。关闭弹框会放弃本次修改。': 'Built-in parameters are retained. Unused custom variables can be deleted. Closing discards your changes.',
  '内置参数保留。未引用的自定义变量可删除；关闭弹框会放弃本次修改。': 'Built-in parameters are retained. Unused custom variables can be deleted. Closing discards your changes.',
  '删除内置变量会同步移除各方案中的对应配置，计算时使用系统默认值。关闭弹框会放弃本次修改。': 'Deleting a built-in variable removes its setting from every plan; calculations use the system default. Closing discards your changes.',
  '逐项继承全局或自定义，修改数值会自动切换为自定义。': 'Inherit each global value or customize it. Editing a value makes it custom.',
  '每项可继承全局或自定义，统一单位为 K Token。': 'Each value can inherit global settings or be customized. Unit: K tokens.',
  '按所选 LLM 的输入前缀边界展示 · 单位 K Token': 'Based on the selected LLM input prefix · Unit: K tokens',
  '仅 LLM 可展开 · Action 按来源 Turn 分组': 'Only LLM calls expand · Actions are grouped by source turn',
  '人民币目录价按 2026-10-27 USD/CNY 6.6684 折算，汇率不自动更新。': 'CNY list prices converted at USD/CNY 6.6684 on Oct 27, 2026. Exchange rates are not updated automatically.',
  '手动固定档位模拟：每次请求输入量 > 下限且 ≤ 上限；不自动跨档。': 'Fixed tier simulation: each request input is above the lower bound and at or below the upper bound. Tiers do not change automatically.',
  '整个会话按所选闲时 / 忙时价格计算；原数据未提供时段边界。': 'The entire session uses the selected off-peak or peak rate; the source does not specify time boundaries.',
  '离峰 / 高峰按官方 UTC 时段计费；峰时费率为离峰两倍。': 'Off-peak and peak rates follow the official UTC periods; peak rates are twice off-peak rates.',
  'Standard 文本价格，手动固定短 / 长上下文档位，不自动跨档；不包含缓存写入、工具调用和地区附加费用。': 'Standard text rates with a fixed short or long context tier. Cache writes, tool calls, and regional surcharges are excluded.',
  'Claude API 标准文本价格；命中输入采用缓存读取价格，未命中输入采用基础输入价格，不包含缓存写入、工具调用和地区附加费用。': 'Claude API standard text rates. Cache hits use read rates; misses use base input rates. Cache writes, tools, and regional surcharges are excluded.',
  'Gemini API 付费 Standard 文本价格，输出含思考 Token；不包含缓存存储、搜索及其他工具费用。': 'Gemini API paid Standard text rates; output includes thinking tokens. Cache storage, search, and other tool costs are excluded.',
  'Mistral API 标准文本费率；仅保留当前常用的旗舰、大众与轻量型号。': 'Mistral API standard text rates for selected flagship, general, and lightweight models.',
  'xAI API 标准文本价格；输入上下文达到 200K 后整次请求按长上下文价格计算。缓存写入不另收费。': 'xAI API standard text rates. Requests with 200K or more input use long-context rates. Cache writes have no additional charge.',
  '整个会话按所选固定档位估算，不自动跨档。': 'The entire session uses the selected fixed tier; tiers do not change automatically.',
  '整个会话采用固定价格。': 'The entire session uses fixed rates.',
  '各方案默认使用以下数值，也可在方案内单独设置。': 'Plans use these values by default. You can override them in each plan.',
  '配置仅保存在本次页面会话，刷新前请导出。所有计算在浏览器内完成。': 'Configuration is kept only for this page session. Export before refreshing. All calculations run in your browser.',
  '收起方案详情 ': 'Collapse details for ', '展开方案详情 ': 'Expand details for ',
  '模型和费用跟随全局配置。': 'Model and rates follow the global settings.',
  '费率快照：': 'Rate snapshot: ',
  '不联网更新，不调用真实模型。': 'No automatic updates or live model calls.',
  '关闭弹框会放弃本次修改。': 'Closing this dialog discards your changes.',
  '还没有自定义变量，可在下方新增。': 'No custom variables yet. Add one below.',
  '当前为单方案模拟，新增方案后即可比较费用差异。': 'One plan is being simulated. Add another to compare costs.',
  '本轮没有模型调用。': 'No model calls in this turn.',
  '该次调用没有输入动作。': 'This call has no input actions.',
  '当前方案没有用户轮次。': 'This plan has no user turns.',
  '正在计算会话成本…': 'Calculating session cost…',
  '新增一个方案，开始探索成本。': 'Add a plan to explore costs.',
  '虽然prefix相同, 但缓存过期等多种场景会无法命中': 'An identical prefix may still miss due to cache expiry or other conditions.',
  '模拟暂时失败，请调整参数重试': 'Simulation failed. Adjust the settings and try again.',
  '已撤销上一次修改': 'Last change undone', '已复制方案': 'Plan copied', '已新增方案': 'Plan added',
  '已更新对比基准': 'Baseline updated', '已删除方案，可撤销': 'Plan deleted. You can undo this.',
  '已导出实验配置': 'Configuration exported', '配置已导入': 'Configuration imported',
  '已恢复默认方案': 'Default plans restored', '导入失败：': 'Import failed: ',
  '文件不能超过 4 MB': 'File must be 4 MB or smaller',
  '请输入 0–100%': 'Enter a value from 0 to 100%',
  '请输入整数': 'Enter a whole number',
  '请输入非负有限单价': 'Enter a finite, non-negative USD rate',
  '请输入模型名称': 'Enter a model name',
  '模型费率请统一使用美元（$）': 'Model rates must use USD ($)',
  '请选择压缩阈值类型': 'Select a compression threshold type',
  '阈值必须大于保留轮次': 'Threshold must exceed the retained turns',
  '阈值必须大于 0': 'Threshold must be greater than 0',
  '压缩阈值必须大于 0': 'Compression threshold must be greater than 0',
  '不能超过 Skills 总数': 'Cannot exceed total skills',
  '不能超过 Tools 总数': 'Cannot exceed total tools',
  '全局配置无效': 'Global settings are invalid',
  '方案缺少参数或模型配置': 'Plan is missing settings or model configuration',
  '方案名称已存在': 'Plan name already exists',
  '方案名称不能重复': 'Plan names must be unique',
  '方案标识不能重复': 'Plan IDs must be unique',
  '方案名称需为 1–60 个字符': 'Plan name must have 1–60 characters',
  '请选择有效的全局模型': 'Select a valid global model',
  '当前自定义费率': 'Current custom rates', '内置费率快照': 'Built-in rate snapshot',
  '仅支持 Session v4 配置（K Token）。': 'Only Session v4 configuration (K tokens) is supported.',
  '仅支持 v4 多方案配置，或导入 v2 / v3 旧配置（K Token）。': 'Only v4 multi-plan configuration or legacy v2/v3 configuration (K tokens) can be imported.',
  '配置缺少': 'Configuration is missing ',
  'flow 必须是流程配置对象': 'Flow must be a configuration object',
  '全局参数设置无效': 'Global parameter settings are invalid',
  '方案需要唯一标识': 'Plan needs a unique ID',
  '方案颜色无效': 'Plan color is invalid',
  '方案不支持字段': 'Plan does not support field ',
  '不支持字段': 'does not support field ',
  '变量仍被引用：': 'Variable is still referenced: ',
  '请先修改这些公式。': 'Edit those formulas first.',
  '请使用 v4 多方案配置（K Token）': 'Use a v4 multi-plan configuration (K tokens)',
  'Base模式无效': 'Base mode is invalid',
  '对比方案需使用相同币种': 'Comparison plans must use the same currency',
  '请选择有效的Base': 'Select a valid baseline',
  '方案配置无效': 'Plan configuration is invalid',
  '当前用户轮次索引（从 0 开始）': 'Current user turn index (starting at 0)',
  '当前步骤前已执行的模型调用数': 'Model calls completed before this step',
  'trigger 必须是触发配置对象': 'Trigger must be a configuration object',
  'trigger.type 必须是 probability 或 interval': 'Trigger type must be probability or interval',
  '触发概率必须是 0–100 的有限数值（%）': 'Trigger probability must be a finite value from 0 to 100%',
  '触发间隔必须是正整数（用户消息轮次）': 'Trigger interval must be a positive number of user turns',
  'Token 必须是非负有限数值': 'Token length must be finite and non-negative',
  'Token 必须是数值、公式字符串或非空参数名数组': 'Token length must be a number, formula, or non-empty array of parameter names',
  '未知 Token 参数：': 'Unknown token parameter: ',
  'Token 乘积超出可计算范围': 'Token product exceeds the calculation range',
  '初始上下文不支持 trigger；请在每轮流程中设置触发方式': 'Initial context does not support triggers; set them in the per-turn flow',
  '优惠价格截至 2026-11-30；仅支持隐式缓存。2026-12-01 起输入 / 命中 / 输出为 $4 / $0.2 / $20。': 'Promotional rates end Nov 30, 2026; implicit caching only. From Dec 1, input / cached / output rates are $4 / $0.2 / $20.',
  '请输入有效的全局模型名称和非负费率': 'Enter a valid global model name and non-negative rates',
  '变量名已存在': 'Variable name already exists',
  '最多支持 100 个自定义变量': 'Up to 100 custom variables are supported',
  '请输入非负数值': 'Enter a non-negative number',
  '数值超出可计算范围，请减小参数。': 'A value exceeds the calculation range. Reduce the settings.',
  'MCP Token Lab · 会话成本实验室': 'MCP Token Lab · Session Cost Lab',
  '方案全部变量': 'All plan variables', '全部全局变量': 'All global variables',
  '模型与费率': 'Model and rates', '全部变量': 'All variables', '全局配置': 'Global settings',
  '对比方案': 'Compare plans', '恢复默认方案': 'Restore default plans', '新增方案': 'Add plan',
  '方案 / 模型': 'Plan / model', '会话总费用': 'Total session cost', '相对基准': 'vs. baseline',
  '初始上下文': 'Initial context', '峰值输入': 'Peak input', '上下文压缩': 'Context compression', 'LLM次数': 'LLM calls',
  '未触发压缩': 'No compression', '当前基准': 'Current baseline', '设为基准': 'Set as baseline',
  '复制方案': 'Copy plan', '删除方案': 'Delete plan', '复制': 'Copy', '删除': 'Delete', '撤销修改': 'Undo change', '撤销': 'Undo',
  '导入配置': 'Import config', '导出配置': 'Export config', '配置操作': 'Configuration actions',
  '在新标签页打开 GitHub 仓库': 'Open GitHub repository in a new tab',
  '方案详情': 'plan details', ' 的更多操作': ' actions', '更多': 'More', '基准': 'Baseline',
  '展开': 'Expand', '收起': 'Collapse', '操作': 'Actions', '次': ' calls', '轮': ' turns', '个': '',
  '会话趋势': 'Session trend', '累计费用': 'Cumulative cost', '当轮费用': 'Turn cost',
  '圆点标记上下文压缩。': 'Dots mark context compression.', '费用归因': 'Cost breakdown',
  '结果分析': 'Results analysis', '趋势指标': 'Trend metric',
  '各方案的会话趋势图': 'Session trend chart for all plans',
  '各方案费用来源堆叠条形图': 'Cost source stacked bar chart for all plans',
  '请求明细': 'Request details', '请求明细方案': 'Request details plan',
  '定位轮次': 'Go to turn', '跳转': 'Go', '模型调用': 'Model calls',
  '次调用': ' calls', '查看字段说明': 'View field help',
  '次调用': ' calls', '最后一次调用': 'Last call', '命中缓存': 'Cache hit',
  '未命中缓存': 'Cache miss', '部分命中': 'Partial hit', '零 Token': 'Zero tokens',
  '可滚动的请求明细列表': 'Scrollable request details',
  '模型调用与输入动作': 'Model calls and input actions', '没有输入动作': 'No input actions',
  '的输入动作': ' input actions', '· 按来源 Turn 排列': '· Grouped by source turn',
  '按来源 Turn 分组': 'grouped by source turn', '命中': 'Hit', '未命中': 'Miss',
  '已定位到': 'Moved to', '已收起': 'collapsed', '已展开': 'expanded',
  '费用构成：': 'Cost breakdown: ', '初始上下文合计': 'Initial context total',
  '本轮新增内容与输出': 'Added context and output this turn',
  '整体输入命中率': 'Overall input hit rate', '峰值请求输入': 'Peak request input',
  '自定义流程': 'Custom flow', '设为Base': 'Set as base',
  '执行流程': 'Execution flow', '配置变量': 'Configure variables',
  '追加上下文': 'Add context', '调用模型': 'Call model', '每轮流程': 'Per-turn flow',
  '初始上下文步骤': 'Initial context steps', '每轮执行步骤': 'Per-turn steps',
  '已停用': 'Disabled', '模型输出': 'Model output', '追加内容': 'Added content',
  '固定值': 'Fixed value', '公式': 'Formula', '本轮未触发': 'Not triggered this turn',
  '查看错误': 'View error', '查看公式': 'View formula', '未配置步骤': 'No steps configured',
  '检查压缩条件': 'Check compression condition', '下一轮': 'Next turn',
  '活跃轮次': 'Active turns', '上下文': 'Context',
  '方案配置': 'Plan settings', '方案名称': 'Plan name',
  '压缩阈值类型': 'Compression threshold type', '继承全局': 'Inherit global',
  '自定义': 'Custom', '独立设置': 'Set independently',
  '管理全部变量与自定义变量': 'Manage all variables',
  '取消': 'Cancel', '保存配置': 'Save settings', '保存变量': 'Save variables',
  '应用到草稿': 'Apply to draft', '内置参数': 'Built-in parameters',
  '自定义变量': 'Custom variables', '新增变量': 'Add variable', '变量名': 'Variable name',
  '初始数值': 'Initial value', '添加变量': 'Add variable', '变量值': 'Variable value',
  '删除变量': 'Delete variable', '删除内置变量 ': 'Delete built-in variable ', '新变量名': 'New variable name',
  '新变量初始值': 'New variable initial value',
  '语言': 'Language', '例如': 'e.g.', '单价': 'rate', '全局': 'Global ',
  '模型名称': 'Model name', '全部变量全局模型': 'Global model in all variables', '全局模型': 'Global model',
  '全局模型名称': 'Global model name', '全部变量压缩阈值类型': 'Compression threshold in all variables',
  '模型': 'Model', '手动费率': 'Manual rates', '查看来源 ↗': 'View source ↗',
  '关闭方案配置': 'Close plan settings', '关闭全部变量': 'Close all variables',
  '新增节点': 'Add node', '编辑节点': 'Edit node', '节点名称': 'Node name',
  '节点类型': 'Node type', '启用节点': 'Enable node', '触发方式': 'Trigger',
  '每轮触发': 'Every turn', '按百分比触发': 'By probability',
  '每 N 轮消息触发': 'Every N user turns', '触发概率（%）': 'Trigger probability (%)',
  '消息轮次间隔': 'User turn interval', 'Token 长度': 'Token length',
  '固定数值': 'Fixed number', 'Token 公式': 'Token formula',
  '固定 Token 长度（K）': 'Fixed token length (K)', '当前预览：': 'Preview: ',
  '保存节点': 'Save node', '关闭提示': 'Dismiss notice', '关闭说明': 'Close guide',
  '关闭': 'Close', '从假设，到成本。': 'From assumptions to costs.',
  '设置统一的会话轮次与工具规模。': 'Set the shared session length and tool count.',
  '配置方案变量和执行流程。': 'Configure plan variables and execution flow.',
  '选择基准，比较成本和上下文变化。': 'Choose a baseline and compare cost and context.',
  '开始探索': 'Start exploring',
  '会话规模': 'Session size', '用户轮次': 'User turns', 'Skills 总数': 'Total skills',
  'Tools 总数': 'Total tools', '每轮平均 Skills': 'Average skills per turn',
  '每轮平均 Tools': 'Average tools per turn', '缓存': 'Cache',
  'Prefix 命中率': 'Prefix hit rate', '单个 Skill 索引': 'Skill index per item',
  '单个 Tool 索引': 'Tool index per item', '单个 Tool Schema': 'Tool schema per item',
  '每轮内容与输出': 'Turn content and output', '用户消息': 'User message',
  '单个 Skill 内容': 'Skill content per item', '单个 Tool Result': 'Tool result per item',
  '读取技能计划': 'Read skill plan', '查询 Schema 计划': 'Query schema plan',
  '调用工具计划': 'Call tool plan', 'Agent 最终回复': 'Agent final response',
  '活跃用户轮次阈值': 'Active user turn threshold',
  '上下文触发阈值': 'Context threshold', '保留最近用户轮次': 'Recent user turns to keep',
  '压缩摘要长度': 'Compression summary length', '压缩阈值': 'Compression threshold',
  '命中输入': 'Cached input', '未命中输入': 'Uncached input',
  '官方美元费率快照': 'Official USD rate snapshot',
  '官方人民币价按核验日汇率折算': 'Official CNY rates converted at verification date',
  '短上下文': 'Short context', '长上下文': 'Long context',
  '标准价格': 'Standard rate', '固定价格': 'Fixed rate',
  '闲时': 'Off-peak', '忙时': 'Peak', '非高峰': 'Off-peak', '高峰': 'Peak',
  '海外 API': 'Overseas API', '华北2（北京）': 'China North 2 (Beijing)',
  '百炼': 'Bailian', '输入': 'input', '输出': 'output',
  '按需 Tools': 'On-demand tools', '全量 Tools': 'All tools',
  'MCP渐进式Tools Schema': 'MCP progressive Tools Schema', '渐进式Tools Schema': 'Progressive Tools Schema', 'MCP默认全量tools/list': 'MCP default full tools/list',
  '自定义方案': 'Custom plan', '新方案': 'New plan', ' 副本': ' copy',
  '方案': 'Plan', '调用': 'call',
  '新的上下文': 'New context', 'Skills 索引': 'Skills index',
  'Tools 索引': 'Tools index', '初始 Tools Schema': 'Initial tools schema',
  'Skills 内容': 'Skills content', '按需 Tools Schema': 'On-demand tools schema',
  '压缩保留轮次': 'Retained turns', '压缩摘要': 'Compression summary',
  '压缩上下文': 'Compressed context', '上下文压缩': 'Context compression',
  '平均': 'Avg. ', '第 ': 'Step ', ' 步': ' step',
  '最多支持': 'Supports up to', '个方案': ' plans',
  '请输入': 'Enter ', '不能超过': 'Cannot exceed ', '必须大于': 'Must exceed ',
  '请使用': 'Use ', '请选择': 'Select ', '无效': ' is invalid',
  '费用': 'Cost', '数值': 'value',
};

const entries = Object.entries(english).sort((a, b) => b[0].length - a[0].length);
export function translateUi(value) {
  if (locale.value === 'zh' || value == null) return value;
  let result = String(value);
  if (Object.hasOwn(english, result)) return english[result];
  const range = /^(.*?)请输入 (\d+(?:\.\d+)?)(?:–(\d+(?:\.\d+)?))?( 及以上的有限)?数值$/.exec(result);
  if (range) {
    const label = range[1] ? `${translateUi(range[1])}: ` : '';
    return `${label}Enter a finite number ${range[3] ? `from ${range[2]} to ${range[3]}` : `of at least ${range[2]}`}`;
  }
  result = result
    .replace(/保持执行流程一致，将 Prefix 命中率设置为 (\d+)%，比较缓存对费用的影响。/g, 'Keep the same flow with a $1% Prefix cache hit rate to compare the effect on costs.')
    .replace(/活跃用户轮次达到 (\d+) 轮后压缩，保留最近 2 轮，摘要长度为 4 K Token。/g, 'Compress after $1 active user turns, retaining the latest 2 turns with a 4 K token summary.')
    .replace(/每 (\d+) 轮压缩/g, 'Compress every $1 turns')
    .replace(/最多对比 (\d+) 个方案/g, 'Compare up to $1 plans')
    .replace(/每 (\d+) 轮触发/g, 'Every $1 turns')
    .replace(/(\d+) 个已启用模型节点/g, '$1 enabled model nodes')
    .replace(/(\d+)% 概率触发/g, '$1% trigger probability')
    .replace(/请先修复「(.+?)」的公式再删除变量/g, 'Fix the formula in “$1” before deleting the variable')
    .replace(/已展开，动作按来源 Turn 分组/g, 'expanded; actions grouped by source turn')
    .replace(/(flow\.\w+) 必须是步骤数组/g, '$1 must be an array of steps')
    .replace(/(flow\.\w+ 第 \d+ 步) 必须是步骤对象/g, '$1 must be a step object')
    .replace(/必须是非负有限数值/g, 'must be finite and non-negative')
    .replace(/必须是布尔值/g, 'must be a boolean')
    .replace(/需要非空名称/g, 'needs a non-empty name')
    .replace(/(\d+)\s*轮 · (\d+)\s*次 LLM 调用 · 默认展开每轮最后一次调用/g, '$1 turns · $2 LLM calls · Last call in each turn expanded by default')
    .replace(/在第\s*(\d+)\s*步之前新增节点/g, 'Add node before step $1')
    .replace(/在第\s*(\d+)\s*步之后新增节点/g, 'Add node after step $1')
    .replace(/删除第\s*(\d+)\s*步/g, 'Delete step $1')
    .replace(/编辑第\s*(\d+)\s*步(.+?)，按 Alt 加上下方向键排序/g, 'Edit step $1$2; use Alt+Up/Down to reorder')
    .replace(/(\d+)\s*次模型调用 \/ 本轮/g, '$1 model calls this turn')
    .replace(/(\d+)\s*次调用/g, '$1 calls')
    .replace(/平均\s*([\d,.]+)\s*轮/g, 'Avg. $1 turns')
    .replace(/第\s*(\d+)\s*轮/g, 'Turn $1')
    .replace(/第\s*(\d+)\s*步/g, 'Step $1')
    .replace(/(\d+)\s*轮/g, '$1 turns')
    .replace(/(\d+)\s*次/g, '$1 calls');
  for (const [source, target] of entries) result = result.replaceAll(source, target);
  return result.replaceAll('，', ', ').replaceAll('；', '; ').replaceAll('。', '.').replaceAll('：', ': ')
    .replaceAll('（', ' (').replaceAll('）', ')').replaceAll('「', '“').replaceAll('」', '”');
}

export function installDomTranslations(root = document.body) {
  const texts = new WeakMap(), attributes = new WeakMap();
  const names = ['aria-label', 'aria-description', 'title', 'placeholder'];
  function renderText(node) {
    const current = node.nodeValue;
    let record = texts.get(node);
    if (!record || current !== record.rendered) record = { source: current, rendered: current };
    const next = translateUi(record.source);
    record.rendered = next;
    texts.set(node, record);
    if (current !== next) node.nodeValue = next;
  }
  function renderAttribute(element, name) {
    const current = element.getAttribute(name);
    if (current == null) return;
    let records = attributes.get(element);
    if (!records) { records = new Map(); attributes.set(element, records); }
    let record = records.get(name);
    if (!record || current !== record.rendered) record = { source: current, rendered: current };
    const next = translateUi(record.source);
    record.rendered = next;
    records.set(name, record);
    if (current !== next) element.setAttribute(name, next);
  }
  function walk(node) {
    if (node.nodeType === Node.TEXT_NODE) { renderText(node); return; }
    if (node.nodeType !== Node.ELEMENT_NODE || ['SCRIPT', 'STYLE', 'TEXTAREA'].includes(node.tagName)) return;
    for (const name of names) renderAttribute(node, name);
    for (const child of node.childNodes) walk(child);
  }
  const observer = new MutationObserver(changes => {
    for (const change of changes) {
      if (change.type === 'characterData') renderText(change.target);
      else if (change.type === 'attributes') renderAttribute(change.target, change.attributeName);
      else for (const child of change.addedNodes) walk(child);
    }
  });
  observer.observe(root, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: names });
  walk(root);
  return { refresh: () => walk(root), disconnect: () => observer.disconnect() };
}
