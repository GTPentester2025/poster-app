// India's Digital Personal Data Protection Act, 2023 (DPDP Act) — clean,
// schema-conformant knowledge corpus. One entry per section across the Act's
// nine chapters (44 sections), plus a set of entries paraphrasing the Draft
// DPDP Rules, 2025 (consent, notice, breach intimation, children's-data
// verification, Consent Managers, Data Protection Board procedure,
// cross-border transfer, significant data fiduciaries).
//
// Content policy (see schema.js): `summary`/`text` are AUTHORITATIVE
// PARAPHRASE — accurate, plain-language, never a verbatim statute dump.
// `level` 0 = enacted Act (authoritative statute); `level` 1 = Draft Rules
// (subordinate legislation / guidance). Penalties are set out in the Act's
// Schedule and are attached to the section they map to.
//
// @typedef {import('./schema.js').KnowledgeEntry} KnowledgeEntry

/** @type {import('./schema.js')} */ // for editor hints; not required at runtime

/** @type {Array<object>} */
const entries = [
  // ══════════════════════════════════════════════════════════════════════
  // CHAPTER I — PRELIMINARY (§§ 1–3)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dpdp-s-1',
    framework: 'DPDP',
    citation: 'DPDP §1',
    level: 0,
    region: 'IN',
    title: 'Short Title and Commencement',
    summary: 'Names the statute the Digital Personal Data Protection Act, 2023 and provides that it comes into force on dates notified by the Central Government, allowing different provisions to be commenced separately.',
    text: 'Section 1 gives the Act its short title — the Digital Personal Data Protection Act, 2023 — and provides for phased commencement. Different provisions may be brought into force on different dates appointed by notification of the Central Government, so obligations are not all enforceable at once. Organisations should track commencement notifications to know which duties are live.',
    obligations: ['Monitor Central Government commencement notifications to know which provisions are in force'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['commencement', 'scope', 'short-title', 'notification'],
    posterAngles: [
      'DPDP is law — provisions switch on by government notification, so track effective dates',
      'Compliance is a moving target: know which parts of the Act apply today'
    ]
  },
  {
    id: 'dpdp-s-2',
    framework: 'DPDP',
    citation: 'DPDP §2',
    level: 0,
    region: 'IN',
    title: 'Definitions',
    summary: 'Defines the Act\'s core terms — including personal data, data principal, data fiduciary, data processor, consent, processing, Consent Manager, Data Protection Board and significant data fiduciary.',
    text: 'Section 2 is the definitions clause. Personal data means any data about an identifiable individual; a Data Principal is the individual the data relates to (including, for a child, parents/guardians); a Data Fiduciary decides the purpose and means of processing; a Data Processor processes data on a fiduciary\'s behalf. It also defines consent, processing, Consent Manager, the Data Protection Board of India, and gains, loss and personal data breach — the vocabulary the rest of the Act relies on.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-processors', 'data-principals'],
    topics: ['definitions', 'personal-data', 'data-principal', 'data-fiduciary', 'data-processor', 'consent-manager'],
    posterAngles: [
      'Know the roles: Data Principal (you), Data Fiduciary (decides why/how), Data Processor (acts on their behalf)',
      '"Personal data" = any data that can identify a person — treat it accordingly'
    ]
  },
  {
    id: 'dpdp-s-3',
    framework: 'DPDP',
    citation: 'DPDP §3',
    level: 0,
    region: 'IN',
    title: 'Application of the Act',
    summary: 'The Act applies to digital personal data processed in India, and to processing outside India that is connected with offering goods or services to data principals in India; it exempts personal or domestic use and lawfully made-public data.',
    text: 'Section 3 sets territorial and material scope. The Act covers personal data collected in digital form, or collected non-digitally and later digitised, when processed within India. It also has extraterritorial reach: processing outside India is covered where it is in connection with offering goods or services to Data Principals within India. It does not apply to personal data processed by an individual for purely personal or domestic purposes, or to data a Data Principal (or a person under legal duty) has made publicly available.',
    obligations: ['Apply DPDP to India-connected processing even when carried out from outside India', 'Assess whether offerings to individuals in India trigger extraterritorial application'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['scope', 'territorial-scope', 'extraterritorial', 'digital-personal-data', 'exemptions'],
    posterAngles: [
      'Serving customers in India? DPDP can apply even if your servers are abroad',
      'Purely personal or domestic data use is outside the Act — business use is not'
    ]
  },

  // ══════════════════════════════════════════════════════════════════════
  // CHAPTER II — OBLIGATIONS OF DATA FIDUCIARY (§§ 4–10)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dpdp-s-4',
    framework: 'DPDP',
    citation: 'DPDP §4',
    level: 0,
    region: 'IN',
    title: 'Grounds for Processing Personal Data',
    summary: 'Personal data may be processed only for a lawful purpose and only on one of two bases: the data principal\'s consent, or certain "legitimate uses" specified in the Act.',
    text: 'Section 4 establishes the lawful basis rule. A Data Fiduciary may process a Data Principal\'s personal data only for a lawful purpose (one not expressly forbidden by law) and only after either obtaining valid consent under §6, or relying on one of the "certain legitimate uses" set out in §7. There is no processing without a lawful basis — consent or legitimate use is the gateway to every downstream activity.',
    obligations: ['Process personal data only for a lawful purpose', 'Establish consent (§6) or a legitimate use (§7) before processing', 'Record the lawful basis relied on for each processing purpose'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['lawful-basis', 'consent', 'legitimate-use', 'purpose', 'data-fiduciary'],
    posterAngles: [
      'No processing without a lawful basis — get consent or fit a legitimate use, every time',
      'Ask "what is our lawful purpose?" before you collect any personal data'
    ]
  },
  {
    id: 'dpdp-s-5',
    framework: 'DPDP',
    citation: 'DPDP §5',
    level: 0,
    region: 'IN',
    title: 'Notice',
    summary: 'Before or when seeking consent, the data fiduciary must give the data principal a clear notice describing the personal data collected, the purpose, how to exercise rights, and how to complain to the Board.',
    text: 'Section 5 requires a Data Fiduciary to accompany (or precede) each consent request with a plain, clear notice. The notice must state the personal data to be collected and the purpose of processing, how the Data Principal may exercise their rights and withdraw consent, and how to make a complaint to the Data Protection Board. The notice must be available in English or any language in the Eighth Schedule to the Constitution, and — for consent already obtained before the Act — a similar notice must be given as soon as reasonably practicable.',
    obligations: ['Provide an itemised notice of the data and purpose before/at the time of consent', 'Explain how to exercise rights, withdraw consent and complain to the Board', 'Offer the notice in English or a scheduled Indian language', 'Send retrospective notice for consent obtained before the Act commenced'],
    penalties: null,
    appliesTo: ['data-fiduciaries'],
    topics: ['notice', 'consent', 'transparency', 'data-principal-rights', 'language'],
    posterAngles: [
      'Every consent needs a clear notice: what data, why, and how to say no later',
      'Notice must be understandable — plain language, in a language the person reads'
    ]
  },
  {
    id: 'dpdp-s-6',
    framework: 'DPDP',
    citation: 'DPDP §6',
    level: 0,
    region: 'IN',
    title: 'Consent',
    summary: 'Consent must be free, specific, informed, unconditional and unambiguous with a clear affirmative action, limited to the stated purpose, and withdrawable as easily as it was given.',
    text: 'Section 6 defines valid consent: it must be free, specific, informed, unconditional and unambiguous, signalled by a clear affirmative action, and confined to the personal data necessary for the specified purpose. The Data Principal may withdraw consent at any time, and withdrawal must be as easy as giving it; on withdrawal the fiduciary (and its processors) must stop processing within a reasonable time unless another law requires retention. Any request for consent must be clear and plain, and Data Principals may exercise or withdraw consent through a Consent Manager.',
    obligations: ['Obtain consent that is free, specific, informed, unconditional and unambiguous', 'Limit processing to the data necessary for the specified purpose', 'Make withdrawal of consent as easy as giving it', 'Cease processing (and instruct processors to stop) on withdrawal, absent a legal retention duty'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['consent', 'withdrawal', 'purpose-limitation', 'consent-manager', 'data-minimisation'],
    posterAngles: [
      'Real consent is free, specific and informed — pre-ticked boxes do not count',
      'Withdrawing consent must be as easy as giving it — then processing stops'
    ]
  },
  {
    id: 'dpdp-s-7',
    framework: 'DPDP',
    citation: 'DPDP §7',
    level: 0,
    region: 'IN',
    title: 'Certain Legitimate Uses',
    summary: 'Lists the non-consent grounds for processing: voluntary provision for a purpose, State functions/subsidies, legal obligations, medical emergencies, disasters, and employment-related purposes, among others.',
    text: 'Section 7 sets out "certain legitimate uses" that permit processing without fresh consent. These include: where the Data Principal voluntarily provided data for a purpose and has not objected; provision of subsidies, benefits, services, licences or permits by the State; compliance with a legal obligation or court order; responding to a medical emergency or threat to life; providing medical treatment or safety during an epidemic or public-health event; ensuring safety or assistance during a disaster or breakdown of public order; and processing for employment purposes or to safeguard the employer from loss (e.g., preventing corporate espionage, providing services/benefits to employees).',
    obligations: ['Rely on a listed legitimate use only where its specific conditions are met', 'Do not treat legitimate use as a general licence — each ground is narrowly scoped', 'Continue to honour purpose limitation and other fiduciary duties when relying on legitimate use'],
    penalties: null,
    appliesTo: ['data-fiduciaries'],
    topics: ['legitimate-use', 'lawful-basis', 'employment', 'medical-emergency', 'state-function'],
    posterAngles: [
      'Some processing needs no consent — but only for the specific legitimate uses the Act lists',
      'Employment data can be processed as a legitimate use — still only for genuine work purposes'
    ]
  },
  {
    id: 'dpdp-s-8',
    framework: 'DPDP',
    citation: 'DPDP §8',
    level: 0,
    region: 'IN',
    title: 'General Obligations of Data Fiduciary',
    summary: 'The data fiduciary is responsible for compliance (even via processors), must keep data accurate and complete where it affects decisions, implement reasonable security safeguards, notify breaches, erase data when the purpose is served, and appoint a contact for grievances.',
    text: 'Section 8 is the core accountability provision. The Data Fiduciary remains responsible for complying with the Act for all processing it undertakes or that a Data Processor undertakes on its behalf, and may engage processors only under a valid contract. It must ensure data is complete, accurate and consistent where used to make a decision affecting the principal or where disclosed to another fiduciary; implement appropriate technical and organisational measures and reasonable security safeguards to prevent breaches; give the Board and affected principals notice of any personal data breach; and erase personal data (and cause its processor to erase it) once consent is withdrawn or the purpose is no longer being served, unless retention is required by law. It must also publish the contact details of a Data Protection Officer or a person able to answer questions and establish an effective grievance-redressal mechanism.',
    obligations: ['Remain accountable for compliance across your own and your processors\' processing', 'Engage processors only under a valid contract', 'Keep personal data accurate, complete and consistent where it drives decisions or is shared', 'Implement reasonable security safeguards to prevent personal data breaches', 'Notify the Data Protection Board and affected principals of any breach', 'Erase personal data once the purpose is served or consent is withdrawn, absent a legal retention duty', 'Publish contact details of a DPO/contact person and run an effective grievance-redressal mechanism'],
    penalties: 'Breach of the obligation to take reasonable security safeguards to prevent a personal data breach: penalty up to ₹250 crore. Failure to notify the Board/affected principals of a breach: up to ₹200 crore.',
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['security-safeguards', 'breach', 'accuracy', 'erasure', 'accountability', 'grievance-redressal', 'data-fiduciary'],
    posterAngles: [
      'The fiduciary stays accountable even when a vendor processes the data — pick and contract carefully',
      'Reasonable security safeguards are a legal duty — weak controls can cost up to ₹250 crore',
      'When the purpose ends or consent is withdrawn, erase the data — do not hoard it',
      'Publish a real grievance contact and answer data-principal questions promptly'
    ]
  },
  {
    id: 'dpdp-s-9',
    framework: 'DPDP',
    citation: 'DPDP §9',
    level: 0,
    region: 'IN',
    title: 'Processing of Personal Data of Children',
    summary: 'Before processing a child\'s or disabled person\'s data, the fiduciary must obtain verifiable parental/guardian consent and must not undertake tracking, behavioural monitoring or targeted advertising directed at children or processing likely to cause them harm.',
    text: 'Section 9 gives special protection to children (under 18) and persons with disabilities who have a lawful guardian. Before processing a child\'s personal data, the Data Fiduciary must obtain verifiable consent of the parent or lawful guardian, and must obtain guardian consent for a person with a disability. It prohibits processing likely to cause any detrimental effect on the well-being of a child, and forbids tracking or behavioural monitoring of children and targeted advertising directed at children. The Central Government may, by notification, exempt classes of fiduciaries or purposes from some of these restrictions where processing is done in a verifiably safe manner.',
    obligations: ['Obtain verifiable parental/guardian consent before processing a child\'s data', 'Obtain lawful-guardian consent before processing data of a person with a disability', 'Do not process children\'s data in a way likely to harm their well-being', 'Do not track, behaviourally monitor, or serve targeted advertising to children'],
    penalties: 'Breach of the additional obligations regarding children (including failing to obtain verifiable parental consent or engaging in tracking/targeted advertising): penalty up to ₹200 crore.',
    appliesTo: ['data-fiduciaries'],
    topics: ['children', 'parental-consent', 'age-verification', 'targeted-advertising', 'tracking', 'well-being'],
    posterAngles: [
      'Children\'s data needs verifiable parental consent — no shortcuts',
      'No tracking, behavioural profiling or targeted ads aimed at children — full stop',
      'Never process a child\'s data in a way that could harm their well-being — penalties reach ₹200 crore'
    ]
  },
  {
    id: 'dpdp-s-10',
    framework: 'DPDP',
    citation: 'DPDP §10',
    level: 0,
    region: 'IN',
    title: 'Additional Obligations of Significant Data Fiduciaries',
    summary: 'Fiduciaries notified as "significant" (based on data volume, sensitivity and risk factors) must appoint an India-based Data Protection Officer and an independent auditor, and carry out periodic Data Protection Impact Assessments and audits.',
    text: 'Section 10 lets the Central Government notify any Data Fiduciary, or class of fiduciaries, as a Significant Data Fiduciary based on factors such as the volume and sensitivity of personal data processed, risk to Data Principals\' rights, potential impact on India\'s sovereignty, integrity, electoral democracy, security of the State and public order. A Significant Data Fiduciary must appoint a Data Protection Officer based in India who reports to its board (and is the point of contact for grievances), appoint an independent data auditor, and undertake periodic Data Protection Impact Assessments and audits and other prescribed measures.',
    obligations: ['Appoint an India-based Data Protection Officer reporting to the board', 'Appoint an independent data auditor to evaluate compliance', 'Carry out periodic Data Protection Impact Assessments', 'Undertake periodic data audits and other prescribed measures'],
    penalties: 'Failure to meet these additional obligations falls under the general residuary penalty of up to ₹50 crore (Schedule).',
    appliesTo: ['significant-data-fiduciaries'],
    topics: ['significant-data-fiduciary', 'dpo', 'data-audit', 'dpia', 'risk-assessment'],
    posterAngles: [
      'Named a Significant Data Fiduciary? You need an India-based DPO, an auditor, and regular DPIAs',
      'Higher risk means higher duty — impact assessments and audits become mandatory'
    ]
  },

  // ══════════════════════════════════════════════════════════════════════
  // CHAPTER III — RIGHTS AND DUTIES OF DATA PRINCIPAL (§§ 11–15)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dpdp-s-11',
    framework: 'DPDP',
    citation: 'DPDP §11',
    level: 0,
    region: 'IN',
    title: 'Right to Access Information about Personal Data',
    summary: 'A data principal who has given consent may obtain a summary of the personal data being processed, the processing activities, and the identities of other fiduciaries/processors with whom the data has been shared.',
    text: 'Section 11 gives the Data Principal a right of access. On request, a Data Fiduciary must provide a summary of the personal data being processed and of the processing activities undertaken, the identities of all other Data Fiduciaries and processors with whom the data has been shared (together with a description of the data shared), and any other prescribed information. This right applies to processing based on the principal\'s consent, not to sharing done for authorised law-enforcement purposes.',
    obligations: ['Provide, on request, a summary of the personal data and processing activities', 'Disclose the identities of fiduciaries/processors with whom data was shared and what was shared', 'Respond within any prescribed manner and period'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['access-right', 'transparency', 'data-principal-rights', 'data-sharing'],
    posterAngles: [
      'Individuals can ask what data you hold and who you shared it with — be ready to answer',
      'Access requests are a legal right, not a favour — have a process to fulfil them'
    ]
  },
  {
    id: 'dpdp-s-12',
    framework: 'DPDP',
    citation: 'DPDP §12',
    level: 0,
    region: 'IN',
    title: 'Right to Correction and Erasure of Personal Data',
    summary: 'A data principal may require correction of inaccurate/misleading data, completion of incomplete data, updating, and erasure of personal data that is no longer necessary for the purpose it was collected for.',
    text: 'Section 12 gives the Data Principal the right to correction, completion, updating and erasure of personal data processed on their consent. On such a request the Data Fiduciary must correct inaccurate or misleading data, complete incomplete data, update it, and erase personal data unless retention is necessary for the specified purpose or to comply with a law. This lets individuals keep their records accurate and have data deleted once it is no longer needed.',
    obligations: ['Correct inaccurate or misleading personal data on request', 'Complete incomplete data and update it as requested', 'Erase personal data on request unless retention is required for the purpose or by law'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['correction', 'erasure', 'data-quality', 'data-principal-rights', 'retention'],
    posterAngles: [
      'People can demand you fix wrong data and delete data you no longer need',
      'Keep only what the purpose requires — erasure requests must be honoured'
    ]
  },
  {
    id: 'dpdp-s-13',
    framework: 'DPDP',
    citation: 'DPDP §13',
    level: 0,
    region: 'IN',
    title: 'Right of Grievance Redressal',
    summary: 'A data principal has the right to a readily available means of grievance redressal from the data fiduciary or consent manager, which must respond within a prescribed period, before approaching the Board.',
    text: 'Section 13 gives every Data Principal the right to a readily available means of registering a grievance with the Data Fiduciary or Consent Manager about any act or omission regarding their rights or the performance of obligations. The fiduciary or Consent Manager must respond to the grievance within the period prescribed by the Rules. The Data Principal must exhaust this grievance mechanism before approaching the Data Protection Board.',
    obligations: ['Provide a readily available grievance-redressal mechanism', 'Respond to grievances within the prescribed period', 'Treat grievance redressal as the first step before Board escalation'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['grievance-redressal', 'data-principal-rights', 'complaints', 'consent-manager'],
    posterAngles: [
      'Give people an easy way to complain — and actually respond in time',
      'Grievance redressal comes first; the Board is the escalation, not the front door'
    ]
  },
  {
    id: 'dpdp-s-14',
    framework: 'DPDP',
    citation: 'DPDP §14',
    level: 0,
    region: 'IN',
    title: 'Right to Nominate',
    summary: 'A data principal may nominate another individual to exercise their rights under the Act in the event of the principal\'s death or incapacity.',
    text: 'Section 14 gives the Data Principal the right to nominate, in the prescribed manner, any other individual who may exercise the Principal\'s rights under the Act in the event of the Principal\'s death or incapacity (unsoundness of mind or infirmity of body). This ensures a person\'s data rights can be managed responsibly when they can no longer act for themselves.',
    obligations: ['Provide a mechanism for Data Principals to record a nominee', 'Honour a nominee\'s exercise of rights on the principal\'s death or incapacity'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['nomination', 'data-principal-rights', 'death', 'incapacity', 'succession'],
    posterAngles: [
      'Data rights can be handed to a nominee if a person dies or becomes incapacitated',
      'Support nomination so a trusted person can act on someone\'s data rights'
    ]
  },
  {
    id: 'dpdp-s-15',
    framework: 'DPDP',
    citation: 'DPDP §15',
    level: 0,
    region: 'IN',
    title: 'Duties of Data Principal',
    summary: 'Data principals must not impersonate others, suppress material information, register false grievances, or furnish false particulars; breach of these duties can attract a penalty.',
    text: 'Section 15 imposes duties on the Data Principal. In exercising rights, a Principal must comply with applicable law, not impersonate another person when providing data for a specified purpose, not suppress material information while providing data or applying for a document/benefit, not register a false or frivolous grievance or complaint with a Data Fiduciary or the Board, and furnish only verifiably authentic information when exercising the right to correction or erasure. Breach of these duties can attract a penalty under the Schedule.',
    obligations: ['Do not impersonate another person when providing data', 'Do not suppress material information or furnish false particulars', 'Do not file false or frivolous grievances/complaints', 'Provide only authentic information when seeking correction or erasure'],
    penalties: 'Breach of a Data Principal\'s duties: penalty up to ₹10,000 (Schedule).',
    appliesTo: ['data-principals', 'all-employees'],
    topics: ['data-principal-duties', 'false-information', 'impersonation', 'frivolous-complaints'],
    posterAngles: [
      'Rights come with duties — do not impersonate others or file false complaints',
      'Give truthful, authentic information when exercising your data rights'
    ]
  },

  // ══════════════════════════════════════════════════════════════════════
  // CHAPTER IV — SPECIAL PROVISIONS (§§ 16–17)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dpdp-s-16',
    framework: 'DPDP',
    citation: 'DPDP §16',
    level: 0,
    region: 'IN',
    title: 'Processing of Personal Data Outside India (Cross-Border Transfer)',
    summary: 'A data fiduciary may transfer personal data outside India to any country except those the Central Government restricts by notification; sector-specific laws that impose stricter localisation continue to apply.',
    text: 'Section 16 adopts a "blacklist" approach to cross-border transfers. A Data Fiduciary may transfer personal data for processing to any country or territory outside India, except to those the Central Government restricts by notification. Importantly, the section does not dilute any other law that provides a higher degree of protection for or restriction on the transfer of personal data (for example, sectoral data-localisation requirements such as those of the RBI), which continue to apply.',
    obligations: ['Do not transfer personal data to countries the Central Government has restricted', 'Continue to comply with stricter sectoral localisation/transfer rules where they apply', 'Track notifications identifying restricted destinations'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['cross-border-transfer', 'data-localisation', 'international-transfer', 'restricted-countries'],
    posterAngles: [
      'Transfers abroad are allowed except to countries the government blacklists — check the list',
      'Sector rules can be stricter than DPDP on where data may go — the tighter rule wins'
    ]
  },
  {
    id: 'dpdp-s-17',
    framework: 'DPDP',
    citation: 'DPDP §17',
    level: 0,
    region: 'IN',
    title: 'Exemptions',
    summary: 'Certain provisions do not apply to processing for enforcing legal rights, judicial/regulatory functions, prevention/investigation of offences, or approved corporate restructuring; the State may also be exempted for security and specified reasons.',
    text: 'Section 17 lists exemptions from specified provisions of the Act. Many obligations (and several data-principal rights) do not apply where processing is necessary to enforce a legal right or claim; is done by a court, tribunal or in the interest of preventing, detecting, investigating or prosecuting offences; relates to processing of non-resident personal data under a foreign contract; or is for an approved scheme of merger, amalgamation or corporate restructuring. The Central Government may, by notification, exempt State instrumentalities in the interests of sovereignty, security, friendly relations, or public order, and may exempt startups and other classes of fiduciaries; certain research/archiving/statistical processing is also exempt.',
    obligations: ['Rely on an exemption only where its precise statutory conditions are satisfied', 'Do not treat exemptions as a general opt-out from the Act', 'Track government notifications granting class exemptions (e.g., startups)'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['exemptions', 'law-enforcement', 'research', 'mergers', 'state', 'startups'],
    posterAngles: [
      'Exemptions are narrow and specific — they are not a licence to ignore the Act',
      'Only rely on an exemption when the exact legal condition genuinely applies'
    ]
  },

  // ══════════════════════════════════════════════════════════════════════
  // CHAPTER V — DATA PROTECTION BOARD OF INDIA (§§ 18–26)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dpdp-s-18',
    framework: 'DPDP',
    citation: 'DPDP §18',
    level: 0,
    region: 'IN',
    title: 'Establishment of the Data Protection Board of India',
    summary: 'Establishes the Data Protection Board of India as a body corporate to administer the Act, with its headquarters at a place notified by the Central Government.',
    text: 'Section 18 establishes the Data Protection Board of India as a body corporate with perpetual succession and a common seal, able to acquire and hold property and sue or be sued. The Board is the primary adjudicatory and enforcement body under the Act. Its headquarters is at the place notified by the Central Government, and it functions as a digital-first regulator.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['data-protection-board', 'regulator', 'enforcement', 'establishment'],
    posterAngles: [
      'The Data Protection Board of India is the regulator that enforces the Act',
      'A dedicated body now oversees personal-data compliance in India'
    ]
  },
  {
    id: 'dpdp-s-19',
    framework: 'DPDP',
    citation: 'DPDP §19',
    level: 0,
    region: 'IN',
    title: 'Composition and Appointment of Members of the Board',
    summary: 'Sets out that the Board consists of a Chairperson and members appointed by the Central Government, with the number, qualifications and manner of appointment as prescribed.',
    text: 'Section 19 provides for the Board\'s composition: it comprises a Chairperson and such number of other Members as notified by the Central Government. Members are appointed by the Central Government in the prescribed manner and must be persons of ability, integrity and standing with special knowledge or practical experience in fields such as data governance, law, information technology, dispute resolution or consumer protection. At least one Member must be an expert in law.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-principals'],
    topics: ['data-protection-board', 'composition', 'chairperson', 'members', 'appointment'],
    posterAngles: [
      'The Board is led by a Chairperson and expert members appointed by the government',
      'Data-governance and legal expertise are required of Board members'
    ]
  },
  {
    id: 'dpdp-s-20',
    framework: 'DPDP',
    citation: 'DPDP §20',
    level: 0,
    region: 'IN',
    title: 'Salary, Allowances and Term of Members',
    summary: 'Provides for the salary, allowances and other conditions of service of the Chairperson and members, their term of office (two years, re-eligible), and resignation.',
    text: 'Section 20 governs the service conditions of the Board. The Chairperson and Members hold office for a term of two years and are eligible for re-appointment. Their salaries, allowances and other terms of service are as prescribed but cannot be varied to their disadvantage after appointment. The section also provides how a Member may resign by writing to the Central Government.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-principals'],
    topics: ['data-protection-board', 'term', 'salary', 'service-conditions', 'resignation'],
    posterAngles: [
      'Board members serve fixed, renewable two-year terms',
      'The Board\'s independence is supported by protected service conditions'
    ]
  },
  {
    id: 'dpdp-s-21',
    framework: 'DPDP',
    citation: 'DPDP §21',
    level: 0,
    region: 'IN',
    title: 'Disqualification for and Removal from Office of Members',
    summary: 'Specifies the grounds on which a member may be disqualified or removed — such as insolvency, conviction for an offence involving moral turpitude, or abuse of position.',
    text: 'Section 21 lets the Central Government remove the Chairperson or a Member on specified grounds, including being an undischarged insolvent, being convicted of an offence involving moral turpitude, becoming physically or mentally incapable of acting, having acquired a financial or other interest likely to prejudicially affect their functions, or having so abused their position as to render their continuance in office prejudicial to the public interest. Removal on certain grounds requires the Member to be given a reasonable opportunity of being heard.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-principals'],
    topics: ['data-protection-board', 'disqualification', 'removal', 'integrity'],
    posterAngles: [
      'Board members can be removed for insolvency, conviction, incapacity or abuse of office',
      'Integrity safeguards keep the regulator accountable'
    ]
  },
  {
    id: 'dpdp-s-22',
    framework: 'DPDP',
    citation: 'DPDP §22',
    level: 0,
    region: 'IN',
    title: 'Functioning of the Board',
    summary: 'The Board functions as an independent, digital-office body; it may authorise members to perform functions, and its proceedings are conducted through techno-legal measures.',
    text: 'Section 22 provides that the Board functions as an independent body and, as far as practicable, as a digital office — receiving complaints, allocating them, hearing and pronouncing decisions using techno-legal measures without requiring physical presence. The Chairperson exercises general superintendence and may authorise any Member to perform functions and delegate powers. The Board\'s functioning is designed to be efficient and technology-driven.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['data-protection-board', 'digital-office', 'functioning', 'proceedings'],
    posterAngles: [
      'The Board runs as a digital office — complaints and hearings can be handled online',
      'Enforcement is designed to be tech-driven and efficient'
    ]
  },
  {
    id: 'dpdp-s-23',
    framework: 'DPDP',
    citation: 'DPDP §23',
    level: 0,
    region: 'IN',
    title: 'Officers and Employees of the Board',
    summary: 'Allows the Board to appoint officers, employees, experts and consultants necessary to discharge its functions, on prescribed terms.',
    text: 'Section 23 empowers the Board to engage such officers and employees, and experts and consultants, as it considers necessary to carry out its functions, subject to the prescribed terms and conditions of service. This gives the Board the administrative and technical capacity to investigate breaches and adjudicate complaints.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-principals'],
    topics: ['data-protection-board', 'officers', 'employees', 'experts'],
    posterAngles: [
      'The Board can hire experts and staff to investigate and adjudicate',
      'Enforcement capacity is built into the regulator by design'
    ]
  },
  {
    id: 'dpdp-s-24',
    framework: 'DPDP',
    citation: 'DPDP §24',
    level: 0,
    region: 'IN',
    title: 'Meetings of the Board',
    summary: 'Provides for the meetings of the Board, quorum, decision-making by majority, and the manner in which business is transacted.',
    text: 'Section 24 provides that the Board meets at such times and places, and observes such procedure for transacting business (including quorum), as prescribed. It may transact business through meetings held physically or by digital means, and decisions are ordinarily taken by consensus or majority. This governs how the Board organises its internal decision-making.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-principals'],
    topics: ['data-protection-board', 'meetings', 'quorum', 'procedure'],
    posterAngles: [
      'The Board decides matters through structured meetings and majority decisions',
      'Digital-first meetings keep the regulator agile'
    ]
  },
  {
    id: 'dpdp-s-25',
    framework: 'DPDP',
    citation: 'DPDP §25',
    level: 0,
    region: 'IN',
    title: 'Members and Officers to be Public Servants',
    summary: 'Declares that the Chairperson, members, officers and employees of the Board are deemed public servants under the Indian Penal Code while acting in the discharge of their functions.',
    text: 'Section 25 provides that the Chairperson, Members, officers and employees of the Board are deemed to be public servants within the meaning of the Indian Penal Code (now the Bharatiya Nyaya Sanhita) when acting or purporting to act under the Act. This attaches public-servant protections and accountability to the Board\'s personnel.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-principals'],
    topics: ['data-protection-board', 'public-servant', 'accountability'],
    posterAngles: [
      'Board members are treated as public servants — with the accountability that implies',
      'Legal protections and duties apply to those enforcing the Act'
    ]
  },
  {
    id: 'dpdp-s-26',
    framework: 'DPDP',
    citation: 'DPDP §26',
    level: 0,
    region: 'IN',
    title: 'Protection of Action Taken in Good Faith',
    summary: 'Bars suits or legal proceedings against the Board, its members or officers for anything done, or intended to be done, in good faith under the Act.',
    text: 'Section 26 provides that no suit, prosecution or other legal proceeding shall lie against the Board, its Chairperson, Members, officers or employees for anything which is done, or intended to be done, in good faith under the Act or its rules. This shields the regulator from personal liability for bona fide enforcement action.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-principals'],
    topics: ['data-protection-board', 'good-faith', 'immunity', 'protection'],
    posterAngles: [
      'Good-faith enforcement action by the Board is legally protected',
      'Regulators can act without fear of personal liability for bona fide decisions'
    ]
  },

  // ══════════════════════════════════════════════════════════════════════
  // CHAPTER VI — POWERS, FUNCTIONS AND PROCEDURE OF THE BOARD (§§ 27–28)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dpdp-s-27',
    framework: 'DPDP',
    citation: 'DPDP §27',
    level: 0,
    region: 'IN',
    title: 'Powers and Functions of the Board',
    summary: 'The Board directs urgent remedial or mitigation measures on a breach, inquires into breaches and complaints, and imposes penalties; it may also issue directions to any person.',
    text: 'Section 27 sets out the Board\'s core powers. On receiving intimation of a personal data breach, it may direct any urgent remedial or mitigation measures and inquire into the breach and impose penalties. It inquires into complaints made by affected Data Principals, complaints of breach of the Act by Data Fiduciaries or Consent Managers (including a Consent Manager\'s breach of its obligations), and references from the Central Government. The Board may issue such directions to any person as it considers necessary for compliance, and those directions are binding.',
    obligations: ['Comply with binding directions issued by the Board', 'Take urgent remedial/mitigation measures the Board directs after a breach', 'Cooperate with Board inquiries into breaches and complaints'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['data-protection-board', 'powers', 'inquiry', 'directions', 'breach', 'complaints'],
    posterAngles: [
      'The Board can order urgent fixes after a breach — and its directions are binding',
      'Complaints and breach reports trigger real Board inquiries and penalties'
    ]
  },
  {
    id: 'dpdp-s-28',
    framework: 'DPDP',
    citation: 'DPDP §28',
    level: 0,
    region: 'IN',
    title: 'Procedure to be Followed by the Board',
    summary: 'The Board conducts inquiries following natural justice with civil-court powers, may decide not to proceed with frivolous complaints, and must give reasons and act as a digital office.',
    text: 'Section 28 governs the Board\'s procedure. It functions as an independent body observing the principles of natural justice, records reasons for its actions, and — for the purpose of discharging its functions — has the same powers as a civil court in respect of summoning and examining persons, requiring discovery and production of documents, and receiving evidence. The Board may, after giving the person an opportunity, decide the point at which an inquiry is to be held, close proceedings that are frivolous, and modify, suspend, withdraw or cancel its directions. If it determines non-compliance is significant, it must proceed to impose a penalty under §33.',
    obligations: ['Respond to Board summons and produce documents/evidence as required', 'Participate in inquiries conducted under principles of natural justice'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['data-protection-board', 'procedure', 'natural-justice', 'civil-court-powers', 'inquiry'],
    posterAngles: [
      'The Board has civil-court powers — expect summons, document demands and reasoned decisions',
      'Cooperate fully with Board inquiries; frivolous complaints can be closed early'
    ]
  },

  // ══════════════════════════════════════════════════════════════════════
  // CHAPTER VII — APPEAL AND ALTERNATE DISPUTE RESOLUTION (§§ 29–32)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dpdp-s-29',
    framework: 'DPDP',
    citation: 'DPDP §29',
    level: 0,
    region: 'IN',
    title: 'Appeal to the Appellate Tribunal',
    summary: 'A person aggrieved by an order or direction of the Board may appeal to the Telecom Disputes Settlement and Appellate Tribunal (TDSAT) within sixty days, which functions as a digital office.',
    text: 'Section 29 provides a right of appeal. Any person aggrieved by an order or direction of the Data Protection Board may appeal to the Appellate Tribunal — the Telecom Disputes Settlement and Appellate Tribunal (TDSAT) — within sixty days of receipt of the order, extendable for sufficient cause. The Tribunal follows its own procedure, is not bound by the Code of Civil Procedure but by principles of natural justice, and endeavours to dispose of appeals within six months. It too functions as a digital office.',
    obligations: ['File any appeal against a Board order within the 60-day window', 'Follow the Appellate Tribunal\'s (TDSAT) digital procedure'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['appeal', 'appellate-tribunal', 'tdsat', 'remedy', 'natural-justice'],
    posterAngles: [
      'Disagree with a Board order? Appeal to TDSAT within 60 days',
      'Appeals are heard digitally and target a six-month timeline'
    ]
  },
  {
    id: 'dpdp-s-30',
    framework: 'DPDP',
    citation: 'DPDP §30',
    level: 0,
    region: 'IN',
    title: 'Orders Passed by the Appellate Tribunal to be Executable as Decrees',
    summary: 'Orders of the Appellate Tribunal are executable as decrees of a civil court, and the Tribunal has all the powers of a civil court for that purpose.',
    text: 'Section 30 gives teeth to Tribunal orders. An order passed by the Appellate Tribunal under the Act is executable as if it were a decree of a civil court, and for that purpose the Tribunal has all the powers of a civil court. The Tribunal may transmit its order to a civil court with local jurisdiction, which then executes it as its own decree.',
    obligations: ['Comply with Appellate Tribunal orders, which are enforceable as civil-court decrees'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['appeal', 'appellate-tribunal', 'enforcement', 'decree', 'execution'],
    posterAngles: [
      'Tribunal orders are enforced like court decrees — they carry real weight',
      'There is no ignoring an appellate decision under the Act'
    ]
  },
  {
    id: 'dpdp-s-31',
    framework: 'DPDP',
    citation: 'DPDP §31',
    level: 0,
    region: 'IN',
    title: 'Alternate Dispute Resolution',
    summary: 'The Board may direct a complaint to be resolved by mediation or other alternate dispute resolution where it considers it appropriate, given the nature of the dispute.',
    text: 'Section 31 encourages settlement. If the Board is of the opinion that a complaint may be resolved by mediation or any other form of dispute resolution, it may direct the parties to attempt resolution through such a mechanism, as may be prescribed. This provides a faster, less adversarial route to resolving certain data-protection complaints.',
    obligations: ['Participate in mediation/ADR where the Board directs it'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['dispute-resolution', 'mediation', 'adr', 'settlement'],
    posterAngles: [
      'Some data disputes can be settled by mediation rather than penalties',
      'The Board can steer suitable complaints toward faster resolution'
    ]
  },
  {
    id: 'dpdp-s-32',
    framework: 'DPDP',
    citation: 'DPDP §32',
    level: 0,
    region: 'IN',
    title: 'Voluntary Undertaking',
    summary: 'The Board may accept a voluntary undertaking from any person to take (or refrain from) specified action; accepting it bars proceedings on the same subject, and its breach is treated as a contravention.',
    text: 'Section 32 introduces voluntary undertakings. The Board may accept a voluntary undertaking from any person in respect of any matter related to compliance with the Act, at any stage of a proceeding. The undertaking may include a commitment to take specified action within a time, refrain from specified action, or publicise the undertaking. Once accepted, it bars further proceedings on that subject matter; but if the person breaches the undertaking, that breach is deemed a contravention of the Act and the Board may impose a penalty.',
    obligations: ['Honour any voluntary undertaking accepted by the Board', 'Treat a breached undertaking as a contravention exposing you to penalty'],
    penalties: 'Breach of an accepted voluntary undertaking is a contravention and may attract the penalty applicable to the underlying obligation (per Schedule).',
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['voluntary-undertaking', 'settlement', 'compliance', 'enforcement'],
    posterAngles: [
      'You can settle a compliance issue by giving the Board a voluntary undertaking — then you must keep it',
      'Breaking an undertaking is itself a violation with penalties'
    ]
  },

  // ══════════════════════════════════════════════════════════════════════
  // CHAPTER VIII — PENALTIES AND ADJUDICATION (§§ 33–34)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dpdp-s-33',
    framework: 'DPDP',
    citation: 'DPDP §33',
    level: 0,
    region: 'IN',
    title: 'Penalties',
    summary: 'Where the Board finds significant non-compliance after inquiry, it may impose a monetary penalty up to the amount in the Schedule (e.g., up to ₹250 crore for security-safeguard failures), having regard to factors like the nature, gravity and impact of the breach.',
    text: 'Section 33 empowers the Board, after an inquiry and if it determines non-compliance is significant, to impose a monetary penalty specified in the Schedule. In deciding the amount it must consider the nature, gravity and duration of the breach, the type and volume of personal data affected, whether the breach was repetitive, any gain or avoided loss, any mitigating action taken, and the proportionality and likely impact of the penalty. Penalty amounts are credited to the Consolidated Fund of India. The Schedule caps include up to ₹250 crore for failing to take reasonable security safeguards, up to ₹200 crore for breach-notification and children\'s-data failures, and up to ₹50 crore as a residuary cap.',
    obligations: ['Understand that significant non-compliance can attract Schedule penalties up to ₹250 crore', 'Maintain evidence of mitigating action, which the Board weighs when setting penalties'],
    penalties: 'Schedule caps: up to ₹250 crore (security safeguards); up to ₹200 crore (breach notification failure); up to ₹200 crore (children\'s-data obligations); up to ₹150 crore (significant-data-fiduciary duties, where applicable); up to ₹50 crore (residuary / general); up to ₹10,000 (data-principal duties).',
    appliesTo: ['data-fiduciaries', 'data-processors', 'significant-data-fiduciaries'],
    topics: ['penalties', 'schedule', 'adjudication', 'enforcement', 'security-safeguards', 'breach'],
    posterAngles: [
      'DPDP penalties are steep — up to ₹250 crore for weak security safeguards',
      'The Board weighs gravity, volume and whether you acted to mitigate — good response reduces exposure',
      'Breach-notification and children\'s-data failures can each reach ₹200 crore'
    ]
  },
  {
    id: 'dpdp-s-34',
    framework: 'DPDP',
    citation: 'DPDP §34',
    level: 0,
    region: 'IN',
    title: 'Sums Realised by Way of Penalties',
    summary: 'All penalties imposed and realised under the Act are credited to the Consolidated Fund of India.',
    text: 'Section 34 provides that all sums realised by way of penalties under the Act are credited to the Consolidated Fund of India. Penalties are therefore a public-revenue and deterrence measure rather than compensation payable to affected individuals.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['penalties', 'consolidated-fund', 'enforcement'],
    posterAngles: [
      'Penalties go to the public exchequer — DPDP is about deterrence, not payouts',
      'Fines under the Act are credited to the Consolidated Fund of India'
    ]
  },

  // ══════════════════════════════════════════════════════════════════════
  // CHAPTER IX — MISCELLANEOUS (§§ 35–44)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dpdp-s-35',
    framework: 'DPDP',
    citation: 'DPDP §35',
    level: 0,
    region: 'IN',
    title: 'Protection of Action Taken in Good Faith (Government)',
    summary: 'Protects the Central Government, the Board and their officers from legal proceedings for anything done in good faith under the Act.',
    text: 'Section 35 provides that no suit, prosecution or other legal proceeding shall lie against the Central Government, the Board, its Chairperson, Members, officers or employees for anything done or intended to be done in good faith under the Act or the rules made under it. It complements §26 by extending good-faith protection to government action.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-principals'],
    topics: ['good-faith', 'immunity', 'government', 'protection'],
    posterAngles: [
      'Good-faith government and Board action under the Act is legally protected',
      'Bona fide enforcement is shielded from litigation'
    ]
  },
  {
    id: 'dpdp-s-36',
    framework: 'DPDP',
    citation: 'DPDP §36',
    level: 0,
    region: 'IN',
    title: 'Power to Call for Information',
    summary: 'Empowers the Central Government to require the Board, any data fiduciary or intermediary to furnish information it may call for, for the purposes of the Act.',
    text: 'Section 36 empowers the Central Government to require the Board, or any Data Fiduciary or intermediary, to furnish such information as it may call for, for the purposes of the Act. This is an information-gathering power supporting the Government\'s oversight and rule-making functions.',
    obligations: ['Furnish information the Central Government lawfully calls for under the Act'],
    penalties: null,
    appliesTo: ['data-fiduciaries'],
    topics: ['information', 'central-government', 'oversight', 'intermediary'],
    posterAngles: [
      'The government can require you to hand over information for the Act\'s purposes',
      'Be ready to respond to lawful information requests'
    ]
  },
  {
    id: 'dpdp-s-37',
    framework: 'DPDP',
    citation: 'DPDP §37',
    level: 0,
    region: 'IN',
    title: 'Power of Central Government to Block Access to Information',
    summary: 'On a reference from the Board, the Central Government may, in the public interest, direct blocking of access to a data fiduciary\'s information where it has been penalised at least twice and continues to breach the Act.',
    text: 'Section 37 provides an escalation power. Where the Board has imposed a penalty on a Data Fiduciary on two or more occasions and advises, in the interests of the general public, that access to the fiduciary\'s computer resource be blocked, the Central Government may — after giving the fiduciary an opportunity of being heard — direct any government agency or intermediary to block public access to information enabling the fiduciary to carry on the activity that led to the penalties. This is a last-resort measure against persistent offenders.',
    obligations: ['Avoid repeat contraventions — a pattern of penalties can lead to access being blocked'],
    penalties: null,
    appliesTo: ['data-fiduciaries'],
    topics: ['blocking', 'central-government', 'repeat-offender', 'enforcement', 'public-interest'],
    posterAngles: [
      'Repeat offenders risk having public access to their service blocked',
      'Persistent non-compliance escalates — not just fines, but a shutdown of access'
    ]
  },
  {
    id: 'dpdp-s-38',
    framework: 'DPDP',
    citation: 'DPDP §38',
    level: 0,
    region: 'IN',
    title: 'Consistency with Other Laws / Bar of Jurisdiction',
    summary: 'Provides that the Act\'s provisions apply in addition to (not in derogation of) other laws, and bars civil courts from entertaining suits on matters the Board or Tribunal is empowered to decide.',
    text: 'Section 38 addresses the Act\'s interaction with other laws and the courts. The provisions of the Act are in addition to and not in derogation of any other law in force. No civil court has jurisdiction to entertain any suit or proceeding in respect of any matter that the Board or the Appellate Tribunal is empowered under the Act to determine, and no injunction may be granted by any court in respect of any action taken under the Act.',
    obligations: ['Bring data-protection disputes before the Board/Tribunal, not civil courts, where the Act so provides'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['jurisdiction', 'other-laws', 'civil-court-bar', 'overlap'],
    posterAngles: [
      'DPDP adds to other laws — it does not replace them',
      'Data-protection matters go to the Board/Tribunal, not ordinary civil courts'
    ]
  },
  {
    id: 'dpdp-s-39',
    framework: 'DPDP',
    citation: 'DPDP §39',
    level: 0,
    region: 'IN',
    title: 'Bar on Trying Offences / Cognizance',
    summary: 'Relates to how matters under the Act are dealt with, reinforcing that adjudication of contraventions lies with the Board rather than being tried as criminal offences by courts.',
    text: 'Section 39 concerns the handling of contraventions under the Act. Consistent with the Act\'s civil-penalty design, contraventions are adjudicated by the Board and are not framed as criminal offences to be tried by courts. This keeps enforcement within the Act\'s specialised, penalty-based framework rather than the criminal-justice system.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['adjudication', 'cognizance', 'civil-penalty', 'enforcement'],
    posterAngles: [
      'DPDP breaches are adjudicated as civil penalties, not tried as crimes',
      'Enforcement stays within the Act\'s specialised framework'
    ]
  },
  {
    id: 'dpdp-s-40',
    framework: 'DPDP',
    citation: 'DPDP §40',
    level: 0,
    region: 'IN',
    title: 'Power of Central Government to Make Rules',
    summary: 'Empowers the Central Government to make rules to carry out the provisions of the Act on a wide list of matters, including notice, consent, breach intimation, children\'s data, Consent Managers, the Board and cross-border transfer.',
    text: 'Section 40 is the rule-making power. It authorises the Central Government to make rules, by notification, to carry out the Act\'s provisions across an enumerated list of subjects — including the form and content of notice, the manner of obtaining and managing consent, the registration and obligations of Consent Managers, the manner of verifiable parental consent for children\'s data, the additional obligations of Significant Data Fiduciaries, the intimation of personal data breaches, the time periods for data-principal requests, the composition and functioning of the Board, and other prescribed matters. The Draft DPDP Rules, 2025 are made under this power.',
    obligations: ['Comply with the DPDP Rules once notified, as they operationalise the Act', 'Track rule-making, since much detailed compliance sits in the Rules'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['rules', 'rule-making', 'central-government', 'delegated-legislation'],
    posterAngles: [
      'Much of the detailed how-to lives in the Rules — watch for notified DPDP Rules',
      'The Act sets principles; the Rules fill in the operational detail'
    ]
  },
  {
    id: 'dpdp-s-41',
    framework: 'DPDP',
    citation: 'DPDP §41',
    level: 0,
    region: 'IN',
    title: 'Power of Board to Make Regulations',
    summary: 'Empowers the Data Protection Board to make regulations, consistent with the Act and rules, for matters relating to its own functioning and procedure.',
    text: 'Section 41 empowers the Data Protection Board to make regulations, consistent with the Act and the rules, on matters relating to its own functioning — such as the procedure for its meetings and the transaction of business. These regulations supplement the Central Government\'s rules with the Board\'s internal operating detail.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-principals'],
    topics: ['regulations', 'data-protection-board', 'procedure', 'delegated-legislation'],
    posterAngles: [
      'The Board can set its own operating regulations within the Act\'s framework',
      'Board procedure is governed by regulations it makes'
    ]
  },
  {
    id: 'dpdp-s-42',
    framework: 'DPDP',
    citation: 'DPDP §42',
    level: 0,
    region: 'IN',
    title: 'Rules and Regulations to be Laid before Parliament',
    summary: 'Requires every rule and regulation made under the Act to be laid before both Houses of Parliament, which may modify or annul them.',
    text: 'Section 42 provides parliamentary oversight of delegated legislation. Every rule made by the Central Government and every regulation made by the Board must be laid before each House of Parliament. Parliament may, within the prescribed sessions, agree to modify the rule/regulation or agree that it should not be made, subject to the validity of anything previously done under it. This ensures legislative control over the detailed rules.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['parliament', 'oversight', 'rules', 'regulations', 'laying'],
    posterAngles: [
      'Rules and regulations are checked by Parliament, which can modify or annul them',
      'Delegated legislation under the Act stays under legislative oversight'
    ]
  },
  {
    id: 'dpdp-s-43',
    framework: 'DPDP',
    citation: 'DPDP §43',
    level: 0,
    region: 'IN',
    title: 'Power to Remove Difficulties',
    summary: 'Allows the Central Government, within a limited period after commencement, to make orders removing difficulties in giving effect to the Act, consistent with its provisions.',
    text: 'Section 43 is a standard "removal of difficulties" clause. If any difficulty arises in giving effect to the Act, the Central Government may, by order published in the Official Gazette, make such provisions (not inconsistent with the Act) as appear necessary to remove the difficulty — but no such order may be made after a specified period (three years) from commencement, and every such order must be laid before Parliament.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['removal-of-difficulties', 'central-government', 'transitional'],
    posterAngles: [
      'Early implementation glitches can be smoothed by government orders — for a limited time',
      'A transitional safety valve helps the Act take effect cleanly'
    ]
  },
  {
    id: 'dpdp-s-44',
    framework: 'DPDP',
    citation: 'DPDP §44',
    level: 0,
    region: 'IN',
    title: 'Amendments to Other Acts (including RTI Section 8(1)(j))',
    summary: 'Makes consequential amendments to other laws — notably amending the Right to Information Act to broaden the exemption for personal information, and omitting section 43A of the Information Technology Act.',
    text: 'Section 44 effects consequential amendments to other statutes. Most significantly, it amends section 8(1)(j) of the Right to Information Act, 2005 so that information relating to personal information is broadly exempt from disclosure. It also omits section 43A of the Information Technology Act, 2000 (which had provided compensation for negligent handling of sensitive personal data) and amends section 81 of that Act, since data protection is now governed by the DPDP Act. These changes align the wider legal framework with the new regime.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['amendments', 'rti', 'it-act', 'section-43a', 'consequential'],
    posterAngles: [
      'DPDP reshapes related laws — RTI\'s personal-information exemption is broadened',
      'The IT Act\'s old sensitive-data compensation clause (43A) is replaced by this regime'
    ]
  },

  // ══════════════════════════════════════════════════════════════════════
  // DRAFT DPDP RULES, 2025 (subordinate legislation — level 1)
  // ══════════════════════════════════════════════════════════════════════
  {
    id: 'dpdp-rule-notice',
    framework: 'DPDP',
    citation: 'DPDP Rules 2025 r.3',
    level: 1,
    region: 'IN',
    title: 'Rules — Notice by Data Fiduciary',
    summary: 'The Draft Rules require the §5 notice to be a standalone, clear, plain-language document that itemises the personal data and the specific purpose, and gives functional links/means to withdraw consent, exercise rights and complain to the Board.',
    text: 'The Draft DPDP Rules, 2025 operationalise the §5 notice. A Data Fiduciary\'s notice must be presented independently of any other information, in clear and plain language, and must specify an itemised description of the personal data being collected and the specific purpose of processing with the corresponding goods or services. It must also provide a communication link (website/app) and other means through which the Data Principal can withdraw consent as easily as it was given, exercise their rights, and make a complaint to the Board.',
    obligations: ['Present the consent notice as a standalone, plain-language document', 'Itemise the exact personal data and the specific purpose', 'Provide working links/means to withdraw consent, exercise rights and complain to the Board'],
    penalties: null,
    appliesTo: ['data-fiduciaries'],
    topics: ['rules', 'notice', 'consent', 'transparency', 'plain-language'],
    posterAngles: [
      'The Rules make notice concrete: itemise the data, name the purpose, give a real withdrawal link',
      'A DPDP notice must stand on its own — clear, plain, and actionable'
    ]
  },
  {
    id: 'dpdp-rule-consent',
    framework: 'DPDP',
    citation: 'DPDP Rules 2025 r.4',
    level: 1,
    region: 'IN',
    title: 'Rules — Consent and Consent Managers',
    summary: 'The Draft Rules set the registration conditions and obligations of Consent Managers — including a minimum net worth, being an India-incorporated company, interoperable platforms, and acting in the data principal\'s interest as a fiduciary.',
    text: 'The Draft Rules elaborate the consent framework and the Consent Manager institution. A Consent Manager must be a company incorporated in India meeting prescribed conditions (including a specified minimum net worth), be registered with the Board, and operate an interoperable platform that lets Data Principals give, manage, review and withdraw consent through an accessible, transparent record. The Consent Manager must act in a fiduciary capacity in the Data Principal\'s interest, avoid conflicts of interest, maintain records of consents and data-sharing, and be subject to Board directions and audit.',
    obligations: ['Register Consent Managers with the Board and meet incorporation/net-worth conditions', 'Operate an interoperable platform for giving, reviewing and withdrawing consent', 'Act as a fiduciary in the Data Principal\'s interest and avoid conflicts', 'Maintain auditable records of consents and data-sharing'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['rules', 'consent', 'consent-manager', 'registration', 'interoperability'],
    posterAngles: [
      'Consent Managers are registered, India-incorporated fiduciaries acting for the individual',
      'One dashboard to give, review and withdraw consent — that is the Consent Manager\'s job'
    ]
  },
  {
    id: 'dpdp-rule-breach',
    framework: 'DPDP',
    citation: 'DPDP Rules 2025 r.7',
    level: 1,
    region: 'IN',
    title: 'Rules — Intimation of Personal Data Breach',
    summary: 'On becoming aware of any personal data breach, the fiduciary must notify each affected data principal without delay and give the Board an initial intimation immediately, followed by a detailed report within 72 hours.',
    text: 'The Draft Rules prescribe a dual, time-bound breach-notification regime. On becoming aware of any personal data breach, a Data Fiduciary must, without delay, intimate each affected Data Principal (via their registered account or contact) with a description of the breach, its likely consequences, the mitigation measures taken/being taken, and safety steps the individual can take, plus contact details for queries. It must also notify the Data Protection Board immediately with the basic facts and, within 72 hours (or a longer period the Board allows on request), provide an updated and detailed report including the events, circumstances, mitigation, findings on the person who caused it, and remedial measures to prevent recurrence.',
    obligations: ['Notify each affected Data Principal without delay, describing the breach and safety steps', 'Give the Board an immediate initial intimation of the breach', 'File a detailed breach report with the Board within 72 hours (or extended period)', 'Document mitigation, root cause and measures to prevent recurrence'],
    penalties: 'Failure to notify the Board or affected principals of a personal data breach can attract a penalty up to ₹200 crore under the Act\'s Schedule.',
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['rules', 'breach', 'breach-notification', '72-hours', 'incident-response'],
    posterAngles: [
      'Breach? Tell affected people without delay and the Board immediately — detailed report in 72 hours',
      'Every breach counts — the Rules require notification with no materiality threshold',
      'Have an incident-response plan ready: notify, mitigate, document, prevent recurrence'
    ]
  },
  {
    id: 'dpdp-rule-children',
    framework: 'DPDP',
    citation: 'DPDP Rules 2025 r.10',
    level: 1,
    region: 'IN',
    title: 'Rules — Verifiable Parental Consent for Children\'s Data',
    summary: 'The Draft Rules require fiduciaries to adopt reasonable technical measures to verify that a person claiming to be a parent is an identifiable adult, using reliable identity/age details or a virtual token, before processing a child\'s data.',
    text: 'The Draft Rules operationalise §9\'s verifiable parental consent. Before processing a child\'s personal data, a Data Fiduciary must adopt appropriate technical and organisational measures to ensure that the individual identifying as the parent is an adult who is identifiable — for example by reference to reliable identity and age details already available with the fiduciary, or details/virtual tokens voluntarily provided or issued by an authorised entity (including a Digital Locker or government-issued identity). The Rules also carve out certain classes of fiduciaries (such as specified educational and healthcare providers) and purposes from some children\'s-data restrictions where processing is limited and in the child\'s interest.',
    obligations: ['Verify the parent is an identifiable adult before processing a child\'s data', 'Use reliable identity/age details or an authorised virtual token for verification', 'Apply exemptions only within the limited classes/purposes the Rules specify'],
    penalties: 'Failure to obtain verifiable parental consent or breach of children\'s-data obligations can attract a penalty up to ₹200 crore under the Schedule.',
    appliesTo: ['data-fiduciaries'],
    topics: ['rules', 'children', 'parental-consent', 'age-verification', 'identity'],
    posterAngles: [
      'Verify the "parent" is a real, identifiable adult before touching a child\'s data',
      'Age-gating alone is not enough — the Rules expect reliable identity/token-based verification'
    ]
  },
  {
    id: 'dpdp-rule-sdf',
    framework: 'DPDP',
    citation: 'DPDP Rules 2025 r.12',
    level: 1,
    region: 'IN',
    title: 'Rules — Additional Obligations of Significant Data Fiduciaries',
    summary: 'The Draft Rules require significant data fiduciaries to conduct annual DPIAs and audits, report an audit observation to the Board, and ensure algorithmic software and specified data flows do not risk data principals\' rights.',
    text: 'The Draft Rules flesh out §10 for Significant Data Fiduciaries. An SDF must undertake, once every twelve months, a Data Protection Impact Assessment and an audit, and its DPO must furnish to the Board a report containing significant observations from these exercises. The SDF must observe due diligence to verify that algorithmic software deployed for processing personal data is not likely to pose a risk to the rights of Data Principals, and must comply with any Central Government restriction on transferring specified categories of personal data (and traffic/derived data) outside India.',
    obligations: ['Conduct a DPIA and audit at least annually', 'Have the DPO report significant DPIA/audit observations to the Board', 'Verify processing algorithms do not endanger data-principal rights', 'Comply with any localisation restriction on specified data categories'],
    penalties: null,
    appliesTo: ['significant-data-fiduciaries'],
    topics: ['rules', 'significant-data-fiduciary', 'dpia', 'audit', 'algorithm', 'localisation'],
    posterAngles: [
      'SDFs: annual DPIA plus audit, with the DPO reporting key findings to the Board',
      'Your algorithms are in scope — prove they do not put people\'s rights at risk'
    ]
  },
  {
    id: 'dpdp-rule-board-procedure',
    framework: 'DPDP',
    citation: 'DPDP Rules 2025 r.16',
    level: 1,
    region: 'IN',
    title: 'Rules — Data Protection Board Procedure (Digital Office)',
    summary: 'The Draft Rules set out how the Board functions as a digital office — receiving complaints electronically, conducting proceedings by techno-legal means, and issuing decisions digitally, along with the Chairperson\'s authentication of orders.',
    text: 'The Draft Rules prescribe the Board\'s techno-legal procedure. The Board is to function as a digital office: complaints and intimations are received, and proceedings conducted and decided, through electronic and techno-legal means without necessarily requiring the physical presence of parties. The Rules address the manner of authenticating the Board\'s orders and directions, the appointment and terms of officers, and the procedures that keep proceedings efficient, transparent and consistent with natural justice.',
    obligations: ['Engage with the Board through its digital-office channels', 'Respond electronically to Board proceedings and directions'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['rules', 'data-protection-board', 'digital-office', 'procedure', 'techno-legal'],
    posterAngles: [
      'The Board is a digital office — file, respond and be heard online',
      'Proceedings are techno-legal and paperless by design'
    ]
  },
  {
    id: 'dpdp-rule-transfer',
    framework: 'DPDP',
    citation: 'DPDP Rules 2025 r.14',
    level: 1,
    region: 'IN',
    title: 'Rules — Cross-Border Transfer and Government-Access Conditions',
    summary: 'The Draft Rules allow transfers abroad subject to any conditions the Central Government specifies, and provide that fiduciaries must meet Government requirements for making specified personal data available to foreign states/agencies only under stated safeguards.',
    text: 'The Draft Rules supplement §16 on cross-border processing. A Data Fiduciary may process personal data outside India subject to the requirements the Central Government may specify for making such personal data (or traffic data) available to a foreign State, its agencies or entities under its control. The Rules also empower the Government to restrict transfer of certain specified categories of personal data by Significant Data Fiduciaries. Sectoral localisation obligations that are stricter continue to apply alongside these Rules.',
    obligations: ['Meet any Central Government conditions before making specified data available abroad', 'Observe restrictions on transferring specified data categories (esp. for SDFs)', 'Continue to comply with stricter sectoral localisation rules'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'significant-data-fiduciaries'],
    topics: ['rules', 'cross-border-transfer', 'localisation', 'government-access', 'foreign-state'],
    posterAngles: [
      'Transfers abroad come with government-set conditions — know them before you send data out',
      'Certain data categories can be restricted from leaving India — check before transferring'
    ]
  },
  {
    id: 'dpdp-rule-erasure-retention',
    framework: 'DPDP',
    citation: 'DPDP Rules 2025 r.8',
    level: 1,
    region: 'IN',
    title: 'Rules — Time Periods for Erasure and Retention',
    summary: 'The Draft Rules specify retention limits for certain classes of large fiduciaries — requiring erasure of personal data after a set period (e.g., three years) once the data principal has not engaged and the purpose is served, after prior notice to the principal.',
    text: 'The Draft Rules set retention and erasure timelines for specified classes of Data Fiduciaries (such as large e-commerce, online-gaming and social-media intermediaries above notified user thresholds). Where a Data Principal has neither approached the fiduciary for the specified purpose nor exercised rights for a defined period (e.g., three years), the fiduciary must erase the personal data unless retention is required by law, after giving the Data Principal advance notice (e.g., 48 hours before erasure) so they can act to retain it. This gives concrete effect to §8\'s erasure duty.',
    obligations: ['Erase personal data after the specified inactivity period once the purpose is served', 'Give the Data Principal advance notice before erasing their data', 'Retain data only where a law requires it', 'Apply the specific retention limits to the notified classes of fiduciaries'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'significant-data-fiduciaries'],
    topics: ['rules', 'retention', 'erasure', 'storage-limitation', 'data-lifecycle'],
    posterAngles: [
      'Do not keep data forever — the Rules force erasure after set inactivity periods',
      'Warn the individual before deleting, then erase what the purpose no longer needs'
    ]
  },
  {
    id: 'dpdp-rule-rights-timeline',
    framework: 'DPDP',
    citation: 'DPDP Rules 2025 r.13',
    level: 1,
    region: 'IN',
    title: 'Rules — Exercise of Data-Principal Rights and Grievance Timelines',
    summary: 'The Draft Rules require fiduciaries and consent managers to publish how data principals can exercise their rights, and to respond to rights requests and grievances within specified time periods.',
    text: 'The Draft Rules operationalise the data-principal rights and grievance duties (§§11–13). A Data Fiduciary and a Consent Manager must publish, on their website or app, the means by which a Data Principal may make a request to exercise their rights (such as an identifier the principal must use) and must respond to those requests within the period they publish. They must also implement a grievance-redressal mechanism and respond to grievances within the time period specified in the Rules, ensuring individuals get timely responses.',
    obligations: ['Publish the means and identifiers for exercising data-principal rights', 'Respond to rights requests within the published/prescribed period', 'Operate a grievance-redressal mechanism and respond within the prescribed time'],
    penalties: null,
    appliesTo: ['data-fiduciaries', 'data-principals'],
    topics: ['rules', 'data-principal-rights', 'grievance-redressal', 'timelines', 'access', 'correction'],
    posterAngles: [
      'Publish how people can exercise their rights — and answer within the deadline',
      'Grievances need a real mechanism and a timely, tracked response'
    ]
  },
  {
    id: 'dpdp-rule-security-safeguards',
    framework: 'DPDP',
    citation: 'DPDP Rules 2025 r.6',
    level: 1,
    region: 'IN',
    title: 'Rules — Reasonable Security Safeguards',
    summary: 'The Draft Rules specify baseline security safeguards a fiduciary must implement — encryption/obfuscation, access controls, logging and monitoring, backups, and contractual security obligations on processors.',
    text: 'The Draft Rules give content to §8\'s security-safeguards duty. A Data Fiduciary must protect personal data in its possession or control (including that processed on its behalf) by implementing reasonable safeguards such as encryption, obfuscation, masking or the use of virtual tokens; appropriate access controls; logs, monitoring and review to detect unauthorised access and enable investigation; measures for continued processing during a security-event disruption (backups); and retention of logs and personal data for a period enabling breach detection and response. It must also ensure, by contract, that its Data Processors implement equivalent safeguards.',
    obligations: ['Apply encryption/masking/tokenisation and strict access controls to personal data', 'Maintain logs and monitoring to detect and investigate unauthorised access', 'Keep backups to enable continued processing after a security event', 'Contractually require Data Processors to implement equivalent safeguards'],
    penalties: 'Failure to take reasonable security safeguards to prevent a personal data breach can attract a penalty up to ₹250 crore under the Schedule.',
    appliesTo: ['data-fiduciaries', 'data-processors'],
    topics: ['rules', 'security-safeguards', 'encryption', 'access-control', 'logging', 'processor'],
    posterAngles: [
      'The Rules name the controls: encrypt, restrict access, log, monitor and back up',
      'Your vendors must match your security — put it in the contract',
      'Weak safeguards are a ₹250 crore risk — treat security as a legal duty, not an option'
    ]
  }
];

export default entries;
