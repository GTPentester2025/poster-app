// v2 template — compliance-certificate (style: statement). Formal enterprise
// compliance certificate with an organization seal area, signatory block,
// gold ornamental border, and formal typography on a near-black canvas with
// gold decorative elements. Portrait: certificate structure with seal top-center,
// formal text body, signatory block at bottom. Landscape: seal left, text right.

import {
  textbox, rect, circle, hline,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, cornerFrame, shieldMotif, meshGlow,
  legibilityScrim, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

const CHARCOAL = '#121212';

function ctaBar(o, text, palette, fonts, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 120, fill: CHARCOAL, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 2, fill: palette.primary, opacity: 0.15, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 80, maxSize: 40, minSize: 26 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((120 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: fonts.head, fontWeight: '800',
    fill: palette.primary, align: 'center', charSpacing: 80, layerRole: 'cta', bgRef: CHARCOAL
  }));
}

function sealArea(o, palette, fonts, { cx, cy, r }) {
  // outer decorative ring
  o.push(circle({ x: cx, y: cy, r, fill: 'transparent', stroke: palette.primary, strokeWidth: 4, layerRole: 'decor', opacity: 0.18 }));
  o.push(circle({ x: cx, y: cy, r: Math.round(r * 0.88), fill: 'transparent', stroke: palette.primary, strokeWidth: 2, layerRole: 'decor', opacity: 0.12 }));
  o.push(circle({ x: cx, y: cy, r: Math.round(r * 0.76), fill: DARK_PANEL, stroke: palette.primary, strokeWidth: 3, layerRole: 'decor', opacity: 0.08 }));
  // shield inside
  o.push(...shieldMotif({ x: cx, y: cy - Math.round(r * 0.55), size: Math.round(r * 0.6), color: palette.primary, intensity: 0.7 }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', DARK_BASE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark formal background, subtle parchment texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: CHARCOAL, direction: 'diagonal', intensity: 0.6 }));
  o.push(...meshGlow({ spots: [
    { x: Math.round(W * 0.5), y: 400, r: 500, color: palette.primary },
    { x: Math.round(W * 0.5), y: 1600, r: 360, color: palette.accent }
  ], intensity: 0.6 }));
  // ornate gold border
  o.push(...cornerFrame({ x: 56, y: 56, w: W - 112, h: H - 232, color: palette.primary, arm: 120, thickness: 4, intensity: 0.8 }));

  const margin = 160;
  const innerW = W - margin * 2;

  // seal top-center
  sealArea(o, palette, fonts, { cx: Math.round(W / 2), cy: 220, r: 140 });

  // certificate title line
  o.push(textbox({
    text: 'CERTIFICATE OF COMPLIANCE', x: margin, y: 400, w: innerW,
    fontSize: 32, fontFamily: fonts.head, fontWeight: '700', fill: palette.primary,
    align: 'center', charSpacing: 160, lineHeight: 1.1, layerRole: 'message-label', bgRef: DARK_BASE
  }));

  // decorative rule
  o.push(hline({ x: Math.round(W / 2) - 200, y: 450, w: 400, thickness: 2, fill: palette.primary, layerRole: 'decor' }));

  // headline: the certification statement
  const headSize = fitFontSize(content.headline, { width: innerW, height: 200, maxSize: 80, minSize: 44 });
  o.push(textbox({
    text: content.headline, x: margin, y: 476, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    align: 'center', lineHeight: 1.08, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = 476 + estTextHeight(content.headline, headSize, innerW, 1.08) + 24;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 120, maxSize: 40, minSize: 24, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      align: 'center', lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, innerW, 1.35) + 32;
  }

  // body text block (single)
  const b = (content.blocks || [])[0];
  if (b) {
    const bodySize = fitFontSize(b.text, { width: innerW - 80, height: 600, maxSize: 40, minSize: 24, lineHeight: 1.5 });
    o.push({
      ...textbox({
        text: b.text, x: margin + 40, y: cursor, w: innerW - 80, fontSize: bodySize,
        fontFamily: fonts.body, fontWeight: '400', fill: DARK_INK_DIM,
        align: 'center', lineHeight: 1.5, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
      }),
      fieldRef: 'text'
    });
    cursor += estTextHeight(b.text, bodySize, innerW - 80, 1.5) + 40;
  }

  // signatory block
  o.push(rect({ x: Math.round(W / 2) - 96, y: cursor, w: 192, h: 3, fill: palette.primary, layerRole: 'decor', opacity: 0.2 }));
  o.push(textbox({
    text: 'Authorized Signatory', x: margin, y: cursor + 16, w: innerW,
    fontSize: 22, fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
    align: 'center', layerRole: 'message-label', bgRef: DARK_BASE
  }));

  ctaBar(o, content.callToAction, palette, fonts, W, 1880);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', DARK_BASE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark formal background, subtle parchment texture, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: palette.primary, to: CHARCOAL, direction: 'horizontal', intensity: 0.6 }));
  o.push(...meshGlow({ spots: [
    { x: 300, y: Math.round(H / 2), r: 400, color: palette.primary },
    { x: W - 200, y: Math.round(H / 2), r: 300, color: palette.accent }
  ], intensity: 0.6 }));
  o.push(...cornerFrame({ x: 48, y: 48, w: W - 96, h: H - 192, color: palette.primary, arm: 100, thickness: 4, intensity: 0.8 }));

  const dividerX = Math.round(W * 0.42);

  // left: seal + certificate label
  sealArea(o, palette, fonts, { cx: Math.round(dividerX / 2), cy: 260, r: 110 });
  o.push(textbox({
    text: 'CERTIFICATE OF\nCOMPLIANCE', x: 60, y: 420, w: dividerX - 120,
    fontSize: 28, fontFamily: fonts.head, fontWeight: '700', fill: palette.primary,
    align: 'center', charSpacing: 100, lineHeight: 1.2, layerRole: 'message-label', bgRef: DARK_BASE
  }));

  // vertical divider
  o.push(rect({ x: dividerX, y: 100, w: 2, h: H - 260, fill: palette.primary, opacity: 0.1, layerRole: 'decor' }));

  // right: text content
  const rightX = dividerX + 60;
  const rightW = W - rightX - 60;

  const headSize = fitFontSize(content.headline, { width: rightW, height: 200, maxSize: 72, minSize: 40 });
  o.push(textbox({
    text: content.headline, x: rightX, y: 120, w: rightW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: DARK_INK,
    align: 'left', lineHeight: 1.08, layerRole: 'headline', bgRef: DARK_BASE
  }));
  let cursor = 120 + estTextHeight(content.headline, headSize, rightW, 1.08) + 20;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: rightW, height: 100, maxSize: 36, minSize: 22, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x: rightX, y: cursor, w: rightW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: DARK_INK_DIM,
      align: 'left', lineHeight: 1.35, layerRole: 'subheadline', bgRef: DARK_BASE
    }));
    cursor += estTextHeight(content.subheadline, subSize, rightW, 1.35) + 28;
  }

  const b = (content.blocks || [])[0];
  if (b) {
    const bodySize = fitFontSize(b.text, { width: rightW, height: 500, maxSize: 36, minSize: 22, lineHeight: 1.5 });
    o.push({
      ...textbox({
        text: b.text, x: rightX, y: cursor, w: rightW, fontSize: bodySize,
        fontFamily: fonts.body, fontWeight: '400', fill: DARK_INK_DIM,
        align: 'left', lineHeight: 1.5, layerRole: 'message', msgId: b.id, bgRef: DARK_BASE
      }),
      fieldRef: 'text'
    });
    cursor += estTextHeight(b.text, bodySize, rightW, 1.5) + 32;
  }

  o.push(rect({ x: rightX, y: cursor, w: 160, h: 2, fill: palette.primary, layerRole: 'decor', opacity: 0.2 }));
  o.push(textbox({
    text: 'Authorized Signatory', x: rightX, y: cursor + 12, w: rightW,
    fontSize: 20, fontFamily: fonts.body, fontWeight: '600', fill: DARK_INK_DIM,
    align: 'left', layerRole: 'message-label', bgRef: DARK_BASE
  }));

  ctaBar(o, content.callToAction, palette, fonts, W, 1294);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(707), pv(220), pv(140), 'none', { stroke: palette.primary, opacity: 0.4 }),
    pvCircle(pv(707), pv(220), pv(110), 'none', { stroke: palette.primary, opacity: 0.3 }),
    pvRect(pv(507), pv(450), pv(400), 1, palette.primary, { opacity: 0.3 }),
    pvBars({ x: pv(200), y: pv(500), w: pv(1014), lines: 3, barH: 8, gap: 5, fill: DARK_INK, align: 'center' }),
    pvBars({ x: pv(300), y: pv(1100), w: pv(814), lines: 4, barH: 4, gap: 3, fill: DARK_INK_DIM, align: 'center' }),
    pvRect(pv(611), pv(1520), pv(192), 1, palette.primary, { opacity: 0.3 }),
    pvRect(0, pv(1880), 200, pv(120), CHARCOAL)
  ];
  return svgWrapO(parts, DARK_BASE, 'portrait');
}

function previewLandscape(palette) {
  const dividerX = Math.round(2000 * 0.42);
  const parts = [
    pvCircle(pv(dividerX / 2), pv(260), pv(110), 'none', { stroke: palette.primary, opacity: 0.4 }),
    pvRect(pv(dividerX), pv(100), 1, pv(1154), palette.primary, { opacity: 0.2 }),
    pvBars({ x: pv(dividerX + 60), y: pv(140), w: pv(2000 - dividerX - 120), lines: 2, barH: 7, gap: 4, fill: DARK_INK }),
    pvBars({ x: pv(dividerX + 60), y: pv(600), w: pv(2000 - dividerX - 120), lines: 5, barH: 4, gap: 3, fill: DARK_INK_DIM }),
    pvRect(0, pv(1294), PV_LAND_W, pv(120), CHARCOAL)
  ];
  return svgWrapO(parts, DARK_BASE, 'landscape');
}

export default {
  id: 'compliance-certificate',
  name: 'Compliance certificate',
  style: 'statement',
  description: 'Formal enterprise compliance certificate with an ornate gold seal area, signatory block, and gold ornamental border on a near-black canvas. Portrait centers the seal above formal text; landscape splits seal left and certification text right. Ideal for official compliance attestations.',
  contentSchema: {
    headline: { required: true, maxWords: 10 },
    subheadline: { required: false, maxWords: 16 },
    blocks: { kind: 'single', min: 1, max: 1, fields: ['text'] },
    callToAction: { required: true, maxWords: 8 },
    backgroundSlots: 1,
    imageSlots: 0
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
