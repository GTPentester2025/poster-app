// Test doubles for the content pipeline: a scripted egress plus realistic
// phishing-awareness canned outputs (zero lorem — reviewers of these tests
// must be able to eyeball the fixtures as plausible model output).
//
// FakeEgress handlers are keyed by "agent/skill" (most specific) with an
// "agent" fallback. A handler may be:
//   - a plain object   -> returned on every call
//   - an array         -> shift()ed per call (throws when exhausted)
//   - a function       -> h(opts, ctx, callIndex)

export class FakeEgress {
  constructor(handlers = {}) {
    this.handlers = handlers;
    this.calls = [];
  }

  _dispatch(opts, ctx, kind) {
    if (!ctx?.runId) throw new Error('FakeEgress: egress calls require pipeline context (runId)');
    this.calls.push({ opts, ctx, kind });
    const h = this.handlers[`${ctx.agent}/${ctx.skill}`] ?? this.handlers[ctx.agent];
    if (h === undefined) throw new Error(`FakeEgress: no handler for agent "${ctx.agent}" (skill "${ctx.skill}")`);
    if (typeof h === 'function') return h(opts, ctx, this.calls.length - 1);
    if (Array.isArray(h)) {
      if (!h.length) throw new Error(`FakeEgress: handler queue exhausted for agent "${ctx.agent}"`);
      return h.shift();
    }
    return h;
  }

  async completeJson(opts, ctx) { return this._dispatch(opts, ctx, 'json'); }
  async completeText(opts, ctx) { return this._dispatch(opts, ctx, 'text'); }
  async generateImage(opts, ctx) { return this._dispatch(opts, ctx, 'image'); }
  async completeVision(opts, ctx) { return this._dispatch(opts, ctx, 'vision'); }

  callsFor(agent) { return this.calls.filter((c) => c.ctx.agent === agent); }
}

// ── image subsystem fixtures (spec §B.7) ────────────────────────────────────

// Real 1x1 transparent PNG — 67 bytes, valid PNG magic bytes 89 50 4E 47.
// Used in tests wherever a genuine image buffer/base64 is needed.
export const IMAGE_BASE64 =
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

/**
 * A PNG base64 string whose IHDR encodes the given pixel dimensions (the pixel
 * data stays the 1x1 sample — nothing in the tests decodes pixels; store.js
 * only reads the IHDR width/height, which is what cover-fit consumes). Used so
 * a generated-image fixture reports a realistic size like a real gpt-image-1
 * render instead of 1x1.
 */
export function pngOfSize(width, height) {
  const buf = Buffer.from(IMAGE_BASE64, 'base64');
  buf.writeUInt32BE(width, 16);  // IHDR width
  buf.writeUInt32BE(height, 20); // IHDR height
  return buf.toString('base64');
}

// Default generated-asset fixture: a 1024x1024 render (matches the generator's
// default size), so cover-fit math in tests uses real 1024² dims.
export const GEN_IMAGE_1024 = pngOfSize(1024, 1024);

export const IMAGE_VISION_OUTPUT = { hasText: false, details: 'no text or letters visible' };
export const IMAGE_VISION_HAS_TEXT = { hasText: true, details: 'word "STOP" appears top-left' };

// ── canned model outputs (realistic phishing awareness) ────────────────────

export const INTENT_OUTPUT = {
  topic: 'phishing',
  core: ['phishing'],
  expanded: ['user awareness', 'phishing prevention', 'social engineering', 'email security', 'qr code phishing'],
  contentShape: null
};

export const CONTEXT_OUTPUT = {
  topic: 'phishing',
  keywords: {
    core: ['phishing'],
    expanded: ['quishing', 'mfa relay', 'adversary-in-the-middle'],
    contentShape: null
  },
  synthesis: 'Attackers are shifting phishing delivery away from bare links toward QR codes embedded in PDF attachments and real-time relay of one-time passcodes. Employees face two recurring situations: scanning a QR code from a work email on a personal phone, and approving a sign-in prompt they did not start. Both defeat the older advice that focused only on hovering over links, so posters should transfer the check-before-you-act habit to codes and prompts.',
  angles: [
    { id: 'angle-1', title: 'A QR code is a link you cannot read', rationale: 'QR lures bypass link-checking habits; the poster transfers the hover-to-check instinct to codes.' },
    { id: 'angle-2', title: 'Your one-time code is a password too', rationale: 'Relay kits capture passcodes as victims type them; sharing or typing a code on the wrong page hands over the account.' },
    { id: 'angle-3', title: 'Unexpected sign-in prompt? Stop and report', rationale: 'Prompt fatigue is the common thread across current campaigns; one stop-and-report behaviour counters it.' }
  ]
};

export const UNGROUNDED_CONTEXT_OUTPUT = {
  synthesis: 'Phishing remains the most common way attackers reach employees: a message that looks routine asks the reader to open a link, scan a code, or enter login details. The durable counter-behaviours are the same across channels: pause on any unexpected request, reach the site by typing the address yourself, and report the message to the security team instead of replying.',
  angles: [
    { id: 'angle-1', title: 'Unexpected request? Pause first', rationale: 'Urgency is the attacker tool that works across every phishing variant.' },
    { id: 'angle-2', title: 'Type the address yourself', rationale: 'One habit that defeats fake login pages regardless of how the link arrived.' },
    { id: 'angle-3', title: 'Report it, do not reply', rationale: 'Turns every employee into a sensor and keeps the attacker away from the conversation.' }
  ]
};

export const POSTER_CONTENT = {
  headline: 'That Login Page May Be a Trap',
  subheadline: 'Attackers copy real sign-in pages to capture what you type',
  messages: [
    { label: 'RED FLAG', text: 'A QR code in an unexpected email or attachment' },
    { label: 'RED FLAG', text: 'A sign-in prompt you did not start yourself' },
    { label: 'RED FLAG', text: 'A login page reached from an email link' },
    { label: 'DO', text: 'Type the site address yourself before signing in' }
  ],
  callToAction: 'Suspicious message? Forward it to {{SOC_EMAIL}} right away',
  format: 'red-flags'
};

export const POSTER_CONTENT_V2 = {
  headline: 'Pause Before You Scan or Sign In',
  subheadline: null,
  messages: [
    { label: 'RED FLAG', text: 'A QR code arriving by email instead of a plain link' },
    { label: 'RED FLAG', text: 'A one-time code request on a page you did not open' },
    { label: 'DO', text: 'Open the real site from your bookmarks, not the message' },
    { label: 'DO', text: 'Report the message to the security team, do not reply' }
  ],
  callToAction: 'Report suspicious messages to {{SOC_EMAIL}}',
  format: 'red-flags'
};

export const ACCEPT_REVIEW = { status: 'accepted', score: 97, feedback: '', expected: '' };

export const REWORK_REVIEW = {
  status: 'rework',
  score: 82,
  feedback: 'The message "A login page reached from an email link" overlaps with the QR-code red flag — both describe following a delivered pointer. The call to action names no channel for urgent cases.',
  expected: 'Four distinct signals or behaviours with no overlap, and a call to action that names the reporting channel, e.g. forwarding to {{SOC_EMAIL}}.'
};

// ── design phase fixtures (spec §B.6 Path B) ────────────────────────────────
// Layout specs match the normalized POSTER_CONTENT* fixtures (msg-1..msg-4).

export const DESIGN_SPEC = {
  rationale: 'Four parallel warnings read best as a two-by-two card grid under a full-width headline band — each flag gets equal weight and the action line closes the poster.',
  layoutType: 'card-grid',
  background: { mode: 'split', colors: ['#E3AF32', '#F5F0E8'] },
  zones: [
    { role: 'headline', x: 6, y: 4, w: 88, h: 14 },
    { role: 'subheadline', x: 6, y: 19, w: 64, h: 6 },
    { role: 'message', msgId: 'msg-1', x: 6, y: 44, w: 42, h: 13, style: { bg: '#FFFFFF' } },
    { role: 'message', msgId: 'msg-2', x: 52, y: 44, w: 42, h: 13, style: { bg: '#1F1A17' } },
    { role: 'message', msgId: 'msg-3', x: 6, y: 60, w: 42, h: 13, style: { bg: '#FFFFFF' } },
    { role: 'message', msgId: 'msg-4', x: 52, y: 60, w: 42, h: 13, style: { bg: '#1F1A17' } },
    { role: 'cta', x: 6, y: 90, w: 88, h: 8, style: { bg: '#000000', align: 'center' } }
  ],
  decor: [
    { shape: 'line', x: 6, y: 41, w: 88, h: 0.4, color: '#C8102E' },
    { shape: 'circle', x: 86, y: 20, w: 6, h: 6, color: '#C8102E' },
    { shape: 'rect', x: 6, y: 78, w: 20, h: 1, color: '#E3AF32' }
  ],
  imageSlots: [
    { slotId: 'slot-1', x: 62, y: 26, w: 32, h: 13, styleHint: 'flat illustration of a suspicious email on a phone, no text' }
  ]
};

export const DESIGN_SPEC_V2 = {
  rationale: 'A dark rail on the left carries the warnings vertically while the headline and the action own the light right column — stronger scan order than the grid.',
  layoutType: 'warning-rail',
  background: { mode: 'solid', colors: ['#F5F0E8'] },
  zones: [
    { role: 'headline', x: 42, y: 6, w: 54, h: 16 },
    { role: 'subheadline', x: 42, y: 24, w: 54, h: 7 },
    { role: 'message', msgId: 'msg-1', x: 4, y: 8, w: 34, h: 17, style: { bg: '#1F1A17' } },
    { role: 'message', msgId: 'msg-2', x: 4, y: 28, w: 34, h: 17, style: { bg: '#1F1A17' } },
    { role: 'message', msgId: 'msg-3', x: 4, y: 48, w: 34, h: 17, style: { bg: '#1F1A17' } },
    { role: 'message', msgId: 'msg-4', x: 4, y: 68, w: 34, h: 17, style: { bg: '#1F1A17' } },
    { role: 'cta', x: 42, y: 88, w: 54, h: 9, style: { bg: '#C8102E', align: 'center' } }
  ],
  decor: [
    { shape: 'rect', x: 42, y: 34, w: 14, h: 1, color: '#E3AF32' },
    { shape: 'polygon', x: 88, y: 78, w: 8, h: 6, color: '#E3AF32' }
  ],
  imageSlots: [
    { slotId: 'slot-1', x: 42, y: 40, w: 54, h: 42, styleHint: 'illustration of a person pausing before scanning a QR code, no text' }
  ]
};

export const DESIGN_ACCEPT_REVIEW = { status: 'accepted', score: 94, feedback: '', expected: '' };

export const DESIGN_REWORK_REVIEW = {
  status: 'rework',
  score: 76,
  feedback: 'The message zones for msg-3 and msg-4 sit directly on the split boundary, so their computed contrast is borderline, and the cta zone competes with the headline at the same width.',
  expected: 'Message zones clearly inside one background region each, and a cta visually subordinate to the headline (narrower or on its own band).'
};

export const EDIT_CLASSIFICATION = {
  changeType: 'stylistic-preference',
  summary: 'The user shortened the headline and removed the second-person warning tone, preferring a neutral statement.',
  guidance: 'For phishing posters, favor neutral declarative headlines over direct warnings addressed at the reader.'
};

// ── db seeding ──────────────────────────────────────────────────────────────

const SEED_ARTICLES = [
  {
    title: 'QR Code Phishing Surges as Attackers Bypass Email Link Filters',
    url: 'https://www.proofpoint.com/us/blog/qr-code-phishing-surge',
    source: 'Proofpoint Blog',
    description: 'Quishing campaigns embed malicious QR codes in PDF attachments, steering employees to credential-harvesting pages that mimic corporate SSO portals.',
    summary: 'QR lures evade URL scanners; employees should treat QR codes in email like links.',
    type: 'Phishing'
  },
  {
    title: 'Phishing Kit Relays MFA Codes in Real Time to Defeat One-Time Passcodes',
    url: 'https://thehackernews.com/2026/07/mfa-relay-phishing-kit.html',
    source: 'The Hacker News',
    description: 'An adversary-in-the-middle kit proxies the real login page, capturing passwords and one-time codes as victims type them.',
    summary: 'Real-time relay makes shared one-time codes as dangerous as shared passwords.',
    type: 'Phishing'
  },
  {
    title: 'Social Engineering Callback Scams Target Help Desks for Password Resets',
    url: 'https://krebsonsecurity.com/2026/07/helpdesk-callback-scams/',
    source: 'Krebs on Security',
    description: 'Attackers phone help desks impersonating employees to trigger password resets, then log in before the real user notices.',
    summary: 'Verification questions defeat most callback scams; user awareness of reset notifications matters.',
    type: 'Social Engineering'
  }
];

export function seedArticles(db, articles = SEED_ARTICLES) {
  const stmt = db.prepare(`INSERT INTO articles
    (title, url_hash, source, url, description, summary, pub_date, type, relevance_score, tier, fetched_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`);
  const now = new Date().toISOString();
  const recent = now.split('T')[0];
  for (const [i, a] of articles.entries()) {
    stmt.run(a.title, `hash-${i}-${a.url}`, a.source, a.url, a.description, a.summary, recent, a.type, 20 - i, 1, now);
  }
}
