# Token Lab

按需求文档实现的 Vue 3 Agent Token 与费用对比页面。使用 Vite 开发与构建，Node.js 20.19+ 或 22.12+ 可运行。

```sh
cd /Users/zhanghongen/Desktop/chagee/ai/token-calculator
npm install
npm run dev
```

打开终端显示的本地地址。运行测试：`npm test`，生产构建：`npm run build`。

## 代码结构

- `src/config.js`：参数定义、默认值、费率快照、输入校验。
- `src/on-demand.js`：按需方案，每轮四次请求，显式累计和更新上下文。
- `src/full-load.js`：全量方案，每轮三次请求，显式累计和更新上下文。
- `src/accounting.js`：固定长度来源账本、请求和轮次费用汇总。
- `src/App.vue`：Vue 页面、响应式状态和业务交互。
- `src/main.js`：Vue 应用入口。
- `src/utils.js`：格式化、文件下载和 CSV 安全转义。
- `src/style.css`：桌面和移动布局。
- `src/calculator.test.js`：需求验收数据、费用归因守恒、冷启动、零费率和大轮次测试。

## 计算口径

输入参数界面以 K 为 Token 单位，核心计算先转换为 Token，不在中间步骤取整。两个方案独立按需求中的原始顺序逐步执行，不使用闭式公式。费用使用双精度数值，中间不舍入，仅显示时格式化；测试以浮点容差验证归因守恒。本工具用于费用模拟，不作财务结算。

默认初始上下文已预热，首请求视为缓存命中，预热成本不包含。冷启动开关仅改变首请求初始上下文的计费类别。计划和最终回复在生成时计输出费用，随后回传时再计输入费用。工具返回只计输入费用。

模型费率是需求文档中 2026-09-21 核实的 USD 快照，不会自动联网更新。Flash 的兼容名称 deepseek-v4-flash 对应实际 V4.1 Flash。高峰/非高峰由用户手动选择。可增加自定义模型并编辑单价。

配置保存在浏览器 localStorage，导出 JSON 可用于备份并重新导入。CSV 包含两个方案的完整请求或来源明细、参数、费率快照和冷启动状态。所有计算发生在本地，无真实模型调用。
