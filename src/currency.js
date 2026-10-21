// 统一比较所用的固定估算汇率；非实时外汇报价。
export const CNY_PER_USD = 7;
export const conversionNote = `人民币快照按 $1 = ¥${CNY_PER_USD} 的固定估算汇率换算，非实时汇率。`;
export const cnyToUsd = value => value / CNY_PER_USD;
