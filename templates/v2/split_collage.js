// v2 template — split-collage (style: image-first). A mondrian-ish asymmetric
// collage: the canvas is carved into butted panels separated by thin dark
// gutters — a brand-colour headline block, three content image slots at varied
// sizes, and colour panels carrying the three points. Every image slot is
// linked (blockId) to the point it illustrates, so the fill pipeline generates
// point-relevant imagery. Portrait: hero row + interlocking bands. Landscape:
// REAL relayout — headline column left, collage field right.

import {
  textbox, rect, imageSlot, backgroundImageSlot,
  fitTextBlock, pickTextColor,
  pv, pvRect, pvBars, pvSlot
} from '../helpers.js';
import {
  makeCanvasV2, canvasDims, svgWrapO, PV_LAND_W, PV_LAND_H,
  legibilityScrim
} from './decor.js';

const GUT = 16;            // gutter between panels
const PAD = 52;            // inner panel padding

/** A colour panel with one point's text fitted inside. */
function textPanel(o, b, palette, fonts, { x, y, w, h, fill }) {
  o.push(rect({ x, y, w, h, fill, layerRole: 'background', msgId: b.id }));
  const on = pickTextColor(fill);
  const innerW = w - PAD * 2;
  const fit = fitTextBlock(b.text, {
    width: innerW, height: h - PAD * 2, maxSize: 40, minSize: 14, lineHeight: 1.3
  });
  o.push(rect({ x: x + PAD, y: y + PAD - 18, w: 88, h: 8, fill: on, opacity: 0.85, layerRole: 'decor' }));
  o.push({
    ...textbox({
      text: b.text, x: x + PAD, y: Math.round(y + (h - fit.height) / 2), w: innerW,
      fontSize: fit.fontSize, fontFamily: fonts.body, fontWeight: '700', fill: on,
      lineHeight: 1.3, layerRole: 'message', msgId: b.id, bgRef: fill
    }),
    fieldRef: 'text'
  });
}

/** The headline panel (brand primary) with headline + optional subheadline. */
function headPanel(o, content, palette, fonts, { x, y, w, h }) {
  o.push(rect({ x, y, w, h, fill: palette.primary, layerRole: 'background' }));
  const on = pickTextColor(palette.primary);
  const innerW = w - PAD * 2;
  const subBudget = content.subheadline ? 110 : 0;
  const head = fitTextBlock(content.headline, {
    width: innerW, height: h - PAD * 2 - subBudget, maxSize: 116, minSize: 44, lineHeight: 1.02
  });
  o.push(textbox({
    text: content.headline, x: x + PAD, y: y + PAD, w: innerW, fontSize: head.fontSize,
    fontFamily: fonts.head, fontWeight: '900', fill: on, lineHeight: 1.02,
    charSpacing: -10, layerRole: 'headline', bgRef: palette.primary
  }));
  if (content.subheadline) {
    const sub = fitTextBlock(content.subheadline, { width: innerW, height: subBudget - 22, maxSize: 34, minSize: 15, lineHeight: 1.28 });
    o.push(textbox({
      text: content.subheadline, x: x + PAD, y: Math.round(y + PAD + head.height + 22), w: innerW,
      fontSize: sub.fontSize, fontFamily: fonts.body, fontWeight: '600', fill: on,
      lineHeight: 1.28, layerRole: 'subheadline', bgRef: palette.primary
    }));
  }
}

function slot(n, b, frame, hint, stroke) {
  return imageSlot({
    slotId: `slot-${n}`, ...frame, rx: 0, stroke,
    styleHint: hint, ...(b ? { blockId: b.id } : {})
  });
}

function ctaBar(o, content, palette, fonts, { x, y, w, h }) {
  o.push(rect({ x, y, w, h, fill: palette.dark, layerRole: 'background' }));
  const on = pickTextColor(palette.dark);
  const cta = fitTextBlock(content.callToAction, { width: w - 200, height: h - 40, maxSize: 40, minSize: 22, lineHeight: 1.2 });
  o.push(textbox({
    text: content.callToAction, x: x + 100, y: Math.round(y + (h - cta.height) / 2), w: w - 200,
    fontSize: cta.fontSize, fontFamily: fonts.head, fontWeight: '800', fill: on,
    align: 'center', lineHeight: 1.2, layerRole: 'cta', bgRef: palette.dark
  }));
}

function buildPortrait(content, palette, fonts) {
  const canvas = makeCanvasV2('portrait', palette.dark);
  const { w: W, h: H } = canvasDims('portrait');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark textured backdrop, subtle grain, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const [b1, b2, b3] = content.blocks || [];
  const hintFor = (b) => `editorial photography illustrating: ${b ? b.text.slice(0, 80) : 'workplace security'}, cohesive color grade, no text`;

  // hero row: headline panel left, image slot-1 right
  const heroH = 620;
  const heroSplit = Math.round(W * 0.58);
  headPanel(o, content, palette, fonts, { x: 0, y: 0, w: heroSplit - GUT / 2, h: heroH });
  o.push(slot(1, null, { x: heroSplit + GUT / 2, y: 0, w: W - heroSplit - GUT / 2, h: heroH },
    'bold editorial cover photograph for the poster topic, cohesive color grade, no text', palette.primary));

  // band 2: image slot-2 left, point-1 dark panel right
  const band2Y = heroH + GUT;
  const band2H = 520;
  const band2Split = Math.round(W * 0.4);
  o.push(slot(2, b1, { x: 0, y: band2Y, w: band2Split - GUT / 2, h: band2H }, hintFor(b1), palette.accent));
  if (b1) textPanel(o, b1, palette, fonts, { x: band2Split + GUT / 2, y: band2Y, w: W - band2Split - GUT / 2, h: band2H, fill: palette.dark });

  // band 3: point-2 accent panel left, image slot-3 right
  const band3Y = band2Y + band2H + GUT;
  const band3H = 420;
  const band3Split = Math.round(W * 0.56);
  if (b2) textPanel(o, b2, palette, fonts, { x: 0, y: band3Y, w: band3Split - GUT / 2, h: band3H, fill: palette.accent });
  o.push(slot(3, b2, { x: band3Split + GUT / 2, y: band3Y, w: W - band3Split - GUT / 2, h: band3H }, hintFor(b2), palette.primary));

  // band 4: point-3 full-width light panel
  const band4Y = band3Y + band3H + GUT;
  const ctaH = 156;
  const band4H = H - band4Y - ctaH - GUT;
  if (b3) textPanel(o, b3, palette, fonts, { x: 0, y: band4Y, w: W, h: band4H, fill: palette.background });

  ctaBar(o, content, palette, fonts, { x: 0, y: H - ctaH, w: W, h: ctaH });
  return canvas;
}

function buildLandscape(content, palette, fonts) {
  const canvas = makeCanvasV2('landscape', palette.dark);
  const { w: W, h: H } = canvasDims('landscape');
  const o = canvas.objects;

  o.push(backgroundImageSlot({ w: W, h: H, styleHint: 'dark textured backdrop, subtle grain, no text', stroke: palette.primary }));
  o.push(...legibilityScrim({ w: W, h: H }));

  const [b1, b2, b3] = content.blocks || [];
  const hintFor = (b) => `editorial photography illustrating: ${b ? b.text.slice(0, 80) : 'workplace security'}, cohesive color grade, no text`;

  // left column: headline panel over image slot-3
  const colW = 760;
  const headH = 820;
  headPanel(o, content, palette, fonts, { x: 0, y: 0, w: colW - GUT / 2, h: headH });
  o.push(slot(3, b3, { x: 0, y: headH + GUT, w: colW - GUT / 2, h: H - headH - GUT }, hintFor(b3), palette.primary));

  // right field
  const rx = colW + GUT / 2;
  const rw = W - rx;
  // row 1: image slot-1 + point-1 dark panel
  const row1H = 600;
  const row1Split = Math.round(rx + rw * 0.6);
  o.push(slot(1, null, { x: rx, y: 0, w: row1Split - rx - GUT / 2, h: row1H },
    'bold editorial cover photograph for the poster topic, cohesive color grade, no text', palette.accent));
  if (b1) textPanel(o, b1, palette, fonts, { x: row1Split + GUT / 2, y: 0, w: W - row1Split - GUT / 2, h: row1H, fill: palette.dark });

  // row 2: point-2 accent panel + image slot-2
  const row2Y = row1H + GUT;
  const row2H = 450;
  const row2Split = Math.round(rx + rw * 0.42);
  if (b2) textPanel(o, b2, palette, fonts, { x: rx, y: row2Y, w: row2Split - rx - GUT / 2, h: row2H, fill: palette.accent });
  o.push(slot(2, b2, { x: row2Split + GUT / 2, y: row2Y, w: W - row2Split - GUT / 2, h: row2H }, hintFor(b2), palette.primary));

  // row 3: point-3 light panel + CTA bar
  const row3Y = row2Y + row2H + GUT;
  const ctaH = 150;
  const row3H = H - row3Y - ctaH - GUT;
  if (b3) textPanel(o, b3, palette, fonts, { x: rx, y: row3Y, w: rw, h: row3H, fill: palette.background });
  ctaBar(o, content, palette, fonts, { x: rx, y: H - ctaH, w: rw, h: ctaH });
  return canvas;
}

function previewPortrait(palette) {
  const onP = pickTextColor(palette.primary);
  const parts = [
    pvRect(0, 0, pv(812), pv(620), palette.primary),
    pvBars({ x: pv(52), y: pv(80), w: pv(700), lines: 3, barH: 12, gap: 6, fill: onP }),
    pvSlot(pv(828), 0, pv(586), pv(620), palette.primary),
    pvSlot(0, pv(636), pv(558), pv(520), palette.accent),
    pvRect(pv(574), pv(636), pv(840), pv(520), palette.dark),
    pvBars({ x: pv(626), y: pv(760), w: pv(730), lines: 3, barH: 6, gap: 4, fill: pickTextColor(palette.dark) }),
    pvRect(0, pv(1172), pv(784), pv(420), palette.accent),
    pvBars({ x: pv(52), y: pv(1280), w: pv(660), lines: 3, barH: 6, gap: 4, fill: pickTextColor(palette.accent) }),
    pvSlot(pv(800), pv(1172), pv(614), pv(420), palette.primary),
    pvRect(0, pv(1608), 200, pv(220), palette.background),
    pvBars({ x: pv(52), y: pv(1670), w: pv(1310), lines: 2, barH: 6, gap: 4, fill: palette.dark }),
    pvRect(0, pv(1844), 200, pv(156), palette.dark),
    pvBars({ x: pv(300), y: pv(1900), w: pv(814), lines: 1, barH: 6, gap: 4, fill: pickTextColor(palette.dark), align: 'center' })
  ];
  return svgWrapO(parts, palette.dark, 'portrait');
}

function previewLandscape(palette) {
  const onP = pickTextColor(palette.primary);
  const parts = [
    pvRect(0, 0, pv(752), pv(820), palette.primary),
    pvBars({ x: pv(52), y: pv(90), w: pv(640), lines: 4, barH: 11, gap: 6, fill: onP }),
    pvSlot(0, pv(836), pv(752), pv(562), palette.primary),
    pvSlot(pv(768), 0, pv(730), pv(600), palette.accent),
    pvRect(pv(1514), 0, pv(486), pv(600), palette.dark),
    pvBars({ x: pv(1566), y: pv(120), w: pv(390), lines: 4, barH: 5, gap: 4, fill: pickTextColor(palette.dark) }),
    pvRect(pv(768), pv(616), pv(510), pv(450), palette.accent),
    pvBars({ x: pv(820), y: pv(720), w: pv(410), lines: 3, barH: 5, gap: 4, fill: pickTextColor(palette.accent) }),
    pvSlot(pv(1294), pv(616), pv(706), pv(450), palette.primary),
    pvRect(pv(768), pv(1082), pv(1232), pv(166), palette.background),
    pvRect(pv(768), pv(1264), pv(1232), pv(150), palette.dark),
    pvBars({ x: pv(1000), y: pv(1310), w: pv(770), lines: 1, barH: 6, gap: 4, fill: pickTextColor(palette.dark), align: 'center' })
  ];
  return svgWrapO(parts, palette.dark, 'landscape');
}

export default {
  id: 'split-collage',
  name: 'Split collage',
  style: 'statement',
  description: 'Asymmetric mondrian collage: butted colour panels and three content image slots at varied sizes carve up the canvas, with each image linked to the point it illustrates. Brand headline block anchors the hero; thin dark gutters keep the collage crisp. Hero row + interlocking bands in portrait; headline column plus collage field in landscape.',
  contentSchema: {
    headline: { required: true, maxWords: 8 },
    subheadline: { required: false, maxWords: 14 },
    blocks: { kind: 'cells', min: 3, max: 3, fields: ['text'] },
    callToAction: { required: true, maxWords: 10 },
    backgroundSlots: 1,
    imageSlots: 3
  },
  build: { portrait: buildPortrait, landscape: buildLandscape },
  preview: { portrait: previewPortrait, landscape: previewLandscape },
  editable: { background: true, perElementColor: true, fonts: true }
};
