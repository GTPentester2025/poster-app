// GDPR knowledge corpus — Regulation (EU) 2016/679 (General Data Protection
// Regulation). One entry PER ARTICLE (all 99 articles) plus a curated set of
// awareness-relevant recitals. Conforms exactly to ../knowledge/schema.js
// (validateEntry / validateCorpus). Content is AUTHORITATIVE PARAPHRASE — an
// accurate plain-language restatement of each provision, never verbatim text.
//
// Fine tiers (Art. 83):
//   higher = 'Up to €20M or 4% of global annual turnover, whichever is higher'
//            — breaches of basic principles (Art. 5,6,7,9), data-subject rights
//            (Art. 12–22), and international transfers (Art. 44–49).
//   lower  = 'Up to €10M or 2% of global annual turnover'
//            — breaches of controller/processor obligations (Art. 8,11,25–39,42,43).
//   Purely definitional / institutional / final-provision articles carry no
//   direct administrative fine (penalties: null).

const HIGHER = 'Up to €20M or 4% of global annual turnover, whichever is higher';
const LOWER = 'Up to €10M or 2% of global annual turnover';

/** @type {import('./schema.js').KnowledgeEntry[]} */
export default [
  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER I — General provisions (Art. 1–4)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-1',
    framework: 'GDPR',
    citation: 'GDPR Art. 1',
    level: 0,
    region: 'EU',
    title: 'Subject-matter and objectives',
    summary: 'The Regulation lays down rules on protecting individuals with regard to the processing of their personal data and on the free movement of such data within the EU.',
    text: 'GDPR protects the fundamental rights and freedoms of natural persons, in particular their right to the protection of personal data. It also ensures the free flow of personal data between EU Member States, which may not be restricted or prohibited for reasons connected with that protection. Data protection and the internal market are treated as complementary, not competing, objectives.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['scope', 'fundamental-rights', 'free-movement', 'privacy', 'objectives'],
    posterAngles: [
      'Data protection is a fundamental right — not optional paperwork.',
      'Protecting personal data and doing business go hand in hand.'
    ]
  },
  {
    id: 'gdpr-art-2',
    framework: 'GDPR',
    citation: 'GDPR Art. 2',
    level: 0,
    region: 'EU',
    title: 'Material scope',
    summary: 'GDPR applies to the processing of personal data wholly or partly by automated means, and to non-automated processing of data forming part of a filing system.',
    text: 'The Regulation governs almost all handling of personal data, whether digital or in structured paper files. It carves out narrow exceptions: purely personal or household activity, processing for national security or common foreign policy, and processing by authorities for criminal-law enforcement (covered by the separate Law Enforcement Directive). If your organisation touches EU personal data in the course of its activities, GDPR almost certainly applies.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['material-scope', 'automated-processing', 'filing-system', 'exemptions'],
    posterAngles: [
      'Digital or paper — if it identifies a person, GDPR covers it.',
      'A structured filing cabinet counts as processing too.'
    ]
  },
  {
    id: 'gdpr-art-3',
    framework: 'GDPR',
    citation: 'GDPR Art. 3',
    level: 0,
    region: 'EU',
    title: 'Territorial scope',
    summary: 'GDPR applies to processing by an EU establishment, and to non-EU organisations that offer goods or services to, or monitor the behaviour of, people in the EU.',
    text: 'The Regulation reaches beyond EU borders. It applies wherever a controller or processor is established in the EU, regardless of where the processing happens. It also applies to organisations outside the EU when they target individuals in the EU with goods or services (even free ones) or monitor their behaviour, such as tracking them online. Extraterritorial reach means location is no shield.',
    obligations: ['Appoint an EU representative under Art. 27 where the extraterritorial trigger applies and no exemption exists'],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['territorial-scope', 'extraterritorial', 'targeting', 'monitoring', 'establishment'],
    posterAngles: [
      'Based outside the EU? If you target EU users, GDPR still applies.',
      'Tracking EU visitors online pulls you into GDPR scope.'
    ]
  },
  {
    id: 'gdpr-art-4',
    framework: 'GDPR',
    citation: 'GDPR Art. 4',
    level: 0,
    region: 'EU',
    title: 'Definitions',
    summary: 'Defines the core terms of the Regulation, including personal data, processing, controller, processor, consent, pseudonymisation, and personal data breach.',
    text: 'Article 4 is the dictionary of GDPR. "Personal data" is any information relating to an identified or identifiable person; "processing" is virtually any operation on it (collection, storage, use, disclosure, erasure). A "controller" decides why and how data is processed; a "processor" acts on the controller\'s behalf. It also defines consent, pseudonymisation, profiling, filing system, and personal data breach — the vocabulary the rest of the Regulation relies on.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors', 'all-employees'],
    topics: ['definitions', 'personal-data', 'processing', 'controller', 'processor', 'pseudonymisation', 'consent'],
    posterAngles: [
      'Personal data = anything that can identify a person, directly or indirectly.',
      'Know your role: controller decides, processor acts on instructions.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER II — Principles (Art. 5–11)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-5',
    framework: 'GDPR',
    citation: 'GDPR Art. 5',
    level: 0,
    region: 'EU',
    title: 'Principles relating to processing of personal data',
    summary: 'Sets the seven core principles: lawfulness/fairness/transparency, purpose limitation, data minimisation, accuracy, storage limitation, integrity/confidentiality, and accountability.',
    text: 'Article 5 is the backbone of GDPR. Personal data must be processed lawfully, fairly and transparently; collected for specified, explicit purposes and not reused incompatibly; limited to what is necessary; kept accurate and up to date; stored no longer than needed; and protected by appropriate security. The seventh principle — accountability — requires the controller to be able to demonstrate compliance with all the others. Breach of these principles sits in the highest fine tier.',
    obligations: [
      'Process personal data lawfully, fairly and transparently',
      'Collect data only for specified, explicit and legitimate purposes',
      'Minimise data to what is necessary for the purpose',
      'Keep personal data accurate and up to date',
      'Store data no longer than necessary',
      'Ensure appropriate security, integrity and confidentiality',
      'Be able to demonstrate compliance (accountability)'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['principles', 'lawfulness', 'purpose-limitation', 'data-minimisation', 'accuracy', 'storage-limitation', 'accountability', 'integrity', 'confidentiality'],
    posterAngles: [
      'Collect only what you need — data minimisation is the law.',
      'Every dataset needs a purpose and an expiry date.',
      'If you can\'t prove you\'re compliant, you\'re not — that\'s accountability.'
    ]
  },
  {
    id: 'gdpr-art-6',
    framework: 'GDPR',
    citation: 'GDPR Art. 6',
    level: 0,
    region: 'EU',
    title: 'Lawfulness of processing',
    summary: 'Processing is lawful only if at least one of six legal bases applies: consent, contract, legal obligation, vital interests, public task, or legitimate interests.',
    text: 'You cannot process personal data without a lawful basis. Article 6 provides exactly six: the person\'s consent; necessity for a contract with them; compliance with a legal obligation; protection of someone\'s vital interests; a task in the public interest or official authority; or the controller\'s (or a third party\'s) legitimate interests, unless overridden by the individual\'s rights. Legitimate interests cannot be used by public authorities in the exercise of their tasks. The basis must be identified before processing begins.',
    obligations: [
      'Identify and document a valid lawful basis before processing',
      'Ensure any reuse for a new purpose is compatible or independently lawful',
      'For legitimate interests, carry out and record a balancing test'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['lawful-basis', 'consent', 'contract', 'legal-obligation', 'legitimate-interests', 'vital-interests', 'public-task'],
    posterAngles: [
      'No lawful basis, no processing — pick one of the six before you start.',
      'Legitimate interest isn\'t a free pass — you must balance it against people\'s rights.'
    ]
  },
  {
    id: 'gdpr-art-7',
    framework: 'GDPR',
    citation: 'GDPR Art. 7',
    level: 0,
    region: 'EU',
    title: 'Conditions for consent',
    summary: 'Where consent is the basis, the controller must be able to prove it was given, request it clearly and separately, allow easy withdrawal, and not make service conditional on unnecessary consent.',
    text: 'When you rely on consent, Article 7 sets strict conditions. The controller must demonstrate that consent was actually given. Any written consent request must be clearly distinguishable, in plain language — not buried in other terms. Individuals must be able to withdraw consent as easily as they gave it, at any time. Consent is not "freely given" if a service is made conditional on consent to processing that is not necessary for that service (no bundling or tying).',
    obligations: [
      'Keep records demonstrating consent was obtained',
      'Present consent requests clearly, separately and in plain language',
      'Enable withdrawal of consent as easily as it was given',
      'Do not make a service conditional on unnecessary consent'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['consent', 'withdrawal', 'plain-language', 'freely-given', 'proof-of-consent'],
    posterAngles: [
      'Pre-ticked boxes aren\'t consent — silence never means yes.',
      'People must be able to say "no" and withdraw just as easily as they said "yes".'
    ]
  },
  {
    id: 'gdpr-art-8',
    framework: 'GDPR',
    citation: 'GDPR Art. 8',
    level: 0,
    region: 'EU',
    title: 'Conditions applicable to child\'s consent for information society services',
    summary: 'For online services offered directly to children, consent is valid only from age 16 (Member States may lower to 13); below that, a parent or guardian must consent.',
    text: 'When offering online services directly to a child, the child\'s own consent is only lawful if they are at least 16 (Member States can set a lower threshold, but not below 13). For younger children, consent must be given or authorised by the holder of parental responsibility. The controller must make reasonable efforts, using available technology, to verify that such consent is genuine.',
    obligations: [
      'Verify age before relying on a child\'s consent online',
      'Obtain parental consent for children below the applicable age threshold',
      'Make reasonable efforts to verify parental authorisation'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers'],
    topics: ['children', 'age-verification', 'parental-consent', 'online-services', 'consent'],
    posterAngles: [
      'Services for kids need a parent\'s consent — verify age first.',
      'Under 16 (or 13)? A guardian must approve the data collection.'
    ]
  },
  {
    id: 'gdpr-art-9',
    framework: 'GDPR',
    citation: 'GDPR Art. 9',
    level: 0,
    region: 'EU',
    title: 'Processing of special categories of personal data',
    summary: 'Processing sensitive data — health, race, religion, sexual orientation, biometrics, political views, genetics, trade-union membership — is prohibited unless a specific exception applies.',
    text: 'Special-category (sensitive) data gets extra protection. Article 9 bans processing it by default. Ten exceptions allow it, including explicit consent, employment/social-security law, vital interests, legitimate activities of a non-profit, data made public by the person, legal claims, substantial public interest, healthcare, public health, and archiving/research — each subject to safeguards. Sensitive data breaches sit in the highest fine tier.',
    obligations: [
      'Do not process special-category data unless a specific Art. 9(2) exception applies',
      'Where relying on explicit consent, ensure it is explicit and documented',
      'Apply appropriate safeguards for sensitive-data processing'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['special-categories', 'sensitive-data', 'health-data', 'biometrics', 'explicit-consent', 'genetics'],
    posterAngles: [
      'Health, religion, biometrics — sensitive data needs extra care and a special legal basis.',
      'Handling sensitive data? Default answer is "no" unless a clear exception applies.'
    ]
  },
  {
    id: 'gdpr-art-10',
    framework: 'GDPR',
    citation: 'GDPR Art. 10',
    level: 0,
    region: 'EU',
    title: 'Processing of personal data relating to criminal convictions and offences',
    summary: 'Data on criminal convictions and offences may be processed only under the control of official authority or where authorised by EU or Member State law with appropriate safeguards.',
    text: 'Criminal-offence data is highly sensitive but sits in its own regime rather than Article 9. It may only be processed under the control of official authority, or when EU or national law expressly permits it with safeguards for data-subject rights. A comprehensive register of criminal convictions can only be kept under the control of official authority.',
    obligations: [
      'Process criminal-offence data only under official authority or a specific legal authorisation',
      'Apply appropriate safeguards for rights and freedoms'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['criminal-data', 'convictions', 'offences', 'official-authority', 'safeguards'],
    posterAngles: [
      'Criminal-record data is off-limits without a specific legal authorisation.',
      'No lawful mandate, no processing of conviction data.'
    ]
  },
  {
    id: 'gdpr-art-11',
    framework: 'GDPR',
    citation: 'GDPR Art. 11',
    level: 0,
    region: 'EU',
    title: 'Processing which does not require identification',
    summary: 'If the controller cannot identify a person from the data it holds, it need not acquire extra information solely to comply, and certain rights may not apply unless the person provides identifying data.',
    text: 'Where the purposes do not (or no longer) require the controller to identify an individual, the controller is not obliged to keep, acquire or process additional information just to comply with GDPR. In such cases the access, rectification, erasure, restriction and portability rights may not apply — unless the individual, for the purpose of exercising a right, supplies information enabling their identification. This encourages data minimisation without weakening rights where identification is genuinely possible.',
    obligations: [
      'Do not retain extra data solely to identify people for compliance',
      'Inform data subjects where identification is not possible, if feasible',
      'Honour rights where the data subject provides identifying information'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers'],
    topics: ['identification', 'data-minimisation', 'anonymisation', 'rights'],
    posterAngles: [
      'Can\'t identify someone from your data? Don\'t collect more just to check.',
      'Less identifying data means less risk — minimisation protects everyone.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER III — Rights of the data subject (Art. 12–23)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-12',
    framework: 'GDPR',
    citation: 'GDPR Art. 12',
    level: 0,
    region: 'EU',
    title: 'Transparent information, communication and modalities for exercising rights',
    summary: 'Controllers must provide information and respond to rights requests concisely, transparently, in clear plain language, usually free of charge and within one month.',
    text: 'Article 12 governs how the other rights are delivered. Communications must be concise, transparent, intelligible and in plain language, especially for children. Controllers must facilitate the exercise of data-subject rights and respond without undue delay — within one month, extendable by two more for complex requests. Responses are normally free; manifestly unfounded or excessive requests may attract a fee or be refused, with the burden on the controller to justify that.',
    obligations: [
      'Provide information in concise, transparent, plain language',
      'Facilitate the exercise of data-subject rights',
      'Respond to requests without undue delay and within one month (extendable to three)',
      'Provide responses free of charge in normal cases'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['transparency', 'plain-language', 'response-time', 'data-subject-rights', 'communication'],
    posterAngles: [
      'People have a right to a plain-language answer — no legalese, no runaround.',
      'A rights request starts a one-month clock — route it fast.'
    ]
  },
  {
    id: 'gdpr-art-13',
    framework: 'GDPR',
    citation: 'GDPR Art. 13',
    level: 0,
    region: 'EU',
    title: 'Information to be provided where personal data are collected from the data subject',
    summary: 'When collecting data directly from a person, controllers must proactively tell them who they are, why and how long data is processed, the legal basis, recipients, and their rights.',
    text: 'When you collect personal data straight from the individual, you must give them a privacy notice at the time of collection. It covers the controller\'s identity and contact details (and the DPO\'s), the purposes and legal basis, any legitimate interests relied on, recipients or categories of recipients, transfers abroad, retention period, their rights (access, rectification, erasure, restriction, objection, portability, complaint), whether provision is mandatory, and any automated decision-making. Transparency up front is non-negotiable.',
    obligations: [
      'Provide a privacy notice at the point of direct collection',
      'Disclose purposes, legal basis, recipients, retention and transfers',
      'Inform data subjects of all their rights and how to complain',
      'Disclose the existence of automated decision-making and profiling'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['transparency', 'privacy-notice', 'information-duty', 'collection', 'data-subject-rights'],
    posterAngles: [
      'Ask for data? Tell people why, how long, and what rights they have — up front.',
      'A privacy notice at collection isn\'t a formality — it\'s the law.'
    ]
  },
  {
    id: 'gdpr-art-14',
    framework: 'GDPR',
    citation: 'GDPR Art. 14',
    level: 0,
    region: 'EU',
    title: 'Information to be provided where personal data have not been obtained from the data subject',
    summary: 'When data is obtained indirectly (e.g. from a third party), the controller must still inform the individual — normally within one month — including the source of the data.',
    text: 'If you get personal data from someone other than the individual — a data broker, partner, or public source — you still owe them a privacy notice. It mirrors Article 13 but adds the categories of data and the source it came from. You must provide it within a reasonable period (at most one month), or at first contact/first disclosure if sooner. Limited exceptions apply where the person already has the information, notice is impossible or disproportionate, or law requires the processing.',
    obligations: [
      'Inform indirectly-sourced individuals of processing, normally within one month',
      'Disclose the categories of data and their source',
      'Apply Art. 14 exceptions only where genuinely justified and documented'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['transparency', 'indirect-collection', 'third-party-data', 'data-source', 'information-duty'],
    posterAngles: [
      'Bought or received a data list? You still have to tell people you hold their data.',
      'Indirect data has a paper trail — disclose where it came from.'
    ]
  },
  {
    id: 'gdpr-art-15',
    framework: 'GDPR',
    citation: 'GDPR Art. 15',
    level: 0,
    region: 'EU',
    title: 'Right of access by the data subject',
    summary: 'Individuals can ask whether their data is being processed and, if so, obtain a copy plus details on purposes, recipients, retention, source, and their rights.',
    text: 'The right of access (a Subject Access Request or SAR) lets people confirm whether you hold their data and get a copy of it, along with the purposes, categories of data, recipients, retention period, the existence of their rights, the source if indirect, and any automated decision-making logic. The first copy is free; further copies may bear a reasonable fee. The copy must not adversely affect others\' rights and freedoms.',
    obligations: [
      'Confirm whether personal data is being processed on request',
      'Provide a copy of the data and the required contextual information',
      'Provide the first copy free of charge',
      'Respect the rights and freedoms of others when disclosing'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['right-of-access', 'SAR', 'subject-access-request', 'copy-of-data', 'transparency'],
    posterAngles: [
      'Anyone can ask "what do you know about me?" — and you must answer.',
      'A Subject Access Request is a legal right, not a favour — respond within a month.'
    ]
  },
  {
    id: 'gdpr-art-16',
    framework: 'GDPR',
    citation: 'GDPR Art. 16',
    level: 0,
    region: 'EU',
    title: 'Right to rectification',
    summary: 'Individuals can require the controller to correct inaccurate personal data and complete data that is incomplete, without undue delay.',
    text: 'People have the right to have inaccurate personal data about them corrected without undue delay. They can also have incomplete data completed, including by providing a supplementary statement. Acting on wrong data can cause real harm, so this right keeps records honest and current.',
    obligations: [
      'Correct inaccurate personal data without undue delay',
      'Complete incomplete data, including via supplementary statements',
      'Communicate rectifications to recipients where required (Art. 19)'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['rectification', 'accuracy', 'correction', 'data-subject-rights'],
    posterAngles: [
      'Spot wrong data about someone? They have the right to have it fixed — fast.',
      'Accurate records protect people — correct errors, don\'t act on them.'
    ]
  },
  {
    id: 'gdpr-art-17',
    framework: 'GDPR',
    citation: 'GDPR Art. 17',
    level: 0,
    region: 'EU',
    title: 'Right to erasure (‘right to be forgotten’)',
    summary: 'Individuals can require deletion of their personal data in specific circumstances, such as when it is no longer needed, consent is withdrawn, or processing was unlawful.',
    text: 'The right to erasure lets people have their data deleted without undue delay when: it is no longer necessary for the original purpose; consent is withdrawn and no other basis applies; they successfully object; the data was processed unlawfully; erasure is required by law; or it concerns a child\'s data from an online service. Where the controller made the data public, it must take reasonable steps to inform other controllers of the erasure request. Exceptions include freedom of expression, legal obligations, public-health, archiving/research, and legal claims.',
    obligations: [
      'Erase personal data without undue delay where a ground in Art. 17(1) applies',
      'Take reasonable steps to inform other controllers of erasure of public data',
      'Assess and document any applicable exemption (e.g. legal obligation, free expression)'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['erasure', 'right-to-be-forgotten', 'deletion', 'consent-withdrawal', 'data-subject-rights'],
    posterAngles: [
      'The "right to be forgotten" is real — people can demand their data be deleted.',
      'No longer need someone\'s data? Delete it — don\'t hoard it "just in case".',
      'Consent withdrawn? Erasure may follow — know your deletion workflow.'
    ]
  },
  {
    id: 'gdpr-art-18',
    framework: 'GDPR',
    citation: 'GDPR Art. 18',
    level: 0,
    region: 'EU',
    title: 'Right to restriction of processing',
    summary: 'Individuals can require the controller to "freeze" processing of their data in certain situations — for example while accuracy or an objection is being verified.',
    text: 'The right to restriction lets people pause processing rather than delete data. It applies while accuracy is contested, where processing is unlawful but the person prefers restriction to erasure, where the controller no longer needs the data but the person needs it for legal claims, or while an objection is being assessed. Restricted data may still be stored but otherwise only processed with consent, for legal claims, to protect others, or for important public interest.',
    obligations: [
      'Restrict (freeze) processing when a ground in Art. 18(1) applies',
      'Only store restricted data; process it further only under narrow exceptions',
      'Inform the data subject before lifting a restriction'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['restriction', 'freeze-processing', 'data-subject-rights', 'accuracy-dispute'],
    posterAngles: [
      'People can hit "pause" on their data while a dispute is sorted out.',
      'Restriction means store but don\'t use — respect the freeze.'
    ]
  },
  {
    id: 'gdpr-art-19',
    framework: 'GDPR',
    citation: 'GDPR Art. 19',
    level: 0,
    region: 'EU',
    title: 'Notification obligation regarding rectification or erasure or restriction',
    summary: 'Controllers must notify each recipient of any rectification, erasure, or restriction of data, unless doing so is impossible or disproportionate.',
    text: 'When a controller corrects, deletes, or restricts personal data, it must pass that change on to every recipient it disclosed the data to, unless this proves impossible or involves disproportionate effort. On request, the controller must tell the individual who those recipients are. This stops corrected or deleted data lingering downstream.',
    obligations: [
      'Notify all recipients of rectification, erasure or restriction',
      'Inform the data subject of the recipients on request'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['notification', 'recipients', 'rectification', 'erasure', 'restriction'],
    posterAngles: [
      'Fixed or deleted data? Tell everyone you shared it with, too.',
      'Corrections must travel downstream — don\'t leave stale copies behind.'
    ]
  },
  {
    id: 'gdpr-art-20',
    framework: 'GDPR',
    citation: 'GDPR Art. 20',
    level: 0,
    region: 'EU',
    title: 'Right to data portability',
    summary: 'Where processing is based on consent or contract and is automated, individuals can receive their data in a structured, machine-readable format and have it transmitted to another controller.',
    text: 'Data portability lets people get the personal data they provided in a structured, commonly used, machine-readable format, and reuse it elsewhere — including having it transmitted directly from one controller to another where technically feasible. It applies only to data the person provided, processed by automated means on the basis of consent or a contract. It must not adversely affect the rights of others.',
    obligations: [
      'Provide data in a structured, commonly used, machine-readable format',
      'Transmit data directly to another controller where technically feasible',
      'Apply portability only to consent/contract-based automated processing'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['portability', 'machine-readable', 'data-transfer', 'interoperability', 'data-subject-rights'],
    posterAngles: [
      'People own their data — they can take it and move it to a competitor.',
      'Portability means no lock-in: hand data back in a reusable format.'
    ]
  },
  {
    id: 'gdpr-art-21',
    framework: 'GDPR',
    citation: 'GDPR Art. 21',
    level: 0,
    region: 'EU',
    title: 'Right to object',
    summary: 'Individuals can object to processing based on legitimate interests or public task, and can object to direct marketing at any time — which must then stop absolutely.',
    text: 'People can object, on grounds relating to their particular situation, to processing based on public-task or legitimate-interests grounds; the controller must stop unless it shows compelling legitimate grounds that override the individual\'s interests, or the data is needed for legal claims. For direct marketing the right is absolute: once someone objects, marketing to them must stop immediately, with no balancing. Individuals must be told of this right clearly, at the latest at first communication.',
    obligations: [
      'Stop legitimate-interest/public-task processing on objection unless overriding grounds are shown',
      'Stop direct marketing immediately and unconditionally on objection',
      'Explicitly inform data subjects of the right to object at first contact'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['objection', 'direct-marketing', 'opt-out', 'legitimate-interests', 'data-subject-rights'],
    posterAngles: [
      'Say "stop marketing to me" once — and it must stop, no questions asked.',
      'People can object to profiling and legitimate-interest processing — respect it.'
    ]
  },
  {
    id: 'gdpr-art-22',
    framework: 'GDPR',
    citation: 'GDPR Art. 22',
    level: 0,
    region: 'EU',
    title: 'Automated individual decision-making, including profiling',
    summary: 'Individuals have the right not to be subject to solely automated decisions with legal or similarly significant effects, save for narrow exceptions with safeguards.',
    text: 'People have the right not to be subject to a decision based solely on automated processing — including profiling — that produces legal effects or similarly significantly affects them. Exceptions allow it where necessary for a contract, authorised by law, or based on explicit consent; even then, the controller must safeguard rights, including a right to human intervention, to express a view, and to contest the decision. Solely automated decisions generally cannot rely on special-category data.',
    obligations: [
      'Do not make solely automated significant decisions except under Art. 22(2) exceptions',
      'Provide human intervention, the ability to contest, and to express a view',
      'Restrict use of special-category data in automated decisions'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers'],
    topics: ['automated-decisions', 'profiling', 'ai', 'human-intervention', 'algorithmic', 'data-subject-rights'],
    posterAngles: [
      'A machine made the call? People have the right to a human to review it.',
      'Automated decisions that seriously affect people need human oversight — not a black box.'
    ]
  },
  {
    id: 'gdpr-art-23',
    framework: 'GDPR',
    citation: 'GDPR Art. 23',
    level: 0,
    region: 'EU',
    title: 'Restrictions',
    summary: 'EU or Member State law may restrict certain rights and obligations where necessary and proportionate to safeguard interests such as national security, defence, or crime prevention.',
    text: 'Article 23 lets EU or national law limit the scope of certain obligations and rights (Art. 12–22, Art. 34, and corresponding principles) when it is a necessary and proportionate measure to protect defined public interests — national and public security, defence, crime prevention, judicial independence, other important public or economic interests, or the protection of data subjects and others. Any such restriction must respect the essence of fundamental rights and contain specific safeguards.',
    obligations: [
      'Apply legislative restrictions only where necessary, proportionate and lawful',
      'Respect the essence of fundamental rights and include specified safeguards'
    ],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['restrictions', 'national-security', 'proportionality', 'public-interest', 'limitations'],
    posterAngles: [
      'Rights can be limited only by law, only when necessary and proportionate.',
      'Even legal restrictions can\'t hollow out the core of privacy rights.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER IV — Controller and processor (Art. 24–43)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-24',
    framework: 'GDPR',
    citation: 'GDPR Art. 24',
    level: 0,
    region: 'EU',
    title: 'Responsibility of the controller',
    summary: 'Controllers must implement appropriate technical and organisational measures to ensure and demonstrate that processing complies with GDPR, proportionate to the risk.',
    text: 'The controller carries overall responsibility. It must put in place appropriate technical and organisational measures — reviewed and updated over time — to ensure and be able to demonstrate that processing complies with GDPR, taking into account the nature, scope, context and purposes of processing and the risks involved. Where proportionate, this includes appropriate data-protection policies. This is accountability in action.',
    obligations: [
      'Implement appropriate technical and organisational measures',
      'Demonstrate compliance (documentation, policies, records)',
      'Review and update measures as risks change'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers'],
    topics: ['accountability', 'controller-responsibility', 'technical-organisational-measures', 'policies', 'risk'],
    posterAngles: [
      'Compliance isn\'t a one-off — it must be built in and kept up to date.',
      'The controller owns the outcome: measures, policies, and proof.'
    ]
  },
  {
    id: 'gdpr-art-25',
    framework: 'GDPR',
    citation: 'GDPR Art. 25',
    level: 0,
    region: 'EU',
    title: 'Data protection by design and by default',
    summary: 'Controllers must build data-protection measures into processing from the outset (by design) and ensure that, by default, only data necessary for each purpose is processed.',
    text: 'Privacy must be engineered in, not bolted on. By design: at the time of determining the means and at the time of processing, the controller implements measures such as pseudonymisation to give effect to the principles. By default: only personal data necessary for each specific purpose is processed — covering the amount collected, the extent of processing, storage period and accessibility — so data is not made public or broadly accessible without the individual\'s action.',
    obligations: [
      'Embed data-protection principles into system and process design',
      'Ensure only necessary data is processed by default',
      'Use techniques such as pseudonymisation and minimisation from the outset'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers'],
    topics: ['privacy-by-design', 'privacy-by-default', 'pseudonymisation', 'minimisation', 'engineering'],
    posterAngles: [
      'Build privacy in from day one — you can\'t bolt it on later.',
      'Default to the minimum: collect less, expose less, keep less.'
    ]
  },
  {
    id: 'gdpr-art-26',
    framework: 'GDPR',
    citation: 'GDPR Art. 26',
    level: 0,
    region: 'EU',
    title: 'Joint controllers',
    summary: 'Where two or more controllers jointly determine purposes and means, they must transparently allocate their respective responsibilities in an arrangement, especially regarding data-subject rights.',
    text: 'When two or more controllers jointly decide the why and how of processing, they are joint controllers. They must set out their respective GDPR responsibilities in a transparent arrangement — especially who handles data-subject rights and information duties — and make the essence of it available to individuals. Regardless of the arrangement, a data subject may exercise their rights against each of the joint controllers.',
    obligations: [
      'Agree a transparent allocation of responsibilities between joint controllers',
      'Make the essence of the arrangement available to data subjects',
      'Allow data subjects to exercise rights against any joint controller'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers'],
    topics: ['joint-controllers', 'responsibility-allocation', 'transparency', 'data-subject-rights'],
    posterAngles: [
      'Sharing control of data? Agree who owns which duty — in writing.',
      'Joint controllers can\'t point fingers — people can claim against any of them.'
    ]
  },
  {
    id: 'gdpr-art-27',
    framework: 'GDPR',
    citation: 'GDPR Art. 27',
    level: 0,
    region: 'EU',
    title: 'Representatives of controllers or processors not established in the Union',
    summary: 'Non-EU organisations caught by GDPR must, with limited exceptions, designate a representative in the EU to act as a contact point for authorities and individuals.',
    text: 'Where a non-EU controller or processor is subject to GDPR under Article 3(2), it must appoint, in writing, a representative established in an EU Member State where its data subjects are. The representative serves as a point of contact for supervisory authorities and individuals on all processing matters. Exceptions apply to occasional, low-risk processing and to public authorities.',
    obligations: [
      'Designate an EU representative in writing where required',
      'Locate the representative in a Member State where data subjects are',
      'Mandate the representative as a contact point for authorities and individuals'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['eu-representative', 'non-eu', 'territorial-scope', 'contact-point'],
    posterAngles: [
      'Outside the EU but serving EU users? You likely need an EU representative.',
      'A named EU contact isn\'t optional — regulators and users must be able to reach you.'
    ]
  },
  {
    id: 'gdpr-art-28',
    framework: 'GDPR',
    citation: 'GDPR Art. 28',
    level: 0,
    region: 'EU',
    title: 'Processor',
    summary: 'Controllers may only use processors giving sufficient guarantees, under a binding contract that sets out strict processing terms and requires equivalent obligations of any sub-processors.',
    text: 'A controller may only engage processors that provide sufficient guarantees of GDPR-compliant processing. The relationship must be governed by a binding written contract (a Data Processing Agreement) covering the subject-matter, duration, nature and purpose, data types and categories of data subject, and the controller\'s rights. It must bind the processor to process only on documented instructions, ensure confidentiality, apply Article 32 security, assist with rights and breaches, delete or return data at the end, and allow audits. Sub-processors need authorisation and equivalent obligations.',
    obligations: [
      'Use only processors offering sufficient GDPR guarantees',
      'Put a binding processing contract (DPA) with mandatory terms in place',
      'Bind processors to instructions-only processing, confidentiality and security',
      'Require authorisation and equivalent terms for any sub-processor',
      'Require deletion/return of data and support for audits'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['processors', 'data-processing-agreement', 'DPA', 'sub-processors', 'contracts', 'due-diligence'],
    posterAngles: [
      'No vendor touches personal data without a Data Processing Agreement.',
      'Processors act only on written instructions — never off-script.',
      'Vet your suppliers: a weak processor is your liability too.'
    ]
  },
  {
    id: 'gdpr-art-29',
    framework: 'GDPR',
    citation: 'GDPR Art. 29',
    level: 0,
    region: 'EU',
    title: 'Processing under the authority of the controller or processor',
    summary: 'Anyone acting under the authority of the controller or processor, including employees with access to data, may only process personal data on the controller\'s instructions unless law requires otherwise.',
    text: 'The processor, and anyone acting under the authority of the controller or processor who has access to personal data — including staff — must not process that data except on instructions from the controller, unless required to by EU or Member State law. This locks down "freelancing" with personal data at every level of the organisation.',
    obligations: [
      'Process personal data only on the controller\'s documented instructions',
      'Ensure staff do not process data beyond authorised instructions'
    ],
    penalties: LOWER,
    appliesTo: ['processors', 'all-employees'],
    topics: ['instructions', 'authority', 'employee-access', 'processors'],
    posterAngles: [
      'Only use personal data for the task you were asked to do — no side quests.',
      'Access isn\'t permission — process data only on instructions.'
    ]
  },
  {
    id: 'gdpr-art-30',
    framework: 'GDPR',
    citation: 'GDPR Art. 30',
    level: 0,
    region: 'EU',
    title: 'Records of processing activities',
    summary: 'Controllers and processors must maintain written records of their processing activities, with limited exemptions for smaller organisations that process only low-risk data.',
    text: 'Controllers must keep a record of processing activities (a RoPA) listing purposes, categories of data subjects and data, recipients, transfers, retention periods and security measures. Processors keep a parallel record of processing carried out for each controller. The exemption for organisations under 250 employees is narrow — it falls away where processing is not occasional, is likely to risk rights, or involves special-category or criminal-offence data. Records must be available to the supervisory authority on request.',
    obligations: [
      'Maintain written records of processing activities (RoPA)',
      'Include purposes, data categories, recipients, transfers, retention and security',
      'Make records available to the supervisory authority on request'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['records-of-processing', 'RoPA', 'documentation', 'accountability'],
    posterAngles: [
      'If you can\'t list what data you process and why, you can\'t defend it.',
      'A processing record is your compliance map — keep it current.'
    ]
  },
  {
    id: 'gdpr-art-31',
    framework: 'GDPR',
    citation: 'GDPR Art. 31',
    level: 0,
    region: 'EU',
    title: 'Cooperation with the supervisory authority',
    summary: 'Controllers and processors must cooperate with the supervisory authority in the performance of its tasks on request.',
    text: 'On request, controllers and processors (and their representatives) must cooperate with the supervisory authority as it carries out its duties — for example during investigations, audits, or inquiries. Obstruction or non-cooperation is itself a compliance failure.',
    obligations: [
      'Cooperate with the supervisory authority on request',
      'Support investigations and inquiries in good faith'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['cooperation', 'supervisory-authority', 'investigation', 'accountability'],
    posterAngles: [
      'When the regulator calls, cooperation is a legal duty — not a choice.',
      'Stonewalling a supervisory authority makes a bad situation worse.'
    ]
  },
  {
    id: 'gdpr-art-32',
    framework: 'GDPR',
    citation: 'GDPR Art. 32',
    level: 0,
    region: 'EU',
    title: 'Security of processing',
    summary: 'Controllers and processors must implement appropriate technical and organisational security measures — such as encryption, pseudonymisation, resilience, and regular testing — proportionate to the risk.',
    text: 'Article 32 is the core security obligation. Taking account of the state of the art, costs, and the nature and risk of processing, controllers and processors must ensure a level of security appropriate to the risk. This may include pseudonymisation and encryption; the ability to ensure ongoing confidentiality, integrity, availability and resilience of systems; the ability to restore access after an incident; and a process for regularly testing and evaluating the effectiveness of measures. Risk assessment must consider accidental or unlawful destruction, loss, alteration, or unauthorised disclosure of, or access to, personal data.',
    obligations: [
      'Implement security appropriate to the risk (encryption, pseudonymisation, etc.)',
      'Ensure ongoing confidentiality, integrity, availability and resilience',
      'Be able to restore availability and access after an incident',
      'Regularly test, assess and evaluate the effectiveness of security measures'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors', 'all-employees'],
    topics: ['security', 'encryption', 'pseudonymisation', 'confidentiality', 'integrity', 'availability', 'resilience', 'access-control'],
    posterAngles: [
      'Encrypt personal data — at rest and in transit. It\'s the law, not a nice-to-have.',
      'Security means confidentiality, integrity AND availability — all three.',
      'Test your defences regularly — untested security is just hope.'
    ]
  },
  {
    id: 'gdpr-art-33',
    framework: 'GDPR',
    citation: 'GDPR Art. 33',
    level: 0,
    region: 'EU',
    title: 'Notification of a personal data breach to the supervisory authority',
    summary: 'Controllers must notify the supervisory authority of a personal data breach within 72 hours of becoming aware, unless it is unlikely to risk individuals\' rights; processors must alert the controller without undue delay.',
    text: 'When a personal data breach occurs, the controller must notify the competent supervisory authority without undue delay and, where feasible, within 72 hours of becoming aware of it. If notification is late, reasons must be given. The notification must describe the nature of the breach, categories and approximate numbers affected, the DPO contact, likely consequences, and measures taken or proposed. Notification is not required only where the breach is unlikely to result in a risk to rights and freedoms. Processors must notify the controller without undue delay. All breaches must be documented internally.',
    obligations: [
      'Notify the supervisory authority within 72 hours where a risk exists',
      'Include nature, scale, consequences and remedial measures in the notification',
      'Processors must alert the controller without undue delay',
      'Document all breaches internally regardless of notification'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors', 'all-employees'],
    topics: ['breach-notification', '72-hours', 'incident-response', 'supervisory-authority', 'documentation'],
    posterAngles: [
      'Suspect a data breach? Report it internally NOW — the 72-hour clock is ticking.',
      'A breach the regulator finds first is a breach that costs far more.',
      'Every incident gets logged — even the ones you don\'t have to report.'
    ]
  },
  {
    id: 'gdpr-art-34',
    framework: 'GDPR',
    citation: 'GDPR Art. 34',
    level: 0,
    region: 'EU',
    title: 'Communication of a personal data breach to the data subject',
    summary: 'Where a breach is likely to result in a high risk to individuals, the controller must inform the affected people without undue delay, in clear plain language.',
    text: 'When a breach is likely to result in a high risk to people\'s rights and freedoms, the controller must communicate it to the affected individuals without undue delay, in clear and plain language, describing the likely consequences and the measures taken. This is not required if the data was rendered unintelligible (e.g. strongly encrypted), if subsequent measures ensure the high risk will not materialise, or if individual communication would involve disproportionate effort (then a public communication suffices).',
    obligations: [
      'Inform affected individuals without undue delay when a high risk exists',
      'Use clear plain language describing consequences and remedial measures',
      'Rely on exemptions (encryption, mitigation, public notice) only where justified'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers'],
    topics: ['breach-communication', 'high-risk', 'data-subjects', 'transparency', 'incident-response'],
    posterAngles: [
      'A high-risk breach means telling the people affected — quickly and clearly.',
      'Strong encryption can be the difference between notifying and not notifying.'
    ]
  },
  {
    id: 'gdpr-art-35',
    framework: 'GDPR',
    citation: 'GDPR Art. 35',
    level: 0,
    region: 'EU',
    title: 'Data protection impact assessment',
    summary: 'Before high-risk processing — such as large-scale profiling, sensitive-data processing, or systematic monitoring — the controller must carry out a Data Protection Impact Assessment (DPIA).',
    text: 'Where a type of processing is likely to result in a high risk to individuals — especially new technologies — the controller must, before processing, carry out a DPIA. It is mandatory for systematic and extensive automated evaluation/profiling with significant effects, large-scale processing of special-category or criminal data, and large-scale systematic monitoring of publicly accessible areas. A DPIA must describe the processing, assess necessity and proportionality, evaluate risks, and set out mitigating measures. The DPO must be consulted.',
    obligations: [
      'Carry out a DPIA before high-risk processing begins',
      'Assess necessity, proportionality and risks, and identify mitigations',
      'Consult the DPO and review the DPIA as risks change'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers'],
    topics: ['DPIA', 'impact-assessment', 'high-risk', 'profiling', 'risk-assessment', 'privacy-by-design'],
    posterAngles: [
      'New high-risk project? Do the DPIA before you process, not after.',
      'A DPIA surfaces privacy risks early — while they\'re still cheap to fix.'
    ]
  },
  {
    id: 'gdpr-art-36',
    framework: 'GDPR',
    citation: 'GDPR Art. 36',
    level: 0,
    region: 'EU',
    title: 'Prior consultation',
    summary: 'Where a DPIA shows high residual risk that the controller cannot mitigate, it must consult the supervisory authority before processing.',
    text: 'If a DPIA indicates that processing would result in a high risk in the absence of measures the controller can take to mitigate it, the controller must consult the supervisory authority before starting. The authority may provide written advice or use its powers if it considers the intended processing would infringe GDPR. The controller must supply details of responsibilities, purposes, safeguards, and the DPIA.',
    obligations: [
      'Consult the supervisory authority before high residual-risk processing',
      'Provide the DPIA and required details for consultation',
      'Follow the authority\'s advice or exercise of powers'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers'],
    topics: ['prior-consultation', 'DPIA', 'high-risk', 'supervisory-authority'],
    posterAngles: [
      'Can\'t reduce a high privacy risk yourself? Ask the regulator before you launch.',
      'Prior consultation turns a compliance gamble into a checked decision.'
    ]
  },
  {
    id: 'gdpr-art-37',
    framework: 'GDPR',
    citation: 'GDPR Art. 37',
    level: 0,
    region: 'EU',
    title: 'Designation of the data protection officer',
    summary: 'Controllers and processors must appoint a Data Protection Officer where they are a public authority, conduct large-scale systematic monitoring, or process special-category or criminal data at scale.',
    text: 'A DPO must be designated where the processing is carried out by a public authority, where core activities involve regular and systematic monitoring of individuals on a large scale, or where core activities involve large-scale processing of special-category or criminal-offence data. The DPO is chosen on professional qualities and expert knowledge of data-protection law, may be internal or external, and their contact details must be published and given to the supervisory authority.',
    obligations: [
      'Designate a DPO where the mandatory triggers apply',
      'Select the DPO on the basis of professional expertise',
      'Publish DPO contact details and notify the supervisory authority'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['DPO', 'data-protection-officer', 'designation', 'governance'],
    posterAngles: [
      'Large-scale monitoring or sensitive data? A DPO isn\'t optional.',
      'Know who your DPO is — they\'re your go-to for privacy questions.'
    ]
  },
  {
    id: 'gdpr-art-38',
    framework: 'GDPR',
    citation: 'GDPR Art. 38',
    level: 0,
    region: 'EU',
    title: 'Position of the data protection officer',
    summary: 'The DPO must be involved in all data-protection matters, resourced, and able to act independently without instructions or dismissal for performing the role.',
    text: 'The organisation must involve the DPO properly and in a timely manner in all data-protection matters, give them the resources and access needed, and support their ongoing expertise. Crucially, the DPO must be independent: they receive no instructions on how to perform their tasks and cannot be dismissed or penalised for doing them. They report to the highest management level, and data subjects may contact them. The DPO must keep confidentiality.',
    obligations: [
      'Involve the DPO in all data-protection matters, in good time',
      'Provide the DPO with resources, access and support',
      'Guarantee DPO independence — no instructions, no penalisation',
      'Ensure the DPO reports to top management'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['DPO', 'independence', 'governance', 'resources', 'reporting'],
    posterAngles: [
      'A DPO must be independent — you can\'t fire them for raising a red flag.',
      'Loop the DPO in early — privacy problems are cheapest at the design stage.'
    ]
  },
  {
    id: 'gdpr-art-39',
    framework: 'GDPR',
    citation: 'GDPR Art. 39',
    level: 0,
    region: 'EU',
    title: 'Tasks of the data protection officer',
    summary: 'The DPO informs and advises on obligations, monitors compliance, advises on DPIAs, cooperates with the authority, and acts as its contact point.',
    text: 'The DPO\'s tasks include informing and advising the controller/processor and staff about their GDPR obligations; monitoring compliance, including awareness-raising and staff training; providing advice on DPIAs and monitoring their performance; cooperating with the supervisory authority; and acting as the contact point for the authority. The DPO must have due regard to the risk associated with processing operations.',
    obligations: [
      'Inform and advise the organisation and staff on GDPR obligations',
      'Monitor compliance, including awareness and training',
      'Advise on and monitor DPIAs',
      'Act as contact point and cooperate with the supervisory authority'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['DPO', 'training', 'monitoring-compliance', 'awareness', 'advice'],
    posterAngles: [
      'Your DPO runs the training and advice — use them before you slip up.',
      'DPOs monitor compliance and raise awareness — they\'re on your side.'
    ]
  },
  {
    id: 'gdpr-art-40',
    framework: 'GDPR',
    citation: 'GDPR Art. 40',
    level: 0,
    region: 'EU',
    title: 'Codes of conduct',
    summary: 'Associations may draw up codes of conduct to specify how GDPR applies to a sector; approved codes can help demonstrate compliance.',
    text: 'Associations and bodies representing categories of controllers or processors may prepare codes of conduct to tailor GDPR to their sector — covering fair processing, legitimate interests, pseudonymisation, information to individuals, rights, and breach handling. Codes are approved by the supervisory authority and can serve as an element in demonstrating compliance. Codes with cross-border relevance go through the EDPB and Commission.',
    obligations: [
      'Draft codes consistently with GDPR where adhering to one',
      'Adhere to approved code commitments and monitoring'
    ],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['codes-of-conduct', 'sector-standards', 'compliance-mechanism'],
    posterAngles: [
      'An approved code of conduct can be proof you take privacy seriously.',
      'Sector codes translate GDPR into your industry\'s language.'
    ]
  },
  {
    id: 'gdpr-art-41',
    framework: 'GDPR',
    citation: 'GDPR Art. 41',
    level: 0,
    region: 'EU',
    title: 'Monitoring of approved codes of conduct',
    summary: 'An accredited body may monitor compliance with a code of conduct, taking action against members who infringe it.',
    text: 'Compliance with an approved code of conduct may be monitored by a body accredited by the supervisory authority for that purpose, provided it has the expertise, independence and procedures to handle complaints and infringements. The monitoring body can suspend or exclude members that breach the code and must inform the supervisory authority of such actions.',
    obligations: [
      'Ensure code-monitoring bodies are accredited and independent',
      'Act against members that infringe a code of conduct'
    ],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['codes-of-conduct', 'monitoring-body', 'accreditation', 'enforcement'],
    posterAngles: [
      'Signing a code means real oversight — breach it and you can be expelled.',
      'Codes of conduct come with watchdogs, not just words.'
    ]
  },
  {
    id: 'gdpr-art-42',
    framework: 'GDPR',
    citation: 'GDPR Art. 42',
    level: 0,
    region: 'EU',
    title: 'Certification',
    summary: 'Data-protection certification, seals and marks may be established to demonstrate compliance; certification does not reduce the controller\'s responsibility.',
    text: 'Member States, authorities, the EDPB and the Commission encourage voluntary data-protection certification mechanisms, seals and marks to help demonstrate GDPR compliance of processing operations. Certification is granted for a maximum of three years and is renewable. Importantly, obtaining certification does not diminish the responsibility of the controller or processor for complying with GDPR.',
    obligations: [
      'Provide the information needed to assess a certification',
      'Continue to meet all GDPR obligations regardless of certification'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['certification', 'seals', 'compliance-mechanism', 'accountability'],
    posterAngles: [
      'A certification helps show compliance — but it never removes your responsibility.',
      'Seals and marks are evidence, not a shield from the rules.'
    ]
  },
  {
    id: 'gdpr-art-43',
    framework: 'GDPR',
    citation: 'GDPR Art. 43',
    level: 0,
    region: 'EU',
    title: 'Certification bodies',
    summary: 'Accredited certification bodies may issue and renew data-protection certifications where they have the requisite expertise and independence.',
    text: 'Certifications are issued by certification bodies accredited by the supervisory authority and/or national accreditation body, provided they demonstrate expertise, independence, and procedures to handle complaints and to issue, review and withdraw certifications. Accreditation lasts up to five years and can be revoked where requirements are no longer met.',
    obligations: [
      'Use only accredited certification bodies',
      'Cooperate with certification review and withdrawal processes'
    ],
    penalties: LOWER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['certification-bodies', 'accreditation', 'independence'],
    posterAngles: [
      'Only accredited bodies can issue GDPR certifications — check the source.',
      'Certification bodies can withdraw a seal — compliance must be ongoing.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER V — Transfers to third countries (Art. 44–50)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-44',
    framework: 'GDPR',
    citation: 'GDPR Art. 44',
    level: 0,
    region: 'EU',
    title: 'General principle for transfers',
    summary: 'Personal data may only be transferred outside the EU/EEA if the conditions of Chapter V are met, so that the level of protection guaranteed by GDPR is not undermined.',
    text: 'Any transfer of personal data to a third country or international organisation is permitted only if the controller and processor comply with the conditions in Chapter V — including onward transfers. The overriding aim is that the protection GDPR guarantees to individuals must not be undermined when their data leaves the EU. This is the gateway rule for all international transfers.',
    obligations: [
      'Transfer data internationally only under a valid Chapter V mechanism',
      'Ensure onward transfers preserve the GDPR level of protection'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['international-transfers', 'third-countries', 'adequacy', 'safeguards'],
    posterAngles: [
      'Sending data abroad needs a legal transfer mechanism — no exceptions.',
      'Data crossing borders must keep its GDPR-level protection.'
    ]
  },
  {
    id: 'gdpr-art-45',
    framework: 'GDPR',
    citation: 'GDPR Art. 45',
    level: 0,
    region: 'EU',
    title: 'Transfers on the basis of an adequacy decision',
    summary: 'Data may flow freely to a third country the European Commission has decided offers an adequate level of data protection.',
    text: 'The European Commission can decide that a third country, territory, sector or international organisation ensures an adequate level of protection. Where such an adequacy decision exists, transfers there require no additional authorisation and flow much like intra-EU transfers. The Commission monitors developments and can amend, suspend or repeal an adequacy decision.',
    obligations: [
      'Verify a valid adequacy decision covers the destination and processing',
      'Monitor for suspension or repeal of the relevant adequacy decision'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['adequacy-decision', 'international-transfers', 'third-countries'],
    posterAngles: [
      'Adequacy decisions are the green light — but check they still stand.',
      'An "adequate" country today can be revoked tomorrow — stay current.'
    ]
  },
  {
    id: 'gdpr-art-46',
    framework: 'GDPR',
    citation: 'GDPR Art. 46',
    level: 0,
    region: 'EU',
    title: 'Transfers subject to appropriate safeguards',
    summary: 'Without an adequacy decision, transfers need appropriate safeguards such as Standard Contractual Clauses, Binding Corporate Rules, codes, or certification, plus enforceable rights.',
    text: 'In the absence of adequacy, a controller or processor may transfer data only if it provides appropriate safeguards and enforceable rights and remedies for individuals. Recognised safeguards include Standard Contractual Clauses (SCCs) approved by the Commission, Binding Corporate Rules, approved codes of conduct, approved certification with binding commitments, and (with authorisation) ad hoc clauses or administrative arrangements. Since Schrems II, transferers must also assess whether local law undermines the safeguards and add supplementary measures where needed.',
    obligations: [
      'Put appropriate safeguards (e.g. SCCs, BCRs) in place before transferring',
      'Ensure enforceable data-subject rights and effective remedies',
      'Assess third-country law and add supplementary measures where needed'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['SCCs', 'standard-contractual-clauses', 'BCRs', 'safeguards', 'international-transfers', 'schrems'],
    posterAngles: [
      'No adequacy? Standard Contractual Clauses plus real safeguards are the route.',
      'Signing SCCs isn\'t enough — check the destination\'s laws too.'
    ]
  },
  {
    id: 'gdpr-art-47',
    framework: 'GDPR',
    citation: 'GDPR Art. 47',
    level: 0,
    region: 'EU',
    title: 'Binding corporate rules',
    summary: 'Multinational groups can transfer data internally across borders under Binding Corporate Rules approved by the supervisory authority.',
    text: 'Binding Corporate Rules (BCRs) are internal data-protection policies, approved by the competent supervisory authority, that allow a group of undertakings or enterprises engaged in a joint economic activity to transfer personal data across borders within the group. They must be legally binding, apply to every member, expressly confer enforceable rights on data subjects, and specify the group structure, transfers, data-protection principles, complaint procedures, and accountability mechanisms.',
    obligations: [
      'Obtain supervisory-authority approval before relying on BCRs',
      'Make BCRs legally binding on all group members',
      'Confer enforceable rights and remedies on data subjects'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['BCRs', 'binding-corporate-rules', 'intra-group-transfers', 'international-transfers'],
    posterAngles: [
      'Global group? BCRs let data move internally — once the regulator approves them.',
      'BCRs bind every group entity and give people real, enforceable rights.'
    ]
  },
  {
    id: 'gdpr-art-48',
    framework: 'GDPR',
    citation: 'GDPR Art. 48',
    level: 0,
    region: 'EU',
    title: 'Transfers or disclosures not authorised by Union law',
    summary: 'A foreign court or authority order to disclose EU personal data is only enforceable if based on an international agreement such as a mutual legal assistance treaty.',
    text: 'A judgment of a court or a decision of an administrative authority in a third country requiring a controller or processor to transfer or disclose personal data is only recognised or enforceable under GDPR if it is based on an international agreement, such as a mutual legal assistance treaty, in force between the requesting country and the EU or a Member State. This blunts unilateral foreign demands for EU data.',
    obligations: [
      'Do not act on foreign disclosure orders lacking an international-agreement basis',
      'Route such requests through lawful mutual-assistance channels'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['foreign-orders', 'disclosure', 'mutual-legal-assistance', 'international-transfers'],
    posterAngles: [
      'A foreign subpoena for EU data? It only counts with a proper treaty behind it.',
      'Don\'t hand over EU data to overseas authorities without a lawful channel.'
    ]
  },
  {
    id: 'gdpr-art-49',
    framework: 'GDPR',
    citation: 'GDPR Art. 49',
    level: 0,
    region: 'EU',
    title: 'Derogations for specific situations',
    summary: 'In the absence of adequacy or safeguards, transfers may still occur in limited cases such as explicit consent, contract necessity, important public interest, or legal claims.',
    text: 'Where neither an adequacy decision nor appropriate safeguards apply, a transfer is only permitted under specific derogations: the individual\'s explicit informed consent to the risks; necessity for a contract with or in the interest of the individual; important reasons of public interest; legal claims; vital interests where consent is impossible; or a transfer from a public register. A narrow one-off derogation exists for compelling legitimate interests with strict conditions. Derogations must be interpreted restrictively and not used for routine, repetitive transfers.',
    obligations: [
      'Rely on a transfer derogation only where narrowly justified',
      'Obtain explicit, informed consent to transfer risks where relied upon',
      'Do not use derogations for repetitive or mass transfers'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['derogations', 'explicit-consent', 'international-transfers', 'public-interest', 'legal-claims'],
    posterAngles: [
      'Transfer derogations are the last resort — narrow, not a routine workaround.',
      'Consent to a risky transfer must be explicit and truly informed.'
    ]
  },
  {
    id: 'gdpr-art-50',
    framework: 'GDPR',
    citation: 'GDPR Art. 50',
    level: 0,
    region: 'EU',
    title: 'International cooperation for the protection of personal data',
    summary: 'The Commission and authorities take steps to foster international cooperation and mutual assistance on enforcing data-protection law across borders.',
    text: 'Article 50 directs the Commission and supervisory authorities to develop international cooperation mechanisms to facilitate the effective enforcement of data-protection law, provide mutual assistance, engage stakeholders, and promote the exchange of legislation and practice — including on jurisdictional conflicts with third countries. It is a policy-oriented provision underpinning global data-protection dialogue.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['international-cooperation', 'mutual-assistance', 'enforcement', 'policy'],
    posterAngles: [
      'Privacy enforcement is going global — regulators cooperate across borders.',
      'Cross-border data means cross-border regulators working together.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER VI — Independent supervisory authorities (Art. 51–59)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-51',
    framework: 'GDPR',
    citation: 'GDPR Art. 51',
    level: 0,
    region: 'EU',
    title: 'Supervisory authority',
    summary: 'Each Member State must provide for one or more independent public supervisory authorities responsible for monitoring the application of GDPR.',
    text: 'Every Member State must establish one or more independent public authorities to monitor and enforce GDPR, protecting individuals\' rights and facilitating the free flow of data within the EU. Where there are several, one is designated to represent the state on the EDPB. These are the regulators (e.g. the CNIL, ICO-equivalents, DPAs) that individuals and organisations deal with.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['supervisory-authority', 'DPA', 'regulator', 'independence'],
    posterAngles: [
      'Every EU country has a privacy regulator — know who yours is.',
      'Supervisory authorities are independent watchdogs, not rubber stamps.'
    ]
  },
  {
    id: 'gdpr-art-52',
    framework: 'GDPR',
    citation: 'GDPR Art. 52',
    level: 0,
    region: 'EU',
    title: 'Independence',
    summary: 'Supervisory authorities must act with complete independence, free from external influence, with the resources and staff to perform their tasks.',
    text: 'Each supervisory authority must act with complete independence in performing its tasks and exercising its powers, remaining free from external influence and neither seeking nor taking instructions. Members must avoid conflicting occupations. Member States must ensure each authority has the human, technical and financial resources, premises and infrastructure it needs, subject to independent financial control.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['independence', 'supervisory-authority', 'resources', 'impartiality'],
    posterAngles: [
      'Data regulators answer to the law, not to industry or government.',
      'Independence gives supervisory authorities real bite.'
    ]
  },
  {
    id: 'gdpr-art-53',
    framework: 'GDPR',
    citation: 'GDPR Art. 53',
    level: 0,
    region: 'EU',
    title: 'General conditions for the members of the supervisory authority',
    summary: 'Members of supervisory authorities must be appointed transparently, hold the required qualifications, and can only be dismissed for serious misconduct or incapacity.',
    text: 'Members of each supervisory authority are appointed through a transparent procedure by the parliament, government, head of state or an independent body. They must have the qualifications, experience and skills needed for the role. Their term ends on expiry, resignation, or compulsory retirement, and a member may only be dismissed for serious misconduct or if they no longer fulfil the conditions for the role — reinforcing independence.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['supervisory-authority', 'appointment', 'qualifications', 'independence'],
    posterAngles: [
      'Regulators can\'t be fired for inconvenient decisions — only for real misconduct.',
      'Transparent appointment keeps privacy watchdogs credible.'
    ]
  },
  {
    id: 'gdpr-art-54',
    framework: 'GDPR',
    citation: 'GDPR Art. 54',
    level: 0,
    region: 'EU',
    title: 'Rules on the establishment of the supervisory authority',
    summary: 'Member State law must set out the establishment of each authority, including member terms, qualifications, duties and the ongoing duty of professional secrecy.',
    text: 'Member States must legislate for the establishment of each supervisory authority — the rules for appointment, term (at least four years), eligibility for reappointment, member duties and prohibitions during and after office. Members and staff are bound by a duty of professional secrecy, during and after their term, concerning confidential information learned in performing their tasks, in particular about individuals\' breaches of GDPR.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['supervisory-authority', 'establishment', 'professional-secrecy', 'terms'],
    posterAngles: [
      'Regulators are bound by secrecy — your submissions stay confidential.',
      'Fixed terms and clear rules keep authorities stable and trusted.'
    ]
  },
  {
    id: 'gdpr-art-55',
    framework: 'GDPR',
    citation: 'GDPR Art. 55',
    level: 0,
    region: 'EU',
    title: 'Competence',
    summary: 'Each supervisory authority is competent on its own territory; courts acting judicially are excluded from its remit.',
    text: 'A supervisory authority is competent to perform its tasks and exercise its powers within its own Member State\'s territory. Where processing is by public authorities or private bodies acting in the public interest, the authority of that Member State is competent. Supervisory authorities are not competent to supervise processing operations of courts acting in their judicial capacity, preserving judicial independence.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['competence', 'supervisory-authority', 'territory', 'jurisdiction'],
    posterAngles: [
      'Your national regulator is competent on home turf — know its reach.',
      'Courts acting as courts sit outside the regulator\'s supervision.'
    ]
  },
  {
    id: 'gdpr-art-56',
    framework: 'GDPR',
    citation: 'GDPR Art. 56',
    level: 0,
    region: 'EU',
    title: 'Competence of the lead supervisory authority',
    summary: 'For cross-border processing, the authority of the organisation\'s main establishment acts as the lead authority — the "one-stop-shop" mechanism.',
    text: 'For cross-border processing, the supervisory authority of the controller\'s or processor\'s main or single establishment acts as the lead authority under the one-stop-shop. It coordinates with other concerned authorities. Other authorities remain competent to handle complaints or infringements that substantially affect only individuals in their own state, in cooperation with the lead authority. This gives multinationals a single primary regulator.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['one-stop-shop', 'lead-authority', 'cross-border', 'main-establishment'],
    posterAngles: [
      'Operating across the EU? One lead regulator coordinates — the one-stop-shop.',
      'The one-stop-shop means one primary DPA, not 27 separate ones.'
    ]
  },
  {
    id: 'gdpr-art-57',
    framework: 'GDPR',
    citation: 'GDPR Art. 57',
    level: 0,
    region: 'EU',
    title: 'Tasks',
    summary: 'Supervisory authorities monitor and enforce GDPR, handle complaints, raise awareness, advise, and cooperate with other authorities.',
    text: 'Each authority must monitor and enforce GDPR; promote public and controller awareness; advise institutions and the public; handle complaints and investigate; cooperate with other authorities; conduct investigations; adopt SCCs and approve BCRs; maintain records of infringements; and contribute to the EDPB. Handling complaints and providing information to data subjects is generally free of charge.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['supervisory-authority', 'tasks', 'complaints', 'awareness', 'enforcement'],
    posterAngles: [
      'Regulators handle complaints for free — people always have somewhere to turn.',
      'Awareness-raising is a regulator\'s job — and yours too.'
    ]
  },
  {
    id: 'gdpr-art-58',
    framework: 'GDPR',
    citation: 'GDPR Art. 58',
    level: 0,
    region: 'EU',
    title: 'Powers',
    summary: 'Supervisory authorities have investigative, corrective, authorisation and advisory powers — including ordering compliance, banning processing, and imposing fines.',
    text: 'Authorities wield strong powers. Investigative: order information, conduct audits, obtain access to data and premises. Corrective: issue warnings and reprimands, order compliance with rights requests, order processing to be brought into compliance, impose temporary or permanent processing bans, order rectification/erasure, suspend data flows, and impose administrative fines. They also have authorisation and advisory powers, such as approving BCRs and issuing opinions. Their exercise is subject to appropriate safeguards and judicial remedy.',
    obligations: [
      'Comply with lawful orders and audits by the supervisory authority',
      'Provide access to data, premises and information on request'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['powers', 'enforcement', 'audits', 'processing-ban', 'fines', 'supervisory-authority'],
    posterAngles: [
      'Regulators can ban your processing outright — not just fine you.',
      'An audit order isn\'t a suggestion — authorities can demand access.'
    ]
  },
  {
    id: 'gdpr-art-59',
    framework: 'GDPR',
    citation: 'GDPR Art. 59',
    level: 0,
    region: 'EU',
    title: 'Activity reports',
    summary: 'Each supervisory authority must produce an annual public report on its activities, including types of infringements and measures taken.',
    text: 'Each supervisory authority must draw up an annual report on its activities, which may list types of infringements notified and measures taken. The report is transmitted to the national parliament, government and other designated bodies, and made available to the public, the Commission and the EDPB — supporting transparency and accountability of the regulators themselves.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['activity-report', 'transparency', 'supervisory-authority', 'accountability'],
    posterAngles: [
      'Regulators publish annual reports — enforcement trends are public knowledge.',
      'Want to know what gets fined? Read the DPA\'s activity report.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER VII — Cooperation and consistency (Art. 60–76)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-60',
    framework: 'GDPR',
    citation: 'GDPR Art. 60',
    level: 0,
    region: 'EU',
    title: 'Cooperation between the lead authority and the other concerned authorities',
    summary: 'The lead authority must cooperate with other concerned authorities to reach consensus on cross-border cases, exchanging information and draft decisions.',
    text: 'In cross-border cases the lead supervisory authority cooperates with the other concerned authorities, endeavouring to reach consensus. It exchanges relevant information, submits draft decisions for their opinion, and must take account of relevant and reasoned objections. If it cannot follow an objection, the consistency mechanism (Art. 63–65) is triggered. This machinery makes the one-stop-shop work in practice.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['cooperation', 'lead-authority', 'cross-border', 'consistency', 'consensus'],
    posterAngles: [
      'Cross-border cases are decided by regulators together, not in isolation.',
      'The one-stop-shop only works because authorities cooperate on every case.'
    ]
  },
  {
    id: 'gdpr-art-61',
    framework: 'GDPR',
    citation: 'GDPR Art. 61',
    level: 0,
    region: 'EU',
    title: 'Mutual assistance',
    summary: 'Supervisory authorities must provide each other relevant information and mutual assistance to apply GDPR consistently across the EU.',
    text: 'Supervisory authorities must supply each other with relevant information and provide mutual assistance — such as conducting investigations or consultations — to implement and apply GDPR consistently. Requests must be answered without undue delay and within one month. An authority may refuse only on narrow grounds and must justify it. This prevents gaps where processing spans several states.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['mutual-assistance', 'cooperation', 'supervisory-authority', 'consistency'],
    posterAngles: [
      'Regulators help each other investigate — borders don\'t stop enforcement.',
      'Mutual assistance closes the gaps multinationals used to slip through.'
    ]
  },
  {
    id: 'gdpr-art-62',
    framework: 'GDPR',
    citation: 'GDPR Art. 62',
    level: 0,
    region: 'EU',
    title: 'Joint operations of supervisory authorities',
    summary: 'Supervisory authorities may conduct joint investigations and enforcement operations, including seconding staff across borders.',
    text: 'Supervisory authorities may conduct joint operations, including joint investigations and enforcement measures, where a controller or processor has establishments in several states or many data subjects in more than one state are affected. Host authorities may confer powers on visiting staff, who act under the host\'s direction and law. This enables coordinated, cross-border enforcement actions.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['joint-operations', 'cross-border-enforcement', 'investigations', 'cooperation'],
    posterAngles: [
      'Regulators can run joint investigations across several countries at once.',
      'Multi-state operations attract multi-state scrutiny.'
    ]
  },
  {
    id: 'gdpr-art-63',
    framework: 'GDPR',
    citation: 'GDPR Art. 63',
    level: 0,
    region: 'EU',
    title: 'Consistency mechanism',
    summary: 'The consistency mechanism, run through the EDPB, ensures GDPR is applied uniformly across the EU.',
    text: 'To contribute to the consistent application of GDPR throughout the Union, supervisory authorities cooperate with each other and, where relevant, with the Commission through the consistency mechanism operated via the European Data Protection Board. It is the umbrella process (detailed in Art. 64–66) for opinions and binding decisions that keep national interpretations aligned.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['consistency-mechanism', 'EDPB', 'uniform-application', 'cooperation'],
    posterAngles: [
      'GDPR is meant to mean the same thing everywhere — the consistency mechanism enforces that.',
      'One law, one interpretation: consistency prevents 27 different GDPRs.'
    ]
  },
  {
    id: 'gdpr-art-64',
    framework: 'GDPR',
    citation: 'GDPR Art. 64',
    level: 0,
    region: 'EU',
    title: 'Opinion of the Board',
    summary: 'The EDPB issues opinions on draft measures with cross-border relevance, such as DPIA lists, codes of conduct, BCRs, and standard clauses.',
    text: 'The European Data Protection Board issues an opinion where a competent authority intends to adopt measures with EU-wide relevance — for example, lists of processing requiring a DPIA, draft codes of conduct, certification criteria, standard data-protection clauses, or approval of BCRs. Authorities must take utmost account of the Board\'s opinion and, if they intend not to follow it, the matter can proceed to a binding decision under Article 65.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['EDPB', 'opinion', 'consistency', 'BCRs', 'codes-of-conduct'],
    posterAngles: [
      'The EDPB\'s opinions shape how DPIA lists and BCRs are applied EU-wide.',
      'Board opinions carry weight — authorities must take utmost account of them.'
    ]
  },
  {
    id: 'gdpr-art-65',
    framework: 'GDPR',
    citation: 'GDPR Art. 65',
    level: 0,
    region: 'EU',
    title: 'Dispute resolution by the Board',
    summary: 'Where authorities disagree in a cross-border case, the EDPB adopts a binding decision to resolve the dispute.',
    text: 'The EDPB adopts binding decisions to resolve disputes: where a lead authority rejects a concerned authority\'s relevant and reasoned objection, where authorities disagree on which is competent, or where an authority fails to seek or follow the Board\'s opinion. The binding decision is adopted by a two-thirds majority and the authorities concerned must give effect to it through their final decisions. This is the backstop that keeps the one-stop-shop consistent.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['EDPB', 'dispute-resolution', 'binding-decision', 'consistency'],
    posterAngles: [
      'When regulators disagree, the EDPB\'s binding decision settles it.',
      'A cross-border dispute can escalate to an EU-wide binding ruling.'
    ]
  },
  {
    id: 'gdpr-art-66',
    framework: 'GDPR',
    citation: 'GDPR Art. 66',
    level: 0,
    region: 'EU',
    title: 'Urgency procedure',
    summary: 'In exceptional urgent cases, an authority may adopt provisional measures for up to three months without the usual consistency process.',
    text: 'In exceptional circumstances, where an authority considers there is an urgent need to protect individuals\' rights, it may immediately adopt provisional measures with legal effect on its own territory, lasting up to three months, derogating from the normal cooperation and consistency procedures. It may also request an urgent opinion or urgent binding decision from the EDPB. This handles situations too pressing to wait for the standard process.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['urgency-procedure', 'provisional-measures', 'EDPB', 'consistency'],
    posterAngles: [
      'Urgent privacy threats let a regulator act immediately — within its borders.',
      'The urgency procedure means serious risks don\'t wait for process.'
    ]
  },
  {
    id: 'gdpr-art-67',
    framework: 'GDPR',
    citation: 'GDPR Art. 67',
    level: 0,
    region: 'EU',
    title: 'Exchange of information',
    summary: 'The Commission may set out the arrangements for electronic exchange of information between supervisory authorities and with the EDPB.',
    text: 'The Commission may adopt implementing acts specifying the arrangements for the electronic exchange of information among supervisory authorities and between them and the EDPB — in particular standardised formats. This underpins the practical, secure information flow that cooperation and consistency depend on.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['information-exchange', 'supervisory-authority', 'EDPB', 'interoperability'],
    posterAngles: [
      'Standardised information exchange keeps EU regulators in sync.',
      'Behind the scenes, secure data-sharing makes cross-border enforcement work.'
    ]
  },
  {
    id: 'gdpr-art-68',
    framework: 'GDPR',
    citation: 'GDPR Art. 68',
    level: 0,
    region: 'EU',
    title: 'European Data Protection Board',
    summary: 'Establishes the European Data Protection Board (EDPB) as an EU body with legal personality, composed of the heads of national supervisory authorities and the EDPS.',
    text: 'The European Data Protection Board (EDPB) is established as a body of the Union with legal personality, represented by its Chair. It is composed of the head of one supervisory authority per Member State and the European Data Protection Supervisor. The Commission participates without voting rights. The EDPB is the central body ensuring consistent application of GDPR across the EU.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['EDPB', 'governance', 'consistency', 'institution'],
    posterAngles: [
      'The EDPB is the EU\'s central privacy body — its guidance shapes practice.',
      'One board, all national regulators: the EDPB keeps GDPR coherent.'
    ]
  },
  {
    id: 'gdpr-art-69',
    framework: 'GDPR',
    citation: 'GDPR Art. 69',
    level: 0,
    region: 'EU',
    title: 'Independence',
    summary: 'The EDPB must act independently when performing its tasks and exercising its powers.',
    text: 'The European Data Protection Board acts independently when performing its tasks or exercising its powers, neither seeking nor taking instructions from anybody — except where it must consider a Commission request. Its independence mirrors that of the national authorities it comprises.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['EDPB', 'independence', 'governance'],
    posterAngles: [
      'The EDPB answers to the law, not to lobbyists or governments.',
      'Independent guidance means EDPB opinions are credible.'
    ]
  },
  {
    id: 'gdpr-art-70',
    framework: 'GDPR',
    citation: 'GDPR Art. 70',
    level: 0,
    region: 'EU',
    title: 'Tasks of the Board',
    summary: 'The EDPB issues guidelines, recommendations and best practices, advises the Commission, and promotes consistent application of GDPR.',
    text: 'The EDPB\'s tasks include monitoring GDPR\'s application; advising the Commission; issuing guidelines, recommendations and best practices on numerous topics (erasure, breach notification, profiling, transfers, DPIAs, certification and more); issuing opinions and binding decisions under the consistency mechanism; encouraging codes of conduct and certification; and maintaining a public register of decisions. Its guidelines are the most influential interpretive source for GDPR compliance.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['EDPB', 'guidelines', 'best-practices', 'consistency', 'interpretation'],
    posterAngles: [
      'EDPB guidelines tell you how GDPR is actually applied — read them.',
      'When in doubt on GDPR, the EDPB\'s guidance is your first stop.'
    ]
  },
  {
    id: 'gdpr-art-71',
    framework: 'GDPR',
    citation: 'GDPR Art. 71',
    level: 0,
    region: 'EU',
    title: 'Reports',
    summary: 'The EDPB must publish an annual report on data protection and transmit it to the EU institutions and the public.',
    text: 'The EDPB draws up an annual report on the protection of individuals with regard to processing in the EU and, where relevant, in third countries and international organisations. The report is made public and transmitted to the European Parliament, Council and Commission, supporting transparency and informing policy.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['EDPB', 'annual-report', 'transparency'],
    posterAngles: [
      'The EDPB\'s annual report is a yearly snapshot of EU privacy enforcement.',
      'Public reporting keeps the EU\'s central privacy body accountable.'
    ]
  },
  {
    id: 'gdpr-art-72',
    framework: 'GDPR',
    citation: 'GDPR Art. 72',
    level: 0,
    region: 'EU',
    title: 'Procedure',
    summary: 'The EDPB takes decisions by simple majority unless GDPR provides otherwise, and adopts its own rules of procedure.',
    text: 'The European Data Protection Board takes decisions by a simple majority of its members, unless otherwise provided in GDPR (for example, the two-thirds majority for certain binding dispute decisions). The Board adopts its own rules of procedure and organises its operating arrangements. These are the internal governance mechanics of the Board.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['EDPB', 'procedure', 'voting', 'governance'],
    posterAngles: [
      'The EDPB decides by majority — collective judgement, not one voice.',
      'Clear procedures keep the Board\'s decisions legitimate.'
    ]
  },
  {
    id: 'gdpr-art-73',
    framework: 'GDPR',
    citation: 'GDPR Art. 73',
    level: 0,
    region: 'EU',
    title: 'Chair',
    summary: 'The EDPB elects a Chair and two deputy chairs from among its members for a five-year term.',
    text: 'The European Data Protection Board elects a Chair and two deputy chairs from among its members by simple majority, each for a five-year term, renewable once. The Chair represents the Board and leads its work, ensuring the timely performance of its tasks.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['EDPB', 'chair', 'governance'],
    posterAngles: [
      'The EDPB Chair is its public face and coordinator across all authorities.',
      'Elected leadership keeps the Board functioning smoothly.'
    ]
  },
  {
    id: 'gdpr-art-74',
    framework: 'GDPR',
    citation: 'GDPR Art. 74',
    level: 0,
    region: 'EU',
    title: 'Tasks of the Chair',
    summary: 'The Chair convenes meetings, prepares the Board\'s work, and ensures its tasks are performed in time.',
    text: 'The Chair of the EDPB convenes the Board\'s meetings and prepares their agenda; notifies decisions to the lead authority and concerned authorities; and ensures the timely performance of the Board\'s tasks, particularly in relation to the consistency mechanism. The Board\'s rules of procedure set out any further allocation of tasks between the Chair and deputies.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['EDPB', 'chair', 'tasks', 'governance'],
    posterAngles: [
      'The Chair keeps the EDPB moving — meetings, decisions, deadlines.',
      'Timely consistency decisions depend on the Chair\'s coordination.'
    ]
  },
  {
    id: 'gdpr-art-75',
    framework: 'GDPR',
    citation: 'GDPR Art. 75',
    level: 0,
    region: 'EU',
    title: 'Secretariat',
    summary: 'The European Data Protection Supervisor provides the EDPB with a secretariat that operates under the Chair\'s instructions.',
    text: 'The EDPB is supported by a secretariat provided by the European Data Protection Supervisor (EDPS). The secretariat performs its tasks exclusively under the instructions of the Board\'s Chair and provides analytical, administrative and logistical support, handling records, communication, and preparation of the Board\'s work under a memorandum of understanding.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['EDPB', 'secretariat', 'EDPS', 'governance'],
    posterAngles: [
      'The EDPB\'s work is backed by a dedicated secretariat under the EDPS.',
      'Behind the Board\'s guidance is a professional support team.'
    ]
  },
  {
    id: 'gdpr-art-76',
    framework: 'GDPR',
    citation: 'GDPR Art. 76',
    level: 0,
    region: 'EU',
    title: 'Confidentiality',
    summary: 'The EDPB\'s discussions are confidential where the Board deems it necessary, as set out in its rules of procedure.',
    text: 'The discussions of the European Data Protection Board are confidential where the Board considers it necessary, in accordance with its rules of procedure. Access to documents submitted to Board members, experts and third-party representatives is governed by EU transparency regulation (Regulation (EC) No 1049/2001), balancing confidentiality with public access.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['EDPB', 'confidentiality', 'transparency', 'governance'],
    posterAngles: [
      'Some Board deliberations stay confidential — but its decisions are public.',
      'Confidentiality and transparency are balanced in the Board\'s work.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER VIII — Remedies, liability and penalties (Art. 77–84)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-77',
    framework: 'GDPR',
    citation: 'GDPR Art. 77',
    level: 0,
    region: 'EU',
    title: 'Right to lodge a complaint with a supervisory authority',
    summary: 'Every data subject has the right to complain to a supervisory authority if they believe the processing of their data infringes GDPR.',
    text: 'Any individual has the right to lodge a complaint with a supervisory authority — particularly in the Member State of their residence, workplace, or the place of the alleged infringement — if they consider that processing of their personal data breaches GDPR. The authority must inform the complainant of progress and outcome, including their right to a judicial remedy. This is often the first, low-cost route to redress.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['complaint', 'redress', 'data-subject-rights', 'supervisory-authority'],
    posterAngles: [
      'Think your data was mishandled? You can complain to a regulator for free.',
      'A single complaint can trigger a full investigation — take them seriously.'
    ]
  },
  {
    id: 'gdpr-art-78',
    framework: 'GDPR',
    citation: 'GDPR Art. 78',
    level: 0,
    region: 'EU',
    title: 'Right to an effective judicial remedy against a supervisory authority',
    summary: 'Individuals and organisations can challenge a legally binding decision of a supervisory authority in court.',
    text: 'Each natural or legal person has the right to an effective judicial remedy against a legally binding decision of a supervisory authority concerning them. This also applies where an authority does not handle a complaint or fails to inform the complainant within three months. Proceedings are brought before the courts of the Member State where the authority is established, ensuring regulators are themselves accountable to the courts.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['judicial-remedy', 'appeal', 'supervisory-authority', 'accountability'],
    posterAngles: [
      'Even regulators can be taken to court — decisions are challengeable.',
      'If a DPA sits on your complaint, the courts are open to you.'
    ]
  },
  {
    id: 'gdpr-art-79',
    framework: 'GDPR',
    citation: 'GDPR Art. 79',
    level: 0,
    region: 'EU',
    title: 'Right to an effective judicial remedy against a controller or processor',
    summary: 'Individuals can bring court proceedings directly against a controller or processor they believe infringed their rights.',
    text: 'Without prejudice to any other remedy, every data subject has the right to an effective judicial remedy where they consider their GDPR rights have been infringed by non-compliant processing. Proceedings may be brought in the courts of the Member State where the controller or processor is established, or where the data subject resides. This gives individuals a direct court route against organisations, alongside complaining to a regulator.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['judicial-remedy', 'litigation', 'data-subject-rights'],
    posterAngles: [
      'People can sue a company directly for mishandling their data.',
      'A regulator complaint isn\'t the only route — courts are open to individuals.'
    ]
  },
  {
    id: 'gdpr-art-80',
    framework: 'GDPR',
    citation: 'GDPR Art. 80',
    level: 0,
    region: 'EU',
    title: 'Representation of data subjects',
    summary: 'Individuals may mandate a not-for-profit body to lodge complaints and exercise remedies on their behalf; Member States may allow such bodies to act independently.',
    text: 'A data subject may mandate a qualified not-for-profit body, organisation or association active in data protection to lodge complaints, pursue judicial remedies, and (where national law allows) seek compensation on their behalf. Member States may also permit such bodies to act independently of any mandate where they believe rights have been infringed. This enables collective and representative privacy actions.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['representation', 'collective-redress', 'not-for-profit', 'data-subject-rights'],
    posterAngles: [
      'Privacy groups can take up your case — you\'re not alone against big companies.',
      'Collective actions mean one breach can spark mass representation.'
    ]
  },
  {
    id: 'gdpr-art-81',
    framework: 'GDPR',
    citation: 'GDPR Art. 81',
    level: 0,
    region: 'EU',
    title: 'Suspension of proceedings',
    summary: 'Courts may suspend proceedings where the same matter is already before a court in another Member State, to avoid conflicting judgments.',
    text: 'Where a court becomes aware of proceedings concerning the same subject-matter as regards processing by the same controller or processor pending before a court in another Member State, it may contact that court to confirm. A court other than the one first seised may stay its proceedings, or (on request, where the first court has jurisdiction and consolidation is permissible) decline jurisdiction. This prevents parallel, conflicting rulings across the EU.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['proceedings', 'jurisdiction', 'litigation', 'consistency'],
    posterAngles: [
      'The same data case can\'t be fought twice in two EU courts at once.',
      'Coordination between courts avoids contradictory privacy rulings.'
    ]
  },
  {
    id: 'gdpr-art-82',
    framework: 'GDPR',
    citation: 'GDPR Art. 82',
    level: 0,
    region: 'EU',
    title: 'Right to compensation and liability',
    summary: 'Anyone who suffers material or non-material damage from a GDPR infringement has the right to compensation from the controller or processor responsible.',
    text: 'Any person who suffers material or non-material damage (including distress) as a result of a GDPR infringement has the right to compensation from the controller or processor. A controller is liable for damage caused by its processing; a processor is liable where it breached processor-specific obligations or acted outside/contrary to lawful instructions. A controller or processor is exempt only if it proves it was not in any way responsible. Where several are involved, each can be held liable for the whole damage to ensure the individual is effectively compensated.',
    obligations: [
      'Compensate individuals for material and non-material damage caused',
      'Bear joint and several liability where multiple actors are involved'
    ],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['compensation', 'liability', 'damages', 'non-material-damage'],
    posterAngles: [
      'Data harm has a price — even distress and anxiety can be compensated.',
      'Fines aren\'t the only cost: victims can claim damages directly.'
    ]
  },
  {
    id: 'gdpr-art-83',
    framework: 'GDPR',
    citation: 'GDPR Art. 83',
    level: 0,
    region: 'EU',
    title: 'General conditions for imposing administrative fines',
    summary: 'Sets two fine tiers — up to €10M/2% of turnover for many obligations, and up to €20M/4% for breaches of principles, rights, and transfer rules — and the factors used to set the amount.',
    text: 'Administrative fines must be effective, proportionate and dissuasive. The lower tier (up to €10M or 2% of total worldwide annual turnover, whichever is higher) covers breaches of controller/processor obligations such as Art. 8, 11, 25–39, 42 and 43. The higher tier (up to €20M or 4%) covers breaches of the basic principles (Art. 5, 6, 7, 9), data-subject rights (Art. 12–22), transfer rules (Art. 44–49), and non-compliance with an authority\'s order. Authorities weigh factors including the nature, gravity and duration, intent or negligence, mitigation, and cooperation.',
    obligations: [
      'Be aware that fines scale to global turnover, not just fixed sums',
      'Cooperate and mitigate — these reduce fine severity',
      'Recognise the two-tier structure when assessing compliance risk'
    ],
    penalties: HIGHER,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['fines', 'penalties', 'administrative-fines', 'enforcement', 'turnover'],
    posterAngles: [
      'GDPR fines reach €20M or 4% of global turnover — whichever hurts more.',
      'Cooperation and quick mitigation can shrink a fine — stonewalling grows it.',
      'Compliance is cheaper than the penalty — every time.'
    ]
  },
  {
    id: 'gdpr-art-84',
    framework: 'GDPR',
    citation: 'GDPR Art. 84',
    level: 0,
    region: 'EU',
    title: 'Penalties',
    summary: 'Member States must lay down other penalties for infringements not subject to administrative fines, and these must be effective, proportionate and dissuasive.',
    text: 'Beyond the administrative fines of Article 83, Member States must set additional national penalties for GDPR infringements — particularly those not already covered by administrative fines — and take all measures to ensure they are implemented. These penalties must be effective, proportionate and dissuasive, and may include criminal sanctions in some states. The rules must be notified to the Commission.',
    obligations: [],
    penalties: 'National penalties as laid down by Member State law (may include criminal sanctions), which must be effective, proportionate and dissuasive',
    appliesTo: ['data-controllers', 'processors'],
    topics: ['penalties', 'national-law', 'criminal-sanctions', 'enforcement'],
    posterAngles: [
      'Beyond EU fines, national laws can add their own penalties — even criminal ones.',
      'A GDPR breach can carry consequences your own country defines.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER IX — Specific processing situations (Art. 85–91)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-85',
    framework: 'GDPR',
    citation: 'GDPR Art. 85',
    level: 0,
    region: 'EU',
    title: 'Processing and freedom of expression and information',
    summary: 'Member States must reconcile data protection with freedom of expression and information, including processing for journalistic, academic, artistic or literary purposes.',
    text: 'Member States must reconcile the right to data protection with the right to freedom of expression and information by law, including processing carried out for journalistic purposes and for academic, artistic or literary expression. For these purposes, states provide exemptions or derogations from many GDPR provisions where necessary to reconcile the two rights. This is the "journalism/expression" balance built into GDPR.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['freedom-of-expression', 'journalism', 'exemptions', 'balancing'],
    posterAngles: [
      'Privacy and free speech both matter — GDPR carves out room for journalism.',
      'Reporting in the public interest gets special treatment under GDPR.'
    ]
  },
  {
    id: 'gdpr-art-86',
    framework: 'GDPR',
    citation: 'GDPR Art. 86',
    level: 0,
    region: 'EU',
    title: 'Processing and public access to official documents',
    summary: 'Personal data in official documents held by public bodies may be disclosed under access-to-documents laws, reconciling transparency with data protection.',
    text: 'Personal data in official documents held by a public authority or body (or a private body performing a public task) may be disclosed by that body in accordance with EU or Member State law on public access to official documents. This reconciles public access to documents (transparency of government) with the right to the protection of personal data.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['public-access', 'official-documents', 'transparency', 'freedom-of-information'],
    posterAngles: [
      'Freedom-of-information and privacy coexist — access laws can override secrecy.',
      'Public bodies balance transparency with protecting personal data.'
    ]
  },
  {
    id: 'gdpr-art-87',
    framework: 'GDPR',
    citation: 'GDPR Art. 87',
    level: 0,
    region: 'EU',
    title: 'Processing of the national identification number',
    summary: 'Member States may set specific conditions for processing national ID numbers, which must carry appropriate safeguards.',
    text: 'Member States may further determine the specific conditions for the processing of a national identification number or any other identifier of general application. Where they do, such an identifier must be used only under appropriate safeguards for the rights and freedoms of the data subject under GDPR. National ID numbers are recognised as especially risky identifiers warranting extra care.',
    obligations: [
      'Process national ID numbers only under applicable national conditions and safeguards'
    ],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['national-id', 'identifiers', 'safeguards', 'national-law'],
    posterAngles: [
      'National ID numbers are high-risk identifiers — handle them with extra safeguards.',
      'Don\'t use a national ID as a casual key — the law demands caution.'
    ]
  },
  {
    id: 'gdpr-art-88',
    framework: 'GDPR',
    citation: 'GDPR Art. 88',
    level: 0,
    region: 'EU',
    title: 'Processing in the context of employment',
    summary: 'Member States may set more specific rules to protect employees\' personal data in the employment context, with safeguards for dignity, interests and monitoring.',
    text: 'Member States may provide, by law or collective agreement, more specific rules to ensure the protection of rights and freedoms in the processing of employees\' personal data in the employment context — covering recruitment, contract performance, management, planning, equality, health and safety, and the exercise of employment rights. Such rules must include suitable measures to safeguard human dignity, legitimate interests, and fundamental rights, with particular regard to transparency and workplace monitoring systems.',
    obligations: [
      'Process employee data under applicable national employment-data rules',
      'Safeguard dignity and legitimate interests, especially with monitoring systems',
      'Be transparent about workplace monitoring'
    ],
    penalties: null,
    appliesTo: ['data-controllers', 'all-employees'],
    topics: ['employment', 'employee-data', 'workplace-monitoring', 'HR', 'transparency'],
    posterAngles: [
      'Your employer\'s monitoring isn\'t unlimited — GDPR protects staff too.',
      'Workplace surveillance must be transparent and proportionate.'
    ]
  },
  {
    id: 'gdpr-art-89',
    framework: 'GDPR',
    citation: 'GDPR Art. 89',
    level: 0,
    region: 'EU',
    title: 'Safeguards and derogations relating to archiving, research and statistics',
    summary: 'Processing for archiving in the public interest, scientific or historical research, or statistics must be subject to safeguards such as data minimisation and pseudonymisation.',
    text: 'Processing for archiving purposes in the public interest, scientific or historical research, or statistical purposes must be subject to appropriate safeguards for the rights of data subjects. These safeguards must ensure technical and organisational measures respecting data minimisation, in particular pseudonymisation where the purposes can be met that way. Member States may provide limited derogations from certain data-subject rights for these purposes, where those rights would seriously impair the objectives.',
    obligations: [
      'Apply appropriate safeguards (minimisation, pseudonymisation) for research/archiving',
      'Limit derogations to what is necessary to meet the research/archiving purpose'
    ],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['research', 'archiving', 'statistics', 'pseudonymisation', 'minimisation', 'safeguards'],
    posterAngles: [
      'Research on personal data still needs safeguards — pseudonymise by default.',
      'Public-interest archiving isn\'t a free pass — minimise and protect.'
    ]
  },
  {
    id: 'gdpr-art-90',
    framework: 'GDPR',
    citation: 'GDPR Art. 90',
    level: 0,
    region: 'EU',
    title: 'Obligations of secrecy',
    summary: 'Member States may set rules on supervisory authorities\' powers where controllers or processors are subject to professional secrecy obligations.',
    text: 'Member States may adopt specific rules governing the investigative powers of supervisory authorities in relation to controllers or processors who are subject, under EU or national law or professional rules, to an obligation of professional secrecy or an equivalent duty (for example lawyers, doctors, journalists). Such rules apply only to personal data received or obtained in the course of an activity covered by that secrecy obligation, balancing oversight with confidentiality.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['professional-secrecy', 'confidentiality', 'supervisory-authority', 'privilege'],
    posterAngles: [
      'Professional secrecy (doctor, lawyer) is respected even during investigations.',
      'Confidential-profession data gets special protection from regulator access.'
    ]
  },
  {
    id: 'gdpr-art-91',
    framework: 'GDPR',
    citation: 'GDPR Art. 91',
    level: 0,
    region: 'EU',
    title: 'Existing data protection rules of churches and religious associations',
    summary: 'Churches and religious associations already applying comprehensive data-protection rules may continue them, provided they are brought into line with GDPR.',
    text: 'Where a church or religious association or community already applied comprehensive rules relating to the protection of personal data at the time GDPR came into force, those rules may continue to apply provided they are brought into line with GDPR. Such bodies must be subject to the supervision of an independent supervisory authority, which may be specific to them, meeting the conditions of Chapter VI.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['religious-associations', 'churches', 'existing-rules', 'supervision'],
    posterAngles: [
      'Religious bodies can keep their own privacy rules — if aligned with GDPR.',
      'Even faith organisations answer to an independent privacy supervisor.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER X — Delegated and implementing acts (Art. 92–93)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-92',
    framework: 'GDPR',
    citation: 'GDPR Art. 92',
    level: 0,
    region: 'EU',
    title: 'Exercise of the delegation',
    summary: 'Sets out how the Commission may exercise its power to adopt delegated acts under GDPR, subject to conditions and possible revocation.',
    text: 'Article 92 governs the delegation of power to the European Commission to adopt delegated acts (for example on certification icons under Art. 12 and 43). The delegation is conferred for an indeterminate period, may be revoked by the European Parliament or the Council at any time, and any delegated act only enters into force if neither institution objects within the stated period. This is standard EU law-making machinery.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['delegated-acts', 'commission', 'law-making', 'procedure'],
    posterAngles: [
      'GDPR can be fleshed out by delegated acts — the rulebook can evolve.',
      'The Commission\'s power to add detail is checked by Parliament and Council.'
    ]
  },
  {
    id: 'gdpr-art-93',
    framework: 'GDPR',
    citation: 'GDPR Art. 93',
    level: 0,
    region: 'EU',
    title: 'Committee procedure',
    summary: 'Establishes the committee that assists the Commission in adopting implementing acts under GDPR.',
    text: 'Article 93 provides that the Commission is assisted by a committee within the meaning of the EU\'s comitology Regulation (No 182/2011) when adopting implementing acts under GDPR — such as standard contractual clauses or adequacy decisions. It specifies which examination procedures apply, including for reasons of urgency. This is the procedural plumbing for the Commission\'s implementing powers.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['implementing-acts', 'committee-procedure', 'comitology', 'commission'],
    posterAngles: [
      'Tools like Standard Contractual Clauses are adopted through a formal committee process.',
      'Implementing acts give GDPR its practical, updatable detail.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // CHAPTER XI — Final provisions (Art. 94–99)
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-art-94',
    framework: 'GDPR',
    citation: 'GDPR Art. 94',
    level: 0,
    region: 'EU',
    title: 'Repeal of Directive 95/46/EC',
    summary: 'GDPR repeals the earlier Data Protection Directive 95/46/EC, with references to it read as references to GDPR.',
    text: 'Directive 95/46/EC, the EU\'s original 1995 Data Protection Directive, is repealed with effect from 25 May 2018. References to the repealed Directive are construed as references to GDPR, and references to the old Article 29 Working Party are construed as references to the European Data Protection Board. GDPR thus replaced a patchwork directive with a directly applicable regulation.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['repeal', 'directive-95-46', 'transition', 'history'],
    posterAngles: [
      'GDPR replaced the 1995 Directive — one directly applicable law for all the EU.',
      'Old Directive references now mean GDPR — the rulebook changed in 2018.'
    ]
  },
  {
    id: 'gdpr-art-95',
    framework: 'GDPR',
    citation: 'GDPR Art. 95',
    level: 0,
    region: 'EU',
    title: 'Relationship with Directive 2002/58/EC',
    summary: 'GDPR does not impose additional obligations where the ePrivacy Directive already lays down specific rules with the same objective.',
    text: 'GDPR does not impose additional obligations on natural or legal persons in relation to processing in connection with the provision of publicly available electronic communications services in public networks, insofar as they are already subject to the specific obligations of the ePrivacy Directive (2002/58/EC) with the same objective. This avoids double regulation where ePrivacy already applies (e.g. cookies, communications confidentiality).',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['eprivacy', 'directive-2002-58', 'electronic-communications', 'cookies'],
    posterAngles: [
      'Cookies and comms are governed by ePrivacy alongside GDPR — know both.',
      'GDPR and ePrivacy work together, not on top of each other.'
    ]
  },
  {
    id: 'gdpr-art-96',
    framework: 'GDPR',
    citation: 'GDPR Art. 96',
    level: 0,
    region: 'EU',
    title: 'Relationship with previously concluded Agreements',
    summary: 'International agreements involving data transfers concluded before 24 May 2016 remain in force until amended, replaced or revoked.',
    text: 'International agreements involving the transfer of personal data to third countries or international organisations that were concluded by Member States before 24 May 2016, and that comply with the law applicable before that date, remain in force until amended, replaced or revoked. This provides continuity for pre-existing treaty-based data flows.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['international-agreements', 'transition', 'transfers', 'continuity'],
    posterAngles: [
      'Older transfer treaties still hold until they\'re formally replaced.',
      'Legacy data-transfer agreements didn\'t vanish with GDPR.'
    ]
  },
  {
    id: 'gdpr-art-97',
    framework: 'GDPR',
    citation: 'GDPR Art. 97',
    level: 0,
    region: 'EU',
    title: 'Commission reports',
    summary: 'The Commission must periodically evaluate and report on GDPR, starting in 2020 and every four years thereafter.',
    text: 'The Commission must submit a report on the evaluation and review of GDPR to the European Parliament and the Council by 25 May 2020 and every four years afterwards. The reviews examine, in particular, international transfers and the cooperation and consistency mechanisms, and may be accompanied by proposals to amend GDPR in light of developments in information technology and society.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['evaluation', 'review', 'commission-report', 'reform'],
    posterAngles: [
      'GDPR is reviewed every four years — the law keeps pace with technology.',
      'Regular evaluation means GDPR can evolve, not ossify.'
    ]
  },
  {
    id: 'gdpr-art-98',
    framework: 'GDPR',
    citation: 'GDPR Art. 98',
    level: 0,
    region: 'EU',
    title: 'Review of other Union legal acts on data protection',
    summary: 'The Commission may propose amendments to other EU legal acts on data protection to ensure consistent protection across the Union.',
    text: 'The Commission must, where appropriate, submit legislative proposals to amend other EU legal acts on the protection of personal data — for example those governing the EU institutions themselves — in order to ensure uniform and consistent protection of individuals with regard to processing. This aligns the wider EU data-protection landscape with GDPR.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['review', 'consistency', 'eu-legal-acts', 'reform'],
    posterAngles: [
      'GDPR set the benchmark — other EU privacy laws get aligned to it.',
      'Consistency across all EU data laws is an ongoing project.'
    ]
  },
  {
    id: 'gdpr-art-99',
    framework: 'GDPR',
    citation: 'GDPR Art. 99',
    level: 0,
    region: 'EU',
    title: 'Entry into force and application',
    summary: 'GDPR entered into force on 24 May 2016 and became applicable across the EU from 25 May 2018.',
    text: 'GDPR entered into force on the twentieth day after its publication in the Official Journal — 24 May 2016 — and applied from 25 May 2018. It is binding in its entirety and directly applicable in all Member States, meaning it took effect as law without needing national transposition, giving organisations a two-year window to prepare.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['entry-into-force', 'application-date', '2018', 'directly-applicable'],
    posterAngles: [
      'GDPR has applied since 25 May 2018 — the grace period is long over.',
      'Directly applicable law: GDPR binds every Member State without local re-enactment.'
    ]
  },

  // ─────────────────────────────────────────────────────────────────────────
  // RECITALS — awareness-relevant (level 0, citation "GDPR Recital N")
  // ─────────────────────────────────────────────────────────────────────────
  {
    id: 'gdpr-rec-26',
    framework: 'GDPR',
    citation: 'GDPR Recital 26',
    level: 0,
    region: 'EU',
    title: 'Anonymous information and anonymisation',
    summary: 'GDPR does not apply to truly anonymous data — data that cannot identify a person by any means reasonably likely to be used; pseudonymised data is still personal data.',
    text: 'Recital 26 draws the line between anonymisation and pseudonymisation. Data protection principles do not apply to anonymous information — data that does not relate to an identifiable person, or is rendered anonymous so the person is no longer identifiable by any means reasonably likely to be used. Pseudonymised data, by contrast, can still be attributed to a person using additional information and therefore remains personal data subject to GDPR. Assessing identifiability considers cost, time, and available technology.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['anonymisation', 'pseudonymisation', 'identifiability', 'personal-data', 'de-identification'],
    posterAngles: [
      'Pseudonymised is NOT anonymous — it\'s still personal data under GDPR.',
      'Truly anonymous data escapes GDPR; masked data does not.'
    ]
  },
  {
    id: 'gdpr-rec-32',
    framework: 'GDPR',
    citation: 'GDPR Recital 32',
    level: 0,
    region: 'EU',
    title: 'Conditions for consent',
    summary: 'Consent must be a clear affirmative act — freely given, specific, informed and unambiguous; silence, pre-ticked boxes or inactivity do not constitute consent.',
    text: 'Recital 32 explains what real consent looks like. It must be given by a clear affirmative act establishing a freely given, specific, informed and unambiguous indication of agreement — for example ticking a box, choosing settings, or another statement or conduct that clearly signifies acceptance. Silence, pre-ticked boxes, or inactivity do not amount to consent. Consent should cover all processing activities for the same purpose(s); where there are multiple purposes, consent should be given for each.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['consent', 'affirmative-act', 'pre-ticked-boxes', 'unambiguous', 'opt-in'],
    posterAngles: [
      'Silence is not consent — people must actively opt in.',
      'Pre-ticked boxes never count — consent needs a clear, deliberate action.'
    ]
  },
  {
    id: 'gdpr-rec-39',
    framework: 'GDPR',
    citation: 'GDPR Recital 39',
    level: 0,
    region: 'EU',
    title: 'Principles of transparency and data minimisation',
    summary: 'Processing must be transparent to individuals, with clear information; data should be adequate, relevant and limited to what is necessary, kept only as long as needed.',
    text: 'Recital 39 elaborates the transparency and minimisation principles. Individuals should be made aware of risks, rules, safeguards and rights, and how to exercise them. Any information about processing must be easily accessible, easy to understand, and in clear plain language. Personal data should be adequate, relevant and limited to what is necessary; retained only as long as strictly needed, with time limits set for erasure or review; and processed only where the purpose cannot reasonably be achieved by other means.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['transparency', 'data-minimisation', 'plain-language', 'retention', 'necessity'],
    posterAngles: [
      'Keep data only as long as you truly need it — set an erasure date.',
      'Clear, plain-language notices aren\'t a courtesy — they\'re expected by law.'
    ]
  },
  {
    id: 'gdpr-rec-49',
    framework: 'GDPR',
    citation: 'GDPR Recital 49',
    level: 0,
    region: 'EU',
    title: 'Network and information security as a legitimate interest',
    summary: 'Processing personal data to the extent strictly necessary and proportionate for network and information security constitutes a legitimate interest of the controller.',
    text: 'Recital 49 recognises cybersecurity as a legitimate interest. Processing personal data to the extent strictly necessary and proportionate to ensure network and information security — the resilience of systems against accidental events or unlawful acts such as unauthorised access, malware, denial-of-service attacks, and damage to systems — constitutes a legitimate interest of the controller. This underpins the lawful use of data by, for example, CERTs, CSIRTs and security teams.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors', 'all-employees'],
    topics: ['network-security', 'legitimate-interests', 'cybersecurity', 'malware', 'ddos', 'incident-response'],
    posterAngles: [
      'Security monitoring is a legitimate interest — protecting systems protects data.',
      'Stopping malware and intrusions is lawful — but only what\'s strictly necessary.'
    ]
  },
  {
    id: 'gdpr-rec-51',
    framework: 'GDPR',
    citation: 'GDPR Recital 51',
    level: 0,
    region: 'EU',
    title: 'Protecting special categories of personal data',
    summary: 'Sensitive data deserves specific protection because processing it could create significant risks to fundamental rights and freedoms.',
    text: 'Recital 51 explains why special-category data gets heightened protection: such data merits specific protection as the context of its processing could create significant risks to fundamental rights and freedoms. It clarifies, for example, that photographs are not automatically special-category biometric data unless processed through specific technical means allowing unique identification. The default prohibition in Article 9 flows from this heightened-risk rationale.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['special-categories', 'sensitive-data', 'biometrics', 'photographs', 'risk'],
    posterAngles: [
      'Sensitive data can cause serious harm if misused — treat it accordingly.',
      'A face photo becomes biometric data only when used to uniquely identify someone.'
    ]
  },
  {
    id: 'gdpr-rec-71',
    framework: 'GDPR',
    citation: 'GDPR Recital 71',
    level: 0,
    region: 'EU',
    title: 'Profiling and automated decision-making safeguards',
    summary: 'Individuals subject to automated decisions and profiling should have safeguards, including human intervention, the right to an explanation, and to contest the decision.',
    text: 'Recital 71 fleshes out Article 22. Where a decision is based solely on automated processing (including profiling) and produces legal or similarly significant effects, the individual should be entitled to safeguards: to be informed, to obtain human intervention, to express their point of view, to receive an explanation of the decision reached, and to challenge it. Controllers should use appropriate mathematical or statistical procedures, prevent discriminatory effects, and secure the data. Automated decisions should generally not concern children.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['profiling', 'automated-decisions', 'explanation', 'human-intervention', 'discrimination', 'ai'],
    posterAngles: [
      'People have a right to an explanation when an algorithm decides about them.',
      'Automated profiling must not become automated discrimination.'
    ]
  },
  {
    id: 'gdpr-rec-75',
    framework: 'GDPR',
    citation: 'GDPR Recital 75',
    level: 0,
    region: 'EU',
    title: 'Risks to the rights and freedoms of natural persons',
    summary: 'Describes the range of risks from processing — physical, material or non-material damage such as discrimination, identity theft, fraud, reputational harm, or loss of confidentiality.',
    text: 'Recital 75 catalogues the harms GDPR guards against. Risks to rights and freedoms may result in physical, material or non-material damage — including discrimination, identity theft or fraud, financial loss, reputational damage, loss of confidentiality of data protected by professional secrecy, unauthorised reversal of pseudonymisation, or any other significant economic or social disadvantage. Higher risk arises with sensitive data, vulnerable people (including children), or large-scale processing. This risk lens drives obligations like DPIAs and breach notification.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['risk', 'identity-theft', 'fraud', 'discrimination', 'reputational-harm', 'harm'],
    posterAngles: [
      'A data breach can mean identity theft, fraud, or discrimination for real people.',
      'Think about the human harm behind the data — that\'s what the rules protect.'
    ]
  },
  {
    id: 'gdpr-rec-76',
    framework: 'GDPR',
    citation: 'GDPR Recital 76',
    level: 0,
    region: 'EU',
    title: 'Assessing risk by likelihood and severity',
    summary: 'The likelihood and severity of risk to individuals should be assessed objectively by reference to the nature, scope, context and purposes of processing.',
    text: 'Recital 76 sets the method for gauging risk. The likelihood and severity of the risk to the rights and freedoms of the data subject should be determined by reference to the nature, scope, context and purposes of the processing. Risk should be evaluated on an objective assessment, establishing whether processing operations involve a risk or a high risk. This objective, risk-based approach shapes the whole accountability framework, including when a DPIA is required.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['risk-assessment', 'likelihood', 'severity', 'objective-assessment', 'DPIA'],
    posterAngles: [
      'Judge privacy risk by how likely and how severe the harm could be.',
      'Objective risk assessment — not guesswork — drives your privacy decisions.'
    ]
  },
  {
    id: 'gdpr-rec-78',
    framework: 'GDPR',
    citation: 'GDPR Recital 78',
    level: 0,
    region: 'EU',
    title: 'Data protection by design and by default measures',
    summary: 'Controllers should adopt internal policies and measures — like minimising data, pseudonymising early, and transparency — that meet data protection by design and by default.',
    text: 'Recital 78 gives practical shape to Article 25. To demonstrate compliance, controllers should adopt internal policies and implement measures that meet the principles of data protection by design and by default: minimising the processing of personal data, pseudonymising as soon as possible, giving transparency about functions and processing, enabling monitoring, and letting the controller create and improve security features. Producers of products, services and applications are encouraged to build in data protection when developing them.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors'],
    topics: ['privacy-by-design', 'privacy-by-default', 'pseudonymisation', 'minimisation', 'secure-development'],
    posterAngles: [
      'Build privacy into products from the start — designers and developers included.',
      'Pseudonymise as early as you can — it shrinks the risk everywhere downstream.'
    ]
  },
  {
    id: 'gdpr-rec-83',
    framework: 'GDPR',
    citation: 'GDPR Recital 83',
    level: 0,
    region: 'EU',
    title: 'Security measures and risk-appropriate protection',
    summary: 'To maintain security, controllers and processors should assess risks and implement measures such as encryption to mitigate them.',
    text: 'Recital 83 reinforces Article 32. To maintain security and prevent unlawful processing, the controller or processor should evaluate the risks inherent in the processing and implement measures to mitigate them — such as encryption. These measures should ensure an appropriate level of security, including confidentiality, taking account of the state of the art and costs against the risks and the nature of the data. In assessing risk, consideration should be given to the risks presented by a personal data breach.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors', 'all-employees'],
    topics: ['security', 'encryption', 'risk-mitigation', 'confidentiality', 'state-of-the-art'],
    posterAngles: [
      'Encryption is the recital\'s headline example — use it to cut breach risk.',
      'Match your security to the risk — assess first, then protect.'
    ]
  },
  {
    id: 'gdpr-rec-85',
    framework: 'GDPR',
    citation: 'GDPR Recital 85',
    level: 0,
    region: 'EU',
    title: 'Consequences of a personal data breach and the need for prompt notification',
    summary: 'A breach can cause serious harm, so controllers should notify the authority without undue delay and within 72 hours where feasible.',
    text: 'Recital 85 explains the urgency behind Article 33. A personal data breach may, if not addressed appropriately and in time, result in physical, material or non-material damage — loss of control over one\'s data, discrimination, identity theft or fraud, financial loss, reputational damage, or loss of confidentiality. Therefore, as soon as a controller becomes aware of a breach, it should notify the supervisory authority without undue delay and, where feasible, within 72 hours, unless the breach is unlikely to result in a risk to individuals.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors', 'all-employees'],
    topics: ['breach-notification', '72-hours', 'harm', 'identity-theft', 'incident-response'],
    posterAngles: [
      'The 72-hour breach clock exists because delay multiplies the harm.',
      'A breach left unreported can snowball into fraud and identity theft.'
    ]
  },
  {
    id: 'gdpr-rec-86',
    framework: 'GDPR',
    citation: 'GDPR Recital 86',
    level: 0,
    region: 'EU',
    title: 'Communication of a breach to affected individuals',
    summary: 'Controllers should tell affected individuals about high-risk breaches as soon as reasonably feasible, in close cooperation with the supervisory authority.',
    text: 'Recital 86 addresses Article 34. The controller should communicate a personal data breach to the affected individuals as soon as reasonably feasible and in close cooperation with the supervisory authority, respecting guidance from it or other relevant authorities such as law-enforcement. For example, prompt communication helps individuals take protective measures, while the need to mitigate an immediate risk may justify earlier notice than the measured effort to secure systems and prevent recurrence.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers'],
    topics: ['breach-communication', 'high-risk', 'data-subjects', 'cooperation', 'incident-response'],
    posterAngles: [
      'Telling victims fast lets them protect themselves — change passwords, watch accounts.',
      'High-risk breaches mean prompt, honest communication with those affected.'
    ]
  },
  {
    id: 'gdpr-rec-87',
    framework: 'GDPR',
    citation: 'GDPR Recital 87',
    level: 0,
    region: 'EU',
    title: 'Ability to detect breaches and assess the need to notify',
    summary: 'Controllers should have measures in place to promptly detect a breach and determine whether notification obligations are triggered.',
    text: 'Recital 87 stresses detection and readiness. It should be ascertained whether all appropriate technological protection and organisational measures were implemented to establish immediately whether a personal data breach has taken place and to inform the supervisory authority and the individuals promptly. The fact that notification was made without undue delay should be established taking into account the nature and gravity of the breach and its consequences for individuals. Preparedness — detection, assessment, escalation — is expected, not optional.',
    obligations: [],
    penalties: null,
    appliesTo: ['data-controllers', 'processors', 'all-employees'],
    topics: ['breach-detection', 'monitoring', 'incident-response', 'readiness', 'escalation'],
    posterAngles: [
      'You can\'t report a breach you never detected — invest in monitoring.',
      'Know your escalation path before an incident, not during one.'
    ]
  }
];
