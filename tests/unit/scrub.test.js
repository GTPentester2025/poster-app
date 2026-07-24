// scrubInternalText tests: verbatim synthesis echoes are withheld at sentence
// granularity, legitimate poster-content feedback passes untouched, and the
// contiguous 8-word boundary is exact (7 shared words survive, 8 do not),
// case/whitespace-insensitively.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scrubInternalText, WITHHELD_MARKER } from '../../pipelines/scrub.js';
import { CONTEXT_OUTPUT } from './helpers/fake_egress.js';

const SYNTHESIS = CONTEXT_OUTPUT.synthesis;

test('a synthesis sentence echoed verbatim is replaced with the withheld marker', () => {
  const echoed = SYNTHESIS.split('. ')[0] + '.'; // full first sentence, verbatim
  const feedback = `The headline is vague. ${echoed} Rewrite the call to action.`;
  const scrubbed = scrubInternalText(feedback, SYNTHESIS);

  assert.ok(scrubbed.includes(WITHHELD_MARKER), 'echoed sentence must be withheld');
  assert.ok(!scrubbed.includes('shifting phishing delivery away from bare links'), 'synthesis text must not survive');
  // neighbouring sentences that only discuss poster content are kept
  assert.ok(scrubbed.includes('The headline is vague.'));
  assert.ok(scrubbed.includes('Rewrite the call to action.'));
});

test('normal poster-content feedback is returned untouched', () => {
  const feedback = 'The message "A login page reached from an email link" overlaps with the QR-code red flag. The call to action names no channel for urgent cases.';
  assert.equal(scrubInternalText(feedback, SYNTHESIS), feedback);
});

test('8-word boundary: exactly 8 contiguous shared words withhold the sentence, 7 do not', () => {
  const internal = 'alpha bravo charlie delta echo foxtrot golf hotel india juliet attackers relay codes.';
  const eight = 'The quoted line alpha bravo charlie delta echo foxtrot golf hotel is a problem. Fix the label.';
  const seven = 'The quoted line alpha bravo charlie delta echo foxtrot golf is a problem. Fix the label.';

  const scrubbedEight = scrubInternalText(eight, internal);
  assert.ok(scrubbedEight.includes(WITHHELD_MARKER));
  assert.ok(!scrubbedEight.includes('alpha bravo'));
  assert.ok(scrubbedEight.includes('Fix the label.'));

  assert.equal(scrubInternalText(seven, internal), seven);
});

test('matching is case- and whitespace-insensitive', () => {
  const internal = 'alpha bravo charlie delta echo foxtrot golf hotel india.';
  const shouty = 'Bad line: ALPHA   Bravo  CHARLIE delta Echo foxtrot GOLF hotel here. Keep this sentence.';
  const scrubbed = scrubInternalText(shouty, internal);
  assert.ok(scrubbed.includes(WITHHELD_MARKER));
  assert.ok(scrubbed.includes('Keep this sentence.'));
});

test('empty or short internal text scrubs nothing', () => {
  assert.equal(scrubInternalText('Some feedback here.', ''), 'Some feedback here.');
  assert.equal(scrubInternalText('Some feedback here.', 'too few words'), 'Some feedback here.');
  assert.equal(scrubInternalText('', SYNTHESIS), '');
});
