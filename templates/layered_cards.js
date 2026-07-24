// Template 12 — layered-cards: overlapping rounded cards with deep shadows —
// a headline deck on a brand band, then a staggered stack of message cards
// each tucked under the previous one.

import {
  CANVAS_W, makeCanvas, textbox, rect, circle, chip, imageSlot,
  fitFontSize, estTextHeight,
  pv, svgWrap, pvRect, pvCircle, pvBars, pvSlot
} from './helpers.js';

const DECK_SHADOW = { color: 'rgba(31,26,23,0.22)', blur: 26, offsetX: 0, offsetY: 14 };
const CARD_SHADOW = { color: 'rgba(31,26,23,0.18)', blur: 18, offsetX: 0, offsetY: 10 };

export default {
  id: 'layered-cards',
  name: 'Layered cards',
  description: 'Depth through overlap: a headline deck floating on a brand band, message cards stacked and staggered underneath it.',
  suitedFor: ['key-messages', 'split'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;
    const n = content.messages.length;

    // brand band + echo card behind the headline deck (depth cue)
    o.push(rect({ x: 0, y: 0, w: CANVAS_W, h: 660, fill: palette.primary, layerRole: 'background' }));
    o.push(circle({ x: 1330, y: 620, r: 90, fill: palette.secondary, opacity: 0.25 }));
    o.push(rect({ x: 96, y: 136, w: 890, h: 470, fill: palette.secondary, rx: 32, opacity: 0.3 }));

    // headline deck
    o.push(rect({ x: 70, y: 110, w: 890, h: 470, fill: '#FFFFFF', rx: 32, shadow: DECK_SHADOW, layerRole: 'background' }));
    const headSize = fitFontSize(content.headline, { width: 770, height: 260, maxSize: 112, minSize: 80 });
    o.push(textbox({
      text: content.headline, x: 130, y: 170, w: 770, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.dark, layerRole: 'headline', bgRef: '#FFFFFF'
    }));
    if (content.subheadline) {
      const y = 170 + estTextHeight(content.headline, headSize, 770) + 24;
      o.push(textbox({
        text: content.subheadline, x: 130, y: Math.min(y, 500), w: 770, fontSize: 38,
        fontFamily: fonts.body, fontWeight: '600', fill: palette.dark, layerRole: 'subheadline', bgRef: '#FFFFFF'
      }));
    }

    // picture card overlapping the band edge
    o.push(rect({ x: 1000, y: 170, w: 344, h: 560, fill: '#FFFFFF', rx: 26, shadow: DECK_SHADOW, layerRole: 'background' }));
    o.push(imageSlot({
      slotId: 'slot-1', x: 1024, y: 194, w: 296, h: 512,
      styleHint: 'layered paper-cut style illustration with depth, no text', stroke: palette.dark
    }));

    // staggered, overlapping message card stack
    const top = 700;
    const bottom = 1770;
    const step = (bottom - top) / n;
    const cardH = Math.round(step + 40); // each card runs under the next one
    content.messages.forEach((m, i) => {
      const x = 70 + (i % 2) * 90;
      const y = Math.round(top + i * step);
      o.push(rect({
        x, y, w: 850, h: Math.min(cardH, 1810 - y), fill: i % 2 === 0 ? '#FFFFFF' : palette.background, rx: 26,
        stroke: '#00000014', strokeWidth: 2, shadow: CARD_SHADOW, layerRole: 'background'
      }));
      o.push(rect({ x: x + 34, y: y + 30, w: 46, h: 10, fill: palette.accent, rx: 5 }));
      let textY = y + 56;
      if (m.label) {
        o.push(...chip({ text: m.label, x: x + 34, y: textY, fontSize: 21, bg: palette.dark, color: palette.primary, font: fonts.head, msgId: m.id }));
        textY += 58;
      }
      const size = fitFontSize(m.text, { width: 740, height: Math.max(90, step - (textY - y) - 46), maxSize: 44, minSize: 38 });
      o.push(textbox({
        text: m.text, x: x + 34, y: textY, w: 740, fontSize: size, fontFamily: fonts.body,
        fontWeight: '600', fill: palette.dark, layerRole: 'message', msgId: m.id, bgRef: '#FFFFFF'
      }));
    });

    // CTA card overlapping the bottom of the stack
    if (content.callToAction) {
      o.push(rect({ x: 220, y: 1810, w: 974, h: 150, fill: palette.dark, rx: 28, shadow: DECK_SHADOW, layerRole: 'background' }));
      const ctaSize = fitFontSize(content.callToAction, { width: 880, height: 100, maxSize: 42, minSize: 30 });
      o.push(textbox({
        text: content.callToAction, x: 267, y: 1810 + Math.round((150 - estTextHeight(content.callToAction, ctaSize, 880)) / 2),
        w: 880, fontSize: ctaSize, fontFamily: fonts.head, fontWeight: '800',
        fill: palette.primary, align: 'center', layerRole: 'cta', bgRef: palette.dark
      }));
    }
    return canvas;
  },

  preview(palette) {
    const parts = [
      pvRect(0, 0, 200, pv(660), palette.primary),
      pvCircle(pv(1330), pv(620), pv(90), palette.secondary, { opacity: 0.25 }),
      pvRect(pv(96), pv(136), pv(890), pv(470), palette.secondary, { rx: 5, opacity: 0.3 }),
      pvRect(pv(70), pv(110), pv(890), pv(470), '#FFFFFF', { rx: 5 }),
      pvBars({ x: pv(130), y: pv(180), w: pv(770), lines: 2, barH: 9, gap: 6, fill: palette.dark }),
      pvRect(pv(1000), pv(170), pv(344), pv(560), '#FFFFFF', { rx: 4 }),
      pvSlot(pv(1024), pv(194), pv(296), pv(512), palette.dark)
    ];
    for (let i = 0; i < 4; i++) {
      const x = pv(70 + (i % 2) * 90);
      const y = pv(700 + i * 268);
      parts.push(pvRect(x, y, pv(850), pv(300), i % 2 === 0 ? '#FFFFFF' : palette.background, { rx: 4, stroke: '#00000030' }));
      parts.push(pvRect(x + pv(34), y + pv(30), pv(46), 1.5, palette.accent));
      parts.push(pvBars({ x: x + pv(34), y: y + pv(70), w: pv(740), lines: 2, barH: 4.5, gap: 3, fill: palette.dark }));
    }
    parts.push(pvRect(pv(220), pv(1810), pv(974), pv(150), palette.dark, { rx: 4 }));
    return svgWrap(parts, palette.background);
  }
};
