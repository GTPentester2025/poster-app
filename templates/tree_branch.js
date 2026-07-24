// Template 6 — tree-branch: headline root card feeding branch lines down a
// central spine to message leaf cards (relationship diagram).

import {
  CANVAS_W, makeCanvas, textbox, rect, circle, hline, vline, chip, imageSlot,
  fitFontSize, estTextHeight,
  pv, svgWrap, pvRect, pvCircle, pvBars, pvSlot
} from './helpers.js';

const SPINE_X = 703;

export default {
  id: 'tree-branch',
  name: 'Tree & branches',
  description: 'Relationship diagram: the headline is the root, branch lines feed each message as a leaf card.',
  suitedFor: ['key-messages', 'dos-donts'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;

    // root card
    const headSize = fitFontSize(content.headline, { width: 720, height: 330, maxSize: 96, minSize: 80 });
    const headH = estTextHeight(content.headline, headSize, 720);
    const rootH = Math.min(headH + 100, 470);
    o.push(rect({ x: 307, y: 90, w: 800, h: rootH, fill: palette.dark, rx: 28, layerRole: 'background' }));
    o.push(rect({ x: 307, y: 90, w: 800, h: 16, fill: palette.primary, rx: 8 }));
    o.push(textbox({
      text: content.headline, x: 347, y: 140, w: 720, fontSize: headSize, align: 'center',
      fontFamily: fonts.head, fontWeight: '900', fill: palette.primary, layerRole: 'headline', bgRef: palette.dark
    }));

    // corner image slots
    o.push(imageSlot({ slotId: 'slot-1', x: 80, y: 100, w: 190, h: 190, styleHint: 'small topic icon, no text', stroke: palette.dark }));
    o.push(imageSlot({ slotId: 'slot-2', x: 1144, y: 100, w: 190, h: 190, styleHint: 'small topic icon, alternate motif, no text', stroke: palette.dark }));

    let leavesTop = 90 + rootH + 40;
    if (content.subheadline) {
      o.push(textbox({
        text: content.subheadline, x: 207, y: leavesTop - 10, w: 1000, fontSize: 38, align: 'center',
        fontFamily: fonts.body, fontWeight: '600', fill: palette.dark, layerRole: 'subheadline', bgRef: palette.background
      }));
      leavesTop += estTextHeight(content.subheadline, 38, 1000) + 30;
    }
    leavesTop = Math.max(leavesTop, 680);

    // leaf cards in two columns fed by a central spine
    const n = content.messages.length;
    const rows = Math.ceil(n / 2);
    const areaBottom = 1800;
    const rowH = (areaBottom - leavesTop) / rows;
    const lastCenterY = leavesTop + (rows - 1) * rowH + (rowH - 40) / 2;
    o.push(vline({ x: SPINE_X, y: 90 + rootH, h: lastCenterY - (90 + rootH), thickness: 8, fill: palette.primary }));

    content.messages.forEach((m, i) => {
      const row = Math.floor(i / 2);
      const leftSide = i % 2 === 0;
      const x = leftSide ? 70 : 784;
      const y = Math.round(leavesTop + row * rowH);
      const cardH = Math.round(rowH - 40);
      const centerY = y + cardH / 2;
      // branch + joint
      o.push(hline({ x: leftSide ? 630 : SPINE_X + 8, y: Math.round(centerY - 3), w: leftSide ? SPINE_X - 630 : 784 - SPINE_X - 8, thickness: 6, fill: palette.primary }));
      o.push(circle({ x: SPINE_X + 4, y: Math.round(centerY), r: 12, fill: palette.dark }));
      // card
      o.push(rect({
        x, y, w: 560, h: cardH, fill: '#FFFFFF', rx: 22,
        stroke: '#00000018', strokeWidth: 2,
        shadow: { color: 'rgba(31,26,23,0.14)', blur: 18, offsetX: 0, offsetY: 8 }, layerRole: 'background'
      }));
      o.push(rect({ x: leftSide ? x + 560 - 12 : x, y, w: 12, h: cardH, fill: palette.primary, rx: 6 }));
      let textY = y + 34;
      if (m.label) {
        o.push(...chip({ text: m.label, x: x + 40, y: textY, fontSize: 21, bg: palette.dark, color: palette.primary, font: fonts.head, msgId: m.id }));
        textY += 60;
      }
      const size = fitFontSize(m.text, { width: 480, height: y + cardH - textY - 24, maxSize: 44, minSize: 38 });
      o.push(textbox({
        text: m.text, x: x + 40, y: textY, w: 480, fontSize: size, fontFamily: fonts.body,
        fontWeight: '600', fill: palette.dark, layerRole: 'message', msgId: m.id, bgRef: '#FFFFFF'
      }));
    });

    if (content.callToAction) {
      o.push(rect({ x: 0, y: 1856, w: CANVAS_W, h: 144, fill: palette.dark, layerRole: 'background' }));
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
    const parts = [
      pvRect(pv(307), pv(90), pv(800), pv(400), palette.dark, { rx: 5 }),
      pvRect(pv(307), pv(90), pv(800), 3, palette.primary),
      pvBars({ x: pv(347), y: pv(170), w: pv(720), lines: 2, barH: 8, gap: 5, fill: palette.primary, align: 'center' }),
      pvSlot(pv(80), pv(100), pv(190), pv(190), palette.dark),
      pvSlot(pv(1144), pv(100), pv(190), pv(190), palette.dark),
      pvRect(pv(SPINE_X), pv(490), 2, pv(1010), palette.primary)
    ];
    for (let i = 0; i < 4; i++) {
      const left = i % 2 === 0;
      const y = pv(700 + Math.floor(i / 2) * 550);
      const x = left ? pv(70) : pv(784);
      parts.push(pvRect(x, y, pv(560), pv(480), '#FFFFFF', { rx: 4, stroke: '#00000030' }));
      parts.push(pvRect(pv(left ? 630 : SPINE_X), y + pv(240), pv(74), 1.5, palette.primary));
      parts.push(pvCircle(pv(SPINE_X) + 1, y + pv(240), 2.5, palette.dark));
      parts.push(pvBars({ x: x + pv(40), y: y + pv(90), w: pv(480), lines: 3, barH: 4, gap: 3, fill: palette.dark }));
    }
    parts.push(pvRect(0, pv(1856), 200, pv(144), palette.dark));
    return svgWrap(parts, palette.background);
  }
};
