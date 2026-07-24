// Schema-driven content validation (Phase O4, plan D1/D2): ONE validator for
// every v2 template, generated FROM the template's contentSchema — never
// per-template hardcoding. The same module validates generator output (full
// limits) and inline user edits (shape only: field presence + block count,
// no word caps — the user has the final word on wording, spec §B.5).
//
// contentSchema shape (D1):
//   headline / subheadline / callToAction: { required, maxWords }
//   blocks: { kind, min, max, fields: ['question','answer',…],
//             maxWords?: { field: n } }   ← per-field caps, optional
//   imageSlots: 0..3

export function wordCount(s) {
  return String(s || '').trim().split(/\s+/).filter(Boolean).length;
}

function isNonEmptyString(v) {
  return typeof v === 'string' && v.trim().length > 0;
}

function checkTopField(problems, content, schema, key, enforceLengths) {
  const spec = schema[key];
  const value = content[key];
  const required = Boolean(spec?.required);
  if (value == null || (typeof value === 'string' && !value.trim())) {
    if (required) problems.push(`missing "${key}" (non-empty string, required by the template)`);
    return;
  }
  if (typeof value !== 'string') {
    problems.push(`"${key}" must be a string${required ? '' : ' or null'}`);
    return;
  }
  const cap = spec?.maxWords;
  if (enforceLengths && Number.isInteger(cap) && wordCount(value) > cap) {
    problems.push(`${key} is ${wordCount(value)} words ("${value}") — maximum ${cap} for this template`);
  }
}

/**
 * Validate content against a D1 contentSchema. Returns problem strings
 * (empty = valid). enforceLengths=false checks SHAPE only (required fields
 * present, block count within min..max, every schema field a non-empty
 * string) — word caps are skipped (inline-edit path).
 */
export function validateContentAgainstSchema(content, contentSchema, { enforceLengths = true } = {}) {
  const problems = [];
  if (!content || typeof content !== 'object' || Array.isArray(content)) return ['content is not a JSON object'];
  if (!contentSchema || typeof contentSchema !== 'object') return ['contentSchema is required'];

  checkTopField(problems, content, contentSchema, 'headline', enforceLengths);
  checkTopField(problems, content, contentSchema, 'subheadline', enforceLengths);
  checkTopField(problems, content, contentSchema, 'callToAction', enforceLengths);

  const bs = contentSchema.blocks || {};
  const fields = Array.isArray(bs.fields) ? bs.fields : [];
  const min = Number.isInteger(bs.min) ? bs.min : 1;
  const max = Number.isInteger(bs.max) ? bs.max : 8;
  const fieldCaps = (bs.maxWords && typeof bs.maxWords === 'object') ? bs.maxWords : {};

  if (!Array.isArray(content.blocks) || content.blocks.length < min || content.blocks.length > max) {
    const got = Array.isArray(content.blocks) ? `got ${content.blocks.length}` : 'got none';
    problems.push(`"blocks" must be an array of ${min}-${max} ${bs.kind || 'block'} items (${got})`);
  } else {
    content.blocks.forEach((b, i) => {
      if (!b || typeof b !== 'object' || Array.isArray(b)) {
        problems.push(`blocks[${i}] must be an object with fields: ${fields.join(', ')}`);
        return;
      }
      if (b.id != null && typeof b.id !== 'string') {
        problems.push(`blocks[${i}].id must be a string when present`);
      }
      for (const field of fields) {
        if (!isNonEmptyString(b[field])) {
          problems.push(`blocks[${i}].${field} must be a non-empty string (required by kind "${bs.kind}")`);
          continue;
        }
        const cap = fieldCaps[field];
        if (enforceLengths && Number.isInteger(cap) && wordCount(b[field]) > cap) {
          problems.push(`blocks[${i}].${field} is ${wordCount(b[field])} words ("${b[field]}") — maximum ${cap}`);
        }
      }
    });
  }

  return problems;
}

/**
 * Normalize validated v2 content: trim every string, assign sequential
 * 'blk-N' ids (blocks bind to canvas objects positionally via msgId='blk-N'),
 * drop every key the schema does not declare, null empty subheadline.
 * Call ONLY after validateContentAgainstSchema returned no problems.
 */
export function normalizeContentV2(content, contentSchema) {
  const fields = Array.isArray(contentSchema?.blocks?.fields) ? contentSchema.blocks.fields : [];
  const blocks = (Array.isArray(content.blocks) ? content.blocks : []).map((b, i) => {
    const block = { id: `blk-${i + 1}` };
    for (const field of fields) block[field] = String(b[field]).trim();
    return block;
  });
  return {
    headline: String(content.headline).trim(),
    subheadline: isNonEmptyString(content.subheadline) ? content.subheadline.trim() : null,
    blocks,
    callToAction: isNonEmptyString(content.callToAction) ? content.callToAction.trim() : null
  };
}
