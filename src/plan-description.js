import { tokenParameters } from './variables.js';

const placeholders = () => /\{\{\s*([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\}\}/g;

export function descriptionReferences(description) {
  return [...new Set([...String(description ?? '').matchAll(placeholders())].map(match => match[1]))];
}

export function descriptionVariables(simulation) {
  const removed = new Set(simulation?.removedFields || []);
  const builtins = Object.entries(tokenParameters).filter(([name]) => !removed.has(name)).map(([name, label]) => ({
    name, label, value: name.split('.').reduce((value, key) => value?.[key], simulation),
  }));
  const customs = Object.entries(simulation?.variables || {}).map(([name, variable]) => ({ name, ...variable }));
  return [...builtins, ...customs].filter(variable => Number.isFinite(variable.value));
}

export function renderPlanDescription(description, simulation) {
  const values = new Map(descriptionVariables(simulation).map(variable => [variable.name, variable.value]));
  return String(description ?? '').replace(placeholders(), (placeholder, name) => values.has(name) ? String(values.get(name)) : placeholder);
}
