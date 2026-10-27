/**
 * Every factual statement here is backed by code in this repository. Where a detail could not be
 * measured (retention windows, hosting location, entity name) the sentence states the absence
 * instead of inventing a number.
 *
 * Dates and versions are literals on purpose: deriving them from a clock at build time would
 * silently restamp the effective date on every deploy.
 */

export interface LegalSection {
  readonly id: string;
  readonly title: string;
  readonly paragraphs: readonly string[];
  readonly bullets?: readonly string[];
}

export interface LegalDocument {
  readonly slug: "terms-of-service" | "privacy-policy";
  readonly title: string;
  readonly metaTitle: string;
  readonly metaDescription: string;
  readonly lead: string;
  readonly scopeNote: string;
  readonly version: string;
  readonly effectiveDate: string;
  readonly sections: readonly LegalSection[];
}

const SCOPE_NOTE =
  "This page governs the website and the distributed artifacts. The legal text you accept inside the app is versioned in the app itself — this page does not replace it.";

const CONTACT_LINE =
  "Contact: open an issue or discussion at https://github.com/klaus-2/koma-studio, or reach the maintainer on Discord at https://discord.gg/tzaV2efD4e. Do not email — koma-studio.site has no mail records, so any address there is undeliverable.";

export const TERMS: LegalDocument = {
  slug: "terms-of-service",
  title: "Terms of Service",
  metaTitle: "Terms of Service | KOMA Studio",
  metaDescription:
    "The rules for using the KOMA Studio website, the MIT-licensed desktop application, and the optional services we host. Version 1.0, effective 2026-10-27.",
  lead: "These terms govern your use of the KOMA Studio website and of the application and artifacts we distribute from it.",
  scopeNote: SCOPE_NOTE,
  version: "Version 1.0",
  effectiveDate: "2026-10-27",
  sections: [
    {
      id: "what-these-terms-govern",
      title: "What these terms cover",
      paragraphs: [
        "KOMA Studio is three separate things, and the rules differ for each. There is the website you are reading. There is the desktop application, which is MIT-licensed software you can read, fork and rebuild. And there is a small set of services the project runs for the community, which are optional and can be self-hosted.",
        "The license governs the code. These terms govern the services we operate and the way you use them. Using the app under the license needs no agreement from you beyond the license itself.",
        "No governing law or court is chosen here. The project is maintained by one person in one country and used in many, and a clause naming a jurisdiction would be a promise nobody is positioned to enforce. Protections that your country's consumer and data-protection law gives you, and says you cannot give up, still apply. We do not try to take them away.",
      ],
    },
    {
      id: "free-forever",
      title: "Free software, and it stays free",
      paragraphs: [
        "There is no plan, tier, quota, credit balance, entitlement or invoice anywhere in this project. Project policy forbids them: a pull request that adds a paywall or a billing flow gets closed without further discussion.",
        "Because the code is MIT, you can also build it yourself, fork it, or ship a modified copy of your own. These terms do not narrow what the license grants you.",
      ],
    },
    {
      id: "licenses-you-inherit",
      title: "Licenses you inherit with the models",
      paragraphs: [
        "Our code is MIT. The models the app downloads are not, and the difference matters if you distribute what you make.",
        "Comic Text Detector is GPL-3.0, which carries copyleft obligations that a downstream build has to honor. Manga OCR, Pororo/brainOCR, PaddleOCR, LaMa and EasyOCR are Apache-2.0. Some Pororo checkpoints are CC-BY-NC-SA-4.0, which does not permit commercial use. Translation models you install yourself, in CTranslate2 or GGUF form, vary per checkpoint and are not vetted by the project.",
        "The repository lists these in docs/THIRD-PARTY-NOTICES.md and the app names the model it is about to fetch. Checking the license of a specific model card, and respecting it in your release, is your job, not ours.",
      ],
    },
    {
      id: "pre-release",
      title: "This is pre-release software",
      paragraphs: [
        "The project says so in its own security policy: the current release is pre-release software and has not been through a formal security audit. Things break. Keep backups of your projects.",
        "It is a volunteer project. There is no support contract, no uptime target and no bug bounty. Response times are what one maintainer with a day job can give.",
      ],
    },
    {
      id: "updates-are-manual",
      title: "Updates install only when you say so",
      paragraphs: [
        "The app looks for new versions by sending an unauthenticated request to the GitHub Releases API for this repository, shortly after launch, then about every minute while it is open, and again when the window regains focus. No account, device or installation identifier is in that request. GitHub still sees your IP address and the webview's user agent.",
        "Nothing downloads or installs on its own. Accepting an update opens the release page and you run the installer yourself. Forced updates are not implemented: the update state the app reports always carries mandatory and blocking as false.",
      ],
    },
    {
      id: "your-content",
      title: "Your content, your conduct",
      paragraphs: [
        "You keep the rights to what you bring in. Translating, cleaning or redrawing a page gives you no rights over the page. Before you process or publish somebody else's work, satisfy yourself that you are allowed to where you live and that you have permission where permission is needed. The tools grant nothing and validate nothing.",
        "When you run an AI feature, your material leaves your machine and goes to the endpoint you configured. The privacy policy on this site spells out exactly what is sent. Pick a provider whose terms suit the material you are sending it.",
      ],
      bullets: [
        "Do not use the app or our services to distribute malware, phishing pages, or material that is illegal where you are.",
        "Do not use the community areas to harass, impersonate, defraud, or post fraudulent recruitment.",
        "Do not circumvent the technical limits we put on the hosted services to slow down abuse.",
        "Do not publish work you have no right to publish, including through the community feed.",
      ],
    },
    {
      id: "contributions",
      title: "Contributing",
      paragraphs: [
        "Contributions arrive under the project's existing MIT license. There is no contributor license agreement and no developer certificate of origin, so a merged pull request is licensed to the project rather than assigned away from you; you keep the copyright on code you wrote.",
        "The Contributor Covenant applies in the repository, on Discord, and anywhere you represent the project. Reports go to the maintainer, and enforcement runs from a correction through a warning and a temporary ban to a permanent one.",
      ],
    },
    {
      id: "no-warranty",
      title: "No warranty",
      paragraphs: [
        "The software comes as is, without warranty of any kind, express or implied, exactly as the MIT license states it. The authors are not liable for damages arising from use of, or inability to use, the software.",
        "Practical version of the same sentence: an AI pass can mistranslate a line, miss a speech bubble, or damage art, and a release you ship without reviewing it is your problem. Check before publishing.",
      ],
    },
    {
      id: "changes-to-these-terms",
      title: "Changes to these terms",
      paragraphs: [
        "This page carries a version number and an effective date at the top. A new version replaces the text above it, and this URL always serves the current one.",
        "When a change would genuinely surprise someone, it gets announced on Discord and in the repository release notes instead of only being swapped in here.",
      ],
    },
    {
      id: "contact",
      title: "Contact",
      paragraphs: [
        CONTACT_LINE,
        "For a security problem, use a GitHub private security advisory rather than a public issue. The project's security policy describes the process and the response targets it aims at.",
      ],
    },
  ],
};

export const PRIVACY: LegalDocument = {
  slug: "privacy-policy",
  title: "Privacy Policy",
  metaTitle: "Privacy Policy | KOMA Studio",
  metaDescription:
    "What the KOMA Studio website, the software on your machine, and the optional services we host actually handle: update checks, model downloads, your own AI keys, bug reports and account records. Version 1.0, effective 2026-10-27.",
  lead: "This policy says what data the KOMA Studio website, the software on your machine, and the optional services we host actually handle.",
  scopeNote: SCOPE_NOTE,
  version: "Version 1.0",
  effectiveDate: "2026-10-27",
  sections: [
    {
      id: "three-scopes",
      title: "Three scopes, because they are not the same",
      paragraphs: [
        "Which machine holds the data changes depending on what you are using, so the answer is split three ways.",
        "This website is static files. The desktop application works on your own machine, where your raw pages, projects, settings and downloaded models live, and where no server of ours sits in the loop. The hosted services, at auth.koma-studio.site and chat.koma-studio.site, are the only place the project itself receives and stores personal data, and shipped builds turn authentication off, so reaching them is a deliberate choice.",
        "If you run the auth server yourself, the operator of that instance holds your data, not this project. The rest of this document describes our deployment.",
      ],
      bullets: [
        "Website: no cookies, no analytics, no sign-in. One visible exception, listed below.",
        "App on your machine: no telemetry. Content goes to the AI provider you configure.",
        "Hosted services, optional: account, session, security and community records, described in section 8.",
      ],
    },
    {
      id: "this-website",
      title: "What happens in your browser on this site",
      paragraphs: [
        "The site is a static export served through Cloudflare. It sets no cookie and runs no third-party script, and the fonts are compiled into the bundle, so a visit does not send your browser to Google for typefaces. The responses themselves carry no Set-Cookie header.",
        "Two components do make requests from your browser to the GitHub API: one reads the repository's star count, the other resolves the newest release's download URL. Those calls show GitHub your IP address, your user agent and the fact that you loaded this page. That is the site's entire external traffic.",
        "If you sign in on auth.koma-studio.site, the auth service names its session cookie for the whole .koma-studio.site domain, so that cookie is also sent when you visit this site. It originates from the auth server, not from these pages.",
        "Cloudflare sits between visitors and the origin, so it sees each request's IP, user agent and URL as part of serving the site. The origin is a single VPS maintained by the project.",
      ],
    },
    {
      id: "the-app-collects-nothing",
      title: "The app collects nothing about you",
      paragraphs: [
        "There is no analytics, telemetry or crash reporting in the shipped product. Neither desktop shell depends on an analytics or error-reporting SDK, no code imports one, and the auth server explicitly disables the built-in telemetry of the library it uses. The project's contribution rules put it more bluntly: a pull request that adds analytics, usage tracking or automatic beaconing will be closed.",
        "Logs stay local. The Electron build appends a session log inside its own user-data folder, the Tauri build writes through its log plugin, and the auth server, when you run one, writes redacted log files on that same server. None of it is uploaded anywhere.",
        "Three kinds of traffic do leave your machine, and calling all of it zero telemetry would be wrong:",
      ],
      bullets: [
        "Update checks: an unauthenticated GET to the GitHub Releases API for this repository, on launch, about every minute, and on window focus. Your IP and the webview user agent are visible to GitHub. No app, device or install identifier is sent, and nothing auto-downloads.",
        "Model downloads: weights come only from huggingface.co, hf.co, modelscope.cn, github.com or githubusercontent.com, over HTTPS. To verify a checksum the app asks HuggingFace's API for a specific model revision first, so that host learns which model you are fetching.",
        "The desktop app's own HTTP requests carry a user agent of the form KOMA-Studio/<version>, so every host it contacts sees the app version.",
      ],
    },
    {
      id: "your-ai-provider",
      title: "What your AI provider receives",
      paragraphs: [
        "Most of what leaves your machine leaves through your own AI provider, not through us. Translation sends the text extracted from a page. AI cleaning and redraw send actual pictures: PNG crops of the page, base64-encoded, capped at 32 MiB per image, together with the prompt and instructions.",
        "That traffic goes to whichever endpoint you configured, at a provider you chose and contracted with, under their retention and training terms. The project sees none of it, keeps no copy, and has no agreement with anyone on your behalf.",
        "If keeping the art on your machine is the requirement, run a local model. The same screens work against one.",
      ],
    },
    {
      id: "where-your-keys-live",
      title: "Where your API keys live",
      paragraphs: [
        "Keys never leave your machine in our builds. The Tauri app stores them in the operating system's own credential store, through Windows Credential Manager, the macOS Keychain or libsecret, inside containers that zero themselves, and never writes them to disk. Only non-secret profile metadata, such as the base URL and model name, goes into app data as JSON.",
        "The Electron app uses Chromium's safeStorage, which encrypts with an OS-provided key where that is available. Where it is not, the app writes the profile, key included, as plaintext JSON in its store folder. So the accurate statement is: encrypted at rest where the operating system provides it, not encrypted everywhere. The app reports whether its secure storage was available.",
      ],
    },
    {
      id: "bug-reports",
      title: "Bug reports are opt-in and less anonymous than they look",
      paragraphs: [
        "Submitting a report is always a user action. But the report is not only what you typed. It assembles a technical snapshot: app version, platform, OS release and architecture, the Node, Electron and Chrome versions, the update channel you are on, the configured local and auth API URLs, and the email address of the signed-in account if there is one.",
        "Alongside that it attaches up to twelve automatically collected log files, roughly 1.5 MB each, plus a screenshot if you add one and up to five files you choose. The bundle is POSTed to the project's Discord webhook, so it arrives in a Discord channel. If the deployment configures Imgur for image hosting, the screenshot is uploaded there first and linked.",
        "Look at the attachment list before sending. Drop a report if it would expose a project name or art you do not want in a public channel.",
      ],
    },
    {
      id: "rich-presence",
      title: "Discord Rich Presence",
      paragraphs: [
        "Optional and off unless you turn it on. When enabled, Discord displays which mode of the studio you are in, chosen from a fixed list of strings such as AIO Pipeline or Translator Mode. It carries no project name, file name, chapter title or page count, and the project receives nothing from it.",
      ],
    },
    {
      id: "accounts",
      title: "Accounts on the services we host",
      paragraphs: [
        "Shipped builds set the authentication bypass on, so you can use the whole app without an account, and desktop device registration defaults to off. The account system exists for people who opt into the community feed, model ratings and cross-device settings.",
        "If you do register, the PostgreSQL store keeps: display name, a unique email address, whether that address was verified, an avatar URL, your locale, an argon2 password hash, a failed-attempt counter and a lockout timestamp, the time and IP of your last login, and a login history of entries holding timestamp, IP, success and user agent. Sessions keep a token, expiry, IP address and user agent. A security log keeps action, severity, IP, user agent and metadata. The legal-acceptance table keeps the versions of the terms and privacy policy you accepted, with the IP and user agent at that moment. Community features add posts, applications, reports and model reviews.",
        "The security settings: argon2 with memory cost 19456 and time cost 2, passwords of at least twelve characters, sessions that expire after thirty minutes, cookies that are HttpOnly, SameSite=Strict and marked Secure in production, and twenty requests per sixty seconds per client in production. There is no social login and no Discord login; Discord appears only as a destination for moderation webhooks.",
        "Two third parties can see parts of this, and only where the feature is configured. Verification and password-reset mail is sent through Resend, which therefore sees the address and name on the message. The breached-password check sends the first five hexadecimal characters of the SHA-1 of your password to the Have I Been Pwned range API and matches the rest locally, so the password itself is never transmitted. Cloudflare Turnstile, if enabled, sees the captcha challenge.",
        "On deletion: the schema declares ON DELETE CASCADE on eleven references to the user row, so removing an account takes its sessions, devices, feed posts, applications and reviews with it. No self-service export or delete endpoint exists in the code today, which means a request reaches the maintainer through GitHub or Discord and is carried out directly. The schema sets no expiry on these rows, so they persist until an account is removed or an operator clears them, and we publish no retention period per table because none is implemented.",
        "One thing the service does not do, despite having code for it: the device-fingerprint check that would gate repeat signups is disabled, and its registration-identity table is never written. Signups are not fingerprinted.",
      ],
    },
    {
      id: "what-we-do-not-do",
      title: "What we do not do",
      paragraphs: [
        "Each of these is a measured absence rather than a policy promise:",
      ],
      bullets: [
        "No selling of personal data, and no sharing it for advertising.",
        "No advertising cookies, pixels or third-party analytics on this site.",
        "No analytics, telemetry or automatic crash reporting in the desktop app.",
        "No payment data of any kind, because there is nothing to pay for.",
        "No collection from a device fingerprint, which is switched off in the auth server.",
      ],
    },
    {
      id: "your-rights",
      title: "Your rights and how to reach us",
      paragraphs: [
        "Send requests through GitHub or Discord. You can ask to access what we hold about you, have it corrected, have it deleted, or take a copy where the stored format allows one. You can object to a basis we are processing on and withdraw a consent you gave.",
        "We may ask you to confirm your identity from the account or contact route the data is already attached to. A stranger who happens to know your email address should not be able to collect your feed posts.",
        "This is a volunteer project with no support queue, so nobody here will quote you a service-level agreement we cannot staff. Where your country's law sets a deadline for answering a data request, that deadline is the one we work to.",
        "The hosted service makes no automated decisions about you and builds no advertising profile. No data protection officer and no regional representative has been appointed; the maintainer is the contact for both roles.",
      ],
    },
    {
      id: "changes-to-this-policy",
      title: "Changes to this policy",
      paragraphs: [
        "This page carries a version and an effective date at the top. A new version replaces the text above it and this URL always serves the current one. Substantive changes get posted on Discord and in the repository release notes.",
        "The version you accepted inside the application is stored in the auth service's legal-acceptance table and shown in the app's legal center. That version is what governs what you agreed to there.",
      ],
    },
    {
      id: "who-is-responsible",
      title: "Who is responsible",
      paragraphs: [
        "KOMA Studio is an open-source project maintained by Klaus. It is not a company. There is no legal entity, registered address, registration number or VAT identifier behind it, and the MIT license file names the same person as the copyright holder.",
        "For the hosted services and this website, the maintainer decides what data is collected and what it is used for, and handles requests about it. For the desktop app, the maintainer writes the code but has no access to your machine or your projects.",
        CONTACT_LINE,
      ],
    },
  ],
};

export const LEGAL_DOCS: readonly LegalDocument[] = [TERMS, PRIVACY];

export const LEGAL_PATHS: readonly string[] = [
  "/terms-of-service",
  "/privacy-policy",
];
