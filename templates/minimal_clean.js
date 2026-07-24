// Template 8 — minimal-clean: the REQUIRED basic option. Generous whitespace,
// thin hairline rules, a single accent square — typography does all the work.

import {
  CANVAS_W, makeCanvas, textbox, rect, hline, chip, imageSlot,
  fitFontSize, estTextHeight,
  pv, svgWrap, pvRect, pvBars, pvSlot
} from './helpers.js';

const MARGIN = 110;
const TEXT_W = 880;

export default {
  id: 'minimal-clean',
  name: 'Minimal clean',
  description: 'The quiet option: whitespace, hairline rules and one accent square — typography does all the work.',
  suitedFor: ['key-messages'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;
    const n = content.messages.length;

    // single accent mark + headline
    o.push(rect({ x: MARGIN, y: 100, w: 58, h: 58, fill: palette.primary }));
    const headSize = fitFontSize(content.headline, { width: 1194, height: 320, maxSize: 124, minSize: 80 });
    o.push(textbox({
      text: content.headline, x: MARGIN, y: 210, w: 1194, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '800', fill: palette.dark, layerRole: 'headline', bgRef: palette.background
    }));
    let cursor = 210 + estTextHeight(content.headline, headSize, 1194) + 36;
    if (content.subheadline) {
      o.push(textbox({
        text: content.subheadline, x: MARGIN, y: Math.min(cursor, 560), w: 1000, fontSize: 40,
        fontFamily: fonts.body, fontWeight: '400', fill: palette.dark, layerRole: 'subheadline', bgRef: palette.background
      }));
    }
    o.push(hline({ x: MARGIN, y: 640, w: 300, thickness: 3, fill: palette.primary }));

    // widely spaced message list, hairline rules between rows
    const top = 700;
    const bottom = 1760;
    const rowH = (bottom - top) / n;
    content.messages.forEach((m, i) => {
      const y = Math.round(top + i * rowH);
      let textY = y + 24;
      if (i > 0) o.push(hline({ x: MARGIN, y, w: TEXT_W, thickness: 2, fill: '#00000022' }));
      if (m.label) {
        o.push(...chip({ text: m.label, x: MARGIN, y: textY, fontSize: 21, bg: palette.dark, color: palette.background, font: fonts.head, msgId: m.id, square: true }));
        textY += 60;
      }
      const size = fitFontSize(m.text, { width: TEXT_W, height: y + rowH - textY - 20, maxSize: 46, minSize: 38 });
      o.push(textbox({
        text: m.text, x: MARGIN, y: textY, w: TEXT_W, fontSize: size, fontFamily: fonts.body,
        fontWeight: '500', fill: palette.dark, layerRole: 'message', msgId: m.id, bgRef: palette.background
      }));
    });

    // one restrained image slot on the right
    o.push(imageSlot({
      slotId: 'slot-1', x: 1060, y: 700, w: 244, h: 560,
      styleHint: 'single-line minimalist illustration, one accent color, no text', stroke: palette.dark
    }));

    // CTA as a thin-ruled footer line — no heavy bar
    if (content.callToAction) {
      o.push(hline({ x: MARGIN, y: 1830, w: CANVAS_W - 2 * MARGIN, thickness: 2, fill: palette.dark }));
      o.push(rect({ x: MARGIN, y: 1880, w: 26, h: 26, fill: palette.primary }));
      const ctaSize = fitFontSize(content.callToAction, { width: 1120, height: 100, maxSize: 40, minSize: 30 });
      o.push(textbox({
        text: content.callToAction, x: MARGIN + 64, y: 1874, w: 1120, fontSize: ctaSize,
        fontFamily: fonts.head, fontWeight: '700', fill: palette.dark, layerRole: 'cta', bgRef: palette.background
      }));
    }
    return canvas;
  },

  preview(palette) {
    const parts = [
      pvRect(pv(MARGIN), pv(100), pv(58), pv(58), palette.primary),
      pvBars({ x: pv(MARGIN), y: pv(230), w: pv(1194), lines: 2, barH: 9, gap: 6, fill: palette.dark }),
      pvRect(pv(MARGIN), pv(640), pv(300), 1.5, palette.primary),
      pvSlot(pv(1060), pv(700), pv(244), pv(560), palette.dark)
    ];
    for (let i = 0; i < 4; i++) {
      const y = pv(700 + i * 265);
      if (i > 0) parts.push(pvRect(pv(MARGIN), y, pv(TEXT_W), 0.8, '#00000033'));
      parts.push(pvBars({ x: pv(MARGIN), y: y + 6, w: pv(TEXT_W), lines: 2, barH: 4.5, gap: 3, fill: palette.dark }));
    }
    parts.push(pvRect(pv(MARGIN), pv(1830), pv(CANVAS_W - 2 * MARGIN), 0.8, palette.dark));
    parts.push(pvRect(pv(MARGIN), pv(1880), pv(26), pv(26), palette.primary));
    parts.push(pvBars({ x: pv(MARGIN + 64), y: pv(1880), w: pv(700), lines: 1, barH: 4.5, gap: 3, fill: palette.dark }));
    return svgWrap(parts, palette.background);
  }
};
