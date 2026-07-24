// Template 10 — badge-focus: a central circular badge/shield vector frame
// carries the headline; message cards orbit it in a grid below, tethered to
// the badge by a spine.

import {
  makeCanvas, textbox, rect, circle, polygon, vline, chip, imageSlot,
  pickTextColor, fitFontSize, estTextHeight,
  pv, svgWrap, pvRect, pvCircle, pvPoly, pvBars, pvSlot
} from './helpers.js';

const CX = 707;
const CY = 560;
const BADGE_R = 300;

export default {
  id: 'badge-focus',
  name: 'Badge focus',
  description: 'The headline sits inside a circular badge-and-shield emblem; message cards orbit beneath it, tethered by a spine.',
  suitedFor: ['key-messages', 'dos-donts'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;
    const onDark = pickTextColor(palette.dark);
    const n = content.messages.length;

    // badge: outer halo ring, brand ring, dark disc, shield point
    o.push(circle({ x: CX, y: CY, r: BADGE_R + 54, fill: 'transparent', stroke: palette.dark, strokeWidth: 3, opacity: 0.3 }));
    o.push(circle({ x: CX, y: CY, r: BADGE_R + 28, fill: 'transparent', stroke: palette.primary, strokeWidth: 12 }));
    o.push(circle({ x: CX, y: CY, r: BADGE_R, fill: palette.dark, layerRole: 'background' }));
    o.push(polygon([
      { x: CX - 70, y: CY + BADGE_R - 26 }, { x: CX + 70, y: CY + BADGE_R - 26 }, { x: CX, y: CY + BADGE_R + 88 }
    ], { fill: palette.dark }));
    o.push(circle({ x: CX - BADGE_R - 60, y: CY - 190, r: 20, fill: palette.accent }));
    o.push(circle({ x: CX + BADGE_R + 74, y: CY + 150, r: 14, fill: palette.primary }));

    const headSize = fitFontSize(content.headline, { width: 520, height: 400, maxSize: 108, minSize: 80, lineHeight: 1.08 });
    o.push(textbox({
      text: content.headline, x: CX - 260, y: CY - Math.round(estTextHeight(content.headline, headSize, 520, 1.08) / 2),
      w: 520, fontSize: headSize, lineHeight: 1.08, align: 'center',
      fontFamily: fonts.head, fontWeight: '900', fill: onDark, layerRole: 'headline', bgRef: palette.dark
    }));

    // corner image slots flanking the badge
    o.push(imageSlot({ slotId: 'slot-1', x: 84, y: 120, w: 230, h: 230, styleHint: 'emblem-style topic icon, circular motif, no text', stroke: palette.dark }));
    o.push(imageSlot({ slotId: 'slot-2', x: 1100, y: 120, w: 230, h: 230, styleHint: 'emblem-style topic icon, alternate motif, no text', stroke: palette.dark }));

    if (content.subheadline) {
      o.push(textbox({
        text: content.subheadline, x: 207, y: 980, w: 1000, fontSize: 38, align: 'center',
        fontFamily: fonts.body, fontWeight: '600', fill: palette.dark, layerRole: 'subheadline', bgRef: palette.background
      }));
    }

    // spine from the shield point into the orbit grid
    o.push(vline({ x: CX - 4, y: CY + BADGE_R + 88, h: 1090 - (CY + BADGE_R + 88), thickness: 8, fill: palette.primary }));

    // orbiting message cards: two columns, odd last card centered
    const top = 1090;
    const bottom = 1800;
    const rows = Math.ceil(n / 2);
    const rowH = (bottom - top) / rows;
    const cardH = Math.round(rowH - 30);
    content.messages.forEach((m, i) => {
      const row = Math.floor(i / 2);
      const lastAlone = i === n - 1 && n % 2 === 1;
      const x = lastAlone ? 407 : (i % 2 === 0 ? 84 : 730);
      const y = Math.round(top + row * rowH);
      o.push(circle({ x: x + 300, y, r: 14, fill: palette.primary }));
      o.push(rect({
        x, y, w: 600, h: cardH, fill: '#FFFFFF', rx: 24,
        stroke: '#00000018', strokeWidth: 2,
        shadow: { color: 'rgba(31,26,23,0.15)', blur: 16, offsetX: 0, offsetY: 8 }, layerRole: 'background'
      }));
      let textY = y + 30;
      if (m.label) {
        o.push(...chip({ text: m.label, x: x + 44, y: textY, fontSize: 21, bg: palette.dark, color: palette.primary, font: fonts.head, msgId: m.id }));
        textY += 60;
      }
      const size = fitFontSize(m.text, { width: 512, height: y + cardH - textY - 22, maxSize: 44, minSize: 38 });
      o.push(textbox({
        text: m.text, x: x + 44, y: textY, w: 512, fontSize: size, fontFamily: fonts.body,
        fontWeight: '600', fill: palette.dark, layerRole: 'message', msgId: m.id, bgRef: '#FFFFFF'
      }));
    });

    if (content.callToAction) {
      o.push(rect({ x: 0, y: 1856, w: 1414, h: 144, fill: palette.dark, layerRole: 'background' }));
      const ctaSize = fitFontSize(content.callToAction, { width: 1234, height: 96, maxSize: 44, minSize: 30 });
      o.push(textbox({
        text: content.callToAction, x: 90, y: 1856 + Math.round((144 - estTextHeight(content.callToAction, ctaSize, 1234)) / 2),
        w: 1234, fontSize: ctaSize, fontFamily: fonts.head, fontWeight: '800',
        fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
      }));
    }
    return canvas;
  },

  preview(palette) {
    const onDark = pickTextColor(palette.dark);
    const parts = [
      pvCircle(pv(CX), pv(CY), pv(BADGE_R + 28), 'none', { stroke: palette.primary }),
      pvCircle(pv(CX), pv(CY), pv(BADGE_R), palette.dark),
      pvPoly([
        { x: pv(CX - 70), y: pv(CY + BADGE_R - 26) }, { x: pv(CX + 70), y: pv(CY + BADGE_R - 26) }, { x: pv(CX), y: pv(CY + BADGE_R + 88) }
      ], palette.dark),
      pvBars({ x: pv(CX - 260), y: pv(CY - 120), w: pv(520), lines: 3, barH: 8, gap: 5, fill: onDark, align: 'center' }),
      pvSlot(pv(84), pv(120), pv(230), pv(230), palette.dark),
      pvSlot(pv(1100), pv(120), pv(230), pv(230), palette.dark),
      pvCircle(pv(CX - BADGE_R - 60), pv(CY - 190), 3, palette.accent),
      pvRect(pv(CX - 4), pv(CY + BADGE_R + 88), 1.5, pv(140), palette.primary)
    ];
    for (let i = 0; i < 4; i++) {
      const x = pv(i % 2 === 0 ? 84 : 730);
      const y = pv(1090 + Math.floor(i / 2) * 355);
      parts.push(pvCircle(x + pv(300), y, 2.5, palette.primary));
      parts.push(pvRect(x, y, pv(600), pv(325), '#FFFFFF', { rx: 4, stroke: '#00000030' }));
      parts.push(pvBars({ x: x + pv(44), y: y + pv(80), w: pv(512), lines: 2, barH: 4.5, gap: 3, fill: palette.dark }));
    }
    parts.push(pvRect(0, pv(1856), 200, pv(144), palette.dark));
    return svgWrap(parts, palette.background);
  }
};
