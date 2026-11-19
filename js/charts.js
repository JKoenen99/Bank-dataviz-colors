// Example charts, drawn as plain SVG. Every colour is a CSS variable set on
// the surrounding stage (--cat-1, --grid, ...), so the charts follow the
// palette without knowing its values.

import * as D from './data.js';

const nf = new Intl.NumberFormat('nl-NL');
const nf1 = new Intl.NumberFormat('nl-NL', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
export const eur = (v) => '€ ' + nf.format(Math.round(v));
const eurK = (v) => '€ ' + nf.format(v) + 'K';
const axisNum = (v) => (Math.abs(v) >= 10000 ? nf.format(v / 1000) + 'K' : nf.format(v));
const pct = (v) => nf1.format(v) + '%';
const signedPct = (v) => (v > 0 ? '+' : v < 0 ? '−' : '') + nf1.format(Math.abs(v)) + '%';

const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

/** Tooltip payload: a title and rows of [css colour | null, label, value]. */
const tip = (title, rows) => `data-tip="${esc(JSON.stringify({ t: title, r: rows }))}"`;

const cat = (i) => `var(--cat-${i + 1})`;
const sum = (a) => a.reduce((x, y) => x + y, 0);
const GAP = 2; // surface gap between touching marks

function ticks(min, max, target = 4) {
  const span = max - min || 1;
  const mag = 10 ** Math.floor(Math.log10(span / target));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= target + 0.5);
  const lo = Math.floor(min / step + 1e-9) * step;
  const hi = Math.ceil(max / step - 1e-9) * step;
  const out = [];
  for (let v = lo; v <= hi + step / 1e6; v += step) out.push(+v.toFixed(10));
  return out;
}

/** Bar with a rounded data end and a square end on the baseline. */
function bar(x, y, w, h, end, r = 4) {
  if (w <= 0 || h <= 0) return '';
  const rr = Math.min(r, w / 2, h / 2) * (end === 'none' ? 0 : 1);
  if (!rr) return `M${x},${y}h${w}v${h}h${-w}Z`;
  if (end === 'top') return `M${x},${y + h}V${y + rr}q0,${-rr} ${rr},${-rr}h${w - 2 * rr}q${rr},0 ${rr},${rr}V${y + h}Z`;
  if (end === 'right') return `M${x},${y}h${w - rr}q${rr},0 ${rr},${rr}v${h - 2 * rr}q0,${rr} ${-rr},${rr}H${x}Z`;
  if (end === 'left') return `M${x + w},${y}h${-(w - rr)}q${-rr},0 ${-rr},${rr}v${h - 2 * rr}q0,${rr} ${rr},${rr}H${x + w}Z`;
  return `M${x},${y}h${w}v${h}h${-w}Z`;
}

/** Horizontal gridlines, y tick labels and the baseline. */
function yFrame({ m, pw, tk, y, fmt, baseline = 0 }) {
  let out = '';
  for (const t of tk) {
    const isBase = t === baseline;
    out += `<line x1="${m.l}" x2="${m.l + pw}" y1="${y(t)}" y2="${y(t)}" stroke="var(--${isBase ? 'axis' : 'grid'})"/>`;
    out += `<text x="${m.l - 8}" y="${y(t)}" dy="0.32em" text-anchor="end" class="tick">${esc(fmt(t))}</text>`;
  }
  return out;
}

function xLabels({ labels, xAt, yPos, band }) {
  const every = Math.ceil(34 / band);
  return labels
    .map((l, i) =>
      i % every === 0 ? `<text x="${xAt(i)}" y="${yPos}" text-anchor="middle" class="tick">${esc(l)}</text>` : '',
    )
    .join('');
}

const svg = (w, h, body, label) =>
  `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;

// --- Columns (single, grouped, stacked) --------------------------------------

function columns({ w, h = 250, cats, series, stacked = false, label }) {
  const m = { t: 10, r: 6, b: 24, l: 42 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const peak = Math.max(
    ...cats.map((_, i) => (stacked ? sum(series.map((s) => s.values[i])) : Math.max(...series.map((s) => s.values[i])))),
  );
  const tk = ticks(0, peak);
  const top = tk.at(-1);
  const y = (v) => m.t + ph - (v / top) * ph;
  const band = pw / cats.length;
  const xAt = (i) => m.l + band * (i + 0.5);

  let out = yFrame({ m, pw, tk, y, fmt: axisNum });
  cats.forEach((c, i) => {
    const rows = series.map((s) => [s.color, s.name, eur(s.values[i])]);
    if (stacked) rows.push([null, 'Totaal', eur(sum(series.map((s) => s.values[i])))]);
    let marks = '';
    if (stacked) {
      const bw = Math.min(24, band * 0.6);
      let acc = 0;
      series.forEach((s, k) => {
        const y0 = y(acc);
        acc += s.values[i];
        const y1 = y(acc);
        const last = k === series.length - 1;
        marks += `<path d="${bar(xAt(i) - bw / 2, y1, bw, y0 - y1 - (k ? GAP : 0), last ? 'top' : 'none')}" fill="${s.color}"/>`;
      });
    } else {
      const n = series.length;
      const bw = Math.min(24, (band * 0.72 - GAP * (n - 1)) / n);
      const start = xAt(i) - (n * bw + (n - 1) * GAP) / 2;
      series.forEach((s, k) => {
        const yy = y(s.values[i]);
        marks += `<path d="${bar(start + k * (bw + GAP), yy, bw, y(0) - yy, 'top')}" fill="${s.color}"/>`;
      });
    }
    out += `<g class="band" ${tip(c, rows)}><rect class="hover" x="${m.l + band * i + 1}" y="${m.t}" width="${band - 2}" height="${ph}" rx="4"/>${marks}</g>`;
  });
  // The baseline sits on top of the hover band.
  out += `<line x1="${m.l}" x2="${m.l + pw}" y1="${y(0)}" y2="${y(0)}" stroke="var(--axis)"/>`;
  out += xLabels({ labels: cats, xAt, yPos: h - 6, band });
  return svg(w, h, out, label);
}

// --- Lines ---------------------------------------------------------------------

function lines({ w, h = 250, x, series, label }) {
  const m = { t: 12, r: 44, b: 24, l: 42 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const all = series.flatMap((s) => s.values);
  const tk = ticks(Math.min(...all), Math.max(...all));
  const [lo, hi] = [tk[0], tk.at(-1)];
  const y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph;
  const stepX = pw / (x.length - 1);
  const xAt = (i) => m.l + stepX * i;

  let out = yFrame({ m, pw, tk, y, fmt: axisNum, baseline: lo });
  for (const s of series) {
    const pts = s.values.map((v, i) => `${xAt(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    out += `<polyline points="${pts}" fill="none" stroke="${s.color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
  }
  // End markers, plus a value label on the highest and lowest series only.
  const ends = series.map((s) => s.values.at(-1));
  series.forEach((s, k) => {
    const v = ends[k];
    out += `<circle cx="${xAt(x.length - 1)}" cy="${y(v)}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`;
    if (v === Math.max(...ends) || v === Math.min(...ends)) {
      out += `<text x="${xAt(x.length - 1) + 9}" y="${y(v)}" dy="0.32em" class="value">${esc(nf1.format(v))}</text>`;
    }
  });
  // Crosshair: one hit band per x position.
  x.forEach((label_, i) => {
    const rows = series.map((s) => [s.color, s.name, nf1.format(s.values[i])]);
    const dots = series
      .map((s) => `<circle cx="${xAt(i)}" cy="${y(s.values[i])}" r="4" fill="${s.color}" stroke="var(--surface)" stroke-width="2"/>`)
      .join('');
    out += `<g class="xband" ${tip(label_, rows)}><rect x="${xAt(i) - stepX / 2}" y="${m.t}" width="${stepX}" height="${ph}" fill="transparent"/><g class="reveal"><line x1="${xAt(i)}" x2="${xAt(i)}" y1="${m.t}" y2="${m.t + ph}" stroke="var(--axis)"/>${dots}</g></g>`;
  });
  out += xLabels({ labels: x, xAt, yPos: h - 6, band: stepX });
  return svg(w, h, out, label);
}

// --- Stacked area ---------------------------------------------------------------

function stackedArea({ w, h = 250, x, series, label }) {
  const m = { t: 10, r: 10, b: 24, l: 42 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const totals = x.map((_, i) => sum(series.map((s) => s.values[i])));
  const tk = ticks(0, Math.max(...totals));
  const top = tk.at(-1);
  const y = (v) => m.t + ph - (v / top) * ph;
  const stepX = pw / (x.length - 1);
  const xAt = (i) => m.l + stepX * i;

  let out = yFrame({ m, pw, tk, y, fmt: (v) => (v ? v + 'K' : '0') });
  let base = x.map(() => 0);
  const edges = [];
  series.forEach((s) => {
    const upper = base.map((b, i) => b + s.values[i]);
    const up = upper.map((v, i) => `${xAt(i).toFixed(1)},${y(v).toFixed(1)}`);
    const down = base.map((v, i) => `${xAt(i).toFixed(1)},${y(v).toFixed(1)}`).reverse();
    out += `<polygon points="${[...up, ...down].join(' ')}" fill="${s.color}"/>`;
    edges.push(up.join(' '));
    base = upper;
  });
  // Surface-coloured seams keep neighbouring bands apart.
  edges.slice(0, -1).forEach((e) => {
    out += `<polyline points="${e}" fill="none" stroke="var(--surface)" stroke-width="${GAP}"/>`;
  });
  x.forEach((label_, i) => {
    const rows = [...series].reverse().map((s) => [s.color, s.name, eurK(s.values[i])]);
    rows.push([null, 'Totaal', eurK(totals[i])]);
    out += `<g class="xband" ${tip(label_, rows)}><rect x="${xAt(i) - stepX / 2}" y="${m.t}" width="${stepX}" height="${ph}" fill="transparent"/><g class="reveal"><line x1="${xAt(i)}" x2="${xAt(i)}" y1="${m.t}" y2="${m.t + ph}" stroke="var(--text)"/></g></g>`;
  });
  out += `<line x1="${m.l}" x2="${m.l + pw}" y1="${y(0)}" y2="${y(0)}" stroke="var(--axis)"/>`;
  out += xLabels({ labels: x, xAt, yPos: h - 6, band: stepX });
  return svg(w, h, out, label);
}

// --- Donut -----------------------------------------------------------------------

function donut({ w, segments, label }) {
  const size = Math.min(w, 230);
  const h = size;
  const cx = w / 2;
  const cy = h / 2;
  const R = size / 2 - 4;
  const r = R * 0.62;
  const total = sum(segments.map((s) => s.value));
  let a = -Math.PI / 2;
  const pt = (rad, ang) => `${(cx + rad * Math.cos(ang)).toFixed(2)},${(cy + rad * Math.sin(ang)).toFixed(2)}`;
  let out = '';
  for (const s of segments) {
    const a1 = a + (s.value / total) * Math.PI * 2;
    const large = a1 - a > Math.PI ? 1 : 0;
    out += `<path class="mark" d="M${pt(R, a)}A${R},${R} 0 ${large} 1 ${pt(R, a1)}L${pt(r, a1)}A${r},${r} 0 ${large} 0 ${pt(r, a)}Z" fill="${s.color}" stroke="var(--surface)" stroke-width="${GAP}" ${tip(s.name, [[s.color, 'Aandeel', pct((s.value / total) * 100)]])}/>`;
    a = a1;
  }
  out += `<text x="${cx}" y="${cy - 4}" text-anchor="middle" class="hero">€ 48,6K</text>`;
  out += `<text x="${cx}" y="${cy + 16}" text-anchor="middle" class="tick">totaal belegd</text>`;
  return svg(w, h, out, label);
}

// --- Scatter -----------------------------------------------------------------------

function scatter({ w, h = 250, groups, label }) {
  const m = { t: 10, r: 12, b: 38, l: 42 };
  const pw = w - m.l - m.r;
  const ph = h - m.t - m.b;
  const pts = groups.flatMap((g) => g.points);
  const xt = ticks(0, Math.max(...pts.map((p) => p.x)), 5);
  const yt = ticks(0, Math.max(...pts.map((p) => p.y)));
  const x = (v) => m.l + (v / xt.at(-1)) * pw;
  const y = (v) => m.t + ph - (v / yt.at(-1)) * ph;
  let out = yFrame({ m, pw, tk: yt, y, fmt: (v) => v + '%' });
  for (const t of xt) {
    out += `<text x="${x(t)}" y="${m.t + ph + 16}" text-anchor="middle" class="tick">${t}%</text>`;
  }
  out += `<text x="${m.l + pw / 2}" y="${h - 4}" text-anchor="middle" class="tick">Risico (volatiliteit)</text>`;
  for (const g of groups) {
    for (const p of g.points) {
      out += `<g class="dot" ${tip(p.label, [[g.color, 'Rendement', pct(p.y)], [null, 'Risico', pct(p.x)]])}><circle cx="${x(p.x)}" cy="${y(p.y)}" r="12" fill="transparent"/><circle class="mark" cx="${x(p.x)}" cy="${y(p.y)}" r="5" fill="${g.color}" stroke="var(--surface)" stroke-width="2"/></g>`;
    }
  }
  return svg(w, h, out, label);
}

// --- Heatmap (sequential or diverging) -------------------------------------------

function heatmap({ w, rows, cols, values, classOf, colorVar, fmt, labelW = 26, label }) {
  const m = { t: 4, r: 4, b: 20, l: labelW };
  const cw = (w - m.l - m.r) / cols.length;
  const ch = Math.min(26, Math.max(18, cw * 0.8));
  const h = m.t + ch * rows.length + m.b;
  let out = '';
  rows.forEach((rName, ri) => {
    out += `<text x="${m.l - 8}" y="${m.t + ch * (ri + 0.5)}" dy="0.32em" text-anchor="end" class="tick">${esc(rName)}</text>`;
    cols.forEach((cName, ci) => {
      const v = values[ri][ci];
      const color = `var(--${colorVar}-${classOf(v) + 1})`;
      out += `<rect class="mark" x="${m.l + cw * ci + GAP / 2}" y="${m.t + ch * ri + GAP / 2}" width="${cw - GAP}" height="${ch - GAP}" rx="3" fill="${color}" ${tip(`${rName} · ${cName}`, [[color, 'Waarde', fmt(v)]])}/>`;
    });
  });
  out += xLabels({ labels: cols, xAt: (i) => m.l + cw * (i + 0.5), yPos: h - 5, band: cw });
  return svg(w, h, out, label);
}

// --- Diverging bars -----------------------------------------------------------------

function divergingBars({ w, items, label }) {
  const rowH = 26;
  const m = { t: 4, r: 46, b: 4, l: 104 };
  const pw = w - m.l - m.r;
  const h = m.t + rowH * items.length + m.b;
  const max = Math.max(...items.map((d) => Math.abs(d.value)));
  const zero = m.l + pw / 2;
  const scale = (pw / 2 - 40) / max;
  let out = '';
  items.forEach((d, i) => {
    const cy = m.t + rowH * (i + 0.5);
    const len = Math.max(1.5, Math.abs(d.value) * scale);
    const pos = d.value >= 0;
    const color = pos ? 'var(--div-neg)' : 'var(--div-pos)';
    out += `<g class="band" ${tip(d.name, [[color, pos ? 'Boven budget' : 'Onder budget', signedPct(d.value)]])}><rect class="hover" x="0" y="${cy - rowH / 2 + 1}" width="${w}" height="${rowH - 2}" rx="4"/>`;
    out += `<text x="${m.l - 10}" y="${cy}" dy="0.32em" text-anchor="end" class="label">${esc(d.name)}</text>`;
    out += `<path d="${bar(pos ? zero : zero - len, cy - 7, len, 14, pos ? 'right' : 'left')}" fill="${color}"/>`;
    out += `<text x="${pos ? zero + len + 6 : zero - len - 6}" y="${cy}" dy="0.32em" text-anchor="${pos ? 'start' : 'end'}" class="value">${signedPct(d.value)}</text></g>`;
  });
  out += `<line x1="${zero}" x2="${zero}" y1="${m.t}" y2="${h - m.b}" stroke="var(--axis)"/>`;
  return svg(w, h, out, label);
}

export function sparkline(values, w = 96, h = 28) {
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const x = (i) => 4 + (i / (values.length - 1)) * (w - 8);
  const y = (v) => h - 5 - ((v - lo) / (hi - lo || 1)) * (h - 10);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
  return `<svg viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--cat-1)" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${x(values.length - 1)}" cy="${y(values.at(-1))}" r="3.5" fill="var(--cat-1)" stroke="var(--surface)" stroke-width="2"/></svg>`;
}

// --- Chart catalogue ------------------------------------------------------------------

const withColors = (series, n) => series.slice(0, n).map((s, i) => ({ ...s, color: cat(i) }));
const seriesTable = (first, cats, series, fmt) => ({
  head: [first, ...series.map((s) => s.name)],
  rows: cats.map((c, i) => [c, ...series.map((s) => fmt(s.values[i]))]),
});
const legendOf = (series, type) => series.map((s) => ({ label: s.name, color: s.color, type }));

/** Class index for a value on a sequential scale with n classes. */
const seqClass = (min, max, n) => (v) => Math.min(n - 1, Math.floor(((v - min) / (max - min || 1)) * n));
/** Class index 0-6 on the diverging scale, 3 = around zero. */
const divClass = (max) => (v) => {
  const t = Math.abs(v) / max;
  const k = t < 0.1 ? 0 : t < 0.4 ? 1 : t < 0.7 ? 2 : 3;
  return v < 0 ? 3 - k : 3 + k;
};

export const CHARTS = [
  {
    id: 'single',
    title: 'Uitgaven per maand',
    subtitle: 'Enkele reeks, in de eerste categorische kleur',
    render({ w }) {
      const series = [{ name: 'Uitgaven', values: D.monthlySpend.values, color: cat(0) }];
      return {
        svg: columns({ w, cats: D.monthlySpend.cats, series, label: 'Uitgaven per maand' }),
        legend: [],
        table: seriesTable('Maand', D.monthlySpend.cats, series, eur),
      };
    },
  },
  {
    id: 'grouped',
    title: 'Inkomsten en uitgaven',
    subtitle: 'Twee reeksen naast elkaar',
    render({ w }) {
      const series = withColors(D.incomeVsSpend.series, 2);
      return {
        svg: columns({ w, cats: D.incomeVsSpend.cats, series, label: 'Inkomsten en uitgaven per maand' }),
        legend: legendOf(series, 'rect'),
        table: seriesTable('Maand', D.incomeVsSpend.cats, series, eur),
      };
    },
  },
  {
    id: 'stacked',
    title: 'Uitgaven per categorie',
    subtitle: 'Gestapeld, alle categorische kleuren',
    render({ w, n }) {
      const series = withColors(D.spendByCategory.series, n);
      return {
        svg: columns({ w, cats: D.spendByCategory.cats, series, stacked: true, label: 'Uitgaven per categorie per maand' }),
        legend: legendOf(series, 'rect'),
        table: seriesTable('Maand', D.spendByCategory.cats, series, eur),
      };
    },
  },
  {
    id: 'lines',
    title: 'Koersontwikkeling fondsen',
    subtitle: 'Index, januari = 100. Test voor dunne lijnen',
    render({ w, n }) {
      const series = withColors(D.funds.series, n);
      return {
        svg: lines({ w, x: D.funds.x, series, label: 'Koersontwikkeling van fondsen' }),
        legend: legendOf(series, 'line'),
        table: seriesTable('Maand', D.funds.x, series, (v) => nf1.format(v)),
      };
    },
  },
  {
    id: 'area',
    title: 'Vermogensopbouw',
    subtitle: 'Gestapelde vlakken, in duizenden euro',
    render({ w }) {
      const series = withColors(D.wealth.series, 4);
      return {
        svg: stackedArea({ w, x: D.wealth.x, series, label: 'Vermogensopbouw per jaar' }),
        legend: legendOf(series, 'rect'),
        table: seriesTable('Jaar', D.wealth.x, series, eurK),
      };
    },
  },
  {
    id: 'donut',
    title: 'Portefeuilleverdeling',
    subtitle: 'Aangrenzende segmenten',
    render({ w, n }) {
      const head = D.portfolio.slice(0, n);
      const rest = sum(D.portfolio.slice(n).map((s) => s.value));
      if (rest) head[n - 1] = { name: 'Overig', value: head[n - 1].value + rest };
      const segments = head.map((s, i) => ({ ...s, color: cat(i) }));
      return {
        svg: donut({ w, segments, label: 'Verdeling van de beleggingsportefeuille' }),
        legend: segments.map((s) => ({ label: s.name, value: s.value + '%', color: s.color, type: 'rect' })),
        table: { head: ['Categorie', 'Aandeel'], rows: segments.map((s) => [s.name, s.value + '%']) },
      };
    },
  },
  {
    id: 'scatter',
    title: 'Risico en rendement',
    subtitle: 'Losse punten, elke kleur kan naast elke andere staan',
    render({ w }) {
      const groups = D.riskReturn.map((g, i) => ({ ...g, color: cat(i) }));
      return {
        svg: scatter({ w, groups, label: 'Risico tegenover rendement per fonds' }),
        legend: groups.map((g) => ({ label: g.name, color: g.color, type: 'dot' })),
        table: {
          head: ['Fonds', 'Risico', 'Rendement'],
          rows: groups.flatMap((g) => g.points.map((p) => [p.label, pct(p.x), pct(p.y)])),
        },
      };
    },
  },
  {
    id: 'heatmap',
    title: 'Betalingen per dag en uur',
    subtitle: 'Sequentieel palet',
    render({ w, tokens }) {
      const { rows, cols, values } = D.activity;
      const flat = values.flat();
      const n = tokens.seq.length;
      const [lo, hi] = [Math.min(...flat), Math.max(...flat)];
      return {
        svg: heatmap({ w, rows, cols, values, classOf: seqClass(lo, hi, n), colorVar: 'seq', fmt: (v) => v + ' betalingen', label: 'Aantal betalingen per weekdag en uur' }),
        legend: [],
        scale: { colorVar: 'seq', count: n, from: `${lo}`, to: `${hi} betalingen` },
        table: { head: ['Dag', ...cols.map((c) => c + ' u')], rows: rows.map((r, i) => [r, ...values[i]]) },
      };
    },
  },
  {
    id: 'divmap',
    title: 'Maandrendement per sector',
    subtitle: 'Divergerend palet, neutraal midden',
    render({ w }) {
      const { rows, cols, values } = D.sectorReturns;
      const max = Math.max(...values.flat().map(Math.abs));
      return {
        svg: heatmap({ w, rows, cols, values, classOf: divClass(max), colorVar: 'div', fmt: signedPct, labelW: 104, label: 'Maandrendement per sector' }),
        legend: [],
        scale: { colorVar: 'div', count: 7, from: signedPct(-max), to: signedPct(max) },
        table: { head: ['Sector', ...cols], rows: rows.map((r, i) => [r, ...values[i].map(signedPct)]) },
      };
    },
  },
  {
    id: 'deviation',
    title: 'Afwijking van budget',
    subtitle: 'Divergerend: boven of onder budget',
    render({ w }) {
      return {
        svg: divergingBars({ w, items: D.budgetDeviation, label: 'Afwijking van budget per categorie' }),
        legend: [
          { label: 'Onder budget', color: 'var(--div-pos)', type: 'rect' },
          { label: 'Boven budget', color: 'var(--div-neg)', type: 'rect' },
        ],
        table: { head: ['Categorie', 'Afwijking'], rows: D.budgetDeviation.map((d) => [d.name, signedPct(d.value)]) },
      };
    },
  },
];
