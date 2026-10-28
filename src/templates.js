import { createComparisonConfig, createPlan, planColors, readComparisonConfig } from './comparison.js';

export function createTemplate(config, name, description = '') {
  if (typeof name !== 'string' || !name.trim() || name.trim().length > 100) throw new Error('模板名称需为 1–100 个字符');
  if (typeof description !== 'string' || description.length > 1000) throw new Error('模板介绍不能超过 1000 个字符');
  return {
    type: 'token-lab-template', version: 1, name: name.trim(), description: description.trim(),
    config: readComparisonConfig(JSON.parse(JSON.stringify(config))),
  };
}

export function readTemplate(data, fallbackName = '自定义模板') {
  if (data?.type === 'token-lab-template') {
    if (data.version !== 1) throw new Error('不支持的模板版本');
    return createTemplate(data.config, data.name, data.description ?? '');
  }
  return createTemplate(readComparisonConfig(data), fallbackName);
}

export function createBuiltinTemplates() {
  const schema = createComparisonConfig();
  schema.plans[0].description = '先加载工具索引，每轮按需读取工具 Schema，减少初始上下文。';
  schema.plans[1].description = '初始加载全部工具 Schema，每轮直接调用工具，减少查询步骤。';

  const cache = createComparisonConfig();
  cache.plans = [0, 0.5, 0.9].map((rate, index) => {
    const plan = createPlan({ id: `cache-${index}`, name: `Prefix 命中率 ${rate * 100}%`, color: planColors[index] });
    plan.description = `保持执行流程一致，将 Prefix 命中率设置为 ${rate * 100}%，比较缓存对费用的影响。`;
    plan.useGlobal.expectedPrefixCacheHitRate = false;
    plan.simulation.expectedPrefixCacheHitRate = rate;
    return plan;
  });
  cache.baselineId = cache.plans[0].id;

  const compression = createComparisonConfig();
  compression.plans = [5, 10, 20].map((turns, index) => {
    const plan = createPlan({ id: `compression-${index}`, name: `每 ${turns} 轮压缩`, color: planColors[index] });
    plan.description = `活跃用户轮次达到 ${turns} 轮后压缩，保留最近 2 轮，摘要长度为 4 K Token。`;
    for (const key of ['compressionThresholdType', 'compressionThresholdTurnCount', 'compressionKeepTurns', 'compressionTargetToken']) plan.useGlobal[key] = false;
    Object.assign(plan.simulation, { compressionThresholdType: 'TURN', compressionThresholdTurnCount: turns, compressionKeepTurns: 2, compressionTargetToken: 4 });
    return plan;
  });
  compression.baselineId = compression.plans[0].id;
  return [
    { id: 'builtin-schema', ...createTemplate(schema, 'Tools Schema 加载策略', '对比渐进式按需加载与默认全量加载，观察初始上下文和调用成本的差异。') },
    { id: 'builtin-cache', ...createTemplate(cache, 'Prefix 缓存收益', '使用相同流程，对比 0%、50% 和 90% 三档缓存命中率的费用变化。') },
    { id: 'builtin-compression', ...createTemplate(compression, '上下文压缩频率', '对比每 5、10、20 轮压缩的策略，观察上下文峰值与压缩费用的变化。') },
  ];
}
