// CERT-In Directions (2022) knowledge corpus — the cyber security directions
// issued by the Indian Computer Emergency Response Team (CERT-In) on 28 April
// 2022 under sub-section (6) of Section 70B of the Information Technology Act,
// 2000, effective from 27 June 2022. Entries are AUTHORITATIVE PARAPHRASE of
// the reporting and record-keeping duties, shaped for security-awareness posters.
//
// These Directions carry statutory force in India, so `penalties` references
// the consequences under Section 70B(7) of the IT Act. Region is IN.
// Level 0 = directive text.

/** @type {object[]} */
export default [
  {
    id: 'certin-overview',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022',
    level: 0,
    region: 'IN',
    title: 'CERT-In Directions 2022 — Overview and Legal Basis',
    summary: 'CERT-In issued binding cyber security directions in April 2022 under Section 70B(6) of the IT Act, 2000, setting mandatory incident-reporting, logging, and record-keeping duties for organisations operating in India.',
    text: 'On 28 April 2022 CERT-In issued directions under sub-section (6) of Section 70B of the Information Technology Act, 2000, effective 27 June 2022, to strengthen India\'s cyber security posture. The directions apply to service providers, intermediaries, data centres, body corporates, and government organisations, and impose specific obligations around incident reporting, time synchronisation, log retention, and record-keeping. They are legally binding, not advisory.',
    obligations: [
      'Comply with CERT-In directions if you operate systems or services in India',
      'Understand these are legally binding under the IT Act, not optional guidance',
      'Know which directions apply to your organisation\'s role'
    ],
    penalties: 'Non-compliance is punishable under Section 70B(7) of the IT Act, 2000, with imprisonment up to one year, a fine up to one lakh rupees, or both.',
    appliesTo: ['service providers', 'intermediaries', 'data centres', 'body corporates', 'government organisations'],
    topics: ['CERT-In', 'IT Act', 'compliance', 'India cyber security'],
    posterAngles: [
      'CERT-In directions are the law in India — not optional advice',
      'Know your organisation\'s duties under the 2022 directions',
      'These rules carry real penalties under the IT Act'
    ]
  },
  {
    id: 'certin-6hour',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 ¶(ii)',
    level: 0,
    region: 'IN',
    title: 'CERT-In — Mandatory 6-Hour Incident Reporting',
    summary: 'Cyber security incidents must be reported to CERT-In within six hours of noticing or being brought to notice of the incident.',
    text: 'The directions require that any organisation experiencing a cyber security incident of the specified types report it to CERT-In within six hours of noticing it or being made aware of it. Reports go through the channels CERT-In publishes (email, phone, or web portal). The tight six-hour window makes rapid internal detection and escalation essential — staff must know how to raise an incident immediately.',
    obligations: [
      'Report specified cyber security incidents to CERT-In within 6 hours of noticing them',
      'Use CERT-In\'s designated reporting channels (email, phone, or portal)',
      'Ensure internal escalation is fast enough to meet the 6-hour deadline'
    ],
    penalties: 'Failure to report within the mandated timeframe is non-compliance punishable under Section 70B(7) of the IT Act (up to one year imprisonment and/or fine up to one lakh rupees).',
    appliesTo: ['all staff', 'incident response', 'security', 'IT'],
    topics: ['incident reporting', '6-hour rule', 'CERT-In', 'compliance'],
    posterAngles: [
      'A reportable incident? CERT-In must be told within 6 hours',
      'Escalate suspected incidents immediately — the clock is short',
      'Know who raises the CERT-In report and how'
    ]
  },
  {
    id: 'certin-reportable-types',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 Annexure I',
    level: 0,
    region: 'IN',
    title: 'CERT-In — Types of Reportable Cyber Incidents',
    summary: 'A broad list of incident types — from data breaches and ransomware to phishing, unauthorised access, and attacks on critical systems — must be reported to CERT-In.',
    text: 'The directions specify a wide range of mandatorily reportable incidents, listed in Annexure I. These include targeted scanning/probing of critical systems, compromise of critical systems, unauthorised access to IT systems or data, defacement of websites, malicious code/ransomware attacks, data breaches and data leaks, attacks on servers and network appliances, identity theft, phishing, denial-of-service (DoS/DDoS) attacks, attacks on IoT devices, and incidents affecting cloud, applications, and digital payment systems. When in doubt, report.',
    obligations: [
      'Recognise the broad categories of reportable incidents (breach, ransomware, phishing, unauthorised access, DoS, etc.)',
      'Report any incident falling within CERT-In\'s specified types',
      'Escalate uncertain cases rather than assuming they are not reportable'
    ],
    penalties: 'Failing to report a qualifying incident is non-compliance under Section 70B(7) of the IT Act.',
    appliesTo: ['all staff', 'security', 'IT', 'incident response'],
    topics: ['reportable incidents', 'ransomware', 'phishing', 'data breach', 'CERT-In'],
    posterAngles: [
      'Breach, ransomware, phishing, DoS — all must be reported',
      'When unsure if an incident is reportable, escalate it',
      'Even attempted attacks on critical systems count'
    ]
  },
  {
    id: 'certin-log-retention',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 ¶(iv)',
    level: 0,
    region: 'IN',
    title: 'CERT-In — 180-Day Log Retention Within India',
    summary: 'Organisations must securely maintain ICT system logs for a rolling period of 180 days, and these logs must be kept within Indian jurisdiction.',
    text: 'The directions require all service providers, intermediaries, data centres, body corporates, and government organisations to enable logs of all their ICT systems and maintain them securely for a rolling period of 180 days. These logs are to be maintained within the Indian jurisdiction and must be provided to CERT-In along with any incident report or when ordered. Reliable, retained logs are essential for investigating incidents.',
    obligations: [
      'Enable and securely retain ICT system logs for a rolling 180 days',
      'Keep the logs within Indian jurisdiction',
      'Provide logs to CERT-In when reporting an incident or when directed'
    ],
    penalties: 'Failure to maintain or produce logs as directed is non-compliance under Section 70B(7) of the IT Act.',
    appliesTo: ['IT', 'security operations', 'data centre operators', 'service providers'],
    topics: ['log retention', '180 days', 'data localisation', 'CERT-In'],
    posterAngles: [
      'ICT logs must be kept for 180 days — do not purge them early',
      'Logs stay within India and go to CERT-In on request',
      'Never disable logging on systems in scope'
    ]
  },
  {
    id: 'certin-ntp-sync',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 ¶(iii)',
    level: 0,
    region: 'IN',
    title: 'CERT-In — Time Synchronisation to NIC/NPL NTP',
    summary: 'System clocks of all ICT systems must be synchronised to the Network Time Protocol servers of NIC or NPL, or a traceable equivalent.',
    text: 'The directions require all organisations to connect to the Network Time Protocol (NTP) servers of the National Informatics Centre (NIC) or the National Physical Laboratory (NPL), or to NTP servers traceable to these, for synchronising the clocks of all their ICT systems. Accurate, consistent timestamps are critical so that logs from different systems can be correlated reliably during an incident investigation.',
    obligations: [
      'Synchronise all ICT system clocks to NIC/NPL NTP servers or a traceable source',
      'Ensure timestamps across systems are consistent for log correlation',
      'Do not rely on unsynchronised or drifting clocks'
    ],
    penalties: 'Non-compliance with the time-synchronisation direction falls under Section 70B(7) of the IT Act.',
    appliesTo: ['IT', 'network engineering', 'system administration'],
    topics: ['time synchronisation', 'NTP', 'log correlation', 'CERT-In'],
    posterAngles: [
      'Sync system clocks to NIC/NPL — accurate time makes logs usable',
      'Unsynchronised clocks make incident investigation guesswork',
      'Consistent timestamps let logs tell one clear story'
    ]
  },
  {
    id: 'certin-poc',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 ¶(v)',
    level: 0,
    region: 'IN',
    title: 'CERT-In — Designated Point of Contact',
    summary: 'Organisations must designate a point of contact to interface with CERT-In and keep that information current.',
    text: 'The directions require organisations to designate a Point of Contact (PoC) to interface with CERT-In, providing the PoC\'s name and contact details in the prescribed format. Any change must be communicated to CERT-In as soon as possible. All communications and orders from CERT-In are sent to this designated contact, so keeping it current ensures directions and requests are received and acted on promptly.',
    obligations: [
      'Designate and register a Point of Contact with CERT-In',
      'Provide the PoC details in the prescribed format',
      'Update CERT-In promptly whenever the PoC changes'
    ],
    penalties: 'Failure to designate or maintain a valid PoC is non-compliance under Section 70B(7) of the IT Act.',
    appliesTo: ['security leadership', 'compliance', 'management'],
    topics: ['point of contact', 'CERT-In interface', 'compliance'],
    posterAngles: [
      'A designated contact must be registered with CERT-In',
      'Keep the CERT-In point of contact details up to date',
      'CERT-In orders go to the PoC — do not let it lapse'
    ]
  },
  {
    id: 'certin-kyc-vps',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 ¶(vi)',
    level: 0,
    region: 'IN',
    title: 'CERT-In — KYC and Records for VPS, Cloud, and VPN Providers',
    summary: 'Data centre, VPS, cloud, and VPN service providers must register and keep validated customer (KYC) and usage records for at least five years.',
    text: 'The directions require providers of Data Centre, Virtual Private Server (VPS), cloud, and Virtual Private Network (VPN) services to register and maintain accurate information about their subscribers/customers for a period of five years (or longer as mandated), even after a customer cancels or withdraws. Records include validated names, addresses, contact details, period of hire, IPs allotted, email/purpose of use, and ownership pattern. This supports investigation and attribution.',
    obligations: [
      'Register and validate customer KYC information (VPS, cloud, VPN, data centre providers)',
      'Maintain subscriber and usage records for at least five years',
      'Retain records even after a customer cancels the service'
    ],
    penalties: 'Failure to maintain the required records is non-compliance under Section 70B(7) of the IT Act.',
    appliesTo: ['VPS providers', 'cloud providers', 'VPN providers', 'data centre operators'],
    topics: ['KYC', 'record keeping', 'VPN', 'cloud', 'five-year retention', 'CERT-In'],
    posterAngles: [
      'VPS, cloud, and VPN providers must keep customer records for 5 years',
      'KYC records are retained even after a customer leaves',
      'Validated subscriber data supports investigation and attribution'
    ]
  },
  {
    id: 'certin-crypto-vasp',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 ¶(vii)',
    level: 0,
    region: 'IN',
    title: 'CERT-In — Records for Virtual Asset and Exchange Providers',
    summary: 'Virtual asset service providers, exchange providers, and custodian wallet providers must maintain KYC and transaction records for at least five years.',
    text: 'The directions require virtual asset service providers, virtual asset exchange providers, and custodian wallet providers to maintain all information obtained as part of Know Your Customer (KYC) and records of financial transactions for a period of five years, so as to ensure cyber security in the area of payments and financial markets. The records must enable reconstruction of individual transactions and support investigations.',
    obligations: [
      'Maintain KYC information for virtual asset customers',
      'Keep records of financial transactions for at least five years',
      'Ensure records can reconstruct individual transactions for investigations'
    ],
    penalties: 'Failure to maintain these records is non-compliance under Section 70B(7) of the IT Act.',
    appliesTo: ['virtual asset service providers', 'crypto exchanges', 'custodian wallet providers'],
    topics: ['virtual assets', 'KYC', 'transaction records', 'five-year retention', 'CERT-In'],
    posterAngles: [
      'Crypto and wallet providers must keep KYC and transaction records for 5 years',
      'Records must let regulators reconstruct individual transactions',
      'Financial-market cyber security depends on complete records'
    ]
  },
  {
    id: 'certin-info-on-order',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 ¶(i)',
    level: 0,
    region: 'IN',
    title: 'CERT-In — Duty to Provide Information and Assistance',
    summary: 'Organisations must provide information and take actions ordered by CERT-In for cyber incident response, protection, and analysis.',
    text: 'The directions require service providers, intermediaries, data centres, body corporates, and government organisations to mandatorily take action or provide information when directed by CERT-In, and to designate personnel to respond to CERT-In\'s orders seeking such information or assistance. This supports CERT-In\'s functions of cyber incident response, protective and preventive actions, and cyber security analysis.',
    obligations: [
      'Provide information and take actions when ordered by CERT-In',
      'Designate personnel to respond to CERT-In requests',
      'Cooperate with CERT-In\'s incident response and analysis functions'
    ],
    penalties: 'Failure to comply with a CERT-In order is non-compliance under Section 70B(7) of the IT Act.',
    appliesTo: ['security leadership', 'IT', 'compliance', 'management'],
    topics: ['information sharing', 'CERT-In orders', 'cooperation', 'compliance'],
    posterAngles: [
      'CERT-In can order information or action — cooperation is mandatory',
      'Have people ready to respond to CERT-In requests',
      'Assisting CERT-In helps protect the whole ecosystem'
    ]
  },
  {
    id: 'certin-noncompliance',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 / IT Act §70B(7)',
    level: 0,
    region: 'IN',
    title: 'CERT-In — Consequences of Non-Compliance',
    summary: 'Failure to comply with CERT-In directions is an offence under Section 70B(7) of the IT Act, punishable with imprisonment and/or fine.',
    text: 'Under Section 70B(7) of the Information Technology Act, 2000, any service provider, intermediary, data centre, body corporate, or person who fails to provide information called for or comply with a CERT-In direction may be punished with imprisonment for a term which may extend to one year, or with a fine which may extend to one lakh rupees, or with both. This gives the 2022 directions real legal teeth.',
    obligations: [
      'Treat CERT-In directions as legally binding obligations',
      'Understand that non-compliance carries criminal liability',
      'Build processes that reliably meet each direction'
    ],
    penalties: 'Imprisonment up to one year, a fine up to one lakh rupees, or both, under Section 70B(7) of the IT Act, 2000.',
    appliesTo: ['management', 'compliance', 'security leadership', 'all staff'],
    topics: ['non-compliance', 'penalties', 'IT Act', 'CERT-In'],
    posterAngles: [
      'Ignoring CERT-In directions can mean jail time and fines',
      'Compliance is not optional — it is the law',
      'Build processes that meet every CERT-In requirement'
    ]
  },
  {
    id: 'certin-phishing-report',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 Annexure I',
    level: 0,
    region: 'IN',
    title: 'CERT-In — Reporting Phishing and Fraudulent Communications',
    summary: 'Phishing attacks and fraudulent mobile/website/social-media impersonations are listed as reportable incidents under the directions.',
    text: 'Annexure I of the directions expressly lists phishing attacks and fake mobile apps, fraudulent websites, and unauthorised social media impersonations among reportable cyber incidents. Because phishing is the most common initial attack vector, employees who recognise and report phishing quickly play a direct role in meeting the reporting duty and protecting the organisation.',
    obligations: [
      'Recognise phishing, fake apps, and impersonation as reportable incidents',
      'Report suspected phishing promptly through internal channels',
      'Support the organisation\'s duty to report qualifying incidents to CERT-In'
    ],
    penalties: 'Failing to report qualifying phishing incidents contributes to non-compliance under Section 70B(7) of the IT Act.',
    appliesTo: ['all staff', 'security', 'IT'],
    topics: ['phishing', 'reportable incidents', 'impersonation', 'CERT-In'],
    posterAngles: [
      'Spotted a phishing email? Report it — it may be reportable to CERT-In',
      'Fake apps and impersonation are reportable incidents too',
      'Fast phishing reports help meet the 6-hour duty'
    ]
  },
  {
    id: 'certin-data-breach-report',
    framework: 'CERT-In',
    citation: 'CERT-In Directions 2022 Annexure I',
    level: 0,
    region: 'IN',
    title: 'CERT-In — Reporting Data Breaches and Data Leaks',
    summary: 'Data breaches and data leaks are explicitly reportable incidents that must reach CERT-In within the 6-hour window.',
    text: 'Data breaches and data leaks are named in Annexure I as mandatorily reportable cyber incidents. If personal or sensitive data is exposed, exfiltrated, or leaked, the organisation must report to CERT-In within six hours of noticing the incident, alongside preserving relevant logs. Prompt internal escalation from whoever first notices the exposure is what makes meeting this duty possible.',
    obligations: [
      'Treat data breaches and leaks as reportable within 6 hours',
      'Escalate any suspected data exposure immediately',
      'Preserve logs relevant to the breach for CERT-In'
    ],
    penalties: 'Failure to report a data breach within the mandated window is non-compliance under Section 70B(7) of the IT Act.',
    appliesTo: ['all staff', 'security', 'IT', 'incident response'],
    topics: ['data breach', 'data leak', 'incident reporting', 'CERT-In'],
    posterAngles: [
      'A data leak must reach CERT-In within 6 hours — escalate fast',
      'If you see data exposed, report it immediately',
      'Preserve the logs — do not clean up before investigation'
    ]
  }
];
