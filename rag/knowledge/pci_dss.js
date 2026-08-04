// PCI DSS v4.0 knowledge corpus — the Payment Card Industry Data Security
// Standard, mandated by the card brands (Visa, Mastercard, Amex, Discover, JCB)
// for any entity that stores, processes, or transmits cardholder data. Entries
// are AUTHORITATIVE PARAPHRASE of the 12 core requirements plus high-value
// sub-controls, shaped for security-awareness posters. Level 0 = standard text.
//
// PCI DSS is a contractual standard, not a law, so `penalties` reflects
// acquirer fines, increased transaction fees, or loss of card-processing
// privileges rather than statutory penalties.

/** @type {import('./schema.js').validateEntry extends any ? object[] : never} */
export default [
  // ── Requirement 1 — Network security controls ──
  {
    id: 'pci-req1',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 1',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 1 — Install and Maintain Network Security Controls',
    summary: 'Firewalls and other network security controls must be configured to restrict traffic between untrusted networks and any system that touches cardholder data.',
    text: 'Requirement 1 mandates network security controls (NSCs) such as firewalls and routers that govern traffic into and out of the cardholder data environment (CDE). Only explicitly authorised traffic is permitted; everything else is denied by default. Configuration standards must be documented, reviewed at least every six months, and changes managed through a formal process.',
    obligations: [
      'Restrict inbound and outbound traffic to the cardholder data environment to only what is necessary',
      'Deny all other traffic by default',
      'Document network security control rulesets and review them at least every six months',
      'Never connect a system holding cardholder data directly to an untrusted network without protection'
    ],
    penalties: 'Non-compliance can trigger acquirer fines, higher transaction fees, mandatory forensic audits, or suspension of card-processing privileges.',
    appliesTo: ['IT', 'network engineering', 'security', 'all cardholder-data systems'],
    topics: ['network security', 'firewalls', 'segmentation', 'cardholder data environment'],
    posterAngles: [
      'Only approved traffic reaches systems that handle card data — everything else is blocked',
      'Never plug a payment system straight into an open network',
      'Report any device that bypasses the firewall to reach card systems'
    ]
  },
  // ── Requirement 2 — Secure configurations ──
  {
    id: 'pci-req2',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 2',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 2 — Apply Secure Configurations to All System Components',
    summary: 'Vendor default passwords and settings must be changed, and every system component must be hardened before it goes live.',
    text: 'Requirement 2 forbids shipping systems with vendor-supplied defaults. Default accounts and passwords must be changed or disabled, unnecessary services and functions removed, and each component configured to a documented hardening standard aligned with industry benchmarks. This shrinks the attack surface an intruder can exploit.',
    obligations: [
      'Change or disable all vendor default passwords and accounts before deployment',
      'Remove or disable unnecessary services, ports, and functionality',
      'Apply documented secure-configuration (hardening) standards to every component',
      'Manage wireless and other default settings that could expose the environment'
    ],
    penalties: 'Contractual acquirer fines and remediation costs; a system left on defaults is a common breach root cause cited in card-brand penalties.',
    appliesTo: ['IT', 'system administration', 'security', 'anyone provisioning hardware or software'],
    topics: ['secure configuration', 'default passwords', 'hardening', 'attack surface'],
    posterAngles: [
      'Change every default password before a system goes live',
      'Turn off services and ports you do not need',
      'A factory-default device is an open door — harden it first'
    ]
  },
  // ── Requirement 3 — Protect stored account data ──
  {
    id: 'pci-req3',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 3',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 3 — Protect Stored Account Data',
    summary: 'Store the minimum cardholder data necessary, keep it only as long as needed, and render it unreadable wherever it is stored.',
    text: 'Requirement 3 limits storage of account data to genuine business need and mandates that stored data be rendered unreadable through strong cryptography, truncation, tokenisation, or hashing. Sensitive authentication data (the full magnetic stripe, CVV/CVC, and PIN block) must never be retained after authorisation, even if encrypted.',
    obligations: [
      'Keep account-data storage to the minimum required and define retention/disposal policies',
      'Render the primary account number (PAN) unreadable everywhere it is stored',
      'Never store sensitive authentication data (full track, card verification code, or PIN) after authorisation',
      'Mask the PAN when displayed so only those with a business need see more than the first six/last four digits'
    ],
    penalties: 'Storing prohibited authentication data is one of the most heavily penalised violations; fines, forced re-validation, and loss of processing rights can follow.',
    appliesTo: ['engineering', 'data/database teams', 'support', 'anyone storing or viewing card data'],
    topics: ['data protection', 'encryption at rest', 'data retention', 'tokenisation', 'PAN masking'],
    posterAngles: [
      'Never store the CVV or full magnetic stripe after a payment is approved',
      'If you do not need card data, do not keep it',
      'Card numbers must be encrypted or masked wherever they live'
    ]
  },
  {
    id: 'pci-req3-cvv',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 3.3',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 3.3 — Never Retain Sensitive Authentication Data',
    summary: 'The CVV/CVC, full track data, and PIN must be deleted immediately after a transaction is authorised — never written to logs, tickets, or spreadsheets.',
    text: 'Sub-requirement 3.3 specifically prohibits retaining sensitive authentication data (SAD) after authorisation, regardless of encryption. This includes the card verification code printed on the card, the full contents of the magnetic stripe or chip, and PIN/PIN block data. SAD frequently leaks into debug logs, support emails, and screenshots, which is why this control is emphasised in awareness training.',
    obligations: [
      'Delete CVV/CVC, track data, and PINs as soon as a transaction is authorised',
      'Never paste card verification codes into tickets, chats, emails, or logs',
      'Scrub application and debug logs so they never capture authentication data'
    ],
    penalties: 'A prohibited-storage finding typically forces immediate remediation and can void a merchant\'s safe-harbour standing during a breach.',
    appliesTo: ['support', 'engineering', 'QA', 'anyone who handles a card transaction'],
    topics: ['sensitive authentication data', 'CVV', 'logging hygiene', 'data protection'],
    posterAngles: [
      'The 3-digit code on the back of a card must never be saved',
      'Do not paste card details into a support ticket or chat',
      'Check logs never capture CVV or PIN data'
    ]
  },
  // ── Requirement 4 — Encrypt transmission ──
  {
    id: 'pci-req4',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 4',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 4 — Protect Cardholder Data With Strong Cryptography During Transmission',
    summary: 'Cardholder data sent across open or public networks must be encrypted with strong, up-to-date cryptography.',
    text: 'Requirement 4 mandates strong cryptography (e.g. current TLS) whenever the primary account number is transmitted over open, public networks such as the internet, wireless, or cellular links. Certificates must be valid and trusted, weak protocols and ciphers disabled, and the PAN never sent unprotected via end-user messaging technologies like email, SMS, or chat.',
    obligations: [
      'Encrypt PAN transmission over open/public networks with strong, current cryptography',
      'Use only trusted keys and valid certificates; disable weak protocols and cipher suites',
      'Never send an unprotected PAN by email, SMS, instant message, or other end-user messaging'
    ],
    penalties: 'Transmitting card data in the clear is a direct violation leading to acquirer fines and mandatory remediation.',
    appliesTo: ['engineering', 'network teams', 'support', 'sales'],
    topics: ['encryption in transit', 'TLS', 'secure transmission', 'messaging hygiene'],
    posterAngles: [
      'Never email or text a full card number',
      'Card data must travel encrypted, never in plain text',
      'If a customer emails their card number, do not store it — follow the secure process'
    ]
  },
  // ── Requirement 5 — Malware protection ──
  {
    id: 'pci-req5',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 5',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 5 — Protect All Systems and Networks From Malicious Software',
    summary: 'Anti-malware protection must be deployed, kept current, and actively running on systems at risk of malware.',
    text: 'Requirement 5 requires anti-malware solutions on systems commonly affected by malware, kept current through automatic updates, performing periodic or continuous scans, and generating audit logs. Systems evaluated as not at risk must be periodically re-assessed. Anti-malware mechanisms must be protected so users cannot disable or alter them without authorisation.',
    obligations: [
      'Deploy and maintain current anti-malware on systems at risk',
      'Keep signatures and engines updated automatically',
      'Prevent users from disabling or altering anti-malware protection',
      'Guard against phishing and other malware delivery paths'
    ],
    penalties: 'Contractual fines and remediation if malware controls are absent or disabled during an incident.',
    appliesTo: ['IT', 'endpoint teams', 'all staff using workstations'],
    topics: ['anti-malware', 'endpoint protection', 'phishing', 'updates'],
    posterAngles: [
      'Never turn off your anti-virus to run something faster',
      'Let security updates install — do not defer them indefinitely',
      'Report a workstation whose protection looks disabled'
    ]
  },
  // ── Requirement 6 — Secure software & patching ──
  {
    id: 'pci-req6',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 6',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 6 — Develop and Maintain Secure Systems and Software',
    summary: 'Software must be developed securely and all systems kept patched, with critical security fixes applied promptly.',
    text: 'Requirement 6 covers secure development practices and vulnerability management. Security patches must be installed within a defined timeframe — critical and high-risk patches typically within one month of release. Bespoke and custom software must be developed following secure coding practices that address common vulnerabilities (injection, broken access control, etc.), and public-facing web applications protected against attack.',
    obligations: [
      'Track vulnerabilities and rank them by risk',
      'Install critical/high-severity security patches within one month of release',
      'Follow secure coding practices and review code for vulnerabilities before release',
      'Protect public-facing web applications with automated technical solutions or reviews'
    ],
    penalties: 'Unpatched, exploited vulnerabilities are a leading breach cause and draw acquirer fines and forensic-audit costs.',
    appliesTo: ['engineering', 'DevOps', 'IT', 'application owners'],
    topics: ['patch management', 'secure coding', 'vulnerability management', 'web application security'],
    posterAngles: [
      'Apply critical patches fast — attackers race to exploit known holes',
      'Build security in: validate input and review code before shipping',
      'An unpatched system is an unlocked door'
    ]
  },
  {
    id: 'pci-req6-inject',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 6.2',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 6.2 — Secure Coding for Bespoke and Custom Software',
    summary: 'Developers must be trained in secure coding and eliminate common vulnerabilities like injection and broken access control before code ships.',
    text: 'Sub-requirement 6.2 requires that custom software be developed securely: developers receive annual secure-coding training relevant to their languages, code is reviewed (manually or with tools) before release, and prevalent flaws — injection, insecure cryptographic storage, improper error handling, broken access control, and business-logic abuse — are addressed. This is where developer awareness directly reduces breach risk.',
    obligations: [
      'Train developers at least annually in secure coding for the technologies they use',
      'Review bespoke code for vulnerabilities before it goes to production',
      'Design out injection, broken access control, and insecure data handling'
    ],
    penalties: 'Insecure code that enables a breach draws contractual penalties and forced remediation.',
    appliesTo: ['engineering', 'application developers', 'QA'],
    topics: ['secure coding', 'code review', 'injection', 'developer training'],
    posterAngles: [
      'Validate every input — never trust data from outside your app',
      'Get a second pair of eyes on code before it ships',
      'Secure coding training is not optional — it is a PCI requirement'
    ]
  },
  // ── Requirement 7 — Least privilege ──
  {
    id: 'pci-req7',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 7',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 7 — Restrict Access to System Components and Cardholder Data by Need to Know',
    summary: 'Access to cardholder data and systems must be granted strictly on a need-to-know, least-privilege basis and denied by default.',
    text: 'Requirement 7 enforces least privilege: access rights are assigned based on job function and business need, default to deny-all, and are approved by authorised personnel. Access is managed through a role-based system and reviewed periodically so that privileges do not accumulate beyond what a role requires.',
    obligations: [
      'Grant access to cardholder data only where a job role genuinely needs it',
      'Default all access to deny-all until explicitly authorised',
      'Assign privileges by role and require documented approval',
      'Review access rights periodically and remove excess privilege'
    ],
    penalties: 'Excessive access that contributes to a breach draws acquirer fines and remediation requirements.',
    appliesTo: ['IT', 'identity/access teams', 'managers who approve access', 'all staff'],
    topics: ['least privilege', 'need to know', 'access control', 'role-based access'],
    posterAngles: [
      'Ask only for the access your job actually needs',
      'Access to card data is need-to-know, not nice-to-have',
      'When someone changes roles, their old access should be removed'
    ]
  },
  // ── Requirement 8 — Authentication & MFA ──
  {
    id: 'pci-req8',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 8',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 8 — Identify Users and Authenticate Access to System Components',
    summary: 'Every user needs a unique ID and strong authentication; shared and generic accounts are prohibited for access to cardholder-data systems.',
    text: 'Requirement 8 mandates unique identification for every user so actions are traceable to an individual. Authentication must be strong — passwords/passphrases meeting minimum length and complexity, protected in storage and transit — and shared, group, or generic accounts are not permitted except tightly controlled service accounts. This is the foundation for accountability across the environment.',
    obligations: [
      'Assign every user a unique ID — no shared or group logins for card-data systems',
      'Enforce strong passwords/passphrases (minimum length and complexity) and periodic change or monitoring',
      'Protect authentication credentials in storage and transmission',
      'Manage service and application accounts under strict control'
    ],
    penalties: 'Shared credentials and weak authentication are common breach enablers and draw contractual penalties.',
    appliesTo: ['IT', 'identity teams', 'all staff with system logins'],
    topics: ['authentication', 'unique IDs', 'passwords', 'accountability'],
    posterAngles: [
      'Never share your login — every account is tied to one person',
      'Use a long, unique passphrase you have not used elsewhere',
      'Generic "admin/admin" accounts have no place in a payment system'
    ]
  },
  {
    id: 'pci-req8-mfa',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 8.3',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 8.4/8.5 — Multi-Factor Authentication for Access',
    summary: 'Multi-factor authentication is required for all access into the cardholder data environment and for all remote and administrative access.',
    text: 'PCI DSS v4.0 significantly expands MFA: it is required for all access into the cardholder data environment (not just administrative or remote access as before), and MFA systems must be resistant to replay and cannot be bypassed. At least two different factor types (something you know, have, or are) must be used, and success is required on all factors before access is granted.',
    obligations: [
      'Require MFA for all access into the cardholder data environment',
      'Require MFA for all remote network access and all administrative access',
      'Use at least two distinct factor types and prevent MFA bypass or replay'
    ],
    penalties: 'Missing MFA is a frequently cited breach factor; contractual fines and forced remediation follow.',
    appliesTo: ['all staff', 'administrators', 'remote workers', 'IT'],
    topics: ['multi-factor authentication', 'MFA', 'remote access', 'access control'],
    posterAngles: [
      'Turn on MFA — a stolen password alone should never grant access',
      'Approve MFA prompts only for logins you started',
      'MFA now guards every door into the card environment, not just the admin one'
    ]
  },
  // ── Requirement 9 — Physical access ──
  {
    id: 'pci-req9',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 9',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 9 — Restrict Physical Access to Cardholder Data',
    summary: 'Physical access to systems, media, and areas holding cardholder data must be controlled, with media handled and destroyed securely.',
    text: 'Requirement 9 protects the physical layer: controlled entry to sensitive areas, visitor identification and logging, secure handling and inventory of media containing cardholder data, and secure destruction of media (shredding, incineration, or wiping) when no longer needed. It also covers protecting point-of-interaction (POI) devices from tampering and substitution.',
    obligations: [
      'Control and log physical entry to areas containing cardholder data',
      'Identify and escort visitors; distinguish them from personnel',
      'Securely store, inventory, and destroy media holding cardholder data',
      'Inspect payment terminals (POI devices) for tampering or substitution'
    ],
    penalties: 'Physical exposure or skimming-device compromise leads to fines, forensic review, and card-brand scrutiny.',
    appliesTo: ['facilities', 'retail/front-line staff', 'operations', 'anyone in secure areas'],
    topics: ['physical security', 'media disposal', 'visitor control', 'device tampering'],
    posterAngles: [
      'Challenge tailgaters — do not hold the door for people you cannot verify',
      'Shred card-data documents; never toss them in the bin',
      'Inspect card terminals for tampering or swapped devices'
    ]
  },
  // ── Requirement 10 — Logging & monitoring ──
  {
    id: 'pci-req10',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 10',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 10 — Log and Monitor All Access to System Components and Cardholder Data',
    summary: 'Access to systems and cardholder data must be logged, protected, reviewed, and retained so events can be reconstructed after an incident.',
    text: 'Requirement 10 mandates audit logs capturing who did what, when, and from where across the cardholder data environment. Logs must be protected from tampering, time-synchronised, reviewed (ideally with automated tooling) for anomalies, and retained for at least twelve months with the most recent three months readily available. Reliable logs are essential for detecting and investigating breaches.',
    obligations: [
      'Log all individual user access to cardholder data and administrative actions',
      'Protect logs from alteration and synchronise system clocks to a reliable time source',
      'Review logs (using automated mechanisms) to detect anomalies and suspicious activity',
      'Retain audit history at least 12 months, with 3 months immediately available'
    ],
    penalties: 'Absent or unreviewed logs hamper breach investigation and are commonly cited in card-brand penalty assessments.',
    appliesTo: ['security operations', 'IT', 'engineering', 'audit'],
    topics: ['logging', 'monitoring', 'audit trails', 'time synchronisation', 'log retention'],
    posterAngles: [
      'Logs are the flight recorder — never disable or edit them',
      'Unexplained access in the logs? Escalate it',
      'Good logs turn a mystery breach into a solved case'
    ]
  },
  // ── Requirement 11 — Security testing ──
  {
    id: 'pci-req11',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 11',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 11 — Test Security of Systems and Networks Regularly',
    summary: 'Systems must be scanned for vulnerabilities and penetration-tested regularly, with wireless and change-detection controls in place.',
    text: 'Requirement 11 requires ongoing security testing: internal and external vulnerability scans (external scans by an Approved Scanning Vendor) at least quarterly and after significant change, penetration testing at least annually, detection of unauthorised wireless access points, and change/tamper-detection mechanisms on critical files and payment pages. Testing validates that the other controls are actually working.',
    obligations: [
      'Run internal and external vulnerability scans at least quarterly and after significant changes',
      'Perform penetration testing at least annually and remediate exploitable findings',
      'Detect and respond to unauthorised wireless access points',
      'Use change- and tamper-detection on critical files and public-facing payment pages'
    ],
    penalties: 'Failing to test — and missing a vulnerability that is then exploited — leads to fines and mandatory forensic investigation.',
    appliesTo: ['security', 'IT', 'engineering', 'compliance'],
    topics: ['vulnerability scanning', 'penetration testing', 'wireless security', 'change detection'],
    posterAngles: [
      'Regular testing finds the holes before attackers do',
      'Report rogue Wi-Fi access points near payment systems',
      'A control you never test is a control you cannot trust'
    ]
  },
  // ── Requirement 12 — Security policy & awareness ──
  {
    id: 'pci-req12',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 12',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 12 — Support Information Security With Organisational Policies and Programs',
    summary: 'A documented security policy, risk assessment, and personnel program must govern how everyone protects cardholder data.',
    text: 'Requirement 12 ties the technical controls to people and process: a comprehensive, regularly reviewed information security policy; an annual risk assessment; acceptable-use policies for technologies; management of third-party service provider risk; and a security-awareness program. Every employee and contractor must understand their responsibility for protecting cardholder data.',
    obligations: [
      'Maintain and review an information security policy at least annually',
      'Perform a targeted risk analysis and manage third-party/service-provider risk',
      'Define acceptable use of technologies and enforce it',
      'Run a security-awareness program and require personnel to acknowledge their responsibilities'
    ],
    penalties: 'A weak or unenforced security program is a systemic finding that amplifies penalties after any incident.',
    appliesTo: ['all staff', 'management', 'HR', 'vendor management', 'compliance'],
    topics: ['security policy', 'risk assessment', 'third-party risk', 'security awareness'],
    posterAngles: [
      'Security is everyone\'s job — know your part in protecting card data',
      'Read and follow the acceptable-use policy, not just at onboarding',
      'Vendors handling card data must be held to the same standard you are'
    ]
  },
  {
    id: 'pci-req12-awareness',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 12.6',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 12.6 — Security Awareness Education',
    summary: 'Personnel must complete security-awareness training at hire and at least annually, covering current threats like phishing and social engineering.',
    text: 'Sub-requirement 12.6 requires a formal security-awareness program: staff are trained upon hire and at least once every twelve months, the program is reviewed periodically and updated to address new threats (notably phishing and social engineering), and personnel acknowledge that they have read and understood the security policy. Awareness is the human control that backstops every technical one.',
    obligations: [
      'Train personnel on security awareness at hire and at least annually',
      'Update training content to reflect current threats such as phishing and social engineering',
      'Have personnel formally acknowledge the security policy'
    ],
    penalties: 'Untrained staff who enable a compromise (e.g. via phishing) contribute to breach liability and card-brand scrutiny.',
    appliesTo: ['all staff', 'contractors', 'HR', 'security awareness team'],
    topics: ['security awareness', 'training', 'phishing', 'social engineering'],
    posterAngles: [
      'Finish your annual security training — attackers count on the untrained',
      'Phishing is the top way card data gets stolen — stay sharp',
      'Awareness is a control: your judgement backs up every firewall'
    ]
  },
  {
    id: 'pci-req12-incident',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 12.10',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 12.10 — Incident Response Readiness',
    summary: 'An incident response plan must exist, be tested, and be understood so a suspected card-data compromise triggers immediate, correct action.',
    text: 'Sub-requirement 12.10 requires a documented incident response plan that is reviewed and tested at least annually, with defined roles, escalation paths, and communication (including to acquirers and card brands). Designated personnel must be available around the clock, and staff must know how to report a suspected compromise quickly. Speed of response directly limits breach impact.',
    obligations: [
      'Maintain and test an incident response plan at least annually',
      'Define roles, escalation, and required notifications to acquirers and card brands',
      'Ensure staff know how to report a suspected compromise immediately'
    ],
    penalties: 'A slow or absent response worsens breach outcomes and can void safe-harbour protections, increasing fines.',
    appliesTo: ['security operations', 'incident response', 'all staff (reporting)', 'management'],
    topics: ['incident response', 'breach notification', 'escalation', 'reporting'],
    posterAngles: [
      'See a suspected card-data breach? Report it now, not later',
      'Know who to call the moment something looks wrong',
      'Fast reporting shrinks the damage of any incident'
    ]
  },
  // ── Additional high-value sub-controls ──
  {
    id: 'pci-scope-segmentation',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Scope & Segmentation',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Scope and Network Segmentation',
    summary: 'Properly segmenting the cardholder data environment from the rest of the network reduces PCI scope and shrinks the attack surface.',
    text: 'PCI DSS applies to all system components in or connected to the cardholder data environment. Network segmentation is not mandatory but is strongly recommended: isolating the CDE from the wider corporate network reduces the number of systems in scope, lowers cost, and limits how far an intruder can move. Segmentation must be validated periodically to confirm it is effective.',
    obligations: [
      'Define and document the cardholder data environment and everything connected to it',
      'Use segmentation to isolate the CDE where feasible and validate it periodically',
      'Never introduce a shortcut that bridges the CDE to untrusted networks'
    ],
    penalties: 'Scope errors that leave card systems exposed increase both breach likelihood and penalty severity.',
    appliesTo: ['network engineering', 'security', 'architecture', 'compliance'],
    topics: ['scope', 'segmentation', 'cardholder data environment', 'attack surface'],
    posterAngles: [
      'Keep payment systems walled off from the everyday network',
      'A bridge between the card zone and the open network breaks segmentation',
      'Less in scope means less to defend — segmentation helps everyone'
    ]
  },
  {
    id: 'pci-key-management',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 3.6/3.7',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Cryptographic Key Management',
    summary: 'Encryption keys that protect cardholder data must themselves be strongly protected, restricted to few custodians, and rotated per policy.',
    text: 'Requirements 3.6 and 3.7 govern the lifecycle of cryptographic keys used to protect stored account data: keys must be generated securely, stored in the fewest possible locations, restricted to the fewest custodians, protected against disclosure and misuse, rotated at defined cryptoperiods, and retired or replaced when integrity is suspected. Weak key management undermines otherwise strong encryption.',
    obligations: [
      'Restrict access to cryptographic keys to the fewest necessary custodians',
      'Store keys securely and separately from the data they protect',
      'Rotate keys at defined cryptoperiods and retire compromised keys',
      'Document and enforce key-management procedures'
    ],
    penalties: 'Poor key handling that exposes encrypted data effectively nullifies the encryption and draws contractual penalties.',
    appliesTo: ['security', 'cryptography/key custodians', 'engineering'],
    topics: ['key management', 'encryption', 'cryptoperiods', 'data protection'],
    posterAngles: [
      'A strong lock is useless if the key is left out — guard encryption keys',
      'Only trusted custodians should ever touch encryption keys',
      'Rotate keys on schedule; retire any key you suspect is exposed'
    ]
  },
  {
    id: 'pci-tokenization',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Tokenisation Guidance',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Tokenisation — Removing Card Data From Scope',
    summary: 'Replacing the primary account number with a token means systems handle a useless surrogate value instead of real card data.',
    text: 'Tokenisation substitutes the primary account number with a non-sensitive token that has no exploitable value outside the tokenisation system. Properly implemented, it removes systems that only ever see tokens from much of PCI scope and eliminates the risk that stolen data can be monetised. It is a recommended approach to minimise where genuine card data exists.',
    obligations: [
      'Prefer tokens over storing real primary account numbers wherever possible',
      'Ensure the token-to-PAN mapping (the token vault) is strongly protected',
      'Never treat a token as sensitive card data or vice versa without understanding your implementation'
    ],
    penalties: 'Mishandling the token vault — the one system that can reverse tokens — reintroduces full card-data risk and liability.',
    appliesTo: ['engineering', 'architecture', 'security', 'product'],
    topics: ['tokenisation', 'data minimisation', 'scope reduction', 'data protection'],
    posterAngles: [
      'A token is worthless to a thief — use tokens instead of real card numbers',
      'Protect the token vault like the crown jewels — it can reverse tokens',
      'Less real card data stored means less that can be stolen'
    ]
  },
  {
    id: 'pci-service-providers',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 12.8',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 12.8 — Managing Third-Party Service Provider Risk',
    summary: 'When you share cardholder data with vendors, you must vet them, agree responsibilities in writing, and monitor their PCI status.',
    text: 'Sub-requirement 12.8 addresses the extended enterprise: organisations must keep a list of service providers with whom cardholder data is shared, have written agreements acknowledging each provider\'s responsibility for the data they handle, perform due diligence before engagement, and monitor providers\' PCI DSS compliance status at least annually. Your compliance is only as strong as your vendors\'.',
    obligations: [
      'Maintain a list of service providers who handle cardholder data on your behalf',
      'Establish written agreements defining each provider\'s security responsibilities',
      'Perform due diligence before engaging providers and monitor their PCI status annually'
    ],
    penalties: 'A vendor breach involving your card data still exposes your organisation to fines and reputational harm.',
    appliesTo: ['vendor management', 'procurement', 'compliance', 'security'],
    topics: ['third-party risk', 'service providers', 'due diligence', 'supply chain'],
    posterAngles: [
      'A vendor handling card data must meet the same bar you do',
      'Get security responsibilities in writing before sharing card data',
      'Check your providers stay PCI compliant — every year'
    ]
  },
  {
    id: 'pci-poi-tamper',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 9.5',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Requirement 9.5 — Protect Payment Terminals From Tampering and Skimming',
    summary: 'Point-of-interaction devices must be inventoried and inspected regularly for tampering or substitution by skimmers.',
    text: 'Sub-requirement 9.5 protects payment terminals (point-of-interaction devices) that capture card data via physical interaction. Devices must be inventoried, periodically inspected for signs of tampering or unauthorised substitution, and staff trained to recognise suspicious behaviour such as unexpected "technicians" or devices that look altered. Skimming at the terminal is a common, low-tech attack.',
    obligations: [
      'Maintain an up-to-date inventory of payment terminals with serial numbers',
      'Inspect terminals periodically for tampering, overlays, or substitution',
      'Train front-line staff to spot skimmers and verify anyone servicing a device'
    ],
    penalties: 'A skimming compromise leads to card-brand investigation, fines, and remediation costs.',
    appliesTo: ['retail/front-line staff', 'operations', 'facilities', 'security'],
    topics: ['device tampering', 'skimming', 'physical security', 'point of interaction'],
    posterAngles: [
      'Inspect card readers daily — skimmers hide in plain sight',
      'Verify anyone claiming to service a payment terminal',
      'A terminal that looks altered or swapped — report it immediately'
    ]
  },
  {
    id: 'pci-remote-access',
    framework: 'PCI-DSS',
    citation: 'PCI DSS Req 8.5/12.3',
    level: 0,
    region: 'GLOBAL',
    title: 'PCI DSS Remote Access Security',
    summary: 'Remote access into card systems must use MFA, be enabled only when needed, and never expose the environment through insecure connections.',
    text: 'Remote access is a frequent breach entry point. PCI DSS requires MFA for all remote access, tight control of vendor/third-party remote access (enabled only when needed and monitored during use), and secure configuration of remote-access technologies. Home and public networks introduce added risk, so remote workers must follow approved, encrypted connection methods.',
    obligations: [
      'Require MFA for every remote connection into the environment',
      'Enable vendor remote access only when needed and monitor it during use',
      'Use only approved, encrypted remote-access methods — never ad hoc tools'
    ],
    penalties: 'Unsecured remote access is a leading breach vector and draws contractual penalties when exploited.',
    appliesTo: ['remote workers', 'IT', 'vendors', 'security'],
    topics: ['remote access', 'MFA', 'vendor access', 'secure connectivity'],
    posterAngles: [
      'Connect to work systems only through approved, encrypted channels',
      'Vendor remote access should be on only when it is actually needed',
      'A remote login without MFA is an open invitation'
    ]
  }
];
