# MCP Token Lab 中文说明

比较 MCP Agent 策略在多轮会话中的 Token 与预估费用变化。项目通过可配置假设做确定性计算，不执行真实 Agent，不连接 MCP Server，不调用模型 API，也不对真实 Schema 分词。

## 本地运行

使用 Node 22.12+（推荐 22 LTS）、pnpm 10.18.3。无需 API Key、后端或环境变量文件。

```sh
git clone https://github.com/zhangHongEn/token-lab.git
cd token-lab
npm install --global pnpm@10.18.3
pnpm install --frozen-lockfile
pnpm dev --host 127.0.0.1
```

打开 Vite 打印的地址。默认加载首个内置模板，合法参数修改后自动重新模拟。页头支持中英文切换。

```sh
pnpm test
pnpm build
node scripts/reproduce-example.mjs --check
```

## 第一次对比

在「模板 → 导入自定义模板」中选择 `docs/examples/strategy-comparison.json`，再点击「使用模板」。示例包含 100 轮、100 个工具、30 个技能、90% 期望前缀命中率、100K 压缩阈值，使用自定义示意费率。它与应用初始的 120 工具、三个方案的模板不同。

展开方案检查流程；查看费用趋势、归因与逐请求明细。把工具数量改为 10，其余参数保持不变，就能看到此模型中两种策略的费用排序反转。通过「导出配置」保存实验；刷新会丢失当前配置和导入模板，语言偏好单独保存在本地。

## 能力与边界

支持最多八方案、全局参数与方案覆盖、可编辑流程/公式/变量、固定种子概率触发、按轮数或上下文阈值压缩、静态模型费率与手动费率、模板导入导出。已有五个内置模板；名称代表建模方案，不代表已经接入相应服务。

所有长度以 K Token 表示，1K=1,000；费率为美元/百万 Token。缓存是期望值分摊，第一次请求的初始上下文也按配置命中率计费。每轮结束才检查压缩，最后一轮触发的压缩也计费。模型上下文上限和费率档位不会自动约束或切换。

“每轮平均 TTFT”当前实际是步骤设定耗时之和的平均值，不是实测首 Token 延迟。模型目录与汇率是静态快照，不能把元数据的核验日期当作当前价格保证。公开示例采用人为设定费率，不引用未经核验的市场报价，不承诺固定节省比例。

完整资料：[英文 README](../README.md)、[模拟模型与局限](simulation-model.md)、[可复现实验](examples/README.md)、[贡献指引](../CONTRIBUTING.md)、[页头设计](design/README.md)、[推广计划](marketing/plan.md)、[首批文案](marketing/launch-kit.md)。
