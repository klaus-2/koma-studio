"use client";

import { useEffect } from "react";

type JsonSchema = {
  type: "object";
  properties?: Record<string, unknown>;
  required?: string[];
  additionalProperties?: boolean;
};

type ToolExecutionResult = {
  content: Array<{ type: "text"; text: string }>;
  structuredContent?: Record<string, unknown>;
};

type ModelContextTool = {
  name: string;
  description: string;
  inputSchema: JsonSchema;
  execute: (input: Record<string, unknown>) => Promise<ToolExecutionResult> | ToolExecutionResult;
};

type ModelContextProvider = {
  provideContext: (context: { tools: ModelContextTool[] }) => Promise<void> | void;
};

declare global {
  interface Navigator {
    modelContext?: ModelContextProvider;
  }
}

const WEBSITE_URL = "https://koma-studio.site";
const WINDOWS_DOWNLOAD_URL = `${WEBSITE_URL}/download/windows`;
const DISCORD_URL = "https://discord.gg/tzaV2efD4e";
const CHAT_URL = "https://chat.koma-studio.site";

export function WebMcpProvider() {
  useEffect(() => {
    if (!navigator.modelContext?.provideContext) {
      return;
    }

    const tools: ModelContextTool[] = [
      {
        name: "download_koma_studio_windows",
        description: "Returns the stable Windows download URL for KOMA Studio.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => ({
          content: [{ type: "text", text: `Download KOMA Studio for Windows: ${WINDOWS_DOWNLOAD_URL}` }],
          structuredContent: {
            url: WINDOWS_DOWNLOAD_URL,
            platform: "windows",
            channel: "stable",
          },
        }),
      },
      {
        name: "open_koma_community",
        description: "Returns the primary KOMA Studio community and support links.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => ({
          content: [{ type: "text", text: `Community: ${DISCORD_URL}\nChat: ${CHAT_URL}` }],
          structuredContent: {
            discord: DISCORD_URL,
            chat: CHAT_URL,
          },
        }),
      },
      {
        name: "list_koma_agent_resources",
        description: "Returns the main machine-readable discovery URLs for KOMA Studio.",
        inputSchema: {
          type: "object",
          properties: {},
          additionalProperties: false,
        },
        execute: async () => ({
          content: [{ type: "text", text: `LLMS: ${WEBSITE_URL}/llms.txt\nAPI catalog: ${WEBSITE_URL}/.well-known/api-catalog\nAgent skills: ${WEBSITE_URL}/.well-known/agent-skills/index.json\nMCP card: ${WEBSITE_URL}/.well-known/mcp/server-card.json` }],
          structuredContent: {
            llms: `${WEBSITE_URL}/llms.txt`,
            apiCatalog: `${WEBSITE_URL}/.well-known/api-catalog`,
            agentSkills: `${WEBSITE_URL}/.well-known/agent-skills/index.json`,
            mcpCard: `${WEBSITE_URL}/.well-known/mcp/server-card.json`,
          },
        }),
      },
    ];

    void navigator.modelContext.provideContext({ tools });
  }, []);

  return null;
}
