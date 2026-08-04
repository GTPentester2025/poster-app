// NIST Cybersecurity Framework (CSF) 2.0 knowledge corpus — the voluntary
// framework published by the U.S. National Institute of Standards and
// Technology, organised around six Functions (GOVERN, IDENTIFY, PROTECT,
// DETECT, RESPOND, RECOVER) and their Categories/Subcategories. Entries are
// AUTHORITATIVE PARAPHRASE shaped for security-awareness posters.
//
// The CSF is a voluntary framework, not a law, so `penalties` is null except
// where non-adoption has contractual or regulatory-expectation consequences.
// Level 0 = framework text. Citations use CSF Function/Category/Subcategory IDs.

/** @type {object[]} */
export default [
  // ═══════════════ GOVERN (GV) ═══════════════
  {
    id: 'csf-gv',
    framework: 'NIST-CSF',
    citation: 'NIST CSF GOVERN',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF 2.0 — GOVERN Function',
    summary: 'GOVERN establishes and monitors the organisation\'s cybersecurity risk management strategy, expectations, and policy.',
    text: 'GOVERN, added as a full Function in CSF 2.0, sits at the centre of the framework. It covers how the organisation makes and monitors cybersecurity decisions: risk management strategy, roles and responsibilities, policy, oversight, and the integration of cybersecurity into enterprise risk management. It informs how the other five Functions are prioritised and resourced.',
    obligations: [
      'Establish a cybersecurity risk management strategy and policy',
      'Define roles, responsibilities, and authorities for cybersecurity',
      'Oversee and continually improve the cybersecurity program'
    ],
    penalties: null,
    appliesTo: ['executives', 'management', 'security governance', 'risk teams'],
    topics: ['governance', 'risk management strategy', 'policy', 'oversight'],
    posterAngles: [
      'Cybersecurity is a leadership decision, not just an IT task',
      'Clear roles and policy make security everyone\'s business',
      'Good governance sets the direction for all other controls'
    ]
  },
  {
    id: 'csf-gv-oc',
    framework: 'NIST-CSF',
    citation: 'NIST CSF GV.OC',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF GV.OC — Organizational Context',
    summary: 'Understand the mission, stakeholders, legal/regulatory requirements, and dependencies that shape cybersecurity risk decisions.',
    text: 'The Organizational Context Category ensures the organisation understands its mission, the expectations of stakeholders, applicable legal and regulatory requirements, and the critical dependencies that inform cybersecurity risk decisions. Security priorities flow from this context so effort is spent where it matters most.',
    obligations: [
      'Understand the organisational mission and stakeholder expectations',
      'Identify legal, regulatory, and contractual cybersecurity requirements',
      'Map critical dependencies that affect risk'
    ],
    penalties: null,
    appliesTo: ['management', 'compliance', 'risk teams', 'security governance'],
    topics: ['organizational context', 'governance', 'compliance', 'dependencies'],
    posterAngles: [
      'Security priorities follow the mission and its real risks',
      'Know the rules and expectations your work must meet',
      'Understand what your organisation depends on to operate'
    ]
  },
  {
    id: 'csf-gv-rr',
    framework: 'NIST-CSF',
    citation: 'NIST CSF GV.RR',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF GV.RR — Roles, Responsibilities, and Authorities',
    summary: 'Cybersecurity roles, responsibilities, and authorities must be established, communicated, and understood across the organisation.',
    text: 'The Roles, Responsibilities, and Authorities Category ensures cybersecurity responsibilities and authorities are established and communicated to foster accountability, performance assessment, and continuous improvement. Everyone from leadership to individual staff understands their part in managing cyber risk.',
    obligations: [
      'Establish and communicate cybersecurity roles and authorities',
      'Ensure staff understand their security responsibilities',
      'Hold roles accountable for cybersecurity outcomes'
    ],
    penalties: null,
    appliesTo: ['all staff', 'management', 'security'],
    topics: ['roles and responsibilities', 'accountability', 'governance'],
    posterAngles: [
      'Know your role in keeping the organisation secure',
      'Accountability makes security stick',
      'Everyone owns a piece of cyber risk'
    ]
  },
  {
    id: 'csf-gv-sc',
    framework: 'NIST-CSF',
    citation: 'NIST CSF GV.SC',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF GV.SC — Cybersecurity Supply Chain Risk Management',
    summary: 'Supply chain cybersecurity risks must be identified, prioritised, and managed with suppliers and partners.',
    text: 'The Cybersecurity Supply Chain Risk Management Category, elevated in CSF 2.0, addresses the risks introduced by suppliers, vendors, and third-party technology. It requires establishing supply chain risk processes, setting security expectations with suppliers, and monitoring those relationships throughout their lifecycle.',
    obligations: [
      'Establish cybersecurity supply chain risk management processes',
      'Set and communicate security requirements to suppliers',
      'Monitor supplier and third-party risk over time'
    ],
    penalties: null,
    appliesTo: ['procurement', 'vendor management', 'security', 'management'],
    topics: ['supply chain', 'third-party risk', 'governance'],
    posterAngles: [
      'A vendor\'s weakness can become your breach',
      'Set security expectations with suppliers up front',
      'Monitor third parties throughout the relationship'
    ]
  },
  {
    id: 'csf-gv-rm',
    framework: 'NIST-CSF',
    citation: 'NIST CSF GV.RM',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF GV.RM — Risk Management Strategy',
    summary: 'The organisation\'s priorities, constraints, risk tolerance, and assumptions must be established and used to support operational risk decisions.',
    text: 'The Risk Management Strategy Category requires that the organisation\'s cybersecurity risk management priorities, constraints, risk tolerance and appetite statements, and assumptions be established, communicated, and used to support operational risk decisions. A clear strategy ensures security investment and day-to-day decisions pull in the same direction rather than reacting ad hoc.',
    obligations: [
      'Establish and communicate cybersecurity risk tolerance and appetite',
      'Use the risk strategy to guide operational decisions',
      'Review and update the strategy as the risk landscape changes'
    ],
    penalties: null,
    appliesTo: ['management', 'risk teams', 'security governance'],
    topics: ['risk management strategy', 'risk tolerance', 'governance'],
    posterAngles: [
      'A clear risk strategy keeps security decisions consistent',
      'Know how much risk your organisation is willing to accept',
      'Strategy turns reactive security into deliberate choices'
    ]
  },
  // ═══════════════ IDENTIFY (ID) ═══════════════
  {
    id: 'csf-id',
    framework: 'NIST-CSF',
    citation: 'NIST CSF IDENTIFY',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF 2.0 — IDENTIFY Function',
    summary: 'IDENTIFY develops an understanding of the assets, risks, and dependencies that need protecting.',
    text: 'The IDENTIFY Function helps the organisation understand its current cybersecurity risks: what assets exist (data, systems, people, suppliers), what could go wrong, and what improvements are needed. You cannot protect, detect, or respond effectively without first knowing what you have and what threatens it.',
    obligations: [
      'Inventory assets, data, and dependencies',
      'Assess cybersecurity risks to the organisation',
      'Identify improvement opportunities'
    ],
    penalties: null,
    appliesTo: ['security', 'IT', 'risk teams', 'asset owners'],
    topics: ['asset management', 'risk assessment', 'identify'],
    posterAngles: [
      'You cannot protect what you have not identified',
      'Know your assets, data, and the risks to them',
      'Understanding risk is the first step to managing it'
    ]
  },
  {
    id: 'csf-id-am',
    framework: 'NIST-CSF',
    citation: 'NIST CSF ID.AM',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF ID.AM — Asset Management',
    summary: 'Assets — data, hardware, software, systems, people, and services — must be identified and managed consistent with their importance.',
    text: 'The Asset Management Category requires that assets (data, hardware, software, systems, facilities, services, and personnel) be identified and managed in a manner consistent with their relative importance to organisational objectives and risk strategy. A current inventory underpins nearly every other control.',
    obligations: [
      'Maintain inventories of hardware, software, data, and services',
      'Prioritise assets based on importance and risk',
      'Keep asset records current as the environment changes'
    ],
    penalties: null,
    appliesTo: ['IT', 'asset owners', 'security', 'all staff'],
    topics: ['asset management', 'inventory', 'data', 'identify'],
    posterAngles: [
      'Know what you have before you try to protect it',
      'Keep asset and data inventories up to date',
      'Unknown assets are unprotected assets'
    ]
  },
  {
    id: 'csf-id-ra',
    framework: 'NIST-CSF',
    citation: 'NIST CSF ID.RA',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF ID.RA — Risk Assessment',
    summary: 'Cybersecurity risks to the organisation, assets, and individuals must be understood through assessment.',
    text: 'The Risk Assessment Category requires the organisation to understand the cybersecurity risk to its operations, assets, and individuals. This includes identifying threats and vulnerabilities, determining likelihood and impact, and using the results to prioritise responses. Risk assessment turns uncertainty into informed decisions.',
    obligations: [
      'Identify threats and vulnerabilities affecting the organisation',
      'Determine the likelihood and impact of risks',
      'Prioritise and inform risk responses'
    ],
    penalties: null,
    appliesTo: ['risk teams', 'security', 'management'],
    topics: ['risk assessment', 'threats', 'vulnerabilities', 'identify'],
    posterAngles: [
      'Report risks you spot so they can be assessed',
      'Understanding threats lets us defend against them',
      'Risk assessment focuses effort where it matters'
    ]
  },
  {
    id: 'csf-id-im',
    framework: 'NIST-CSF',
    citation: 'NIST CSF ID.IM',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF ID.IM — Improvement',
    summary: 'Improvements to cybersecurity risk management must be identified from assessments, incidents, exercises, and lessons learned.',
    text: 'The Improvement Category, introduced in CSF 2.0, requires that improvements to the organisation\'s cybersecurity risk management processes, procedures, and activities be identified across all Functions. Inputs include evaluations, security tests, incidents, and exercises. This closes the loop so the program keeps getting stronger rather than stagnating.',
    obligations: [
      'Identify improvements from assessments, tests, incidents, and exercises',
      'Feed lessons learned back into processes and controls',
      'Track improvements through to implementation'
    ],
    penalties: null,
    appliesTo: ['security', 'management', 'risk teams', 'all staff'],
    topics: ['improvement', 'lessons learned', 'continual improvement', 'identify'],
    posterAngles: [
      'Every incident and exercise is a chance to improve',
      'Lessons learned should change how we work',
      'Security that never improves falls behind'
    ]
  },
  // ═══════════════ PROTECT (PR) ═══════════════
  {
    id: 'csf-pr',
    framework: 'NIST-CSF',
    citation: 'NIST CSF PROTECT',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF 2.0 — PROTECT Function',
    summary: 'PROTECT applies safeguards to manage cybersecurity risks and limit or contain the impact of potential events.',
    text: 'The PROTECT Function covers the safeguards used to manage cybersecurity risks: identity management and access control, awareness and training, data security, platform security, and the resilience of technology infrastructure. These controls prevent or limit the impact of adverse cybersecurity events.',
    obligations: [
      'Implement safeguards for identity, access, and data',
      'Provide awareness and training',
      'Maintain resilient, securely configured technology'
    ],
    penalties: null,
    appliesTo: ['all staff', 'IT', 'security'],
    topics: ['protect', 'safeguards', 'access control', 'data security'],
    posterAngles: [
      'Safeguards limit the damage when something goes wrong',
      'Protection is a shared, everyday responsibility',
      'Strong basics prevent most incidents'
    ]
  },
  {
    id: 'csf-pr-aa',
    framework: 'NIST-CSF',
    citation: 'NIST CSF PR.AA',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF PR.AA — Identity Management, Authentication, and Access Control',
    summary: 'Access to assets must be limited to authorised users, services, and devices and managed to the risk of unauthorised access.',
    text: 'The Identity Management, Authentication, and Access Control Category requires that access to physical and logical assets be limited to authorised users, services, and hardware, and managed commensurate with the risk of unauthorised access. It covers identity proofing, credential management, multi-factor authentication, and least-privilege access.',
    obligations: [
      'Issue and manage identities and credentials securely',
      'Authenticate users and devices (including MFA where warranted)',
      'Enforce least-privilege access to assets'
    ],
    penalties: null,
    appliesTo: ['all staff', 'identity teams', 'IT', 'security'],
    topics: ['access control', 'authentication', 'MFA', 'identity', 'least privilege'],
    posterAngles: [
      'Turn on MFA — a stolen password should not be enough',
      'Request only the access your role needs',
      'Never share your login credentials'
    ]
  },
  {
    id: 'csf-pr-at',
    framework: 'NIST-CSF',
    citation: 'NIST CSF PR.AT-01',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF PR.AT — Awareness and Training',
    summary: 'People must be provided cybersecurity awareness and training so they can perform their tasks securely.',
    text: 'The Awareness and Training Category requires that the organisation\'s personnel be provided with cybersecurity awareness and role-based training so they possess the knowledge and skills to perform their tasks with security in mind. Subcategory PR.AT-01 focuses on general awareness for all users; PR.AT-02 covers specialised, role-based training. People are a primary line of defence.',
    obligations: [
      'Provide general cybersecurity awareness to all personnel (PR.AT-01)',
      'Provide role-based training to those with specialised responsibilities (PR.AT-02)',
      'Keep training current with evolving threats'
    ],
    penalties: null,
    appliesTo: ['all staff', 'HR', 'security awareness team'],
    topics: ['awareness', 'training', 'human factor', 'protect'],
    posterAngles: [
      'Complete your security training — you are a line of defence',
      'Awareness turns knowledge into safe habits',
      'Stay trained as the threats keep changing'
    ]
  },
  {
    id: 'csf-pr-ds',
    framework: 'NIST-CSF',
    citation: 'NIST CSF PR.DS',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF PR.DS — Data Security',
    summary: 'Data must be managed to protect its confidentiality, integrity, and availability, at rest and in transit.',
    text: 'The Data Security Category requires that data be managed consistent with the organisation\'s risk strategy to protect confidentiality, integrity, and availability. This spans encryption of data at rest and in transit, protection against data leakage, and secure handling and disposal of information throughout its lifecycle.',
    obligations: [
      'Protect data confidentiality, integrity, and availability',
      'Encrypt data at rest and in transit as appropriate',
      'Handle and dispose of data securely across its lifecycle'
    ],
    penalties: null,
    appliesTo: ['all staff', 'engineering', 'IT', 'security'],
    topics: ['data security', 'encryption', 'confidentiality', 'protect'],
    posterAngles: [
      'Encrypt sensitive data at rest and in transit',
      'Handle data securely from creation to disposal',
      'Protect confidentiality, integrity, and availability together'
    ]
  },
  {
    id: 'csf-pr-ir',
    framework: 'NIST-CSF',
    citation: 'NIST CSF PR.IR',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF PR.IR — Technology Infrastructure Resilience',
    summary: 'Security architectures and infrastructure must be managed to protect asset resilience and availability.',
    text: 'The Technology Infrastructure Resilience Category requires that security architectures be managed with the organisation\'s risk strategy to protect asset confidentiality, integrity, and availability, and organisational resilience. It includes network protections, capacity management, and designing systems to withstand and recover from adverse events.',
    obligations: [
      'Design and manage resilient security architecture',
      'Protect network and infrastructure availability',
      'Build in capacity and fault tolerance to withstand disruption'
    ],
    penalties: null,
    appliesTo: ['IT', 'network engineering', 'security', 'architecture'],
    topics: ['resilience', 'infrastructure', 'availability', 'protect'],
    posterAngles: [
      'Resilient systems keep working when trouble hits',
      'Design for failure so one fault does not cascade',
      'Availability is a security property too'
    ]
  },
  {
    id: 'csf-pr-ps',
    framework: 'NIST-CSF',
    citation: 'NIST CSF PR.PS',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF PR.PS — Platform Security',
    summary: 'Hardware, software, and services must be managed securely — configured, patched, and monitored throughout their lifecycle.',
    text: 'The Platform Security Category requires that the hardware, software (firmware, operating systems, applications), and services of physical and virtual platforms be managed consistent with risk to preserve confidentiality, integrity, and availability. This includes secure configuration, patch/update management, and logging of platform activity.',
    obligations: [
      'Configure platforms securely and manage changes',
      'Apply software and firmware updates promptly',
      'Log and monitor platform activity'
    ],
    penalties: null,
    appliesTo: ['IT', 'DevOps', 'engineering', 'all staff (updates)'],
    topics: ['platform security', 'configuration', 'patching', 'protect'],
    posterAngles: [
      'Install updates — patched platforms resist known attacks',
      'Secure configuration shrinks the attack surface',
      'Do not defer critical security updates'
    ]
  },
  // ═══════════════ DETECT (DE) ═══════════════
  {
    id: 'csf-de',
    framework: 'NIST-CSF',
    citation: 'NIST CSF DETECT',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF 2.0 — DETECT Function',
    summary: 'DETECT finds and analyses possible cybersecurity attacks and compromises in a timely way.',
    text: 'The DETECT Function enables the timely discovery and analysis of anomalies, indicators of compromise, and other potentially adverse events. Fast, accurate detection is what shortens the gap between an intruder getting in and the organisation noticing — the single biggest driver of how bad a breach becomes.',
    obligations: [
      'Continuously monitor assets for anomalies and indicators of compromise',
      'Analyse detected events to understand their significance',
      'Support timely response through effective detection'
    ],
    penalties: null,
    appliesTo: ['security operations', 'IT', 'all staff (reporting)'],
    topics: ['detect', 'monitoring', 'anomaly detection'],
    posterAngles: [
      'Faster detection means a smaller breach',
      'Report anything unusual — you help detection work',
      'The sooner we spot an attack, the sooner we stop it'
    ]
  },
  {
    id: 'csf-de-cm',
    framework: 'NIST-CSF',
    citation: 'NIST CSF DE.CM',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF DE.CM — Continuous Monitoring',
    summary: 'Assets must be monitored continuously to find anomalies, indicators of compromise, and other adverse events.',
    text: 'The Continuous Monitoring Category requires that assets be monitored to find anomalies, indicators of compromise, and other potentially adverse events. This covers networks, physical environment, personnel activity, external service providers, and computing hardware and software — all watched for signs of trouble so response can begin quickly.',
    obligations: [
      'Monitor networks, systems, and environments continuously',
      'Detect anomalies and indicators of compromise',
      'Watch external service providers and personnel activity for adverse events'
    ],
    penalties: null,
    appliesTo: ['security operations', 'IT', 'all staff'],
    topics: ['continuous monitoring', 'anomaly detection', 'detect'],
    posterAngles: [
      'Monitoring never sleeps — and neither do attackers',
      'Unusual activity? Escalate it fast',
      'Continuous watch catches threats early'
    ]
  },
  {
    id: 'csf-de-ae',
    framework: 'NIST-CSF',
    citation: 'NIST CSF DE.AE',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF DE.AE — Adverse Event Analysis',
    summary: 'Anomalies and events must be analysed to characterise them and detect cybersecurity incidents.',
    text: 'The Adverse Event Analysis Category requires that anomalies, indicators of compromise, and other potentially adverse events be analysed to characterise the events and detect cybersecurity incidents. Correlating information across sources helps distinguish real incidents from noise and understand their scope and impact.',
    obligations: [
      'Analyse and correlate detected events across sources',
      'Characterise events to determine if they are incidents',
      'Estimate the scope and impact of confirmed incidents'
    ],
    penalties: null,
    appliesTo: ['security operations', 'incident response', 'IT'],
    topics: ['event analysis', 'incident detection', 'detect'],
    posterAngles: [
      'Connecting the dots turns alerts into real detection',
      'Not every alert is an incident — analysis tells them apart',
      'Understanding scope guides the right response'
    ]
  },
  // ═══════════════ RESPOND (RS) ═══════════════
  {
    id: 'csf-rs',
    framework: 'NIST-CSF',
    citation: 'NIST CSF RESPOND',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF 2.0 — RESPOND Function',
    summary: 'RESPOND takes action on detected cybersecurity incidents to contain their effects.',
    text: 'The RESPOND Function supports the ability to contain the effects of cybersecurity incidents. It includes incident management, analysis, mitigation, reporting, and communication. A prepared, practised response limits damage, preserves evidence, and gets the organisation to recovery faster.',
    obligations: [
      'Execute the incident response plan when an incident is detected',
      'Contain and mitigate the incident',
      'Communicate and report as required internally and externally'
    ],
    penalties: null,
    appliesTo: ['incident response', 'security', 'management', 'all staff (reporting)'],
    topics: ['respond', 'incident response', 'containment'],
    posterAngles: [
      'A practised response limits the damage',
      'Report incidents fast so response can begin',
      'Know your part when an incident is declared'
    ]
  },
  {
    id: 'csf-rs-ma',
    framework: 'NIST-CSF',
    citation: 'NIST CSF RS.MA',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF RS.MA — Incident Management',
    summary: 'Responses to detected incidents must be managed through an established, executed, and coordinated process.',
    text: 'The Incident Management Category requires that responses to detected cybersecurity incidents be managed: the incident response plan is executed once an incident is declared, incidents are triaged and categorised, and response actions are coordinated with internal and external stakeholders. Structured management keeps a stressful situation under control.',
    obligations: [
      'Execute the incident response plan when an incident is declared',
      'Triage, categorise, and prioritise incidents',
      'Coordinate response with relevant stakeholders'
    ],
    penalties: null,
    appliesTo: ['incident response', 'security', 'management'],
    topics: ['incident management', 'response coordination', 'respond'],
    posterAngles: [
      'A clear plan turns chaos into coordinated response',
      'Triage first: know what you are dealing with',
      'Coordinated response beats scattered heroics'
    ]
  },
  {
    id: 'csf-rs-an',
    framework: 'NIST-CSF',
    citation: 'NIST CSF RS.AN',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF RS.AN — Incident Analysis',
    summary: 'Investigation must be performed to ensure effective response and support recovery and forensics.',
    text: 'The Incident Analysis Category requires investigation to ensure effective response and to support recovery activities and forensics. Understanding how an incident happened, what it affected, and its root cause is essential both to contain it correctly and to prevent recurrence.',
    obligations: [
      'Investigate incidents to determine cause and impact',
      'Preserve evidence to support forensics',
      'Use findings to guide response and recovery'
    ],
    penalties: null,
    appliesTo: ['incident response', 'security', 'forensics'],
    topics: ['incident analysis', 'forensics', 'respond'],
    posterAngles: [
      'Understanding the how prevents the next incident',
      'Preserve evidence — do not destroy the trail',
      'Good analysis guides the right containment'
    ]
  },
  {
    id: 'csf-rs-co',
    framework: 'NIST-CSF',
    citation: 'NIST CSF RS.CO',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF RS.CO — Incident Response Reporting and Communication',
    summary: 'Response activities must be coordinated with internal and external stakeholders as required by laws, regulations, and policy.',
    text: 'The Incident Response Reporting and Communication Category requires coordinating response activities with internal and external stakeholders — including notifying authorities, partners, and affected parties as required by laws, regulations, or policy. Clear, timely communication maintains trust and meets legal obligations during an incident.',
    obligations: [
      'Notify internal and external stakeholders per policy and law',
      'Coordinate communication throughout the response',
      'Meet regulatory reporting obligations on time'
    ],
    penalties: null,
    appliesTo: ['incident response', 'legal', 'communications', 'management'],
    topics: ['incident communication', 'reporting', 'respond'],
    posterAngles: [
      'Timely, honest communication maintains trust in a crisis',
      'Know who must be notified and when',
      'Missing a reporting deadline can compound an incident'
    ]
  },
  // ═══════════════ RECOVER (RC) ═══════════════
  {
    id: 'csf-rc',
    framework: 'NIST-CSF',
    citation: 'NIST CSF RECOVER',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF 2.0 — RECOVER Function',
    summary: 'RECOVER restores assets and operations affected by a cybersecurity incident to reduce its impact.',
    text: 'The RECOVER Function supports timely restoration of assets and operations affected by a cybersecurity incident. It covers recovery planning and execution, and communication during recovery. Effective recovery returns the organisation to normal operations while ensuring the threat is fully removed and lessons are captured.',
    obligations: [
      'Execute recovery plans to restore affected systems and data',
      'Verify integrity of restored assets before returning to service',
      'Communicate recovery status to stakeholders'
    ],
    penalties: null,
    appliesTo: ['IT', 'operations', 'incident response', 'management'],
    topics: ['recover', 'restoration', 'business continuity'],
    posterAngles: [
      'Recovery gets us back to normal — safely',
      'Verify systems are clean before bringing them back',
      'Tested recovery plans turn disasters into setbacks'
    ]
  },
  {
    id: 'csf-rc-rp',
    framework: 'NIST-CSF',
    citation: 'NIST CSF RC.RP',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF RC.RP — Incident Recovery Plan Execution',
    summary: 'Recovery activities must be performed to ensure operational availability of systems and services affected by an incident.',
    text: 'The Incident Recovery Plan Execution Category requires that recovery activities be performed to restore the operational availability of affected systems and services. This includes executing the recovery portion of the incident response plan, restoring from verified backups, confirming integrity, and prioritising the most critical functions first.',
    obligations: [
      'Execute the recovery plan for affected systems and services',
      'Restore from verified, integrity-checked backups',
      'Prioritise recovery of the most critical functions'
    ],
    penalties: null,
    appliesTo: ['IT', 'operations', 'incident response'],
    topics: ['recovery planning', 'backups', 'restoration', 'recover'],
    posterAngles: [
      'Restore from clean, verified backups — not the compromised ones',
      'Bring back the most critical systems first',
      'A tested recovery plan speeds the return to normal'
    ]
  },
  {
    id: 'csf-rc-co',
    framework: 'NIST-CSF',
    citation: 'NIST CSF RC.CO',
    level: 0,
    region: 'GLOBAL',
    title: 'NIST CSF RC.CO — Incident Recovery Communication',
    summary: 'Restoration activities must be coordinated with internal and external parties during recovery.',
    text: 'The Incident Recovery Communication Category requires that restoration activities be coordinated with internal and external parties. Keeping stakeholders — staff, customers, partners, and authorities — informed of recovery progress manages expectations, maintains trust, and ensures a coordinated return to normal operations.',
    obligations: [
      'Coordinate recovery communication with internal and external parties',
      'Keep stakeholders informed of recovery progress',
      'Confirm normal operations have resumed'
    ],
    penalties: null,
    appliesTo: ['communications', 'management', 'incident response', 'IT'],
    topics: ['recovery communication', 'stakeholders', 'recover'],
    posterAngles: [
      'Keep people informed as systems come back online',
      'Coordinated communication rebuilds trust after an incident',
      'Tell stakeholders clearly when normal service resumes'
    ]
  }
];
