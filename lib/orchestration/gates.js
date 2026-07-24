// Gate engine: numeric quality checkpoints. Failing a gate returns a rework
// instruction carrying the panel's specific feedback — never a bare rejection.

export const GATES = {
  studioDeliverable: { threshold: 98, description: 'Studio deliverables (code, designs, docs) — spec §A.5' },
  posterContent: { threshold: 95, description: 'Poster content quality — spec §B.5' },
  designQuality: { threshold: 90, description: 'Dynamic design mockup quality — spec §B.6 Path B' },
  translationFidelity: { threshold: 95, description: 'Translation back-check fidelity — spec §B.11' },
  imageZeroText: { threshold: 100, description: 'Zero text inside generated images — spec §B.7 hard rule' },
  imageAesthetic: { threshold: 70, description: 'Generated-image aesthetic quality + on-brief adherence — soft gate (fails open)' },
  imageBackground: { threshold: 70, description: 'Rendered background craft + treatment fit + text legibility — soft gate (fails open)' },
  securityReview: { threshold: 90, description: 'Chief Security Officer OWASP+STRIDE pass — any confirmed high/critical finding fails the gate → Rework' },
  craftsmanship: { threshold: 90, description: 'Code Structure & Craftsmanship pass — any blocker or 2+ majors fails the gate → Rework' }
};

export class GateEngine {
  constructor({ bus, gates = GATES } = {}) {
    this.bus = bus;
    this.gates = gates;
  }

  /**
   * Check verdicts against a named gate. All reviewer scores must clear the
   * threshold AND no reviewer may have issued rework/rejected.
   * Emits a gate_check event and returns { passed, score, failures }.
   */
  check({ gateName, runId, project, pipeline, stage, verdicts, parentEventId = null }) {
    const gate = this.gates[gateName];
    if (!gate) throw new Error(`Unknown gate: ${gateName}`);
    if (!Array.isArray(verdicts) || verdicts.length === 0) {
      throw new Error(`Gate ${gateName} checked with no verdicts — a gate without reviewers is not a gate`);
    }
    for (const v of verdicts) {
      if (typeof v.score !== 'number' || Number.isNaN(v.score) || !['accepted', 'rework', 'rejected'].includes(v.status)) {
        throw new Error(`Gate ${gateName} received a malformed verdict (status=${v.status}, score=${v.score}) — malformed verdicts are errors, not failures`);
      }
    }
    const score = Math.min(...verdicts.map((v) => v.score));
    const failures = verdicts.filter((v) => v.status !== 'accepted' || v.score < gate.threshold);
    const passed = failures.length === 0 && score >= gate.threshold;

    const feedback = passed
      ? ''
      : failures.map((f) => `[${f.reviewer || 'reviewer'}] score ${f.score}: ${f.feedback || 'below threshold'}`).join('\n');
    const expected = passed
      ? ''
      : failures.map((f) => `[${f.reviewer || 'reviewer'}] ${f.expected || `score >= ${gate.threshold}`}`).join('\n');

    if (this.bus) {
      this.bus.emit({
        runId, project, pipeline, stage,
        agent: 'harness',
        skill: 'enforce_gates',
        type: 'gate_check',
        payload: { gateName, threshold: gate.threshold, reviewerCount: verdicts.length },
        verdict: {
          status: passed ? 'accepted' : 'rework',
          score,
          ...(passed ? {} : { feedback, expected })
        },
        parentEventId
      });
    }
    return { passed, score, threshold: gate.threshold, failures, feedback, expected };
  }
}
