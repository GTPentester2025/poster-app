// Template 11 — dark-alert: near-black poster, hazard tick strip across the
// top, glow-accented message cards — the control-room alert look.

import {
  CANVAS_W, makeCanvas, textbox, rect, circle, chip, imageSlot,
  pickTextColor, fitFontSize, estTextHeight,
  pv, svgWrap, pvRect, pvCircle, pvBars, pvSlot
} from './helpers.js';

const CARD_BG = '#2B2420'; // one step lighter than the dark canvas — not brand-overridable
const CARD_TEXT = '#FFFFFF';

export default {
  id: 'dark-alert',
  name: 'Dark alert',
  description: 'Near-black control-room look: hazard ticks across the top, glowing accent bars on every message card.',
  suitedFor: ['red-flags', 'scenario-response'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.dark);
    const o = canvas.objects;
    const onDark = pickTextColor(palette.dark);
    const onPrimary = pickTextColor(palette.primary);
    const n = content.messages.length;

    // hazard tick strip across the top edge
    for (let x = 0; x < CANVAS_W; x += 118) {
      o.push(rect({ x, y: 0, w: 64, h: 18, fill: (x / 118) % 2 === 0 ? palette.accent : palette.primary }));
    }
    // glow beacons
    o.push(circle({ x: 1310, y: 130, r: 26, fill: palette.accent, opacity: 0.9 }));
    o.push(rect({
      x: 90, y: 120, w: 180, h: 12, fill: palette.accent,
      shadow: { color: palette.accent, blur: 28, offsetX: 0, offsetY: 0 }
    }));

    const headSize = fitFontSize(content.headline, { width: 1234, height: 340, maxSize: 132, minSize: 80 });
    o.push(textbox({
      text: content.headline, x: 90, y: 180, w: 1234, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: onDark,
      shadow: { color: palette.primary, blur: 22, offsetX: 0, offsetY: 0 },
      layerRole: 'headline', bgRef: palette.dark
    }));
    let cursor = 180 + estTextHeight(content.headline, headSize, 1234) + 30;
    if (content.subheadline) {
      o.push(textbox({
        text: content.subheadline, x: 90, y: Math.min(cursor, 620), w: 940, fontSize: 40,
        fontFamily: fonts.body, fontWeight: '600', fill: onDark, layerRole: 'subheadline', bgRef: palette.dark
      }));
    }

    // image slot on the right, brand-stroked so it reads on the dark ground
    o.push(imageSlot({
      slotId: 'slot-1', x: 1080, y: 660, w: 244, h: 460,
      styleHint: 'neon-outline illustration on dark, glowing accents, no text', stroke: palette.primary
    }));

    // glow-accent message cards
    const top = 700;
    const bottom = 1780;
    const rowH = (bottom - top) / n;
    const cardH = Math.round(rowH - 26);
    content.messages.forEach((m, i) => {
      const y = Math.round(top + i * rowH);
      o.push(rect({ x: 90, y, w: 940, h: cardH, fill: CARD_BG, rx: 18, layerRole: 'background' }));
      o.push(rect({
        x: 90, y, w: 16, h: cardH, fill: palette.accent, rx: 8,
        shadow: { color: palette.accent, blur: 26, offsetX: 0, offsetY: 0 }
      }));
      let textY = y + 24;
      if (m.label) {
        o.push(...chip({ text: m.label, x: 146, y: textY, fontSize: 21, bg: palette.accent, color: pickTextColor(palette.accent), font: fonts.head, msgId: m.id, square: true }));
        textY += 58;
      }
      const size = fitFontSize(m.text, { width: 820, height: y + cardH - textY - 18, maxSize: 44, minSize: 38 });
      o.push(textbox({
        text: m.text, x: 146, y: textY, w: 820, fontSize: size, fontFamily: fonts.body,
        fontWeight: '600', fill: CARD_TEXT, layerRole: 'message', msgId: m.id, bgRef: CARD_BG
      }));
    });

    // CTA: glowing brand bar
    if (content.callToAction) {
      o.push(rect({
        x: 90, y: 1830, w: 1234, h: 140, fill: palette.primary, rx: 20,
        shadow: { color: palette.primary, blur: 34, offsetX: 0, offsetY: 0 }, layerRole: 'background'
      }));
      const ctaSize = fitFontSize(content.callToAction, { width: 1140, height: 94, maxSize: 44, minSize: 30 });
      o.push(textbox({
        text: content.callToAction, x: 137, y: 1830 + Math.round((140 - estTextHeight(content.callToAction, ctaSize, 1140)) / 2),
        w: 1140, fontSize: ctaSize, fontFamily: fonts.head, fontWeight: '800',
        fill: onPrimary, align: 'center', layerRole: 'cta', bgRef: palette.primary
      }));
    }
    return canvas;
  },

  preview(palette) {
    const onDark = pickTextColor(palette.dark);
    const parts = [];
    for (let x = 0; x < CANVAS_W; x += 118) {
      parts.push(pvRect(pv(x), 0, pv(64), 2.5, (x / 118) % 2 === 0 ? palette.accent : palette.primary));
    }
    parts.push(pvRect(pv(90), pv(120), pv(180), 2, palette.accent));
    parts.push(pvCircle(pv(1310), pv(130), 3.5, palette.accent));
    parts.push(pvBars({ x: pv(90), y: pv(200), w: pv(1234), lines: 2, barH: 9, gap: 5, fill: onDark }));
    parts.push(pvSlot(pv(1080), pv(660), pv(244), pv(460), palette.primary));
    for (let i = 0; i < 4; i++) {
      const y = pv(700 + i * 270);
      parts.push(pvRect(pv(90), y, pv(940), pv(244), '#2B2420', { rx: 3 }));
      parts.push(pvRect(pv(90), y, 2.5, pv(244), palette.accent));
      parts.push(pvBars({ x: pv(146), y: y + 8, w: pv(820), lines: 2, barH: 4.5, gap: 3, fill: '#FFFFFF' }));
    }
    parts.push(pvRect(pv(90), pv(1830), pv(1234), pv(140), palette.primary, { rx: 3 }));
    return svgWrap(parts, palette.dark);
  }
};
