// Template 1 — bold-split: giant headline on a full-bleed brand block (top
// 40%), messages as numbered blocks below, CTA bar at the foot.

import {
  CANVAS_W, makeCanvas, textbox, rect, circle, hline, imageSlot,
  pickTextColor, fitFontSize, estTextHeight,
  pv, svgWrap, pvRect, pvCircle, pvBars, pvSlot
} from './helpers.js';

export default {
  id: 'bold-split',
  name: 'Bold split',
  description: 'Giant headline on a full-width brand block; numbered message stack below with a vertical image strip.',
  suitedFor: ['key-messages', 'split'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;
    const onPrimary = pickTextColor(palette.primary);
    const n = content.messages.length;

    // top block
    o.push(rect({ x: 0, y: 0, w: CANVAS_W, h: 800, fill: palette.primary, layerRole: 'background' }));
    o.push(hline({ x: 0, y: 800, w: CANVAS_W, thickness: 12, fill: palette.secondary }));

    const headSize = fitFontSize(content.headline, { width: 1234, height: 460, maxSize: 150, minSize: 80 });
    o.push(textbox({
      text: content.headline, x: 90, y: 110, w: 1234, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: onPrimary, layerRole: 'headline', bgRef: palette.primary
    }));
    if (content.subheadline) {
      const y = 110 + estTextHeight(content.headline, headSize, 1234) + 34;
      o.push(textbox({
        text: content.subheadline, x: 90, y: Math.min(y, 690), w: 1100, fontSize: 44,
        fontFamily: fonts.body, fontWeight: '600', fill: onPrimary, layerRole: 'subheadline', bgRef: palette.primary
      }));
    }

    // numbered message blocks (bottom 60%), image strip on the right
    const top = 880;
    const bottom = 1780;
    const rowH = (bottom - top) / n;
    content.messages.forEach((m, i) => {
      const y = Math.round(top + i * rowH);
      o.push(circle({ x: 160, y: y + 52, r: 46, fill: palette.secondary }));
      o.push(textbox({
        text: String(i + 1), x: 130, y: y + 24, w: 60, fontSize: 52, fontFamily: fonts.head,
        fontWeight: '800', fill: palette.primary, align: 'center', layerRole: 'decor', lineHeight: 1
      }));
      const size = fitFontSize(m.text, { width: 800, height: rowH - 26, maxSize: 56, minSize: 38 });
      o.push(textbox({
        text: m.text, x: 260, y, w: 800, fontSize: size, fontFamily: fonts.body,
        fontWeight: '600', fill: palette.dark, layerRole: 'message', msgId: m.id, bgRef: palette.background
      }));
      if (i < n - 1) o.push(hline({ x: 260, y: Math.round(y + rowH - 14), w: 800, thickness: 3, fill: '#00000022' }));
    });
    o.push(imageSlot({
      slotId: 'slot-1', x: 1110, y: 890, w: 214, h: 870,
      styleHint: 'vertical illustration strip, topic-themed, no text', stroke: palette.dark
    }));

    // CTA bar
    if (content.callToAction) {
      o.push(rect({ x: 0, y: 1836, w: CANVAS_W, h: 164, fill: palette.secondary, layerRole: 'background' }));
      const ctaSize = fitFontSize(content.callToAction, { width: 1234, height: 110, maxSize: 48, minSize: 32 });
      o.push(textbox({
        text: content.callToAction, x: 90, y: 1836 + Math.round((164 - estTextHeight(content.callToAction, ctaSize, 1234)) / 2),
        w: 1234, fontSize: ctaSize, fontFamily: fonts.head, fontWeight: '800',
        fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.secondary
      }));
    }
    return canvas;
  },

  preview(palette) {
    const onPrimary = pickTextColor(palette.primary);
    const parts = [
      pvRect(0, 0, 200, pv(800), palette.primary),
      pvRect(0, pv(800), 200, 2, palette.secondary),
      pvBars({ x: pv(90), y: pv(130), w: pv(1200), lines: 3, barH: 9, gap: 5, fill: onPrimary }),
      pvSlot(pv(1110), pv(890), pv(214), pv(870), palette.dark),
      pvRect(0, pv(1836), 200, pv(164), palette.secondary),
      pvRect(pv(300), pv(1880), pv(820), 6, palette.primary, { rx: 3 })
    ];
    for (let i = 0; i < 4; i++) {
      const y = pv(880 + i * 225);
      parts.push(pvCircle(pv(160), y + 7, 6, palette.secondary));
      parts.push(pvBars({ x: pv(260), y, w: pv(800), lines: 2, barH: 5, gap: 3, fill: palette.dark }));
    }
    return svgWrap(parts, palette.background);
  }
};
