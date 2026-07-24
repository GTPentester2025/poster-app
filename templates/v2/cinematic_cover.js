// v2 template — cinematic-cover (style: statement). A magazine / keynote-grade
// cover where a full-bleed HERO IMAGE dominates and type is a clean, bold
// overlay — no cards, no pills, no chips. A dramatic edge-to-edge background
// image carries the whole poster; two LARGE supporting image slots stack as
// big cinematic bands over the top two-thirds; a strong dark legibility scrim
// keeps the bottom-third text readable. The text block is pure overlay: a huge
// headline, a dim subheadline, the single message line, a thin primary accent
// rule, and a bold CTA — imagery + typography only. Portrait: hero bg + two
// full-width bands stacked, text pinned to the bottom third. Landscape: a REAL
// relayout — hero band on the left half full-height, one supporting band top-
// right, and the text column stacked down the right side.

import {
  textbox, imageSlot, backgroundImageSlot, rect,
  fitFontSize, estTextHeight,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, softGlow, legibilityScrim,
  meshGlow, cornerFrame, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_INK, DARK_INK_DIM, OVERLAY_TEXT_SHADOW
} from './decor.js';

// ── shared: the clean overlay text column (no card, no pills) ────────────────
// Lays out eyebrow rule → headline (huge) → subheadline (dim) → accent rule →
// block text → cta. All bound with bgRef DARK_BASE (text over scrim).
function overlayText(o, content, palette, fonts, { x, y, w, align = 'left', maxHead = 148, headMaxH = 460, bodyMaxH = 320 }) {
  let cursor = y;

  // thin primary eyebrow rule above headline — editorial magazine detail
  const eyebrowW = align === 'center' ? Math.round(w * 0.18) : 56;
  const eyebrowX = align === 'center' ? x + Math.round((w - eyebrowW) / 2) : x;
  o.push(rect({
    x: eyebrowX, y: cursor, w: eyebrowW, h: 4, fill: palette.primary, rx: 2,
    opacity: 0.2, layerRole: 'decor'
  }));
  cursor += 4 + 16;

  // HUGE headline — the cover title
  const headSize = fitFontSize(content.headline, { width: w, height: headMaxH, maxSize: maxHead, minSize: 40 });
  o.push(textbox({
    text: content.headline, x, y: cursor, w, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK, align,
    lineHeight: 1.04, layerRole: 'headline', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
  cursor += estTextHeight(content.headline, headSize, w, 1.04) + 24;

  // subheadline (dim) — only when present
  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: w, height: 120, maxSize: 44, minSize: 16, lineHeight: 1.2 }); // lineHeight matches render
    o.push(textbox({
      text: content.subheadline, x, y: cursor, w, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM, align,
      lineHeight: 1.2, layerRole: 'subheadline', bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW
    }));
    cursor += estTextHeight(content.subheadline, subSize, w, 1.2) + 24;
  }

  // primary accent rule — separates headline zone / body zone
  const ruleW = align === 'center' ? Math.round(w * 0.32) : Math.round(w * 0.26);
  const ruleX = align === 'center' ? x + Math.round((w - ruleW) / 2) : x;
  o.push(rect({
    x: ruleX, y: cursor, w: ruleW, h: 3, fill: palette.primary, rx: 2,
    opacity: 0.2, layerRole: 'decor'
  }));
  cursor += 3 + 24;

  // the single message line — bound (msgId + fieldRef + bgRef)
  const block = (content.blocks && content.blocks[0]) || { id: 'blk-1', text: '' };
  const bodySize = fitFontSize(block.text, { width: w, height: bodyMaxH, maxSize: 52, minSize: 20, lineHeight: 1.24 });
  o.push({
    ...textbox({
      text: block.text, x, y: cursor, w, fontSize: bodySize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK, align,
      lineHeight: 1.24, layerRole: 'message', msgId: block.id, bgRef: DARK_BASE,
      shadow: OVERLAY_TEXT_SHADOW
    }),
    fieldRef: 'text'
  });
  cursor += estTextHeight(block.text, bodySize, w, 1.24) + 32;

  // CTA — bold, primary
  const ctaSize = fitFontSize(content.callToAction, { width: w, height: 128, maxSize: 50, minSize: 30, lineHeight: 1.08 });
  o.push(textbox({
    text: content.callToAction, x, y: cursor, w, fontSize: ctaSize,
    fontFamily: fonts.head, fontWeight: '800', fill: palette.primary, align,
    charSpacing: 40, lineHeight: 1.08, layerRole: 'cta', bgRef: DARK_BASE,
    shadow: OVERLAY_TEXT_SHADOW
  }));
  cursor += estTextHeight(content.callToAction, ctaSize, w, 1.08);
  return cursor;
}

// ── portrait: hero bg + two full-width cinematic bands, text bottom third ─────
function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'full-bleed cinematic hero image relevant to the security topic — a lone figure at a glowing workstation in a dark operations room, dramatic volumetric lighting, deep shadows, moody teal-and-amber grade, edge-to-edge, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  // atmosphere: mesh glow (two offset blooms) + diagonal wash
  o.push(...meshGlow({
    spots: [
      { x: Math.round(W * 0.72), y: 480, r: 560, color: palette.primary },
      { x: Math.round(W * 0.18), y: 1600, r: 480, color: palette.accent }
    ], intensity: 0.9
  }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'diagonal', intensity: 1 }));

  // TWO large supporting image bands stacked over the top two-thirds
  o.push(imageSlot({
    slotId: 'slot-1', x: 80, y: 104, w: W - 160, h: 736,
    styleHint: 'cinematic supporting image — an extreme close-up of a fingerprint dissolving into circuitry, dramatic rim light, cinematic depth of field, no text',
    stroke: palette.primary, rx: 24
  }));
  o.push(imageSlot({
    slotId: 'slot-2', x: 80, y: 864, w: W - 160, h: 432,
    styleHint: 'cinematic supporting image — a phishing hook made of light emerging from a smartphone screen in the dark, dramatic lighting, no text',
    stroke: palette.primary, rx: 20
  }));

  // corner frame accents in the composition zone (decor, <=0.2)
  o.push(...cornerFrame({ x: 80, y: 104, w: W - 160, h: 1192, color: palette.primary, arm: 72, thickness: 6, intensity: 0.9 }));

  // clean overlay text pinned to the bottom third (no card).
  // maxHead capped at 120 so the headline stays ≤2 lines, leaving room for
  // subheadline + message + CTA within the canvas before y=2000.
  // y=1360, available=640px; cap headline+body so everything fits before y=2000
  overlayText(o, content, palette, fonts, { x: 88, y: 1360, w: W - 176, align: 'left', maxHead: 120, headMaxH: 200, bodyMaxH: 100 });

  return canvas;
}

// ── landscape: REAL relayout — hero band left, supporting band + text right ───
function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({
    w: W, h: H,
    styleHint: 'full-bleed cinematic hero image relevant to the security topic — a lone figure at a glowing workstation in a dark operations room, dramatic volumetric lighting, deep shadows, moody teal-and-amber grade, edge-to-edge, no text',
    stroke: palette.primary
  }));
  o.push(...legibilityScrim({ w: W, h: H }));

  o.push(...meshGlow({
    spots: [
      { x: 460, y: Math.round(H * 0.5), r: 640, color: palette.primary },
      { x: W - 280, y: Math.round(H * 0.65), r: 400, color: palette.accent }
    ], intensity: 0.9
  }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: palette.accent, direction: 'horizontal', intensity: 1 }));

  // hero band: left half, full height
  o.push(imageSlot({
    slotId: 'slot-1', x: 80, y: 104, w: 904, h: H - 208,
    styleHint: 'cinematic supporting image — an extreme close-up of a fingerprint dissolving into circuitry, dramatic rim light, cinematic depth of field, no text',
    stroke: palette.primary, rx: 24
  }));

  // supporting band: right column, top
  o.push(imageSlot({
    slotId: 'slot-2', x: 1032, y: 104, w: W - 1032 - 80, h: 456,
    styleHint: 'cinematic supporting image — a phishing hook made of light emerging from a smartphone screen in the dark, dramatic lighting, no text',
    stroke: palette.primary, rx: 20
  }));

  // clean overlay text stacked down the right side, under the supporting band
  // y=608, available=806px; headMaxH:300 leaves room for sub+message+cta
  overlayText(o, content, palette, fonts, { x: 1032, y: 608, w: W - 1032 - 80, align: 'left', maxHead: 118, headMaxH: 300, bodyMaxH: 150 });

  return canvas;
}

// ── previews ─────────────────────────────────────────────────────────────────
function pvGlow(parts, x, y, r, color) {
  parts.push(`<circle cx="${pv(x)}" cy="${pv(y)}" r="${pv(r)}" fill="${color}" opacity="0.1"/>`);
}

function pvOverlay(parts, palette, { x, y, w, align = 'left' }) {
  // eyebrow rule
  parts.push(pvRect(pv(x), pv(y), pv(56), pv(4), palette.primary, { rx: 2 }));
  // huge headline bars
  parts.push(pvBars({ x: pv(x), y: pv(y + 24), w: pv(w), lines: 2, barH: 12, gap: 6, fill: DARK_INK, align }));
  const subY = y + 280;
  parts.push(pvBars({ x: pv(x), y: pv(subY), w: pv(w * 0.9), lines: 1, barH: 6, gap: 5, fill: DARK_INK_DIM, align }));
  // accent rule
  const ruleW = Math.round(w * 0.26);
  const ruleX = align === 'center' ? x + Math.round((w - ruleW) / 2) : x;
  parts.push(pvRect(pv(ruleX), pv(subY + 64), pv(ruleW), pv(3), palette.primary, { rx: 2 }));
  // body + cta bars
  parts.push(pvBars({ x: pv(x), y: pv(subY + 96), w: pv(w), lines: 2, barH: 6, gap: 5, fill: DARK_INK, align }));
  parts.push(pvBars({ x: pv(x), y: pv(subY + 216), w: pv(w * 0.56), lines: 1, barH: 8, gap: 5, fill: palette.primary, align }));
}

function previewPortrait(palette) {
  const parts = [];
  pvGlow(parts, 1018, 480, 560, palette.primary);
  pvGlow(parts, 256, 1600, 480, palette.accent);
  parts.push(pvSlot(pv(80), pv(104), pv(1414 - 160), pv(736), palette.primary));
  parts.push(pvSlot(pv(80), pv(864), pv(1414 - 160), pv(432), palette.primary));
  pvOverlay(parts, palette, { x: 88, y: 1360, w: 1414 - 176, align: 'left' });
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const parts = [];
  pvGlow(parts, 460, 707, 640, palette.primary);
  pvGlow(parts, 1720, 920, 400, palette.accent);
  parts.push(pvSlot(pv(80), pv(104), pv(904), pv(1414 - 208), palette.primary));
  parts.push(pvSlot(pv(1032), pv(104), pv(2000 - 1032 - 80), pv(456), palette.primary));
  pvOverlay(parts, palette, { x: 1032, y: 608, w: 2000 - 1032 - 80, align: 'left' });
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'cinematic-cover',
  name: 'Cinematic cover',
  style: 'statement',
  description: 'A magazine / keynote-grade cover where a full-bleed cinematic hero image dominates and type is a clean bold overlay — no cards, no pills. A dramatic edge-to-edge background image carries the poster while two large supporting image bands stack over the top two-thirds and a strong legibility scrim keeps the bottom-third text readable. The text is pure overlay: a huge headline, a dim subheadline, a thin primary accent rule, the single message line, and a bold CTA. Portrait stacks two full-width bands with the text pinned to the bottom third; landscape relayouts to a full-height hero band on the left with the supporting band and text column down the right.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: true, maxWords: 16 },
    blocks: { kind: 'single', min: 1, max: 1, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 2
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
