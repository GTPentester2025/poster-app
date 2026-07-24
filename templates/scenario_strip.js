// Template 4 — scenario-strip: comic-strip horizontal bands — the scenario
// band (dark), the response band (brand), then the CTA band, separated by
// zigzag tear lines.

import {
  CANVAS_W, makeCanvas, textbox, rect, circle, polygon, chip, imageSlot,
  pickTextColor, fitFontSize, splitMessages, estTextHeight,
  pv, svgWrap, pvRect, pvPoly, pvBars, pvSlot
} from './helpers.js';

function zigzag(y, fill) {
  const points = [{ x: 0, y: y + 18 }];
  for (let x = 0; x <= CANVAS_W; x += 101) {
    points.push({ x, y: (x / 101) % 2 === 0 ? y : y + 36 });
  }
  points.push({ x: CANVAS_W, y: y + 18 });
  return polygon(points, { fill });
}

function bandMessages(o, msgs, { y, h, w, chipBg, chipColor, textColor, bandBg, fonts }) {
  const top = y + 50;
  const blockH = (h - 90) / Math.max(msgs.length, 1);
  msgs.forEach((m, i) => {
    const rowY = Math.round(top + i * blockH);
    let textY = rowY;
    if (m.label) {
      o.push(...chip({ text: m.label, x: 90, y: rowY, fontSize: 23, bg: chipBg, color: chipColor, font: fonts.head, msgId: m.id, square: true }));
      textY = rowY + 62;
    }
    const size = fitFontSize(m.text, { width: w, height: blockH - (textY - rowY) - 16, maxSize: 46, minSize: 38 });
    o.push(textbox({
      text: m.text, x: 90, y: textY, w, fontSize: size, fontFamily: fonts.body,
      fontWeight: '600', fill: textColor, layerRole: 'message', msgId: m.id, bgRef: bandBg
    }));
  });
}

export default {
  id: 'scenario-strip',
  name: 'Scenario strip',
  description: 'Comic-strip bands: the scenario plays out on a dark panel, the right response answers on a brand panel, the call to action closes the strip.',
  suitedFor: ['scenario-response'],

  build(content, palette, fonts) {
    const canvas = makeCanvas(palette.background);
    const o = canvas.objects;
    const onPrimary = pickTextColor(palette.primary);
    const onAccent = pickTextColor(palette.accent);

    const headSize = fitFontSize(content.headline, { width: 1234, height: 210, maxSize: 104, minSize: 80 });
    o.push(textbox({
      text: content.headline, x: 90, y: 70, w: 1234, fontSize: headSize,
      fontFamily: fonts.head, fontWeight: '900', fill: palette.dark, layerRole: 'headline', bgRef: palette.background
    }));
    if (content.subheadline) {
      o.push(textbox({
        text: content.subheadline, x: 90, y: 70 + estTextHeight(content.headline, headSize, 1234) + 20,
        w: 1100, fontSize: 38, fontFamily: fonts.body, fontWeight: '600',
        fill: palette.dark, layerRole: 'subheadline', bgRef: palette.background
      }));
    }

    const [response, scenario] = splitMessages(content.messages);

    // band 1 — scenario (dark) with a comic panel image slot
    o.push(rect({ x: 0, y: 400, w: CANVAS_W, h: 600, fill: palette.dark, layerRole: 'background' }));
    o.push(zigzag(382, palette.dark));
    bandMessages(o, scenario, {
      y: 400, h: 600, w: 800, chipBg: palette.accent, chipColor: onAccent,
      textColor: '#FFFFFF', bandBg: palette.dark, fonts
    });
    o.push(imageSlot({
      slotId: 'slot-1', x: 960, y: 460, w: 364, h: 480,
      styleHint: 'comic panel of the risky scenario, no text or speech bubbles', stroke: palette.primary
    }));

    // band 2 — response (brand primary)
    o.push(rect({ x: 0, y: 1040, w: CANVAS_W, h: 600, fill: palette.primary, layerRole: 'background' }));
    o.push(zigzag(1022, palette.primary));
    bandMessages(o, response, {
      y: 1040, h: 600, w: 800, chipBg: palette.dark, chipColor: palette.primary,
      textColor: onPrimary, bandBg: palette.primary, fonts
    });
    o.push(imageSlot({
      slotId: 'slot-2', x: 960, y: 1100, w: 364, h: 480,
      styleHint: 'comic panel of the safe response, no text or speech bubbles', stroke: palette.dark
    }));

    // strip perforation dots between response and CTA
    for (let x = 110; x <= 1304; x += 110) {
      o.push(circle({ x, y: 1730, r: 8, fill: palette.dark, opacity: 0.35 }));
    }

    if (content.callToAction) {
      o.push(rect({ x: 0, y: 1812, w: CANVAS_W, h: 188, fill: palette.accent, layerRole: 'background' }));
      const ctaSize = fitFontSize(content.callToAction, { width: 1234, height: 130, maxSize: 46, minSize: 32 });
      o.push(textbox({
        text: content.callToAction, x: 90, y: 1812 + Math.round((188 - estTextHeight(content.callToAction, ctaSize, 1234)) / 2),
        w: 1234, fontSize: ctaSize, fontFamily: fonts.head, fontWeight: '800',
        fill: onAccent, align: 'center', layerRole: 'cta', bgRef: palette.accent
      }));
    }
    return canvas;
  },

  preview(palette) {
    const zig = (y, fill) => {
      const pts = [{ x: 0, y: pv(y + 18) }];
      for (let x = 0; x <= CANVAS_W; x += 101) pts.push({ x: pv(x), y: pv((x / 101) % 2 === 0 ? y : y + 36) });
      pts.push({ x: 200, y: pv(y + 18) });
      return pvPoly(pts, fill);
    };
    const parts = [
      pvBars({ x: pv(90), y: pv(90), w: pv(1234), lines: 2, barH: 8, gap: 5, fill: palette.dark }),
      pvRect(0, pv(400), 200, pv(600), palette.dark), zig(382, palette.dark),
      pvBars({ x: pv(90), y: pv(480), w: pv(800), lines: 4, barH: 4.5, gap: 4, fill: '#FFFFFF' }),
      pvSlot(pv(960), pv(460), pv(364), pv(480), palette.primary),
      pvRect(0, pv(1040), 200, pv(600), palette.primary), zig(1022, palette.primary),
      pvBars({ x: pv(90), y: pv(1120), w: pv(800), lines: 4, barH: 4.5, gap: 4, fill: palette.dark }),
      pvSlot(pv(960), pv(1100), pv(364), pv(480), palette.dark),
      pvRect(0, pv(1812), 200, pv(188), palette.accent)
    ];
    return svgWrap(parts, palette.background);
  }
};
