import { SITE_GITHUB_URL, SITE_LICENSE, SITE_LICENSE_URL } from "@/lib/project";
import type { FaqItem } from "@/types";

export const landingFaqs: FaqItem[] = [
  {
    question: "What is scanlation software?",
    answer:
      "Scanlation software is a specialized application designed to streamline manga fan-translation work. It combines translation, cleaning, typesetting, redraw, and review into one workflow instead of forcing teams to juggle separate tools. KŌMA Studio is an open-source, MIT-licensed take on that idea.",
  },
  {
    question: "Is KŌMA Studio open source?",
    answer: `Yes. The source code is published on GitHub (${SITE_GITHUB_URL}) under the ${SITE_LICENSE} license. You can read every line, build your own binary, fork the project, or contribute changes back.`,
  },
  {
    question: `Which license does it use, and can I use it commercially?`,
    answer: `KŌMA Studio is ${SITE_LICENSE}-licensed (${SITE_LICENSE_URL}). You can use it commercially, modify it, redistribute it, and even ship your own fork — the only requirement is keeping the license notice.`,
  },
  {
    question: "Is it really free, or is there a paid tier?",
    answer:
      "It is free, with no paywalled features. The app itself costs nothing and has no credits or seats. The only money that can change hands is what you pay your own AI provider if you choose to use a hosted model — nothing goes to us.",
  },
  {
    question: "Do I need to bring my own API keys?",
    answer:
      "You can. Point KŌMA at OpenAI, Anthropic, Google Gemini, or any OpenAI-compatible endpoint — including a local model running on your own machine. Nothing is hard-wired to a single vendor.",
  },
  {
    question: "Can I self-host it or use it without an account?",
    answer:
      "Yes. KŌMA is a desktop application, not a service. There is no account to create, no license server to reach, and no usage telemetry. Your projects stay on your own disk.",
  },
  {
    question: "What operating systems does KŌMA Studio support?",
    answer:
      "KŌMA Studio targets Windows, macOS, and Linux. Because it is open source, unsupported or future platforms can also be built from the repository.",
  },
  {
    question: "How accurate is the AI manga translation?",
    answer:
      "KŌMA is tuned for manga dialogue, narration, and balloon structure, so the first draft lands closer to production-ready wording than a generic translator. Accuracy also depends on the model you choose — human review still matters, but the first-pass workload drops sharply.",
  },
  {
    question: "Does KŌMA Studio work offline?",
    answer:
      "Local stages such as organization, typesetting, cleanup, review, and export run entirely on your machine. AI-assisted steps need a model: use a local model to stay offline, or a hosted provider when you want more capacity.",
  },
  {
    question: "Is my manga content private?",
    answer:
      "Yes. Projects stay inside your workspace, pages are processed locally, and any AI call goes only to the provider you configured. KŌMA does not collect usage analytics or page content.",
  },
  {
    question: "How do I contribute?",
    answer:
      "Open an issue, pick up a good first issue, send a pull request, translate the UI, or improve the docs. Bug reports with reproducible sample pages are just as valuable as code. The contributing guide on the site walks through the first PR.",
  },
  {
    question: "Where can I see the roadmap?",
    answer:
      "Development happens in the open: GitHub issues and milestones show what is being worked on next, and the Discord community is where priorities get argued about. Feature requests from contributors shape the roadmap.",
  },
  {
    question: "Can I use KŌMA solo or with a team?",
    answer:
      "Both. Solo creators can run the full pipeline in one app, while teams can split roles across translation, cleanup, redraw, lettering, and QA without losing chapter continuity.",
  },
  {
    question: "Is there a Photoshop alternative for manga editing?",
    answer:
      "Yes. KŌMA is designed as an open-source Photoshop alternative for scanlation teams that want a purpose-built workflow rather than forcing a general editor — with a subscription — to act like an entire production system.",
  },
];
