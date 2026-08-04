// lib/export/canvas_to_pptx_spec.js — the PURE, isomorphic core of the native
// (editable) export path. `canvasToPptxSpec(canvas, opts)` turns one fabric-v6
// canvas JSON (templates/helpers.js + templates/v2/decor.js shapes) into a
// SERIALIZABLE "pptx spec": a plain array of
//   { kind:'text'|'shape'|'image', ...native-pptxgenjs-props }
// plus slide layout + background. It contains NO window/document/fetch/fs, so
// it runs unchanged in the browser (feeding window.PptxGenJS via
// lib/export/pptx.js) AND under plain node (the unit tests import it directly).
// This is the testable heart of the feature — everything else is a thin shell
// around it.
//
// Geometry: canvas pixels → inches at 96dpi (1px = 1/96in — the classic screen
// DPI, so a spec is a faithful physical size). Fonts px → pt (1px = 0.75pt at
// 96dpi). Colors → 6-hex UPPERCASE without '#'.
//
// Fidelity contract (what maps cleanly vs. what is approximated — see REPORT):
//   Textbox → text     REAL editable text, never rasterized. fontFace, bold
//                      (fontWeight>=700), color, align, valign top,
//                      lineSpacingMultiple (lineHeight), letterSpacing
//                      (charSpacing/100 → points), autoFit OFF.
//   Rect    → roundRect (when rx) with rectRadius, else rect.
//   Circle  → ellipse.
//   Line    → line.
//   Polygon → custGeom freeform (points normalized into the bbox, in inches)
//             WITH fill — a true silhouette, not a bounding-box rect.
//   Image   → image (data: URI or /api/images/file path) sized 'cover'.
// Carried on every primitive where present: opacity → transparency (%),
// angle → rotate (deg), shadow → pptx shadow. skewX has NO pptx analogue and
// is dropped (documented; approximated by the raster/HTML paths elsewhere).

// ── unit conversion (96dpi) ─────────────────────────────────────────────────

export const DPI = 96;
export const PT_PER_PX = 72 / DPI; // 0.75

/** Round to `p` decimals (default 4 — EMU-safe, avoids float noise in specs). */
function round(n, p = 4) {
  const f = 10 ** p;
  return Math.round(n * f) / f;
}

/** Canvas px → inches at 96dpi. 96px → 1.0in exactly. */
export function pxToIn(px) {
  return round((Number(px) || 0) / DPI);
}

/** Font px → pt at 96dpi. 16px → 12pt. */
export function pxToPt(px) {
  return round((Number(px) || 0) * PT_PER_PX, 2);
}

// ── color ───────────────────────────────────────────────────────────────────

/**
 * Any solid CSS-ish color → 'RRGGBB' (uppercase, no '#'), or null when it is
 * not a paintable solid ('', 'transparent', 'none', a gradient object, junk).
 * Serialized fabric gradients flatten to their lowest-offset stop (pptx has no
 * usable gradient-mesh fidelity — see REPORT).
 */
export function normHex(color) {
  if (color && typeof color === 'object' && Array.isArray(color.colorStops) && color.colorStops.length) {
    const first = color.colorStops.slice().sort((a, b) => (a.offset || 0) - (b.offset || 0))[0];
    return normHex(first && first.color);
  }
  if (typeof color !== 'string') return null;
  const c = color.trim();
  if (!c || /^(transparent|none)$/i.test(c)) return null;
  let m = /^#([0-9a-f]{6})$/i.exec(c);
  if (m) return m[1].toUpperCase();
  m = /^#([0-9a-f]{3})$/i.exec(c);
  if (m) return m[1].split('').map((ch) => ch + ch).join('').toUpperCase();
  m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
  if (m) {
    return [m[1], m[2], m[3]]
      .map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0'))
      .join('').toUpperCase();
  }
  return null;
}

// ── shared object readers (fabric scaleX/scaleY aware) ──────────────────────

function opacityOf(obj) {
  const n = Number(obj.opacity);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

/** pptx transparency percent (0 = opaque, 100 = invisible) from opacity. */
export function transparencyPct(opacity) {
  return Math.round((1 - opacity) * 100);
}

function effW(obj) { return (Number(obj.width) || 0) * (Number(obj.scaleX) || 1); }
function effH(obj) { return (Number(obj.height) || 0) * (Number(obj.scaleY) || 1); }

/** fontWeight >= 700 (or the 'bold'/'bolder' keyword) → bold. */
export function boldFrom(fontWeight) {
  if (fontWeight == null) return false;
  if (typeof fontWeight === 'string' && /^bold(er)?$/i.test(fontWeight.trim())) return true;
  const n = parseInt(fontWeight, 10);
  return Number.isFinite(n) && n >= 700;
}

function alignFrom(textAlign) {
  return ['left', 'center', 'right', 'justify'].includes(textAlign) ? textAlign : 'left';
}

/** fabric shadow shape → pptx shadow options (or undefined). */
function shadowFrom(shadow) {
  if (!shadow || typeof shadow !== 'object') return undefined;
  const color = normHex(shadow.color) || normHex(String(shadow.color || '').replace(/rgba?\(([^)]*)\)/, 'rgb($1)'));
  const rgbaAlpha = /rgba?\([^)]*,\s*([0-9.]+)\s*\)/.exec(String(shadow.color || ''));
  return {
    type: 'outer',
    color: color || '000000',
    blur: pxToPt(shadow.blur || 0),
    offset: pxToPt(Math.hypot(shadow.offsetX || 0, shadow.offsetY || 0)),
    angle: Math.round((Math.atan2(shadow.offsetY || 0, shadow.offsetX || 0) * 180) / Math.PI + 360) % 360,
    opacity: rgbaAlpha ? Math.max(0, Math.min(1, Number(rgbaAlpha[1]))) : 0.5
  };
}

// ── per-object mappers (each returns a spec item or null = skip) ────────────

/** Textbox / IText / Text → { kind:'text', text, options }. Real text. */
export function mapTextbox(obj) {
  const text = typeof obj.text === 'string' ? obj.text : '';
  if (!text.trim()) return null;
  const fontSize = (Number(obj.fontSize) || 40) * (Number(obj.scaleY) || 1);
  const options = {
    x: pxToIn(obj.left || 0),
    y: pxToIn(obj.top || 0),
    w: pxToIn(effW(obj)),
    h: pxToIn(Number(obj.height) > 0 ? effH(obj) : fontSize * (Number(obj.lineHeight) || 1.16) * countLines(text)),
    fontFace: obj.fontFamily || 'Arial',
    fontSize: pxToPt(fontSize),
    bold: boldFrom(obj.fontWeight),
    color: normHex(obj.fill) || '000000',
    align: alignFrom(obj.textAlign),
    valign: 'top',
    margin: 0,
    autoFit: false,            // keep the mapped font size; never re-flow
    wrap: true,
    lineSpacingMultiple: Number(obj.lineHeight) || 1.16
  };
  // fabric charSpacing is 1/1000 em; pptx charSpacing is in points. Convert
  // through the font size: (charSpacing/1000) em * fontSizePt = points.
  if (obj.charSpacing) options.charSpacing = round((Number(obj.charSpacing) / 1000) * options.fontSize, 2);
  const op = opacityOf(obj);
  if (op < 1) options.transparency = transparencyPct(op);
  if (obj.angle) options.rotate = Math.round(obj.angle);
  const shadow = shadowFrom(obj.shadow);
  if (shadow) options.shadow = shadow;
  return { kind: 'text', text, options };
}

/** Newlines a string forces (fallback height estimate only). */
function countLines(text) {
  return Math.max(1, String(text).split('\n').length);
}

/** Rect → rect|roundRect, Circle → ellipse. */
export function mapRectOrCircle(obj) {
  const fillHex = normHex(obj.fill);
  const lineHex = normHex(obj.stroke);
  if (!fillHex && !lineHex) return null; // nothing paintable

  let shapeType = 'rect';
  let w = effW(obj);
  let h = effH(obj);
  const options = { x: pxToIn(obj.left || 0), y: pxToIn(obj.top || 0) };

  if (obj.type === 'Circle') {
    shapeType = 'ellipse';
    const r = Number(obj.radius) || 0;
    w = r * 2 * (Number(obj.scaleX) || 1);
    h = r * 2 * (Number(obj.scaleY) || 1);
  } else if (obj.type === 'Rect' && obj.rx) {
    shapeType = 'roundRect';
    options.rectRadius = pxToIn(obj.rx);
  }
  options.w = pxToIn(w);
  options.h = pxToIn(h);
  applyPaint(options, obj, fillHex, lineHex);
  return { kind: 'shape', shapeType, options };
}

/**
 * Polygon → custGeom freeform with the TRUE silhouette. Points are canvas
 * space; normalize into the bounding box and convert to inches relative to the
 * shape origin (pptxgenjs custGeom points are box-relative). Fill + stroke
 * carry through. Falls back to a bbox rect if the point list is unusable.
 */
export function mapPolygon(obj) {
  const fillHex = normHex(obj.fill);
  const lineHex = normHex(obj.stroke);
  if (!fillHex && !lineHex) return null;

  const w = effW(obj);
  const h = effH(obj);
  const options = { x: pxToIn(obj.left || 0), y: pxToIn(obj.top || 0), w: pxToIn(w), h: pxToIn(h) };

  const pts = Array.isArray(obj.points) ? obj.points : null;
  if (!pts || pts.length < 3 || w <= 0 || h <= 0) {
    applyPaint(options, obj, fillHex, lineHex);
    return { kind: 'shape', shapeType: 'rect', options }; // degenerate → bbox
  }
  const minX = Math.min(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const sx = (Number(obj.scaleX) || 1);
  const sy = (Number(obj.scaleY) || 1);
  options.points = pts.map((p, i) => ({
    x: pxToIn((p.x - minX) * sx),
    y: pxToIn((p.y - minY) * sy),
    ...(i === 0 ? { moveTo: true } : {})
  }));
  options.points.push({ close: true });
  applyPaint(options, obj, fillHex, lineHex);
  return { kind: 'shape', shapeType: 'custGeom', options };
}

/** Line → { kind:'shape', shapeType:'line' } spanning the object box. */
export function mapLine(obj) {
  const lineHex = normHex(obj.stroke) || normHex(obj.fill);
  if (!lineHex) return null;
  const options = {
    x: pxToIn(obj.left || 0),
    y: pxToIn(obj.top || 0),
    w: pxToIn(effW(obj)),
    h: pxToIn(effH(obj)),
    line: {
      color: lineHex,
      width: pxToPt(obj.strokeWidth || 1),
      ...(Array.isArray(obj.strokeDashArray) && obj.strokeDashArray.length ? { dashType: 'dash' } : {})
    }
  };
  const op = opacityOf(obj);
  if (op < 1) options.line.transparency = transparencyPct(op);
  if (obj.angle) options.rotate = Math.round(obj.angle);
  return { kind: 'shape', shapeType: 'line', options };
}

/** Image (filled slot / editor image) → { kind:'image', ... } sized cover. */
export function mapImage(obj) {
  const src = obj.src;
  if (typeof src !== 'string' || !src) return null;
  const w = effW(obj);
  const h = effH(obj);
  const options = {
    x: pxToIn(obj.left || 0),
    y: pxToIn(obj.top || 0),
    w: pxToIn(w),
    h: pxToIn(h),
    sizing: { type: 'cover', w: pxToIn(w), h: pxToIn(h) }
  };
  const item = { kind: 'image', options };
  // data: URIs are inline-ready; /api/images/file/ refs are resolved by the
  // browser shell (fetch → data URI) before the deck is written.
  if (/^data:/i.test(src)) item.data = src;
  else item.path = src;
  item.src = src; // always carried so the shell can resolve + the spec is testable

  const op = opacityOf(obj);
  if (op < 1) options.transparency = transparencyPct(op);
  if (obj.angle) options.rotate = Math.round(obj.angle);
  return item;
}

/** Shared fill/line/opacity/rotation/shadow application for area shapes. */
function applyPaint(options, obj, fillHex, lineHex) {
  const transparency = transparencyPct(opacityOf(obj));
  // stroke-only shapes get a fully transparent fill so pptx never substitutes
  // its theme's default blue.
  options.fill = fillHex
    ? { color: fillHex, transparency }
    : { color: lineHex, transparency: 100 };
  if (lineHex) {
    options.line = {
      color: lineHex,
      width: pxToPt(obj.strokeWidth || 1),
      transparency,
      ...(Array.isArray(obj.strokeDashArray) && obj.strokeDashArray.length ? { dashType: 'dash' } : {})
    };
  }
  if (obj.angle) options.rotate = Math.round(obj.angle);
  const shadow = shadowFrom(obj.shadow);
  if (shadow) options.shadow = shadow;
}

/** One canvas object → one spec item (or null when it is not exportable). */
export function mapObject(obj) {
  if (!obj || typeof obj !== 'object') return null;
  switch (obj.type) {
    case 'Textbox': case 'IText': case 'Text': return mapTextbox(obj);
    case 'Rect': case 'Ellipse': return mapRectOrCircle(obj);
    case 'Circle': return mapRectOrCircle(obj);
    case 'Polygon': case 'Triangle': return mapPolygon(obj);
    case 'Line': return mapLine(obj);
    case 'Image': return mapImage(obj);
    default: return null; // unknown types never break an export
  }
}

// ── the public spec builder ─────────────────────────────────────────────────

/**
 * canvasToPptxSpec(canvas, opts) → a serializable slide spec:
 *   {
 *     layout: { name, width, height },   // inches, derived from canvas px
 *     background: 'RRGGBB' | null,       // slide fill (image bg handled as item)
 *     size: { wIn, hIn },
 *     items: [ ...spec items in z-order (canvas objects array order) ]
 *   }
 * opts (all optional):
 *   layoutName  custom layout name (default 'POSTER')
 *   bleed       inches of bleed to grow the slide on every edge (print)
 * The function is PURE: same input → same output, no I/O.
 */
export function canvasToPptxSpec(canvas, opts = {}) {
  const c = canvas || {};
  const wPx = Number(c.width) || 0;
  const hPx = Number(c.height) || 0;
  const bleed = Number(opts.bleed) || 0;

  const items = [];
  for (const obj of Array.isArray(c.objects) ? c.objects : []) {
    const item = mapObject(obj);
    if (!item) continue;
    if (bleed) {
      item.options.x = round((item.options.x || 0) + bleed);
      item.options.y = round((item.options.y || 0) + bleed);
    }
    items.push(item);
  }

  const wIn = round(pxToIn(wPx) + bleed * 2);
  const hIn = round(pxToIn(hPx) + bleed * 2);
  return {
    layout: { name: opts.layoutName || 'POSTER', width: wIn, height: hIn },
    background: normHex(c.background),
    size: { wIn, hIn },
    items
  };
}

export default canvasToPptxSpec;
