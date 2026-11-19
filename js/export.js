// Token export: CSS custom properties and JSON.

import { STEPS } from './scales.js';
import { NEUTRAL_ROLES, DISTINCT_ROLES, STATUS_ROLES, MODES, SPEC, MAX_CATEGORICAL } from './palette.js';

function modeVars(t) {
  const lines = [`  --dv-surface: ${t.surface};`];
  for (const role of Object.keys(NEUTRAL_ROLES)) {
    lines.push(`  --dv-${role}: ${t.neutral[role].hex}; /* ${t.neutral[role].ref} */`);
  }
  for (const role of Object.keys(DISTINCT_ROLES)) {
    lines.push(`  --dv-${role}: ${t.distinct[role].hex}; /* ${t.distinct[role].ref} */`);
  }
  t.cat.forEach((c, i) => lines.push(`  --dv-cat-${i + 1}: ${c.hex}; /* ${c.ref} */`));
  t.seq.forEach((c, i) => lines.push(`  --dv-seq-${i + 1}: ${c.hex}; /* ${c.ref} */`));
  t.div.forEach((c, i) => lines.push(`  --dv-div-${i + 1}: ${c.hex}; /* ${c.ref} */`));
  for (const role of Object.keys(STATUS_ROLES)) {
    lines.push(`  --dv-status-${role}: ${t.status[role].hex}; /* ${t.status[role].ref} */`);
  }
  return lines.join('\n');
}

export function toCss({ scales, tokens }) {
  const scaleLines = [];
  for (const [id, steps] of Object.entries(scales)) {
    for (const s of steps) scaleLines.push(`  --dv-${id}-${s.step}: ${s.hex};`);
  }
  return [
    '/* Dataviz kleurschalen */',
    ':root {',
    scaleLines.join('\n'),
    '}',
    '',
    `/* Chartregels: maximaal ${MAX_CATEGORICAL} categorische kleuren, daarboven alles in --dv-cat-1. Geen donuts. */`,
    ':root {',
    `  --dv-gap: ${SPEC.gap}px; /* ruimte tussen segmenten */`,
    `  --dv-radius: ${SPEC.radius}px;`,
    `  --dv-stroke-baseline: ${SPEC.baseline}px; /* basis-as */`,
    `  --dv-stroke-axis: ${SPEC.axis}px; /* overige assen en gridlines */`,
    '}',
    '',
    '/* Light mode (surface #FFFFFF) */',
    ':root,',
    '[data-theme="light"] {',
    modeVars(tokens.light),
    '}',
    '',
    '/* Dark mode (surface #1E1E1E) */',
    '[data-theme="dark"] {',
    modeVars(tokens.dark),
    '}',
    '',
  ].join('\n');
}

export function toJson({ scales, tokens }) {
  const out = {
    rules: {
      maxCategorical: MAX_CATEGORICAL,
      moreCategories: 'Meer categorieën: alles in categorical[0]',
      reservedGrey: 'Grijs, zwart en wit alleen voor distinct (totaal, gemiddelde, overig, ontbrekend)',
      pie: 'Taart toegestaan, donut niet',
      gap: SPEC.gap,
      radius: SPEC.radius,
      strokeBaseline: SPEC.baseline,
      strokeAxis: SPEC.axis,
    },
    scales: {},
    light: {},
    dark: {},
  };
  for (const [id, steps] of Object.entries(scales)) {
    out.scales[id] = Object.fromEntries(STEPS.map((step, i) => [step, steps[i].hex]));
  }
  const slim = (t) => ({ value: t.hex, ref: t.ref, contrast: Math.round(t.contrast * 100) / 100 });
  for (const mode of MODES) {
    const t = tokens[mode];
    out[mode] = {
      surface: t.surface,
      neutral: Object.fromEntries(Object.keys(NEUTRAL_ROLES).map((r) => [r, slim(t.neutral[r])])),
      distinct: Object.fromEntries(Object.keys(DISTINCT_ROLES).map((r) => [r, slim(t.distinct[r])])),
      categorical: t.cat.map((c) => ({ name: c.name, ...slim(c) })),
      sequential: t.seq.map(slim),
      diverging: t.div.map(slim),
      status: Object.fromEntries(Object.keys(STATUS_ROLES).map((r) => [r, slim(t.status[r])])),
    };
  }
  return JSON.stringify(out, null, 2) + '\n';
}
