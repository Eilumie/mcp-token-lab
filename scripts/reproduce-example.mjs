import { readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { resolve, dirname } from 'node:path';
import assert from 'node:assert/strict';
import { readComparisonConfig } from '../src/comparison.js';
import { simulate } from '../src/session-report.js';

// Run the actual project engine. No provider API, copied formula, or random data.
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const read = path => readFileSync(resolve(root, path), 'utf8');
const raw = read('docs/examples/strategy-comparison.json');
const config = readComparisonConfig(JSON.parse(raw));
const reports = simulate(config);
const round = value => Number(value.toFixed(6));
const sha = value => createHash('sha256').update(value).digest('hex');
const summarize = r => ({
  plan: r.planName, initialContextK: round(r.initialContext),
  inputK: round(r.hit + r.miss), cachedInputK: round(r.hit), freshInputK: round(r.miss),
  outputK: round(r.output), estimatedCostUSD: round(r.cost.total),
  requests: r.requests.length, compressions: r.compressions.length,
});
const provenance = Object.fromEntries([
  'src/session.js', 'src/session-flow.js', 'src/session-report.js',
  'src/session-defaults.js', 'src/comparison.js', 'src/config.js',
  'src/token-formula.js', 'src/variables.js', 'src/model-pricing.js',
].map(path => [path, sha(read(path))]));
const summary = { description: 'Deterministic simulation; synthetic rates; not measured agent execution.', configSha256: sha(raw), engineSha256: provenance, plans: reports.map(summarize) };
const series = reports.map(r => {
  let cumulative = 0;
  return { name: r.planName, color: r.color, points: [{turn:0,inputK:0}, ...r.rounds.map(row => {
    cumulative += row.requestIds.reduce((sum, id) => sum + r.requests[id - 1].input, 0);
    return {turn:row.round,inputK:round(cumulative)};
  })] };
});
const csv = ['plan,turn,cumulative_input_k', ...series.flatMap(s => s.points.map(p => `${s.name},${p.turn},${p.inputK}`))].join('\n')+'\n';
const sensitivity = [];
for (const [factor, values] of [['toolsTotalCount',[10,100,300]],['expectedPrefixCacheHitRate',[0.1,0.5,0.9]]]) {
  for (const value of values) {
    const next = structuredClone(config); next.globalSimulation[factor] = value;
    sensitivity.push({factor,value,plans:simulate(next).map(summarize)});
  }
}
const max = Math.ceil(Math.max(...series.flatMap(s=>s.points.map(p=>p.inputK)))/10000)*10000;
const x = turn => 64 + turn / 100 * 650;
const y = value => 270 - value / max * 210;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 380" role="img" aria-labelledby="title desc">
<title id="title">Cumulative input tokens across 100 simulated turns</title>
<desc id="desc">Full schemas and progressive loading; input includes cached, fresh and compression requests, excludes outputs. 100 tools, 30 skills, 90% expected prefix cache hit, compression threshold 100K, keep 2 turns, summary 4K. Deterministic simulation, not a live agent benchmark.</desc>
<rect width="800" height="380" rx="12" fill="#fafaf7"/>
<g font-family="Arial,sans-serif" fill="#50584f"><text x="28" y="26" font-size="14">Cumulative input tokens (K)</text>
${[0,.25,.5,.75,1].map(v=>`<path d="M64 ${y(max*v)}H714" stroke="#dfe3da"/><text x="54" y="${y(max*v)+4}" text-anchor="end" font-size="12">${(max*v/1000).toFixed(0)},000</text>`).join('')}
${[0,25,50,75,100].map(t=>`<text x="${x(t)}" y="293" text-anchor="middle" font-size="12">${t}</text>`).join('')}
<text x="714" y="316" text-anchor="end" font-size="12">Simulated user turn</text>
${series.map((s,i)=>`<polyline fill="none" stroke="${s.color}" stroke-width="3" ${i===1?'stroke-dasharray="8 4"':''} points="${s.points.map(p=>`${x(p.turn).toFixed(2)},${y(p.inputK).toFixed(2)}`).join(' ')}"/><path d="M${28+i*235} 344h24" stroke="${s.color}" stroke-width="3" ${i===1?'stroke-dasharray="8 4"':''}/><text x="${60+i*235}" y="349" font-size="14">${s.name}</text>`).join('')}
<text x="28" y="373" font-size="11">Illustrative simulation · generated from strategy-comparison.json · no agent execution</text></g></svg>\n`;
const files = {
  'docs/examples/expected-results.json': JSON.stringify(summary,null,2)+'\n',
  'docs/examples/input-trend.csv': csv,
  'docs/examples/sensitivity-results.json':JSON.stringify(sensitivity,null,2)+'\n',
  'docs/design/assets/input-trend.svg':svg.replace('>0,000<','>0<'),
};
for(const [path,content] of Object.entries(files)) {
  if(process.argv.includes('--check')) assert.equal(read(path),content,`Outdated example artifact: ${path}`);
  else writeFileSync(resolve(root,path),content);
}
console.table(summary.plans);
console.log(process.argv.includes('--check') ? 'All four example artifacts match the current engine.' : 'Generated results, sensitivity analysis, CSV and SVG.');
