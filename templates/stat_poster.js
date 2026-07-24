// Template 5 — stat-poster: the first message is promoted to a giant
// stat-style callout inside a ringed disc; the remaining messages run as a
// small supporting row underneath.

import {
  CANVAS_W, makeCanvas, textbox, rect, circle, chip, vline, imageSlot,
  pickTextColor, fitFontSize, estTextHeight,
  pv, svgWrap, pvRect, pvCircle, pvBars, pvSlot
} from './helpers.js';

export default {
  id: 'stat-poster',
  name: 'Stat callout',
  description: 'One message blown up to poster-dominating scale inside a ringed disc; the rest support it in a small row.',
  suitedFor: ['key-messages', 'red-flags'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;
    const onPrimary = pickTextColor(palette.primary);
    const [hero, ...rest] = content.messages;

    const headSize = fitFontSize(content.headline, { width: 960, height: 260, maxSize: 100, minSize: 80 });
    o.push(textbox({
      text: content.headline, x: 90, y: 90, w: 960, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.dark, layerRole: 'headline', bgRef: palette.background
    }));
    o.push(imageSlot({
      slotId: 'slot-1', x: 1100, y: 80, w: 224, h: 224,
      styleHint: 'small topic icon, flat style, no text', stroke: palette.dark
    }));
    if (content.subheadline) {
      o.push(textbox({
        text: content.subheadline, x: 90, y: 90 + estTextHeight(content.headline, headSize, 960) + 22,
        w: 960, fontSize: 40, fontFamily: fonts.body, fontWeight: '600',
        fill: palette.dark, layerRole: 'subheadline', bgRef: palette.background
      }));
    }

    // hero disc + rings
    const cx = 707;
    const cy = 940;
    o.push(circle({ x: cx, y: cy, r: 512, fill: 'transparent', stroke: palette.dark, strokeWidth: 3, opacity: 0.35 }));
    o.push(circle({ x: cx, y: cy, r: 478, fill: 'transparent', stroke: palette.primary, strokeWidth: 10 }));
    o.push(circle({ x: cx, y: cy, r: 440, fill: palette.primary }));
    o.push(circle({ x: cx + 400, y: cy - 330, r: 26, fill: palette.accent }));
    o.push(circle({ x: cx - 430, y: cy + 280, r: 16, fill: palette.dark }));

    let heroTextY = cy - 240;
    if (hero.label) {
      const [pill, label] = chip({ text: hero.label, x: 0, y: heroTextY, fontSize: 26, bg: palette.dark, color: palette.primary, font: fonts.head, msgId: hero.id });
      // center the chip on the disc
      const shift = cx - pill.width / 2;
      pill.left = shift;
      label.left += shift;
      o.push(pill, label);
      heroTextY += 90;
    }
    const heroSize = fitFontSize(hero.text, { width: 680, height: cy + 300 - heroTextY, maxSize: 120, minSize: 48, lineHeight: 1.1 });
    o.push(textbox({
      text: hero.text, x: cx - 340, y: heroTextY, w: 680, fontSize: heroSize, lineHeight: 1.1,
      fontFamily: fonts.head, fontWeight: '900', fill: onPrimary, align: 'center',
      layerRole: 'message', msgId: hero.id, bgRef: palette.primary
    }));

    // supporting row
    const cols = Math.max(rest.length, 1);
    const rowY = 1500;
    const colW = Math.floor(1234 / cols);
    rest.forEach((m, i) => {
      const x = 90 + i * colW;
      let textY = rowY;
      if (m.label) {
        o.push(...chip({ text: m.label, x, y: rowY, fontSize: 20, bg: palette.dark, color: palette.primary, font: fonts.head, msgId: m.id }));
        textY = rowY + 56;
      }
      const size = fitFontSize(m.text, { width: colW - 50, height: 300 - (textY - rowY), maxSize: 42, minSize: 38 });
      o.push(textbox({
        text: m.text, x, y: textY, w: colW - 50, fontSize: size, fontFamily: fonts.body,
        fontWeight: '600', fill: palette.dark, layerRole: 'message', msgId: m.id, bgRef: palette.background
      }));
      if (i < rest.length - 1) o.push(vline({ x: x + colW - 25, y: rowY, h: 300, thickness: 3, fill: '#00000026' }));
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
    const onPrimary = pickTextColor(palette.primary);
    const parts = [
      pvBars({ x: pv(90), y: pv(110), w: pv(960), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
      pvSlot(pv(1100), pv(80), pv(224), pv(224), palette.dark),
      pvCircle(pv(707), pv(940), pv(478), 'none', { stroke: palette.primary }),
      pvCircle(pv(707), pv(940), pv(440), palette.primary),
      pvCircle(pv(1107), pv(610), 4, palette.accent),
      pvBars({ x: pv(367), y: pv(800), w: pv(680), lines: 3, barH: 11, gap: 6, fill: onPrimary, align: 'center' }),
      pvRect(0, pv(1856), 200, pv(144), palette.dark)
    ];
    for (let i = 0; i < 3; i++) {
      parts.push(pvBars({ x: pv(90 + i * 411), y: pv(1510), w: pv(360), lines: 3, barH: 4, gap: 3, fill: palette.dark }));
    }
    return svgWrap(parts, palette.background);
  }
};
