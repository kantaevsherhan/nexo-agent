<h1 align="center">Nexo Agent</h1>

<p align="center">
  <img src=".github/images/banner.png" alt="NexoAgent" width="700">
</p>

Node.js/TypeScript agent inspired by Hermes Agent.

## Features

- LLM-powered agent with tool calling
- Interactive chat (CLI and TUI)
- File system tools (read, write, search)
- Shell command execution
- Skills system (SKILL.md)
- Kanban task management
- Cron job scheduling
- Gateway for messaging platforms (Telegram)
- MCP (Model Context Protocol) support
- Plugin system
- Session persistence with SQLite FTS5

## Quick Start

### 1. Install

```bash
npm install
npm run build
```

### 2. Setup

Run the interactive setup wizard:

```bash
nexo setup
```

The wizard will guide you through:

| Step | What you configure | Options |
|------|-------------------|---------|
| 1 | **Провайдер** | OpenAI, OpenRouter, Anthropic |
| 2 | **API ключ** | Your provider's API key |
| 3 | **Модель** | GPT-4o, Claude 3.5, Gemini, etc. |
| 4 | **Температура** | 0.0 (точный) — 2.0 (креативный) |
| 5 | **Макс. токенов** | Лимит токенов в ответе (по умолчанию 4096) |
| 6 | **Логирование** | debug, info, warn, error |

After setup, two files are created:
- `.env` — API keys (not committed to git)
- `nexo.config.yaml` — agent configuration

### 3. Run

```bash
nexo chat
```

## Available Models

### OpenAI
| Model | Description |
|-------|-------------|
| `gpt-4o` | Latest flagship model |
| `gpt-4o-mini` | Fast and cheap |
| `gpt-4-turbo` | Previous generation |
| `o1-preview` | Reasoning model |
| `o1-mini` | Fast reasoning |

### OpenRouter (100+ models)
| Model | Description |
|-------|-------------|
| `openai/gpt-4o` | GPT-4o via OpenRouter |
| `anthropic/claude-3.5-sonnet` | Claude 3.5 Sonnet |
| `google/gemini-pro-1.5` | Gemini Pro |
| `meta-llama/llama-3.1-405b` | Llama 3.1 405B |

### Anthropic
| Model | Description |
|-------|-------------|
| `claude-sonnet-4-20250514` | Claude Sonnet 4 |
| `claude-3-5-haiku-20241022` | Fast and cheap |

## Configuration

### Config file (`nexo.config.yaml`)

```yaml
model: "gpt-4o"
provider: "openai"
maxTokens: 4096
temperature: 0.7
logLevel: "info"
```

### Environment variables

| Variable | Description | Default |
|----------|-------------|---------|
| `OPENAI_API_KEY` | OpenAI API key | — |
| `OPENROUTER_API_KEY` | OpenRouter API key | — |
| `ANTHROPIC_API_KEY` | Anthropic API key | — |
| `NEXO_MODEL` | LLM model | `gpt-4o` |
| `NEXO_PROVIDER` | Provider name | `openai` |
| `NEXO_MAX_TOKENS` | Max tokens | `4096` |
| `NEXO_TEMPERATURE` | Temperature | `0.7` |
| `NEXO_LOG_LEVEL` | Log level | `info` |

### Custom provider (OpenAI-compatible)

```yaml
# nexo.config.yaml
model: "my-custom-model"
provider: "custom"
baseUrl: "https://my-api.example.com/v1"
```

Or via env:

```bash
NEXO_BASE_URL=https://my-api.example.com/v1
```

## Commands

| Command | Description |
|---------|-------------|
| `nexo setup` | First-time setup wizard |
| `nexo chat` | Interactive chat (CLI) |
| `nexo tui` | Modern TUI interface (Ink/React) |
| `nexo gateway` | Start messaging gateway |
| `nexo rpc` | Start RPC server for tool calling |
| `nexo test-stream` | Test LLM streaming connection |
| `nexo config` | Show current configuration |
| `nexo version` | Show version |

## Chat Commands

Inside `nexo chat`:

| Command | Description |
|---------|-------------|
| `/quit` or `/exit` | Exit chat |
| `/reset` | Reset session |

## Gateway (Telegram)

1. Create a bot via [@BotFather](https://t.me/BotFather)
2. Get your bot token
3. Run:

```bash
export TELEGRAM_BOT_TOKEN=your_token
nexo gateway
```

Or add to `.env`:

```
TELEGRAM_BOT_TOKEN=your_token
```

## RPC Server

Start an RPC server for calling tools from external scripts:

```bash
nexo rpc
```

Protocol (JSON-RPC over stdin/stdout):

```json
// List available tools
{"id":"1","method":"tools/list"}

// Call a tool
{"id":"2","method":"tools/call","params":{"name":"terminal","args":{"command":"ls -la"}}}
```

## Development

```bash
npm run dev          # Run in development mode
npm run build        # Build project
npm run typecheck    # Type check
npm run test         # Run tests
npm run lint         # Lint code
npm run lint:fix     # Lint and auto-fix
```

## Architecture

```
src/
├── core/           # Agent, config, logger
├── providers/      # LLM providers (OpenAI, Anthropic, OpenRouter)
├── tools/          # Tool registry and implementations
│   └── environments/  # Docker, SSH backends
├── gateway/        # Messaging platform adapters
├── cron/           # Job scheduling
├── memory/         # Session storage (SQLite + FTS5)
├── skills/         # Skills system (SKILL.md)
├── plans/          # Kanban task management
├── mcp/            # MCP client and plugins
├── rpc/            # RPC server
├── tui/            # Terminal UI (Ink/React)
└── cli/            # CLI entry point
```

## License

MIT
