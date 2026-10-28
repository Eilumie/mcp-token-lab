#!/usr/bin/env node
// Reuse the target application's importer rather than maintaining a second schema.
import { readFile, stat } from 'node:fs/promises';
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const args = process.argv.slice(2);
const usage = 'Usage: node validate-config.mjs --repo <repo-root> <config.json> [--simulate]';
let repo, file, simulate = false;
try {
  for (let index = 0; index < args.length; index++) {
    const arg = args[index];
    if (arg === '--repo' && !repo && args[index + 1] && !args[index + 1].startsWith('--')) repo = args[++index];
    else if (arg === '--simulate') simulate = true;
    else if (!arg.startsWith('--') && !file) file = arg;
    else throw new Error(usage);
  }
  if (!repo || !file) throw new Error(usage);
  repo = resolve(repo);
  file = resolve(file);
  await stat(resolve(repo, 'src/comparison.js'));
  const { readComparisonConfig, validateComparison } = await import(pathToFileURL(resolve(repo, 'src/comparison.js')).href);
  const raw = JSON.parse(await readFile(file, 'utf8'));
  const config = readComparisonConfig(raw);
  const errors = validateComparison(config);
  if (Object.keys(errors).length) throw new Error(JSON.stringify(errors));
  const output = { valid: true, file, version: config.version, plans: config.plans.length, simulated: false };
  if (simulate) {
    const { simulate: run } = await import(pathToFileURL(resolve(repo, 'src/session-report.js')).href);
    output.results = run(config).map(result => ({
      id: result.planId, name: result.planName,
      model: result.model.name, currency: result.model.currency,
      totalCost: result.cost.total,
    }));
    output.simulated = true;
  }
  console.log(JSON.stringify(output, null, 2));
} catch (error) {
  console.error(JSON.stringify({ valid: false, error: error.message }, null, 2));
  process.exitCode = 1;
}
