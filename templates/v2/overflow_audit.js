// templates/v2/overflow_audit.js
// Stress-audit: render every v2 template with worst-case content and flag any
// content text block that runs off the canvas (overflow) or collides with a
// sibling (overlap). Pure — never mutates a template; measures built canvases.
// The tolerances here are the CONTRACT shared by the regression test and any
// layout fix.

import { listTemplatesV2, buildCanvas } from './index.js';
import { sampleContentFor } from './manifest_schema.js';
import { estTextHeight } from '../helpers.js';

const CONTENT_ROLES = new Set([
  'headline', 'subheadline', 'message', 'message-label', 'cta',
  'label', 'body', 'quote', 'stat', 'eyebrow'
]);

const LONG_BODY = 'Verify unexpected requests through a second trusted channel before you act on them because attackers exploit urgency and authority to bypass your caution and rush you into a mistake';
const LONG_HEAD = 'Protect Every Account With Strong Unique Passphrases Today';
const LONG_SUB = 'Small habits stop most attacks — slow down, check the sender, and confirm before you click';
const LONG_CTA = 'Report anything suspicious to the Security Operations Center immediately';
const LONG_LABEL = 'Never Reuse Credentials Across Sites';

/**
 * Worst-case-but-valid content for a template's contentSchema: real fields
 * present, every text field set to a long string, and block/message arrays
 * filled to the schema's max count so fixed-slot layouts are stressed.
 */
export function stressContentFor(contentSchema) {
  const base = sampleContentFor(contentSchema);
  const c = structuredClone(base);
  if (typeof c.headline === 'string') c.headline = LONG_HEAD;
  if (typeof c.subheadline === 'string') c.subheadline = LONG_SUB;
  if (typeof c.callToAction === 'string') c.callToAction = LONG_CTA;
  const cs = contentSchema || {};
  const stressArr = (arr, schema) => {
    if (!Array.isArray(arr)) return arr;
    const max = Number.isInteger(schema?.max) ? schema.max : arr.length;
    const out = [];
    for (let i = 0; i < Math.max(arr.length, max); i++) {
      const src = arr[i % arr.length] || arr[0] || {};
      const item = structuredClone(src);
      if ('label' in item && item.label != null) item.label = LONG_LABEL;
      if ('text' in item && item.text != null) item.text = LONG_BODY;
      out.push(item);
    }
    return out;
  };
  if (Array.isArray(c.blocks)) c.blocks = stressArr(c.blocks, cs.blocks);
  if (Array.isArray(c.messages)) c.messages = stressArr(c.messages, cs.messages);
  return c;
}

function contentBoxes(canvas) {
  const boxes = [];
  for (const o of canvas.objects || []) {
    if (!CONTENT_ROLES.has(o.layerRole || '')) continue;
    if (typeof o.text !== 'string' || !o.text) continue;
    const w = o.w ?? o.width ?? 0;
    const fontSize = o.fontSize ?? 0;
    const h = estTextHeight(o.text, fontSize, w, o.lineHeight || 1.16);
    boxes.push({ x: o.x ?? o.left ?? 0, y: o.y ?? o.top ?? 0, w, h, role: o.layerRole, key: o.msgId || o.id || o.layerRole });
  }
  return boxes;
}

function overlapArea(a, b) {
  const ox = Math.max(0, Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x));
  const oy = Math.max(0, Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y));
  return ox * oy;
}

/** Violations for one template across both orientations. */
export function auditTemplate(id) {
  const t = listTemplatesV2().find((x) => x.id === id);
  if (!t) return [{ id, orientation: '-', kind: 'build-error', role: '-', detail: 'unknown template' }];
  const content = stressContentFor(t.contentSchema);
  const out = [];
  for (const orientation of ['portrait', 'landscape']) {
    let canvas;
    try { canvas = buildCanvas(id, orientation, content); }
    catch (e) { out.push({ id, orientation, kind: 'build-error', role: '-', detail: String(e.message).slice(0, 80) }); continue; }
    const { width: W, height: H } = canvas;
    const boxes = contentBoxes(canvas);
    for (const b of boxes) {
      if (b.x < -2 || b.y < -2 || b.x + b.w > W + 2 || b.y + b.h > H + 2) {
        out.push({ id, orientation, kind: 'overflow', role: b.role, detail: `bottom=${Math.round(b.y + b.h)}/${H} right=${Math.round(b.x + b.w)}/${W}` });
      }
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const area = overlapArea(boxes[i], boxes[j]);
        const minA = Math.min(boxes[i].w * boxes[i].h, boxes[j].w * boxes[j].h) || 1;
        if (area > 0.2 * minA) {
          out.push({ id, orientation, kind: 'overlap', role: `${boxes[i].role}~${boxes[j].role}`, detail: `${Math.round(100 * area / minA)}%` });
        }
      }
    }
  }
  return out;
}

/** All violations across the gallery. */
export function auditAll() {
  return listTemplatesV2().flatMap((t) => auditTemplate(t.id));
}
