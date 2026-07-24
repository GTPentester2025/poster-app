// Export mapping tests (Phase O9): the pure mapping core in ui/js/export.js
// (PosterExport._internals — px→inch/pt scaling, color/gradient flattening,
// slug/filename helpers, canvas→pptx spec, HTML builder) exercised under
// plain node against REAL template builds (templates/v2 buildCanvas +
// sampleContentFor), never the browser download paths. The module is a
// classic script guarded to assign globalThis.PosterExport outside a browser.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import '../../ui/js/export.js';
import { buildCanvas, listTemplatesV2, getTemplateV2, ORIENTATIONS } from '../../templates/v2/index.js';
import { sampleContentFor } from '../../templates/v2/manifest_schema.js';

const X = globalThis.PosterExport._internals;

function buildAll() {
  const out = [];
  for (const meta of listTemplatesV2()) {
    const t = getTemplateV2(meta.id);
    const content = sampleContentFor(t.contentSchema);
    for (const orientation of ORIENTATIONS) {
      out.push({ id: meta.id, orientation, canvas: buildCanvas(meta.id, orientation, content) });
    }
  }
  return out;
}

// ── environment guard ────────────────────────────────────────────────────────

test('module loads under node and exposes the API + internals', () => {
  const api = globalThis.PosterExport;
  assert.equal(typeof api.toPptx, 'function');
  assert.equal(typeof api.toHtml, 'function');
  assert.equal(typeof api.toJpeg, 'function');
  assert.equal(typeof api.downloadBlob, 'function');
  assert.equal(typeof api._internals.mapCanvasToPptx, 'function');
});

// ── slug / filename helpers ──────────────────────────────────────────────────

test('slugify: lowercase, collapse punctuation, strip diacritics, never empty', () => {
  assert.equal(X.slugify("Phishing: Don't Take the Bait!"), 'phishing-dont-take-the-bait');
  assert.equal(X.slugify('  Café  Sécurité  '), 'cafe-securite');
  assert.equal(X.slugify('MFA — why it matters'), 'mfa-why-it-matters');
  assert.equal(X.slugify(''), 'poster');
  assert.equal(X.slugify(null), 'poster');
});

test('exportFileName: name-orientation-lang.ext', () => {
  assert.equal(X.exportFileName('Spot the Phish', 'portrait', 'en', 'pptx'), 'spot-the-phish-portrait-en.pptx');
  assert.equal(X.exportFileName('Spot the Phish', 'landscape', 'pt-BR', 'jpg'), 'spot-the-phish-landscape-pt-br.jpg');
  assert.equal(X.exportFileName('Spot the Phish', 'portrait', 'de', 'html'), 'spot-the-phish-portrait-de.html');
});

// ── px→inch / px→pt scaling ──────────────────────────────────────────────────

test('scale contract: 200 canvas px per inch in BOTH orientations', () => {
  assert.equal(X.pxPerInch(1414, 'portrait'), 1414 / 7.07);
  assert.equal(X.pxPerInch(2000, 'landscape'), 200);
  assert.ok(Math.abs(X.pxPerInch(1414, 'portrait') - 200) < 1e-9);
});

test('pxToIn / pxToPt: full width → slide width; 100px font → 36pt', () => {
  const ppi = X.pxPerInch(1414, 'portrait');
  assert.equal(X.pxToIn(1414, ppi), 7.07);
  assert.equal(X.pxToIn(2000, X.pxPerInch(2000, 'landscape')), 10);
  assert.equal(X.pxToPt(100, ppi), 36);   // 100 * 72/200
  assert.equal(X.pxToPt(50, ppi), 18);
});

// ── color / gradient mapping ─────────────────────────────────────────────────

test('normHex: #rrggbb, #rgb, rgb(), transparent/none/invalid', () => {
  assert.equal(X.normHex('#1F6FEB'), '1F6FEB');
  assert.equal(X.normHex('#f80'), 'FF8800');
  assert.equal(X.normHex('rgb(255, 0, 128)'), 'FF0080');
  assert.equal(X.normHex('rgba(0, 10, 20, 0.5)'), '000A14');
  assert.equal(X.normHex('transparent'), null);
  assert.equal(X.normHex('none'), null);
  assert.equal(X.normHex(''), null);
  assert.equal(X.normHex(undefined), null);
});

test('gradient fill → first color stop (documented pptx flattening)', () => {
  const fill = {
    type: 'linear', gradientUnits: 'pixels',
    coords: { x1: 0, y1: 0, x2: 1414, y2: 2000 },
    colorStops: [{ offset: 1, color: '#00FF00' }, { offset: 0, color: '#102A43' }]
  };
  assert.ok(X.isGradientFill(fill));
  assert.equal(X.firstStopColor(fill), '#102A43'); // sorted by offset, not array order
  assert.equal(X.solidColor(fill), '102A43');
  assert.equal(X.solidColor('#ABCDEF'), 'ABCDEF');
  assert.ok(!X.isGradientFill('#ABCDEF'));
});

test('gradientCss: real CSS linear-gradient with angle + percent stops', () => {
  const vertical = {
    type: 'linear', coords: { x1: 0, y1: 0, x2: 0, y2: 2000 },
    colorStops: [{ offset: 0, color: '#102A43' }, { offset: 1, color: '#1F6FEB' }]
  };
  assert.equal(X.gradientCss(vertical), 'linear-gradient(180deg, #102A43 0%, #1F6FEB 100%)');
  const horizontal = {
    type: 'linear', coords: { x1: 0, y1: 0, x2: 2000, y2: 0 },
    colorStops: [{ offset: 0, color: '#102A43' }, { offset: 1, color: '#1F6FEB' }]
  };
  assert.ok(X.gradientCss(horizontal).startsWith('linear-gradient(90deg'));
});

test('boldFrom: numeric >= 600 or bold keyword', () => {
  assert.equal(X.boldFrom('800'), true);
  assert.equal(X.boldFrom(700), true);
  assert.equal(X.boldFrom(600), true);
  assert.equal(X.boldFrom('bold'), true);
  assert.equal(X.boldFrom('normal'), false);
  assert.equal(X.boldFrom(400), false);
  assert.equal(X.boldFrom(undefined), false);
});

// ── opacity rules ────────────────────────────────────────────────────────────

test('pptx opacity rule: <0.06 skipped, otherwise fill transparency = (1-opacity)*100', () => {
  const wash = { type: 'Rect', left: 0, top: 0, width: 100, height: 100, fill: '#112233', opacity: 0.05 };
  assert.equal(X.mapShapeObj(wash, 200), null, 'sub-6% wash skipped');

  const faint = { ...wash, opacity: 0.1 };
  const spec = X.mapShapeObj(faint, 200);
  assert.equal(spec.kind, 'shape');
  assert.equal(spec.options.fill.transparency, 90);
  assert.equal(spec.options.fill.color, '112233');

  const solid = { ...wash, opacity: 1 };
  assert.equal(X.mapShapeObj(solid, 200).options.fill.transparency, 0);
});

test('stroke-only shapes get a 100%-transparent fill (never theme default)', () => {
  const ring = {
    type: 'Circle', left: 10, top: 10, radius: 50,
    fill: 'transparent', stroke: '#FF0000', strokeWidth: 4, opacity: 0.5
  };
  const spec = X.mapShapeObj(ring, 200);
  assert.equal(spec.shapeType, 'ellipse');
  assert.equal(spec.options.fill.transparency, 100);
  assert.equal(spec.options.line.color, 'FF0000');
  assert.equal(spec.options.line.transparency, 50);
  assert.equal(spec.options.w, X.pxToIn(100, 200));
});

// ── shape approximations ─────────────────────────────────────────────────────

test('polygon → bounding-box rect (documented approximation)', () => {
  const tri = {
    type: 'Polygon', left: 100, top: 200, width: 300, height: 400,
    points: [{ x: 100, y: 600 }, { x: 250, y: 200 }, { x: 400, y: 600 }],
    fill: '#334455', opacity: 0.2
  };
  const spec = X.mapShapeObj(tri, 200);
  assert.equal(spec.shapeType, 'rect');
  assert.equal(spec.options.x, 0.5);   // 100/200
  assert.equal(spec.options.y, 1);     // 200/200
  assert.equal(spec.options.w, 1.5);   // 300/200
  assert.equal(spec.options.h, 2);     // 400/200
  assert.equal(spec.options.fill.color, '334455');
});

test('rounded rect → roundRect with rectRadius; dashed stroke → dashType dash', () => {
  const r = {
    type: 'Rect', left: 0, top: 0, width: 200, height: 100, rx: 20, ry: 20,
    fill: '#FFFFFF', stroke: '#000000', strokeWidth: 2, strokeDashArray: [14, 10]
  };
  const spec = X.mapShapeObj(r, 200);
  assert.equal(spec.shapeType, 'roundRect');
  assert.equal(spec.options.rectRadius, 0.1);
  assert.equal(spec.options.line.dashType, 'dash');
});

// ── image mapping ────────────────────────────────────────────────────────────

test('image object → image spec with src passthrough and scaled box', () => {
  const img = {
    type: 'Image', left: 200, top: 400, width: 600, height: 400,
    src: '/api/images/file/img-123', layerRole: 'image', slotId: 'slot-1'
  };
  const spec = X.mapImageObj(img, 200);
  assert.equal(spec.kind, 'image');
  assert.equal(spec.src, '/api/images/file/img-123');
  assert.deepEqual(
    [spec.options.x, spec.options.y, spec.options.w, spec.options.h],
    [1, 2, 3, 2]
  );
  // editor-scaled image: natural dims * scale
  const scaled = { ...img, width: 1200, height: 800, scaleX: 0.5, scaleY: 0.5 };
  const s2 = X.mapImageObj(scaled, 200);
  assert.deepEqual([s2.options.w, s2.options.h], [3, 2]);
});

// ── real template builds through the full canvas→pptx mapping ────────────────

test('every v2 template x both orientations: Textboxes → finite in-bounds text specs', () => {
  for (const { id, orientation, canvas } of buildAll()) {
    const spec = X.mapCanvasToPptx(canvas, orientation);
    const label = `${id}/${orientation}`;
    const slide = X.SLIDE_IN[orientation];

    assert.equal(spec.layout.width, slide.w, `${label}: layout width`);
    assert.equal(spec.layout.height, slide.h, `${label}: layout height`);
    assert.ok(Math.abs(spec.ppi - 200) < 1e-9, `${label}: 200 px/in`);
    assert.ok(spec.items.length > 0, `${label}: produces items`);

    const textboxes = canvas.objects.filter((o) => o.type === 'Textbox' && String(o.text).trim());
    const textSpecs = spec.items.filter((i) => i.kind === 'text');
    assert.equal(textSpecs.length, textboxes.length, `${label}: every non-blank Textbox exported as text`);

    for (const t of textSpecs) {
      for (const k of ['x', 'y', 'w', 'h', 'fontSize']) {
        assert.ok(Number.isFinite(t.options[k]), `${label}: text ${k} finite`);
      }
      assert.ok(t.options.x >= -0.01 && t.options.y >= -0.01, `${label}: text origin in-bounds`);
      assert.ok(t.options.x + t.options.w <= slide.w + 0.01, `${label}: text fits slide width`);
      assert.ok(t.options.fontSize > 0, `${label}: positive font size`);
      assert.match(t.options.color, /^[0-9A-F]{6}$/, `${label}: text color is 6-hex`);
      assert.equal(typeof t.options.fontFace, 'string');
      assert.ok(t.options.fontFace.length > 0, `${label}: fontFace mapped`);
      assert.ok(['left', 'center', 'right', 'justify'].includes(t.options.align), `${label}: align mapped`);
      assert.equal(typeof t.options.bold, 'boolean', `${label}: bold mapped`);
      assert.equal(t.options.rotate, undefined, `${label}: template text is unrotated`);
    }
  }
});

test('pixel-faithful: slide layout derives from the CANVAS dims, not the orientation label', () => {
  // a portrait canvas exported under a stale "landscape" selection must still
  // produce a portrait 7.07x10 slide — nothing may spill off the slide
  const canvas = buildCanvas('timeline-journey', 'portrait',
    sampleContentFor(getTemplateV2('timeline-journey').contentSchema));
  const spec = X.mapCanvasToPptx(canvas, 'landscape'); // wrong label on purpose
  assert.equal(spec.layout.width, 7.07, 'width follows the canvas (1414px/200)');
  assert.equal(spec.layout.height, 10, 'height follows the canvas (2000px/200)');
  assert.ok(Math.abs(spec.ppi - 200) < 1e-9);
  for (const t of spec.items.filter((i) => i.kind === 'text')) {
    assert.ok(t.options.y + t.options.h <= 10 + 0.5, 'no text maps below the slide');
  }
});

test('z-order preserved: item sequence follows canvas objects array order', () => {
  const canvas = buildCanvas('timeline-journey', 'portrait',
    sampleContentFor(getTemplateV2('timeline-journey').contentSchema));
  const spec = X.mapCanvasToPptx(canvas, 'portrait');

  // reconstruct the expected order by mapping each object independently
  const ppi = X.pxPerInch(canvas.width, 'portrait');
  const expected = canvas.objects.map((o) => X.mapObject(o, ppi)).filter(Boolean);
  assert.equal(spec.items.length, expected.length);
  assert.deepEqual(spec.items.map((i) => i.kind), expected.map((i) => i.kind));
  // text content order matches exactly (labels/headline/messages in build order)
  assert.deepEqual(
    spec.items.filter((i) => i.kind === 'text').map((i) => i.text),
    canvas.objects.filter((o) => o.type === 'Textbox' && String(o.text).trim()).map((o) => o.text)
  );
});

test('real gradient washes flatten to their first stop; shapes finite in-bounds', () => {
  let gradientSeen = 0;
  for (const { id, orientation, canvas } of buildAll()) {
    const spec = X.mapCanvasToPptx(canvas, orientation);
    for (const s of spec.items.filter((i) => i.kind === 'shape')) {
      for (const k of ['x', 'y', 'w', 'h']) {
        assert.ok(Number.isFinite(s.options[k]), `${id}/${orientation}: shape ${k} finite`);
      }
      assert.match(s.options.fill.color, /^[0-9A-F]{6}$/, `${id}/${orientation}: shape fill hex`);
      assert.ok(s.options.fill.transparency >= 0 && s.options.fill.transparency <= 100);
    }
    // the gradient wash Rects present in the build must flatten to stop[0]
    for (const o of canvas.objects) {
      if (o.type !== 'Rect' || !X.isGradientFill(o.fill)) continue;
      gradientSeen++;
      const mapped = X.mapShapeObj(o, spec.ppi);
      if (mapped) {
        assert.equal(mapped.options.fill.color, X.normHex(o.fill.colorStops[0].color),
          `${id}/${orientation}: gradient → first stop`);
      }
    }
  }
  assert.ok(gradientSeen > 0, 'template set actually exercises gradient fills');
});

test('canvas background maps to slide background hex', () => {
  const canvas = buildCanvas('qa-chat', 'landscape',
    sampleContentFor(getTemplateV2('qa-chat').contentSchema));
  const spec = X.mapCanvasToPptx(canvas, 'landscape');
  assert.equal(spec.background, X.normHex(canvas.background));
  assert.match(spec.background, /^[0-9A-F]{6}$/);
});

// ── HTML builder (pure string output) ────────────────────────────────────────

test('buildHtmlDocument: self-contained, selectable escaped text, gradients, data URIs', () => {
  const canvas = buildCanvas('statement-bold', 'portrait',
    sampleContentFor(getTemplateV2('statement-bold').contentSchema));
  // graft a fixture image object to exercise the data-URI path
  canvas.objects.push({
    type: 'Image', left: 100, top: 100, width: 400, height: 300,
    src: '/api/images/file/img-42', layerRole: 'image', slotId: 'slot-x'
  });
  const dataUri = 'data:image/png;base64,iVBORw0KGgo=';
  const html = X.buildHtmlDocument({
    canvasJSON: canvas, orientation: 'portrait',
    name: 'Think <Before> You Click', lang: 'en',
    images: { '/api/images/file/img-42': dataUri }
  });

  assert.ok(html.startsWith('<!DOCTYPE html>'));
  assert.ok(html.includes('<title>Think &lt;Before&gt; You Click (portrait, en)</title>'), 'escaped title');
  assert.ok(html.includes('width: 1414px; height: 2000px'), 'poster at canvas dims');
  const headline = canvas.objects.find((o) => o.layerRole === 'headline');
  assert.ok(html.includes(X.escapeHtml(headline.text)), 'headline text present (selectable)');
  assert.ok(html.includes('linear-gradient('), 'gradient wash kept as CSS gradient');
  assert.ok(html.includes(dataUri), 'image inlined as base64 data URI');
  assert.ok(!html.includes('src="/api/images/file/'), 'no session-bound srcs left behind');
  assert.ok(html.includes('@media print'), 'print stylesheet present');
  assert.ok(html.includes('pre-wrap'), 'text divs preserve line breaks');
});

test('objectHtml: low-opacity decor KEPT in HTML at true opacity (pptx-only skip rule)', () => {
  const wash = { type: 'Rect', left: 0, top: 0, width: 100, height: 100, fill: '#112233', opacity: 0.05 };
  const frag = X.objectHtml(wash, {});
  assert.ok(frag && frag.includes('opacity:0.05'), 'HTML keeps sub-6% decor');
  assert.equal(X.mapShapeObj(wash, 200), null, 'pptx skips the same object');
});

test('objectHtml: polygon keeps its silhouette via clip-path', () => {
  const tri = {
    type: 'Polygon', left: 100, top: 200, width: 300, height: 400,
    points: [{ x: 100, y: 600 }, { x: 250, y: 200 }, { x: 400, y: 600 }],
    fill: '#334455'
  };
  const frag = X.objectHtml(tri, {});
  assert.ok(frag.includes('clip-path:polygon(0% 100%, 50% 0%, 100% 100%)'), frag);
});

test('mapTextbox: autofit shrink keeps substituted fonts inside their box', () => {
  const tb = { type: 'Textbox', text: 'Stay alert', left: 100, top: 100, width: 600, fontSize: 60 };
  const spec = X.mapTextbox(tb, 200);
  // 'shrink' → PowerPoint scales overflowing (font-substituted) text down to fit
  assert.equal(spec.options.fit, 'shrink');
  assert.equal(spec.options.wrap, true);
});

// ── text height estimation ───────────────────────────────────────────────────

test('textHeightPx: serialized height wins; otherwise wrap estimate scales with text', () => {
  const withHeight = { type: 'Textbox', text: 'Hello', width: 400, height: 120, fontSize: 40 };
  assert.equal(X.textHeightPx(withHeight), 120);

  const short = { type: 'Textbox', text: 'Hello', width: 800, fontSize: 40, lineHeight: 1.16 };
  const long = { ...short, text: 'Hello '.repeat(40).trim() };
  assert.ok(X.textHeightPx(long) > X.textHeightPx(short), 'longer copy → taller estimate');
  assert.equal(X.textHeightPx(short), 40 * 1.16, 'single line = fontSize * lineHeight');
  const multiline = { ...short, text: 'a\nb\nc' };
  assert.equal(X.textHeightPx(multiline), 3 * 40 * 1.16, 'explicit newlines counted');
});
