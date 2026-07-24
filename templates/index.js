// Template registry (spec §B.6 Path A): the 12 predefined templates in
// gallery order. Every module exports the same shape —
// { id, name, description, suitedFor, preview(palette), build(content, palette, fonts) }.
// recommendFor() reorders the gallery so templates suited to the approved
// content's shape come first (the UI badges them "recommended").

import boldSplit from './bold_split.js';
import redFlagsColumn from './red_flags_column.js';
import dosDontsDuel from './dos_donts_duel.js';
import scenarioStrip from './scenario_strip.js';
import statPoster from './stat_poster.js';
import treeBranch from './tree_branch.js';
import tabularGrid from './tabular_grid.js';
import minimalClean from './minimal_clean.js';
import diagonalEnergy from './diagonal_energy.js';
import badgeFocus from './badge_focus.js';
import darkAlert from './dark_alert.js';
import layeredCards from './layered_cards.js';

const TEMPLATES = [
  boldSplit, redFlagsColumn, dosDontsDuel, scenarioStrip, statPoster,
  treeBranch, tabularGrid, minimalClean, diagonalEnergy, badgeFocus,
  darkAlert, layeredCards
];

/** All templates in gallery order. */
export function list() {
  return [...TEMPLATES];
}

/** Template by id, or null (callers map null to UNKNOWN_TEMPLATE). */
export function get(id) {
  return TEMPLATES.find((t) => t.id === id) || null;
}

/**
 * Gallery reordered for a content shape (content.format): templates whose
 * suitedFor lists the shape first (gallery order preserved within each group).
 * Unknown/absent shapes return the plain gallery order.
 */
export function recommendFor(contentShape) {
  if (!contentShape) return list();
  const suited = TEMPLATES.filter((t) => t.suitedFor.includes(contentShape));
  const rest = TEMPLATES.filter((t) => !t.suitedFor.includes(contentShape));
  return [...suited, ...rest];
}
