// Lightweight event validation against shared/schemas/event.schema.json.
// Hand-rolled (no ajv) so the validator itself is fully debuggable and dependency-free.

const EVENT_TYPES = new Set([
  'stage_start', 'stage_end', 'agent_output', 'handoff', 'review_verdict',
  'gate_check', 'rework', 'user_action', 'override', 'error', 'memory_write'
]);

const PROJECTS = new Set(['studio', 'poster-app']);
const VERDICT_STATUSES = new Set(['accepted', 'rework', 'rejected']);
const REQUIRED_FIELDS = ['eventId', 'ts', 'runId', 'project', 'pipeline', 'stage', 'agent', 'type'];

/**
 * Validate a pipeline event. Returns { ok: true } or { ok: false, errors: string[] }.
 * Enforces the spec rule that verdicts are never bare: rework/rejected verdicts
 * MUST carry feedback ("what is wrong / missing") and expected ("what good looks like").
 */
export function validateEvent(event) {
  const errors = [];
  if (!event || typeof event !== 'object') {
    return { ok: false, errors: ['event must be an object'] };
  }
  for (const field of REQUIRED_FIELDS) {
    if (typeof event[field] !== 'string' || event[field].length === 0) {
      errors.push(`missing or empty required field: ${field}`);
    }
  }
  if (event.project && !PROJECTS.has(event.project)) {
    errors.push(`project must be one of ${[...PROJECTS].join(', ')}; got "${event.project}"`);
  }
  if (event.type && !EVENT_TYPES.has(event.type)) {
    errors.push(`type must be one of ${[...EVENT_TYPES].join(', ')}; got "${event.type}"`);
  }
  if (event.type === 'review_verdict' || event.type === 'gate_check') {
    if (!event.verdict || typeof event.verdict !== 'object') {
      errors.push(`${event.type} events require a verdict object`);
    } else {
      const v = event.verdict;
      if (!VERDICT_STATUSES.has(v.status)) {
        errors.push(`verdict.status must be one of ${[...VERDICT_STATUSES].join(', ')}; got "${v.status}"`);
      }
      if (typeof v.score !== 'number' || !Number.isFinite(v.score) || v.score < 0 || v.score > 100) {
        errors.push(`verdict.score must be a number 0-100; got ${v.score}`);
      }
      if (v.status && v.status !== 'accepted') {
        if (typeof v.feedback !== 'string' || v.feedback.trim().length < 10) {
          errors.push('non-accepted verdicts require specific feedback (what is wrong, what is missing) — bare rejections are forbidden');
        }
        if (typeof v.expected !== 'string' || v.expected.trim().length < 10) {
          errors.push('non-accepted verdicts require "expected" (what good looks like)');
        }
      }
    }
  }
  if (event.payload != null && typeof event.payload !== 'object') {
    errors.push('payload must be an object when present');
  }
  if (event.parentEventId != null && typeof event.parentEventId !== 'string') {
    errors.push('parentEventId must be a string or null');
  }
  return errors.length ? { ok: false, errors } : { ok: true };
}

export { EVENT_TYPES, PROJECTS, VERDICT_STATUSES };
