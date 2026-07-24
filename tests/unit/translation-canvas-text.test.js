import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  applyContentToCanvas,
  extractContentFromCanvas,
  diffTextFields,
  pruneOrphanedExtras
} from '../../translation/canvas_text.js';

// ── helpers ──────────────────────────────────────────────────────────────────

/** Build a realistic mini canvas that mirrors what templates/helpers.js produces. */
function makeTestCanvas() {
  return {
    version: '6.7.1',
    width: 1414,
    height: 2000,
    background: '#1F1A17',
    objects: [
      // headline Textbox
      { type: 'Textbox', left: 90, top: 90, width: 1234, text: 'Original headline', layerRole: 'headline' },
      // subheadline Textbox
      { type: 'Textbox', left: 200, top: 300, width: 1014, text: 'Original subheadline', layerRole: 'subheadline' },
      // message-label Textbox (chip label text) for m1
      { type: 'Textbox', left: 120, top: 700, width: 160, text: 'DO', layerRole: 'message-label', msgId: 'm1' },
      // Rect (pill backing for chip) with layerRole 'message-label' but NO text property — must be skipped
      { type: 'Rect', left: 70, top: 695, width: 220, height: 50, fill: '#fff', layerRole: 'message-label', msgId: 'm1' },
      // message-text Textbox for m1
      { type: 'Textbox', left: 120, top: 770, width: 530, text: 'Original message text', layerRole: 'message-text', msgId: 'm1' },
      // cta Textbox
      { type: 'Textbox', left: 90, top: 1900, width: 1234, text: 'Original CTA', layerRole: 'cta' },
      // decor Textbox — must NEVER be touched
      { type: 'Textbox', left: 10, top: 10, width: 100, text: 'v1.0', layerRole: 'decor' }
    ]
  };
}

const BASE_CONTENT = {
  headline: 'Original headline',
  subheadline: 'Original subheadline',
  messages: [{ id: 'm1', label: 'DO', text: 'Original message text' }],
  callToAction: 'Original CTA',
  format: 'dos-donts'
};

// ── Test 1: applyContentToCanvas swaps bound fields; decor + rect untouched; returns a clone ──

test('applyContentToCanvas — swaps all bound fields, leaves decor and non-text Rect untouched, returns a clone', () => {
  const canvas = makeTestCanvas();
  const content = {
    headline: 'Translated headline',
    subheadline: 'Translated subheadline',
    messages: [{ id: 'm1', label: 'HACER', text: 'Translated message text' }],
    callToAction: 'Translated CTA',
    format: 'dos-donts'
  };

  const result = applyContentToCanvas(canvas, content);

  // bound fields swapped
  const headlineObj = result.objects.find((o) => o.layerRole === 'headline');
  assert.equal(headlineObj.text, 'Translated headline');

  const subheadObj = result.objects.find((o) => o.layerRole === 'subheadline');
  assert.equal(subheadObj.text, 'Translated subheadline');

  const msgLabelObj = result.objects.find((o) => o.layerRole === 'message-label' && o.type === 'Textbox');
  assert.equal(msgLabelObj.text, 'HACER');

  const msgTextObj = result.objects.find((o) => o.layerRole === 'message-text');
  assert.equal(msgTextObj.text, 'Translated message text');

  const ctaObj = result.objects.find((o) => o.layerRole === 'cta');
  assert.equal(ctaObj.text, 'Translated CTA');

  // decor Textbox never touched
  const decorObj = result.objects.find((o) => o.layerRole === 'decor');
  assert.equal(decorObj.text, 'v1.0');

  // Rect with message-label but no text property must have no text added
  const rectObj = result.objects.find((o) => o.type === 'Rect' && o.layerRole === 'message-label');
  assert.equal(rectObj.text, undefined);

  // result is a clone — mutating it must not touch the input
  result.objects[0].text = 'MUTATED';
  assert.equal(canvas.objects[0].text, 'Original headline');
});

// ── Test 2 (finding C8): explicitly blank field BLANKS the canvas text ──
// A field that is PRESENT in the content but null/empty/whitespace-only means
// "this poster has no such text" — leaving the previous string would keep
// stale copy on the variant. Only a MISSING binding leaves text untouched.

test('applyContentToCanvas — explicitly null/empty translated field blanks the canvas text (no stale copy)', () => {
  const canvas = makeTestCanvas();
  const content = {
    headline: 'Translated headline',
    subheadline: null,            // explicitly blank → text ''
    messages: [{ id: 'm1', label: '', text: 'Translated message text' }],  // empty label → text ''
    callToAction: '   ',          // whitespace-only → text ''
    format: 'dos-donts'
  };

  const result = applyContentToCanvas(canvas, content);

  // headline swapped (non-empty)
  assert.equal(result.objects.find((o) => o.layerRole === 'headline').text, 'Translated headline');

  // subheadline explicitly null → stale text blanked
  assert.equal(result.objects.find((o) => o.layerRole === 'subheadline').text, '');

  // message-label empty string → stale text blanked
  const msgLabel = result.objects.find((o) => o.layerRole === 'message-label' && o.type === 'Textbox');
  assert.equal(msgLabel.text, '');

  // message-text swapped
  assert.equal(result.objects.find((o) => o.layerRole === 'message-text').text, 'Translated message text');

  // cta whitespace-only → stale text blanked
  assert.equal(result.objects.find((o) => o.layerRole === 'cta').text, '');

  // decor stays untouched — it has no binding at all
  assert.equal(result.objects.find((o) => o.layerRole === 'decor').text, 'v1.0');
});

// ── Test 3: Unknown msgId → object untouched ──

test('applyContentToCanvas — unknown msgId leaves the canvas object untouched', () => {
  const canvas = makeTestCanvas();
  // content has messages for 'm2', canvas only has 'm1'
  const content = {
    headline: 'Translated headline',
    subheadline: null,
    messages: [{ id: 'm2', label: 'HAGA', text: 'Text for m2' }],
    callToAction: null,
    format: 'dos-donts'
  };

  const result = applyContentToCanvas(canvas, content);

  // m1 label Textbox — content has no m1 entry, so unchanged
  const msgLabel = result.objects.find((o) => o.layerRole === 'message-label' && o.type === 'Textbox');
  assert.equal(msgLabel.text, 'DO', 'message-label with unknown msgId must remain unchanged');

  const msgText = result.objects.find((o) => o.layerRole === 'message-text');
  assert.equal(msgText.text, 'Original message text', 'message-text with unknown msgId must remain unchanged');
});

// ── Test 4: extractContentFromCanvas picks up edited canvas text; missing object keeps baseContent value ──

test('extractContentFromCanvas — reads edited canvas text; missing objects fall back to baseContent', () => {
  // Build a canvas where headline and message-text have been user-edited,
  // but subheadline Textbox is entirely absent (simulates a template without one).
  const editedCanvas = {
    version: '6.7.1',
    width: 1414,
    height: 2000,
    background: '#000',
    objects: [
      { type: 'Textbox', left: 90, top: 90, width: 1234, text: 'User-edited headline', layerRole: 'headline' },
      // no subheadline object
      { type: 'Textbox', left: 120, top: 700, width: 160, text: 'EDITED-LABEL', layerRole: 'message-label', msgId: 'm1' },
      { type: 'Textbox', left: 120, top: 770, width: 530, text: 'User-edited message', layerRole: 'message-text', msgId: 'm1' },
      { type: 'Textbox', left: 90, top: 1900, width: 1234, text: 'User-edited CTA', layerRole: 'cta' },
      // decor should never leak into content
      { type: 'Textbox', left: 10, top: 10, width: 100, text: 'v1.0', layerRole: 'decor' }
    ]
  };

  const result = extractContentFromCanvas(editedCanvas, BASE_CONTENT);

  // edited fields read from canvas
  assert.equal(result.headline, 'User-edited headline');
  assert.equal(result.messages[0].label, 'EDITED-LABEL');
  assert.equal(result.messages[0].text, 'User-edited message');
  assert.equal(result.callToAction, 'User-edited CTA');

  // subheadline: no canvas object → baseContent value survives
  assert.equal(result.subheadline, 'Original subheadline');

  // format and message id must not change
  assert.equal(result.format, 'dos-donts');
  assert.equal(result.messages[0].id, 'm1');

  // baseContent must not be mutated
  assert.equal(BASE_CONTENT.headline, 'Original headline');
});

// ── Test 5: Round-trip extract(apply(canvas, content), content) deep-equals content ──

test('round-trip: extract(apply(canvas, content), content) deep-equals content for all bound non-empty fields', () => {
  const canvas = makeTestCanvas();
  const content = {
    headline: 'Phishing-Warnung',
    subheadline: 'So schützen Sie sich',
    messages: [{ id: 'm1', label: 'TUN', text: 'Verdächtige E-Mails melden' }],
    callToAction: 'Denken Sie nach, bevor Sie klicken',
    format: 'dos-donts'
  };

  const applied = applyContentToCanvas(canvas, content);
  const extracted = extractContentFromCanvas(applied, content);

  assert.equal(extracted.headline, content.headline);
  assert.equal(extracted.subheadline, content.subheadline);
  assert.equal(extracted.callToAction, content.callToAction);
  assert.equal(extracted.messages[0].label, content.messages[0].label);
  assert.equal(extracted.messages[0].text, content.messages[0].text);
  assert.equal(extracted.messages[0].id, content.messages[0].id);
  assert.equal(extracted.format, content.format);
});

// ── Test 6: diffTextFields catches all changes, ignores unchanged, handles null↔string ──

test('diffTextFields — catches label/text/headline/cta changes with exact field names, ignores unchanged fields, handles null↔string', () => {
  const before = {
    headline: 'Stop phishing attacks',
    subheadline: null,
    messages: [
      { id: 'm1', label: 'DO', text: 'Report suspicious emails' },
      { id: 'm2', label: "DON'T", text: 'Click unknown links' }
    ],
    callToAction: 'Think before you click',
    format: 'dos-donts'
  };

  const after = {
    headline: 'Stop phishing attacks',        // unchanged
    subheadline: 'Protect yourself today',    // null → string
    messages: [
      { id: 'm1', label: 'DO', text: 'Report suspicious emails' },  // unchanged
      { id: 'm2', label: 'NEVER', text: 'Click unknown links' }     // label changed
    ],
    callToAction: 'Stay vigilant every day',  // changed
    format: 'dos-donts'
  };

  const diffs = diffTextFields(before, after);

  // Extract field names from diffs
  const fields = diffs.map((d) => d.field);

  // changed fields present
  assert.ok(fields.includes('subheadline'), 'subheadline should be in diffs');
  assert.ok(fields.includes('messages[1].label'), 'messages[1].label should be in diffs');
  assert.ok(fields.includes('callToAction'), 'callToAction should be in diffs');

  // unchanged fields absent
  assert.ok(!fields.includes('headline'), 'unchanged headline must not appear');
  assert.ok(!fields.includes('messages[0].label'), 'unchanged m0 label must not appear');
  assert.ok(!fields.includes('messages[0].text'), 'unchanged m0 text must not appear');
  assert.ok(!fields.includes('messages[1].text'), 'unchanged m1 text must not appear');

  // verify before/after values
  const subDiff = diffs.find((d) => d.field === 'subheadline');
  assert.equal(subDiff.before, '');       // null coerces to ''
  assert.equal(subDiff.after, 'Protect yourself today');

  const labelDiff = diffs.find((d) => d.field === 'messages[1].label');
  assert.equal(labelDiff.before, "DON'T");
  assert.equal(labelDiff.after, 'NEVER');

  const ctaDiff = diffs.find((d) => d.field === 'callToAction');
  assert.equal(ctaDiff.before, 'Think before you click');
  assert.equal(ctaDiff.after, 'Stay vigilant every day');

  // Total diffs = 3
  assert.equal(diffs.length, 3);
});

// ── Test 7 (finding S4): diff strings are capped before prompt interpolation ──

test('diffTextFields — a 2000-char field yields 500-char before/after strings', () => {
  const before = {
    headline: 'a'.repeat(2000),
    subheadline: null,
    messages: [{ id: 'm1', label: 'DO', text: 'b'.repeat(2000) }],
    callToAction: 'short',
    format: 'dos-donts'
  };
  const after = {
    headline: 'c'.repeat(2000),
    subheadline: null,
    messages: [{ id: 'm1', label: 'DO', text: 'unchanged? no — changed' }],
    callToAction: 'short',
    format: 'dos-donts'
  };

  const diffs = diffTextFields(before, after);

  const head = diffs.find((d) => d.field === 'headline');
  assert.equal(head.before.length, 500, 'before capped at 500 chars');
  assert.equal(head.after.length, 500, 'after capped at 500 chars');
  assert.equal(head.before, 'a'.repeat(500));
  assert.equal(head.after, 'c'.repeat(500));

  const msg = diffs.find((d) => d.field === 'messages[0].text');
  assert.equal(msg.before.length, 500, 'message before capped at 500 chars');
  assert.equal(msg.after, 'unchanged? no — changed', 'short strings ride uncapped');

  // capping never hides a change: comparison happens on the FULL strings
  const same500Prefix = diffTextFields(
    { headline: 'x'.repeat(500) + 'ONE', messages: [], callToAction: null },
    { headline: 'x'.repeat(500) + 'TWO', messages: [], callToAction: null }
  );
  assert.equal(same500Prefix.length, 1, 'fields differing only beyond char 500 still diff');
});

// ── Test 8 (finding C5): user-text extras extraction / apply / diff ──────────

test('extras: extractContentFromCanvas collects user-text with extraId; applyContentToCanvas swaps by extraId; unknown/missing untouched', () => {
  const canvas = makeTestCanvas();
  canvas.objects.push(
    { type: 'Textbox', left: 500, top: 500, width: 400, text: 'Stay alert!', layerRole: 'user-text', extraId: 'x1' },
    { type: 'Textbox', left: 500, top: 600, width: 400, text: 'No extraId — ignored', layerRole: 'user-text' },
    { type: 'Textbox', left: 500, top: 700, width: 400, text: 'Bad extraId — ignored', layerRole: 'user-text', extraId: 42 }
  );

  // extraction: only the stamped object rides as an extra
  const extracted = extractContentFromCanvas(canvas, BASE_CONTENT);
  assert.deepEqual(extracted.extras, [{ id: 'x1', text: 'Stay alert!' }]);

  // apply: swap by extraId; unstamped objects and unknown ids untouched
  const applied = applyContentToCanvas(canvas, {
    ...BASE_CONTENT,
    extras: [
      { id: 'x1', text: '¡Manténgase alerta!' },
      { id: 'x-unknown', text: 'never lands anywhere' }
    ]
  });
  assert.equal(applied.objects.find((o) => o.extraId === 'x1').text, '¡Manténgase alerta!');
  assert.equal(
    applied.objects.find((o) => o.layerRole === 'user-text' && o.extraId === undefined).text,
    'No extraId — ignored'
  );
  assert.equal(applied.objects.find((o) => o.extraId === 42).text, 'Bad extraId — ignored');

  // an extra present in content but blank → canvas text blanked (C8 semantics)
  const blanked = applyContentToCanvas(canvas, { ...BASE_CONTENT, extras: [{ id: 'x1', text: '' }] });
  assert.equal(blanked.objects.find((o) => o.extraId === 'x1').text, '');

  // content WITHOUT an extras field → user-text bindings not found → untouched
  const noExtras = applyContentToCanvas(canvas, BASE_CONTENT);
  assert.equal(noExtras.objects.find((o) => o.extraId === 'x1').text, 'Stay alert!');

  // round-trip: extract(apply(...)) returns the swapped extra
  const roundTrip = extractContentFromCanvas(applied, BASE_CONTENT);
  assert.deepEqual(roundTrip.extras, [{ id: 'x1', text: '¡Manténgase alerta!' }]);
});

test('extras: diffTextFields diffs extras as extras[<id>] fields', () => {
  const before = { ...BASE_CONTENT, extras: [{ id: 'x1', text: 'Stay alert!' }, { id: 'x2', text: 'Same text' }] };
  const after = { ...BASE_CONTENT, extras: [{ id: 'x1', text: 'Stay very alert!' }, { id: 'x2', text: 'Same text' }, { id: 'x3', text: 'Brand new box' }] };

  const diffs = diffTextFields(before, after);
  const fields = diffs.map((d) => d.field);

  assert.ok(fields.includes('extras[x1]'), 'changed extra diffs as extras[x1]');
  assert.ok(!fields.includes('extras[x2]'), 'unchanged extra must not diff');
  assert.ok(fields.includes('extras[x3]'), 'added extra diffs as extras[x3]');

  const x1 = diffs.find((d) => d.field === 'extras[x1]');
  assert.equal(x1.before, 'Stay alert!');
  assert.equal(x1.after, 'Stay very alert!');
  const x3 = diffs.find((d) => d.field === 'extras[x3]');
  assert.equal(x3.before, '');
  assert.equal(x3.after, 'Brand new box');
});

// ── pass-2 finding M1: pruneOrphanedExtras ────────────────────────────────────

test('pruneOrphanedExtras removes only user-text whose id left the source; variant-local and bound objects survive', () => {
  const canvas = {
    version: '6.0.0',
    objects: [
      { type: 'Textbox', layerRole: 'headline', text: 'Kopfzeile' },
      { type: 'Textbox', layerRole: 'user-text', extraId: 'x1', text: '[de] Wachsam bleiben' },
      { type: 'Textbox', layerRole: 'user-text', extraId: 'x2', text: '[de] Zweiter Hinweis' },
      { type: 'Textbox', layerRole: 'user-text', extraId: 'xl-local', text: 'Nur DE' },
      { type: 'Textbox', layerRole: 'user-text', text: 'kein extraId' }
    ]
  };
  const previousExtras = [{ id: 'x1', text: '[de] Wachsam bleiben' }, { id: 'x2', text: '[de] Zweiter Hinweis' }];
  const currentExtras = [{ id: 'x2', text: '[de] Zweiter Hinweis v2' }]; // x1 deleted from English
  const pruned = pruneOrphanedExtras(canvas, previousExtras, currentExtras);

  const ids = pruned.objects.filter((o) => o.layerRole === 'user-text').map((o) => o.extraId);
  assert.ok(!ids.includes('x1'), 'x1 came from English and was deleted there — pruned');
  assert.ok(ids.includes('x2'), 'still-present source extra survives');
  assert.ok(ids.includes('xl-local'), 'variant-local extra (never in previousExtras) survives');
  assert.equal(pruned.objects.filter((o) => o.layerRole === 'user-text' && !o.extraId).length, 1, 'extraId-less object untouched');
  assert.equal(pruned.objects[0].text, 'Kopfzeile', 'non-user-text objects untouched');
  assert.equal(canvas.objects.length, 5, 'input canvas is not mutated');
});
