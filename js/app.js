// Playground UI: state, rendering and events.

import { SCALE_DEFS, STEPS, SURFACE, defaultKnobs } from './scales.js';
import {
  DEFAULT_STATE,
  MODES,
  NEUTRAL_ROLES,
  DISTINCT_ROLES,
  STATUS_ROLES,
  MAX_CATEGORICAL,
  MIN_CONTRAST,
  resolve,
  separation,
  scaleName,
} from './palette.js';
import { contrast, normalizeHex, inkOn, CVD_MATRICES } from './color.js';
import { CHARTS, sparkline, eur } from './charts.js';
import * as D from './data.js';
import { toCss, toJson } from './export.js';
import { buildScalesSheet, buildTokensSheet, copySheetToFigma } from './figma.js';

const $ = (sel, root = document) => root.querySelector(sel);
const esc = (s) =>
  String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const fmt = (n) => n.toFixed(2);
const MODE_LABEL = { light: 'Light mode', dark: 'Dark mode' };
const SCALE_IDS = SCALE_DEFS.map((d) => d.id);
const HUE_SCALES = SCALE_IDS.filter((id) => id !== 'grey');

// --- State ---------------------------------------------------------------------

const STORAGE_KEY = 'bank-dataviz-colors/v2';
const DEMO_COUNTS = [2, 3, 4, 5, 6, 7, 8];
const clone = (o) => JSON.parse(JSON.stringify(o));

const oneOf = (v, list, fallback) => (list.includes(v) ? v : fallback);
const stepOf = (v, fallback) => oneOf(Number(v), STEPS, fallback);
const num = (v, lo, hi, fallback) => (Number.isFinite(+v) ? Math.min(hi, Math.max(lo, +v)) : fallback);

/** Rebuild a state from untrusted input (URL hash, localStorage). */
function sanitize(raw) {
  const d = clone(DEFAULT_STATE);
  if (!raw || typeof raw !== 'object') return d;
  d.view = oneOf(raw.view, ['light', 'dark', 'both'], d.view);
  d.cvd = oneOf(raw.cvd, ['none', 'protan', 'deutan', 'tritan'], d.cvd);
  d.usePins = raw.usePins !== false;
  d.demoCount = oneOf(Number(raw.demoCount), DEMO_COUNTS, d.demoCount);
  for (const id of SCALE_IDS) {
    const s = raw.scales?.[id];
    if (!s || typeof s !== 'object') continue;
    const def = defaultKnobs(SCALE_DEFS.find((x) => x.id === id));
    const overrides = {};
    for (const step of STEPS) {
      const hex = normalizeHex(String(s.overrides?.[step] ?? ''));
      if (hex) overrides[step] = hex;
    }
    d.scales[id] = {
      chromaScale: num(s.chromaScale, 0, 1.5, def.chromaScale),
      hueShift: num(s.hueShift, -30, 30, 0),
      overrides,
    };
  }
  if (Array.isArray(raw.cat)) {
    d.cat = d.cat.map((slot, i) => {
      const r = raw.cat[i] ?? {};
      return {
        name: typeof r.name === 'string' && r.name.trim() ? r.name.trim().slice(0, 24) : slot.name,
        // Grey is reserved for distinct values, never a categorical colour.
        scale: oneOf(r.scale, HUE_SCALES, slot.scale),
        light: stepOf(r.light, slot.light),
        dark: stepOf(r.dark, slot.dark),
      };
    });
  }
  for (const role of Object.keys(NEUTRAL_ROLES)) {
    for (const mode of MODES) d.neutral[role][mode] = stepOf(raw.neutral?.[role]?.[mode], d.neutral[role][mode]);
  }
  for (const role of Object.keys(DISTINCT_ROLES)) {
    for (const mode of MODES) d.distinct[role][mode] = stepOf(raw.distinct?.[role]?.[mode], d.distinct[role][mode]);
  }
  d.seq.scale = oneOf(raw.seq?.scale, SCALE_IDS, d.seq.scale);
  d.seq.classes = oneOf(Number(raw.seq?.classes), [3, 4, 5, 6, 7], d.seq.classes);
  d.div.neg = oneOf(raw.div?.neg, HUE_SCALES, d.div.neg);
  d.div.pos = oneOf(raw.div?.pos, HUE_SCALES, d.div.pos);
  for (const role of Object.keys(STATUS_ROLES)) {
    for (const mode of MODES) d.status[role][mode] = stepOf(raw.status?.[role]?.[mode], d.status[role][mode]);
  }
  return d;
}

const encode = (state) =>
  btoa(unescape(encodeURIComponent(JSON.stringify(state))))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
const decode = (str) => JSON.parse(decodeURIComponent(escape(atob(str.replace(/-/g, '+').replace(/_/g, '/')))));

function loadState() {
  try {
    const m = location.hash.match(/^#s=([\w-]+)$/);
    if (m) return sanitize(decode(m[1]));
  } catch {
    /* fall through to stored or default state */
  }
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) return sanitize(JSON.parse(stored));
  } catch {
    /* storage unavailable */
  }
  return clone(DEFAULT_STATE);
}

let state = loadState();
let resolved = resolve(state);
const openTables = new Set();
let tokenTab = 'css';

function persist() {
  const isDefault = JSON.stringify(state) === JSON.stringify(DEFAULT_STATE);
  try {
    if (isDefault) localStorage.removeItem(STORAGE_KEY);
    else localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* storage unavailable */
  }
  history.replaceState(null, '', isDefault ? location.pathname + location.search : '#s=' + encode(state));
}

function update(mutate) {
  mutate(state);
  persist();
  render();
}

const knobsFor = (id) => state.scales[id] ?? { ...defaultKnobs(SCALE_DEFS.find((d) => d.id === id)), overrides: {} };
function editScale(id, mutate) {
  update((s) => {
    s.scales[id] = { ...knobsFor(id), overrides: { ...knobsFor(id).overrides } };
    mutate(s.scales[id]);
  });
}

// --- Rendering -------------------------------------------------------------------

function render() {
  resolved = resolve(state);
  const focusKey = document.activeElement?.dataset?.fk;
  document.body.dataset.chrome = state.view === 'dark' ? 'dark' : 'light';
  $('#main').style.filter = state.cvd === 'none' ? '' : `url(#cvd-${state.cvd})`;
  for (const b of document.querySelectorAll('#view-seg button')) {
    b.setAttribute('aria-pressed', String(b.dataset.view === state.view));
  }
  $('#cvd').value = state.cvd;
  $('#use-pins').checked = state.usePins;
  renderPanel();
  renderStages();
  renderScales();
  renderSemantic();
  renderTokens();
  if (focusKey) document.querySelector(`[data-fk="${CSS.escape(focusKey)}"]`)?.focus({ preventScroll: true });
}

// Palette panel -----------------------------------------------------------------

const passBadge = (ratio) =>
  ratio >= MIN_CONTRAST
    ? `<span class="ratio ok" title="Minimaal 3:1 gehaald">${fmt(ratio)} ✓</span>`
    : `<span class="ratio bad" title="Onder 3:1">${fmt(ratio)} ✕</span>`;

function miniRow(scaleId, mode, selected, attrs, fkBase) {
  const minis = resolved.scales[scaleId]
    .map((s) => {
      const ratio = mode === 'light' ? s.onLight : s.onDark;
      const ok = ratio >= MIN_CONTRAST;
      return `<button type="button" class="mini${ok ? '' : ' fail'}${s.step === selected ? ' sel' : ''}" style="--c:${s.hex}" ${attrs} data-step="${s.step}" data-fk="${fkBase}-${s.step}" aria-pressed="${s.step === selected}" title="${scaleName(scaleId)} ${s.step} · ${s.hex} · ${fmt(ratio)}:1${ok ? '' : ' (onder 3:1)'}"></button>`;
    })
    .join('');
  const ratio = contrast(resolved.scales[scaleId].find((s) => s.step === selected).hex, SURFACE[mode]);
  return `<div class="mini-row" data-surface="${mode}"><span class="mode-tag">${mode === 'light' ? 'Light' : 'Dark'}</span><span class="minis">${minis}</span><span class="picked">${selected}</span>${passBadge(ratio)}</div>`;
}

const options = (list, selected, label = (v) => v) =>
  list.map((v) => `<option value="${v}"${v === selected ? ' selected' : ''}>${esc(label(v))}</option>`).join('');

function stepSelect(scaleId, selected, attrs, fk) {
  const opts = resolved.scales[scaleId]
    .map((s) => `<option value="${s.step}"${s.step === selected ? ' selected' : ''}>${s.step} · ${s.hex}</option>`)
    .join('');
  const hex = resolved.scales[scaleId].find((s) => s.step === selected).hex;
  return `<span class="step-select"><i style="background:${hex}"></i><select ${attrs} data-fk="${fk}">${opts}</select></span>`;
}

function separationLine(mode) {
  const sep = separation(resolved.tokens[mode].cat);
  const level = sep.normal.value >= 15 && sep.cvd.value >= 8 ? 'ok' : sep.normal.value >= 10 && sep.cvd.value >= 6 ? 'warn' : 'bad';
  return `<li class="${level}"><b>${MODE_LABEL[mode]}</b> zwakste paar ${sep.normal.value.toFixed(1)} <span>(${esc(sep.normal.pair)})</span>, kleurenblind ${sep.cvd.value.toFixed(1)} <span>(${esc(sep.cvd.pair)})</span></li>`;
}

function renderPanel() {
  const slots = state.cat
    .slice(0, MAX_CATEGORICAL)
    .map(
      (slot, i) => `
      <div class="slot">
        <div class="slot-head">
          <span class="slot-nr">${i + 1}</span>
          <select data-act="cat-scale" data-slot="${i}" data-fk="cat-scale-${i}" aria-label="Kleurschaal voor reeks ${i + 1}">${options(HUE_SCALES, slot.scale, scaleName)}</select>
          <span class="slot-name">${esc(slot.name)}</span>
        </div>
        ${MODES.map((mode) => miniRow(slot.scale, mode, slot[mode], `data-act="cat-step" data-slot="${i}" data-mode="${mode}"`, `cat-${i}-${mode}`)).join('')}
      </div>`,
    )
    .join('');

  const neutralRows = Object.entries(NEUTRAL_ROLES)
    .map(
      ([role, label]) =>
        `<tr><th scope="row">${label}</th>${MODES.map((mode) => `<td>${stepSelect('grey', state.neutral[role][mode], `data-act="neutral" data-role="${role}" data-mode="${mode}" aria-label="${label}, ${MODE_LABEL[mode]}"`, `neutral-${role}-${mode}`)}</td>`).join('')}</tr>`,
    )
    .join('');

  const distinctRows = Object.entries(DISTINCT_ROLES)
    .map(
      ([role, label]) =>
        `<tr><th scope="row">${label}</th>${MODES.map((mode) => `<td>${stepSelect('grey', state.distinct[role][mode], `data-act="distinct" data-role="${role}" data-mode="${mode}" aria-label="${label}, ${MODE_LABEL[mode]}"`, `distinct-${role}-${mode}`)}</td>`).join('')}</tr>`,
    )
    .join('');

  const statusRows = Object.entries(STATUS_ROLES)
    .map(
      ([role, label]) =>
        `<tr><th scope="row">${label}<small>${scaleName(state.status[role].scale)}</small></th>${MODES.map((mode) => `<td>${stepSelect(state.status[role].scale, state.status[role][mode], `data-act="status" data-role="${role}" data-mode="${mode}" aria-label="${label}, ${MODE_LABEL[mode]}"`, `status-${role}-${mode}`)}</td>`).join('')}</tr>`,
    )
    .join('');

  const strip = (list) => `<span class="strip">${list.map((c) => `<i style="background:${c.hex}" title="${c.ref} · ${c.hex}"></i>`).join('')}</span>`;
  const modeStrips = (key) =>
    MODES.map((mode) => `<div class="strip-row" data-surface="${mode}"><span class="mode-tag">${mode === 'light' ? 'Light' : 'Dark'}</span>${strip(resolved.tokens[mode][key])}</div>`).join('');

  $('#panel').innerHTML = `
    <section>
      <div class="panel-head">
        <h3>Categorisch</h3>
        <label class="inline-fields">Voorbeelden tonen <select data-act="demo-count" data-fk="demo-count" aria-label="Aantal categorieën in de voorbeeldcharts">${options(DEMO_COUNTS, state.demoCount, (n) => `${n} categorieën`)}</select></label>
      </div>
      <p class="hint">Vijf kleuren in vaste volgorde: een chart met drie reeksen gebruikt kleur 1 tot en met 3. Meer dan vijf categorieën: alles in kleur 1, de primaire blauw. Grijs is geen categorische kleur. Lage staafjes halen geen 3:1 in die mode.</p>
      ${slots}
      <ul class="separation" title="Afstand in OKLab x 100. Richtlijn: minimaal 15 voor normaal zicht en 8 bij rood-groen kleurenblindheid.">
        ${MODES.map(separationLine).join('')}
      </ul>
    </section>
    <section>
      <h3>Grijs: backdrop en lijnen</h3>
      <table class="roles"><thead><tr><th></th><th>Light</th><th>Dark</th></tr></thead><tbody>${neutralRows}</tbody></table>
    </section>
    <section>
      <h3>Bijzondere waarden</h3>
      <p class="hint">Grijs, zwart en wit zijn gereserveerd voor waarden die los staan van de categorieën: totalen en gemiddelden, Overig en ontbrekende data. Ontbrekend mag onder 3:1 blijven, het moet juist terugvallen.</p>
      <table class="roles"><thead><tr><th></th><th>Light</th><th>Dark</th></tr></thead><tbody>${distinctRows}</tbody></table>
    </section>
    <section>
      <h3>Sequentieel</h3>
      <div class="inline-fields">
        <label>Schaal <select data-act="seq-scale" data-fk="seq-scale">${options(SCALE_IDS, state.seq.scale, scaleName)}</select></label>
        <label>Klassen <select data-act="seq-classes" data-fk="seq-classes">${options([3, 4, 5, 6, 7], state.seq.classes)}</select></label>
      </div>
      ${modeStrips('seq')}
    </section>
    <section>
      <h3>Divergerend</h3>
      <div class="inline-fields">
        <label>Negatief <select data-act="div-neg" data-fk="div-neg">${options(HUE_SCALES, state.div.neg, scaleName)}</select></label>
        <label>Positief <select data-act="div-pos" data-fk="div-pos">${options(HUE_SCALES, state.div.pos, scaleName)}</select></label>
      </div>
      ${modeStrips('div')}
    </section>
    <section>
      <h3>Status</h3>
      <table class="roles"><thead><tr><th></th><th>Light</th><th>Dark</th></tr></thead><tbody>${statusRows}</tbody></table>
    </section>`;
}

// Chart stages ------------------------------------------------------------------

function stageVars(t) {
  const v = { surface: t.surface };
  for (const role of Object.keys(NEUTRAL_ROLES)) v[role] = t.neutral[role].hex;
  for (const role of Object.keys(DISTINCT_ROLES)) v[role] = t.distinct[role].hex;
  t.cat.forEach((c, i) => (v[`cat-${i + 1}`] = c.hex));
  t.seq.forEach((c, i) => (v[`seq-${i + 1}`] = c.hex));
  t.div.forEach((c, i) => (v[`div-${i + 1}`] = c.hex));
  v['div-neg'] = t.div[0].hex;
  v['div-pos'] = t.div.at(-1).hex;
  for (const role of Object.keys(STATUS_ROLES)) v[`status-${role}`] = t.status[role].hex;
  return Object.entries(v)
    .map(([k, val]) => `--${k}:${val}`)
    .join(';');
}

const STATUS_ICON = { positive: '✓', warning: '!', negative: '✕', neutral: '–' };

function kpiTile(k) {
  const up = k.delta >= 0;
  const good = up === k.upIsGood;
  return `<div class="kpi">
    <span class="kpi-label">${esc(k.label)}</span>
    <span class="kpi-value">${eur(k.value)}</span>
    <span class="kpi-foot">
      <span class="delta" style="color:var(--status-${good ? 'positive' : 'negative'})">${up ? '▲' : '▼'} ${Math.abs(k.delta).toLocaleString('nl-NL')}%</span>
      <span class="kpi-period">t.o.v. vorige maand</span>
      ${sparkline(k.spark)}
    </span>
  </div>`;
}

function budgetCard() {
  const rows = D.budgets
    .map(
      (b) => `<li>
        <span class="status-icon" style="background:var(--status-${b.status})">${STATUS_ICON[b.status]}</span>
        <span class="budget-name">${esc(b.name)}</span>
        <span class="budget-text">${esc(b.text)}</span>
        <span class="meter" role="img" aria-label="${Math.round(b.used * 100)}% gebruikt"><i style="width:${b.used * 100}%;background:var(--status-${b.status})"></i></span>
        <span class="budget-pct">${Math.round(b.used * 100)}%</span>
      </li>`,
    )
    .join('');
  return `<figure class="card"><header><div><h3>Budgetten deze maand</h3><p>Statuskleuren met icoon en label, grijze backdrop als baan</p></div></header><ul class="budgets">${rows}</ul></figure>`;
}

function legendHtml(legend) {
  if (!legend.length) return '';
  return `<ul class="legend">${legend.map((l) => `<li><i class="key ${l.type}" style="background:${l.color}"></i>${esc(l.label)}${l.value ? ` <b>${esc(l.value)}</b>` : ''}</li>`).join('')}</ul>`;
}

function scaleLegendHtml(scale) {
  if (!scale) return '';
  const cells = Array.from({ length: scale.count }, (_, i) => `<i style="background:var(--${scale.colorVar}-${i + 1})"></i>`).join('');
  const missing = scale.missing
    ? `<span class="scale-missing"><i style="background:var(--missing)"></i>${esc(scale.missing)}</span>`
    : '';
  return `<div class="scale-legend">${missing}<span>${esc(scale.from)}</span><span class="strip">${cells}</span><span>${esc(scale.to)}</span></div>`;
}

function tableHtml(table) {
  return `<div class="table-wrap"><table><thead><tr>${table.head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${table.rows.map((r) => `<tr>${r.map((c, i) => (i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function renderStages() {
  const modes = state.view === 'both' ? MODES : [state.view];
  const root = $('#stages');
  root.dataset.count = modes.length;
  root.innerHTML = modes
    .map((mode) => {
      const t = resolved.tokens[mode];
      const cards = CHARTS.map(
        (c) => `<figure class="card" data-chart="${c.id}">
          <header><div><h3>${esc(c.title)}</h3><p>${esc(c.subtitle)}</p></div>
          <button type="button" class="ghost" data-act="table" data-chart="${c.id}" data-fk="table-${mode}-${c.id}" aria-pressed="${openTables.has(c.id)}">${openTables.has(c.id) ? 'Chart' : 'Tabel'}</button></header>
          <div class="plot"></div>
        </figure>`,
      );
      cards.splice(3, 0, budgetCard());
      return `<div class="stage" data-mode="${mode}" style="${stageVars(t)}">
        <div class="stage-head"><b>${MODE_LABEL[mode]}</b><span>surface ${t.surface}</span></div>
        <div class="kpis">${D.kpis.map(kpiTile).join('')}</div>
        <div class="cards">${cards.join('')}</div>
      </div>`;
    })
    .join('');
  drawCharts();
}

function drawCharts() {
  for (const stage of document.querySelectorAll('.stage')) {
    const tokens = resolved.tokens[stage.dataset.mode];
    for (const card of stage.querySelectorAll('.card[data-chart]')) {
      const chart = CHARTS.find((c) => c.id === card.dataset.chart);
      const plot = $('.plot', card);
      const w = Math.max(260, Math.floor(plot.clientWidth));
      const out = chart.render({ w, n: state.demoCount, tokens });
      plot.innerHTML = openTables.has(chart.id)
        ? tableHtml(out.table)
        : legendHtml(out.legend) + out.svg + scaleLegendHtml(out.scale);
    }
  }
}

// Scales --------------------------------------------------------------------------

function buildScalesShell() {
  $('#scales').innerHTML =
    `<div class="zones" aria-hidden="true">
      <span class="zone dark" style="grid-column:1 / 8">Dark mode: 50 tot en met 600 halen 3:1 op #1E1E1E</span>
      <span class="zone light" style="grid-column:5 / 12">Light mode: 400 tot en met 1000 halen 3:1 op #FFFFFF</span>
    </div>` +
    SCALE_DEFS.map(
      (def) => `<div class="scale" data-scale="${def.id}">
        <div class="scale-head">
          <div><h3>${def.name}</h3><p>${esc(def.note)}</p></div>
          <div class="knobs">
            <label>Chroma <input type="range" min="0" max="150" step="5" data-knob="chromaScale" aria-label="Chroma ${def.name}"><output></output></label>
            <label>Hue <input type="range" min="-30" max="30" step="1" data-knob="hueShift" aria-label="Hue ${def.name}"><output></output></label>
            <button type="button" class="ghost" data-act="reset-scale">Reset</button>
          </div>
        </div>
        <div class="swatches"></div>
      </div>`,
    ).join('');
}

function renderScales() {
  for (const row of document.querySelectorAll('.scale')) {
    const id = row.dataset.scale;
    const k = knobsFor(id);
    const chroma = $('[data-knob="chromaScale"]', row);
    const hue = $('[data-knob="hueShift"]', row);
    if (document.activeElement !== chroma) chroma.value = Math.round(k.chromaScale * 100);
    if (document.activeElement !== hue) hue.value = k.hueShift;
    chroma.nextElementSibling.textContent = Math.round(k.chromaScale * 100) + '%';
    hue.nextElementSibling.textContent = (k.hueShift > 0 ? '+' : '') + k.hueShift + '°';
    $('.swatches', row).innerHTML = resolved.scales[id]
      .map((s) => {
        const mark = s.source === 'brand' ? '<i title="Merkkleur, exact vastgezet">★</i>' : s.source === 'override' ? '<i title="Handmatig aangepast">✎</i>' : '';
        const chip = (mode, ratio, ok) =>
          `<span class="chip ${mode}${ok ? '' : ' fail'}" title="${fmt(ratio)}:1 op ${SURFACE[mode]}${ok ? '' : ' (onder 3:1)'}"><i style="background:${s.hex}"></i>${fmt(ratio)}</span>`;
        return `<button type="button" class="swatch" style="background:${s.hex};color:${inkOn(s.hex)}" data-act="edit-swatch" data-step="${s.step}" data-fk="sw-${id}-${s.step}" aria-label="${scaleName(id)} ${s.step}, ${s.hex}. Klik om aan te passen">
          <span class="sw-step">${s.step}${mark}</span>
          <span class="sw-hex">${s.hex}</span>
          <span class="chips">${chip('light', s.onLight, s.passLight)}${chip('dark', s.onDark, s.passDark)}</span>
        </button>`;
      })
      .join('');
  }
}

// Semantic tokens -----------------------------------------------------------------

/** The overview on the page is the same sheet that is copied to Figma. */
function renderSemantic() {
  $('#semantic').replaceChildren(buildTokensSheet(resolved));
}

const SHEETS = { scales: buildScalesSheet, tokens: buildTokensSheet };

async function copyToFigma(button) {
  const original = button.textContent;
  button.disabled = true;
  button.textContent = 'Bezig met kopiëren…';
  try {
    await copySheetToFigma(SHEETS[button.dataset.sheet](resolved));
    button.textContent = 'Gekopieerd, plak in Figma';
  } catch (err) {
    console.error(err);
    button.textContent = 'Kopiëren lukt niet';
  }
  button.disabled = false;
  setTimeout(() => (button.textContent = original), 2400);
}

// Tokens --------------------------------------------------------------------------

function renderTokens() {
  for (const b of document.querySelectorAll('#token-tabs button')) {
    b.setAttribute('aria-pressed', String(b.dataset.tab === tokenTab));
  }
  $('#token-output').textContent = tokenTab === 'css' ? toCss(resolved) : toJson(resolved);
}

// --- Tooltip -----------------------------------------------------------------------

const tooltip = $('#tooltip');
function showTip(target, ev) {
  let data;
  try {
    data = JSON.parse(target.dataset.tip);
  } catch {
    return;
  }
  const style = getComputedStyle(target.closest('.stage'));
  tooltip.textContent = '';
  const title = document.createElement('div');
  title.className = 'tip-title';
  title.textContent = data.t;
  tooltip.append(title);
  for (const [color, label, value] of data.r) {
    const row = document.createElement('div');
    row.className = 'tip-row';
    const key = document.createElement('i');
    const m = color && /^var\((--[\w-]+)\)$/.exec(color);
    if (m) key.style.background = style.getPropertyValue(m[1]);
    else key.style.visibility = 'hidden';
    const l = document.createElement('span');
    l.textContent = label;
    const v = document.createElement('b');
    v.textContent = value;
    row.append(key, l, v);
    tooltip.append(row);
  }
  tooltip.hidden = false;
  const r = tooltip.getBoundingClientRect();
  let x = ev.clientX + 14;
  let y = ev.clientY + 14;
  if (x + r.width > innerWidth - 8) x = ev.clientX - r.width - 14;
  if (y + r.height > innerHeight - 8) y = ev.clientY - r.height - 14;
  tooltip.style.left = Math.max(8, x) + 'px';
  tooltip.style.top = Math.max(8, y) + 'px';
}

// --- Swatch editor -----------------------------------------------------------------

const dialog = $('#swatch-dialog');
let editing = null;

function refreshDialog(hex) {
  const valid = normalizeHex(hex);
  $('#dlg-apply').disabled = !valid;
  $('#dlg-preview').style.background = valid ?? 'transparent';
  if (!valid) {
    $('#dlg-contrast').textContent = 'Vul een geldige hex-waarde in, bijvoorbeeld #008D85.';
    return;
  }
  $('#dlg-color').value = valid.toLowerCase();
  const line = (mode) => {
    const ratio = contrast(valid, SURFACE[mode]);
    return `${MODE_LABEL[mode]}: ${fmt(ratio)}:1 ${ratio >= MIN_CONTRAST ? '✓' : '✕ onder 3:1'}`;
  };
  $('#dlg-contrast').textContent = MODES.map(line).join('   ·   ');
}

function openEditor(id, step) {
  const s = resolved.scales[id].find((x) => x.step === step);
  editing = { id, step };
  $('#dlg-title').textContent = `${scaleName(id)} ${step}`;
  $('#dlg-hex').value = s.hex;
  $('#dlg-reset').hidden = s.source !== 'override';
  refreshDialog(s.hex);
  dialog.showModal();
}

// --- Events ------------------------------------------------------------------------

async function copyText(text, button) {
  const original = button.textContent;
  try {
    await navigator.clipboard.writeText(text);
    button.textContent = 'Gekopieerd';
  } catch {
    button.textContent = 'Kopiëren lukt niet';
  }
  setTimeout(() => (button.textContent = original), 1600);
}

function bindEvents() {
  $('#view-seg').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-view]');
    if (b) update((s) => (s.view = b.dataset.view));
  });
  $('#cvd').addEventListener('change', (e) => update((s) => (s.cvd = e.target.value)));
  $('#use-pins').addEventListener('change', (e) => update((s) => (s.usePins = e.target.checked)));
  $('#share').addEventListener('click', (e) => copyText(location.href, e.currentTarget));
  $('#reset').addEventListener('click', () => {
    if (!confirm('Alle aanpassingen terugzetten naar het voorstel?')) return;
    state = { ...clone(DEFAULT_STATE), view: state.view };
    persist();
    render();
  });

  $('#panel').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'cat-step') update((s) => (s.cat[+b.dataset.slot][b.dataset.mode] = +b.dataset.step));
  });
  $('#panel').addEventListener('change', (e) => {
    const el = e.target.closest('select[data-act]');
    if (!el) return;
    const { act, role, mode, slot } = el.dataset;
    update((s) => {
      if (act === 'cat-scale') {
        s.cat[+slot].scale = el.value;
        s.cat[+slot].name = scaleName(el.value);
      } else if (act === 'neutral') s.neutral[role][mode] = +el.value;
      else if (act === 'distinct') s.distinct[role][mode] = +el.value;
      else if (act === 'demo-count') s.demoCount = +el.value;
      else if (act === 'status') s.status[role][mode] = +el.value;
      else if (act === 'seq-scale') s.seq.scale = el.value;
      else if (act === 'seq-classes') s.seq.classes = +el.value;
      else if (act === 'div-neg') s.div.neg = el.value;
      else if (act === 'div-pos') s.div.pos = el.value;
    });
  });

  $('#stages').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act="table"]');
    if (!b) return;
    if (openTables.has(b.dataset.chart)) openTables.delete(b.dataset.chart);
    else openTables.add(b.dataset.chart);
    render();
  });
  $('#stages').addEventListener('pointermove', (e) => {
    const target = e.target.closest?.('[data-tip]');
    if (target) showTip(target, e);
    else tooltip.hidden = true;
  });
  $('#stages').addEventListener('pointerleave', () => (tooltip.hidden = true));

  $('#scales').addEventListener('input', (e) => {
    const input = e.target.closest('input[data-knob]');
    if (!input) return;
    const id = input.closest('.scale').dataset.scale;
    const value = input.dataset.knob === 'chromaScale' ? +input.value / 100 : +input.value;
    editScale(id, (k) => (k[input.dataset.knob] = value));
  });
  $('#scales').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    const id = b.closest('.scale').dataset.scale;
    if (b.dataset.act === 'reset-scale') update((s) => delete s.scales[id]);
    if (b.dataset.act === 'edit-swatch') openEditor(id, +b.dataset.step);
  });

  $('#dlg-hex').addEventListener('input', (e) => refreshDialog(e.target.value));
  $('#dlg-color').addEventListener('input', (e) => {
    $('#dlg-hex').value = e.target.value.toUpperCase();
    refreshDialog(e.target.value);
  });
  $('#dlg-copy').addEventListener('click', (e) => copyText($('#dlg-hex').value, e.currentTarget));
  $('#dlg-reset').addEventListener('click', () => {
    editScale(editing.id, (k) => delete k.overrides[editing.step]);
    dialog.close();
  });
  $('#dlg-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const hex = normalizeHex($('#dlg-hex').value);
    if (!hex) return;
    editScale(editing.id, (k) => (k.overrides[editing.step] = hex));
    dialog.close();
  });
  $('#dlg-cancel').addEventListener('click', () => dialog.close());

  for (const b of document.querySelectorAll('.figma-copy')) {
    b.addEventListener('click', () => copyToFigma(b));
  }

  $('#token-tabs').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-tab]');
    if (!b) return;
    tokenTab = b.dataset.tab;
    renderTokens();
  });
  $('#token-copy').addEventListener('click', (e) => copyText($('#token-output').textContent, e.currentTarget));
  $('#token-download').addEventListener('click', () => {
    const blob = new Blob([$('#token-output').textContent], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = tokenTab === 'css' ? 'dataviz-tokens.css' : 'dataviz-tokens.json';
    a.click();
    URL.revokeObjectURL(a.href);
  });

  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(drawCharts, 120);
  });
  window.addEventListener('hashchange', () => {
    state = loadState();
    render();
  });
}

// Colour-blindness simulation filters, from the same matrices the checks use.
function buildCvdFilters() {
  $('#cvd-defs').innerHTML = Object.entries(CVD_MATRICES)
    .map(
      ([name, m]) =>
        `<filter id="cvd-${name}" color-interpolation-filters="linearRGB"><feColorMatrix type="matrix" values="${m.map((r) => [...r, 0, 0].join(' ')).join(' ')} 0 0 0 1 0"/></filter>`,
    )
    .join('');
}

buildCvdFilters();
buildScalesShell();
bindEvents();
render();
