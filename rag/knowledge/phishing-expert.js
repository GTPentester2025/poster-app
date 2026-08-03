// Phishing deep expertise knowledge base — curated seed articles covering
// the full spectrum of modern phishing techniques, attack vectors, and
// employee defence strategies. Each article includes actionable watchouts
// that translate directly into awareness poster content.
//
// PHISHING_KEYWORDS: scoring keywords tuned for phishing content detection.
// PHISHING_PROMPT: system prompt addition for phishing-aware content synthesis.

const T1 = 1; // Tier 1: directly sourced expert knowledge

export const PHISHING_SEED = [
  // ══ SPEAR PHISHING ══
  {
    title: 'Spear Phishing — The Targeted Threat Every Employee Faces',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Spear phishing is a highly targeted form of phishing where attackers research specific individuals or organisations to craft personalised, convincing lures. Unlike mass phishing campaigns that cast a wide net with generic messages, spear phishing emails reference real colleagues, recent projects, internal tools, and even personal details gathered from social media. The attacker typically aims to steal credentials, initiate fraudulent wire transfers, or install malware. Every employee is a potential target — attackers research all levels, not just executives.',
    summary: 'Spear phishing uses personal research to craft targeted attacks that are far more convincing than generic phishing. All employees, at all levels, are potential targets.',
    watchouts: ['Be suspicious of unexpected emails referencing real projects or colleagues', 'Verify unusual requests through a different channel — call the person, don\'t reply to the email', 'Limit personal information on public social media profiles — attackers use it to build trust'],
    pubDate: '2024-08-01', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Spear Phishing Red Flags — What Makes a Targeted Email Suspicious',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Key spear phishing red flags: (1) Urgency — "need this done before the meeting in 10 minutes." (2) Unusual sender address that looks almost right (jdoe@company.co instead of jdoe@company.com). (3) Requests to bypass normal processes — "just this once, skip the approval." (4) References to personal information not widely known — attackers use this to build false intimacy. (5) Slightly off writing style — a colleague who normally writes informally suddenly sends formal business language.',
    summary: 'Spear phishing has five key red flags: artificial urgency, near-miss sender addresses, process bypass requests, personal info references, and inconsistent writing style.',
    watchouts: ['Check sender addresses character by character — small differences matter', 'Never bypass normal processes because an email claims urgency', 'If the writing style feels wrong, verify through a separate channel'],
    pubDate: '2024-08-02', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Spear Phishing Research: How Attackers Gather Intel on You',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Spear phishers gather intelligence from multiple sources before launching an attack: LinkedIn profiles reveal job titles, colleagues, projects, and tenure; company websites and press releases show upcoming events, new tools, and organisational structure; social media posts disclose travel plans, work frustrations, and personal interests; data broker sites aggregate contact details and family information; and previous data breaches provide email addresses and password patterns. Every piece of public information makes a spear phishing email more convincing.',
    summary: 'Attackers use LinkedIn, company websites, social media, data brokers, and breach databases to research targets. Public information is the raw material of spear phishing.',
    watchouts: ['Audit your LinkedIn profile — limit details about projects, tools, and reporting structures', 'Be mindful of posting about work travel or absences on social media', 'Consider what an attacker could learn about you from all public sources combined'],
    pubDate: '2024-08-02', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ WHALING / CEO FRAUD ══
  {
    title: 'Whaling — When Attackers Target Senior Executives',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Whaling is spear phishing aimed at senior executives (the "big fish"). These attacks often impersonate regulators, board members, or major clients and carry higher stakes: fraudulent wire transfers, confidential document disclosure, or access to broad systems. Whaling emails are meticulously researched — attackers know the target\'s role, recent media coverage, and professional network. Executives are targeted precisely because their authority can override normal security controls and approval processes.',
    summary: 'Whaling targets senior executives with highly researched attacks designed to elicit wire transfers, confidential data, or system access by exploiting executive authority.',
    watchouts: ['Executives: treat all unusual financial or data requests with scepticism, regardless of apparent source', 'Implement mandatory dual-authorisation for wire transfers above a threshold', 'Verify any request from "regulators" or "board members" through established contact channels'],
    pubDate: '2024-08-03', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'CEO Fraud — "The Boss Needs This Wire Transfer Now"',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'CEO fraud (also called Business Email Compromise or BEC) involves an attacker impersonating a senior executive — typically the CEO or CFO — and directing a finance or HR employee to make an urgent wire transfer, change payroll details, or send sensitive employee data. The email often claims the executive is in a meeting and cannot be reached by phone, creating false urgency. Finance and HR staff are primary targets and must be trained to verify any unusual financial instruction through a pre-established secondary channel.',
    summary: 'CEO fraud targets finance and HR staff with urgent wire transfer or data requests impersonating executives. Always verify financial instructions through a second channel.',
    watchouts: ['Never act on wire transfer instructions from email alone — always verify by phone', 'Be especially suspicious of "I\'m in a meeting and cannot take calls" excuses', 'Finance teams: implement a mandatory callback verification process for all payment changes'],
    pubDate: '2024-08-03', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'BEC — Business Email Compromise Beyond Wire Fraud',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Business Email Compromise has evolved beyond simple wire fraud. Modern BEC attacks include: payroll diversion (changing an executive\'s direct deposit details), W-2/tax form theft (requesting all employee tax documents from HR), vendor payment redirection (posing as a legitimate vendor with "updated banking details"), gift card scams (requesting purchases of gift cards for "client rewards"), and merger/acquisition fraud (posing as legal counsel requesting confidential due diligence documents). Every department that handles money, data, or external relationships is a BEC target.',
    summary: 'BEC now includes payroll diversion, tax form theft, vendor payment fraud, gift card scams, and M&A fraud. Every department handling money or sensitive data is a target.',
    watchouts: ['HR: never email employee tax documents based on an email request alone', 'Accounts payable: verify all vendor banking detail changes through known phone numbers', 'Any request to buy gift cards for "client rewards" is likely fraud'],
    pubDate: '2024-08-04', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'BEC Attack Anatomy — Step-by-Step from Research to Cashout',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'A typical BEC attack unfolds in stages: (Phase 1) Reconnaissance — attacker identifies target organisation, key executives, and finance personnel through LinkedIn, corporate website, and press releases. (Phase 2) Account compromise or spoofing — attacker either compromises a real executive email account or spoofs the domain. (Phase 3) Trust building — attacker may send innocuous preliminary emails to establish a pattern. (Phase 4) The ask — urgent wire transfer or data request, timed for when the real executive is known to be travelling or in meetings. (Phase 5) Cashout — funds transferred to mule accounts and quickly moved. Understanding the full attack chain helps employees spot early-stage reconnaissance signals.',
    summary: 'BEC attacks follow a five-phase chain: reconnaissance, compromise/spoofing, trust building, the ask, and cashout. Early-stage detection is possible if employees report suspicious reconnaissance.',
    watchouts: ['Report any unusual email activity from executives, even if seemingly harmless', 'Be wary of "testing the waters" emails — attackers may probe before the real attack', 'Note when urgent requests align with known executive travel or unavailability'],
    pubDate: '2024-08-04', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ SMISHING ══
  {
    title: 'Smishing — SMS Phishing Is on the Rise',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Smishing (SMS phishing) uses text messages to deliver phishing links or solicit sensitive information. Common smishing lures include: fake delivery notifications ("Your package could not be delivered — click to reschedule"), fake bank alerts ("Suspicious transaction detected — verify your account"), fake COVID/government messages, fake job offers, and fake two-factor authentication prompts. SMS messages have higher open rates than email and benefit from the trust users place in their phone\'s messaging app. Never click links in unexpected text messages.',
    summary: 'Smishing uses SMS to deliver phishing links with lures like fake delivery notices and bank alerts. SMS messages have high trust and open rates, making them dangerous.',
    watchouts: ['Never click links in unexpected text messages, even if they appear to be from known companies', 'Banks and delivery services will never ask you to "verify your account" via SMS link', 'Forward suspicious text messages to your carrier\'s spam reporting number'],
    pubDate: '2024-08-05', type: 'Smishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Smishing and QR Codes — A Dangerous Combination',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Increasingly, smishing messages contain QR codes rather than clickable links. Attackers exploit the fact that users cannot preview a QR code\'s destination before scanning, and many mobile email and messaging apps do not flag QR codes in their link protection systems. A QR code received via SMS that claims to be from a bank, delivery service, or employer should be treated with extreme suspicion. The same verification rules apply: contact the organisation through a known, trusted channel — not through the QR code.',
    summary: 'QR codes in SMS messages bypass link preview and security scanning. Never scan a QR code from an unexpected text message without independent verification.',
    watchouts: ['QR codes in SMS cannot be previewed — you don\'t know where they lead until you scan', 'Treat QR codes in text messages with the same suspicion as links in emails', 'If a QR code claims to be from your bank, open the bank app directly instead'],
    pubDate: '2024-08-05', type: 'Smishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Smishing Targeting Corporate Employees — "Your IT Department"',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Workplace-targeted smishing is growing rapidly. Attackers send text messages claiming to be from the corporate IT department, HR, or the CEO: "Your password has expired — click to reset," "Your payroll details need verification," or "Urgent: review this document from the CEO." These messages often arrive outside business hours or during known busy periods. Because employees receive legitimate work communications on their personal phones (Slack notifications, calendar alerts), the boundary between work and personal messages is blurred — attackers exploit this.',
    summary: 'Workplace smishing impersonates IT, HR, or executives via SMS. The blurring of personal and work communications on phones makes these attacks especially effective.',
    watchouts: ['Your IT department will never send password reset links via SMS', 'If an executive texts you an urgent request, verify through corporate email or a call', 'Report workplace-themed smishing to your IT security team so they can warn others'],
    pubDate: '2024-08-06', type: 'Smishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },

  // ══ VISHING ══
  {
    title: 'Vishing — Voice Phishing and How to Defend Against It',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Vishing (voice phishing) uses phone calls to extract sensitive information or coerce actions. Common scenarios: caller claims to be from IT support needing remote access to "fix a security issue," from the bank\'s fraud department requesting card details to "stop a suspicious transaction," from a government agency demanding immediate payment for "outstanding taxes," or from a senior executive\'s "assistant" requesting confidential information for a board meeting. The human voice creates social pressure that email cannot match.',
    summary: 'Vishing uses phone calls to create social pressure and extract information. The human voice builds trust and urgency that email cannot replicate.',
    watchouts: ['Never grant remote access to your computer based on an incoming call', 'Hang up and call back using a number you independently verify — not one the caller provides', 'Government agencies and banks never demand immediate payment or credentials over the phone'],
    pubDate: '2024-08-07', type: 'Vishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Vishing + AI Voice Cloning — The Next Frontier',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'AI voice cloning technology now enables attackers to replicate a person\'s voice from as little as 3 seconds of audio. Combined with caller ID spoofing, an attacker can call an employee, sound exactly like their CEO or manager, and issue urgent instructions. Reported real-world cases include a CEO\'s voice being cloned to authorise a fraudulent wire transfer and a manager\'s voice used to pressure an employee into revealing VPN credentials. Voice alone is no longer a reliable authentication factor.',
    summary: 'AI voice cloning from minimal audio samples makes vishing attacks indistinguishable from genuine executive calls. Voice alone is no longer a reliable identity verification method.',
    watchouts: ['Establish code words or secondary verification methods for sensitive phone instructions', 'Treat any urgent financial instruction received by phone call with the same verification as email', 'Be aware that "my CEO called me" is no longer a defence — the voice can be AI-generated'],
    pubDate: '2024-08-07', type: 'Vishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Vishing Scripts — What Attackers Say to Manipulate You',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Vishing attackers use well-rehearsed psychological manipulation scripts: "This is urgent — your account will be locked in 30 minutes" (false urgency), "I can see on my screen that someone is logged into your account right now" (false authority), "I\'m just trying to help you — can you read me the code that was sent to your phone?" (helpfulness exploitation), "You\'ll lose your job if this doesn\'t get done" (fear), and "Other people in your department have already verified — you\'re the last one" (social proof). Recognising these scripts helps employees disengage.',
    summary: 'Vishing attackers use five manipulation scripts: false urgency, false authority, helpfulness exploitation, fear, and social proof. Recognising them is the first defence.',
    watchouts: ['"Your account will be locked" is a manipulation script — legitimate services give you time', '"I just need the code sent to your phone" is always a scam — codes are for you only', 'If a caller makes you feel rushed or afraid, hang up and contact the organisation directly'],
    pubDate: '2024-08-08', type: 'Vishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },

  // ══ CREDENTIAL HARVESTING ══
  {
    title: 'Credential Harvesting — Fake Login Pages That Steal Your Password',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Credential harvesting is the most common phishing objective: trick users into entering their username and password on a fake login page that looks identical to the real one. Attackers clone Office 365, Google Workspace, corporate VPN portals, and popular SaaS application login pages. The fake page captures credentials and either displays an error ("incorrect password, please try again") or redirects to the real login page so the victim does not realise their credentials were stolen. Two-factor authentication provides strong protection against harvested credentials.',
    summary: 'Credential harvesting uses fake login pages to steal passwords. Always check the URL before entering credentials and enable two-factor authentication everywhere.',
    watchouts: ['Check the URL in your browser address bar before entering any password', 'Enable two-factor authentication on all accounts — it stops harvested credentials from being used', 'If a login page looks slightly different (logo quality, font, layout), close it and navigate manually'],
    pubDate: '2024-08-09', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'MFA Fatigue Attacks — When "Approve" Becomes the Weakest Link',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Multi-factor authentication (MFA) fatigue attacks — also called MFA bombing or push notification spam — flood a target with repeated MFA push notifications after the attacker has already obtained their password. The attacker hopes the victim will eventually tap "Approve" to stop the notifications, either out of annoyance or because they assume it is a system glitch. High-profile breaches have succeeded through MFA fatigue. Never approve an MFA prompt you did not initiate — contact IT if you receive unexpected prompts.',
    summary: 'MFA fatigue attacks bombard users with push notifications hoping they will eventually approve one. Never approve an unexpected MFA prompt — report it to IT immediately.',
    watchouts: ['Never approve an MFA prompt you did not initiate yourself', 'If you receive repeated unexpected MFA prompts, change your password immediately', 'Report MFA bombing to IT — your account credentials may already be compromised'],
    pubDate: '2024-08-09', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Adversary-in-the-Middle (AiTM) — Phishing That Bypasses MFA',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Adversary-in-the-Middle (AiTM) phishing uses a proxy server that sits between the victim and the legitimate login service. When the victim enters credentials and completes MFA on the proxy site, the attacker captures the session token (cookie) generated after successful authentication — not the password. The attacker then replays this session token to access the victim\'s account without needing the password or MFA code again. AiTM attacks are a primary reason organisations are migrating to phishing-resistant MFA (FIDO2/Passkeys).',
    summary: 'AiTM phishing captures session tokens after MFA, bypassing both passwords and MFA codes. This is driving adoption of phishing-resistant authentication like FIDO2 passkeys.',
    watchouts: ['Phishing-resistant MFA (hardware keys, passkeys) prevents AiTM attacks', 'Be suspicious of login pages that redirect through multiple domains', 'Report any login that "didn\'t work the first time but worked the second time" — session tokens may have been stolen'],
    pubDate: '2024-08-10', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Credential Stuffing — Why Password Reuse Is Dangerous',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Credential stuffing automates the use of username/password pairs from previous data breaches to gain unauthorised access to other services. Attackers exploit the human habit of reusing passwords across multiple accounts. Even if your current organisation\'s systems are secure, a password reused from a compromised personal account can give attackers access to corporate systems. Every employee must use unique passwords for every service — a password manager makes this practical. Password reuse is the most preventable cause of account compromise.',
    summary: 'Credential stuffing exploits password reuse across services. Using unique passwords for every account — enabled by a password manager — is the single most effective defence.',
    watchouts: ['Use a unique password for every account — never reuse passwords', 'Use a password manager to generate and store strong, unique passwords', 'Check if your email has appeared in known data breaches using haveibeenpwned.com'],
    pubDate: '2024-08-10', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ CLONE PHISHING ══
  {
    title: 'Clone Phishing — When Attackers Hijack Legitimate Conversations',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Clone phishing involves an attacker creating a near-identical copy of a legitimate email the victim has previously received, then replacing links or attachments with malicious versions. The attacker claims to be "re-sending" the email due to a supposed delivery error or "updated attachment." Because the email references a real, recent interaction, it bypasses the victim\'s suspicion — they remember the original legitimate conversation. Clone phishing often follows credential compromise, where the attacker monitors inboxes for conversations to clone.',
    summary: 'Clone phishing duplicates legitimate emails with malicious replacements. Because victims recognise the original conversation, they drop their guard — always verify re-sent emails.',
    watchouts: ['Be suspicious of any "re-sent" or "updated version" email, especially with new links', 'If you receive a duplicate of a recent email, verify with the sender through a different channel', 'Attackers can only clone emails they have seen — a compromised account may precede clone phishing'],
    pubDate: '2024-08-11', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },

  // ══ QR CODE PHISHING (QUISHING) ══
  {
    title: 'Quishing — QR Code Phishing in the Physical World',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Quishing (QR code phishing) extends beyond SMS to the physical world. Attackers place malicious QR code stickers over legitimate ones on parking meters, restaurant menus, event posters, and public notices. When scanned, these codes lead to fake payment pages that steal credit card details or fake Wi-Fi login portals that capture credentials. Even in corporate environments, malicious QR codes on "visitor Wi-Fi" signs, conference agendas, or facility notices can compromise employee devices. Always verify the destination URL after scanning a QR code before proceeding.',
    summary: 'Physical QR codes can be replaced with malicious versions. Always check the destination URL after scanning before entering any information or making a payment.',
    watchouts: ['Check physical QR codes for sticker overlays — they are the most common tampering method', 'After scanning any QR code, verify the URL in your browser before proceeding', 'Never enter credentials or payment information on a page reached via QR code without URL verification'],
    pubDate: '2024-08-12', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },

  // ══ DEEPFAKE PHISHING ══
  {
    title: 'Deepfake Phishing — When You Cannot Trust Video Calls',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Deepfake technology now enables real-time face and voice manipulation in video calls. Attackers have used deepfake avatars to impersonate executives in video meetings, directing employees to transfer funds or share confidential documents. In one confirmed case, an employee participated in a multi-person video call where every participant except the victim was a deepfake. The technology is advancing faster than detection methods. Organisations must implement out-of-band verification — a pre-arranged code word or a callback to a known number — for any sensitive instruction received during a video call.',
    summary: 'Real-time deepfakes can impersonate colleagues in video calls. Out-of-band verification (code words, callback to known numbers) is essential for sensitive video call instructions.',
    watchouts: ['Pre-arrange verification code words for sensitive financial or data-sharing instructions', 'If a video call participant looks or sounds slightly "off," verify through a separate channel', 'Be aware that a multi-person video call can include deepfake participants — trust but verify'],
    pubDate: '2024-08-13', type: 'Social Engineering', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ PHISHING KITS AND INFRASTRUCTURE ══
  {
    title: 'Phishing-as-a-Service — Anyone Can Now Launch Sophisticated Attacks',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Phishing-as-a-Service (PhaaS) platforms offer turnkey phishing campaigns for subscription fees as low as $50 per month. These platforms provide: ready-to-deploy fake login page templates for hundreds of brands, email distribution infrastructure with built-in spam filter evasion, victim credential capture and management dashboards, and even "customer support" for attackers. The barrier to entry for sophisticated phishing is now near-zero. This means every employee, at every organisation, will face professionally crafted phishing attacks regardless of their industry or size.',
    summary: 'Phishing-as-a-Service platforms sell complete attack infrastructure for $50/month. Sophisticated phishing is now accessible to anyone, making every organisation a target.',
    watchouts: ['Assume you will be targeted by professional-grade phishing — stay vigilant', 'Low barrier to entry means attackers can afford to target organisations of any size', 'Generic "this looks amateur" is no longer a reliable phishing indicator — attacks are professionally designed'],
    pubDate: '2024-08-14', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Reverse Proxy Phishing Kits — The Most Dangerous Tool in the Arsenal',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Reverse proxy phishing kits (like Evilginx, Modlishka) are the most dangerous phishing tools in active use. Unlike traditional phishing that captures static credentials, reverse proxy kits sit between the victim and the legitimate service, capturing both credentials AND the authenticated session token — completely bypassing MFA. The victim\'s experience is seamless: they log in, complete MFA, and access what appears to be the real service, while the attacker silently captures everything. These kits are increasingly user-friendly and widely distributed.',
    summary: 'Reverse proxy kits capture authenticated sessions — not just passwords — making them the most dangerous phishing tool. They completely bypass standard MFA.',
    watchouts: ['Phishing-resistant MFA (FIDO2/Passkeys) is the only reliable defence against reverse proxy attacks', 'Be suspicious of any login flow that feels slightly different — an extra redirect or delay', 'Report any account access from unusual locations or at unusual times immediately'],
    pubDate: '2024-08-14', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ PHISHING DELIVERY METHODS ══
  {
    title: 'HTML Attachment Phishing — The "Invoice" That Steals Your Password',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'HTML attachment phishing delivers a fully self-contained phishing page as an email attachment. When opened in a browser, the HTML file displays a convincing fake login page — often for Microsoft 365, Google, or a corporate portal — while harvesting credentials locally or sending them to an attacker-controlled server. Because the phishing page is opened from a local file, the browser address bar shows a file:/// URL, which many users do not recognise as suspicious. Never open unexpected HTML attachments, especially those claiming to be invoices, secure messages, or document previews.',
    summary: 'HTML attachments contain self-contained phishing pages that open in your browser. The file:/// URL in the address bar is the giveaway — never enter credentials on a locally opened page.',
    watchouts: ['Never open HTML (.htm, .html) attachments from unexpected emails', 'If you accidentally open one, check the address bar — file:/// means it is a local phishing page', 'Legitimate services never send login pages as HTML attachments'],
    pubDate: '2024-08-15', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'SVG Phishing — Images That Contain Hidden Malice',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'SVG (Scalable Vector Graphic) files are increasingly used in phishing campaigns. Unlike static image formats (PNG, JPEG), SVG files can contain embedded JavaScript, HTML forms, and clickable links. An SVG attachment that appears to be a "secure document preview" or "encrypted message notification" may actually contain a credential-harvesting form or auto-redirect to a phishing site. Email security gateways that scan for malicious links in the email body may not inspect links embedded inside SVG files.',
    summary: 'SVG files can contain embedded forms, scripts, and links that bypass email security scanning. Treat SVG attachments with the same suspicion as executable files.',
    watchouts: ['Treat SVG email attachments as potentially dangerous — they can contain executable code', 'Do not click on elements inside an SVG file opened in your browser', 'Report any email with an unexpected SVG attachment to IT security'],
    pubDate: '2024-08-15', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Calendar Phishing — Meeting Invites That Steal Credentials',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Calendar phishing exploits the trust users place in calendar invitations. Attackers send meeting invites with malicious links in the meeting description, location field, or attached "agenda" document. Because calendar applications often display invites with a trusted UI and people are conditioned to accept meeting requests, the phishing link receives less scrutiny. Calendar invites can also be used to confirm that an email address is actively monitored (the attacker receives the accept/decline response).',
    summary: 'Malicious calendar invites exploit the trusted meeting UI to deliver phishing links. Scrutinise unexpected meeting requests, especially those with links in the description.',
    watchouts: ['Review unexpected meeting invites carefully — check the organiser\'s email address', 'Do not click links in meeting descriptions from unknown or unexpected organisers', 'Declining a suspicious meeting invite may confirm your email address is active — report it instead'],
    pubDate: '2024-08-16', type: 'Phishing', threatLevel: 3, relevanceScore: 14, tier: T1
  },
  {
    title: 'Search Engine Phishing — Malicious Ads Above Legitimate Results',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Search engine phishing (malvertising) places malicious advertisements above legitimate search results. When an employee searches for "company portal login," "Office 365 sign in," or even "IT helpdesk," the top results may be paid ads leading to credential-harvesting sites that perfectly mimic the legitimate login page. Because users trust search engines to rank legitimate results first, they often do not distinguish between ads and organic results. Bookmark your organisation\'s key portals and always navigate directly — never via search.',
    summary: 'Paid search ads above legitimate results can lead to credential-harvesting fake login pages. Bookmark work portals and navigate directly — never via search engine.',
    watchouts: ['Bookmark your organisation\'s key portals — never search for login pages', 'Look for "Ad" or "Sponsored" labels next to search results and avoid them for sensitive logins', 'Type URLs directly into the address bar for any login page you use regularly'],
    pubDate: '2024-08-16', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },

  // ══ SOCIAL MEDIA PHISHING ══
  {
    title: 'LinkedIn Phishing — Professional Network, Professional Threat',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'LinkedIn is the most-exploited social platform for corporate phishing reconnaissance and direct targeting. Attackers create fake recruiter profiles, send connection requests with malicious "job description" links, and use LinkedIn information to craft convincing spear phishing emails. Fake "LinkedIn security" messages warn of account suspension and link to credential-harvesting pages. The professional context lowers users\' guard — people expect professional communication on LinkedIn and are less suspicious than on personal social platforms.',
    summary: 'LinkedIn is a primary vector for corporate phishing — fake recruiters, malicious job links, and credential harvesting via fake security alerts exploit professional trust.',
    watchouts: ['Verify recruiter profiles before accepting connections or opening attachments', 'LinkedIn will never send you a link to "verify your account" via direct message', 'Be aware that information on your LinkedIn profile is used to craft targeted phishing against you'],
    pubDate: '2024-08-17', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'WhatsApp Business Phishing — When the Message Looks Official',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'WhatsApp Business accounts — which display a verified badge — are increasingly used for phishing. Attackers either compromise legitimate WhatsApp Business accounts or create convincing fake ones. Common lures include: fake job interviews, fake customer support ("Your bank account has been flagged"), fake investment opportunities, and fake delivery updates. Because WhatsApp messages feel more personal and urgent than email, and because the Business badge creates a false sense of legitimacy, users are more likely to click links and share information.',
    summary: 'WhatsApp Business verified badges create false trust for phishing. Treat all unexpected WhatsApp messages from "businesses" with the same suspicion as email.',
    watchouts: ['A verified WhatsApp Business badge does not guarantee the sender is legitimate', 'Banks and financial institutions rarely initiate contact via WhatsApp', 'Never share OTPs, passwords, or financial details over WhatsApp — regardless of who asks'],
    pubDate: '2024-08-17', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },

  // ══ SEASONAL AND EVENT-BASED PHISHING ══
  {
    title: 'Tax Season Phishing — "Your Refund Is Ready"',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Tax season triggers a massive spike in phishing campaigns worldwide, including in India where tax-filing deadlines create predictable urgency. Attackers send emails and SMS messages impersonating the Income Tax Department, claiming tax refunds are ready, tax notices require immediate response, or PAN cards need verification. These messages exploit the anxiety and urgency surrounding tax deadlines. Government tax authorities never request sensitive information or payments via unsolicited email or SMS links.',
    summary: 'Tax season phishing impersonates tax authorities with refund lures and urgent notices. No tax authority requests personal information or payments via unsolicited email or SMS.',
    watchouts: ['Tax authorities never request PAN, Aadhaar, or bank details via email or SMS', 'Access tax portals only by typing the official URL — never via links in messages', 'If you receive a "tax refund" message, log into the official portal separately to check'],
    pubDate: '2024-08-18', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Festival Season Phishing — "Special Offers" That Steal More Than Money',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'During major Indian festivals (Diwali, Holi, Dussehra) and shopping seasons, phishing campaigns surge with fake e-commerce offers, "exclusive deals," and "gift vouchers." These campaigns target both consumers and employees — an employee who falls for a festival phishing attack on their personal device may reuse compromised credentials at work. The festive atmosphere lowers suspicion, and the volume of legitimate promotional emails makes it harder to spot the fraudulent ones.',
    summary: 'Festival season brings a flood of fake offer and gift voucher phishing. Compromised personal credentials from these attacks can endanger corporate accounts through password reuse.',
    watchouts: ['Be extra vigilant during festival and shopping seasons — phishing volume spikes', 'Never reuse passwords between personal shopping accounts and work accounts', 'Verify festival offers by navigating directly to the retailer\'s website, not via email links'],
    pubDate: '2024-08-18', type: 'Phishing', threatLevel: 3, relevanceScore: 14, tier: T1
  },

  // ══ INDUSTRY-SPECIFIC PHISHING ══
  {
    title: 'Financial Services Phishing — "Your Account Has Been Frozen"',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Financial services phishing targets bank customers and employees with high-stakes lures: account freezes, suspicious transaction alerts, KYC update requirements, and "new security feature" enrolment. In India, attackers commonly impersonate SBI, HDFC, ICICI, and other major banks, as well as UPI platforms like PhonePe and Google Pay. The emotional trigger of potential financial loss makes these attacks among the most effective. Financial institutions never request full credentials, OTPs, or card PINs via email, SMS, or phone.',
    summary: 'Financial phishing exploits fear of account freezes and financial loss. Banks and UPI platforms never ask for full credentials, OTPs, or PINs via any remote channel.',
    watchouts: ['No legitimate bank will ever ask for your OTP, PIN, or full password', 'If you receive a "your account is frozen" message, contact your bank directly using official channels', 'Do not call phone numbers provided in suspicious bank messages — look up the official number'],
    pubDate: '2024-08-19', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Healthcare Phishing — Patient Data Is Gold for Attackers',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Healthcare phishing targets hospitals, clinics, insurance companies, and their employees with lures related to patient records, insurance claims, COVID-19 test results, and prescription renewals. Healthcare data is 10-50 times more valuable on the black market than financial data because it contains permanent identifiers (date of birth, medical history) that cannot be changed like a credit card number. Employees handling health data must treat every email about patient information with extreme scrutiny.',
    summary: 'Healthcare data is far more valuable than financial data on the black market. Phishing targeting healthcare employees exploits patient record and insurance claim lures.',
    watchouts: ['Treat any unsolicited email about patient records or test results as a high-risk phishing attempt', 'Never access patient data systems via links in emails — use your standard clinical portal', 'Healthcare data is a prime target — your vigilance protects patients, not just the organisation'],
    pubDate: '2024-08-19', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Legal and Compliance Phishing — Impersonating Regulators',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Legal and compliance phishing impersonates regulatory bodies, law firms, and government agencies. Common lures: "subpoena attached," "compliance violation notice," "trademark infringement claim," or "court summons." These attacks exploit the anxiety that legal documents create — employees panic and click before thinking. In reality, legitimate legal notices are served through official channels (registered post, court process servers), not unexpected email. Any unexpected legal notice received by email should be forwarded to your legal department without clicking.',
    summary: 'Legal phishing exploits fear of lawsuits, subpoenas, and regulatory action. Legitimate legal notices are never served via unexpected email — always forward to legal without clicking.',
    watchouts: ['Legitimate legal documents are never served via unsolicited email alone', 'Forward any unexpected "subpoena," "violation notice," or "court summons" email to your legal department', 'Do not open attachments from unknown legal or regulatory email addresses'],
    pubDate: '2024-08-20', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Supply Chain Phishing — Your Vendors Are Attack Vectors',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Supply chain phishing exploits the trust between organisations and their vendors, suppliers, and service providers. An attacker compromises a vendor\'s email, then sends phishing emails to the vendor\'s entire customer contact list from a legitimate, trusted email address. Because the email comes from a known contact with genuine conversation history, it is extremely difficult to detect. Supply chain attacks have been used to distribute malware, steal credentials, and redirect payments. Trust in a vendor relationship does not eliminate the need for verification.',
    summary: 'Supply chain phishing uses compromised vendor accounts to attack their customers. Even emails from trusted vendors with genuine history must be verified for unusual requests.',
    watchouts: ['Trust in a vendor relationship does not replace verification of unusual requests', 'Be especially vigilant about vendor emails containing links to "new invoices" or "updated payment details"', 'If a vendor email makes an unusual request, verify by calling their known phone number'],
    pubDate: '2024-08-20', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ PSYCHOLOGY OF PHISHING ══
  {
    title: 'The Psychology of Falling for Phishing — Why Smart People Click',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Falling for phishing is not about intelligence — it is about context and cognitive load. Research shows that even security professionals click phishing links when they are busy, tired, or distracted. Key psychological levers attackers exploit: (1) Authority bias — we comply with perceived authority figures without questioning. (2) Scarcity and urgency — "limited time" triggers impulsive action. (3) Social proof — "others have already done this." (4) Reciprocity — we feel obligated to respond when someone has "helped" us. (5) Consistency — once we start a process, we are reluctant to stop. Understanding these levers helps employees recognise when they are being manipulated.',
    summary: 'Phishing exploits cognitive biases, not intelligence gaps. Busy, tired, or distracted employees are most vulnerable — regardless of training or seniority.',
    watchouts: ['Recognise when you feel rushed — urgency is the attacker\'s most powerful tool', 'If an email makes you feel anxious or obligated, pause before acting', 'No one is immune — accept that you can be phished and build verification habits to protect yourself'],
    pubDate: '2024-08-21', type: 'Social Engineering', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Authority Bias — Why "From the CEO" Emails Work',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Authority bias is the psychological tendency to comply with instructions from perceived authority figures without critical evaluation. In the workplace, this means an email that appears to come from a senior executive bypasses normal scepticism. Attackers exploit this by: spoofing executive email addresses, referencing real organisational hierarchy, using formal language that mimics executive communication, and creating false time pressure ("before the board meeting"). The most effective defence is a culture where questioning unusual executive requests is rewarded, not punished.',
    summary: 'Authority bias makes employees comply with "executive" requests without questioning. Organisational culture must reward verification of unusual requests from any level.',
    watchouts: ['It is always okay to verify an unusual request from an executive — good leaders appreciate caution', 'If "the CEO" emails you an unusual request, verify it by walking to their office or calling them', 'Attackers count on you being too intimidated to question authority — prove them wrong'],
    pubDate: '2024-08-21', type: 'Social Engineering', threatLevel: 4, relevanceScore: 18, tier: T1
  },

  // ══ RANSOMWARE DELIVERY VIA PHISHING ══
  {
    title: 'Phishing as the #1 Ransomware Delivery Method',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Phishing remains the primary initial access vector for ransomware attacks — estimated at over 90% of incidents. The attack chain: a phishing email delivers a malicious attachment (often a weaponized Office document with macros, a ZIP file containing an executable, or an ISO file) or a link to a malicious website that downloads the ransomware payload. Once executed, the ransomware encrypts files and demands payment. For the organisation, this triggers not just operational disruption but also regulatory obligations (DPDP Act breach notification, potential penalties). A single employee click can bring down an entire organisation.',
    summary: 'Over 90% of ransomware attacks start with a phishing email. One employee click on a malicious attachment or link can trigger operational shutdown and regulatory penalties.',
    watchouts: ['Never enable macros in Office documents received via email unless verified through IT', 'Do not extract or run files from ZIP attachments in unexpected emails', 'Your click is the last line of defence before ransomware encrypts the entire organisation\'s files'],
    pubDate: '2024-08-22', type: 'Ransomware', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Phishing → Credential Theft → Lateral Movement → Ransomware',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Not all ransomware starts with a malicious attachment. Many attacks follow a stealthier path: (1) Phishing steals an employee\'s credentials. (2) Attacker uses those credentials to log into corporate systems (VPN, email, cloud apps). (3) Attacker moves laterally through the network, escalating privileges by stealing additional credentials or exploiting system vulnerabilities. (4) Once the attacker has domain administrator access, they deploy ransomware across the entire organisation — often weeks or months after the initial phishing email. This means the employee whose credentials were phished may not even realise their role in the incident.',
    summary: 'Many ransomware attacks start with credential theft via phishing, followed by weeks of silent lateral movement before the ransomware deploys. The initial phishing victim may never know.',
    watchouts: ['Phishing that steals your credentials may lead to ransomware weeks later — report every suspicious login', 'Use unique, strong passwords for every system to prevent lateral movement from a single compromise', 'Enable MFA on all corporate systems — it is the single most effective barrier to credential-based lateral movement'],
    pubDate: '2024-08-22', type: 'Ransomware', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ DEFENCE AND REPORTING ══
  {
    title: 'What to Do When You Click a Phishing Link — The First 5 Minutes',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'If you click a phishing link or open a suspicious attachment: MINUTE 1 — Disconnect your device from the network (disable Wi-Fi, unplug Ethernet). This prevents malware from spreading or data from being exfiltrated. MINUTE 2 — Report the incident to your IT security team immediately. Do NOT try to fix it yourself or hide the incident out of embarrassment. MINUTE 3 — If you entered credentials, change your password from a different, uncompromised device. MINUTE 4 — Enable MFA on the affected account if it was not already enabled. MINUTE 5 — Document everything: what you clicked, what you saw, what you typed. Speed of reporting is the single most important factor in limiting damage.',
    summary: 'The first 5 minutes after clicking a phishing link are critical: disconnect, report immediately, change passwords from another device, enable MFA, and document everything.',
    watchouts: ['Disconnect from the network IMMEDIATELY after clicking a suspicious link — seconds matter', 'Report the incident to IT within minutes — embarrassment is not a reason to delay', 'If you entered credentials anywhere, change your password from a different, clean device'],
    pubDate: '2024-08-23', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Reporting Phishing — How to Do It and Why It Matters',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Every phishing email reported by an employee is a free threat intelligence feed for the security team. Rapid reporting enables: blocking the sender domain and IPs before other employees receive the same email, removing the phishing email from other inboxes, adding the Indicators of Compromise to security tools, and alerting other organisations through threat sharing networks. A reported phishing email that no one clicked is a security win — not a near miss to be ignored. Use your organisation\'s phishing report button or forward to the designated security email address.',
    summary: 'Reporting phishing is not just protecting yourself — it protects colleagues and strengthens the organisation\'s defences. Every report is valuable threat intelligence.',
    watchouts: ['Use the "Report Phishing" button in your email client — it triggers automated defences', 'Report even if you are not sure — better a false alarm than an unreported real attack', 'Reporting phishing is a positive security behaviour, not an admission of falling for it'],
    pubDate: '2024-08-23', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Phishing Simulations — Why Your Organisation Tests You',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Phishing simulations — where organisations send fake phishing emails to employees to test awareness — are a standard security practice, not a "gotcha" exercise. The goals are: measuring organisational susceptibility trends over time, identifying departments or roles that need additional training, providing safe failure experiences (better to click a simulated phish and learn than click a real one and suffer a breach), and reinforcing the habit of pausing before clicking. If you click a simulated phishing email, you will typically be directed to training — not disciplined. The goal is learning, not punishment.',
    summary: 'Phishing simulations are training tools, not tricks. Clicking a simulated phish is a learning opportunity — it is better to fail safely in a simulation than against a real attacker.',
    watchouts: ['Treat every email with the same scrutiny, whether it is real or simulated', 'If you report a simulated phish, you have demonstrated good security behaviour', 'Use simulation failures as motivation to improve — everyone can be phished under the right conditions'],
    pubDate: '2024-08-24', type: 'Phishing', threatLevel: 3, relevanceScore: 14, tier: T1
  },

  // ══ TECHNICAL INDICATORS ══
  {
    title: 'Reading Email Headers — The Technical Way to Spot Spoofing',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Understanding basic email headers helps employees verify suspicious emails. Key fields: "Return-Path" (where bounces go — often different from the From address in phishing), "Received" chain (trace the email\'s path — does it originate from expected servers?), "Authentication-Results" (SPF, DKIM, DMARC — are they "pass"?), and "Reply-To" (where replies actually go — may differ from the displayed From address). Most email clients hide these details by default, but viewing the full headers and checking these fields can confirm or refute a suspicion. Your IT team can help you learn to access headers in your email client.',
    summary: 'Email headers reveal spoofing through mismatched Return-Path, unexpected server origins, failed authentication (SPF/DKIM/DMARC), and different Reply-To addresses.',
    watchouts: ['Learn how to view full email headers in your email client — ask IT for guidance', 'Check that Authentication-Results shows SPF, DKIM, and DMARC as "pass" for important senders', 'If Reply-To differs from the From address, the email is highly suspicious'],
    pubDate: '2024-08-24', type: 'Phishing', threatLevel: 3, relevanceScore: 14, tier: T1
  },
  {
    title: 'URL Deconstruction — Spotting Malicious Links Before You Click',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Before clicking any link, hover over it to preview the URL and check: (1) Domain — is it the real domain or a lookalike (micr0soft.com vs microsoft.com, microsoft-support.com vs microsoft.com)? (2) Subdomain — does the real domain come BEFORE the first single slash (phishing: microsoft.com.fake.site/login; legitimate: login.microsoft.com)? (3) Protocol — is it https with a valid certificate? (4) URL shorteners — bit.ly, tinyurl, etc. hide the real destination and should never be clicked in work contexts. (5) Character substitutions — Cyrillic "о" replacing Latin "o," zero replacing "O." On mobile, long-press a link to preview the URL.',
    summary: 'Check five things before clicking any link: domain authenticity, subdomain position, protocol, shortened URLs, and character substitutions. On mobile, long-press to preview.',
    watchouts: ['Hover over every link to preview the URL before clicking — this takes one second', 'The real domain is the part just before the first single slash after https://', 'Never click URL shortener links in work emails — you cannot verify the destination'],
    pubDate: '2024-08-25', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },

  // ══ EMERGING THREATS ══
  {
    title: 'AI-Generated Phishing — Perfect Grammar, Perfect Targeting',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Generative AI has eliminated the traditional phishing giveaway: poor grammar and spelling. AI tools now produce flawless, locally-idiomatic phishing emails in any language, tailored to specific industries, organisations, and even individual roles. AI can scrape a target\'s LinkedIn profile, recent tweets, and company news to generate a highly personalised spear phishing email in seconds. The old advice of "look for spelling mistakes" is obsolete. Employees must now rely on content plausibility and process verification — not language quality — to detect phishing.',
    summary: 'AI-generated phishing emails have perfect grammar and personalised content. "Look for spelling mistakes" is obsolete advice — rely on process verification instead.',
    watchouts: ['Perfect grammar and professional language are no longer indicators of legitimacy', 'Assume any email can be AI-generated — verify unusual requests through a second channel', 'The more personalised an unexpected email is, the more suspicious you should be — AI can research you too'],
    pubDate: '2024-08-26', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'Callback Phishing — "Call This Number to Resolve the Issue"',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Callback phishing (also called "telephone-oriented attack delivery" or TOAD) combines email and voice social engineering. The victim receives an email with no malicious link — instead, it contains a phone number and a compelling reason to call: "Your subscription will be auto-renewed for $499 — call to cancel," "Suspicious transaction on your account — call immediately," or "Your anti-virus subscription has expired." When the victim calls, a professional-sounding "support agent" guides them through installing remote access software or revealing credentials. Because the victim initiates the call, they feel in control — this lowers their defences.',
    summary: 'Callback phishing uses email to prompt victims to call a fake support number. The victim initiates the call, creating a false sense of control that lowers defences.',
    watchouts: ['Never call phone numbers from unexpected emails about account issues — look up the official number', 'No legitimate company sends "call to cancel your subscription" emails with a phone number', 'Be suspicious of any email whose only call to action is a phone number'],
    pubDate: '2024-08-26', type: 'Vishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Consent Phishing — OAuth App Tricks That Steal Your Data',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Consent phishing (also called OAuth phishing or "illicit consent grant") tricks users into granting a malicious third-party application access to their cloud accounts (Microsoft 365, Google Workspace). The attacker sends an email that appears to be a legitimate document sharing notification or collaboration request. Clicking the link presents a legitimate-looking OAuth consent screen asking permission to "read your emails," "access your files," or "send email as you." If the user clicks "Accept," the attacker gains persistent access to their account without needing a password — and this access survives password changes. Always scrutinise OAuth permission requests.',
    summary: 'Consent phishing tricks users into granting malicious apps persistent access to cloud accounts via OAuth. This access survives password changes — scrutinise every permission request.',
    watchouts: ['Never grant OAuth permissions to apps you do not recognise and trust', 'Check what permissions an app is requesting — "read and send email" is extremely dangerous', 'If you accidentally granted permissions to a suspicious app, revoke them immediately in your account settings and report to IT'],
    pubDate: '2024-08-27', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ MOBILE-SPECIFIC PHISHING ══
  {
    title: 'Mobile Phishing — Why Your Phone Is the Weakest Link',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Mobile devices are increasingly the primary target for phishing because: (1) Smaller screens make it harder to preview URLs and spot lookalike domains. (2) Mobile email apps often truncate sender addresses, hiding spoofing indicators. (3) Touch interfaces make accidental clicks more likely. (4) People check mobile email during downtime — while commuting, watching TV — when they are less vigilant. (5) Mobile operating systems have fewer security inspection layers than corporate desktop environments. (6) The boundary between work and personal apps on mobile is blurred. Treat emails on mobile with extra caution.',
    summary: 'Mobile devices are phishing\'s prime target due to truncated sender addresses, harder URL inspection, casual reading context, and fewer security layers than desktop.',
    watchouts: ['Be extra cautious reading work email on your phone — the smaller screen hides phishing indicators', 'Long-press links on mobile to preview the URL before tapping', 'If an email seems suspicious on mobile, wait until you are at your desktop to investigate'],
    pubDate: '2024-08-28', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },

  // ══ PHISHING IN INDIAN CONTEXT ══
  {
    title: 'India-Specific Phishing Lures — UPI, Aadhaar, and KYC Scams',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Phishing campaigns targeting Indian users exploit unique Indian digital infrastructure: (1) UPI phishing — "Your UPI ID has been blocked — click to verify," fake UPI payment request links. (2) Aadhaar phishing — "Your Aadhaar has been deactivated — update KYC," fake UIDAI portals. (3) KYC phishing — impersonating banks demanding "immediate KYC update" with threats of account freezing. (4) Electricity bill phishing — fake disconnection notices with payment links. (5) Government scheme phishing — fake PM-KISAN, pension, or subsidy portals. These lures are specifically designed for the Indian digital ecosystem and frequently bypass generic phishing awareness training.',
    summary: 'India-specific phishing exploits UPI, Aadhaar, KYC, electricity bills, and government schemes. These lures are tuned to Indian digital infrastructure and require India-specific awareness.',
    watchouts: ['UPI: never enter your UPI PIN to "receive" money — PIN is only for sending', 'Aadhaar: UIDAI never contacts you by email or SMS to "verify" or "update" Aadhaar', 'KYC: do your KYC only through your bank\'s official app or branch — never via links in messages'],
    pubDate: '2024-08-29', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },
  {
    title: 'RBI and Banking Phishing — Impersonating India\'s Financial Regulator',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Attackers frequently impersonate the Reserve Bank of India (RBI) in phishing campaigns, sending emails or SMS messages claiming: "Your bank account will be frozen per RBI directive," "RBI has flagged your account — verify immediately," or "RBI KYC update required." The RBI does not directly contact individual bank customers about account issues — it regulates banks, not individual accounts. Any message claiming to be from the RBI about your personal bank account is fraudulent.',
    summary: 'The RBI never contacts individual bank customers about account issues. Any message claiming to be from the RBI about your personal account is a scam.',
    watchouts: ['RBI does not contact individual bank customers — any such message is fraudulent', 'Report RBI impersonation scams to your bank and to the RBI\'s abuse reporting channels', 'Do not click links in messages that claim to be from "RBI" about your personal accounts'],
    pubDate: '2024-08-29', type: 'Phishing', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Job Scam Phishing — India\'s Growing Employment Fraud Crisis',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Job scam phishing is one of the fastest-growing cybercrime categories in India. Attackers post fake job listings, send unsolicited "job offer" emails and WhatsApp messages, and impersonate real companies\' HR departments. Common lures: "Your resume has been shortlisted — pay the processing fee," "Work from home — earn 50000/month," and "Fake task-based earning apps." Victims not only lose money to "registration fees" and "training deposits" but may also share identity documents (Aadhaar, PAN, bank details) that enable further fraud. No legitimate employer asks for money from job applicants.',
    summary: 'Job scam phishing is surging in India with fake listings, unsolicited offers, and task-based earning apps. No legitimate employer ever asks job applicants for payment.',
    watchouts: ['No legitimate employer charges "processing fees," "training deposits," or "equipment fees"', 'Verify job offers directly on the company\'s official careers page — not via WhatsApp or Telegram links', 'Never share identity documents (Aadhaar, PAN) with unverified recruiters'],
    pubDate: '2024-08-30', type: 'Scam & Fraud', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ ORGANISATIONAL DEFENCE ══
  {
    title: 'Building a Phishing-Aware Culture — Beyond Annual Training',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Annual phishing awareness training is insufficient. Building a phishing-resistant culture requires: (1) Regular micro-training — short, frequent reminders integrated into daily workflows rather than yearly modules. (2) Positive reinforcement — publicly acknowledging and rewarding employees who report phishing, not just those who avoid clicking. (3) Blame-free reporting — guaranteeing that employees who report their own mistakes will be supported, not punished. (4) Leadership modelling — executives visibly practicing the same verification behaviours they ask of employees. (5) Real-time feedback — when an employee reports a phish, letting them know the outcome closes the learning loop.',
    summary: 'Phishing-resistant culture needs: micro-training, positive reporting reinforcement, blame-free self-reporting, leadership modelling, and real-time feedback on reports.',
    watchouts: ['Report phishing even if you are the only one who received it — your report protects colleagues', 'If you make a mistake, report it immediately — a blame-free culture depends on honest reporting', 'Managers: publicly thank employees who report phishing to reinforce the behaviour'],
    pubDate: '2024-08-31', type: 'Security Tips', threatLevel: 3, relevanceScore: 14, tier: T1
  },
  {
    title: 'Password Managers — The Most Underrated Anti-Phishing Tool',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Password managers provide powerful anti-phishing protection that most employees do not realise: (1) They only auto-fill credentials on the exact domain where they were saved — if you are on a fake bankofamerica.com, the password manager will not offer to fill your bankofamerica.com credentials. This is a silent, automatic phishing detection. (2) They generate and remember unique, strong passwords for every service, eliminating password reuse. (3) They make it easy to change passwords after a breach. Every employee should use a password manager — ideally one provided and managed by the organisation.',
    summary: 'Password managers prevent phishing by only auto-filling on legitimate domains. They are the most underrated anti-phishing tool available to employees.',
    watchouts: ['Use a password manager — its refusal to auto-fill is a silent phishing detection', 'If your password manager does not offer to fill a login page you recognise, stop and verify the URL', 'A password manager also prevents you from reusing passwords — which stops credential stuffing'],
    pubDate: '2024-08-31', type: 'Security Tips', threatLevel: 4, relevanceScore: 18, tier: T1
  },
  {
    title: 'Phishing-Resistant MFA — FIDO2, Passkeys, and Hardware Tokens',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Not all MFA is equally resistant to phishing. SMS-based MFA can be intercepted or SIM-swapped. Push notification MFA is vulnerable to fatigue attacks. Time-based one-time passwords (TOTP) can be phished in real time by AiTM proxies. Phishing-resistant MFA uses FIDO2/WebAuthn standards: hardware security keys (YubiKey, Titan), platform authenticators (Windows Hello, Apple Face ID/Touch ID), and passkeys (synced FIDO2 credentials). These methods cryptographically bind the authentication to the legitimate domain — they simply will not work on a phishing site, even if the user is tricked.',
    summary: 'Phishing-resistant MFA (FIDO2, passkeys, hardware tokens) cryptographically binds to legitimate domains and will not work on phishing sites — providing true protection.',
    watchouts: ['If your organisation offers FIDO2 security keys or passkeys, enrol immediately', 'Understand that SMS and push MFA can be phished — they are better than nothing but not sufficient alone', 'Hardware security keys are the strongest defence — keep yours safe and report if lost'],
    pubDate: '2024-09-01', type: 'Security Tips', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ ADVANCED PERSISTENT PHISHING ══
  {
    title: 'Conversation Hijacking — When the Attacker Joins an Existing Thread',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Conversation hijacking is one of the most dangerous phishing techniques because it exploits an existing, legitimate email thread. After compromising an email account (either the victim\'s or a conversation participant\'s), the attacker inserts themselves into an ongoing conversation. They may reply-all to an existing thread with a malicious attachment ("Here is the updated contract as discussed"), or forward an internal conversation externally while adding a malicious link. Because the email thread is real and the participants are genuine, victims almost never suspect phishing. Any unexpected attachment or link in an otherwise legitimate thread should trigger verification.',
    summary: 'Conversation hijacking inserts attackers into real email threads. Because the thread history is legitimate, victims rarely suspect phishing — verify unexpected attachments in any thread.',
    watchouts: ['Be suspicious of sudden attachments or links in long-running email threads', 'If a thread participant starts using unusual language or making odd requests, verify by phone', 'Check if the sender\'s email address has changed subtly within the thread — this indicates hijacking'],
    pubDate: '2024-09-01', type: 'Phishing', threatLevel: 5, relevanceScore: 20, tier: T1
  },

  // ══ RECOVERY AND RESILIENCE ══
  {
    title: 'After a Phishing Incident — How Organisations Should Respond',
    source: 'Phishing Expert', sourceId: 'phishing-expert', url: '',
    description: 'Post-phishing incident response: (1) Contain — isolate affected accounts and devices immediately. (2) Investigate — determine what data was accessed, what actions were taken, and whether the attacker established persistence. (3) Notify — inform affected Data Principals and the Data Protection Board as required under DPDP Act. (4) Remediate — reset credentials, revoke sessions, patch exploited vulnerabilities. (5) Learn — conduct a blameless post-incident review to improve defences. Crucially, the employee who clicked should be supported, not shamed — a punitive response ensures future incidents will be hidden rather than reported quickly.',
    summary: 'Post-phishing response: contain, investigate, notify (DPDP Act), remediate, learn. The employee who clicked must be supported — punishment drives future incidents underground.',
    watchouts: ['If you clicked a phishing link, reporting it quickly is the most valuable thing you can do', 'Organisations: create a culture where reporting mistakes is rewarded, not punished', 'Every phishing incident is a learning opportunity — use it to strengthen defences for everyone'],
    pubDate: '2024-09-02', type: 'Security Tips', threatLevel: 4, relevanceScore: 18, tier: T1
  }
];

// ── Phishing-tuned keyword weights ──
// Extends the default scoring with deep phishing terminology. Applied via
// the snapshot override in retrieval. Complements, does not replace, the
// scoring.js defaults.
export const PHISHING_KEYWORDS = {
  critical: [
    'spear phishing', 'whaling', 'ceo fraud', 'business email compromise',
    'credential harvest', 'fake login', 'phishing kit', 'smishing', 'vishing',
    'quishing', 'qr phishing', 'clone phishing', 'deepfake phishing',
    'mfa fatigue', 'mfa bombing', 'push bombing', 'session hijack',
    'adversary in the middle', 'aitm', 'reverse proxy', 'evilginx',
    'consent phishing', 'oauth phishing', 'illicit consent',
    'conversation hijack', 'thread hijack', 'callback phishing',
    'toad attack', 'html attachment', 'svg phishing',
    'calendar phishing', 'search engine phishing', 'malvertising',
    'credential stuffing', 'password reuse', 'credential theft',
    'ransomware delivery', 'phishing as a service', 'phaas',
    'spoofed email', 'lookalike domain', 'typosquatting',
    'social engineering', 'impersonation', 'pretexting',
    'upi phishing', 'aadhaar phishing', 'kyc scam', 'job scam',
    'supply chain phishing', 'vendor impersonation', 'invoice fraud',
    'payroll diversion', 'gift card scam', 'wire transfer fraud',
    'ai phishing', 'ai voice clone', 'voice phishing'
  ],
  context: [
    'phish', 'phishing', 'scam', 'fraud', 'fake', 'spoof',
    'urgent', 'verify', 'login', 'password', 'credential',
    'attachment', 'link', 'click', 'malicious', 'suspicious',
    'email security', 'awareness', 'report phishing',
    'multi-factor', 'mfa', '2fa', 'authenticator', 'passkey',
    'security key', 'yubikey', 'fido2', 'webauthn',
    'ransomware', 'malware', 'payload', 'compromise'
  ],
  noise: [
    'blockchain', 'crypto currency', 'nft', 'metaverse',
    'quantum computing', 'post-quantum', 'pqc'
  ]
};

// ── Phishing-aware system prompt addition ──
// Injected into context_file.js synthesis when the topic concerns phishing.
// Ensures generated content reflects real attacker techniques and effective
// employee defences, not generic "don\'t click links" advice.
export const PHISHING_PROMPT = `You are generating content about phishing attacks and employee defence.
Key framing rules:
- Phishing is a human-targeted attack — focus on employee behaviour, recognition, and response, not technical infrastructure.
- Distinguish between phishing types: spear phishing (targeted, personalised), whaling (executive-targeted), smishing (SMS), vishing (voice), quishing (QR code), clone phishing (conversation hijacking).
- Emphasise that phishing succeeds through psychological manipulation (urgency, authority, fear, social proof), not technical sophistication.
- Always provide actionable employee watchouts: specific behaviours to adopt, not vague "be careful" advice.
- Include the "what to do if you clicked" protocol — the first 5 minutes are critical.
- Frame phishing reporting as positive security behaviour — every report is threat intelligence that protects colleagues.
- For Indian audiences: reference India-specific lures (UPI, Aadhaar, KYC, electricity bill, government scheme scams).
- AI-generated phishing has eliminated poor grammar as a detection indicator — emphasise URL inspection and process verification instead.
- MFA is critical defence but distinguish between phishable MFA (SMS, push, TOTP) and phishing-resistant MFA (FIDO2, passkeys, hardware tokens).
- Password managers are underrated anti-phishing tools — they only auto-fill on legitimate domains.
- Never shame the victim — employees who click are the last line of defence, not the weakest link.
Target content at regular employees in Indian organisations, using Indian English conventions.`;