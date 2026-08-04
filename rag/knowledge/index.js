// Aggregated multi-framework knowledge corpus. Each framework file exports a
// default array of KnowledgeEntry (rag/knowledge/schema.js); this index
// concatenates them into KNOWLEDGE_CORPUS, which the seeder (scripts/
// build-seed-db.js → seedKnowledge) loads into the `knowledge` table + FTS.
// Adding a framework = author its file + add one import/spread line here.

import gdpr from './gdpr.js';
import dpdp from './dpdp.js';
import ccpa from './ccpa.js';
import hipaa from './hipaa.js';
import pciDss from './pci_dss.js';
import iso27001 from './iso_27001.js';
import nistCsf from './nist_csf.js';
import certin from './certin.js';

export const CORPUS_SOURCES = { gdpr, dpdp, ccpa, hipaa, pciDss, iso27001, nistCsf, certin };

export const KNOWLEDGE_CORPUS = [
  ...gdpr, ...dpdp, ...ccpa, ...hipaa, ...pciDss, ...iso27001, ...nistCsf, ...certin
];

export default KNOWLEDGE_CORPUS;
