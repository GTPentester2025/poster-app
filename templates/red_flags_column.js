// Template 2 — red-flags-column: warning-styled left rail carrying the flag
// chips + messages, headline/description/CTA on the right.

import {
  CANVAS_H, makeCanvas, textbox, rect, polygon, circle, chip, imageSlot,
  pickTextColor, fitFontSize, estTextHeight,
  pv, svgWrap, pvRect, pvPoly, pvCircle, pvBars, pvSlot
} from './helpers.js';

const RAIL_W = 540;

export default {
  id: 'red-flags-column',
  name: 'Red flags column',
  description: 'Warning rail on the left with flag chips and signals; headline, image and call to action on the right.',
  suitedFor: ['red-flags'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;
    const onAccent = pickTextColor(palette.accent);
    const n = content.messages.length;

    // warning rail
    o.push(rect({ x: 0, y: 0, w: RAIL_W, h: CANVAS_H, fill: palette.accent, layerRole: 'background' }));
    // vector warning mark (triangle + exclamation built from shapes — no text)
    o.push(polygon([{ x: 270, y: 60 }, { x: 378, y: 246 }, { x: 162, y: 246 }], { fill: onAccent, opacity: 0.95 }));
    o.push(rect({ x: 260, y: 110, w: 20, h: 74, fill: palette.accent, rx: 8 }));
    o.push(circle({ x: 270, y: 214, r: 12, fill: palette.accent }));

    const railTop = 320;
    const railBottom = 1900;
    const blockH = (railBottom - railTop) / n;
    content.messages.forEach((m, i) => {
      const y = Math.round(railTop + i * blockH);
      let textY = y;
      if (m.label) {
        o.push(...chip({ text: m.label, x: 60, y, fontSize: 24, bg: onAccent, color: palette.accent, font: fonts.head, msgId: m.id }));
        textY = y + 66;
      }
      const size = fitFontSize(m.text, { width: 420, height: blockH - (textY - y) - 40, maxSize: 50, minSize: 38 });
      o.push(textbox({
        text: m.text, x: 60, y: textY, w: 420, fontSize: size, fontFamily: fonts.body,
        fontWeight: '600', fill: onAccent, layerRole: 'message', msgId: m.id, bgRef: palette.accent
      }));
      if (i < n - 1) o.push(rect({ x: 60, y: Math.round(y + blockH - 16), w: 420, h: 3, fill: onAccent, opacity: 0.35 }));
    });

    // right side
    const headSize = fitFontSize(content.headline, { width: 714, height: 560, maxSize: 120, minSize: 80 });
    o.push(textbox({
      text: content.headline, x: 610, y: 140, w: 714, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.dark, layerRole: 'headline', bgRef: palette.background
    }));
    let cursor = 140 + estTextHeight(content.headline, headSize, 714) + 40;
    if (content.subheadline) {
      o.push(textbox({
        text: content.subheadline, x: 610, y: cursor, w: 714, fontSize: 42,
        fontFamily: fonts.body, fontWeight: '600', fill: palette.dark, layerRole: 'subheadline', bgRef: palette.background
      }));
      cursor += estTextHeight(content.subheadline, 42, 714) + 40;
    }
    o.push(rect({ x: 610, y: Math.min(cursor, 900), w: 180, h: 10, fill: palette.primary }));
    o.push(imageSlot({
      slotId: 'slot-1', x: 610, y: 1000, w: 714, h: 640,
      styleHint: 'illustration of the risky situation, no text', stroke: palette.dark
    }));
    if (content.callToAction) {
      o.push(rect({ x: 610, y: 1720, w: 714, h: 180, fill: palette.dark, rx: 20, layerRole: 'background' }));
      const ctaSize = fitFontSize(content.callToAction, { width: 630, height: 130, maxSize: 44, minSize: 30 });
      o.push(textbox({
        text: content.callToAction, x: 652, y: 1720 + Math.round((180 - estTextHeight(content.callToAction, ctaSize, 630)) / 2),
        w: 630, fontSize: ctaSize, fontFamily: fonts.head, fontWeight: '800',
        fill: palette.primary, layerRole: 'cta', bgRef: palette.dark
      }));
    }
    return canvas;
  },

  preview(palette) {
    const onAccent = pickTextColor(palette.accent);
    const parts = [
      pvRect(0, 0, pv(RAIL_W), 283, palette.accent),
      pvPoly([{ x: pv(270), y: pv(60) }, { x: pv(378), y: pv(246) }, { x: pv(162), y: pv(246) }], onAccent, { opacity: 0.95 })
    ];
    for (let i = 0; i < 4; i++) {
      const y = pv(340 + i * 400);
      parts.push(pvRect(pv(60), y, 20, 5, onAccent, { rx: 2.5 }));
      parts.push(pvBars({ x: pv(60), y: y + 8, w: pv(420), lines: 2, barH: 4.5, gap: 3, fill: onAccent }));
    }
    parts.push(pvBars({ x: pv(610), y: pv(150), w: pv(714), lines: 3, barH: 8, gap: 5, fill: palette.dark }));
    parts.push(pvRect(pv(610), pv(900), pv(180), 2.5, palette.primary));
    parts.push(pvSlot(pv(610), pv(1000), pv(714), pv(640), palette.dark));
    parts.push(pvRect(pv(610), pv(1720), pv(714), pv(180), palette.dark, { rx: 4 }));
    parts.push(pvCircle(pv(660), pv(1810), 3, palette.primary));
    return svgWrap(parts, palette.background);
  }
};
