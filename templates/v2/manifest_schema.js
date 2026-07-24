// templates/v2/manifest_schema.js — the D1 template-manifest-v2 contract.
// validateManifest() is the single gate every v2 template must pass (the v2
// registry refuses invalid templates at load time); sampleContentFor()
// produces realistic phishing-awareness sample content for ANY contentSchema
// — used by gallery previews, the design-review loop, and contract tests.
// Real copy only, zero lorem, zero dummy placeholders.

export const SUPPORTED_STYLES = [
  'bullet', 'qa', 'comic', 'infographic', 'timeline',
  'tree', 'tabular', 'statement', 'scenario', 'stats'
];

export const BLOCK_KINDS = [
  'sequence', 'qa-pairs', 'panels', 'stats', 'cells', 'branches', 'single', 'scenario'
];

const ID_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function checkTextField(problems, schema, key, { required }) {
  const f = schema[key];
  if (f == null) {
    if (required) problems.push(`contentSchema.${key} is required`);
    return;
  }
  if (typeof f !== 'object') {
    problems.push(`contentSchema.${key} must be an object ({required, maxWords})`);
    return;
  }
  if (typeof f.required !== 'boolean') problems.push(`contentSchema.${key}.required must be a boolean`);
  if (!Number.isInteger(f.maxWords) || f.maxWords < 1 || f.maxWords > 40) {
    problems.push(`contentSchema.${key}.maxWords must be an integer 1..40`);
  }
}

/**
 * Validate a v2 template manifest (D1 shape). Returns an array of problem
 * strings — empty means valid. Never throws.
 */
export function validateManifest(t) {
  const problems = [];
  if (!t || typeof t !== 'object') return ['manifest must be an object'];

  if (!isNonEmptyString(t.id) || !ID_RE.test(t.id)) problems.push('id must be a kebab-case string');
  if (!isNonEmptyString(t.name)) problems.push('name must be a non-empty string');
  if (!isNonEmptyString(t.description)) problems.push('description must be a non-empty string');
  if (!SUPPORTED_STYLES.includes(t.style)) {
    problems.push(`style "${t.style}" not in supported styles (${SUPPORTED_STYLES.join('|')})`);
  }

  const cs = t.contentSchema;
  if (!cs || typeof cs !== 'object') {
    problems.push('contentSchema must be an object');
  } else {
    checkTextField(problems, cs, 'headline', { required: true });
    checkTextField(problems, cs, 'subheadline', { required: false });
    checkTextField(problems, cs, 'callToAction', { required: true });
    if (cs.headline && cs.headline.required !== true) problems.push('contentSchema.headline.required must be true');
    if (cs.callToAction && cs.callToAction.required !== true) problems.push('contentSchema.callToAction.required must be true');

    const b = cs.blocks;
    if (!b || typeof b !== 'object') {
      problems.push('contentSchema.blocks must be an object');
    } else {
      if (!BLOCK_KINDS.includes(b.kind)) {
        problems.push(`blocks.kind "${b.kind}" not in supported kinds (${BLOCK_KINDS.join('|')})`);
      }
      if (!Number.isInteger(b.min) || b.min < 1) problems.push('blocks.min must be an integer >= 1');
      if (!Number.isInteger(b.max) || b.max < (b.min || 1) || b.max > 8) {
        problems.push('blocks.max must be an integer >= min and <= 8');
      }
      if (!Array.isArray(b.fields) || b.fields.length === 0 || !b.fields.every(isNonEmptyString)) {
        problems.push('blocks.fields must be a non-empty array of field-name strings');
      }
    }

    if (!Number.isInteger(cs.imageSlots) || cs.imageSlots < 0 || cs.imageSlots > 6) {
      problems.push('contentSchema.imageSlots must be an integer 0..6');
    }

    // backgroundSlots (Phase C) is OPTIONAL and separate from imageSlots: a
    // single full-bleed background image (slotId 'bg'), 0 or 1. Absent = 0.
    if (cs.backgroundSlots !== undefined && cs.backgroundSlots !== 0 && cs.backgroundSlots !== 1) {
      problems.push('contentSchema.backgroundSlots, when present, must be 0 or 1');
    }
  }

  for (const key of ['portrait', 'landscape']) {
    if (typeof t.build?.[key] !== 'function') problems.push(`build.${key} must be a function`);
    if (typeof t.preview?.[key] !== 'function') problems.push(`preview.${key} must be a function`);
  }

  const e = t.editable;
  if (!e || e.background !== true || e.perElementColor !== true || e.fonts !== true) {
    problems.push('editable must be { background: true, perElementColor: true, fonts: true } (all true in v2)');
  }

  return problems;
}

// ── realistic sample content (phishing awareness) ────────────────────────────

function capWords(text, maxWords) {
  if (!Number.isInteger(maxWords) || maxWords < 1) return text;
  return String(text).trim().split(/\s+/).slice(0, maxWords).join(' ');
}

// Per-kind block banks: real security-awareness copy, sized to survive the
// 38px message floor inside every template's block budget (answers/texts
// stay under ~75 chars).
const BLOCK_BANKS = {
  sequence: [
    { label: 'Spot', heading: 'Authorised Use', text: 'An unexpected invoice arrives with an urgent payment deadline' },
    { label: 'Pause', heading: 'License Compliance', text: 'Hover the link and read the real domain before you click' },
    { label: 'Verify', heading: 'Approved Sources', text: 'Call the sender on the number you already have on file' },
    { label: 'Report', heading: 'Asset Retirement', text: 'Hit the report button so the SOC can warn everyone fast' },
    { label: 'Learn', heading: 'Audit Readiness', text: 'Skim the monthly threat digest to stay ahead of new lures' },
    { label: 'Repeat', heading: 'Policy Scope', text: 'Treat every rushed request for money or data the same way' }
  ],
  'qa-pairs': [
    {
      question: 'The email says my mailbox is full. Click the fix-it link?',
      answer: 'No. IT never asks you to log in from an email. Use the portal.'
    },
    {
      question: 'My boss texted asking for gift cards, urgently. Now what?',
      answer: 'Verify on a known channel first. Attackers impersonate bosses.'
    },
    {
      question: 'I already clicked a suspicious link. Is it too late?',
      answer: 'Never. Report it right away — fast reports stop most damage.'
    },
    {
      question: 'The supplier domain is off by one letter. Coincidence?',
      answer: 'Classic lookalike domain. Report it and phone the supplier.'
    },
    {
      question: 'A QR code poster in the lobby promises free lunch. Scan it?',
      answer: 'Check with reception first — rogue QR codes are phishing too.'
    }
  ],
  panels: [
    { heading: 'The hook', label: 'E-commerce scams', text: 'A perfect copy of the login page lands in your inbox', solution: 'Shop from trusted sites only' },
    { heading: 'The rush', label: 'Charity fraud', text: 'It threatens account closure within 24 hours', solution: 'Donate only through verified organizations' },
    { heading: 'The catch', label: 'Travel scams', text: 'The address bar shows a domain you have never seen', solution: 'Use trusted travel platforms only' },
    { heading: 'The save', label: 'Delivery fraud', text: 'You report it and the SOC blocks it for everyone', solution: 'Track parcels from the courier site directly' },
    { heading: 'The lesson', label: 'Deal bait', text: 'Urgency is the attack — slowing down defeats it', solution: 'If the price is absurd, the product is you' }
  ],
  stats: [
    { label: 'Phishing', figure: '91%', value: '91', unit: '%', text: 'of cyberattacks start with a phishing email', caption: 'of cyberattacks start with a phishing email' },
    { label: 'Speed', figure: '60 sec', value: '60', unit: 'sec', text: 'median time before the first victim clicks', caption: 'median time before the first victim clicks' },
    { label: 'Reports', figure: '10 min', value: '10', unit: 'min', text: 'fast reports cut breach costs dramatically', caption: 'fast reports cut breach costs dramatically' },
    { label: 'Reuse', figure: '65%', value: '65', unit: '%', text: 'of people reuse passwords across accounts', caption: 'of people reuse passwords across accounts' },
    { label: 'MFA', figure: '99%', value: '99', unit: '%', text: 'of account takeovers are blocked by MFA', caption: 'of account takeovers are blocked by MFA' }
  ],
  cells: [
    { label: 'Sender', text: 'Address does not match the display name' },
    { label: 'Link', text: 'Hover target differs from the shown URL' },
    { label: 'Tone', text: 'Urgent, threatening, or too good to be true' },
    { label: 'Attachment', text: 'Unexpected file types like .zip or .html' },
    { label: 'Request', text: 'Asks for credentials, payment, or gift cards' },
    { label: 'Timing', text: 'Arrives after hours or right before a deadline' }
  ],
  branches: [
    { label: 'Looks off?', text: 'Do not click — report it with one button', condition: 'The sender or link looks even slightly off', outcome: 'Do not click — report it with one button' },
    { label: 'Not sure?', text: 'Ask the SOC before you act, not after', condition: 'You cannot tell whether the request is real', outcome: 'Ask the SOC before you act, not after' },
    { label: 'Clicked it?', text: 'Report immediately — minutes matter', condition: 'You already clicked or entered your password', outcome: 'Report immediately — minutes matter' },
    { label: 'Verified safe?', text: 'Proceed, and thanks for checking first', condition: 'You verified the sender on a known channel', outcome: 'Proceed, and thanks for checking first' }
  ],
  single: [
    { text: 'One reported email can protect the entire company' },
    { text: 'Attackers need one click. You only need one pause.' },
    { text: 'If it rushes you, it is probably a trap' }
  ],
  scenario: [
    { label: 'Scenario', text: 'Finance gets a CEO email demanding an urgent wire transfer', situation: 'A CEO email demands an urgent wire transfer to a new account', response: 'Confirm by phone on a known number before moving any money' },
    { label: 'Red flag', text: 'New account details and a plea to skip the usual process', situation: 'IT support calls asking you to read out your MFA code', response: 'Hang up and call the helpdesk back on the published number' },
    { label: 'Response', text: 'Confirm by phone on a known number before moving money', situation: 'A courier text says a parcel is held pending a card payment', response: 'Track parcels only through the retailer site you ordered from' },
    { label: 'Outcome', text: 'The transfer stops and the SOC traces the spoofed sender', situation: 'A colleague sends a shared doc link you were not expecting', response: 'Ping the colleague on chat to confirm before you open it' }
  ]
};

const FIELD_FALLBACK = {
  label: 'Stay alert',
  text: 'Phishing thrives on speed — slowing down defeats it',
  heading: 'Check the sender',
  question: 'Is this email really from IT?',
  answer: 'Verify through the official portal, never the email link.',
  figure: '91%',
  value: '91',
  unit: '%',
  title: 'Think before you click',
  caption: 'Verified reports protect the whole team',
  situation: 'An urgent email pressures you to act right now',
  response: 'Slow down and verify on a channel you already trust',
  condition: 'Something about the request feels rushed or unusual',
  outcome: 'Report it — one click protects the whole company'
};

/**
 * Realistic phishing-awareness sample content matching any D1 contentSchema.
 * Deterministic (no randomness): block count = clamp(4, min..max); block ids
 * are 'blk-1'..'blk-N'; only the schema's declared fields are emitted;
 * headline/subheadline/callToAction respect their maxWords caps.
 */
export function sampleContentFor(contentSchema) {
  const cs = contentSchema || {};
  const blocksSchema = cs.blocks || { kind: 'sequence', min: 3, max: 5, fields: ['label', 'text'] };
  const bank = BLOCK_BANKS[blocksSchema.kind] || BLOCK_BANKS.sequence;
  const min = Number.isInteger(blocksSchema.min) ? blocksSchema.min : 3;
  const max = Number.isInteger(blocksSchema.max) ? blocksSchema.max : 5;
  const count = Math.max(min, Math.min(max, 4));
  const fields = Array.isArray(blocksSchema.fields) && blocksSchema.fields.length
    ? blocksSchema.fields : ['label', 'text'];

  const blocks = [];
  for (let i = 0; i < count; i++) {
    const entry = bank[i % bank.length];
    const block = { id: `blk-${i + 1}` };
    for (const field of fields) {
      block[field] = entry[field] ?? FIELD_FALLBACK[field] ?? FIELD_FALLBACK.text;
    }
    blocks.push(block);
  }

  return {
    headline: capWords('Pause Before You Click', cs.headline?.maxWords),
    subheadline: cs.subheadline
      ? capWords('One rushed click can hand an attacker the keys', cs.subheadline.maxWords)
      : null,
    blocks,
    callToAction: capWords('Report suspicious emails to the SOC today', cs.callToAction?.maxWords)
  };
}
