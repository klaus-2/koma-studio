# KŌMA Studio Discord Support Bot

The official KŌMA Studio support bot for end users. It answers questions, builds step-by-step tutorials and explains app workflows and errors, using the KŌMA codebase and documentation as its source of truth.

## About the bot

The bot behaves like a product assistant, not a developer tool. It:

- detects the language of each message and replies in that same language;
- teaches workflows such as AIO, Cleaner, Translator, Stitch, Watermark, and export;
- explains errors and common issues found in the app;
- retrieves real context from the codebase with RAG (LlamaIndex + ChromaDB);
- generates responses through KŌMA's free/cloud provider catalog and fails over automatically when one hits a rate limit or quota;
- prioritizes user-facing sources in the product, such as:
  - `packages/interface/src/data/guides-data.ts`
  - `packages/interface/src/data/resources-data.ts`
  - `packages/interface/src/constants/dashboard.constants.ts`
  - `packages/interface/src/i18n/langs/ptBR.ts`
  - the public FAQ and relevant READMEs.

## Prerequisites

- Python **3.10+** (recommended: **3.12**, already the default Python runtime for the project's backends)
- `pip`
- A Discord bot token
- At least one cloud response provider configured in `.env`
- OpenAI (`OPENAI_API_KEY`) or Ollama for embeddings/indexing
- Permission to enable the Message Content intent in the Discord Developer Portal

## Step-by-step setup

### 1. Enter the bot folder

```bash
cd apps/discord-support-bot
```

### 2. Create and activate the virtual environment

Windows (PowerShell):

```powershell
python -m venv .venv
.venv\Scripts\Activate.ps1
```

Linux/macOS:

```bash
python -m venv .venv
source .venv/bin/activate
```

### 3. Install the dependencies

```bash
pip install -r requirements.txt
```

### 4. Configure the environment

```bash
cp .env.example .env
```

Edit `.env` with:

- `DISCORD_BOT_TOKEN`
- `DISCORD_GUILD_ID` (optional, but recommended for fast slash command sync)
- `OPENAI_API_KEY` or `USE_OLLAMA=true` for embeddings/indexing
- at least one `LLM_PROVIDER_*` block enabled with valid credentials
- `CODEBASE_PATH`

By default, `CODEBASE_PATH=../../` so the KŌMA repository is indexed from this folder.

### 5. Index the knowledge base

```bash
python indexer.py --force
```

### 6. Run the bot

```bash
python bot.py
```

On first run, the bot can also index automatically if it doesn't find a ready-made index.

## How to create the bot in the Discord Developer Portal

1. Go to: [Discord Developer Portal](https://discord.com/developers/applications)
2. Click **New Application**
3. Give it a name, for example: `Koma Assistant`
4. Go to **Bot** and click **Add Bot**
5. Copy the token and put it in `DISCORD_BOT_TOKEN`
6. Enable the intents:
   - `MESSAGE CONTENT INTENT`
   - `SERVER MEMBERS INTENT` is not required for this bot
7. In **OAuth2 > URL Generator**, select:
   - Scopes:
     - `bot`
     - `applications.commands`
   - Bot Permissions:
     - `View Channels`
     - `Send Messages`
     - `Read Message History`
     - `Embed Links`
     - `Create Public Threads`
     - `Send Messages in Threads`
     - `Use External Emojis`

## How to invite the bot to your server

After generating the URL in the Developer Portal, open the link in your browser and select the target server.

If you prefer to assemble it manually:

```text
https://discord.com/oauth2/authorize?client_id=YOUR_CLIENT_ID&scope=bot%20applications.commands&permissions=274877975616
```

Replace `YOUR_CLIENT_ID` with the bot's Application ID.

## How to index or update the knowledge base

Manual indexing:

```bash
python indexer.py --force
```

On Discord, admins can also use:

```text
!reindex
```

The index is persisted in `./chroma_db/`, so the bot doesn't need to rebuild embeddings on every restart.

## Available commands

### Public

- `!k <question>`: ask the assistant a free-form question
- `/ask <question>`: same idea, via slash command
- `/help`: shows examples and capabilities
- `/tutorial <feature>`: generates a step-by-step guide focused on a KŌMA feature
- `@KomaBot <question>`: mention the bot directly

### Admin

- `!reindex`: forces a reindex
- `!status`: shows index statistics
- `!clear <user_id>`: clears a user's cached history

## Troubleshooting

### Slash commands don't show up

- Set `DISCORD_GUILD_ID` in `.env` for instant sync on the test server
- Restart the bot
- Check that the `applications.commands` scope was included in the invite

### The bot doesn't respond to `!k`

- Verify that the Message Content Intent is enabled
- Confirm the bot has permission to read and send messages in the channel
- If `ALLOWED_CHANNEL_IDS` is set, the channel must be in that list

### The bot doesn't create a thread

- Make sure these permissions are granted:
  - `Create Public Threads`
  - `Send Messages in Threads`
- If the channel doesn't support threads, the bot falls back and replies in the channel itself

### Indexing fails or is very slow

- Run `python indexer.py --force`
- Confirm `OPENAI_API_KEY` or `USE_OLLAMA=true`
- Check that `CODEBASE_PATH` points to the correct project root
- Avoid multiple processes writing to the same `VECTOR_DB_PATH` at the same time

### The bot answers with something outdated or incomplete

- Run `!reindex`
- If the question involves new features, confirm they are already reflected in the indexed frontend/docs

### The bot doesn't respond at all or says no provider is configured

- Enable at least one provider in `.env`, for example:
  - `LLM_PROVIDER_OPENROUTER_ENABLED=true`
  - `LLM_PROVIDER_OPENROUTER_API_KEY=...`
- Check `LLM_PROVIDER_PRIORITY`
- Use `!status` to inspect the list of loaded providers

### A provider hits a rate limit

- The bot puts that provider on a temporary cooldown and rotates to the next configured provider in the list
- Adjust `LLM_RATE_LIMIT_COOLDOWN_SECONDS` if you want a longer or shorter window

## Ollama alternative

To run without API costs:

1. Install Ollama
2. Download an LLM and an embedding model
3. Adjust `.env`:

```env
USE_OLLAMA=true
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=llama3.1
OLLAMA_EMBEDDING_MODEL=nomic-embed-text
```

Then run as usual:

```bash
python indexer.py --force
python bot.py
```

## Architecture notes

- Conversation history is kept in memory per user (last 10 messages)
- The retriever boosts the ranking of guides, resources, dashboard constants and UI strings
- Replies avoid raw paths and large blocks of source code
- Response generation uses the free/cloud catalog already present in KŌMA and prefers providers configured via `LLM_PROVIDER_PRIORITY`
- When a provider returns `429`, quota exhausted or a temporary backend error, the bot fails over to the next configured provider
- The reply follows the language detected from the user's message; for short slash commands the bot falls back to the Discord locale
