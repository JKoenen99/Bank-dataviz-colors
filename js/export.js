// Token export: CSS custom properties and JSON.

import { STEPS } from './scales.js';
import { NEUTRAL_ROLES, DISTINCT_ROLES, STATUS_ROLES, MODES, SPEC, MAX_CATEGORICAL, RAMPS } from './palette.js';

function modeVars(t) {
  const lines = [`  --dv-surface: ${t.surface};`];
  for (const role of Object.keys(NEUTRAL_ROLES)) {
    lines.push(`  --dv-${role}: ${t.neutral[role].hex}; /* ${t.neutral[role].ref} */`);
  }
  for (const role of Object.keys(DISTINCT_ROLES)) {
    lines.push(`  --dv-${role}: ${t.distinct[role].hex}; /* ${t.distinct[role].ref} */`);
  }
  t.cat.forEach((c, i) => lines.push(`  --dv-cat-${i + 1}: ${c.hex}; /* ${c.ref} */`));
  for (const ramp of RAMPS) {
    t[ramp.key].forEach((c, i) => lines.push(`  --dv-${ramp.css}-${i + 1}: ${c.hex}; /* ${c.ref} */`));
  }
  for (const role of Object.keys(STATUS_ROLES)) {
    lines.push(`  --dv-status-${role}: ${t.status[role].hex}; /* ${t.status[role].token}, ${t.status[role].ref} */`);
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
    `/* Chartregels: maximaal ${MAX_CATEGORICAL} categorische kleuren, daarboven alles in --dv-cat-1. Geen donuts.\n   Status komt uit Emerald (icon/feedback/*): altijd met icoon of label, geen warning. */`,
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
      sequential: 'Standaard blauw. Teal voor van nature positieve waarden, rood voor van nature negatieve waarden',
      diverging: 'Standaard blauw-rood. Teal-rood als positief tegenover negatief duidelijk moet zijn',
      status: 'Statuskleuren zijn de feedbackkleuren van Emerald. Altijd met icoon of label. Geen warning, geen informative in charts',
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
      sequentialPositive: t.seqPos.map(slim),
      sequentialNegative: t.seqNeg.map(slim),
      diverging: t.div.map(slim),
      divergingPositiveNegative: t.divPosNeg.map(slim),
      status: Object.fromEntries(Object.keys(STATUS_ROLES).map((r) => [r, { token: t.status[r].token, ...slim(t.status[r]) }])),
    };
  }
  return JSON.stringify(out, null, 2) + '\n';
}

const DIV_LABELS = ['Negatief sterk', 'Negatief', 'Negatief zwak', 'Midden', 'Positief zwak', 'Positief', 'Positief sterk'];

/**
 * Every semantic token, grouped, with its light and dark value. The names
 * match the CSS custom properties without the leading `--`.
 */
export function semanticGroups(tokens) {
  const { light: L, dark: D } = tokens;
  const surface = (mode) => ({ hex: tokens[mode].surface, ref: 'surface', contrast: 1 });
  const nSeq = L.seq.length;
  return [
    {
      id: 'surface',
      title: 'Surface',
      note: 'De achtergrond waarop de chart staat. Alle contrastratio’s zijn hierop berekend.',
      rows: [{ name: 'dv-surface', role: 'Achtergrond', light: surface('light'), dark: surface('dark') }],
    },
    {
      id: 'neutral',
      title: 'Grijs: backdrop en lijnen',
      note: null,
      rows: Object.entries(NEUTRAL_ROLES).map(([r, label]) => ({ name: `dv-${r}`, role: label, light: L.neutral[r], dark: D.neutral[r] })),
    },
    {
      id: 'distinct',
      title: 'Bijzondere waarden',
      note: 'Grijs, zwart en wit: alleen voor totalen en gemiddelden, Overig en ontbrekende data.',
      rows: Object.entries(DISTINCT_ROLES).map(([r, label]) => ({ name: `dv-${r}`, role: label, light: L.distinct[r], dark: D.distinct[r] })),
    },
    {
      id: 'categorical',
      title: 'Categorisch',
      note: `Vaste volgorde. Meer dan ${MAX_CATEGORICAL} categorieën: alles in dv-cat-1.`,
      rows: L.cat.map((c, i) => ({ name: `dv-cat-${i + 1}`, role: `Kleur ${i + 1} · ${c.name}`, light: c, dark: D.cat[i] })),
    },
    ...RAMPS.map((ramp) => ({
      id: ramp.css,
      title: ramp.title,
      note: ramp.kind === 'seq' ? `${ramp.note} In dark mode gespiegeld: laag is donker.` : ramp.note,
      rows: L[ramp.key].map((c, i) => ({
        name: `dv-${ramp.css}-${i + 1}`,
        role:
          ramp.kind === 'seq'
            ? `Klasse ${i + 1} van ${nSeq}${i === 0 ? ' (laag)' : i === nSeq - 1 ? ' (hoog)' : ''}`
            : (DIV_LABELS[i] ?? `Stap ${i + 1}`),
        light: c,
        dark: D[ramp.key][i],
      })),
    })),
    {
      id: 'status',
      title: 'Status',
      note: 'Uit Emerald (icon/feedback/*), niet uit onze schalen. Altijd met icoon of label, nooit alleen kleur.',
      rows: Object.entries(STATUS_ROLES).map(([r, label]) => ({ name: `dv-status-${r}`, role: label, light: L.status[r], dark: D.status[r] })),
    },
  ];
}
