// templates/v2/index.js — the v2 template registry (Phase O3, D1 manifest).
// Every registered template is validated against the D1 manifest contract at
// module load (an invalid template is a build error, not a runtime surprise).
// Follow-up template builders: add your module import + one entry to
// TEMPLATES_V2 — validateManifest gates the rest.

import timelineJourney from './timeline_journey.js';
import qaChat from './qa_chat.js';
import bulletBeacon from './bullet_beacon.js';
import bulletSpotlight from './bullet_spotlight.js';
import qaInterview from './qa_interview.js';
import tabularMatrix from './tabular_matrix.js';
import comicStrip from './comic_strip.js';
import comicReveal from './comic_reveal.js';
import statementBold from './statement_bold.js';
import scenarioResponse from './scenario_response.js';
import infoFlow from './info_flow.js';
import infoLayers from './info_layers.js';
import treeDecision from './tree_decision.js';
import statsImpact from './stats_impact.js';
import statsGauge from './stats_gauge.js';
import statsHorizon from './stats_horizon.js';
import infoCommandCenter from './info_command_center.js';
import magEditorial from './mag_editorial.js';
import chatDeepdive from './chat_deepdive.js';
import comicSaga from './comic_saga.js';
import layeredBriefing from './layered_briefing.js';
// I4 night-family: 10 predominantly-black, gradient-lit infographic templates
import neonGrid from './neon_grid.js';
import threatRadar from './threat_radar.js';
import glassStack from './glass_stack.js';
import hexCells from './hex_cells.js';
import caseFile from './case_file.js';
import spotlightQuote from './spotlight_quote.js';
import orbitPath from './orbit_path.js';
import verdictBranches from './verdict_branches.js';
import tickerTape from './ticker_tape.js';
import impactBurst from './impact_burst.js';
// I6 image-first premium family (cinematic full-bleed, imagery-dominant)
import cinematicCover from './cinematic_cover.js';
import imageMosaic from './image_mosaic.js';
import editorialHero from './editorial_hero.js';
import featureSpread from './feature_spread.js';
// I7 panoramic, aurora, swiss, photo-essay
import splitPanorama from './split_panorama.js';
import auroraGlass from './aurora_glass.js';
import swissMinimal from './swiss_minimal.js';
import photoEssay from './photo_essay.js';
// I9 client-supplied AB InBev security posters (native v2 ports)
import holidayScams from './holiday_scams.js';
import guardYourData from './guard_your_data.js';
import lockItDown from './lock_it_down.js';
import futureIsNow from './future_is_now.js';
import trustButVerify from './trust_but_verify.js';
import updateStaySafe from './update_stay_safe.js';
import phoneAlert from './phone_alert.js';
import phoneAlertEn from './phone_alert_en.js';
import safeShoppingSplit from './safe_shopping_split.js';
import incidentPhotoHero from './incident_photo_hero.js';
import dataPrivacyPanels from './data_privacy_panels.js';
import accessControlPolicy from './access_control_policy.js';
import accessControlPolicyZh from './access_control_policy_zh.js';
import tipsCard from './tips_card.js';
import passwordsStatTips from './passwords_stat_tips.js';
import otSecurityImpact from './ot_security_impact.js';
import cyberMonthAgenda from './cyber_month_agenda.js';
import webinarInvite from './webinar_invite.js';
import iotExplainer from './iot_explainer.js';
import ransomwareChecklist from './ransomware_checklist.js';
import gispReleaseNumbered from './gisp_release_numbered.js';
import samPolicyNumbered from './sam_policy_numbered.js';
import fossPolicyFlyer from './foss_policy_flyer.js';
import incidentPolicySeverity from './incident_policy_severity.js';
import constellationBeforeAfter from './constellation_before_after.js';
// O10 enterprise corporate family
import executiveBriefing from './executive_briefing.js';
import riskHeatmap from './risk_heatmap.js';
import complianceCertificate from './compliance_certificate.js';
import trainingModule from './training_module.js';
import policySummary from './policy_summary.js';
import governancePillars from './governance_pillars.js';
import auditTrail from './audit_trail.js';
import securityPledge from './security_pledge.js';
import incidentTimeline from './incident_timeline.js';
import microLearning from './micro_learning.js';
import dataClassification from './data_classification.js';
// O11 infographic/analytics family
import threatLandscape from './threat_landscape.js';
import securityCalendar from './security_calendar.js';
import phishingDrill from './phishing_drill.js';
import breachCost from './breach_cost.js';
import privacyRights from './privacy_rights.js';
import mfaJourney from './mfa_journey.js';
import securityStack from './security_stack.js';
// O12 distinct-layout family (brutalist, isometric, magazine, ring dashboard)
import posterBrutal from './poster_brutal.js';
import isoGrid from './iso_grid.js';
import magCover from './mag_cover.js';
import dataRing from './data_ring.js';
import roadmapMiles from './roadmap_miles.js';
import splitCollage from './split_collage.js';
import { validateManifest } from './manifest_schema.js';
import {
  canvasDims, ORIENTATIONS, PORTRAIT_W, PORTRAIT_H, LANDSCAPE_W, LANDSCAPE_H
} from './decor.js';
import { DEFAULT_PALETTE, DEFAULT_FONTS } from '../palette.js';

export { ORIENTATIONS, PORTRAIT_W, PORTRAIT_H, LANDSCAPE_W, LANDSCAPE_H };

const TEMPLATES_V2 = [
  timelineJourney,
  qaChat,
  bulletBeacon,
  bulletSpotlight,
  qaInterview,
  tabularMatrix,
  comicStrip,
  comicReveal,
  statementBold,
  scenarioResponse,
  infoFlow,
  infoLayers,
  treeDecision,
  statsImpact,
  statsGauge,
  statsHorizon,
  infoCommandCenter,
  magEditorial,
  chatDeepdive,
  comicSaga,
  layeredBriefing,
  neonGrid,
  threatRadar,
  glassStack,
  hexCells,
  caseFile,
  spotlightQuote,
  orbitPath,
  verdictBranches,
  tickerTape,
  impactBurst,
  cinematicCover,
  imageMosaic,
  editorialHero,
  featureSpread,
  splitPanorama,
  auroraGlass,
  swissMinimal,
  photoEssay,
  holidayScams,
  guardYourData,
  lockItDown,
  futureIsNow,
  trustButVerify,
  updateStaySafe,
  phoneAlert,
  phoneAlertEn,
  safeShoppingSplit,
  incidentPhotoHero,
  dataPrivacyPanels,
  accessControlPolicy,
  accessControlPolicyZh,
  tipsCard,
  passwordsStatTips,
  otSecurityImpact,
  cyberMonthAgenda,
  webinarInvite,
  iotExplainer,
  ransomwareChecklist,
  gispReleaseNumbered,
  samPolicyNumbered,
  fossPolicyFlyer,
  incidentPolicySeverity,
  constellationBeforeAfter,
  executiveBriefing,
  riskHeatmap,
  complianceCertificate,
  trainingModule,
  policySummary,
  governancePillars,
  auditTrail,
  securityPledge,
  incidentTimeline,
  microLearning,
  dataClassification,
    threatLandscape,
    securityCalendar,
    phishingDrill,
    breachCost,
    privacyRights,
    mfaJourney,
    securityStack,
  posterBrutal,
  isoGrid,
  magCover,
  dataRing,
  roadmapMiles,
  splitCollage
];

// fail-loud load-time validation: bad manifests never reach the gallery
{
  const ids = new Set();
  for (const t of TEMPLATES_V2) {
    const problems = validateManifest(t);
    if (problems.length) {
      throw new Error(`v2 template "${t && t.id}" fails the manifest contract: ${problems.join('; ')}`);
    }
    if (ids.has(t.id)) throw new Error(`v2 template id "${t.id}" registered twice`);
    ids.add(t.id);
  }
}

/** Full template module (with build functions) by id, or null. */
export function getTemplateV2(id) {
  return TEMPLATES_V2.find((t) => t.id === id) || null;
}

/**
 * Gallery listing: serializable metadata only — id/name/style/description/
 * contentSchema/editable + rendered preview SVGs for both orientations. No
 * build functions cross this boundary (the list is JSON-safe for API
 * responses).
 */
export function listTemplatesV2(palette = DEFAULT_PALETTE) {
  return TEMPLATES_V2.map((t) => ({
    id: t.id,
    name: t.name,
    style: t.style,
    description: t.description,
    contentSchema: structuredClone(t.contentSchema),
    editable: { ...t.editable },
    previews: {
      portrait: t.preview.portrait(palette),
      landscape: t.preview.landscape(palette)
    }
  }));
}

/**
 * Build the canvas JSON for a template in one orientation.
 * - orientation must be 'portrait' | 'landscape' (throws otherwise)
 * - content is the D2 schema-driven shape {headline, subheadline, blocks,
 *   callToAction}; block ids are normalized to 'blk-N' when missing
 * - palette/fonts default to the brand defaults (callers pass the
 *   vault-resolved brand via applyBrandOverride/resolveBrand)
 */
export function buildCanvas(id, orientation, content, palette = DEFAULT_PALETTE, fonts = DEFAULT_FONTS) {
  const t = getTemplateV2(id);
  if (!t) throw new Error(`unknown v2 template "${id}"`);
  if (!ORIENTATIONS.includes(orientation)) {
    throw new Error(`unknown orientation "${orientation}" (expected portrait|landscape)`);
  }
  if (!content || typeof content !== 'object') throw new Error('content is required');

  const normalized = structuredClone(content);
  normalized.blocks = (Array.isArray(normalized.blocks) ? normalized.blocks : []).map((b, i) => ({
    ...b, id: typeof b.id === 'string' && b.id ? b.id : `blk-${i + 1}`
  }));

  const canvas = t.build[orientation](normalized, palette, fonts);

  const { w, h } = canvasDims(orientation);
  if (canvas.width !== w || canvas.height !== h) {
    throw new Error(`template "${id}" built ${canvas.width}x${canvas.height} for ${orientation}, expected ${w}x${h}`);
  }
  return canvas;
}
