// templates/v2/decor.js — shared 2026-grade vector decor library (Phase O3).
// Every v2 template builds its background atmosphere from these pure
// functions. Each returns an ARRAY of fabric-v6 JSON objects (Rect / Circle /
// Polygon only — types the vendored fabric 6.x registry resolves), carrying
// layerRole 'background' (full-bleed washes) or 'decor' (motifs), and an
// EXPLICIT opacity. The visual language is restrained: washes 0.04–0.15,
// motifs never above 0.2 — decor is atmosphere, the content is the poster.
//
// All functions are parameterized by palette colors + canvas dims +
// `intensity` (0..1, default 1): intensity scales opacity DOWN from the
// documented base, never up past the caps, so templates can dial decor back
// without ever producing clutter.
//
// Also home to the v2 orientation contract (portrait 1414x2000, landscape
// 2000x1414) and the orientation-aware SVG preview wrapper — shared here so
// templates/v2/index.js (which imports the templates) stays cycle-free.

import { CANVAS_W, CANVAS_H, PV_W, PV_H, rect, circle, polygon } from '../helpers.js';

// ── orientation contract ─────────────────────────────────────────────────────

export const PORTRAIT_W = CANVAS_W;   // 1414
export const PORTRAIT_H = CANVAS_H;   // 2000
export const LANDSCAPE_W = 2000;
export const LANDSCAPE_H = 1414;
export const ORIENTATIONS = ['portrait', 'landscape'];

/** Canvas pixel dims for an orientation. Throws on unknown orientation. */
export function canvasDims(orientation) {
  if (orientation === 'portrait') return { w: PORTRAIT_W, h: PORTRAIT_H };
  if (orientation === 'landscape') return { w: LANDSCAPE_W, h: LANDSCAPE_H };
  throw new Error(`unknown orientation "${orientation}" (expected portrait|landscape)`);
}

/** Empty fabric-v6 canvas JSON for an orientation. */
export function makeCanvasV2(orientation, background) {
  const { w, h } = canvasDims(orientation);
  return { version: '6.7.1', width: w, height: h, background, objects: [] };
}

// ── opacity discipline ───────────────────────────────────────────────────────

function level(intensity) {
  const n = Number(intensity);
  return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
}

/** Scale a base opacity by intensity (floor 35% of base) and hard-cap it. */
function op(base, intensity, cap = 0.2) {
  const v = base * (0.35 + 0.65 * level(intensity));
  return Math.min(cap, Math.round(v * 1000) / 1000);
}

// ── gradient fill (fabric v6 serialized Gradient shape) ──────────────────────

/**
 * Serialized fabric-v6 linear gradient fill value. Fabric's
 * Gradient.fromObject enlivens exactly this shape from canvas JSON.
 * coords are pixel-space relative to the object's own box.
 */
export function linearGradientFill({ x1, y1, x2, y2, stops }) {
  return {
    type: 'linear',
    gradientUnits: 'pixels',
    coords: { x1, y1, x2, y2 },
    colorStops: stops.map(({ offset, color }) => ({ offset, color })),
    offsetX: 0,
    offsetY: 0
  };
}

// ── decor generators ─────────────────────────────────────────────────────────

/**
 * Layered gradient wash — the full-bleed color atmosphere under everything.
 * Visual intent: a barely-there diagonal tint sweep (think premium keynote
 * backdrops), giving the flat paper background depth without competing with
 * text. Opacity 0.04–0.15 by design (base 0.12 at intensity 1).
 *
 * direction: 'diagonal' (default) | 'vertical' | 'horizontal'
 */
export function gradientWash({ w, h, from, to, direction = 'diagonal', intensity = 1 }) {
  const coords = direction === 'vertical'
    ? { x1: 0, y1: 0, x2: 0, y2: h }
    : direction === 'horizontal'
      ? { x1: 0, y1: 0, x2: w, y2: 0 }
      : { x1: 0, y1: 0, x2: w, y2: h };
  return [
    rect({
      x: 0, y: 0, w, h,
      fill: linearGradientFill({ ...coords, stops: [{ offset: 0, color: from }, { offset: 1, color: to }] }),
      opacity: Math.max(0.04, op(0.12, intensity, 0.15)),
      layerRole: 'background'
    })
  ];
}

/**
 * Soft glow — three stacked concentric discs fading outward, simulating a
 * radial light bloom behind a focal zone. Visual intent: gentle spotlight
 * warmth, like a blurred stage light; never a hard circle.
 */
export function softGlow({ x, y, r, color, intensity = 1 }) {
  return [
    circle({ x, y, r, fill: color, opacity: op(0.05, intensity), layerRole: 'decor' }),
    circle({ x, y, r: Math.round(r * 0.68), fill: color, opacity: op(0.075, intensity), layerRole: 'decor' }),
    circle({ x, y, r: Math.round(r * 0.42), fill: color, opacity: op(0.10, intensity), layerRole: 'decor' })
  ];
}

/**
 * Dot grid — a quiet matrix of small discs. Visual intent: technical
 * blueprint texture anchoring an empty corner; reads as "digital" from a
 * distance without any literal iconography.
 */
export function dotGrid({ x, y, cols = 6, rows = 8, gap = 54, dotR = 5, color, intensity = 1 }) {
  const o = [];
  const alpha = op(0.14, intensity);
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      o.push(circle({ x: x + col * gap, y: y + row * gap, r: dotR, fill: color, opacity: alpha, layerRole: 'decor' }));
    }
  }
  return o;
}

/**
 * Shield motif — concentric shield outlines (badge-crest silhouette).
 * Visual intent: the universal "protected" mark as ghost geometry; outline
 * only, doubled inward for a subtle engraved feel. (x, y) is the shield's
 * top-center; size is the shield width.
 */
export function shieldMotif({ x, y, size, color, intensity = 1 }) {
  const h = size * 1.15;
  const pts = (s, ox, oy) => [
    { x: x - s / 2 + ox, y: y + oy },
    { x: x + s / 2 - ox, y: y + oy },
    { x: x + s / 2 - ox, y: y + h * 0.6 - oy * 0.4 },
    { x, y: y + h - oy },
    { x: x - s / 2 + ox, y: y + h * 0.6 - oy * 0.4 }
  ];
  const stroke = Math.max(3, Math.round(size * 0.035));
  return [
    polygon(pts(size, 0, 0), {
      fill: 'transparent', stroke: color, strokeWidth: stroke,
      opacity: op(0.11, intensity), layerRole: 'decor'
    }),
    polygon(pts(size, size * 0.12, size * 0.12), {
      fill: 'transparent', stroke: color, strokeWidth: Math.max(2, Math.round(stroke * 0.6)),
      opacity: op(0.07, intensity), layerRole: 'decor'
    })
  ];
}

/**
 * Signal arcs — concentric stroked rings radiating from a point, fading
 * outward. Visual intent: doubles as wifi/broadcast arcs (small, corner) and
 * as a wave/ripple pattern (large radius anchored off-canvas edge). Stacked
 * Circle strokes — no Path serialization quirks.
 */
export function signalArcs({ x, y, r, rings = 4, color, strokeWidth = 8, intensity = 1 }) {
  const o = [];
  for (let i = 0; i < rings; i++) {
    o.push(circle({
      x, y, r: Math.round((r * (i + 1)) / rings),
      fill: 'transparent', stroke: color, strokeWidth,
      opacity: op(Math.max(0.03, 0.11 - i * 0.018), intensity),
      layerRole: 'decor'
    }));
  }
  return o;
}

/**
 * Padlock silhouette — rounded body + stroked shackle ring, ghosted.
 * Visual intent: the "locked" glyph as ambient geometry, not an icon
 * demanding attention. (x, y) is the shackle's circle center; size is the
 * body width.
 */
export function padlockMotif({ x, y, size, color, intensity = 1 }) {
  const alpha = op(0.09, intensity);
  return [
    circle({
      x, y, r: Math.round(size * 0.3),
      fill: 'transparent', stroke: color, strokeWidth: Math.max(4, Math.round(size * 0.09)),
      opacity: alpha, layerRole: 'decor'
    }),
    rect({
      x: x - size / 2, y: y + size * 0.12, w: size, h: Math.round(size * 0.78),
      fill: color, rx: Math.round(size * 0.14), opacity: alpha, layerRole: 'decor'
    })
  ];
}

/**
 * Fingerprint arcs — nested stroked rings around a solid core dot.
 * Visual intent: an abstracted fingerprint whorl (identity/biometrics) that
 * scans as pure concentric texture from poster distance.
 */
export function fingerprintArcs({ x, y, size, color, intensity = 1 }) {
  const o = [circle({ x, y, r: Math.max(3, Math.round(size * 0.05)), fill: color, opacity: op(0.12, intensity), layerRole: 'decor' })];
  const radii = [0.16, 0.29, 0.42, 0.55];
  radii.forEach((f, i) => {
    o.push(circle({
      x, y, r: Math.round(size * f),
      fill: 'transparent', stroke: color, strokeWidth: Math.max(3, Math.round(size * 0.04)),
      opacity: op(0.10 - i * 0.012, intensity), layerRole: 'decor'
    }));
  });
  return o;
}

/**
 * Diagonal light beams — a few wide, tilted translucent bands sweeping the
 * canvas. Visual intent: volumetric light through a window; adds motion to a
 * static layout. Bands are oversized and angled so they always bleed past
 * the canvas edges.
 */
export function lightBeams({ w, h, color, count = 3, angle = 24, intensity = 1 }) {
  const o = [];
  const bandW = Math.round(w * 0.16);
  for (let i = 0; i < count; i++) {
    o.push(rect({
      x: Math.round(w * 0.18 * i), y: Math.round(-h * 0.25),
      w: bandW, h: Math.round(h * 1.6),
      fill: color, angle, opacity: op(0.05 + i * 0.012, intensity, 0.12),
      layerRole: 'decor'
    }));
  }
  return o;
}

/**
 * Rounded-corner frame accents — four L-shaped corner brackets tracing an
 * inset frame. Visual intent: a viewfinder/passe-partout that quietly frames
 * the composition; arms only, never a full box.
 */
export function cornerFrame({ x, y, w, h, color, arm = 90, thickness = 8, intensity = 1 }) {
  const alpha = op(0.16, intensity);
  const bar = (bx, by, bw, bh) =>
    rect({ x: bx, y: by, w: bw, h: bh, fill: color, rx: thickness / 2, opacity: alpha, layerRole: 'decor' });
  return [
    bar(x, y, arm, thickness), bar(x, y, thickness, arm),                                              // top-left
    bar(x + w - arm, y, arm, thickness), bar(x + w - thickness, y, thickness, arm),                    // top-right
    bar(x, y + h - thickness, arm, thickness), bar(x, y + h - arm, thickness, arm),                    // bottom-left
    bar(x + w - arm, y + h - thickness, arm, thickness), bar(x + w - thickness, y + h - arm, thickness, arm) // bottom-right
  ];
}

// ── dark-tone palette anchors (Phase I4 — predominantly-black templates) ─────
// The v2 "night" family paints a near-black canvas and inverts the ink: light
// warm off-white text on deep charcoal surfaces, brand color reserved for
// accents + glow. These anchors are NOT brand-overridable (like palette.dark):
// they guarantee AA-contrast light text on a controlled dark base regardless of
// what background the org brand supplies, so a dark template never renders
// dark-on-dark. Text builders pass bgRef: DARK_BASE (or DARK_PANEL) so the
// pipeline's contrast check sees the real surface beneath the glyphs.

export const DARK_BASE = '#0D0C12';     // predominantly-black canvas base
export const DARK_PANEL = '#17161F';    // raised charcoal surface (cards / bars)
export const DARK_PANEL_2 = '#1F1D29';  // a second, slightly lifted surface tier
export const DARK_INK = '#F4F1EA';      // warm off-white — primary text on dark
export const DARK_INK_DIM = '#B7B2C4';  // muted lavender-grey — secondary text

// Soft drop shadow for text that sits directly over imagery (image-first
// templates), guaranteeing legibility on the busiest AI backgrounds even where
// the scrim is light. A fabric shadow shape — pass as textbox({ shadow }).
export const OVERLAY_TEXT_SHADOW = { color: 'rgba(0,0,0,0.6)', blur: 16, offsetX: 0, offsetY: 2 };

/**
 * Perspective grid — a receding "floor" of horizontal rules that bunch toward a
 * horizon plus a fan of verticals converging on a vanishing point. Visual
 * intent: a neon data-stage / tron floor under giant figures. Pure Rects
 * (horizontals) + angled Rects (verticals) so nothing but decor opacity ships.
 * (x0,y0)-(x0+w) is the floor's near edge span; horizonY is where lines vanish.
 */
export function perspectiveGrid({ w, horizonY, floorY, color, rows = 7, cols = 8, intensity = 1 }) {
  const o = [];
  const alpha = op(0.13, intensity);
  const depth = Math.max(1, floorY - horizonY);
  // horizontals: eased toward the horizon (denser far away)
  for (let i = 1; i <= rows; i++) {
    const t = i / rows;
    const y = Math.round(horizonY + depth * (t * t));
    o.push(rect({
      x: 0, y, w, h: Math.max(2, Math.round(2 + t * 3)),
      fill: color, opacity: Math.min(0.2, alpha * (0.5 + t)), layerRole: 'decor'
    }));
  }
  // verticals: fan from a central vanishing point down to the near edge
  const vx = w / 2;
  for (let c = 0; c <= cols; c++) {
    const nearX = (w / cols) * c;
    const dx = nearX - vx;
    const dy = floorY - horizonY;
    const angle = Math.atan2(dx, dy) * 180 / Math.PI; // tilt from vertical
    const len = Math.round(Math.hypot(dx, dy));
    o.push(rect({
      x: Math.round(vx), y: horizonY, w: Math.max(2, Math.round(2 + Math.abs(dx) / w * 3)), h: len,
      fill: color, angle, opacity: Math.min(0.2, op(0.10, intensity)), layerRole: 'decor'
    }));
  }
  return o;
}

/**
 * Scanlines — evenly spaced hairline rules across a region. Visual intent: a
 * terminal / CRT / ticker readout texture. Restrained opacity; horizontal by
 * default (set vertical:true for a rain-of-columns feel).
 */
export function scanlines({ x = 0, y, w, h, gap = 14, color, thickness = 2, vertical = false, intensity = 1 }) {
  const o = [];
  const alpha = op(0.09, intensity);
  if (vertical) {
    for (let cx = x; cx <= x + w; cx += gap) {
      o.push(rect({ x: cx, y, w: thickness, h, fill: color, opacity: alpha, layerRole: 'decor' }));
    }
  } else {
    for (let cy = y; cy <= y + h; cy += gap) {
      o.push(rect({ x, y: cy, w, h: thickness, fill: color, opacity: alpha, layerRole: 'decor' }));
    }
  }
  return o;
}

/**
 * Mesh glow — two or three offset radial blooms in the accent/primary colors,
 * simulating a modern mesh-gradient backdrop on a dark canvas. Composes
 * softGlow, so every disc keeps the same restrained opacity discipline.
 * `spots` is an array of {x, y, r, color}.
 */
export function meshGlow({ spots, intensity = 1 }) {
  const o = [];
  for (const s of spots) o.push(...softGlow({ x: s.x, y: s.y, r: s.r, color: s.color, intensity }));
  return o;
}

/**
 * Legibility scrim (Phase C): the layer that sits ABOVE a full-bleed background
 * image and BELOW all content, so poster text stays readable over busy
 * futuristic art. A base dark wash plus stronger dark gradient bands at the top
 * (headline zone) and bottom (CTA zone). Uses a DEDICATED layerRole 'scrim'
 * (NOT 'background'/'decor') so it is exempt from the ≤0.2 decor-opacity rule —
 * a scrim must be strong (40–60%) to do its job. Emit these objects right after
 * the background image slot and before headline/blocks/cta. Render order is
 * array order, so position matters, not the role.
 */
export function legibilityScrim({ w, h, color = DARK_BASE, strength = 1 }) {
  const s = Math.max(0, Math.min(1, strength));
  const topH = Math.round(h * 0.42);
  const botH = Math.round(h * 0.30);
  return [
    // base wash across the whole canvas
    rect({ x: 0, y: 0, w, h, fill: color, opacity: Math.min(0.62, 0.40 * s), layerRole: 'scrim' }),
    // stronger dark band fading down from the top (protects the headline)
    rect({
      x: 0, y: 0, w, h: topH,
      fill: linearGradientFill({ x1: 0, y1: 0, x2: 0, y2: topH, stops: [{ offset: 0, color }, { offset: 1, color }] }),
      opacity: Math.min(0.62, 0.45 * s), layerRole: 'scrim'
    }),
    // stronger dark band fading up from the bottom (protects the CTA)
    rect({
      x: 0, y: h - botH, w, h: botH,
      fill: linearGradientFill({ x1: 0, y1: botH, x2: 0, y2: 0, stops: [{ offset: 0, color }, { offset: 1, color }] }),
      opacity: Math.min(0.62, 0.45 * s), layerRole: 'scrim'
    })
  ];
}

// ── orientation-aware SVG preview wrapper ────────────────────────────────────
// Portrait previews are 200x283 (the v1 idiom); landscape previews are
// 283x200. Both use the SAME pv() scale from helpers.js (200/1414 ≈ 0.1414 —
// 2000px landscape width lands on 283), so template preview code scales every
// coordinate with pv() regardless of orientation.

export const PV_LAND_W = 283;
export const PV_LAND_H = 200;

export function pvDims(orientation) {
  return orientation === 'landscape' ? { w: PV_LAND_W, h: PV_LAND_H } : { w: PV_W, h: PV_H };
}

export function svgWrapO(parts, bg, orientation) {
  const { w, h } = pvDims(orientation);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img">` +
    `<rect width="${w}" height="${h}" fill="${bg}"/>${parts.join('')}</svg>`;
}
