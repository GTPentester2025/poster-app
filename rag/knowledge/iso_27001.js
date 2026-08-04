// ISO/IEC 27001:2022 knowledge corpus — the international standard for an
// Information Security Management System (ISMS). Entries cover the management
// clauses (4–10) plus the most awareness-relevant Annex A controls, which in
// the 2022 revision number 93 across four themes: Organizational (A.5, 37
// controls), People (A.6, 8), Physical (A.7, 14), and Technological (A.8, 34).
//
// ISO 27001 is a certifiable standard, not a law, so `penalties` reflects
// certification consequences (nonconformities, suspended/withdrawn certificate,
// contractual impact) rather than statutory fines. Level 0 = standard text.

/** @type {object[]} */
export default [
  // ═══════════════ Management clauses 4–10 ═══════════════
  {
    id: 'iso-clause4',
    framework: 'ISO-27001',
    citation: 'ISO 27001 Clause 4',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 Clause 4 — Context of the Organization',
    summary: 'The organisation must understand its internal and external context and the needs of interested parties before defining the scope of its ISMS.',
    text: 'Clause 4 requires determining internal and external issues relevant to information security, identifying interested parties (customers, regulators, staff) and their requirements, and defining the boundaries and scope of the information security management system. This ensures the ISMS is built around the organisation\'s real risk landscape rather than a generic template.',
    obligations: [
      'Identify internal and external issues affecting information security',
      'Determine interested parties and their security-relevant requirements',
      'Define and document the scope of the ISMS'
    ],
    penalties: 'A poorly defined scope is a common audit nonconformity that can delay or block certification.',
    appliesTo: ['management', 'security governance', 'compliance'],
    topics: ['ISMS', 'context', 'scope', 'governance'],
    posterAngles: [
      'Security is built around your organisation\'s real risks, not a checklist',
      'Know who relies on the security your team provides',
      'Understand the boundaries of what the ISMS protects'
    ]
  },
  {
    id: 'iso-clause5',
    framework: 'ISO-27001',
    citation: 'ISO 27001 Clause 5',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 Clause 5 — Leadership and Commitment',
    summary: 'Top management must own information security, set policy, assign roles, and provide the resources the ISMS needs.',
    text: 'Clause 5 places accountability for the ISMS on top management: they must demonstrate leadership, establish an information security policy aligned with business objectives, ensure roles and responsibilities are assigned and communicated, and provide adequate resources. Security is a leadership commitment, not solely an IT function.',
    obligations: [
      'Demonstrate top-management commitment to the ISMS',
      'Establish and communicate an information security policy',
      'Assign and communicate information security roles and responsibilities'
    ],
    penalties: 'Lack of demonstrable leadership commitment is a serious audit finding affecting certification.',
    appliesTo: ['management', 'executives', 'security leadership'],
    topics: ['leadership', 'security policy', 'roles and responsibilities', 'governance'],
    posterAngles: [
      'Security starts at the top and is everyone\'s responsibility',
      'Know your information security role and what is expected of you',
      'Leadership backs security with real resources and clear policy'
    ]
  },
  {
    id: 'iso-clause6',
    framework: 'ISO-27001',
    citation: 'ISO 27001 Clause 6.1',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 Clause 6.1 — Risk Assessment and Treatment',
    summary: 'The organisation must identify information security risks, assess them, and plan treatments — the engine that drives which controls apply.',
    text: 'Clause 6.1 requires a defined process to identify, analyse, and evaluate information security risks, then select treatment options and the controls (referencing Annex A) needed to modify risk to acceptable levels. Results are captured in a risk treatment plan and a Statement of Applicability. Risk assessment is the mechanism that makes the ISMS proportionate and defensible.',
    obligations: [
      'Establish and apply a repeatable information security risk assessment process',
      'Select risk treatments and the controls needed to address unacceptable risks',
      'Produce a Statement of Applicability and risk treatment plan'
    ],
    penalties: 'An absent or superficial risk assessment is a core nonconformity that undermines the whole ISMS.',
    appliesTo: ['risk teams', 'security', 'management', 'control owners'],
    topics: ['risk assessment', 'risk treatment', 'Statement of Applicability', 'controls'],
    posterAngles: [
      'Controls exist because a real risk was identified — not by accident',
      'Raise new risks you spot so they can be assessed and treated',
      'Security decisions follow the risk, not guesswork'
    ]
  },
  {
    id: 'iso-clause7',
    framework: 'ISO-27001',
    citation: 'ISO 27001 Clause 7',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 Clause 7 — Support: Competence, Awareness, and Communication',
    summary: 'The ISMS must be supported with resources, competent people, security awareness, communication, and controlled documentation.',
    text: 'Clause 7 covers the enablers of the ISMS: providing resources, ensuring people are competent for their security responsibilities, making staff aware of the security policy and their contribution, managing internal and external communication about security, and controlling documented information. Awareness under 7.3 is where employee behaviour directly meets the standard.',
    obligations: [
      'Ensure staff are competent for their information security roles',
      'Make personnel aware of the security policy and their contribution to it',
      'Control documented information (creation, approval, and access)'
    ],
    penalties: 'Gaps in competence or awareness records commonly surface as audit findings.',
    appliesTo: ['all staff', 'HR', 'security awareness team', 'management'],
    topics: ['awareness', 'competence', 'communication', 'documentation'],
    posterAngles: [
      'You are part of the security system — know your role',
      'Awareness is a formal requirement, not an optional extra',
      'Follow document controls: use current, approved versions only'
    ]
  },
  {
    id: 'iso-clause8',
    framework: 'ISO-27001',
    citation: 'ISO 27001 Clause 8',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 Clause 8 — Operation',
    summary: 'The organisation must plan, implement, and control the processes needed to meet security requirements and carry out risk treatment.',
    text: 'Clause 8 puts the plan into action: operational processes that meet information security requirements are implemented and controlled, changes are managed, outsourced processes are controlled, and the risk assessment and treatment plans are actually carried out and their results documented. It is where the paper ISMS becomes day-to-day practice.',
    obligations: [
      'Plan and control operational processes that deliver security requirements',
      'Perform information security risk assessments at planned intervals and on significant change',
      'Implement the risk treatment plan and retain evidence'
    ],
    penalties: 'Processes documented but not operating as described are a frequent nonconformity.',
    appliesTo: ['operations', 'security', 'control owners', 'process owners'],
    topics: ['operations', 'risk treatment', 'change management', 'process control'],
    posterAngles: [
      'Follow security processes in practice, not just on paper',
      'Reassess risk when something significant changes',
      'Keep evidence that controls are actually being run'
    ]
  },
  {
    id: 'iso-clause9',
    framework: 'ISO-27001',
    citation: 'ISO 27001 Clause 9',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 Clause 9 — Performance Evaluation',
    summary: 'The ISMS must be monitored, measured, internally audited, and reviewed by management to confirm it is effective.',
    text: 'Clause 9 requires evaluating how well the ISMS performs: monitoring and measuring security processes and controls, conducting internal audits at planned intervals, and holding management reviews to assess suitability, adequacy, and effectiveness. Evidence from these activities feeds continual improvement and drives corrective action where controls fall short.',
    obligations: [
      'Monitor and measure the effectiveness of the ISMS and its controls',
      'Conduct internal audits of the ISMS at planned intervals',
      'Hold management reviews of ISMS performance'
    ],
    penalties: 'Missing or ineffective internal audits and management reviews are significant certification findings.',
    appliesTo: ['internal audit', 'management', 'security', 'control owners'],
    topics: ['monitoring', 'internal audit', 'management review', 'measurement'],
    posterAngles: [
      'Cooperate with internal audits — they keep security honest',
      'What gets measured gets managed — including security',
      'Findings drive fixes: raise gaps rather than hiding them'
    ]
  },
  {
    id: 'iso-clause10',
    framework: 'ISO-27001',
    citation: 'ISO 27001 Clause 10',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 Clause 10 — Improvement',
    summary: 'Nonconformities must be corrected and the ISMS continually improved based on what monitoring, audits, and incidents reveal.',
    text: 'Clause 10 requires reacting to nonconformities, taking corrective action to address their causes, and continually improving the suitability, adequacy, and effectiveness of the ISMS. Lessons from incidents, audits, and measurements are fed back so the system gets stronger over time rather than stagnating after certification.',
    obligations: [
      'Identify and correct nonconformities and address their root causes',
      'Take corrective action and verify its effectiveness',
      'Continually improve the ISMS'
    ],
    penalties: 'Repeat nonconformities with no corrective action can lead to certificate suspension.',
    appliesTo: ['management', 'security', 'quality/compliance', 'all staff'],
    topics: ['continual improvement', 'corrective action', 'nonconformity', 'lessons learned'],
    posterAngles: [
      'Fix the root cause, not just the symptom',
      'Every incident is a chance to make security stronger',
      'Continual improvement means security never stands still'
    ]
  },
  // ═══════════════ Annex A.5 — Organizational controls ═══════════════
  {
    id: 'iso-a5-1',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.1',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.1 — Policies for Information Security',
    summary: 'A set of information security policies must be defined, approved, published, communicated to staff, and reviewed regularly.',
    text: 'Control A.5.1 requires an information security policy and topic-specific policies to be defined and approved by management, published, communicated to and acknowledged by relevant personnel, and reviewed at planned intervals or when significant changes occur. Policies set the expectations everyone is measured against.',
    obligations: [
      'Define and approve information security policies at management level',
      'Communicate policies to all relevant personnel and obtain acknowledgement',
      'Review policies at planned intervals and after significant change'
    ],
    penalties: 'Outdated or uncommunicated policies are a common audit nonconformity.',
    appliesTo: ['all staff', 'management', 'compliance'],
    topics: ['security policy', 'governance', 'communication'],
    posterAngles: [
      'Read the security policy — it is the rulebook you are held to',
      'Policies only work when everyone knows and follows them',
      'When policy changes, so should your habits'
    ]
  },
  {
    id: 'iso-a5-2',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.2',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.2 — Information Security Roles and Responsibilities',
    summary: 'Security responsibilities must be clearly defined and allocated so everyone knows what they are accountable for.',
    text: 'Control A.5.2 requires information security roles and responsibilities to be defined and allocated according to organisational needs. Clear ownership prevents the "someone else\'s job" gap where security tasks fall through the cracks. Individuals must understand and accept the responsibilities assigned to them.',
    obligations: [
      'Define information security responsibilities and allocate them to specific roles',
      'Communicate responsibilities to those who hold them',
      'Ensure individuals accept and understand their security duties'
    ],
    penalties: 'Unclear ownership of controls is a frequent finding and a real-world source of breaches.',
    appliesTo: ['all staff', 'management', 'control owners'],
    topics: ['roles and responsibilities', 'accountability', 'governance'],
    posterAngles: [
      'Know exactly what security tasks you own',
      '"Not my job" is how security gaps happen — own your part',
      'Clear responsibility means nothing falls through the cracks'
    ]
  },
  {
    id: 'iso-a5-7',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.7',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.7 — Threat Intelligence',
    summary: 'Information about security threats must be collected and analysed so the organisation can anticipate and defend against them.',
    text: 'Control A.5.7 (new in 2022) requires gathering and analysing threat intelligence about current and emerging threats — their methods, tools, and indicators — so defences can be adapted proactively. Employee awareness of current scams and attack trends is a practical, human side of this control.',
    obligations: [
      'Collect and analyse relevant threat intelligence',
      'Use threat insight to inform defensive measures',
      'Share awareness of current threats with staff'
    ],
    penalties: 'Not applicable as a statutory penalty; ineffective use is an audit observation.',
    appliesTo: ['security operations', 'threat intel', 'all staff (awareness)'],
    topics: ['threat intelligence', 'emerging threats', 'awareness'],
    posterAngles: [
      'Stay current on the scams making the rounds right now',
      'Knowing the attacker\'s latest trick is half the defence',
      'Share threat warnings with your team'
    ]
  },
  {
    id: 'iso-a5-9',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.9',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.9 — Inventory of Information and Other Associated Assets',
    summary: 'You cannot protect what you cannot see — assets and the information they hold must be identified and owned.',
    text: 'Control A.5.9 requires an inventory of information and associated assets, including owners, so responsibility for protection is clear. Knowing what data and systems exist, where they live, and who owns them is the foundation for applying the right protection to the right assets.',
    obligations: [
      'Maintain an inventory of information and associated assets',
      'Assign an owner to each asset',
      'Keep the inventory current as assets change'
    ],
    penalties: 'An incomplete asset inventory undermines every downstream control and is a common finding.',
    appliesTo: ['asset owners', 'IT', 'security', 'all staff'],
    topics: ['asset management', 'inventory', 'data ownership'],
    posterAngles: [
      'You cannot protect what you do not know you have',
      'Every asset needs an owner responsible for its security',
      'Know where your team\'s sensitive data actually lives'
    ]
  },
  {
    id: 'iso-a5-10',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.10',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.10 — Acceptable Use of Information and Assets',
    summary: 'Rules for the acceptable use and handling of information and assets must be defined, communicated, and followed.',
    text: 'Control A.5.10 requires rules for acceptable use of information and associated assets to be identified, documented, and implemented. This is the everyday guardrail: what staff may and may not do with company data, devices, email, and internet access. Following acceptable-use rules is one of the most direct ways employees uphold the ISMS.',
    obligations: [
      'Define and communicate acceptable-use rules for information and assets',
      'Handle information according to its classification',
      'Ensure staff follow acceptable-use policy in daily work'
    ],
    penalties: 'Not applicable as a statutory penalty; violations may be disciplinary matters and audit findings.',
    appliesTo: ['all staff', 'contractors', 'HR'],
    topics: ['acceptable use', 'data handling', 'policy'],
    posterAngles: [
      'Use company devices and data the way policy allows',
      'Handle information according to how sensitive it is',
      'Acceptable use is the rulebook for everyday work'
    ]
  },
  {
    id: 'iso-a5-12',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.12',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.12 — Classification of Information',
    summary: 'Information must be classified by sensitivity so it receives protection proportionate to its value and risk.',
    text: 'Control A.5.12 requires information to be classified according to its confidentiality, integrity, and availability needs and legal requirements. Classification (e.g. public, internal, confidential, restricted) tells everyone how carefully a piece of information must be handled, stored, shared, and disposed of.',
    obligations: [
      'Classify information based on sensitivity and requirements',
      'Apply protection appropriate to each classification level',
      'Ensure staff recognise and respect classification labels'
    ],
    penalties: 'Mishandling classified information can breach contracts and privacy law; internally an audit finding.',
    appliesTo: ['all staff', 'data owners', 'security'],
    topics: ['data classification', 'confidentiality', 'data handling'],
    posterAngles: [
      'Treat confidential data with the care its label demands',
      'Classification tells you how carefully to handle information',
      'When in doubt about sensitivity, ask before you share'
    ]
  },
  {
    id: 'iso-a5-13',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.13',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.13 — Labelling of Information',
    summary: 'Information should be labelled according to its classification so handling requirements are obvious to anyone who sees it.',
    text: 'Control A.5.13 requires procedures for labelling information in line with the classification scheme, across physical and electronic formats. Clear labels — on documents, emails, and files — make it immediately obvious how a piece of information must be protected, reducing accidental mishandling.',
    obligations: [
      'Label information consistently with its classification',
      'Apply labels across physical and electronic formats',
      'Respect labels when sharing or storing information'
    ],
    penalties: 'Not applicable as a statutory penalty; inconsistent labelling is an audit observation.',
    appliesTo: ['all staff', 'data owners'],
    topics: ['labelling', 'data classification', 'data handling'],
    posterAngles: [
      'Label sensitive documents so no one mishandles them by mistake',
      'A clear "Confidential" label prevents accidental oversharing',
      'Respect the label — it tells you how to protect the data'
    ]
  },
  {
    id: 'iso-a5-14',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.14',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.14 — Information Transfer',
    summary: 'Rules and protections must govern how information is transferred internally and to external parties across all channels.',
    text: 'Control A.5.14 requires rules, procedures, and agreements to protect information in transit — electronic, physical, and verbal. This covers secure email, approved file-sharing, confidentiality of conversations, and agreements with external parties. Insecure transfer is a common way sensitive data escapes.',
    obligations: [
      'Use approved, secure methods to transfer sensitive information',
      'Establish agreements for information transfer with external parties',
      'Protect information during electronic, physical, and verbal transfer'
    ],
    penalties: 'Insecure transfers that expose data may breach privacy law and are audit findings.',
    appliesTo: ['all staff', 'IT', 'legal/contracts'],
    topics: ['information transfer', 'secure sharing', 'confidentiality'],
    posterAngles: [
      'Share sensitive files only through approved, secure channels',
      'Watch what you say in public — verbal leaks count too',
      'Never send confidential data over unapproved tools'
    ]
  },
  {
    id: 'iso-a5-15',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.15',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.15 — Access Control',
    summary: 'Access to information and assets must be governed by a defined policy based on business and security requirements.',
    text: 'Control A.5.15 requires rules for physical and logical access to information and assets, established and applied based on business needs and security requirements. It underpins least privilege and need-to-know: people get access appropriate to their role, and nothing more.',
    obligations: [
      'Establish and apply an access control policy',
      'Grant access based on business need and least privilege',
      'Review and adjust access as roles change'
    ],
    penalties: 'Excessive or unmanaged access is a leading breach cause and a common audit finding.',
    appliesTo: ['identity/access teams', 'managers', 'all staff', 'IT'],
    topics: ['access control', 'least privilege', 'need to know'],
    posterAngles: [
      'Access follows your role — request only what you need',
      'When your job changes, so should your access',
      'Least privilege limits the damage of any single account'
    ]
  },
  {
    id: 'iso-a5-16',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.16',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.16 — Identity Management',
    summary: 'The full lifecycle of digital identities must be managed so every account maps to a real, authorised individual or service.',
    text: 'Control A.5.16 requires managing the lifecycle of identities — creation, changes, and removal — so access can be reliably attributed. Prompt de-provisioning of leavers and accurate mapping of accounts to people are core to accountability and to closing the window an orphaned account leaves open.',
    obligations: [
      'Manage identities across their full lifecycle',
      'Ensure each identity maps to an authorised individual or service',
      'Remove or disable identities promptly when no longer needed'
    ],
    penalties: 'Orphaned/leaver accounts are a classic breach vector and a common finding.',
    appliesTo: ['identity teams', 'IT', 'HR', 'managers'],
    topics: ['identity management', 'account lifecycle', 'de-provisioning'],
    posterAngles: [
      'Disable leaver accounts immediately — they are an open door',
      'Every account should trace back to a real, authorised person',
      'Flag old accounts that no longer belong to anyone'
    ]
  },
  {
    id: 'iso-a5-17',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.17',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.17 — Authentication Information',
    summary: 'Passwords and other authentication secrets must be allocated and managed securely, and users must protect their own credentials.',
    text: 'Control A.5.17 governs the management of authentication information — passwords, tokens, keys — including secure allocation, storage, and the responsibility of users to keep secrets confidential. Reused, weak, or shared credentials remain a top cause of compromise, making this control central to awareness.',
    obligations: [
      'Allocate and manage authentication information securely',
      'Require users to keep their credentials confidential and not reuse them',
      'Enforce strong password/passphrase practices and secure storage'
    ],
    penalties: 'Credential compromise from weak practices is a leading breach cause; internally an audit finding.',
    appliesTo: ['all staff', 'IT', 'identity teams'],
    topics: ['authentication', 'passwords', 'credentials', 'secrets management'],
    posterAngles: [
      'Never reuse a password across accounts',
      'Your login is yours alone — never share it',
      'Use a password manager for long, unique passphrases'
    ]
  },
  {
    id: 'iso-a5-19',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.19',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.19 — Information Security in Supplier Relationships',
    summary: 'Security risks from suppliers and their access to your information must be identified and managed through agreements.',
    text: 'Control A.5.19 requires processes to manage information security risks associated with the use of suppliers\' products and services. Suppliers who access, process, or store your information must be held to security requirements defined in agreements. Your security posture extends to everyone in your supply chain.',
    obligations: [
      'Identify and manage security risks arising from supplier relationships',
      'Define security requirements in supplier agreements',
      'Monitor supplier compliance with those requirements'
    ],
    penalties: 'Supplier breaches involving your data cause contractual and reputational harm; internally a finding.',
    appliesTo: ['procurement', 'vendor management', 'security', 'contract owners'],
    topics: ['supplier security', 'third-party risk', 'supply chain'],
    posterAngles: [
      'A supplier with weak security is your risk too',
      'Put security requirements in every supplier agreement',
      'Vet and monitor vendors who touch your data'
    ]
  },
  {
    id: 'iso-a5-24',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.24',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.24 — Information Security Incident Management Planning',
    summary: 'The organisation must plan and prepare for security incidents with defined processes, roles, and reporting channels.',
    text: 'Control A.5.24 requires planning and preparing for incident management: establishing processes, roles, and responsibilities for detecting, reporting, assessing, and responding to information security events and incidents. Readiness before an incident is what makes response fast and effective when one occurs.',
    obligations: [
      'Establish incident management processes, roles, and responsibilities',
      'Define how events and incidents are reported and assessed',
      'Prepare communication and escalation paths in advance'
    ],
    penalties: 'An untested or absent incident plan worsens outcomes and is a certification finding.',
    appliesTo: ['incident response', 'security', 'management', 'all staff (reporting)'],
    topics: ['incident management', 'preparedness', 'reporting', 'escalation'],
    posterAngles: [
      'Know how to report a security incident before you need to',
      'Preparation is what makes incident response fast',
      'A clear escalation path saves precious time in a crisis'
    ]
  },
  {
    id: 'iso-a5-27',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.5.27',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.5.27 — Learning From Information Security Incidents',
    summary: 'Knowledge gained from incidents must be used to strengthen controls and reduce the chance of recurrence.',
    text: 'Control A.5.27 requires that lessons from information security incidents be used to strengthen and improve controls. Root-cause analysis and follow-up ensure the same weakness is not exploited twice. This closes the loop between response and improvement.',
    obligations: [
      'Analyse incidents to identify root causes',
      'Feed lessons learned into control improvements',
      'Track that corrective actions are completed'
    ],
    penalties: 'Repeat incidents from unaddressed causes are audit findings and reputational risks.',
    appliesTo: ['incident response', 'security', 'management'],
    topics: ['lessons learned', 'incident management', 'continual improvement'],
    posterAngles: [
      'Every incident should make the next one less likely',
      'Fix the root cause so the same attack cannot work twice',
      'Share what an incident taught the team'
    ]
  },
  // ═══════════════ Annex A.6 — People controls ═══════════════
  {
    id: 'iso-a6-1',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.6.1',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.6.1 — Screening',
    summary: 'Background verification of candidates must be carried out before employment, proportionate to the role\'s risk.',
    text: 'Control A.6.1 requires background verification checks on candidates for employment before joining, in accordance with laws, regulations, and ethics, proportional to the business requirements, classification of information accessed, and perceived risk. Screening helps ensure trustworthy people hold sensitive roles.',
    obligations: [
      'Perform proportionate background checks before employment',
      'Align screening with legal and regulatory requirements',
      'Scale checks to the sensitivity of the role'
    ],
    penalties: 'Not applicable as a statutory penalty; inadequate screening for sensitive roles is an audit finding.',
    appliesTo: ['HR', 'recruitment', 'management'],
    topics: ['screening', 'background checks', 'personnel security'],
    posterAngles: [
      'Sensitive roles require appropriate background checks',
      'Screening builds trust before access is granted',
      'The right vetting protects everyone'
    ]
  },
  {
    id: 'iso-a6-2',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.6.2',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.6.2 — Terms and Conditions of Employment',
    summary: 'Employment agreements must state the employee\'s and organisation\'s information security responsibilities.',
    text: 'Control A.6.2 requires employment contractual agreements to state personnel and organisational responsibilities for information security. Making security duties explicit at hire sets clear expectations and provides a basis for accountability throughout the employment relationship.',
    obligations: [
      'Include information security responsibilities in employment terms',
      'Ensure staff acknowledge their security obligations',
      'Extend equivalent obligations to contractors'
    ],
    penalties: 'Not applicable as a statutory penalty; missing clauses are an audit finding.',
    appliesTo: ['HR', 'legal', 'management'],
    topics: ['employment terms', 'responsibilities', 'personnel security'],
    posterAngles: [
      'Your security responsibilities are part of your job from day one',
      'Know the security duties you signed up for',
      'Security obligations apply to contractors too'
    ]
  },
  {
    id: 'iso-a6-3',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.6.3',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.6.3 — Information Security Awareness, Education and Training',
    summary: 'All personnel must receive appropriate, regularly updated security awareness training relevant to their role.',
    text: 'Control A.6.3 requires that personnel and relevant interested parties receive appropriate information security awareness, education, and training, plus regular updates on organisational policies and procedures relevant to their job function. This is the flagship awareness control — the human layer that backstops every technical safeguard.',
    obligations: [
      'Provide security awareness training to all personnel',
      'Keep training current and relevant to each role',
      'Reinforce policies and procedures through regular updates'
    ],
    penalties: 'Not applicable as a statutory penalty; missing/lapsed training is a common audit finding.',
    appliesTo: ['all staff', 'contractors', 'HR', 'security awareness team'],
    topics: ['awareness', 'training', 'education', 'human factor'],
    posterAngles: [
      'Complete your security training — you are the human firewall',
      'Awareness turns policy into everyday good habits',
      'Refresh your knowledge as threats evolve'
    ]
  },
  {
    id: 'iso-a6-4',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.6.4',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.6.4 — Disciplinary Process',
    summary: 'A formal, communicated disciplinary process must exist for personnel who commit information security breaches.',
    text: 'Control A.6.4 requires a formal and communicated disciplinary process to take action against personnel who have committed an information security policy violation. A fair, known consequence deters careless or malicious behaviour and reinforces that security rules are taken seriously.',
    obligations: [
      'Establish a formal disciplinary process for security violations',
      'Communicate the process so consequences are known',
      'Apply it consistently and fairly'
    ],
    penalties: 'Not applicable as a statutory penalty; absence weakens enforcement and is an audit observation.',
    appliesTo: ['HR', 'management', 'all staff'],
    topics: ['disciplinary process', 'enforcement', 'personnel security'],
    posterAngles: [
      'Security rules have consequences — take them seriously',
      'A clear, fair process applies when policy is broken',
      'Enforcement backs up every security policy'
    ]
  },
  {
    id: 'iso-a6-5',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.6.5',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.6.5 — Responsibilities After Termination or Change of Employment',
    summary: 'Security responsibilities that remain valid after someone leaves or changes role must be defined and enforced.',
    text: 'Control A.6.5 requires that information security responsibilities and duties remaining valid after termination or change of employment — such as confidentiality obligations — be defined, enforced, and communicated. Access must be revoked and assets returned when someone leaves.',
    obligations: [
      'Define security responsibilities that persist after employment ends',
      'Revoke access and recover assets on termination or role change',
      'Communicate ongoing obligations such as confidentiality'
    ],
    penalties: 'Failure to revoke access on exit is a classic breach vector and audit finding.',
    appliesTo: ['HR', 'IT', 'managers', 'security'],
    topics: ['offboarding', 'access revocation', 'confidentiality', 'personnel security'],
    posterAngles: [
      'Return devices and access on your last day',
      'Confidentiality lasts even after you leave',
      'Managers: ensure leaver access is revoked promptly'
    ]
  },
  {
    id: 'iso-a6-7',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.6.7',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.6.7 — Remote Working',
    summary: 'Security measures must protect information accessed, processed, or stored when staff work outside the office.',
    text: 'Control A.6.7 requires security measures for remote working to protect information accessed, processed, or stored outside the organisation\'s premises. This covers secure connectivity, protecting devices and screens in public, home-network hygiene, and preventing family or bystanders from accessing work data.',
    obligations: [
      'Apply security measures for information handled while working remotely',
      'Use secure, approved connections and protect devices off-site',
      'Prevent unauthorised viewing or access in shared/public spaces'
    ],
    penalties: 'Not applicable as a statutory penalty; remote-work exposures are audit findings and breach sources.',
    appliesTo: ['remote workers', 'all staff', 'IT'],
    topics: ['remote working', 'device security', 'secure connectivity'],
    posterAngles: [
      'Lock your screen and shield it in public spaces',
      'Connect through approved, secure links when working remotely',
      'Keep work data away from family devices and shared machines'
    ]
  },
  {
    id: 'iso-a6-8',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.6.8',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.6.8 — Information Security Event Reporting',
    summary: 'Staff must be able to report observed or suspected security events quickly through defined channels.',
    text: 'Control A.6.8 requires a mechanism for personnel to report observed or suspected information security events in a timely manner. Early reporting — of a phishing email, a lost device, or a strange system behaviour — is often what lets the organisation contain an incident before it spreads.',
    obligations: [
      'Provide clear channels to report security events',
      'Encourage prompt reporting of anything suspicious',
      'Ensure reports are acted upon without blame for good-faith reporting'
    ],
    penalties: 'Not applicable as a statutory penalty; under-reporting culture is a real weakness and audit concern.',
    appliesTo: ['all staff', 'security', 'help desk'],
    topics: ['event reporting', 'incident detection', 'awareness'],
    posterAngles: [
      'See something odd? Report it — early reporting stops breaches',
      'Reporting a mistake fast is always better than hiding it',
      'Know the one channel to report a suspicious email or lost device'
    ]
  },
  // ═══════════════ Annex A.7 — Physical controls ═══════════════
  {
    id: 'iso-a7-1',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.7.1',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.7.1 — Physical Security Perimeters',
    summary: 'Physical perimeters must protect areas that contain information and information-processing facilities.',
    text: 'Control A.7.1 requires defining and using security perimeters to protect areas that hold information and processing facilities. Walls, controlled entry points, and barriers keep unauthorised people away from sensitive systems and data. Physical security is the foundation many logical controls rest on.',
    obligations: [
      'Define physical security perimeters around sensitive areas',
      'Control entry points to those areas',
      'Maintain barriers appropriate to the sensitivity within'
    ],
    penalties: 'Not applicable as a statutory penalty; perimeter weaknesses are audit findings.',
    appliesTo: ['facilities', 'security', 'all staff'],
    topics: ['physical security', 'perimeter', 'access control'],
    posterAngles: [
      'Keep secure doors closed — do not prop them open',
      'Physical barriers protect the systems behind them',
      'Report a broken lock or open perimeter door'
    ]
  },
  {
    id: 'iso-a7-2',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.7.2',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.7.2 — Physical Entry Controls',
    summary: 'Secure areas must be protected by entry controls that allow only authorised people in — and challenge those who are not.',
    text: 'Control A.7.2 requires secure areas to be protected by appropriate entry controls and access points. This includes badge access, visitor management, and — critically — the human behaviour of not letting unverified people tailgate through controlled doors. Physical entry control depends heavily on staff vigilance.',
    obligations: [
      'Restrict entry to secure areas to authorised personnel',
      'Manage and escort visitors',
      'Prevent tailgating and challenge unfamiliar people'
    ],
    penalties: 'Not applicable as a statutory penalty; tailgating incidents are common findings.',
    appliesTo: ['all staff', 'facilities', 'reception', 'security'],
    topics: ['physical security', 'entry control', 'tailgating', 'visitor management'],
    posterAngles: [
      'Do not hold the door for people you cannot verify',
      'Badge in individually — no tailgating',
      'Politely challenge strangers in secure areas'
    ]
  },
  {
    id: 'iso-a7-7',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.7.7',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.7.7 — Clear Desk and Clear Screen',
    summary: 'Sensitive papers must be cleared from desks and screens locked when unattended to prevent casual exposure.',
    text: 'Control A.7.7 requires clear desk rules for papers and removable media and clear screen rules for information-processing facilities. Locking your screen when you step away and putting sensitive documents out of sight prevents opportunistic viewing, theft, or accidental disclosure — a simple habit with outsized impact.',
    obligations: [
      'Clear sensitive papers and media from desks when unattended',
      'Lock screens when leaving a workstation',
      'Store confidential material securely, not in the open'
    ],
    penalties: 'Not applicable as a statutory penalty; clear-desk lapses are frequent audit findings.',
    appliesTo: ['all staff'],
    topics: ['clear desk', 'clear screen', 'physical security', 'data exposure'],
    posterAngles: [
      'Lock your screen every time you step away',
      'Clear sensitive papers off your desk before you leave',
      'A locked screen and a clear desk stop casual snooping'
    ]
  },
  {
    id: 'iso-a7-10',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.7.10',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.7.10 — Storage Media',
    summary: 'Removable and storage media must be managed securely throughout their lifecycle, including acquisition, use, and disposal.',
    text: 'Control A.7.10 requires storage media to be managed through their lifecycle of acquisition, use, transportation, and disposal in line with classification and handling requirements. USB drives, disks, and backups can carry large volumes of sensitive data and are easily lost or stolen, so they need careful handling and encryption.',
    obligations: [
      'Manage removable and storage media according to classification',
      'Encrypt sensitive data on portable media',
      'Control transport and use of media to prevent loss or theft'
    ],
    penalties: 'Not applicable as a statutory penalty; lost unencrypted media can breach privacy law.',
    appliesTo: ['all staff', 'IT', 'operations'],
    topics: ['storage media', 'removable media', 'encryption', 'data handling'],
    posterAngles: [
      'Encrypt any USB drive that holds sensitive data',
      'A lost unencrypted drive is a lost data set',
      'Do not plug in unknown USB devices'
    ]
  },
  {
    id: 'iso-a7-14',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.7.14',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.7.14 — Secure Disposal or Re-use of Equipment',
    summary: 'Equipment must be securely wiped or destroyed before disposal or re-use so no sensitive data is left behind.',
    text: 'Control A.7.14 requires that items of equipment containing storage media be verified to ensure any sensitive data and licensed software have been removed or securely overwritten before disposal or re-use. Deleting files is not enough — data must be rendered unrecoverable to prevent leakage through discarded or repurposed devices.',
    obligations: [
      'Securely wipe or destroy storage media before disposal or re-use',
      'Verify data removal before equipment leaves the organisation',
      'Follow approved disposal procedures rather than ad hoc deletion'
    ],
    penalties: 'Not applicable as a statutory penalty; recoverable data on discarded gear can breach privacy law.',
    appliesTo: ['IT', 'facilities', 'all staff', 'asset management'],
    topics: ['secure disposal', 'data sanitisation', 'equipment re-use'],
    posterAngles: [
      'Deleting a file does not erase it — follow secure disposal',
      'Never bin or donate a device without a proper wipe',
      'Return old equipment to IT for secure sanitisation'
    ]
  },
  // ═══════════════ Annex A.8 — Technological controls ═══════════════
  {
    id: 'iso-a8-1',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.1',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.1 — User Endpoint Devices',
    summary: 'Information on user endpoint devices — laptops, phones, tablets — must be protected wherever the device goes.',
    text: 'Control A.8.1 requires protecting information stored on, processed by, or accessible via user endpoint devices. This includes device encryption, screen locks, keeping software updated, and rules for personal-device use. Endpoints are the front line where most users meet company data, and where much of it is lost.',
    obligations: [
      'Protect information on endpoint devices (encryption, locks, updates)',
      'Follow policy for personal and bring-your-own devices',
      'Report lost or stolen devices immediately'
    ],
    penalties: 'Not applicable as a statutory penalty; endpoint loss is a leading data-exposure source.',
    appliesTo: ['all staff', 'IT', 'endpoint teams'],
    topics: ['endpoint security', 'device encryption', 'mobile devices'],
    posterAngles: [
      'Keep your laptop encrypted and locked',
      'Report a lost or stolen device the moment it happens',
      'Install updates — endpoints are the front line'
    ]
  },
  {
    id: 'iso-a8-2',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.2',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.2 — Privileged Access Rights',
    summary: 'Privileged access — admin and elevated rights — must be tightly restricted, allocated, and monitored.',
    text: 'Control A.8.2 requires that the allocation and use of privileged access rights be restricted and managed. Admin accounts can cause the most damage if misused or compromised, so they are granted sparingly, used only when needed, separated from everyday accounts, and closely monitored.',
    obligations: [
      'Restrict privileged access to those who genuinely require it',
      'Separate privileged accounts from everyday user accounts',
      'Monitor and review privileged access use'
    ],
    penalties: 'Not applicable as a statutory penalty; misused privilege is a top breach amplifier and audit finding.',
    appliesTo: ['administrators', 'IT', 'security', 'identity teams'],
    topics: ['privileged access', 'admin rights', 'least privilege', 'monitoring'],
    posterAngles: [
      'Use admin rights only when the task truly needs them',
      'Keep admin and everyday accounts separate',
      'Privileged access is powerful — treat it with care'
    ]
  },
  {
    id: 'iso-a8-3',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.3',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.3 — Information Access Restriction',
    summary: 'Access to information must be restricted in line with the access control policy and need-to-know.',
    text: 'Control A.8.3 requires that access to information and application system functions be restricted in accordance with the established access control policy. Users see and change only the information their role justifies, enforced through system permissions. This limits both accidental exposure and the blast radius of a compromised account.',
    obligations: [
      'Restrict information access according to the access control policy',
      'Enforce need-to-know at the application and data level',
      'Review access rights regularly'
    ],
    penalties: 'Not applicable as a statutory penalty; over-broad access is a common finding and breach amplifier.',
    appliesTo: ['IT', 'application owners', 'identity teams', 'all staff'],
    topics: ['access restriction', 'need to know', 'least privilege'],
    posterAngles: [
      'You should see only the data your role requires',
      'Do not go looking in systems you have no business reason to open',
      'Least access limits the damage of any breach'
    ]
  },
  {
    id: 'iso-a8-5',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.5',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.5 — Secure Authentication',
    summary: 'Secure authentication technologies and procedures, including MFA where appropriate, must control access to systems.',
    text: 'Control A.8.5 requires secure authentication technologies and procedures based on access restrictions and the access control policy. This includes strong authentication methods, multi-factor authentication for higher-risk access, and safeguards against brute-force and credential-stuffing attacks. Authentication is the gate that keeps impostors out.',
    obligations: [
      'Implement secure authentication appropriate to the risk',
      'Use multi-factor authentication for sensitive or remote access',
      'Protect against brute-force and credential-stuffing attacks'
    ],
    penalties: 'Not applicable as a statutory penalty; weak authentication is a leading breach cause.',
    appliesTo: ['all staff', 'IT', 'identity teams'],
    topics: ['authentication', 'MFA', 'access control'],
    posterAngles: [
      'Turn on MFA — a password alone is not enough',
      'Approve login prompts only for sign-ins you started',
      'Strong authentication keeps impostors out'
    ]
  },
  {
    id: 'iso-a8-7',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.7',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.7 — Protection Against Malware',
    summary: 'Protection against malware must be implemented and supported by appropriate user awareness.',
    text: 'Control A.8.7 requires protection against malware to be implemented and supported by appropriate user awareness. Technical defences (anti-malware, filtering) are paired with the human element — recognising suspicious attachments and links — because most malware relies on a user action to take hold.',
    obligations: [
      'Deploy and maintain anti-malware protection',
      'Support technical controls with user awareness of malware delivery',
      'Keep protection current and do not disable it'
    ],
    penalties: 'Not applicable as a statutory penalty; malware compromise is a leading incident type.',
    appliesTo: ['all staff', 'IT', 'endpoint teams'],
    topics: ['malware', 'anti-virus', 'awareness', 'phishing'],
    posterAngles: [
      'Do not open unexpected attachments or click unknown links',
      'Never disable your anti-malware protection',
      'Most malware needs one careless click — do not give it one'
    ]
  },
  {
    id: 'iso-a8-8',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.8',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.8 — Management of Technical Vulnerabilities',
    summary: 'Technical vulnerabilities must be identified, evaluated, and remediated in a timely way — including prompt patching.',
    text: 'Control A.8.8 requires obtaining information about technical vulnerabilities of systems in use, evaluating exposure, and taking appropriate measures such as patching. Attackers exploit known, unpatched flaws constantly, so timely vulnerability management is one of the highest-value technical controls.',
    obligations: [
      'Identify and evaluate technical vulnerabilities in systems',
      'Apply patches and mitigations promptly based on risk',
      'Track remediation to completion'
    ],
    penalties: 'Not applicable as a statutory penalty; unpatched exploited flaws are a top breach cause.',
    appliesTo: ['IT', 'DevOps', 'security', 'all staff (updates)'],
    topics: ['vulnerability management', 'patching', 'updates'],
    posterAngles: [
      'Install updates promptly — patches close the doors attackers use',
      'Do not defer security updates indefinitely',
      'An unpatched system is a known open door'
    ]
  },
  {
    id: 'iso-a8-12',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.12',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.12 — Data Leakage Prevention',
    summary: 'Measures must be applied to systems and networks to detect and prevent the unauthorised disclosure of sensitive information.',
    text: 'Control A.8.12 (new in 2022) requires data leakage prevention measures applied to systems, networks, and devices that process, store, or transmit sensitive information. This spans technical DLP tooling and user behaviour — not sending confidential data to personal accounts, unapproved cloud, or the wrong recipient.',
    obligations: [
      'Apply data leakage prevention to systems handling sensitive information',
      'Restrict channels through which sensitive data can leave',
      'Avoid sending confidential data to personal or unapproved destinations'
    ],
    penalties: 'Not applicable as a statutory penalty; leaks can breach privacy law and contracts.',
    appliesTo: ['all staff', 'security', 'IT'],
    topics: ['data leakage prevention', 'DLP', 'data exfiltration', 'confidentiality'],
    posterAngles: [
      'Never send work data to your personal email or cloud',
      'Double-check the recipient before sending sensitive files',
      'Use only approved tools to share confidential information'
    ]
  },
  {
    id: 'iso-a8-13',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.13',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.13 — Information Backup',
    summary: 'Backups of information, software, and systems must be maintained and tested to enable recovery.',
    text: 'Control A.8.13 requires backup copies of information, software, and systems to be maintained and regularly tested in accordance with an agreed backup policy. Reliable, tested backups are the last line of defence against ransomware, hardware failure, and accidental deletion — but only if restoration actually works.',
    obligations: [
      'Maintain backups per an agreed policy',
      'Test restoration regularly to confirm backups are usable',
      'Protect backups from the same threats as live data (e.g. ransomware)'
    ],
    penalties: 'Not applicable as a statutory penalty; unrecoverable data after an incident is a severe finding.',
    appliesTo: ['IT', 'operations', 'security'],
    topics: ['backup', 'recovery', 'ransomware resilience'],
    posterAngles: [
      'A backup you never test is a backup you cannot trust',
      'Tested backups are your best defence against ransomware',
      'Protect backups so an attacker cannot destroy them too'
    ]
  },
  {
    id: 'iso-a8-15',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.15',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.15 — Logging',
    summary: 'Logs of activities, exceptions, and security events must be produced, stored, protected, and reviewed.',
    text: 'Control A.8.15 requires logs recording activities, exceptions, faults, and other relevant events to be produced, stored, protected, and analysed. Good logs enable detection of and investigation into security incidents; protecting them from tampering keeps them trustworthy as evidence.',
    obligations: [
      'Produce and retain logs of relevant security events',
      'Protect logs from tampering and unauthorised access',
      'Review logs to detect anomalies and incidents'
    ],
    penalties: 'Not applicable as a statutory penalty; absent logs cripple investigation and are audit findings.',
    appliesTo: ['security operations', 'IT', 'engineering'],
    topics: ['logging', 'monitoring', 'audit trails'],
    posterAngles: [
      'Logs are the record of what happened — never disable them',
      'Unexplained activity in the logs deserves a closer look',
      'Trustworthy logs turn incidents into solved cases'
    ]
  },
  {
    id: 'iso-a8-16',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.16',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.16 — Monitoring Activities',
    summary: 'Networks, systems, and applications must be monitored for anomalous behaviour to detect potential incidents.',
    text: 'Control A.8.16 (new in 2022) requires networks, systems, and applications to be monitored for anomalous behaviour and appropriate actions taken to evaluate potential security incidents. Continuous monitoring shortens the time between compromise and detection — the metric that most determines breach impact.',
    obligations: [
      'Monitor networks, systems, and applications for anomalies',
      'Establish baselines and alert on deviations',
      'Investigate and act on potential incidents promptly'
    ],
    penalties: 'Not applicable as a statutory penalty; slow detection worsens breach outcomes.',
    appliesTo: ['security operations', 'IT', 'engineering'],
    topics: ['monitoring', 'anomaly detection', 'incident detection'],
    posterAngles: [
      'Faster detection means smaller breaches',
      'Report anything on your systems that looks out of the ordinary',
      'Monitoring never sleeps — and neither do attackers'
    ]
  },
  {
    id: 'iso-a8-24',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.24',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.24 — Use of Cryptography',
    summary: 'Rules for the effective use of cryptography, including key management, must be defined and applied to protect information.',
    text: 'Control A.8.24 requires rules for the effective use of cryptography — including cryptographic key management — to be defined and implemented. Encryption protects confidentiality and integrity in storage and transit, but only when strong algorithms are used and keys are managed securely across their lifecycle.',
    obligations: [
      'Define and apply rules for the use of cryptography',
      'Manage cryptographic keys securely across their lifecycle',
      'Use strong, current algorithms and protocols'
    ],
    penalties: 'Not applicable as a statutory penalty; weak crypto or key handling exposes data and is a finding.',
    appliesTo: ['engineering', 'security', 'cryptography/key custodians'],
    topics: ['cryptography', 'encryption', 'key management'],
    posterAngles: [
      'Encrypt sensitive data in storage and in transit',
      'Strong encryption is only as safe as its key handling',
      'Use approved cryptographic methods, not home-grown ones'
    ]
  },
  {
    id: 'iso-a8-28',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.28',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.28 — Secure Coding',
    summary: 'Secure coding principles must be applied to software development to prevent vulnerabilities being introduced.',
    text: 'Control A.8.28 (new in 2022) requires secure coding principles to be applied to software development. Following secure coding standards, validating input, managing dependencies, and reviewing code before release reduces the vulnerabilities that attackers exploit. Developer awareness is the human core of this control.',
    obligations: [
      'Apply secure coding standards throughout development',
      'Validate input and manage third-party components securely',
      'Review code for security flaws before release'
    ],
    penalties: 'Not applicable as a statutory penalty; insecure code that enables a breach is a serious finding.',
    appliesTo: ['engineering', 'developers', 'QA', 'DevOps'],
    topics: ['secure coding', 'application security', 'code review'],
    posterAngles: [
      'Validate every input — never trust external data',
      'Review code for security before it ships',
      'Secure coding stops vulnerabilities at the source'
    ]
  },
  {
    id: 'iso-a8-32',
    framework: 'ISO-27001',
    citation: 'ISO 27001 A.8.32',
    level: 0,
    region: 'GLOBAL',
    title: 'ISO 27001 A.8.32 — Change Management',
    summary: 'Changes to information-processing facilities and systems must follow controlled change management procedures.',
    text: 'Control A.8.32 requires changes to information-processing facilities and information systems to be subject to change management procedures. Uncontrolled changes are a frequent cause of outages and of security gaps opened by mistake. Reviewing, testing, and approving changes keeps security intact as systems evolve.',
    obligations: [
      'Subject system changes to formal change management',
      'Review and test changes for security impact before deployment',
      'Maintain records of changes and approvals'
    ],
    penalties: 'Not applicable as a statutory penalty; uncontrolled changes cause outages and are audit findings.',
    appliesTo: ['IT', 'DevOps', 'engineering', 'change managers'],
    topics: ['change management', 'security', 'configuration'],
    posterAngles: [
      'Follow change control — untested changes break things',
      'Assess the security impact before you deploy a change',
      'Record what changed, when, and who approved it'
    ]
  }
];
