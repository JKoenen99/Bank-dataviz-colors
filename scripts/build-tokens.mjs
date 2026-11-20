// Checks the default palette against its own rules and writes tokens/.
//   node scripts/build-tokens.mjs          -> check, then write tokens/
//   node scripts/build-tokens.mjs --check  -> check only

import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SCALE_DEFS, MIN_CONTRAST } from '../js/scales.js';
import { DEFAULT_STATE, resolve, separation, MODES, NEUTRAL_ROLES, STATUS_ROLES, MAX_CATEGORICAL, RAMPS } from '../js/palette.js';
import { toCss, toJson } from '../js/export.js';

const resolved = resolve(DEFAULT_STATE);
const problems = [];
const fail = (msg) => problems.push(msg);

// 1. Scale rule: 50-600 reach 3:1 on dark, 400-1000 reach 3:1 on light.
for (const def of SCALE_DEFS) {
  for (const s of resolved.scales[def.id]) {
    if (s.step <= 600 && !s.passDark) fail(`${def.id}.${s.step} ${s.hex}: ${s.onDark.toFixed(2)}:1 op dark`);
    if (s.step >= 400 && !s.passLight) fail(`${def.id}.${s.step} ${s.hex}: ${s.onLight.toFixed(2)}:1 op light`);
  }
  // Each scale must get darker with every step.
  const steps = resolved.scales[def.id];
  for (let i = 1; i < steps.length; i++) {
    if (steps[i].onLight <= steps[i - 1].onLight) fail(`${def.id}.${steps[i].step} is niet donkerder dan ${steps[i - 1].step}`);
  }
}

// 2. Categorical rule: at most five colours, none of them grey.
if (DEFAULT_STATE.cat.length > MAX_CATEGORICAL) fail(`${DEFAULT_STATE.cat.length} categorische kleuren, maximaal ${MAX_CATEGORICAL}`);
DEFAULT_STATE.cat.forEach((c, i) => c.scale === 'grey' && fail(`cat-${i + 1} is grijs: grijs is gereserveerd voor bijzondere waarden`));
if (DEFAULT_STATE.seq.scale !== 'blue') fail(`sequentieel standaard ${DEFAULT_STATE.seq.scale}, verwacht blue`);

// 2b. Ramp rule: teal (green scale) is positive, red is negative, diverging is blue-red by default.
const EXPECTED_RAMPS = { seqPos: 'green', seqNeg: 'red', divNeg: 'red', divPos: 'blue', posNegNeg: 'red', posNegPos: 'green' };
for (const [key, scale] of Object.entries(EXPECTED_RAMPS)) {
  if (DEFAULT_STATE.ramps[key] !== scale) fail(`${key} gebruikt ${DEFAULT_STATE.ramps[key]}, verwacht ${scale}`);
}

// 3. Role rule: every mark colour reaches 3:1, label text reaches 4.5:1.
//    Distinct values: total and other are marks, missing may stay recessive.
for (const mode of MODES) {
  const t = resolved.tokens[mode];
  for (const role of ['total', 'other']) {
    const c = t.distinct[role];
    if (c.contrast < MIN_CONTRAST) fail(`${mode} ${role} ${c.hex}: ${c.contrast.toFixed(2)}:1`);
  }
  t.cat.forEach((c, i) => c.contrast < MIN_CONTRAST && fail(`${mode} cat-${i + 1} ${c.hex}: ${c.contrast.toFixed(2)}:1`));
  for (const role of Object.keys(STATUS_ROLES)) {
    const c = t.status[role];
    if (c.contrast < MIN_CONTRAST) fail(`${mode} status-${role} ${c.hex}: ${c.contrast.toFixed(2)}:1`);
  }
  for (const role of ['muted', 'text']) {
    const c = t.neutral[role];
    if (c.contrast < 4.5) fail(`${mode} ${role} ${c.hex}: ${c.contrast.toFixed(2)}:1 (tekst vraagt 4.5:1)`);
  }
}

console.log('Kleurschalen (contrast op light / dark)');
for (const def of SCALE_DEFS) {
  console.log(`  ${def.name.padEnd(7)} ${resolved.scales[def.id].map((s) => s.hex).join(' ')}`);
}
for (const mode of MODES) {
  const t = resolved.tokens[mode];
  const sep = separation(t.cat);
  console.log(`\n${mode} (${t.surface})`);
  for (const c of t.cat) console.log(`  ${c.name.padEnd(7)} ${c.ref.padEnd(11)} ${c.hex}  ${c.contrast.toFixed(2)}:1`);
  console.log(`  zwakste paar: ${sep.normal.value.toFixed(1)} (${sep.normal.pair}), kleurenblind ${sep.cvd.value.toFixed(1)} (${sep.cvd.pair})`);
  console.log(`  ${Object.keys(NEUTRAL_ROLES).map((r) => `${r} ${t.neutral[r].hex}`).join('  ')}`);
  console.log(`  ${Object.entries(t.distinct).map(([r, c]) => `${r} ${c.hex}`).join('  ')}`);
  for (const ramp of RAMPS) console.log(`  ${ramp.css.padEnd(10)} ${t[ramp.key].map((c) => c.hex).join(' ')}`);
  console.log(`  status (Emerald): ${Object.entries(t.status).map(([r, c]) => `${r} ${c.hex} ${c.contrast.toFixed(2)}:1`).join('  ')}`);
}

if (problems.length) {
  console.error(`\n${problems.length} probleem/problemen:`);
  for (const p of problems) console.error('  ✕ ' + p);
  process.exit(1);
}
console.log('\n✓ Alle regels gehaald.');

if (!process.argv.includes('--check')) {
  const dir = fileURLToPath(new URL('../tokens/', import.meta.url));
  mkdirSync(dir, { recursive: true });
  writeFileSync(dir + 'tokens.css', toCss(resolved));
  writeFileSync(dir + 'tokens.json', toJson(resolved));
  console.log('tokens/tokens.css en tokens/tokens.json geschreven.');
}
