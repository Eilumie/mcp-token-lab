---
name: mcp-token-lab
description: 为 MCP Token Lab 生成或修改可导入的多方案 JSON 模板，比较 Agent 流程、工具 Schema 加载、缓存、上下文压缩、模型费用或预估耗时。适用于生成方案对比模板、将 Agent 流程转换为配置；不用于真实模型调用或通用 JSON 转换。
---

# MCP Token Lab 方案对比

根据用户的 Agent 流程和比较目标，交付含模板名称、模板描述及各方案说明的 UTF-8 `.json` 文件。页面在浏览器本地模拟，无需 API Key；配置只保存实验设置，不保存计算结果。

## 生成或修改

1. 阅读 [导入契约](references/import-format.md)，提取轮次、Skills / Tools 规模、上下文长度、模型调用顺序、缓存、压缩、费率和节点耗时。用户未指定且已有配置未提供时，采用 **100 轮、100 个 Tools、TOKEN 模式的 100K 压缩阈值**。关键业务差异不明时询问；可估算数值注明假设后继续。
2. 根据下表只读取相关示例，复制后调整。通常生成 2–8 个方案，用户只要一个时允许单方案。同一任务保持轮次、工具返回量、模型费率及相同步骤耗时一致，只改变实验变量；用户明确比较的差异予以保留。修改已有文件时保留无关设置及元信息。
3. 按契约填写完整配置和流程，确保全局继承开关没有覆盖方案独立值。新模板及各方案都填写说明；方案说明可用 `{{变量名}}` 展示实际参数，语法见契约。使用用户提供或已有配置中的费率并保留来源；仅在用户要求当前价格时核对官方来源，未知费率标注为假设。
4. 按下节校验后交付文件链接、方案差异和主要假设，附操作路径：**页面 → 模板 → 导入自定义模板 → 选择 JSON → 使用模板**。应用模板会替换当前整份配置，可撤销。用户明确要求普通配置时仅交付内部 `config`，说明没有模板名称和介绍；要求纯 JSON 时只返回合法 JSON。

## 按场景选择示例

| 比较目标 | 参考文件 | 重点 |
| --- | --- | --- |
| 简单双方案或没有匹配场景 | [双方案示例](assets/comparison.example.json) | 全量预加载与按需 Schema；采用 Skill 默认规模 |
| 工具加载策略，不触发压缩 | [progressive-tool-no-compress](assets/examples/progressive-tool-no-compress.json) | 全量、Hosted Tool Search、渐进加载；25 轮 |
| 工具加载策略与常规压缩 | [progressive-tool-100k](assets/examples/progressive-tool-100k.json) | 同上三种策略；100 轮、100K 阈值 |
| 更高的压缩阈值 | [progressive-tool-200k](assets/examples/progressive-tool-200k.json) | 同上三种策略；100 轮、200K 阈值 |
| 不同工具搜索方式 | [tool-search](assets/examples/tool-search.json) | 全量与 Regex / BM25 / Semantic Top 5 |
| 工具分组与常用工具常驻 | [tool-namespace-hybrid](assets/examples/tool-namespace-hybrid.json) | 扁平全量、Namespace、常驻 + 按需；间隔触发 |
| 工具返回内容精简 | [tool-result-shaping](assets/examples/tool-result-shaping.json) | 原始结果、字段投影、批量聚合 |

六个内置示例均为完整可导入模板，可随 Skill 独立使用。它们保留网页场景的 **120 个工具**等参数；默认只借鉴流程，不覆盖上文的生成默认值。用户明确要求复现内置场景时保留其参数；更改轮次、工具数或阈值后同步更新说明和依赖变量。无压缩场景以 TURN 阈值大于总轮次实现，增加轮次时也须调整阈值。示例费率可能为保存的价格快照或演示假设，不会实时更新；耗时为估算，估算差异不代表模型质量相同或真实计费结果。

## 校验与维护

有目标仓库源码和已安装依赖时，交付前必须从仓库根目录执行完整模拟与严格校验：

```bash
node skills/mcp-token-lab/scripts/validate-config.mjs --repo . <输出文件.json> --simulate --strict
```

校验器复用应用的导入器与模拟引擎，不另建 Schema。`--simulate` 检查全部轮次，`--strict` 拒绝未解析变量、非法说明表达式和未配对的双花括号。文件不得超过 4 MB。没有源码或依赖时，检查 JSON 语法及契约中的字段、继承、变量和流程，并明确说明尚未进行应用导入和完整模拟验证。

维护内置示例时，以仓库 `src/config/default-template/` 为来源，不直接修改生成的 `assets/examples/`。从仓库根目录同步：

```bash
node skills/mcp-token-lab/scripts/sync-builtins.mjs --repo .
```

追加 `--check` 可只检查同步状态；`pnpm test` 会检查示例同步状态并对所有示例运行严格校验和完整模拟。
