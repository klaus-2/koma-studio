import type { FreeProviderMetadata, FreeProviderStageModelMetadata } from "./freeAiProviderCatalogBuilders";
import { ACCESS_BADGE_LABELS, FREE_RESOURCES_SOURCE_URL } from "./freeAiProviderCatalogBuilders";

export const PROVIDER_METADATA: Record<string, FreeProviderMetadata> = {
  openrouter: {
    accessType: "mixed",
    accessSummary: "Provider with both free and paid models. On the free tier the quota is shared across the free models.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "20 req/min, 50 req/day; up to 1000 req/day with a US$10 lifetime top-up. Shared quota." },
      ocr: { accessType: "free", rateLimitSummary: "20 req/min, 50 req/day; up to 1000 req/day with a US$10 lifetime top-up. Shared quota." },
      clean: { accessType: "paid", rateLimitSummary: "OpenRouter has a free tier, but these cleaning models do not appear in the free list of the referenced catalog." },
    },
  },
  google_ai_studio: {
    accessType: "mixed",
    accessSummary: "Google AI Studio mixes genuinely free models with others outside the free tier; check the badge on each model.",
    dataPolicyNotice: "Data may be used for training outside the UK/CH/EEA/EU.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "unknown", rateLimitSummary: "Free limits vary per model; use the model badge to tell them apart." },
      ocr: { accessType: "unknown", rateLimitSummary: "Free limits vary per model; use the model badge to tell them apart." },
      clean: { accessType: "paid", rateLimitSummary: "Image edit/generation models do not appear in the free tier of the referenced catalog." },
    },
  },
  nvidia_nim: {
    accessType: "free",
    accessSummary: "NVIDIA NIM offers open models with a free limit, but usually requires phone verification.",
    verificationNotice: "Phone number verification required.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "40 req/min. Context windows tend to be shorter." },
      ocr: { accessType: "free", rateLimitSummary: "40 req/min. Context windows tend to be shorter." },
    },
  },
  mistral_plateforme: {
    accessType: "free",
    accessSummary: "Mistral's Experiment plan allows free per-model usage, with data training enabled on an opt-in basis.",
    verificationNotice: "Phone number verification required.",
    dataPolicyNotice: "Free tier (Experiment plan) requires opting into data training.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "1 req/s, 500k TPM, 1B tokens/mes por modelo." },
    },
  },
  mistral_codestral: {
    accessType: "free",
    accessSummary: "Codestral is still free for now, but only inside Mistral's monthly product/subscription.",
    verificationNotice: "Phone number verification required.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "30 req/min, 2000 req/dia." },
    },
  },
  huggingface_router: {
    accessType: "credit",
    accessSummary: "Usage is covered by a small monthly credit on the Hugging Face router/serverless.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "credit", rateLimitSummary: "US$0.10/month in credits. Serverless usually restricts you to smaller models, with a few popular exceptions." },
      ocr: { accessType: "credit", rateLimitSummary: "US$0.10/month in credits. Serverless usually restricts you to smaller models, with a few popular exceptions." },
      clean: { accessType: "credit", rateLimitSummary: "US$0.10/month in credits; availability depends on the backend/model." },
    },
  },
  vercel_ai_gateway: {
    accessType: "credit",
    accessSummary: "Gateway with a monthly credit to route calls across supported providers.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "credit", rateLimitSummary: "US$5/mes em credito no gateway." },
    },
  },
  cerebras: {
    accessType: "mixed",
    accessSummary: "Not every model on the Cerebras endpoint is on the free grid. The per-model badges show what has been confirmed.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "unknown", rateLimitSummary: "Free limits are per model; check the badge on the selected model." },
    },
  },
  groq: {
    accessType: "free",
    accessSummary: "Groq exposes several models with a per-model free quota and very explicit TPM/RPD limits.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "Free limits vary per model; check the badge on the selected model." },
      ocr: { accessType: "free", rateLimitSummary: "Free limits vary per model; check the badge on the selected model." },
    },
  },
  cohere: {
    accessType: "free",
    accessSummary: "Cohere offers a free quota shared across the listed models.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "20 req/min and 1000 req/month. The monthly quota is shared across models." },
      ocr: { accessType: "free", rateLimitSummary: "20 req/min and 1000 req/month. The monthly quota is shared across models." },
    },
  },
  github_models: {
    accessType: "copilot",
    accessSummary: "Disponibilidade depende do tier do Copilot/GitHub Models; a free tier e extremamente restritiva em input/output.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "copilot", rateLimitSummary: "Limites dependem do tier Copilot (Free/Pro/Pro+/Business/Enterprise)." },
      ocr: { accessType: "copilot", rateLimitSummary: "Limites dependem do tier Copilot (Free/Pro/Pro+/Business/Enterprise)." },
    },
  },
  cloudflare_workers_ai: {
    accessType: "free",
    accessSummary: "Workers AI includes a free daily neuron quota, good for experimenting with open and multimodal models.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "10.000 neurons/dia no plano free." },
      ocr: { accessType: "free", rateLimitSummary: "10.000 neurons/dia no plano free." },
    },
  },
  zhipu_ai: {
    accessType: "free",
    accessSummary: "Zhipu AI/BigModel appears as a free provider in the reference list, but the platform does not publish consolidated limits.",
    verificationNotice: "Chinese phone number may be required.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "Limits are not documented in a consolidated form." },
      ocr: { accessType: "free", rateLimitSummary: "Limits are not documented in a consolidated form." },
    },
  },
  llm7_io: {
    accessType: "free",
    accessSummary: "LLM7.io offers a permanent free tier with open models hosted on an OpenAI-compatible endpoint.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "30 RPM no tier basico; algumas contas chegam a 120 RPM." },
    },
  },
  kluster_ai: {
    accessType: "free",
    accessSummary: "Kluster AI appears in the free provider list, but does not publish consolidated per-model/account limits.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "Limits are not documented in a consolidated form." },
    },
  },
  siliconflow: {
    accessType: "free",
    accessSummary: "SiliconFlow exposes open and multimodal models with a free tier documented in the reference list.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "1,000 RPM and 50k TPM on the free tier, varying per model." },
      ocr: { accessType: "free", rateLimitSummary: "1,000 RPM and 50k TPM on the free tier, varying per model." },
    },
  },
  ollama_cloud: {
    accessType: "free",
    accessSummary: "Ollama Cloud has a light-use free tier and uses the native Ollama API; the app now supports that flow in the translation stage.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "free", rateLimitSummary: "Light usage with 1 concurrent model; billed by GPU time, not by request count." },
    },
  },
  openai: {
    accessType: "paid",
    accessSummary: "Paid BYOK provider. It does not appear in the free resource list consulted.",
  },
  deepseek: {
    accessType: "paid",
    accessSummary: "Paid BYOK provider. It does not appear in the free resource list consulted.",
  },
  xai: {
    accessType: "paid",
    accessSummary: "Paid BYOK provider. It does not appear in the free resource list consulted.",
  },
  z_ai: {
    accessType: "paid",
    accessSummary: "Paid BYOK provider. It does not appear in the free resource list consulted.",
  },
  google_cloud_vertex_ai: {
    accessType: "paid",
    accessSummary: "Vertex AI OpenAI-compatible does not appear as a free provider in the consulted list; treat it as paid BYOC/BYOK.",
  },
  replicate: {
    accessType: "paid",
    accessSummary: "Replicate does not appear in the free LLM API list consulted for this purpose.",
  },
  fireworks: {
    accessType: "trial",
    accessSummary: "Temporary trial credits for testing open models.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "Trial credit: US$1." },
    },
  },
  baseten: {
    accessType: "trial",
    accessSummary: "Baseten grants trial credit to run any supported model, billing by compute.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "Trial credit: US$30." },
    },
  },
  nebius: {
    accessType: "trial",
    accessSummary: "Small initial credit for testing open models.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "Trial credit: US$1." },
    },
  },
  novita: {
    accessType: "trial",
    accessSummary: "Trial pequeno, mas com validade longa.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "Trial credit: US$0,5 por 1 ano." },
    },
  },
  ai21: {
    accessType: "trial",
    accessSummary: "AI21 grants a trial credit for the Jamba family.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "Trial credit: US$10 por 3 meses." },
    },
  },
  upstage: {
    accessType: "trial",
    accessSummary: "Upstage libera credito inicial para Syn/Solar.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "Trial credit: US$10 por 3 meses." },
    },
  },
  nlp_cloud: {
    accessType: "trial",
    accessSummary: "NLP Cloud funciona com trial credit, sujeito a verificacao por telefone.",
    verificationNotice: "Phone number verification required.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "Trial credit: US$15." },
    },
  },
  alibaba_model_studio: {
    accessType: "credit",
    accessSummary: "Model Studio offers an initial per-model token quota, not an unrestricted free tier.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "credit", rateLimitSummary: "1.000.000 tokens/modelo." },
    },
  },
  modal: {
    accessType: "trial",
    accessSummary: "Modal offers an entry-level monthly credit, plus more credit once you add a payment method.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "US$5/month on account creation; US$30/month after adding a payment method." },
    },
  },
  inference_net: {
    accessType: "trial",
    accessSummary: "Inference.net libera credito inicial e mais credito apos survey por email.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "US$1 inicial; US$25 apos responder survey por email." },
    },
  },
  hyperbolic: {
    accessType: "trial",
    accessSummary: "Hyperbolic grants a small credit for open and multimodal models.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "Trial credit: US$1." },
      ocr: { accessType: "trial", rateLimitSummary: "Trial credit: US$1." },
    },
  },
  sambanova_cloud: {
    accessType: "trial",
    accessSummary: "SambaNova grants temporary credit for open and proprietary models.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "trial", rateLimitSummary: "Trial credit: US$5 por 3 meses." },
    },
  },
  scaleway_generative_apis: {
    accessType: "credit",
    accessSummary: "Scaleway libera cota inicial de tokens gratuita por projeto.",
    sourceUrl: FREE_RESOURCES_SOURCE_URL,
    stageDefaults: {
      translation: { accessType: "credit", rateLimitSummary: "1.000.000 tokens gratuitos." },
      ocr: { accessType: "credit", rateLimitSummary: "1.000.000 tokens gratuitos." },
    },
  },
};

export const PROVIDER_STAGE_MODEL_METADATA: Record<string, FreeProviderStageModelMetadata> = {
  openrouter: {
    clean: {
      "google/gemini-2.5-flash": { accessType: "paid", accessBadgeLabel: ACCESS_BADGE_LABELS.paid },
      "openai/gpt-4o-mini": { accessType: "paid", accessBadgeLabel: ACCESS_BADGE_LABELS.paid },
      "openai/gpt-4o": { accessType: "paid", accessBadgeLabel: ACCESS_BADGE_LABELS.paid },
    },
  },
  google_ai_studio: {
    translation: {
      "gemini-2.5-flash": { accessType: "free", rateLimitSummary: "250k TPM, 20 req/dia, 5 RPM." },
      "gemini-2.5-flash-lite": { accessType: "free", rateLimitSummary: "250k TPM, 20 req/dia, 10 RPM." },
      "gemini-2.5-pro": { accessType: "paid", rateLimitSummary: "It does not appear in the free tier of the referenced catalog." },
      "gemma-3-27b-it": { accessType: "free", rateLimitSummary: "15k TPM, 14.400 req/dia, 30 RPM." },
      "gemma-3-12b-it": { accessType: "free", rateLimitSummary: "15k TPM, 14.400 req/dia, 30 RPM." },
      "gemma-3-4b-it": { accessType: "free", rateLimitSummary: "15k TPM, 14.400 req/dia, 30 RPM." },
      "gemma-3-1b-it": { accessType: "free", rateLimitSummary: "15k TPM, 14.400 req/dia, 30 RPM." },
    },
    ocr: {
      "gemini-2.5-flash": { accessType: "free", rateLimitSummary: "250k TPM, 20 req/dia, 5 RPM." },
      "gemini-2.5-flash-lite": { accessType: "free", rateLimitSummary: "250k TPM, 20 req/dia, 10 RPM." },
      "gemini-2.5-pro": { accessType: "paid", rateLimitSummary: "It does not appear in the free tier of the referenced catalog." },
    },
    clean: {
      "gemini-2.5-flash-image": { accessType: "paid", rateLimitSummary: "Image edit/generation models do not appear in the free tier of the referenced catalog." },
      "gemini-2.5-flash": { accessType: "paid", rateLimitSummary: "Gemini 2.5 Flash is free for text/vision, not as a native image-editing flow." },
    },
  },
  cerebras: {
    translation: {
      "gpt-oss-120b": { accessType: "free", rateLimitSummary: "30 RPM, 60k TPM, 900 req/h, 1M tokens/h, 14.4k req/dia." },
      "llama3.1-8b": { accessType: "free", rateLimitSummary: "30 RPM, 60k TPM, 900 req/h, 1M tokens/h, 14.4k req/dia." },
    },
  },
  groq: {
    translation: {
      "groq/compound": { accessType: "free", rateLimitSummary: "250 req/dia, 70k TPM." },
      "groq/compound-mini": { accessType: "free", rateLimitSummary: "250 req/dia, 70k TPM." },
      "llama-3.1-8b-instant": { accessType: "free", rateLimitSummary: "14.400 req/dia, 6k TPM." },
      "llama-3.3-70b-versatile": { accessType: "free", rateLimitSummary: "1000 req/dia, 12k TPM." },
      "meta-llama/llama-4-scout-17b-16e-instruct": { accessType: "free", rateLimitSummary: "1000 req/dia, 30k TPM." },
      "openai/gpt-oss-120b": { accessType: "free", rateLimitSummary: "1000 req/dia, 8k TPM." },
      "openai/gpt-oss-20b": { accessType: "free", rateLimitSummary: "1000 req/dia, 8k TPM." },
      "qwen/qwen3-32b": { accessType: "free", rateLimitSummary: "1000 req/dia, 6k TPM." },
    },
    ocr: {
      "meta-llama/llama-4-scout-17b-16e-instruct": { accessType: "free", rateLimitSummary: "1000 req/dia, 30k TPM." },
    },
  },
};
