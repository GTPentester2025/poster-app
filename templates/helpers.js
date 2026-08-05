// Shared canvas-object factories for the design phase (spec §B.6). Every
// template (predefined AND compiled dynamic layouts) builds its Fabric.js-
// compatible canvas JSON through these helpers, so the design model stays
// uniform: 1414x2000px, every object carries layerRole (+ msgId for message
// text, slotId for image slots), text is rendered locally from approved
// content (never baked into images), and image slots are honest dashed
// frames — an empty slot is an empty slot, not a fake picture.
//
// Fabric contract: object `type` names are CAPITALIZED ('Textbox', 'Rect',
// 'Circle', 'Polygon', 'Line') — the fabric v6 class-registry convention the
// vendored ui/vendor/fabric.min.js (6.x) resolves. Fabric 7 drops the legacy
// type alias, so a fabric bump must revisit these emitters (guarded by
// templates.test.js fabric-contract assertions).
//
// layerRole/msgId/slotSpec/bgRef live in the PERSISTED canvas JSON — that is
// what Phase 7+ (images, editor, translation) read. Fabric's loadFromJSON
// intentionally drops unknown props on enlivened preview instances; the
// read-only preview doesn't need them.

export const CANVAS_W = 1414;
export const CANVAS_H = 2000;

export const LAYER_ROLES = [
  'background', 'headline', 'subheadline', 'message', 'message-label',
  'cta', 'image-slot', 'image', 'decor', 'scrim'
];

// Semantic duel colors (dos vs don'ts). Deliberately NOT part of the brand
// palette: green/red carry meaning (safe/danger) that must survive any brand
// override, exactly like traffic signage.
export const SEMANTIC_GREEN = '#1E8A4E';

// ── canvas + object factories (fabric v6 JSON shapes) ───────────────────────

export function makeCanvas(background) {
  return { version: '6.7.1', width: CANVAS_W, height: CANVAS_H, background, objects: [] };
}

/** Multiline-capable text block. Fabric Textbox wraps at `w`. */
export function textbox({
  text, x, y, w, fontSize, fontFamily, fill,
  fontWeight = 'normal', align = 'left', lineHeight = 1.16,
  layerRole, msgId = null, charSpacing = 0, shadow = null, bgRef = null
}) {
  return {
    type: 'Textbox', left: x, top: y, width: w,
    text: String(text), fontSize, fontFamily, fontWeight,
    fill, textAlign: align, lineHeight, charSpacing,
    ...(shadow ? { shadow } : {}),
    layerRole, ...(msgId ? { msgId } : {}), ...(bgRef ? { bgRef } : {})
  };
}

export function rect({
  x, y, w, h, fill, rx = 0, stroke = null, strokeWidth = 0,
  strokeDashArray = null, angle = 0, opacity = 1, shadow = null, skewX = 0,
  layerRole = 'decor', msgId = null
}) {
  return {
    type: 'Rect', left: x, top: y, width: w, height: h, fill,
    rx, ry: rx,
    ...(stroke ? { stroke, strokeWidth } : {}),
    ...(strokeDashArray ? { strokeDashArray } : {}),
    ...(angle ? { angle } : {}), ...(skewX ? { skewX } : {}),
    ...(opacity !== 1 ? { opacity } : {}),
    ...(shadow ? { shadow } : {}),
    layerRole, ...(msgId ? { msgId } : {})
  };
}

export function circle({ x, y, r, fill, stroke = null, strokeWidth = 0, opacity = 1, layerRole = 'decor' }) {
  // x,y = center (converted to fabric's left/top box position)
  return {
    type: 'Circle', left: x - r, top: y - r, radius: r, fill,
    ...(stroke ? { stroke, strokeWidth } : {}),
    ...(opacity !== 1 ? { opacity } : {}),
    layerRole
  };
}

export function polygon(points, { fill, opacity = 1, stroke = null, strokeWidth = 0, layerRole = 'decor' }) {
  const xs = points.map((p) => p.x);
  const ys = points.map((p) => p.y);
  return {
    type: 'Polygon', points: points.map(({ x, y }) => ({ x, y })),
    left: Math.min(...xs), top: Math.min(...ys),
    width: Math.max(...xs) - Math.min(...xs), height: Math.max(...ys) - Math.min(...ys),
    fill,
    ...(stroke ? { stroke, strokeWidth } : {}),
    ...(opacity !== 1 ? { opacity } : {}),
    layerRole
  };
}

/** Thin horizontal/vertical rules (Rects — no fabric Line serialization quirks). */
export function hline({ x, y, w, thickness = 4, fill, layerRole = 'decor' }) {
  return rect({ x, y, w, h: thickness, fill, layerRole });
}
export function vline({ x, y, h, thickness = 4, fill, layerRole = 'decor' }) {
  return rect({ x, y, w: thickness, h, fill, layerRole });
}

/**
 * Label chip (pill + uppercase label text). Returns [pillRect, labelText];
 * both carry layerRole 'message-label' + the message's msgId so the future
 * layer UI can group them with their message.
 */
export function chip({ text, x, y, fontSize = 26, bg, color, font, msgId = null, square = false, maxW = Infinity, maxH = Infinity }) {
  const label = String(text).toUpperCase();
  const padX = Math.round(fontSize * 0.7);
  const padY = Math.round(fontSize * 0.46);
  // width must include the rendered letter tracking (charSpacing 60 = 0.06em
  // per character) — estTextWidth alone under-measures and clips the label
  const trackingW = Math.round(label.length * fontSize * 0.06);
  const rawW = Math.round(estTextWidth(label, fontSize) * 1.08) + trackingW + padX * 2;
  const w = maxW < Infinity ? Math.min(rawW, maxW) : rawW;
  const innerW = Math.max(w - padX * 2, 1);
  // If maxH budget supplied, shrink font size to fit within it
  let effSize = fontSize;
  if (maxH < Infinity) {
    const budgetText = maxH - padY * 2;
    effSize = fitFontSize(label, { width: innerW, height: Math.max(budgetText, effSize * 1.2), maxSize: fontSize, minSize: 16, lineHeight: 1.2 });
  }
  const textH = Math.round(estTextHeight(label, effSize, innerW, 1.2));
  const h = Math.min(maxH < Infinity ? maxH : Infinity, textH + padY * 2);
  return [
    rect({ x, y, w, h, fill: bg, rx: square ? 6 : Math.min(h / 2, 24), layerRole: 'message-label', msgId }),
    textbox({
      text: label, x: x + padX, y: y + padY, w: innerW,
      fontSize: effSize, fontFamily: font, fontWeight: '800', fill: color, align: 'center',
      charSpacing: 60, layerRole: 'message-label', msgId, lineHeight: 1.2
    })
  ];
}

/**
 * Image slot: an HONEST placeholder — a subtle dashed frame with a slot spec
 * for Phase 7 (image subsystem). Never a fake image.
 */
export function imageSlot({ slotId, x, y, w, h, styleHint, stroke, rx = 16, blockId = null }) {
  return {
    type: 'Rect', left: x, top: y, width: w, height: h,
    fill: 'transparent', stroke, strokeWidth: 3, strokeDashArray: [14, 10],
    rx, ry: rx, opacity: 0.8,
    layerRole: 'image-slot', slotId,
    // blockId (when the slot illustrates a specific content block) lets the fill
    // pipeline derive a POINT-RELEVANT image concept from that block's text —
    // the image depicts the point it sits against, not just the topic.
    slotSpec: { slotId, styleHint, ...(blockId ? { blockId } : {}) }
  };
}

/**
 * Full-bleed background image slot (Phase C): an HONEST dashed placeholder that
 * covers the whole canvas and renders FIRST (emit it as the first object so the
 * filled image sits behind the legibility scrim + all content). slotId is fixed
 * to 'bg' so the fill pipeline can recognize the background role. Same honest
 * contract as imageSlot — an empty slot is an empty slot, never a fake picture.
 */
export function backgroundImageSlot({ w, h, styleHint, stroke, slotId = 'bg' }) {
  return {
    type: 'Rect', left: 0, top: 0, width: w, height: h,
    fill: 'transparent', stroke, strokeWidth: 3, strokeDashArray: [22, 16],
    rx: 0, ry: 0, opacity: 0.5,
    layerRole: 'image-slot', slotId,
    slotSpec: { slotId, styleHint }
  };
}

// ── contrast utilities ───────────────────────────────────────────────────────

function hexChannel(hex, i) {
  return parseInt(hex.slice(1 + i * 2, 3 + i * 2), 16) / 255;
}

export function relLuminance(hex) {
  const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return 0.2126 * lin(hexChannel(hex, 0)) + 0.7152 * lin(hexChannel(hex, 1)) + 0.0722 * lin(hexChannel(hex, 2));
}

/** WCAG contrast ratio between two #rrggbb colors (1..21). */
export function contrastRatio(a, b) {
  const la = relLuminance(a);
  const lb = relLuminance(b);
  const [hi, lo] = la >= lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Pick the readable text color (dark or light) for a given background. */
export function pickTextColor(bg, dark = '#1F1A17', light = '#FFFFFF') {
  return contrastRatio(bg, dark) >= contrastRatio(bg, light) ? dark : light;
}

// ── text measurement (layout estimation; the browser does the real render) ──

const AVG_CHAR_W = 0.54; // avg glyph advance / fontSize for Montserrat/Inter

export function estTextWidth(text, fontSize) {
  return String(text).length * fontSize * AVG_CHAR_W;
}

/** Greedy word-wrap simulation → number of lines a Textbox will need. */
export function estLines(text, fontSize, width) {
  const words = String(text).trim().split(/\s+/).filter(Boolean);
  if (!words.length) return 1;
  const maxChars = Math.max(4, Math.floor(width / (fontSize * AVG_CHAR_W)));
  let lines = 1;
  let lineLen = 0;
  for (const word of words) {
    const add = lineLen === 0 ? word.length : word.length + 1;
    if (lineLen + add > maxChars && lineLen > 0) {
      lines += 1;
      lineLen = word.length;
    } else {
      lineLen += add;
    }
  }
  return lines;
}

export function estTextHeight(text, fontSize, width, lineHeight = 1.16) {
  return estLines(text, fontSize, width) * fontSize * lineHeight;
}

/**
 * Largest font size (stepping down from maxSize) whose estimated wrapped
 * height fits `height`; never below minSize (readability floor — headline 80,
 * message 38 at 1414w per the design model).
 */
export function fitFontSize(text, { width, height, maxSize, minSize, lineHeight = 1.16 }) {
  for (let size = maxSize; size >= minSize; size -= 2) {
    if (estTextHeight(text, size, width, lineHeight) <= height) return size;
  }
  return minSize;
}

/**
 * Fit font size AND return the resulting wrapped height in a single call.
 * The root cause of layout overlaps is calling fitFontSize and then
 * estTextHeight separately — callers often use different arguments or forget
 * to advance the cursor. Use this helper to get both in one shot:
 *
 *   const { fontSize, height } = fitTextBlock(text, { width, height: avail, maxSize, minSize });
 *   o.push(textbox({ ..., fontSize }));
 *   cursor += height + gap;
 *
 * `height` is the ACTUAL wrapped height at the fitted font size, not the
 * available height — it is always <= the `height` budget you passed in.
 */
export function fitTextBlock(text, { width, height, maxSize, minSize, lineHeight = 1.16 }) {
  const fontSize = fitFontSize(text, { width, height, maxSize, minSize, lineHeight });
  return { fontSize, height: estTextHeight(text, fontSize, width, lineHeight) };
}

// ── message classification (shared by duel/scenario layouts) ────────────────

const NEGATIVE_LABEL = /don'?t|never|avoid|stop|red\s*flag|risk|warning|scenario|threat/i;

/** Split messages into [positive, negative] by label semantics; unlabeled alternate. */
export function splitMessages(messages) {
  const pos = [];
  const neg = [];
  messages.forEach((m, i) => {
    if (m.label && NEGATIVE_LABEL.test(m.label)) neg.push(m);
    else if (m.label) pos.push(m);
    else (i % 2 === 0 ? pos : neg).push(m);
  });
  // a duel needs both sides — rebalance a lopsided split
  if (!pos.length && neg.length > 1) pos.push(neg.pop());
  if (!neg.length && pos.length > 1) neg.push(pos.pop());
  return [pos, neg];
}

// ── SVG preview primitives (template thumbnails, ~200x283) ──────────────────
// Previews are REAL renderings of each template's geometry (blocks, panels,
// slots, decor) with bars standing in for text lines — no sample copy, no
// dummy data.

export const PV_W = 200;
export const PV_H = 283;

/** Scale a canvas-space value into preview space. */
export function pv(v) {
  return Math.round((v * PV_W / CANVAS_W) * 10) / 10;
}

export function svgWrap(parts, bg) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${PV_W} ${PV_H}" width="${PV_W}" height="${PV_H}" role="img">` +
    `<rect width="${PV_W}" height="${PV_H}" fill="${bg}"/>${parts.join('')}</svg>`;
}

export function pvRect(x, y, w, h, fill, { rx = 0, dash = null, stroke = null, opacity = null } = {}) {
  return `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}"` +
    (rx ? ` rx="${rx}"` : '') +
    (stroke ? ` stroke="${stroke}" stroke-width="1.2"` : '') +
    (dash ? ` stroke-dasharray="${dash}"` : '') +
    (opacity != null ? ` opacity="${opacity}"` : '') + '/>';
}

export function pvCircle(cx, cy, r, fill, { stroke = null, opacity = null } = {}) {
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}"` +
    (stroke ? ` stroke="${stroke}" stroke-width="1.5"` : '') +
    (opacity != null ? ` opacity="${opacity}"` : '') + '/>';
}

export function pvPoly(points, fill, { opacity = null } = {}) {
  const pts = points.map((p) => `${p.x},${p.y}`).join(' ');
  return `<polygon points="${pts}" fill="${fill}"` + (opacity != null ? ` opacity="${opacity}"` : '') + '/>';
}

/** Stand-in text lines: rounded bars, widths tapering like ragged copy. */
export function pvBars({ x, y, w, lines, barH, gap, fill, align = 'left' }) {
  const widths = [1, 0.86, 0.62, 0.9, 0.7];
  const parts = [];
  for (let i = 0; i < lines; i++) {
    const bw = Math.round(w * widths[i % widths.length]);
    const bx = align === 'center' ? x + (w - bw) / 2 : align === 'right' ? x + w - bw : x;
    parts.push(pvRect(bx, y + i * (barH + gap), bw, barH, fill, { rx: barH / 2 }));
  }
  return parts.join('');
}

/** Dashed slot frame in preview space. */
export function pvSlot(x, y, w, h, stroke) {
  return pvRect(x, y, w, h, 'none', { rx: 3, stroke, dash: '4 3' });
}
