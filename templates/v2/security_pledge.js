// v2 template — security-pledge (style: statement). Formal employee security
// pledge certificate with gold ornamental border, centered pledge statement,
// organization logo slot, and signature line on slate canvas. Portrait: logo
// top-center, pledge text centered, CTA and signature at bottom. Landscape:
// logo left, pledge text right with signature block.

import {
  textbox, rect, circle, hline,
  backgroundImageSlot,
  fitFontSize, estTextHeight,
  pv, pvRect, pvCircle, pvBars
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, gradientWash, cornerFrame, meshGlow,
  legibilityScrim, svgWrapO, PV_LAND_W,
  DARK_BASE, DARK_PANEL, DARK_INK, DARK_INK_DIM
} from './decor.js';

const SLATE = '#1E293B';
const GOLD = '#E3AF32';
const TEXT_LIGHT = '#E2E8F0';

function ctaBar(o, text, W, y) {
  o.push(rect({ x: 0, y, w: W, h: 120, fill: SLATE, layerRole: 'background' }));
  o.push(rect({ x: 0, y, w: W, h: 2, fill: GOLD, opacity: 0.2, layerRole: 'decor' }));
  const size = fitFontSize(text, { width: W - 200, height: 80, maxSize: 40, minSize: 26 });
  o.push(textbox({
    text, x: 100, y: y + Math.round((120 - estTextHeight(text, size, W - 200)) / 2),
    w: W - 200, fontSize: size, fontFamily: 'Trebuchet MS', fontWeight: '800',
    fill: GOLD, align: 'center', charSpacing: 80, layerRole: 'cta', bgRef: SLATE
  }));
}

function logoArea(o, { cx, cy, r }) {
  // ornate logo frame with gold accent
  o.push(circle({ x: cx, y: cy, r, fill: 'transparent', stroke: GOLD, strokeWidth: 4, layerRole: 'decor', opacity: 0.25 }));
  o.push(circle({ x: cx, y: cy, r: Math.round(r * 0.88), fill: 'transparent', stroke: GOLD, strokeWidth: 2, layerRole: 'decor', opacity: 0.15 }));
  o.push(circle({ x: cx, y: cy, r: Math.round(r * 0.76), fill: SLATE, stroke: GOLD, strokeWidth: 3, layerRole: 'decor', opacity: 0.1 }));
  // background image slot for org logo inside
  o.push(backgroundImageSlot({
    x: Math.round(cx - r * 0.65), y: Math.round(cy - r * 0.65),
    w: Math.round(r * 1.3), h: Math.round(r * 1.3),
    styleHint: 'organization logo, centered, transparent background preferred',
    stroke: GOLD, opacity: 0.6
  }));
}

function signatureBlock(o, margin, innerW, startY, fonts) {
  let cursor = startY;
  o.push(rect({ x: margin + 60, y: cursor, w: 200, h: 2, fill: GOLD, layerRole: 'decor', opacity: 0.2 }));
  o.push(textbox({
    text: 'Employee Signature', x: margin + 60, y: cursor + 12, w: innerW / 2 - 60,
    fontSize: 18, fontFamily: fonts.body, fontWeight: '600', fill: TEXT_LIGHT,
    align: 'left', layerRole: 'message-label', bgRef: SLATE
  }));

  cursor += 64;
  o.push(rect({ x: margin + innerW / 2 + 60, y: cursor - 52, w: 200, h: 2, fill: GOLD, layerRole: 'decor', opacity: 0.2 }));
  o.push(textbox({
    text: 'Date', x: margin + innerW / 2 + 60, y: cursor - 52 + 12, w: innerW / 2 - 60,
    fontSize: 18, fontFamily: fonts.body, fontWeight: '600', fill: TEXT_LIGHT,
    align: 'left', layerRole: 'message-label', bgRef: SLATE
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', SLATE);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'professional dark background with subtle texture, corporate aesthetic', stroke: GOLD }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: GOLD, to: SLATE, direction: 'diagonal', intensity: 0.5 }));
  o.push(...meshGlow({ spots: [
    { x: Math.round(W * 0.5), y: 400, r: 500, color: GOLD },
    { x: Math.round(W * 0.5), y: 1600, r: 360, color: GOLD }
  ], intensity: 0.4 }));
  // gold ornamental border
  o.push(...cornerFrame({ x: 56, y: 56, w: W - 112, h: H - 232, color: GOLD, arm: 120, thickness: 4, intensity: 0.7 }));

  const margin = 160;
  const innerW = W - margin * 2;

  // logo top-center
  logoArea(o, { cx: Math.round(W / 2), cy: 220, r: 130 });

  // pledge title line
  o.push(textbox({
    text: 'SECURITY PLEDGE', x: margin, y: 410, w: innerW,
    fontSize: 32, fontFamily: fonts.head, fontWeight: '700', fill: GOLD,
    align: 'center', charSpacing: 160, lineHeight: 1.1, layerRole: 'message-label', bgRef: SLATE
  }));

  // decorative rule
  o.push(hline({ x: Math.round(W / 2) - 200, y: 470, w: 400, thickness: 2, fill: GOLD, layerRole: 'decor' }));

  // headline: pledge statement
  const headSize = fitFontSize(content.headline, { width: innerW, height: 200, maxSize: 80, minSize: 44 });
  o.push(textbox({
    text: content.headline, x: margin, y: 500, w: innerW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: TEXT_LIGHT,
    align: 'center', lineHeight: 1.08, layerRole: 'headline', bgRef: SLATE
  }));
  let cursor = 500 + estTextHeight(content.headline, headSize, innerW, 1.08) + 24;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: innerW, height: 120, maxSize: 40, minSize: 24, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x: margin, y: cursor, w: innerW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: TEXT_LIGHT,
      align: 'center', lineHeight: 1.35, layerRole: 'subheadline', bgRef: SLATE
    }));
    cursor += estTextHeight(content.subheadline, subSize, innerW, 1.35) + 32;
  }

  // body text block (single) — the pledge commitment
  const b = (content.blocks || [])[0];
  if (b) {
    const bodySize = fitFontSize(b.text, { width: innerW - 80, height: 600, maxSize: 40, minSize: 24, lineHeight: 1.5 });
    o.push({
      ...textbox({
        text: b.text, x: margin + 40, y: cursor, w: innerW - 80, fontSize: bodySize,
        fontFamily: fonts.body, fontWeight: '400', fill: TEXT_LIGHT,
        align: 'center', lineHeight: 1.5, layerRole: 'message', msgId: b.id, bgRef: SLATE
      }),
      fieldRef: 'text'
    });
    cursor += estTextHeight(b.text, bodySize, innerW - 80, 1.5) + 40;
  }

  // signature block
  signatureBlock(o, margin, innerW, cursor, fonts);

  ctaBar(o, content.callToAction, W, 1880);
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', SLATE);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'professional dark background with subtle texture, corporate aesthetic', stroke: GOLD }));
  o.push(...legibilityScrim({ w: W, h: H }));
  o.push(...gradientWash({ w: W, h: H, from: GOLD, to: SLATE, direction: 'horizontal', intensity: 0.5 }));
  o.push(...meshGlow({ spots: [
    { x: 300, y: Math.round(H / 2), r: 400, color: GOLD },
    { x: W - 200, y: Math.round(H / 2), r: 300, color: GOLD }
  ], intensity: 0.4 }));
  o.push(...cornerFrame({ x: 48, y: 48, w: W - 96, h: H - 192, color: GOLD, arm: 100, thickness: 4, intensity: 0.7 }));

  const dividerX = Math.round(W * 0.42);

  // left: logo + pledge label
  logoArea(o, { cx: Math.round(dividerX / 2), cy: 260, r: 110 });
  o.push(textbox({
    text: 'SECURITY\nPLEDGE', x: 60, y: 420, w: dividerX - 120,
    fontSize: 28, fontFamily: fonts.head, fontWeight: '700', fill: GOLD,
    align: 'center', charSpacing: 100, lineHeight: 1.2, layerRole: 'message-label', bgRef: SLATE
  }));

  // vertical divider
  o.push(rect({ x: dividerX, y: 100, w: 2, h: H - 260, fill: GOLD, opacity: 0.1, layerRole: 'decor' }));

  // right: text content
  const rightX = dividerX + 60;
  const rightW = W - rightX - 60;

  const headSize = fitFontSize(content.headline, { width: rightW, height: 200, maxSize: 72, minSize: 40 });
  o.push(textbox({
    text: content.headline, x: rightX, y: 120, w: rightW, fontSize: headSize,
    fontFamily: fonts.head, fontWeight: '900', fill: TEXT_LIGHT,
    align: 'left', lineHeight: 1.08, layerRole: 'headline', bgRef: SLATE
  }));
  let cursor = 120 + estTextHeight(content.headline, headSize, rightW, 1.08) + 20;

  if (content.subheadline) {
    const subSize = fitFontSize(content.subheadline, { width: rightW, height: 100, maxSize: 36, minSize: 22, lineHeight: 1.35 });
    o.push(textbox({
      text: content.subheadline, x: rightX, y: cursor, w: rightW, fontSize: subSize,
      fontFamily: fonts.body, fontWeight: '500', fill: TEXT_LIGHT,
      align: 'left', lineHeight: 1.35, layerRole: 'subheadline', bgRef: SLATE
    }));
    cursor += estTextHeight(content.subheadline, subSize, rightW, 1.35) + 28;
  }

  const b = (content.blocks || [])[0];
  if (b) {
    const bodySize = fitFontSize(b.text, { width: rightW, height: 500, maxSize: 36, minSize: 22, lineHeight: 1.5 });
    o.push({
      ...textbox({
        text: b.text, x: rightX, y: cursor, w: rightW, fontSize: bodySize,
        fontFamily: fonts.body, fontWeight: '400', fill: TEXT_LIGHT,
        align: 'left', lineHeight: 1.5, layerRole: 'message', msgId: b.id, bgRef: SLATE
      }),
      fieldRef: 'text'
    });
    cursor += estTextHeight(b.text, bodySize, rightW, 1.5) + 32;
  }

  // signature block right side
  o.push(rect({ x: rightX, y: cursor, w: 160, h: 2, fill: GOLD, layerRole: 'decor', opacity: 0.2 }));
  o.push(textbox({
    text: 'Employee Signature', x: rightX, y: cursor + 12, w: rightW / 2,
    fontSize: 18, fontFamily: fonts.body, fontWeight: '600', fill: TEXT_LIGHT,
    align: 'left', layerRole: 'message-label', bgRef: SLATE
  }));
  o.push(rect({ x: rightX + rightW / 2, y: cursor, w: 160, h: 2, fill: GOLD, layerRole: 'decor', opacity: 0.2 }));
  o.push(textbox({
    text: 'Date', x: rightX + rightW / 2, y: cursor + 12, w: rightW / 2,
    fontSize: 18, fontFamily: fonts.body, fontWeight: '600', fill: TEXT_LIGHT,
    align: 'left', layerRole: 'message-label', bgRef: SLATE
  }));

  ctaBar(o, content.callToAction, W, 1294);
  return canvas;
}

function previewPortrait(palette) {
  const parts = [
    pvCircle(pv(707), pv(220), pv(130), 'none', { stroke: GOLD, opacity: 0.35 }),
    pvCircle(pv(707), pv(220), pv(102), 'none', { stroke: GOLD, opacity: 0.25 }),
    pvRect(pv(607), pv(470), pv(200), 1, GOLD, { opacity: 0.3 }),
    pvBars({ x: pv(200), y: pv(530), w: pv(1014), lines: 2, barH: 8, gap: 5, fill: TEXT_LIGHT, align: 'center' }),
    pvBars({ x: pv(300), y: pv(750), w: pv(814), lines: 5, barH: 4, gap: 3, fill: TEXT_LIGHT, align: 'center' }),
    pvRect(pv(260), pv(1320), pv(200), 1, GOLD, { opacity: 0.2 }),
    pvRect(pv(800), pv(1320), pv(200), 1, GOLD, { opacity: 0.2 }),
    pvRect(0, pv(1880), 200, pv(120), SLATE)
  ];
  return svgWrapO(parts, SLATE, 'portrait');
}

function previewLandscape(palette) {
  const dividerX = Math.round(2000 * 0.42);
  const parts = [
    pvCircle(pv(dividerX / 2), pv(260), pv(110), 'none', { stroke: GOLD, opacity: 0.35 }),
    pvRect(pv(dividerX), pv(100), 1, pv(1154), GOLD, { opacity: 0.15 }),
    pvBars({ x: pv(dividerX + 60), y: pv(140), w: pv(2000 - dividerX - 120), lines: 2, barH: 7, gap: 4, fill: TEXT_LIGHT }),
    pvBars({ x: pv(dividerX + 60), y: pv(450), w: pv(2000 - dividerX - 120), lines: 5, barH: 4, gap: 3, fill: TEXT_LIGHT }),
    pvRect(pv(dividerX + 60), pv(950), pv(160), 1, GOLD, { opacity: 0.2 }),
    pvRect(pv(dividerX + 60 + 600), pv(950), pv(160), 1, GOLD, { opacity: 0.2 }),
    pvRect(0, pv(1294), PV_LAND_W, pv(120), SLATE)
  ];
  return svgWrapO(parts, SLATE, 'landscape');
}

export default {
  id: 'security-pledge',
  name: 'Security pledge',
  style: 'statement',
  description: 'Formal employee security pledge certificate with gold ornamental border, centered pledge commitment statement, organization logo area, and signature lines on slate canvas. Portrait: logo top-center with pledge text below; landscape: logo left with text and signature block right. Perfect for security awareness initiatives and compliance onboarding.',
  contentSchema: {
    headline: { required: true, maxWords: 10 },
    subheadline: { required: false, maxWords: 16 },
    blocks: { kind: 'single', min: 1, max: 1, fields: ['text'] },
    callToAction: { required: true, maxWords: 8 },
    backgroundSlots: 1,
    imageSlots: 1
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
