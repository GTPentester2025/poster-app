// Template 9 — diagonal-energy: full-bleed diagonal color blocks slicing the
// canvas, skewed message cards stepping down the slope like a staircase.

import {
  CANVAS_W, makeCanvas, textbox, rect, polygon, chip, imageSlot,
  pickTextColor, fitFontSize, estTextHeight,
  pv, svgWrap, pvRect, pvPoly, pvBars, pvSlot
} from './helpers.js';

// the main diagonal runs from (0, 860) up to (1414, 300)
const DIAG_LEFT_Y = 860;
const DIAG_RIGHT_Y = 300;

export default {
  id: 'diagonal-energy',
  name: 'Diagonal energy',
  description: 'A brand block slashed diagonally across the poster, contrast stripes on the cut, skewed message cards stepping down the slope.',
  suitedFor: ['split', 'scenario-response'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;
    const onPrimary = pickTextColor(palette.primary);
    const onSecondary = pickTextColor(palette.secondary);
    const n = content.messages.length;

    // diagonal brand block + contrast stripes along the cut
    o.push(polygon([
      { x: 0, y: 0 }, { x: CANVAS_W, y: 0 },
      { x: CANVAS_W, y: DIAG_RIGHT_Y }, { x: 0, y: DIAG_LEFT_Y }
    ], { fill: palette.primary, layerRole: 'background' }));
    o.push(polygon([
      { x: 0, y: DIAG_LEFT_Y }, { x: CANVAS_W, y: DIAG_RIGHT_Y },
      { x: CANVAS_W, y: DIAG_RIGHT_Y + 46 }, { x: 0, y: DIAG_LEFT_Y + 46 }
    ], { fill: palette.secondary }));
    o.push(polygon([
      { x: 0, y: DIAG_LEFT_Y + 66 }, { x: CANVAS_W, y: DIAG_RIGHT_Y + 66 },
      { x: CANVAS_W, y: DIAG_RIGHT_Y + 86 }, { x: 0, y: DIAG_LEFT_Y + 86 }
    ], { fill: palette.accent }));

    // headline + subheadline live on the brand block
    const headSize = fitFontSize(content.headline, { width: 900, height: 330, maxSize: 128, minSize: 80 });
    o.push(textbox({
      text: content.headline, x: 90, y: 90, w: 900, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: onPrimary, layerRole: 'headline', bgRef: palette.primary
    }));
    if (content.subheadline) {
      const y = 90 + estTextHeight(content.headline, headSize, 900) + 26;
      o.push(textbox({
        text: content.subheadline, x: 90, y: Math.min(y, 560), w: 800, fontSize: 40,
        fontFamily: fonts.body, fontWeight: '600', fill: onPrimary, layerRole: 'subheadline', bgRef: palette.primary
      }));
    }

    // image slot tucked under the diagonal on the right
    o.push(imageSlot({
      slotId: 'slot-1', x: 1040, y: 500, w: 284, h: 400,
      styleHint: 'dynamic angled illustration of the topic, high energy, no text', stroke: palette.dark
    }));

    // skewed staircase of message cards
    const top = 960;
    const bottom = 1780;
    const rowH = (bottom - top) / n;
    const cardH = Math.round(rowH - 28);
    content.messages.forEach((m, i) => {
      const x = 90 + i * Math.min(50, Math.round(320 / n));
      const y = Math.round(top + i * rowH);
      o.push(rect({
        x, y, w: 860, h: cardH, fill: '#FFFFFF', rx: 10, skewX: -8,
        shadow: { color: 'rgba(31,26,23,0.18)', blur: 14, offsetX: 6, offsetY: 8 }, layerRole: 'background'
      }));
      o.push(rect({ x, y, w: 18, h: cardH, fill: i % 2 === 0 ? palette.primary : palette.accent, skewX: -8 }));
      let textY = y + 22;
      let textX = x + 62;
      if (m.label) {
        o.push(...chip({ text: m.label, x: textX, y: textY, fontSize: 21, bg: palette.dark, color: palette.primary, font: fonts.head, msgId: m.id, square: true }));
        textY += 58;
      }
      const size = fitFontSize(m.text, { width: 740, height: y + cardH - textY - 16, maxSize: 44, minSize: 38 });
      o.push(textbox({
        text: m.text, x: textX, y: textY, w: 740, fontSize: size, fontFamily: fonts.body,
        fontWeight: '600', fill: palette.dark, layerRole: 'message', msgId: m.id, bgRef: '#FFFFFF'
      }));
    });

    // CTA on a skewed secondary bar
    if (content.callToAction) {
      o.push(rect({ x: -30, y: 1836, w: CANVAS_W + 60, h: 164, fill: palette.secondary, skewX: -8, layerRole: 'background' }));
      const ctaSize = fitFontSize(content.callToAction, { width: 1200, height: 110, maxSize: 46, minSize: 32 });
      o.push(textbox({
        text: content.callToAction, x: 107, y: 1836 + Math.round((164 - estTextHeight(content.callToAction, ctaSize, 1200)) / 2),
        w: 1200, fontSize: ctaSize, fontFamily: fonts.head, fontWeight: '800',
        fill: onSecondary, align: 'center', layerRole: 'cta', bgRef: palette.secondary
      }));
    }
    return canvas;
  },

  preview(palette) {
    const onPrimary = pickTextColor(palette.primary);
    const parts = [
      pvPoly([
        { x: 0, y: 0 }, { x: 200, y: 0 },
        { x: 200, y: pv(DIAG_RIGHT_Y) }, { x: 0, y: pv(DIAG_LEFT_Y) }
      ], palette.primary),
      pvPoly([
        { x: 0, y: pv(DIAG_LEFT_Y) }, { x: 200, y: pv(DIAG_RIGHT_Y) },
        { x: 200, y: pv(DIAG_RIGHT_Y + 46) }, { x: 0, y: pv(DIAG_LEFT_Y + 46) }
      ], palette.secondary),
      pvPoly([
        { x: 0, y: pv(DIAG_LEFT_Y + 66) }, { x: 200, y: pv(DIAG_RIGHT_Y + 66) },
        { x: 200, y: pv(DIAG_RIGHT_Y + 86) }, { x: 0, y: pv(DIAG_LEFT_Y + 86) }
      ], palette.accent),
      pvBars({ x: pv(90), y: pv(110), w: pv(900), lines: 3, barH: 8, gap: 5, fill: onPrimary }),
      pvSlot(pv(1040), pv(500), pv(284), pv(400), palette.dark)
    ];
    for (let i = 0; i < 4; i++) {
      const x = pv(90 + i * 50);
      const y = pv(960 + i * 205);
      parts.push(pvPoly([
        { x: x + 3, y }, { x: x + pv(860) + 3, y },
        { x: x + pv(860), y: y + pv(177) }, { x, y: y + pv(177) }
      ], '#FFFFFF'));
      parts.push(pvRect(x + 2, y + 1, 2.5, pv(170), i % 2 === 0 ? palette.primary : palette.accent));
      parts.push(pvBars({ x: x + 10, y: y + 6, w: pv(700), lines: 2, barH: 4.5, gap: 3, fill: palette.dark }));
    }
    parts.push(pvRect(0, pv(1836), 200, pv(164), palette.secondary));
    return svgWrap(parts, palette.background);
  }
};
