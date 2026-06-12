# nexo-agent

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

## Installation

```bash
npm install
npm run build
```

## Usage

### Interactive Chat

```bash
nexo chat
```

### Modern TUI

```bash
nexo tui
```

### Gateway (Telegram)

```bash
export TELEGRAM_BOT_TOKEN=your_token
nexo gateway
```

### RPC Server

```bash
nexo rpc
```

## Configuration

Create a `nexo.config.yaml` in your project root:

```yaml
model: gpt-4o
provider: openai
maxTokens: 4096
temperature: 0.7
```

Or use environment variables:

```bash
NEXO_MODEL=gpt-4o
NEXO_PROVIDER=openai
OPENAI_API_KEY=your_key
```

## Commands

| Command | Description |
|---------|-------------|
| `nexo chat` | Start interactive chat |
| `nexo tui` | Start modern TUI interface |
| `nexo gateway` | Start gateway with messaging platforms |
| `nexo rpc` | Start RPC server for tool calling |
| `nexo config` | Show current configuration |
| `nexo version` | Show version |

## Development

```bash
npm run dev          # Run in development mode
npm run typecheck    # Type check
npm run test         # Run tests
npm run lint         # Lint code
```

## Architecture

```
src/
├── core/           # Agent, config, logger
├── providers/      # LLM providers (OpenAI, etc.)
├── tools/          # Tool registry and implementations
├── gateway/        # Messaging platform adapters
├── cron/           # Job scheduling
├── memory/         # Session storage (SQLite)
├── skills/         # Skills system
├── plans/          # Kanban task management
├── mcp/            # MCP client and plugins
├── rpc/            # RPC server
├── tui/            # Terminal UI (Ink)
└── cli/            # CLI entry point
```

## License

MIT
