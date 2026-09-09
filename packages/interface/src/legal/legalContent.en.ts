import type { LegalContentBundle } from "./legalContent.types";

export const legalContentEn: LegalContentBundle = {
  releaseDate: "April 13, 2026",
  documents: {
    terms: {
      eyebrow: "Terms of Service",
      title: "KŌMA Studio Terms of Service",
      summary:
        "Rules that govern access to KŌMA Studio, optional integrations, community areas, and use of the desktop and web-connected features.",
      highlights: [
        "KŌMA Studio combines a desktop application with web authentication, updates, support, and optional remote services.",
        "You remain responsible for the rights, permissions, and legality of the files, prompts, links, and materials you submit or publish.",
        "Features, integrations, and security controls may change when laws, providers, or abuse-prevention requirements change.",
      ],
      sections: [
        {
          title: "1. Service scope",
          paragraphs: [
            "KŌMA Studio provides tools for cleaning, redraw, OCR, translation, typesetting, workflow automation, assisted publishing, and related scanlation productivity features. Some features run entirely on the device, while others depend on remote infrastructure for account management, support, updates, managed services, or user-enabled integrations.",
            "The service may evolve over time. We may add, change, replace, or discontinue features, providers, model catalogs, security requirements, or compatibility rules when necessary for product operation, legal compliance, or infrastructure integrity.",
          ],
        },
        {
          title: "2. Accounts, eligibility, and security",
          paragraphs: [
            "You must provide accurate registration data, keep your credentials confidential, and use the service only if you can enter into a binding agreement under the laws that apply to you. The service is not intended for children under the minimum age required by applicable law to use online services without parental or guardian authorization.",
            "We may require email verification, trusted-device checks, travel-token flows, CAPTCHA, rate limits, mandatory app updates, session reviews, temporary restrictions, or other reasonable controls to protect accounts, integrations, and the platform.",
          ],
          bullets: [
            "You are responsible for activity under your account unless the law says otherwise.",
            "You may not share credentials, bypass technical restrictions, or use the service to automate fraud or abuse.",
            "We may suspend or terminate access when we detect security risk, unlawful conduct, or serious violation of these documents.",
          ],
        },
        {
          title: "3. User content, rights, and acceptable use",
          paragraphs: [
            "You keep ownership of your content. However, you grant KŌMA Studio the limited rights needed to host, transmit, cache, transform, display, or process that content solely to operate the features you request, maintain security, and provide support.",
            "You represent that you have the necessary rights, licenses, authorizations, and lawful basis to upload, process, publish, or share any image, text, prompt, log, attachment, or link you use in the service. KŌMA Studio does not grant you rights over third-party works and does not validate your chain of title.",
          ],
          bullets: [
            "Do not use the service to violate copyright, trademark, privacy, confidentiality, personality rights, or platform security.",
            "Do not upload malware, phishing content, illegal material, deceptive recruitment posts, or abusive community content.",
            "We may remove, hide, block, or report content that creates legal, security, reputational, or operational risk.",
          ],
        },
        {
          title: "4. Third-party services and integrations",
          paragraphs: [
            "Features such as Blogger, Imgur, Discord webhooks, bring-your-own-key AI providers, and other connectors work only when you deliberately enable them. When you trigger those flows, KŌMA Studio may send the selected content, credentials, metadata, and execution instructions that are necessary to complete the requested action.",
            "Third-party services operate under their own terms, privacy notices, retention rules, rate limits, and availability commitments. We are not responsible for downtime, policy changes, account restrictions, data handling, or losses caused by providers that you choose to connect or by credentials that you configure.",
          ],
        },
        {
          title: "5. Availability, liability, and updates",
          paragraphs: [
            "The service is provided on an as-available and as-updated basis. To the maximum extent permitted by law, KŌMA Studio is not liable for indirect damages, loss of profit, editorial delays, failed external publication, provider outages, or losses caused by unlawful or unauthorized use of the service by the user.",
            "Nothing in these terms excludes non-waivable consumer or privacy rights. We may update these terms and the related legal notices when the product, laws, providers, or risk profile change. The current version is published in the Legal Center, and renewed acceptance may be required for continued use.",
          ],
        },
      ],
    },
    privacy: {
      eyebrow: "Privacy Policy",
      title: "KŌMA Studio Privacy Policy",
      summary:
        "How KŌMA Studio collects, uses, shares, stores, and protects personal data related to accounts, support, security, integrations, and community features.",
      highlights: [
        "KŌMA Studio acts as the controller for the processing described here, except when a third party acts on its own behalf as an independent controller.",
        "We process account, device, support, moderation, and integration data to operate the service, protect users, and comply with legal obligations.",
        "We do not use advertising cookies in the current product and we do not sell personal data.",
      ],
      sections: [
        {
          title: "1. Scope and controller role",
          paragraphs: [
            "This policy applies to KŌMA Studio's desktop application, web authentication flows, support operations, bug-report flows, community areas, and connected services. For the processing described in this policy, KŌMA Studio acts as the controller, except where another provider determines its own purposes and means of processing.",
            "Email providers, AI providers connected by you, external publishing platforms, and infrastructure partners may act as processors or independent controllers depending on the activity. Their own legal documents also apply to the data they process on their own behalf.",
          ],
        },
        {
          title: "2. Categories of personal data",
          paragraphs: [
            "We may collect registration and account data such as display name, email address, verification status, account identifiers, session records, login attempts, trusted-device identifiers, IP-related security signals, and machine or app diagnostics required to secure access and operate the service.",
            "We may also process support and bug-report submissions, community posts and moderation records, integration settings, webhook destinations, provider identifiers, and the files, screenshots, prompts, logs, attachments, or metadata that you choose to submit through the product.",
          ],
        },
        {
          title: "3. Purposes and legal bases",
          paragraphs: [
            "We process personal data to create and administer accounts, authenticate sessions, deliver updates, answer support requests, investigate bugs, operate community areas, prevent abuse, secure infrastructure, comply with legal obligations, enforce our terms, and resolve safety incidents.",
            "Depending on the context, the main legal bases are contract performance, legitimate interests in security and service reliability, compliance with legal obligations, and consent or affirmative user action for optional features such as bug reports, voluntary integrations, BYOK connections, or optional communications. If you are in the European Economic Area, the United Kingdom, Brazil, or a similar jurisdiction, you may have additional statutory rights described below.",
          ],
        },
        {
          title: "4. Sharing, international transfers, and third parties",
          paragraphs: [
            "We share personal data only where necessary to run the service, carry out your instructions, comply with law, prevent fraud, or defend rights. Typical recipients may include hosting and database providers, transactional email providers, support tooling, optional integrations such as Blogger, Imgur, Discord webhooks, and AI services that you connect.",
            "Because these providers may operate in different countries, personal data may be transferred internationally. When required, we rely on contractual, organizational, and technical safeguards appropriate to the transfer and the risk, while recognizing that certain providers will process data under their own legal frameworks and policies.",
          ],
        },
        {
          title: "5. Retention, security, and minors",
          paragraphs: [
            "We retain personal data only for as long as needed for the purposes described in this policy, including service delivery, fraud prevention, security monitoring, incident analysis, legal defense, and regulatory compliance. Different categories may be kept for different periods, and some records cannot be deleted immediately when the law requires retention.",
            "We use measures such as password hashing, session controls, short-lived tokens, webhook validation, audit logs, rate limiting, access controls, and security reviews designed to reduce unauthorized access or abuse. No system is absolutely secure, so you should avoid submitting unnecessary sensitive data. The service is not directed to children below the applicable digital age of consent.",
          ],
        },
        {
          title: "6. Your rights and how to contact us",
          paragraphs: [
            "Subject to the law that applies to you, you may request access, confirmation of processing, correction, portability where available, deletion, anonymization, objection, restriction, withdrawal of consent where consent is the basis, and information about recipients, retention, safeguards, and automated decision-making. We may request reasonable identity verification before acting on a request, and we may keep minimal records of the request and our response for accountability.",
            "Requests about privacy, personal data, cookies, or legal notices must be sent through the official support channel at {supportUrl}. We aim to respond within the periods required by applicable law, including the one-month GDPR reference period when it applies.",
          ],
        },
      ],
    },
    cookies: {
      eyebrow: "Cookie Policy",
      title: "KŌMA Studio Cookie Policy",
      summary:
        "How KŌMA Studio uses cookies, local storage, and related technologies for authentication, security, and product operation.",
      highlights: [
        "The current product relies primarily on strictly necessary cookies and local storage needed to authenticate users and keep the product secure.",
        "The desktop application also stores some data locally through Electron and app storage, not only through browser cookies.",
        "If KŌMA Studio introduces analytics, advertising, or personalization cookies that are not strictly necessary, this policy and related controls will be updated before that use becomes standard.",
      ],
      sections: [
        {
          title: "1. Technologies we use",
          paragraphs: [
            "KŌMA Studio may use HttpOnly cookies, session cookies, browser storage, desktop app storage, remembered-email preferences, device identifiers, and similar technologies to keep users signed in, secure sessions, remember product state, and support login, recovery, and update flows.",
          ],
        },
        {
          title: "2. Strictly necessary cookies",
          paragraphs: [
            "Strictly necessary cookies are used for authentication, session continuity, fraud prevention, abuse detection, account recovery, security checks, and access to protected areas. These technologies are necessary to provide the service requested by the user and are not used for advertising in the current product.",
          ],
          bullets: [
            "Session establishment and controlled expiration.",
            "Security and anti-abuse verification during sign-in and account recovery.",
            "Access continuity where a protected account state must be maintained.",
          ],
        },
        {
          title: "3. Local storage and desktop persistence",
          paragraphs: [
            "KŌMA Studio may store non-sensitive preferences locally, such as interface state, selected language, remembered email, presets, update channel choices, or workflow convenience settings. Integration settings or tokens may also be stored locally when the feature requires it and the product is designed to keep that information on-device where possible.",
          ],
        },
        {
          title: "4. How to manage these technologies",
          paragraphs: [
            "You can clear cookies and local storage through your browser or by signing out and resetting local state from the app where available. Blocking or deleting strictly necessary technologies may prevent sign-in, account recovery, or the normal operation of protected product areas.",
          ],
        },
      ],
    },
    content: {
      eyebrow: "Usage and Content Policy",
      title: "KŌMA Studio Usage and Content Policy",
      summary:
        "Rules for uploaded files, community content, bug reports, external publishing, moderation, and lawful use of KŌMA Studio features.",
      highlights: [
        "You may only process or publish content when you have the rights or lawful authorization to do so.",
        "Community and publishing features may be moderated, restricted, or removed when they create legal, abuse, or safety risk.",
        "Bug reports and optional integrations can send screenshots, logs, attachments, or selected files to third-party services when you trigger those flows.",
      ],
      sections: [
        {
          title: "1. Rights and permissions over content",
          paragraphs: [
            "Editing, OCR, translation, redraw, typesetting, and publishing tools do not grant rights over third-party works. You are solely responsible for checking whether your use of content is lawful in your jurisdiction and whether you have the licenses, permissions, consents, or other legal basis required for that use.",
          ],
        },
        {
          title: "2. Community areas and moderation",
          paragraphs: [
            "Posts, profiles, attachments, applications, and reports submitted to community spaces such as Scanlation Feed may be reviewed by automated systems and human moderators. We may hide, label, remove, restrict, or escalate content that appears misleading, abusive, illegal, infringing, unsafe, or inconsistent with platform integrity.",
          ],
          bullets: [
            "Do not post phishing links, malware, spam, impersonation, or fraudulent recruitment offers.",
            "Do not expose third-party personal data without a lawful basis.",
            "Do not use community areas to coordinate abuse, harassment, or infringement.",
          ],
        },
        {
          title: "3. External publishing, AI providers, and integrations",
          paragraphs: [
            "When you use Blogger, Imgur, Discord webhooks, AI providers, uploads, or other external connectors, you instruct KŌMA Studio to transmit the selected files, prompts, outputs, metadata, and technical instructions needed to complete the action. You are responsible for confirming that the destination, audience, and permissions are appropriate before you trigger the transfer.",
          ],
        },
        {
          title: "4. Bug reports and diagnostics",
          paragraphs: [
            "Bug-report flows may include the current screenshot, attachments, selected logs, environment diagnostics, account context, and technical details that help us investigate a problem. Review all material before submitting it. When the flow uses services such as Discord webhooks or Imgur, the selected material will be sent to those services to process the report.",
          ],
        },
        {
          title: "5. Enforcement",
          paragraphs: [
            "We may limit, suspend, remove, or terminate access to any feature, file, integration, or account when we reasonably believe it is necessary to prevent harm, comply with law, investigate abuse, respond to a valid complaint, protect users, or preserve the integrity of the service. Repeated or severe violations may lead to permanent restrictions.",
          ],
        },
      ],
    },
  },
};
