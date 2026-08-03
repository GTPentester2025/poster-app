// DPDP Act 2023 knowledge base — curated seed articles covering India's
// Digital Personal Data Protection Act, shaped for the security-awareness
// poster RAG system. Each article follows the upsertArticles contract.
//
// DPDP_KEYWORDS: supplemental scoring keywords that boost regulatory content.
// DPDP_PROMPT: system-prompt addition injected into synthesis when the topic
//   concerns Indian data privacy regulation.

export const DPDP_ACT_SEED = [
  // ── Overview & core actors ──
  {
    title: 'DPDP Act 2023 — India\'s First Comprehensive Data Protection Law',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'The Digital Personal Data Protection Act 2023 governs how Indian organisations collect, process, and store digital personal data, granting rights to individuals and duties to businesses.',
    summary: 'Passed in August 2023, the DPDP Act is India\'s foundational data protection law. It applies to digital personal data processed in India and to overseas processing tied to offering goods or services to Indians.',
    watchouts: ['Learn what counts as "personal data" in your daily work', 'Know whether your role involves processing personal data', 'Ask your privacy team how the Act applies to your team\'s workflows'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 10, tier: 1
  },
  {
    title: 'DPDP Act — Data Fiduciary: Who Carries the Responsibility',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'A Data Fiduciary is any entity that decides the purpose and means of processing personal data. It bears primary legal responsibility for compliance, security, and breach notification.',
    summary: 'Your organisation is a Data Fiduciary and is legally accountable for every bit of personal data it handles — including the data you touch in your daily tasks. Each employee action reflects on that duty.',
    watchouts: ['Treat all personal data you handle at work as legally protected', 'Follow your organisation\'s data-handling policy exactly', 'Never share customer or colleague data without a lawful reason'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 10, tier: 1
  },
  {
    title: 'DPDP Act — Data Processor: Handling Data on Someone Else\'s Behalf',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'A Data Processor handles personal data only under a Data Fiduciary\'s instructions and a binding contract. Processing beyond those instructions breaks the Act.',
    summary: 'If your team processes another company\'s customer data under contract, you are a Data Processor. Stick strictly to the agreed instructions — going beyond them without authorisation is a violation.',
    watchouts: ['Process client data strictly within the agreed contract scope', 'Never reuse a client\'s data for your own purposes', 'Escalate any request that falls outside the processing contract'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },

  // ── Data Fiduciary obligations ──
  {
    title: 'DPDP Act — Purpose Limitation: Use Data Only for What You Said',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Personal data may be used only for the specific purpose for which it was collected. Repurposing it — like using order details for marketing — needs fresh consent.',
    summary: 'Purpose limitation means data collected for one reason can\'t be reused for another without new consent. Using customer contact details gathered for delivery to send promotions is a DPDP Act breach.',
    watchouts: ['Check the original consent purpose before reusing any dataset', 'Flag any request to use data outside its stated purpose', 'Never quietly repurpose customer data for a new campaign'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Data Minimisation: Collect Only What You Need',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Data Fiduciaries must collect only the personal data necessary for the stated purpose. Gathering extra fields "just in case" is a violation even if never misused.',
    summary: 'Data minimisation limits collection to what is genuinely needed. When you design a form, capture a lead, or onboard a vendor, ask what data is truly required and drop everything beyond that.',
    watchouts: ['Before collecting any field, ask: is this truly necessary?', 'Remove optional form fields that lack a clear purpose', 'Challenge requests to gather data that seems excessive'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Security Safeguards: A Legal Duty, Not a Nicety',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Every Data Fiduciary must apply reasonable technical, organisational, and physical safeguards. Failing to do so is a violation — even when no breach has occurred.',
    summary: 'The Act mandates encryption, access controls, and secure processes to protect personal data. Weak safeguards are punishable on their own, so shortcuts that bypass controls create direct legal exposure.',
    watchouts: ['Use only approved systems to store and share personal data', 'Never bypass a security control to work faster', 'Report gaps in data-handling processes as soon as you spot them'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 10, tier: 1
  },
  {
    title: 'DPDP Act — Data Accuracy: Keep Personal Data Correct',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Fiduciaries must ensure personal data used for decisions is accurate, complete, and up to date. Acting on stale or wrong data can harm individuals and breach the Act.',
    summary: 'Inaccurate personal data — a wrong address, an outdated record — can lead to real harm and DPDP liability. When you notice incorrect data, correct it through proper channels rather than acting on it.',
    watchouts: ['Correct data errors through the official process, not ad hoc', 'Verify a record is current before making decisions on it', 'Report datasets that are clearly outdated or inconsistent'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 8, tier: 1
  },

  // ── Consent ──
  {
    title: 'DPDP Act — Consent: The Legal Foundation of Processing',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Consent under the Act must be free, specific, informed, unconditional, and unambiguous, given through a clear affirmative action by the Data Principal.',
    summary: 'Valid consent is the backbone of lawful processing. It must be an active, informed choice — pre-ticked boxes, silence, or buried terms do not qualify as consent under the DPDP Act.',
    watchouts: ['Never collect personal data without clear, documented consent', 'Avoid pre-ticked boxes — consent needs an active choice', 'Make sure consent requests state exactly what and why'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 10, tier: 1
  },
  {
    title: 'DPDP Act — No Bundled Consent: Don\'t Force Extra Data',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Consent must be unconditional. Tying access to a service to consent for unnecessary data collection is prohibited under the DPDP Act.',
    summary: 'You cannot make a service conditional on handing over data the service doesn\'t need. Forcing a customer to accept marketing tracking just to complete a purchase is unlawful bundled consent.',
    watchouts: ['Never make a service conditional on unnecessary data consent', 'Separate optional consents from what the service truly requires', 'Question designs that block users unless they overshare'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Consent Notice: Tell People Before You Collect',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'A notice must accompany consent, describing the data collected, the purpose, how to exercise rights, and how to complain to the Data Protection Board.',
    summary: 'Every consent request needs a plain-language notice covering what data is taken, why, how individuals exercise their rights, and how they can complain. Missing notices make the consent invalid.',
    watchouts: ['Ensure a clear notice accompanies every consent request', 'Confirm the notice names the purpose and rights available', 'Offer the notice in plain language, not dense legalese'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Consent Withdrawal: Stop When They Say Stop',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'A Data Principal can withdraw consent as easily as it was given. Processing must then stop unless another lawful basis applies.',
    summary: 'Withdrawing consent must be as easy as giving it. Once someone opts out, processing for that purpose must stop promptly — continuing to email a customer who unsubscribed is a violation.',
    watchouts: ['Honour consent withdrawal promptly across all systems', 'Make opting out as easy as opting in', 'Never keep processing data after consent is revoked'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },

  // ── Data Principal rights ──
  {
    title: 'DPDP Act — Right to Access: Individuals Can See Their Data',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Data Principals can request a summary of their personal data being processed and the identities of parties it has been shared with.',
    summary: 'Individuals have the right to know what data you hold about them and who it was shared with. When a customer or colleague asks, log the request and route it to the privacy team without delay.',
    watchouts: ['Recognise a data-access request and escalate it at once', 'Never brush off or delay a request to see personal data', 'Route access requests to the privacy team, don\'t self-answer'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Right to Correction and Erasure',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Data Principals may have inaccurate data corrected and data no longer needed erased, unless retention is legally required.',
    summary: 'People can ask you to fix wrong data or delete data you no longer need. Ignoring an erasure request, or "losing" it, is a compliance failure — pass it to the right team and confirm action is taken.',
    watchouts: ['Forward correction and erasure requests to the right owner', 'Never ignore or quietly drop an erasure request', 'Confirm the data is actually corrected or deleted, not just promised'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Right to Grievance Redressal',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Every Data Principal can raise a grievance with the Data Fiduciary about how their data is handled and must receive a timely response.',
    summary: 'Individuals have a right to complain about data handling and get a real response. Employees who receive such complaints must log and escalate them — an unanswered grievance can reach the Board.',
    watchouts: ['Log every data complaint in the official tracking system', 'Escalate grievances to the privacy team the same day', 'Never dismiss a customer\'s data-handling complaint'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Right to Nominate: Planning for Incapacity',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Data Principals can nominate another person to exercise their rights in case of death or incapacity, and such nominations must be honoured.',
    summary: 'The Act lets individuals name someone to act on their data rights if they die or become incapacitated. If your systems capture nominations, treat those instructions as legally binding directions.',
    watchouts: ['Treat a valid nomination as a binding instruction', 'Verify a nominee\'s authority before releasing any data', 'Route nomination-related requests to the privacy team'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 8, tier: 1
  },

  // ── Children's data ──
  {
    title: 'DPDP Act — Children\'s Data: Verifiable Parental Consent',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Processing personal data of anyone under 18 requires verifiable consent from a parent or lawful guardian before any collection begins.',
    summary: 'Children\'s data gets elevated protection: you must obtain verifiable parental consent before processing. A self-declared "I am a parent" checkbox is not enough — real verification is required.',
    watchouts: ['Assume under-18 users need verified parental consent', 'Reject self-declaration as proof of being a parent', 'Hold processing of a child\'s data until consent is confirmed'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 10, tier: 1
  },
  {
    title: 'DPDP Act — No Tracking or Behavioural Ads for Children',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'The Act bans tracking, behavioural monitoring, and targeted advertising directed at children, regardless of parental consent.',
    summary: 'You may not track children, monitor their behaviour, or target ads at them even with parental consent. Any processing likely to harm a child\'s well-being is prohibited outright under the Act.',
    watchouts: ['Never enable behavioural tracking for under-18 users', 'Exclude children from targeted advertising campaigns', 'Flag any feature that monitors a child\'s activity for review'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },

  // ── Significant Data Fiduciaries ──
  {
    title: 'DPDP Act — Significant Data Fiduciaries: Extra Duties',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Entities notified as Significant Data Fiduciaries — based on data volume, sensitivity, and risk — carry heightened obligations under the Act.',
    summary: 'High-risk, high-volume organisations may be designated Significant Data Fiduciaries. They face extra duties: an India-based DPO, periodic audits, and impact assessments. Know if your employer is one.',
    watchouts: ['Find out whether your organisation is a Significant Data Fiduciary', 'Cooperate fully with the extra audits and assessments', 'Meet the tighter compliance bar these organisations carry'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Data Protection Officer: Your Escalation Point',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Significant Data Fiduciaries must appoint an India-based Data Protection Officer who is the contact for grievances and represents the entity before the Board.',
    summary: 'The DPO is your organisation\'s independent point of contact for data-protection issues and grievances. Know who yours is and raise concerns to them without fear of retaliation.',
    watchouts: ['Know the name and contact of your DPO', 'Escalate data-protection concerns straight to the DPO', 'Never pressure or retaliate against the DPO over findings'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Data Protection Impact Assessment (DPIA)',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Significant Data Fiduciaries must run a DPIA before high-risk processing, assessing necessity, proportionality, and risks to Data Principal rights.',
    summary: 'A DPIA weighs the risks of a new processing activity before it starts. If you help plan a new system or process touching personal data, flag the DPIA need early — a retroactive one defeats the point.',
    watchouts: ['Flag DPIA needs when planning new data projects', 'Insist a DPIA happens before processing starts, not after', 'Give accurate details of data flows to DPIA assessors'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Independent Data Auditor: External Scrutiny',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Significant Data Fiduciaries must appoint an independent data auditor to evaluate their compliance with the Act on a periodic basis.',
    summary: 'An independent auditor periodically checks whether a Significant Data Fiduciary is meeting its obligations. When an audit touches your work, provide honest, complete records — hiding gaps makes things worse.',
    watchouts: ['Give auditors complete and honest records', 'Never conceal a compliance gap during an audit', 'Fix issues auditors identify rather than papering over them'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 8, tier: 1
  },

  // ── Breach notification ──
  {
    title: 'DPDP Act — Breach Notification to the Data Protection Board',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'On a personal data breach, the Data Fiduciary must notify the Data Protection Board of India, describing the breach and the response measures.',
    summary: 'Every personal data breach must be reported to the Board. Delay or concealment compounds the violation, so employees must report suspected breaches immediately rather than trying to quietly fix them.',
    watchouts: ['Report any suspected data breach within minutes', 'Never try to hide or silently fix a breach yourself', 'Note what data was exposed and when you noticed it'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 10, tier: 1
  },
  {
    title: 'DPDP Act — Notifying Affected Individuals of a Breach',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'The Data Fiduciary must also inform each affected Data Principal of a breach, its likely consequences, and the steps being taken to address it.',
    summary: 'Affected individuals must be told about a breach that touches their data, in clear terms. Employees who spot a breach should preserve evidence and escalate, so accurate notices can go out on time.',
    watchouts: ['Preserve evidence of a breach — do not delete logs or files', 'Escalate so affected individuals can be notified in time', 'Never reassure customers a breach is "nothing" on your own'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Everyday Breach Scenarios to Recognise',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Lost laptops, misdirected emails, misconfigured cloud buckets, and phishing-driven credential theft are all breaches that trigger DPDP obligations.',
    summary: 'A breach isn\'t only a hacker — a lost phone, an email to the wrong person, or a public cloud folder all count. These are regulatory incidents, not just IT annoyances, so treat them that way.',
    watchouts: ['Double-check recipients before sending personal data', 'Report a lost or stolen device immediately', 'Treat a phishing click that exposed credentials as a breach'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },

  // ── Penalties ──
  {
    title: 'DPDP Act — Penalties Up to 250 Crore Rupees',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Penalties reach up to 250 crore rupees for failure to apply reasonable security safeguards that could prevent a personal data breach.',
    summary: 'The Act carries some of India\'s heaviest data penalties — up to 250 crore rupees for security-safeguard failures. These land on the organisation, but negligent employees can face internal discipline.',
    watchouts: ['Treat data protection as seriously as financial compliance', 'Remember your slip can trigger organisation-wide penalties', 'Follow safeguards precisely — the maximum fine is 250 crore'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 10, tier: 1
  },
  {
    title: 'DPDP Act — The Penalty Schedule: Every Breach Has a Price',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'The Act\'s schedule sets penalty ceilings from 50 crore for general breaches up to 250 crore for security failures, with no minor-violation threshold.',
    summary: 'Failing to protect data can cost 250 crore; breach-notification and children\'s-data failures up to 200 crore; other breaches up to 50 crore. There is no "too small to matter" tier under this regime.',
    watchouts: ['Never assume a small compliance slip is harmless', 'Know children\'s-data and breach failures each risk 200 crore', 'Take every data rule seriously — none are low-cost to break'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Individual Accountability: Employees Aren\'t Immune',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Though fines fall on the organisation, employees can face discipline or termination, and wilful or reckless mishandling may draw liability under other laws.',
    summary: 'Penalties hit the company, but careless or wilful data mishandling can cost you your job — and reckless acts may attract liability under the IT Act. Your data decisions carry personal consequences.',
    watchouts: ['Remember you can be disciplined for data violations', 'Never handle personal data recklessly or wilfully misuse it', 'Own your data decisions — they carry personal consequences'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },

  // ── Cross-border transfer ──
  {
    title: 'DPDP Act — Cross-Border Data Transfer Restrictions',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Personal data may be transferred abroad only to countries permitted under the Central Government\'s notified list; other destinations are restricted.',
    summary: 'Sending personal data outside India is governed by the government\'s notified list of countries. Cloud tools, email, and collaboration apps hosting data abroad may fall under these transfer limits.',
    watchouts: ['Check the government list before sending data abroad', 'Know where your cloud and collaboration tools host data', 'Flag any cross-border data flow to a restricted country'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },

  // ── Consent Managers ──
  {
    title: 'DPDP Act — Consent Managers: Single Point of Data Control',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Consent Managers are entities registered with the Board that let individuals give, review, manage, and withdraw consent across Data Fiduciaries from one platform.',
    summary: 'Consent Managers are Board-registered intermediaries that help people manage consent in one place. Your systems must honour their consent and withdrawal directives exactly as if the person acted directly.',
    watchouts: ['Treat Consent Manager directives as legally binding', 'Ensure systems can process withdrawals from these platforms', 'Verify a Consent Manager is registered with the Board'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 8, tier: 1
  },

  // ── Data Protection Board ──
  {
    title: 'DPDP Act — The Data Protection Board of India',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'The Board is the independent authority that inquires into breaches and complaints, directs remedies, and imposes penalties, operating with the powers of a civil court.',
    summary: 'The Data Protection Board is no paper tiger — it can summon people, demand documents, and levy fines up to 250 crore. Its orders are legally binding, and non-cooperation is itself a violation.',
    watchouts: ['Cooperate fully with any Board inquiry', 'Treat Board orders as legally binding and enforceable', 'Preserve any records the Board may need to review'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — How the Board Enforces the Law',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'The Board can act on complaints or references, direct urgent remedial and mitigation measures during a breach, and refer disputes to mediation.',
    summary: 'When a breach occurs the Board can order immediate mitigation, investigate, and penalise. Employees should support rapid containment and give truthful information so the organisation\'s response holds up.',
    watchouts: ['Support fast containment when a breach is under inquiry', 'Give truthful, complete information during investigations', 'Never destroy or alter records tied to a Board matter'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 8, tier: 1
  },

  // ── Lawful processing & legitimate uses ──
  {
    title: 'DPDP Act — Lawful Purposes and Legitimate Uses',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Personal data may be processed on consent or for certain legitimate uses defined in the Act, such as data the individual voluntarily provided for a stated purpose.',
    summary: 'Processing is lawful only on consent or a defined legitimate use — not just because data is available. When unsure whether a use is covered, check with the privacy team before proceeding.',
    watchouts: ['Confirm a lawful basis exists before processing data', 'Never process data just because you happen to have access', 'Ask the privacy team when a use case is unclear'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 8, tier: 1
  },

  // ── Exemptions ──
  {
    title: 'DPDP Act — Government and National Security Exemptions',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Certain government processing for security, public order, and crime prevention is exempt, but must follow procedure established by law — it is not a blanket pass.',
    summary: 'Government-request exemptions are narrow and procedure-bound. If someone claiming government authority asks for personal data, verify the request through legal channels and share only the minimum required.',
    watchouts: ['Verify any government data request through legal/compliance', 'Disclose only the minimum data a valid request requires', 'Document every government request and your response'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 8, tier: 1
  },
  {
    title: 'DPDP Act — Research, Archiving, and Journalism Exemptions',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Processing for research, archiving, or statistical purposes may be exempt from some provisions where it meets prescribed standards and does not target individuals.',
    summary: 'Research and statistical use can be partly exempt, but only under prescribed safeguards and not to make decisions about specific individuals. Don\'t assume a "research" label removes all obligations.',
    watchouts: ['Don\'t assume a research label removes every obligation', 'Keep research data from being used to target individuals', 'Confirm prescribed safeguards apply before relying on exemptions'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 8, tier: 1
  },

  // ── Retention & deletion ──
  {
    title: 'DPDP Act — Data Retention and Deletion',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Personal data must be erased once its purpose is served and retention is no longer needed for legal or business reasons. Hoarding stale data is a liability.',
    summary: 'When data\'s purpose ends and no law requires keeping it, it must go. Old customer lists, ex-employee records, and stale leads are risks — follow the retention schedule and never keep shadow copies.',
    watchouts: ['Follow the retention schedule — do not hoard old data', 'Never keep personal "shadow copies" on your own device', 'Request purging of datasets you know are no longer needed'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },

  // ── Grievance mechanism ──
  {
    title: 'DPDP Act — The Grievance Redressal Mechanism',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Every Data Fiduciary must run a readily available grievance mechanism; Data Principals use it first before escalating unresolved complaints to the Board.',
    summary: 'Organisations must offer an easy way to raise data grievances and respond within the set time. Employees are the first line — acknowledge, log, and escalate complaints instead of blocking them.',
    watchouts: ['Acknowledge a data complaint within a day of receiving it', 'Never delete data tied to an open complaint — it\'s evidence', 'Escalate to the grievance officer; don\'t promise outcomes'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },

  // ── Employee data ──
  {
    title: 'DPDP Act — Employer Obligations for Employee Data',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Employers are Data Fiduciaries for staff data — attendance, payroll, health, and background checks — and must apply purpose limitation, security, and proportionate monitoring.',
    summary: 'Employment data can be processed for genuine HR purposes, but purpose limitation and safeguards still apply. Employee monitoring must be proportionate and disclosed, not silent or sweeping.',
    watchouts: ['Keep employee monitoring proportionate and disclosed', 'Delete background-check data once it is no longer needed', 'Never repurpose staff performance data without fresh consent'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Your Rights Over Your Own Employee Data',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Employees are Data Principals too — you can access, correct, and raise grievances about the personal data your employer holds on you.',
    summary: 'The Act protects you at work, not just customers. You can ask to see your records, correct errors, and complain about mishandling of your salary, health, or performance data through the grievance channel.',
    watchouts: ['Know you hold DPDP rights over your own staff data', 'Request access to your records if you have concerns', 'Use the grievance mechanism if your data is mishandled'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 8, tier: 1
  },

  // ── Department impact ──
  {
    title: 'DPDP Act — Impact on HR: Recruitment to Exit',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'HR handles some of the most sensitive personal data — resumes, PAN, bank details, health records — across the full employee lifecycle, demanding tight controls.',
    summary: 'HR touches applicant and staff data at every stage. Collect only what a role needs, secure resumes and ID documents, and purge rejected-candidate data on schedule rather than keeping it indefinitely.',
    watchouts: ['Collect only the applicant data a role genuinely needs', 'Secure resumes, PAN, and bank details with restricted access', 'Purge rejected-candidate data on schedule, don\'t stockpile it'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Impact on IT: Guardians of the Safeguards',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'IT implements the technical safeguards the Act demands — access controls, encryption, logging, and secure deletion — and manages breach detection and response.',
    summary: 'IT operationalises the Act\'s security duty. Enforce least-privilege access, encrypt personal data, keep audit logs, and revoke leavers\' credentials fast so old accounts don\'t become breach vectors.',
    watchouts: ['Enforce least-privilege access to personal data stores', 'Revoke departing staff credentials immediately', 'Keep audit logs and encryption on for personal data'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Impact on Marketing: Consent-Led Outreach',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Marketing must rely on valid consent for outreach, honour opt-outs, avoid repurposing data, and never buy or use lead lists without a lawful basis.',
    summary: 'Marketing lives closest to consent rules. Only contact people who agreed, drop them the moment they unsubscribe, and never repurpose service data for campaigns or use purchased lists without a lawful basis.',
    watchouts: ['Only market to contacts who gave valid consent', 'Honour every unsubscribe immediately across channels', 'Never buy or use lead lists without a lawful basis'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Impact on Finance: Guarding Money-Linked Data',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Finance processes bank details, PAN, and transaction records — high-value data that demands encryption, strict access, and careful vendor sharing.',
    summary: 'Finance handles money-linked identifiers that attract fraud. Encrypt bank and PAN data, limit access to those who need it, and confirm a data agreement exists before sharing records with any external party.',
    watchouts: ['Encrypt bank details and PAN data at rest and in transit', 'Restrict financial-record access to a strict need-to-know', 'Confirm a data agreement before sharing records externally'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },

  // ── Practical workplace & sensitive data ──
  {
    title: 'DPDP Act — Aadhaar, PAN, and Government IDs: Handle With Care',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Government identifiers like Aadhaar and PAN are permanent and cannot be changed if leaked, so they need encryption and strictly controlled sharing.',
    summary: 'Unlike a password, a leaked Aadhaar or PAN can\'t be reset. Never store these unencrypted, never use them as internal reference IDs, and never share them over WhatsApp, personal email, or SMS.',
    watchouts: ['Never store Aadhaar or PAN in unencrypted form', 'Use internal reference numbers, not Aadhaar, as identifiers', 'Never send government IDs over email, WhatsApp, or SMS'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Third-Party Vendors and Data Processing Agreements',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Any vendor processing personal data must be bound by a contract carrying the same obligations. Sharing data without a Data Processing Agreement is a violation.',
    summary: 'Before a SaaS tool, agency, or consultant touches customer data, a Data Processing Agreement must be in place. Handing over data without one leaves your organisation exposed for the vendor\'s failures too.',
    watchouts: ['Confirm a Data Processing Agreement before sharing any data', 'Never grant vendor access to personal data without approval', 'Check vendor contracts cover DPDP compliance duties'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Shadow IT: Unapproved Tools Are a Compliance Risk',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Using unapproved apps, personal cloud storage, or AI tools moves personal data outside controlled systems, undoing safeguards and risking cross-border breaches.',
    summary: 'Uploading customer data to a personal Google Drive or an unvetted AI tool puts it beyond your organisation\'s controls and may breach transfer rules. Stick to approved tools and check with IT before adopting new ones.',
    watchouts: ['Use only approved tools for handling personal data', 'Never upload work data to personal cloud or AI tools', 'Check with IT before adopting any new data-handling tool'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Email Mistakes That Expose Personal Data',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Wrong recipients, mis-attached files, and CC instead of BCC are the top causes of accidental personal-data disclosure — each a breach under the Act.',
    summary: 'Email is the number-one source of accidental data leaks. Auto-complete picks the wrong person, the wrong salary sheet gets attached, CC exposes a mailing list. Pause and verify To, CC, Attachment, and Content.',
    watchouts: ['Pause before sending: verify To, CC, Attachment, Content', 'Use BCC, not CC, for any mass email', 'Watch auto-complete — confirm the full recipient address'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 9, tier: 1
  },
  {
    title: 'DPDP Act — Daily Data Protection Habits for Every Employee',
    source: 'DPDP Act 2023', sourceId: 'dpdp-act', url: '',
    description: 'Simple daily habits — locking screens, verifying recipients, using approved channels, clearing desks, and reporting fast — cut DPDP compliance risk sharply.',
    summary: 'Compliance is built from small habits. Lock your screen when you step away, share only through approved encrypted channels, keep printed personal data locked up, and report any incident without delay.',
    watchouts: ['Lock your screen every time you leave your desk', 'Lock away printed documents holding personal data', 'Report incidents immediately — "wait and see" adds liability'],
    pubDate: '2023-08-11', type: 'DPDP Act', threatLevel: 3, relevanceScore: 8, tier: 1
  }
];

// ── DPDP-tuned keyword weights ──
// Supplements the default scoring with regulatory terms tuned for Indian DPDP
// content, applied via the snapshot override mechanism in retrieval.
export const DPDP_KEYWORDS = {
  critical: [
    'dpdp act', 'data fiduciary', 'data principal', 'personal data breach',
    'consent manager', 'data protection board', 'significant data fiduciary',
    'parental consent', 'purpose limitation', 'data minimisation',
    'breach notification', 'grievance redressal', 'data protection officer',
    'cross-border transfer', 'right to erasure'
  ],
  context: [
    'personal data', 'consent', 'processing', 'compliance', 'penalty',
    'notice', 'retention', 'aadhaar', 'encryption', 'audit'
  ],
  noise: [
    'gdpr', 'ccpa', 'european', 'california', 'cookie'
  ]
};

// ── DPDP-aware system prompt addition ──
// Injected into the synthesis prompt when the user's topic concerns Indian
// data privacy, giving the model authoritative framing for legal accuracy.
export const DPDP_PROMPT = `You are generating security-awareness poster content about India's Digital Personal Data Protection Act, 2023 (DPDP Act).
Key framing rules:
- The DPDP Act is India's comprehensive data protection law, distinct from GDPR, CCPA, or other global regimes.
- Penalties reach up to 250 crore rupees (roughly USD 30 million) for failing to apply reasonable security safeguards.
- The law is consent-centric: processing requires free, specific, informed, unconditional, unambiguous consent given by a clear affirmative action.
- Data Principals (individuals) have rights: access, correction, erasure, grievance redressal, and nomination.
- Data Fiduciaries (organisations) bear primary responsibility for lawful purpose, minimisation, security safeguards, and breach notification.
- Children (under 18) get elevated protection: verifiable parental consent and a ban on tracking, behavioural monitoring, and targeted advertising.
- Significant Data Fiduciaries must appoint an India-based Data Protection Officer, run Data Protection Impact Assessments, and undergo independent audits.
- Cross-border transfers are limited to countries permitted under the Central Government's notified list.
- The Data Protection Board of India has court-like enforcement powers, not merely advisory authority.
- Breach notification to the Board and to affected Data Principals is mandatory — there is no "minor breach" exception.
- Frame employee awareness itself as a security safeguard: untrained employees are a compliance liability.
Always present DPDP Act compliance as a shared employee responsibility, tied to concrete workplace behaviours, not just a legal or IT function.`;
