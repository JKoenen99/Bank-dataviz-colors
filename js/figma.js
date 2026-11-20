// Figma export: builds clean sheets (colour scales, semantic tokens) as plain
// flexbox DOM and copies them in Figma's own clipboard format. Every flex
// container lands in Figma as an auto layout frame, every text as a text layer.
//
// The converter (vendor/dom-to-figma.js, MIT) is loaded on the first copy, so
// the playground itself stays light.

import { SCALE_DEFS, SURFACE, MIN_CONTRAST } from './scales.js';
import { semanticGroups } from './export.js';
import { inkOn } from './color.js';

const INK = { light: '#252525', dark: '#F5F5F5' };
const MUTED = { light: '#6B6B6B', dark: '#ADADAD' };
const EDGE = { light: '#E3E3E3', dark: '#313131' };
const FAIL = '#A8A8A8';
const FONT_FILES = {
  400: new URL('../vendor/fonts/inter-latin-400-normal.woff2', import.meta.url),
  600: new URL('../vendor/fonts/inter-latin-600-normal.woff2', import.meta.url),
};

const fmt = (n) => n.toFixed(2);

/** Element with a Figma layer name and inline styles. Strings become text. */
function el(name, style, ...children) {
  const node = document.createElement(name === null ? 'span' : 'div');
  if (name) node.dataset.figmaName = name;
  node.setAttribute('style', style);
  for (const child of children.flat()) {
    if (child == null || child === false) continue;
    node.append(typeof child === 'string' ? document.createTextNode(child) : child);
  }
  return node;
}

/** A text layer. */
const text = (value, style) => el(null, `display:block;white-space:nowrap;${style}`, value);

const ROOT_STYLE =
  "display:flex;flex-direction:column;align-items:flex-start;gap:40px;padding:48px;width:max-content;background:#FFFFFF;color:#252525;font-family:Inter,sans-serif;font-size:14px;line-height:20px;font-weight:400;letter-spacing:0;text-align:left;";

function sheetHeader(title, lines) {
  return el(
    'Header',
    'display:flex;flex-direction:column;gap:8px;',
    text(title, 'font-size:28px;line-height:36px;font-weight:600;'),
    lines.map((l) => text(l, `font-size:14px;line-height:20px;color:${MUTED.light};`)),
  );
}

// --- Colour scales ------------------------------------------------------------------

function contrastLine(mode, ratio) {
  const ok = ratio >= MIN_CONTRAST;
  return text(
    `${mode === 'light' ? 'Light' : 'Dark'} ${fmt(ratio)}:1`,
    `font-size:12px;line-height:16px;color:${ok ? MUTED.light : FAIL};${ok ? '' : 'text-decoration:line-through;'}`,
  );
}

function swatch(id, s) {
  const ink = inkOn(s.hex);
  const tag = s.source === 'brand' ? 'Merkkleur' : s.source === 'override' ? 'Aangepast' : null;
  return el(
    `${id}/${s.step}`,
    'display:flex;flex-direction:column;gap:8px;width:112px;',
    el(
      'Fill',
      `display:flex;flex-direction:column;justify-content:space-between;height:80px;padding:10px;border-radius:6px;background:${s.hex};border:1px solid rgba(0,0,0,0.08);color:${ink};`,
      text(String(s.step), 'font-size:13px;line-height:16px;font-weight:600;'),
      tag && text(tag, 'font-size:11px;line-height:14px;'),
    ),
    el(
      'Info',
      'display:flex;flex-direction:column;gap:2px;',
      text(s.hex, 'font-size:13px;line-height:16px;font-weight:600;'),
      contrastLine('light', s.onLight),
      contrastLine('dark', s.onDark),
    ),
  );
}

/** Sheet with every scale: one auto layout row of eleven swatches per hue. */
export function buildScalesSheet(resolved) {
  return el(
    'Dataviz kleurschalen',
    ROOT_STYLE,
    sheetHeader('Dataviz kleurschalen', [
      'Elf stappen per schaal. Een stap heeft in elke schaal hetzelfde contrast.',
      `50 tot en met 600 halen 3:1 op dark (${SURFACE.dark}), 400 tot en met 1000 halen 3:1 op light (${SURFACE.light}).`,
    ]),
    el(
      'Scales',
      'display:flex;flex-direction:column;gap:32px;',
      SCALE_DEFS.map((def) =>
        el(
          def.id,
          'display:flex;flex-direction:column;gap:12px;',
          el(
            'Title',
            'display:flex;flex-direction:column;gap:2px;',
            text(def.name, 'font-size:16px;line-height:24px;font-weight:600;'),
            text(def.note, `font-size:13px;line-height:18px;color:${MUTED.light};`),
          ),
          el(
            'Steps',
            'display:flex;flex-direction:row;gap:8px;',
            resolved.scales[def.id].map((s) => swatch(def.id, s)),
          ),
        ),
      ),
    ),
  );
}

// --- Semantic tokens ----------------------------------------------------------------

const COL = { name: 220, role: 220, mode: 272 };

function modeCell(mode, t) {
  return el(
    mode === 'light' ? 'Light' : 'Dark',
    `display:flex;flex-direction:row;align-items:center;gap:12px;width:${COL.mode}px;padding:8px;border-radius:6px;background:${SURFACE[mode]};border:1px solid ${EDGE[mode]};`,
    el('Swatch', `width:32px;height:32px;flex:none;border-radius:4px;background:${t.hex};border:1px solid rgba(128,128,128,0.25);`),
    el(
      'Value',
      'display:flex;flex-direction:column;gap:0px;',
      text(t.ref, `font-size:12px;line-height:16px;font-weight:600;color:${INK[mode]};`),
      text(t.ref === 'surface' ? t.hex : `${t.hex} · ${fmt(t.contrast)}:1`, `font-size:12px;line-height:16px;color:${MUTED[mode]};`),
    ),
  );
}

function tokenRow(row) {
  return el(
    row.name,
    'display:flex;flex-direction:row;align-items:center;gap:16px;',
    text(row.name, `width:${COL.name}px;font-size:13px;line-height:20px;font-weight:600;`),
    text(row.role, `width:${COL.role}px;font-size:13px;line-height:20px;color:${MUTED.light};`),
    modeCell('light', row.light),
    modeCell('dark', row.dark),
  );
}

/** Overview of every semantic token with its light and dark value. */
export function buildTokensSheet(resolved) {
  const head = (label, width) =>
    text(label, `width:${width}px;font-size:12px;line-height:16px;font-weight:600;color:${MUTED.light};`);
  return el(
    'Dataviz semantische tokens',
    ROOT_STYLE,
    sheetHeader('Dataviz semantische tokens', [
      'Elke token wijst per mode naar een stap uit een kleurschaal.',
      'De namen zijn gelijk aan de CSS variabelen in tokens/tokens.css, met --dv- ervoor.',
    ]),
    el(
      'Tokens',
      'display:flex;flex-direction:column;gap:32px;',
      el(
        'Columns',
        'display:flex;flex-direction:row;gap:16px;',
        head('Token', COL.name),
        head('Rol', COL.role),
        head(`Light mode · ${SURFACE.light}`, COL.mode),
        head(`Dark mode · ${SURFACE.dark}`, COL.mode),
      ),
      semanticGroups(resolved.tokens).map((g) =>
        el(
          g.id,
          'display:flex;flex-direction:column;gap:8px;',
          el(
            'Title',
            'display:flex;flex-direction:column;gap:2px;padding-bottom:4px;',
            text(g.title, 'font-size:16px;line-height:24px;font-weight:600;'),
            g.note && text(g.note, `font-size:13px;line-height:18px;color:${MUTED.light};`),
          ),
          el('Rows', 'display:flex;flex-direction:column;gap:6px;', g.rows.map(tokenRow)),
        ),
      ),
    ),
  );
}

// --- Copy to Figma ------------------------------------------------------------------

let converterPromise;
const fontBytes = {};

async function fontLoader({ family, weight }) {
  const w = weight >= 550 ? 600 : 400;
  fontBytes[w] ??= fetch(FONT_FILES[w]).then((r) => {
    if (!r.ok) throw new Error(`Font ${w} niet gevonden`);
    return r.arrayBuffer();
  });
  const out = { bytes: await fontBytes[w], resolvedWeight: w, resolvedItalic: false };
  if (family !== 'Inter') out.resolvedFamily = 'Inter';
  return out;
}

function loadConverter() {
  converterPromise ??= import('../vendor/dom-to-figma.js').then((m) => ({
    figma: m.createFigmaConverter({ fontLoader, trace: true }),
    encode: m.encodeFigmaData,
    compose: m.composeClipboardHtml,
  }));
  return converterPromise;
}

/**
 * The converter wraps the sheet in a root frame of the same size. Fold the
 * sheet into that frame so the paste is one top-level auto layout frame.
 */
function flattenRoot(changes) {
  const key = (g) => `${g.sessionID}:${g.localID}`;
  const canvas = changes.find((n) => n.type === 'CANVAS');
  const outer = changes.find((n) => n.type === 'FRAME' && n.parentIndex && key(n.parentIndex.guid) === key(canvas.guid));
  const inner = changes.filter((n) => n.parentIndex && key(n.parentIndex.guid) === key(outer.guid));
  if (inner.length !== 1 || inner[0].type !== 'FRAME') return;
  const sheet = inner[0];
  const keep = new Set(['guid', 'parentIndex', 'transform', 'name', 'phase', 'type']);
  const childOnly = new Set(['stackChildAlignSelf', 'stackChildPrimaryGrow', 'stackPositioning']);
  for (const [k, v] of Object.entries(sheet)) {
    if (!keep.has(k) && !childOnly.has(k)) outer[k] = v;
  }
  for (const n of changes) {
    if (n.parentIndex && key(n.parentIndex.guid) === key(sheet.guid)) n.parentIndex = { ...n.parentIndex, guid: outer.guid };
  }
  changes.splice(changes.indexOf(sheet), 1);
}

/**
 * Convert a sheet into the HTML Figma reads on paste. The sheet is measured
 * off screen; layers get the names from data-figma-name.
 */
export async function sheetToFigmaHtml(sheet) {
  const [{ figma, encode, compose }] = await Promise.all([
    loadConverter(),
    document.fonts.load('400 14px Inter'),
    document.fonts.load('600 14px Inter'),
  ]);
  const host = document.createElement('div');
  host.setAttribute('aria-hidden', 'true');
  host.setAttribute('style', 'position:fixed;left:-100000px;top:0;pointer-events:none;');
  host.append(sheet);
  document.body.append(host);
  try {
    const { width, height } = sheet.getBoundingClientRect();
    const name = sheet.dataset.figmaName;
    const result = await figma.convert({ element: sheet, width: Math.ceil(width), height: Math.ceil(height), name });
    const byGuid = new Map(result.document.nodeChanges.map((n) => [`${n.guid.sessionID}:${n.guid.localID}`, n]));
    for (const entry of result.trace.entries) {
      if (entry.domPath.includes('::text')) continue;
      const source = entry.domPath === ':scope' ? sheet : sheet.querySelector(entry.domPath);
      const node = byGuid.get(`${entry.guid.sessionID}:${entry.guid.localID}`);
      if (node && source?.dataset.figmaName) node.name = source.dataset.figmaName;
    }
    flattenRoot(result.document.nodeChanges);
    return compose(encode(result.document).base64);
  } finally {
    host.remove();
  }
}

/**
 * Copy a sheet to the clipboard. The clipboard item is created inside the
 * click so Safari keeps the user gesture; the payload follows as a promise.
 */
export async function copySheetToFigma(sheet) {
  const html = sheetToFigmaHtml(sheet);
  try {
    const blob = html.then((h) => new Blob([h], { type: 'text/html' }));
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': blob })]);
  } catch {
    // Browsers without promise support in ClipboardItem: write once it is ready.
    const h = await html;
    await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([h], { type: 'text/html' }) })]);
  }
}
