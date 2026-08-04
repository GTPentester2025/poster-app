// Export engine (Phase O9). window.PosterExport — fully client-side exports
// from a poster's canvas JSON (design.canvas / design.landscapeCanvas / a
// translation variant's canvas): PPTX with REAL editable text boxes, a
// self-contained HTML file with selectable text, and a full-resolution JPEG.
//
// Architecture: the MAPPING CORE (canvas object → pptx/html spec) is pure and
// environment-free — no window/document/fetch inside any mapping function —
// exposed on PosterExport._internals so tests/unit/export-mapping.test.js can
// exercise it under plain node against real template builds. Only the three
// to*() download paths and their helpers touch the browser (fetch/DOM/fabric).
//
// Sizing contract: the pptx slide is a custom layout at the poster's aspect —
// portrait 7.07x10in, landscape 10x7.07in. Both work out to exactly
// 200 canvas px per inch (1414/7.07 = 2000/10 = 200), so px→in is px/200 and
// font px→pt is px * 72/200 = px * 0.36.
//
// Documented approximations / rules (see mapShapeObj):
// - GRADIENT fills (fabric serialized {colorStops}) → pptx solid fill using
//   the FIRST color stop (pptx gradient support isn't worth the fidelity —
//   template washes sit at opacity <= 0.15 where a solid tint is
//   indistinguishable). HTML export keeps the real CSS linear-gradient.
// - Polygons → pptx rect over the polygon's bounding box with the same fill
//   (pptxgenjs has no freeform point shape). HTML export keeps the true
//   silhouette via CSS clip-path.
// - Low-opacity decor: objects keep their transparency in pptx
//   (fill/line transparency = (1-opacity)*100%), EXCEPT objects below
//   opacity 0.06 which are skipped — sub-6% washes are invisible in print
//   and only bloat the deck. HTML and JPEG keep every object at true opacity.
// - Textbox charSpacing maps to pptx letter tracking (charSpacing pt =
//   (fabric charSpacing / 1000) * fontSizePt); also kept as CSS letter-spacing
//   in HTML.

(function () {
  'use strict';

  // ── constants (mirrors of the design contract) ─────────────────────────────

  const DIMS = {
    portrait: { w: 1414, h: 2000 },
    landscape: { w: 2000, h: 1414 }
  };
  const SLIDE_IN = {
    portrait: { w: 7.07, h: 10 },
    landscape: { w: 10, h: 7.07 }
  };
  const MIN_EXPORT_OPACITY = 0.06; // pptx skip threshold (see header)
  const AVG_CHAR_W = 0.54;         // templates/helpers.js estimation constant
  const DEFAULT_LINE_HEIGHT = 1.16;
  // custom-prop reattach list — the preview_engine/editor_page idiom
  const EXTRA_PROPS = ['layerRole', 'msgId', 'slotId', 'slotSpec', 'imageId', 'bgRef', 'extraId', 'fieldRef'];

  // ── pure mapping core (environment-free; exposed via _internals) ───────────

  /** 'Phishing: Don't Take the Bait!' → 'phishing-dont-take-the-bait' */
  function slugify(s) {
    return String(s == null ? '' : s)
      .normalize('NFKD').replace(/[̀-ͯ]/g, '') // strip diacritics
      .toLowerCase()
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      || 'poster';
  }

  /** `${name}-${orientation}-${lang}.${ext}`, slugified. */
  function exportFileName(name, orientation, lang, ext) {
    return `${slugify(name)}-${slugify(orientation)}-${slugify(lang)}.${ext}`;
  }

  /** Canvas px per slide inch for an orientation (200 by the contract). */
  function pxPerInch(canvasW, orientation) {
    return (canvasW || DIMS[orientation].w) / SLIDE_IN[orientation].w;
  }

  function pxToIn(px, ppi) {
    return Math.round((px / ppi) * 1000) / 1000;
  }

  /** Font px → pt through the same scale (px * 72 / ppi). */
  function pxToPt(px, ppi) {
    return Math.round(px * (72 / ppi) * 10) / 10;
  }

  /**
   * Any CSS-ish solid color → 'RRGGBB' (uppercase, no '#'), or null when it
   * isn't a solid paintable color ('', 'transparent', 'none', unknown).
   */
  function normHex(color) {
    if (typeof color !== 'string') return null;
    const c = color.trim();
    if (!c || /^(transparent|none)$/i.test(c)) return null;
    let m = /^#([0-9a-f]{6})$/i.exec(c);
    if (m) return m[1].toUpperCase();
    m = /^#([0-9a-f]{3})$/i.exec(c);
    if (m) return m[1].split('').map((ch) => ch + ch).join('').toUpperCase();
    m = /^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i.exec(c);
    if (m) {
      return [m[1], m[2], m[3]]
        .map((n) => Math.max(0, Math.min(255, Number(n))).toString(16).padStart(2, '0'))
        .join('').toUpperCase();
    }
    return null;
  }

  /** Serialized fabric Gradient fill? ({type:'linear'|'radial', colorStops}) */
  function isGradientFill(fill) {
    return !!(fill && typeof fill === 'object' && Array.isArray(fill.colorStops) && fill.colorStops.length);
  }

  /** Gradient → its first color stop (the documented pptx approximation). */
  function firstStopColor(fill) {
    const stops = fill.colorStops.slice().sort((a, b) => (a.offset || 0) - (b.offset || 0));
    return stops[0].color;
  }

  /** Solid 'RRGGBB' for any fill value (gradient → first stop), or null. */
  function solidColor(fill) {
    if (isGradientFill(fill)) return normHex(firstStopColor(fill));
    return normHex(fill);
  }

  /**
   * Serialized linear gradient → CSS linear-gradient(). Angle from the pixel
   * coords (CSS 0deg points up, so +90 on atan2 of the vector).
   */
  function gradientCss(fill) {
    const c = fill.coords || { x1: 0, y1: 0, x2: 1, y2: 1 };
    const deg = Math.round(Math.atan2((c.y2 || 0) - (c.y1 || 0), (c.x2 || 0) - (c.x1 || 0)) * 180 / Math.PI) + 90;
    const stops = fill.colorStops
      .slice().sort((a, b) => (a.offset || 0) - (b.offset || 0))
      .map((s) => `${s.color} ${Math.round((s.offset || 0) * 100)}%`)
      .join(', ');
    return `linear-gradient(${deg}deg, ${stops})`;
  }

  /** fontWeight >= 600 (or 'bold') → bold. */
  function boldFrom(fontWeight) {
    if (fontWeight == null) return false;
    if (typeof fontWeight === 'string' && /^bold(er)?$/i.test(fontWeight.trim())) return true;
    const n = parseInt(fontWeight, 10);
    return Number.isFinite(n) && n >= 600;
  }

  function alignFrom(textAlign) {
    return ['left', 'center', 'right', 'justify'].includes(textAlign) ? textAlign : 'left';
  }

  function objOpacity(obj) {
    const n = Number(obj.opacity);
    return Number.isFinite(n) ? Math.max(0, Math.min(1, n)) : 1;
  }

  /** pptx transparency percent from opacity. */
  function transparencyPct(opacity) {
    return Math.round((1 - opacity) * 100);
  }

  // effective box (fabric scaleX/scaleY aware — editor-serialized objects
  // carry natural dims * scale; template JSON has scale 1)
  function effW(obj) { return (obj.width || 0) * (obj.scaleX || 1); }
  function effH(obj) { return (obj.height || 0) * (obj.scaleY || 1); }

  /** Greedy word-wrap estimate (templates/helpers.js idiom), \n aware. */
  function estLines(text, fontSize, width) {
    const maxChars = Math.max(4, Math.floor(width / (fontSize * AVG_CHAR_W)));
    let lines = 0;
    for (const seg of String(text).split('\n')) {
      const words = seg.trim().split(/\s+/).filter(Boolean);
      if (!words.length) { lines += 1; continue; }
      let segLines = 1;
      let lineLen = 0;
      for (const word of words) {
        const add = lineLen === 0 ? word.length : word.length + 1;
        if (lineLen + add > maxChars && lineLen > 0) { segLines += 1; lineLen = word.length; }
        else lineLen += add;
      }
      lines += segLines;
    }
    return Math.max(1, lines);
  }

  /** Textbox render height in canvas px: serialized height, else estimate. */
  function textHeightPx(obj) {
    if (typeof obj.height === 'number' && obj.height > 0) return effH(obj);
    const fontSize = obj.fontSize || 40;
    const lh = obj.lineHeight || DEFAULT_LINE_HEIGHT;
    return estLines(obj.text || '', fontSize, effW(obj) || 1) * fontSize * lh;
  }

  /** Textbox → pptx addText spec, or null for blank text. */
  function mapTextbox(obj, ppi) {
    const text = typeof obj.text === 'string' ? obj.text : '';
    if (!text.trim()) return null;
    const opacity = objOpacity(obj);
    if (opacity < MIN_EXPORT_OPACITY) return null;
    const options = {
      x: pxToIn(obj.left || 0, ppi),
      y: pxToIn(obj.top || 0, ppi),
      w: pxToIn(effW(obj), ppi),
      h: pxToIn(textHeightPx(obj), ppi),
      fontFace: obj.fontFamily || 'Arial',
      fontSize: pxToPt((obj.fontSize || 40) * (obj.scaleY || 1), ppi),
      bold: boldFrom(obj.fontWeight),
      color: solidColor(obj.fill) || '000000',
      align: alignFrom(obj.textAlign),
      valign: 'top',
      margin: 0,
      // Shrink-to-fit: a viewer's PowerPoint may lack the template font and
      // substitute a wider one; without autofit the substituted text overflows
      // its box and collides with neighbours. 'shrink' makes PowerPoint scale it
      // down to the box instead — the layout stays intact on any machine.
      fit: 'shrink',
      wrap: true,
      lineSpacingMultiple: obj.lineHeight || DEFAULT_LINE_HEIGHT
    };
    // charSpacing (letter tracking): fabric stores it in 1/1000 em; pptxgenjs
    // addText takes points. points = (charSpacing/1000) * fontSizePt. Headlines
    // that were tracked tight/wide in-template now read the same in the deck.
    if (obj.charSpacing) {
      options.charSpacing = Math.round((obj.charSpacing / 1000) * options.fontSize * 100) / 100;
    }
    if (obj.angle) options.rotate = Math.round(obj.angle);
    return { kind: 'text', text, options };
  }

  /**
   * Rect/Circle/Polygon → pptx addShape spec, or null (skipped: opacity below
   * MIN_EXPORT_OPACITY, or nothing paintable). Polygons approximate to their
   * bounding-box rect; gradients flatten to the first stop (see header).
   */
  function mapShapeObj(obj, ppi) {
    const opacity = objOpacity(obj);
    if (opacity < MIN_EXPORT_OPACITY) return null;

    const fillHex = solidColor(obj.fill);
    const lineHex = normHex(obj.stroke);
    if (!fillHex && !lineHex) return null; // nothing paintable

    let shapeType = 'rect';
    let x = obj.left || 0;
    let y = obj.top || 0;
    let w = effW(obj);
    let h = effH(obj);
    const options = {};

    if (obj.type === 'Circle') {
      shapeType = 'ellipse';
      const r = obj.radius || 0;
      w = r * 2 * (obj.scaleX || 1);
      h = r * 2 * (obj.scaleY || 1);
    } else if (obj.type === 'Rect' && obj.rx) {
      shapeType = 'roundRect';
      options.rectRadius = pxToIn(obj.rx, ppi);
    }
    // Polygon (and anything rect-like) falls through as 'rect' over its bbox.

    options.x = pxToIn(x, ppi);
    options.y = pxToIn(y, ppi);
    options.w = pxToIn(w, ppi);
    options.h = pxToIn(h, ppi);

    const transparency = transparencyPct(opacity);
    // stroke-only shapes (fill 'transparent') get a fully transparent fill —
    // omitting `fill` would fall back to the pptx theme's default blue
    options.fill = fillHex
      ? { color: fillHex, transparency }
      : { color: lineHex, transparency: 100 };
    if (lineHex) {
      options.line = {
        color: lineHex,
        width: pxToPt(obj.strokeWidth || 1, ppi),
        transparency,
        ...(Array.isArray(obj.strokeDashArray) && obj.strokeDashArray.length ? { dashType: 'dash' } : {})
      };
    }
    if (obj.angle) options.rotate = Math.round(obj.angle);
    return { kind: 'shape', shapeType, options };
  }

  /** Image → pptx addImage spec (src fetched by the browser layer). */
  function mapImageObj(obj, ppi) {
    if (!obj.src) return null;
    const opacity = objOpacity(obj);
    if (opacity < MIN_EXPORT_OPACITY) return null;
    const options = {
      x: pxToIn(obj.left || 0, ppi),
      y: pxToIn(obj.top || 0, ppi),
      w: pxToIn(effW(obj), ppi),
      h: pxToIn(effH(obj), ppi)
    };
    if (opacity < 1) options.transparency = transparencyPct(opacity);
    if (obj.angle) options.rotate = Math.round(obj.angle);
    return { kind: 'image', src: obj.src, options };
  }

  /** One canvas object → pptx item spec (or null = skipped). */
  function mapObject(obj, ppi) {
    if (!obj || typeof obj !== 'object') return null;
    switch (obj.type) {
      case 'Textbox': case 'IText': case 'Text': return mapTextbox(obj, ppi);
      case 'Rect': case 'Circle': case 'Polygon': case 'Triangle': case 'Ellipse':
        return mapShapeObj(obj, ppi);
      case 'Image': return mapImageObj(obj, ppi);
      default: return null; // unknown types never break an export
    }
  }

  /**
   * Full canvas JSON → pptx slide spec: custom layout dims, background hex,
   * ordered items (canvas objects array order = z-order = pptx add order).
   */
  /**
   * Pixel-faithful contract: the slide layout is derived from the ACTUAL
   * canvas dims at 200 px/inch — never from the orientation label alone.
   * A portrait canvas exported under a stale "landscape" selection used to
   * get a 10x7.07in slide with a 14.1in-tall mapping: everything below the
   * fold spilled off the slide. Deriving from the canvas makes the deck
   * match the preview exactly regardless of what the caller labels it.
   *
   * `fit` (optional {w,h} in inches): map INTO that fixed slide size instead —
   * scale to fit entirely (never crop) and center with equal margins. Used by
   * the both-orientations deck, where PPTX format forces ONE slide size for
   * the whole file, so the portrait slide letterboxes on the landscape layout.
   */
  function mapCanvasToPptx(canvasJSON, orientation, fit = null) {
    const canvasW = canvasJSON.width || DIMS[orientation].w;
    const canvasH = canvasJSON.height || DIMS[orientation].h;
    const ppi = fit
      ? Math.max(canvasW / fit.w, canvasH / fit.h)
      : 200; // the design contract: 1414/7.07 = 2000/10 = 200 px/in
    const ox = fit ? Math.round(((fit.w - canvasW / ppi) / 2) * 1000) / 1000 : 0;
    const oy = fit ? Math.round(((fit.h - canvasH / ppi) / 2) * 1000) / 1000 : 0;
    const items = [];
    for (const obj of canvasJSON.objects || []) {
      const item = mapObject(obj, ppi);
      if (!item) continue;
      if (ox || oy) {
        item.options.x = Math.round((item.options.x + ox) * 1000) / 1000;
        item.options.y = Math.round((item.options.y + oy) * 1000) / 1000;
      }
      items.push(item);
    }
    return {
      layout: fit
        ? { name: 'POSTER', width: fit.w, height: fit.h }
        : {
          name: 'POSTER',
          width: Math.round((canvasW / ppi) * 100) / 100,
          height: Math.round((canvasH / ppi) * 100) / 100
        },
      background: normHex(canvasJSON.background),
      ppi,
      offset: { x: ox, y: oy },
      items
    };
  }

  // ── pure HTML builder ───────────────────────────────────────────────────────

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function styleAttr(pairs) {
    return Object.entries(pairs)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}:${v}`)
      .join(';');
  }

  function transformCss(obj) {
    const parts = [];
    if (obj.angle) parts.push(`rotate(${obj.angle}deg)`);
    if (obj.skewX) parts.push(`skewX(${obj.skewX}deg)`);
    return parts.length ? parts.join(' ') : null;
  }

  function baseCss(obj, w, h) {
    return {
      position: 'absolute',
      left: `${Math.round((obj.left || 0) * 100) / 100}px`,
      top: `${Math.round((obj.top || 0) * 100) / 100}px`,
      width: w != null ? `${Math.round(w * 100) / 100}px` : null,
      height: h != null ? `${Math.round(h * 100) / 100}px` : null,
      opacity: objOpacity(obj) < 1 ? String(objOpacity(obj)) : null,
      transform: transformCss(obj),
      'transform-origin': (obj.angle || obj.skewX) ? '0 0' : null
    };
  }

  /** CSS background value for a fill (gradient stays a real gradient). */
  function fillCss(fill) {
    if (isGradientFill(fill)) return gradientCss(fill);
    const hex = normHex(fill);
    return hex ? `#${hex}` : 'transparent';
  }

  /** One canvas object → an absolutely-positioned HTML fragment (or null). */
  function objectHtml(obj, images) {
    if (!obj || typeof obj !== 'object') return null;

    if (obj.type === 'Textbox' || obj.type === 'IText' || obj.type === 'Text') {
      const text = typeof obj.text === 'string' ? obj.text : '';
      if (!text.trim()) return null;
      const css = {
        ...baseCss(obj, effW(obj), null),
        'font-family': `'${obj.fontFamily || 'Arial'}', sans-serif`,
        'font-size': `${(obj.fontSize || 40) * (obj.scaleY || 1)}px`,
        'font-weight': obj.fontWeight ? String(obj.fontWeight) : null,
        color: `#${solidColor(obj.fill) || '000000'}`,
        'text-align': alignFrom(obj.textAlign),
        'line-height': String(obj.lineHeight || DEFAULT_LINE_HEIGHT),
        'letter-spacing': obj.charSpacing ? `${obj.charSpacing / 1000}em` : null,
        'white-space': 'pre-wrap',
        'overflow-wrap': 'break-word'
      };
      return `<div style="${styleAttr(css)}">${escapeHtml(text)}</div>`;
    }

    if (obj.type === 'Rect' || obj.type === 'Circle' || obj.type === 'Polygon') {
      let w = effW(obj);
      let h = effH(obj);
      const css = { background: fillCss(obj.fill) };
      if (obj.type === 'Circle') {
        const r = obj.radius || 0;
        w = r * 2 * (obj.scaleX || 1);
        h = r * 2 * (obj.scaleY || 1);
        css['border-radius'] = '50%';
      } else if (obj.rx) {
        css['border-radius'] = `${obj.rx}px`;
      }
      if (obj.type === 'Polygon' && Array.isArray(obj.points) && obj.points.length >= 3 && w > 0 && h > 0) {
        // true silhouette via clip-path (points are canvas-space; normalize
        // into the bounding box as percentages)
        const minX = Math.min(...obj.points.map((p) => p.x));
        const minY = Math.min(...obj.points.map((p) => p.y));
        css['clip-path'] = 'polygon(' + obj.points
          .map((p) => `${Math.round(((p.x - minX) / w) * 1000) / 10}% ${Math.round(((p.y - minY) / h) * 1000) / 10}%`)
          .join(', ') + ')';
      }
      const stroke = normHex(obj.stroke);
      if (stroke && obj.strokeWidth) {
        css.border = `${obj.strokeWidth}px ${Array.isArray(obj.strokeDashArray) && obj.strokeDashArray.length ? 'dashed' : 'solid'} #${stroke}`;
        css['box-sizing'] = 'border-box';
      }
      return `<div style="${styleAttr({ ...baseCss(obj, w, h), ...css })}"></div>`;
    }

    if (obj.type === 'Image' && obj.src) {
      const src = (images && images[obj.src]) || obj.src;
      const css = { ...baseCss(obj, effW(obj), effH(obj)), 'object-fit': 'cover' };
      return `<img src="${escapeHtml(src)}" alt="" style="${styleAttr(css)}">`;
    }

    return null;
  }

  /**
   * Self-contained poster HTML document. `images` maps canvas src → base64
   * data URI (the browser layer pre-fetches them); text stays selectable,
   * gradients stay real CSS gradients, a tiny script scales the fixed-px
   * poster to the viewport, and a minimal print stylesheet fits it to a page.
   */
  function buildHtmlDocument({ canvasJSON, orientation, name, lang, images }) {
    const w = canvasJSON.width || DIMS[orientation].w;
    const h = canvasJSON.height || DIMS[orientation].h;
    const bg = fillCss(canvasJSON.background || '#FFFFFF');
    const body = (canvasJSON.objects || [])
      .map((obj) => objectHtml(obj, images || {}))
      .filter(Boolean)
      .join('\n    ');
    const title = escapeHtml(`${name || 'Poster'} (${orientation}, ${lang || 'en'})`);
    return `<!DOCTYPE html>
<html lang="${escapeHtml(lang || 'en')}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${title}</title>
<style>
  html, body { margin: 0; padding: 0; background: #2b2e33; }
  .stage { display: flex; justify-content: center; padding: 24px; }
  .poster {
    position: relative; width: ${w}px; height: ${h}px;
    background: ${bg}; overflow: hidden;
    transform-origin: top left;
    box-shadow: 0 8px 40px rgba(0,0,0,0.4);
  }
  @media print {
    html, body { background: #fff; }
    .stage { padding: 0; }
    .poster { box-shadow: none; }
    @page { margin: 0; size: ${orientation === 'landscape' ? 'landscape' : 'portrait'}; }
  }
</style>
</head>
<body>
  <div class="stage"><div class="poster" id="poster">
    ${body}
  </div></div>
  <script>
  (function () {
    var W = ${w}, H = ${h};
    var poster = document.getElementById('poster');
    var stage = poster.parentElement;
    function fit() {
      var avail = stage.clientWidth - 48;
      var s = Math.min(1, avail / W);
      poster.style.transform = 'scale(' + s + ')';
      poster.style.marginBottom = (H * s - H) + 'px';
      poster.style.marginRight = (W * s - W) + 'px';
    }
    window.addEventListener('resize', fit);
    fit();
  })();
  </script>
</body>
</html>
`;
  }

  const _internals = {
    DIMS, SLIDE_IN, MIN_EXPORT_OPACITY,
    slugify, exportFileName,
    pxPerInch, pxToIn, pxToPt,
    normHex, isGradientFill, firstStopColor, solidColor, gradientCss,
    boldFrom, alignFrom, objOpacity, transparencyPct,
    estLines, textHeightPx,
    mapTextbox, mapShapeObj, mapImageObj, mapObject, mapCanvasToPptx,
    escapeHtml, objectHtml, buildHtmlDocument
  };

  // ── browser layer (download paths — the only environment-touching code) ────

  /** Trigger a browser download of a Blob. */
  function downloadBlob(name, blob) {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  /** data:...;base64,... → Blob (no fetch round-trip). */
  function dataUriToBlob(dataUri) {
    const [head, b64] = dataUri.split(',');
    const mime = (/data:([^;]+)/.exec(head) || [])[1] || 'application/octet-stream';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return new Blob([bytes], { type: mime });
  }

  /**
   * Fetch a same-origin image src (/api/images/file/...) through the session
   * (window.authOptions header idiom) → base64 data URI, or null on failure —
   * a missing image never sinks the rest of the export.
   */
  async function fetchImageDataUri(src) {
    try {
      const opts = typeof window.authOptions === 'function' ? window.authOptions(null) : undefined;
      const res = await fetch(src, opts);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      return await new Promise((resolve, reject) => {
        const fr = new FileReader();
        fr.onload = () => resolve(String(fr.result));
        fr.onerror = () => reject(fr.error);
        fr.readAsDataURL(blob);
      });
    } catch (err) {
      console.warn(`export: image fetch failed for ${src}`, err);
      return null;
    }
  }

  /** PPTX export — one slide at the poster's aspect, REAL editable text. */
  async function toPptx({ canvasJSON, orientation, name, lang }) {
    const spec = mapCanvasToPptx(canvasJSON, orientation);
    const pptx = new window.PptxGenJS();
    pptx.defineLayout({ name: spec.layout.name, width: spec.layout.width, height: spec.layout.height });
    pptx.layout = spec.layout.name;
    const slide = pptx.addSlide();
    if (spec.background) slide.background = { color: spec.background };
    for (const item of spec.items) {
      if (item.kind === 'text') {
        slide.addText(item.text, item.options);
      } else if (item.kind === 'shape') {
        slide.addShape(item.shapeType, item.options);
      } else if (item.kind === 'image') {
        const data = await fetchImageDataUri(item.src);
        if (data) slide.addImage({ data, ...item.options });
      }
    }
    const blob = await pptx.write({ outputType: 'blob' });
    downloadBlob(exportFileName(name, orientation, lang, 'pptx'), blob);
  }

  /**
   * Both-orientations PPTX — TWO SEPARATE files (client decision, overriding
   * the earlier one-deck-two-slides plan): each orientation exports through
   * the normal pixel-faithful toPptx path at its own native slide size, so
   * neither is letterboxed and each deck matches its preview exactly.
   */
  async function toPptxBoth({ portraitCanvas, landscapeCanvas, name, lang }) {
    await toPptx({ canvasJSON: portraitCanvas, orientation: 'portrait', name, lang });
    await toPptx({ canvasJSON: landscapeCanvas, orientation: 'landscape', name, lang });
  }

  /** Both-orientations JPEG — two separate files (one per orientation). */
  async function toJpegBoth({ portraitCanvas, landscapeCanvas, name, lang }) {
    await toJpeg({ canvasJSON: portraitCanvas, orientation: 'portrait', name, lang });
    await toJpeg({ canvasJSON: landscapeCanvas, orientation: 'landscape', name, lang });
  }

  /** Self-contained HTML export (inline base64 images, selectable text). */
  async function toHtml({ canvasJSON, orientation, name, lang }) {
    const images = {};
    for (const obj of canvasJSON.objects || []) {
      if (obj && obj.type === 'Image' && obj.src && !images[obj.src]) {
        const data = await fetchImageDataUri(obj.src);
        if (data) images[obj.src] = data;
      }
    }
    const html = buildHtmlDocument({ canvasJSON, orientation, name, lang, images });
    downloadBlob(
      exportFileName(name, orientation, lang, 'html'),
      new Blob([html], { type: 'text/html;charset=utf-8' })
    );
  }

  /** Re-attach persisted custom props onto enlivened instances (same order —
   *  the preview_engine/editor_page idiom). */
  function reattachProps(instances, sourceObjects) {
    (sourceObjects || []).forEach((src, i) => {
      const inst = instances[i];
      if (!inst || !src) return;
      for (const p of EXTRA_PROPS) {
        if (src[p] !== undefined) inst[p] = src[p];
      }
    });
  }

  /**
   * Full-resolution JPEG: rebuild a fabric.StaticCanvas offscreen at poster
   * size from the canvas JSON (loadFromJSON + reattach, the preview_engine
   * idiom — image srcs are same-origin so no CORS taint), rasterize at 1.5x.
   */
  async function toJpeg({ canvasJSON, orientation, name, lang }) {
    const w = canvasJSON.width || DIMS[orientation].w;
    const h = canvasJSON.height || DIMS[orientation].h;
    const el = document.createElement('canvas');
    const fc = new fabric.StaticCanvas(el, { width: w, height: h });
    try {
      await fc.loadFromJSON({ objects: canvasJSON.objects || [], background: canvasJSON.background || '' });
      reattachProps(fc.getObjects(), canvasJSON.objects);
      fc.renderAll();
      const dataUrl = fc.toDataURL({ format: 'jpeg', quality: 0.92, multiplier: 1.5 });
      downloadBlob(exportFileName(name, orientation, lang, 'jpg'), dataUriToBlob(dataUrl));
    } finally {
      try { await fc.dispose(); } catch { /* teardown race is harmless */ }
    }
  }

  const PosterExport = { toPptx, toPptxBoth, toHtml, toJpeg, toJpegBoth, downloadBlob, _internals };

  if (typeof window !== 'undefined') window.PosterExport = PosterExport;   // browser
  else if (typeof globalThis !== 'undefined') globalThis.PosterExport = PosterExport; // node tests
})();
