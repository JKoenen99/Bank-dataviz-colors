// Palette roles: which scale step does which job in each mode.
// `DEFAULT_STATE` is the proposal; the playground lets you change every choice.

import { buildAllScales, SCALE_DEFS, STEPS, SURFACE, MIN_CONTRAST, mirrorStep } from './scales.js';
import { contrast, deltaE, simulateCvd } from './color.js';

export const MODES = ['light', 'dark'];

export const DEFAULT_STATE = {
  v: 1,
  view: 'light', // light | dark | both
  cvd: 'none', // none | protan | deutan | tritan
  usePins: true,
  scales: {}, // scale id -> { chromaScale, hueShift, overrides: { step: hex } }
  demoCount: 5, // how many categories the example charts show (2-8)
  // Five colours in a fixed order: a chart with n series uses the first n
  // slots. With more than five categories every category gets slot 1.
  cat: [
    { name: 'Blue', scale: 'blue', light: 800, dark: 300 },
    { name: 'Teal', scale: 'green', light: 500, dark: 500 },
    { name: 'Yellow', scale: 'yellow', light: 400, dark: 200 },
    { name: 'Coral', scale: 'coral', light: 600, dark: 300 },
    { name: 'Purple', scale: 'purple', light: 400, dark: 400 },
  ],
  neutral: {
    backdrop: { light: 50, dark: 1000 },
    grid: { light: 100, dark: 900 },
    axis: { light: 200, dark: 800 },
    muted: { light: 600, dark: 400 },
    text: { light: 1000, dark: 50 },
  },
  // Grey, black and white are not categorical colours. They are reserved
  // for values that stand apart from the categories.
  distinct: {
    total: { light: 1000, dark: 50 },
    other: { light: 500, dark: 500 },
    missing: { light: 200, dark: 800 },
  },
  seq: { scale: 'blue', classes: 5 },
  div: { neg: 'coral', pos: 'blue' },
  status: {
    positive: { scale: 'green', light: 600, dark: 400 },
    negative: { scale: 'red', light: 600, dark: 400 },
    warning: { scale: 'yellow', light: 500, dark: 200 },
    neutral: { scale: 'grey', light: 500, dark: 500 },
  },
};

export const NEUTRAL_ROLES = {
  backdrop: 'Backdrop',
  grid: 'Gridlines',
  axis: 'As / baseline',
  muted: 'Labels',
  text: 'Tekst',
};

export const DISTINCT_ROLES = {
  total: 'Totaal, gemiddelde',
  other: 'Overig',
  missing: 'Ontbrekend',
};

/** More categories than this: every category gets the primary colour. */
export const MAX_CATEGORICAL = 5;

/** Chart geometry that belongs with the palette. */
export const SPEC = {
  gap: 2, // px between touching segments (bars, pie slices, cells, areas)
  radius: 4, // px corner radius on bars, cells and keys
  baseline: 2, // px stroke of the base axis (zero line)
  axis: 1, // px stroke of other axis lines, gridlines and crosshairs
};

export const STATUS_ROLES = {
  positive: 'Positief',
  negative: 'Negatief',
  warning: 'Waarschuwing',
  neutral: 'Neutraal',
};

export const scaleName = (id) => SCALE_DEFS.find((d) => d.id === id)?.name ?? id;

/** n steps spread evenly between 100 and 900. */
export function sequentialSteps(n) {
  const out = [];
  for (let i = 0; i < n; i++) out.push(STEPS[Math.round(1 + (8 * i) / (n - 1))]);
  return out;
}

const DIV_ARM = [200, 400, 600]; // weak -> strong, light mode
const DIV_MID = 100;

/** Resolve the state into concrete scales and per-mode tokens. */
export function resolve(state) {
  const scales = buildAllScales(state.scales, state.usePins);
  const pick = (scale, step) => {
    const s = scales[scale].find((x) => x.step === step) ?? scales[scale][5];
    return { hex: s.hex, ref: `${scale}.${s.step}`, scale, step: s.step };
  };
  const forMode = (mode, step) => (mode === 'light' ? step : mirrorStep(step));

  const tokens = {};
  for (const mode of MODES) {
    const surface = SURFACE[mode];
    const withContrast = (t) => ({ ...t, contrast: contrast(t.hex, surface) });
    const neutral = {};
    for (const role of Object.keys(NEUTRAL_ROLES)) {
      neutral[role] = withContrast(pick('grey', state.neutral[role][mode]));
    }
    const distinct = {};
    for (const role of Object.keys(DISTINCT_ROLES)) {
      distinct[role] = withContrast(pick('grey', state.distinct[role][mode]));
    }
    const status = {};
    for (const role of Object.keys(STATUS_ROLES)) {
      const s = state.status[role];
      status[role] = withContrast(pick(s.scale, s[mode]));
    }
    tokens[mode] = {
      surface,
      neutral,
      distinct,
      cat: state.cat
        .slice(0, MAX_CATEGORICAL)
        .map((slot) => ({ name: slot.name, ...withContrast(pick(slot.scale, slot[mode])) })),
      seq: sequentialSteps(state.seq.classes).map((step) =>
        withContrast(pick(state.seq.scale, forMode(mode, step))),
      ),
      div: [
        ...[...DIV_ARM].reverse().map((step) => pick(state.div.neg, forMode(mode, step))),
        pick('grey', forMode(mode, DIV_MID)),
        ...DIV_ARM.map((step) => pick(state.div.pos, forMode(mode, step))),
      ].map(withContrast),
      status,
    };
  }
  return { scales, tokens };
}

/**
 * How far apart are the categorical colours? Returns the weakest pair for
 * normal vision and under red-green colour blindness (OKLab distance x 100).
 * Rule of thumb: >= 15 normal and >= 8 simulated is comfortable.
 */
export function separation(cat) {
  let normal = { value: Infinity, pair: null };
  let cvd = { value: Infinity, pair: null };
  for (let i = 0; i < cat.length; i++) {
    for (let j = i + 1; j < cat.length; j++) {
      const pair = `${cat[i].name} / ${cat[j].name}`;
      const dn = deltaE(cat[i].hex, cat[j].hex);
      const dc = Math.min(
        ...['protan', 'deutan'].map((t) =>
          deltaE(simulateCvd(cat[i].hex, t), simulateCvd(cat[j].hex, t)),
        ),
      );
      if (dn < normal.value) normal = { value: dn, pair };
      if (dc < cvd.value) cvd = { value: dc, pair };
    }
  }
  return { normal, cvd };
}

export { MIN_CONTRAST };
