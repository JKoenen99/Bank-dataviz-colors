// Colour math: sRGB <-> OKLCH, WCAG contrast, gamut mapping, CVD simulation.
// No dependencies; runs in the browser and in Node.

export const clamp = (v, lo = 0, hi = 1) => Math.min(hi, Math.max(lo, v));

export function normalizeHex(input) {
  if (typeof input !== 'string') return null;
  let h = input.trim().replace(/^#/, '');
  if (/^[0-9a-fA-F]{3}$/.test(h)) h = h.split('').map((c) => c + c).join('');
  if (!/^[0-9a-fA-F]{6}$/.test(h)) return null;
  return '#' + h.toUpperCase();
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex).slice(1);
  return [0, 2, 4].map((i) => parseInt(h.slice(i, i + 2), 16) / 255);
}

export function rgbToHex(rgb) {
  return (
    '#' +
    rgb
      .map((v) => Math.round(clamp(v) * 255).toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

const toLinear = (c) => (c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
const toGamma = (c) => (c <= 0.0031308 ? 12.92 * c : 1.055 * c ** (1 / 2.4) - 0.055);

export const linearize = (rgb) => rgb.map(toLinear);
export const delinearize = (lin) => lin.map(toGamma);

/** WCAG 2.x relative luminance of a linear-RGB triple. */
export const luminanceLinear = ([r, g, b]) => 0.2126 * r + 0.7152 * g + 0.0722 * b;
export const luminance = (hex) => luminanceLinear(linearize(hexToRgb(hex)));

/** WCAG 2.x contrast ratio between two hex colours. */
export function contrast(a, b) {
  const la = luminance(a);
  const lb = luminance(b);
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// --- OKLab (Björn Ottosson) -------------------------------------------------

export function linearToOklab([r, g, b]) {
  const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
  return [
    0.2104542553 * l + 0.793617785 * m - 0.0040720468 * s,
    1.9779984951 * l - 2.428592205 * m + 0.4505937099 * s,
    0.0259040371 * l + 0.7827717662 * m - 0.808675766 * s,
  ];
}

export function oklabToLinear([L, a, b]) {
  const l = (L + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m = (L - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s = (L - 0.0894841775 * a - 1.291485548 * b) ** 3;
  return [
    4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
    -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
    -0.0041960863 * l - 0.7034186147 * m + 1.707614701 * s,
  ];
}

export const hexToOklab = (hex) => linearToOklab(linearize(hexToRgb(hex)));

export function hexToOklch(hex) {
  const [L, a, b] = hexToOklab(hex);
  const C = Math.hypot(a, b);
  let h = (Math.atan2(b, a) * 180) / Math.PI;
  if (h < 0) h += 360;
  return { l: L, c: C, h };
}

function oklchToLinear(l, c, h) {
  const rad = (h * Math.PI) / 180;
  return oklabToLinear([l, c * Math.cos(rad), c * Math.sin(rad)]);
}

const inGamut = (lin, eps = 1e-5) => lin.every((v) => v >= -eps && v <= 1 + eps);

/** Largest chroma (<= cMax) that stays inside sRGB for the given lightness and hue. */
export function maxChroma(l, h, cMax = 0.4) {
  if (inGamut(oklchToLinear(l, cMax, h))) return cMax;
  let lo = 0;
  let hi = cMax;
  for (let i = 0; i < 24; i++) {
    const mid = (lo + hi) / 2;
    if (inGamut(oklchToLinear(l, mid, h))) lo = mid;
    else hi = mid;
  }
  return lo;
}

/** OKLCH -> hex, reducing chroma until the colour fits in sRGB. */
export function oklchToHex(l, c, h) {
  const cc = Math.min(c, maxChroma(l, h, Math.max(c, 1e-6)));
  return rgbToHex(delinearize(oklchToLinear(l, cc, h).map((v) => clamp(v))));
}

/**
 * Find the colour with the requested hue and (at most) the requested chroma
 * whose WCAG relative luminance equals `targetY`. Chroma is reduced where the
 * sRGB gamut cannot hold it. Luminance rises monotonically with OKLCH
 * lightness, so a bisection is enough.
 */
export function solveForLuminance(h, c, targetY) {
  let lo = 0;
  let hi = 1;
  let best = { l: 0.5, c: 0 };
  for (let i = 0; i < 30; i++) {
    const l = (lo + hi) / 2;
    const cc = Math.min(c, maxChroma(l, h, Math.max(c, 1e-6)));
    const y = luminanceLinear(oklchToLinear(l, cc, h).map((v) => clamp(v)));
    best = { l, c: cc };
    if (y < targetY) lo = l;
    else hi = l;
  }
  return { hex: oklchToHex(best.l, best.c, h), l: best.l, c: best.c, h };
}

/** Euclidean distance in OKLab, times 100. */
export function deltaE(hexA, hexB) {
  const a = hexToOklab(hexA);
  const b = hexToOklab(hexB);
  return 100 * Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

// --- Colour vision deficiency (Machado, Oliveira & Fernandes 2009, severity 1) --

export const CVD_MATRICES = {
  protan: [
    [0.152286, 1.052583, -0.204868],
    [0.114503, 0.786281, 0.099216],
    [-0.003882, -0.048116, 1.051998],
  ],
  deutan: [
    [0.367322, 0.860646, -0.227968],
    [0.280085, 0.672501, 0.047413],
    [-0.01182, 0.04294, 0.968881],
  ],
  tritan: [
    [1.255528, -0.076749, -0.178779],
    [-0.078411, 0.930809, 0.147602],
    [0.004733, 0.691367, 0.3039],
  ],
};

export function simulateCvd(hex, type) {
  const m = CVD_MATRICES[type];
  if (!m) return normalizeHex(hex);
  const lin = linearize(hexToRgb(hex));
  const out = m.map((row) => clamp(row[0] * lin[0] + row[1] * lin[1] + row[2] * lin[2]));
  return rgbToHex(delinearize(out));
}

/** Black or white, whichever reads better on the given fill. */
export function inkOn(hex) {
  return contrast(hex, '#FFFFFF') >= contrast(hex, '#000000') ? '#FFFFFF' : '#000000';
}
