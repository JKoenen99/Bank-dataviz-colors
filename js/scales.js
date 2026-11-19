// Colour scale generator.
//
// Every scale shares one contrast grid: a step number always has the same
// WCAG contrast against the surfaces, whatever the hue. That makes the
// accessibility rule a property of the step, not of the individual colour:
//
//   steps  50-600  -> at least 3:1 on the dark surface  (#1E1E1E)
//   steps 400-1000 -> at least 3:1 on the light surface (#FFFFFF)
//
// The grid is symmetric: step s on white has the same contrast as step
// (1000 - s) on the dark surface (50 mirrors 1000).

import { solveForLuminance, luminance, contrast, normalizeHex, hexToOklch } from './color.js';

export const SURFACE = { light: '#FFFFFF', dark: '#1E1E1E' };
export const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000];
export const MIN_CONTRAST = 3;

/** Target contrast of each step against white. */
export const CONTRAST_ON_WHITE = {
  50: 1.09,
  100: 1.28,
  200: 1.65,
  300: 2.25,
  400: 3.12,
  500: 4.08,
  600: 5.34,
  700: 7.4,
  800: 10.1,
  900: 13.0,
  1000: 15.3,
};

/** The step with the same contrast in the other mode. */
export const mirrorStep = (step) => (step === 50 ? 1000 : step === 1000 ? 50 : 1000 - step);

const targetLuminance = (step) => 1.05 / CONTRAST_ON_WHITE[step] - 0.05;

// Hue (OKLCH degrees) and chroma per step, light -> dark. Brand colours are
// pinned to the step whose contrast they already have.
export const SCALE_DEFS = [
  {
    id: 'green',
    name: 'Green',
    note: 'ABN AMRO Dark Green op 800. De middentonen (400-600) zijn het teal.',
    hue: [186, 186, 186, 186, 187, 188, 190, 192, 194.8, 195, 195],
    chroma: [0.02, 0.04, 0.07, 0.095, 0.11, 0.11, 0.1, 0.085, 0.064, 0.055, 0.045],
    pins: { 800: '#004C4C' },
  },
  {
    id: 'blue',
    name: 'Blue',
    note: 'Loopt van #3CC0FE (300, dark mode) naar #004291 (800, light mode).',
    hue: [228, 229, 231, 233.9, 239, 244, 249, 254, 257.6, 259, 260],
    chroma: [0.025, 0.05, 0.095, 0.142, 0.15, 0.16, 0.165, 0.16, 0.143, 0.115, 0.085],
    pins: { 300: '#3CC0FE', 800: '#004291' },
  },
  {
    id: 'yellow',
    name: 'Yellow',
    note: 'ABN AMRO Yellow op 200. Donkere stappen schuiven naar oker/goud.',
    hue: [97, 94, 89.3, 86, 84, 81, 78, 75, 72, 69, 66],
    chroma: [0.045, 0.1, 0.17, 0.165, 0.15, 0.13, 0.112, 0.094, 0.076, 0.058, 0.042],
    pins: { 200: '#F3C000' },
  },
  {
    id: 'coral',
    name: 'Coral',
    note: 'Coral op 300. Donkere stappen worden terracotta.',
    hue: [40, 38, 36, 34.7, 33, 32, 31, 30, 30, 30, 30],
    chroma: [0.02, 0.045, 0.085, 0.123, 0.145, 0.15, 0.14, 0.12, 0.098, 0.075, 0.052],
    pins: { 300: '#F29179' },
  },
  {
    id: 'purple',
    name: 'Purple',
    note: 'Purple op 400.',
    hue: [290, 289, 288, 288, 287.6, 287, 286, 285, 284, 284, 284],
    chroma: [0.014, 0.028, 0.05, 0.07, 0.088, 0.105, 0.115, 0.112, 0.098, 0.078, 0.056],
    pins: { 400: '#928DC9' },
  },
  {
    id: 'red',
    name: 'Red',
    note: 'Alleen voor status (negatief). Roder dan coral zodat ze niet verward worden.',
    hue: [18, 18, 19, 20, 22, 24, 25, 26, 26, 26, 26],
    chroma: [0.02, 0.045, 0.09, 0.14, 0.18, 0.2, 0.195, 0.17, 0.14, 0.105, 0.075],
    pins: {},
  },
  {
    id: 'grey',
    name: 'Grey',
    note: 'Neutraal, sluit aan op bestaande tokens: #949494 op 400 en #7D7D7D op 500.',
    hue: [195, 195, 195, 195, 195, 195, 195, 195, 195, 195, 195],
    chroma: [0.006, 0.008, 0.01, 0.012, 0.014, 0.014, 0.014, 0.012, 0.01, 0.008, 0.006],
    chromaScale: 0,
    pins: { 400: '#949494', 500: '#7D7D7D' },
  },
];

export const defaultKnobs = (def) => ({ chromaScale: def.chromaScale ?? 1, hueShift: 0 });

/**
 * Build one scale.
 * @param def     entry of SCALE_DEFS
 * @param options { chromaScale, hueShift, usePins, overrides: {step: hex} }
 * @returns array of { step, hex, source, onLight, onDark, passLight, passDark }
 */
export function buildScale(def, options = {}) {
  const knobs = { ...defaultKnobs(def), usePins: true, overrides: {}, ...options };
  return STEPS.map((step, i) => {
    let hex;
    let source = 'generated';
    const override = normalizeHex(knobs.overrides?.[step] ?? '');
    if (override) {
      hex = override;
      source = 'override';
    } else if (knobs.usePins && def.pins?.[step]) {
      hex = normalizeHex(def.pins[step]);
      source = 'brand';
    } else {
      const hue = (def.hue[i] + knobs.hueShift + 360) % 360;
      hex = solveForLuminance(hue, def.chroma[i] * knobs.chromaScale, targetLuminance(step)).hex;
    }
    const onLight = contrast(hex, SURFACE.light);
    const onDark = contrast(hex, SURFACE.dark);
    return {
      step,
      hex,
      source,
      onLight,
      onDark,
      passLight: onLight >= MIN_CONTRAST,
      passDark: onDark >= MIN_CONTRAST,
    };
  });
}

/** Build every scale. `settings` is keyed by scale id. */
export function buildAllScales(settings = {}, usePins = true) {
  const out = {};
  for (const def of SCALE_DEFS) {
    out[def.id] = buildScale(def, { usePins, ...(settings[def.id] ?? {}) });
  }
  return out;
}

export { luminance, hexToOklch };
