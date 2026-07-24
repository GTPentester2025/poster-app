// Template 3 — dos-donts-duel: two-column duel, semantic green vs red panels
// with check/cross marks and label chips per message.

import {
  CANVAS_W, makeCanvas, textbox, rect, circle, chip, imageSlot,
  pickTextColor, fitFontSize, estTextHeight, splitMessages, SEMANTIC_GREEN,
  pv, svgWrap, pvRect, pvCircle, pvBars, pvSlot
} from './helpers.js';

const PANEL_TOP = 620;
const PANEL_BOTTOM = 1820;

function buildColumn(o, msgs, { x, panelColor, palette, fonts }) {
  const onPanel = pickTextColor(panelColor);
  o.push(rect({ x, y: PANEL_TOP, w: 630, h: PANEL_BOTTOM - PANEL_TOP, fill: panelColor, rx: 26, layerRole: 'background' }));
  o.push(circle({ x: x + 315, y: PANEL_TOP, r: 52, fill: palette.background, stroke: panelColor, strokeWidth: 8 }));
  const top = PANEL_TOP + 90;
  const blockH = (PANEL_BOTTOM - 60 - top) / Math.max(msgs.length, 1);
  msgs.forEach((m, i) => {
    const y = Math.round(top + i * blockH);
    let textY = y;
    if (m.label) {
      o.push(...chip({ text: m.label, x: x + 50, y, fontSize: 24, bg: onPanel, color: panelColor, font: fonts.head, msgId: m.id }));
      textY = y + 66;
    }
    const size = fitFontSize(m.text, { width: 530, height: blockH - (textY - y) - 30, maxSize: 48, minSize: 38 });
    o.push(textbox({
      text: m.text, x: x + 50, y: textY, w: 530, fontSize: size, fontFamily: fonts.body,
      fontWeight: '600', fill: onPanel, layerRole: 'message', msgId: m.id, bgRef: panelColor
    }));
  });
}

export default {
  id: 'dos-donts-duel',
  name: 'Dos & don\'ts duel',
  description: 'Green-versus-red column duel with check and cross badges — one side safe behaviour, one side the trap.',
  suitedFor: ['dos-donts'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;

    const headSize = fitFontSize(content.headline, { width: 1234, height: 300, maxSize: 116, minSize: 80 });
    o.push(textbox({
      text: content.headline, x: 90, y: 90, w: 1234, fontSize: headSize, align: 'center',
      fontFamily: fonts.head, fontWeight: '900', fill: palette.dark, layerRole: 'headline', bgRef: palette.background
    }));
    let cursor = 90 + estTextHeight(content.headline, headSize, 1234) + 26;
    if (content.subheadline) {
      o.push(textbox({
        text: content.subheadline, x: 200, y: Math.min(cursor, 470), w: 1014, fontSize: 40, align: 'center',
        fontFamily: fonts.body, fontWeight: '600', fill: palette.dark, layerRole: 'subheadline', bgRef: palette.background
      }));
    }

    const [dos, donts] = splitMessages(content.messages);
    buildColumn(o, dos, { x: 70, panelColor: SEMANTIC_GREEN, palette, fonts });
    buildColumn(o, donts, { x: 714, panelColor: palette.accent, palette, fonts });
    // duel divider bolt
    o.push(rect({ x: 699, y: PANEL_TOP - 40, w: 16, h: PANEL_BOTTOM - PANEL_TOP + 80, fill: palette.dark, rx: 8 }));
    o.push(circle({ x: 707, y: (PANEL_TOP + PANEL_BOTTOM) / 2, r: 46, fill: palette.dark }));
    o.push(circle({ x: 707, y: (PANEL_TOP + PANEL_BOTTOM) / 2, r: 30, fill: palette.primary }));

    // image slot between headline and panels, right-aligned
    o.push(imageSlot({
      slotId: 'slot-1', x: 1112, y: 96, w: 212, h: 212,
      styleHint: 'small emblem icon contrasting right and wrong, no text', stroke: palette.dark
    }));

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
      pvBars({ x: pv(200), y: pv(110), w: pv(1014), lines: 2, barH: 9, gap: 5, fill: palette.dark, align: 'center' }),
      pvSlot(pv(1112), pv(96), pv(212), pv(212), palette.dark),
      pvRect(pv(70), pv(PANEL_TOP), pv(630), pv(PANEL_BOTTOM - PANEL_TOP), SEMANTIC_GREEN, { rx: 5 }),
      pvRect(pv(714), pv(PANEL_TOP), pv(630), pv(PANEL_BOTTOM - PANEL_TOP), palette.accent, { rx: 5 }),
      pvCircle(pv(385), pv(PANEL_TOP), 7, palette.background, { stroke: SEMANTIC_GREEN }),
      pvCircle(pv(1029), pv(PANEL_TOP), 7, palette.background, { stroke: palette.accent }),
      pvRect(pv(699), pv(PANEL_TOP - 40), 2.5, pv(PANEL_BOTTOM - PANEL_TOP + 80), palette.dark),
      pvCircle(pv(707), pv((PANEL_TOP + PANEL_BOTTOM) / 2), 6, palette.primary, { stroke: palette.dark }),
      pvRect(0, pv(1856), 200, pv(144), palette.dark)
    ];
    for (const x of [120, 764]) {
      parts.push(pvBars({ x: pv(x), y: pv(760), w: pv(530), lines: 2, barH: 4.5, gap: 3, fill: '#FFFFFF' }));
      parts.push(pvBars({ x: pv(x), y: pv(1250), w: pv(530), lines: 2, barH: 4.5, gap: 3, fill: '#FFFFFF' }));
    }
    return svgWrap(parts, palette.background);
  }
};
