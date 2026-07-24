// Template 7 — tabular-grid: a structured table view — label column +
// message column with deliberately heavy grid lines.

import {
  makeCanvas, textbox, rect, hline, vline, chip, imageSlot,
  pickTextColor, fitFontSize, estTextHeight,
  pv, svgWrap, pvRect, pvBars, pvSlot
} from './helpers.js';

const TABLE_X = 90;
const TABLE_W = 1234;
const LABEL_W = 330;

export default {
  id: 'tabular-grid',
  name: 'Tabular grid',
  description: 'A strict table: label column against message column, heavy rules, alternating row tints — information laid out like a checklist register.',
  suitedFor: ['dos-donts', 'red-flags', 'key-messages'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;
    const onPrimary = pickTextColor(palette.primary);
    const n = content.messages.length;

    const headSize = fitFontSize(content.headline, { width: 900, height: 260, maxSize: 104, minSize: 80 });
    o.push(textbox({
      text: content.headline, x: TABLE_X, y: 90, w: 900, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.dark, layerRole: 'headline', bgRef: palette.background
    }));
    o.push(imageSlot({
      slotId: 'slot-1', x: 1040, y: 90, w: 284, h: 284,
      styleHint: 'square topic illustration, flat style, no text', stroke: palette.dark
    }));
    if (content.subheadline) {
      o.push(textbox({
        text: content.subheadline, x: TABLE_X, y: 90 + estTextHeight(content.headline, headSize, 900) + 24,
        w: 900, fontSize: 38, fontFamily: fonts.body, fontWeight: '600',
        fill: palette.dark, layerRole: 'subheadline', bgRef: palette.background
      }));
    }

    // table frame
    const top = 480;
    const bottom = 1780;
    const rowH = (bottom - top) / n;
    o.push(hline({ x: TABLE_X, y: top - 16, w: TABLE_W, thickness: 16, fill: palette.dark }));
    content.messages.forEach((m, i) => {
      const y = Math.round(top + i * rowH);
      const h = Math.round(rowH);
      // label cell (brand) + message cell (alternating tint)
      o.push(rect({ x: TABLE_X, y, w: LABEL_W, h, fill: palette.primary, layerRole: 'background' }));
      o.push(rect({ x: TABLE_X + LABEL_W, y, w: TABLE_W - LABEL_W, h, fill: i % 2 === 0 ? '#FFFFFF' : '#00000009', layerRole: 'background' }));
      if (m.label) {
        o.push(...chip({ text: m.label, x: TABLE_X + 36, y: y + Math.round(h / 2) - 26, fontSize: 23, bg: pickTextColor(palette.primary) === '#FFFFFF' ? '#FFFFFF' : palette.dark, color: palette.primary, font: fonts.head, msgId: m.id, square: true }));
      } else {
        // unlabeled rows get a row-index tick block instead of an invented label
        o.push(rect({ x: TABLE_X + 36, y: y + Math.round(h / 2) - 5, w: 70, h: 10, fill: onPrimary, rx: 5 }));
      }
      const size = fitFontSize(m.text, { width: 780, height: rowH - 60, maxSize: 48, minSize: 38 });
      o.push(textbox({
        text: m.text, x: TABLE_X + LABEL_W + 44, y: y + Math.round((h - estTextHeight(m.text, size, 780)) / 2),
        w: 780, fontSize: size, fontFamily: fonts.body, fontWeight: '600',
        fill: palette.dark, layerRole: 'message', msgId: m.id, bgRef: '#FFFFFF'
      }));
      o.push(hline({ x: TABLE_X, y: Math.round(y + h - 3), w: TABLE_W, thickness: 6, fill: palette.dark }));
    });
    o.push(vline({ x: TABLE_X, y: top - 16, h: bottom - top + 16, thickness: 6, fill: palette.dark }));
    o.push(vline({ x: TABLE_X + LABEL_W, y: top - 16, h: bottom - top + 16, thickness: 6, fill: palette.dark }));
    o.push(vline({ x: TABLE_X + TABLE_W - 6, y: top - 16, h: bottom - top + 16, thickness: 6, fill: palette.dark }));

    if (content.callToAction) {
      o.push(rect({ x: TABLE_X, y: 1820, w: TABLE_W, h: 150, fill: palette.dark, layerRole: 'background' }));
      const ctaSize = fitFontSize(content.callToAction, { width: 1140, height: 100, maxSize: 44, minSize: 30 });
      o.push(textbox({
        text: content.callToAction, x: TABLE_X + 47, y: 1820 + Math.round((150 - estTextHeight(content.callToAction, ctaSize, 1140)) / 2),
        w: 1140, fontSize: ctaSize, fontFamily: fonts.head, fontWeight: '800',
        fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
      }));
    }
    return canvas;
  },

  preview(palette) {
    const parts = [
      pvBars({ x: pv(TABLE_X), y: pv(110), w: pv(900), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
      pvSlot(pv(1040), pv(90), pv(284), pv(284), palette.dark),
      pvRect(pv(TABLE_X), pv(464), pv(TABLE_W), 3, palette.dark)
    ];
    for (let i = 0; i < 4; i++) {
      const y = pv(480 + i * 325);
      const h = pv(325);
      parts.push(pvRect(pv(TABLE_X), y, pv(LABEL_W), h, palette.primary));
      parts.push(pvRect(pv(TABLE_X + LABEL_W), y, pv(TABLE_W - LABEL_W), h, i % 2 === 0 ? '#FFFFFF' : '#00000009'));
      parts.push(pvBars({ x: pv(TABLE_X + LABEL_W + 44), y: y + h / 3, w: pv(780), lines: 2, barH: 4.5, gap: 3, fill: palette.dark }));
      parts.push(pvRect(pv(TABLE_X), y + h - 1.5, pv(TABLE_W), 1.5, palette.dark));
    }
    parts.push(pvRect(pv(TABLE_X), pv(464), 1.5, pv(1316), palette.dark));
    parts.push(pvRect(pv(TABLE_X + LABEL_W), pv(464), 1.5, pv(1316), palette.dark));
    parts.push(pvRect(pv(TABLE_X + TABLE_W), pv(464), 1.5, pv(1316), palette.dark));
    parts.push(pvRect(pv(TABLE_X), pv(1820), pv(TABLE_W), pv(150), palette.dark));
    return svgWrap(parts, palette.background);
  }
};
