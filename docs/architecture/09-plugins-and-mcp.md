# 09 — Плагины и MCP

## Введение

Hermes Agent поддерживает две системы расширения: общий плагин-менеджер
(生命周期 hooks, инструменты, CLI-команды) и протокол MCP (Model Context Protocol)
для подключения внешних инструментов.

---

## Как это работает

### Архитектура плагинов

```
┌──────────────────────────────────────────────┐
│              PluginManager                    │
│          hermes_cli/plugins.py                │
│                                              │
│  Источники (порядок приоритета):              │
│  1. Bundled: <repo>/plugins/<name>/          │
│  2. User: ~/.hermes/plugins/<name>/          │
│  3. Project: ./.hermes/plugins/<name>/       │
│  4. Pip entry points: hermes_agent.plugins   │
└──────────────────┬───────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
│ Plugin A │ │ Plugin B │ │ Plugin C   │
│ (memory) │ │ (kanban) │ │ (web/      │
│          │ │          │ │  search)   │
└──────────┘ └──────────┘ └────────────┘
```

### Жизненный цикл плагина

1. **Discovery**: Сканирование 4 источников → чтение `plugin.yaml` / `plugin.yml`
2. **Import**: Импорт `__init__.py` → вызов `register(ctx)`
3. **Registration**: Плагин регистрирует hooks, tools, CLI-команды
4. **Invocation**: Агент вызывает hooks в соответствующих точках

### Хуки (lifecycle hooks)

```python
VALID_HOOKS = {
    "pre_tool_call",       # перед вызовом инструмента
    "post_tool_call",      # после вызова инструмента
    "pre_llm_call",        # перед запросом к LLM
    "post_llm_call",       # после ответа LLM
    "on_session_start",    # начало сессии
    "on_session_end",      # завершение сессии
}
```

### MCP (Model Context Protocol)

MCP — стандартный протокол для подключения LLM к внешним инструментам.

```
┌──────────────────┐     stdio / SSE     ┌──────────────────┐
│  Hermes Agent    │ ◄──────────────────► │  MCP Server      │
│  (MCP Client)    │                      │  (внешний)       │
│                  │                      │  - filesystem     │
│  mcp_tool.py     │                      │  - postgres       │
│                  │                      │  - github         │
└──────────────────┘                      └──────────────────┘
```

Hermes также является MCP-сервером (`mcp_serve.py`):
- Expose conversations, messages, events как MCP-инструменты
- Стандартный 9-инструментный surface (conversations_list, messages_read, ...)
- Работает через stdio transport

### ACP (Agent Client Protocol)

`acp_adapter/` — интеграция с IDE (VS Code, Zed, JetBrains):
- JSON-RPC over stdio
- Session management, tool execution, approval flow
- `acp_registry/` — метаданные агента

---

## Реализация в коде

| Файл | Роль |
|------|------|
| `hermes_cli/plugins.py` | `PluginManager` — discovery, loading, hook invocation |
| `hermes_cli/middleware.py` | Middleware schema для hooks |
| `tools/mcp_tool.py` | MCP-инструменты (обнаружение из конфига) |
| `mcp_serve.py` | Hermes как MCP-сервер (stdio) |
| `acp_adapter/server.py` | ACP-сервер для IDE |
| `acp_adapter/session.py` | ACP session management |
| `acp_adapter/auth.py` | ACP аутентификация |
| `acp_registry/agent.json` | Метаданные агента |
| `plugins/*/` | Встроенные плагины (memory, kanban, web-search…) |

### Структура plugin.yaml

```yaml
name: my-plugin
version: 1.0.0
description: My custom plugin
kind: tool  # tool | model-provider | memory | context_engine
author: John Doe
```

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `mcp` (==1.26.0, opt-in) | MCP SDK | FastMCP сервер/клиент | Стандартный протокол |
| `importlib.metadata` | Entry points | Pip-плагины | Динамическое обнаружение |
| `importlib.util` | Import by path | Directory plugins | Загрузка плагинов из ФС |
| `yaml` | YAML | plugin.yaml | Манифесты плагинов |

---

## Перенос на Node.js

### Архитектура

```typescript
// MCP на Node.js
import { Server } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio';

const server = new Server({ name: 'hermes', version: '1.0.0' }, {
  capabilities: { tools: {} }
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    { name: 'terminal', description: 'Execute command', inputSchema: {...} },
  ]
}));

const transport = new StdioServerTransport();
await server.connect(transport);
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `mcp` | `@modelcontextprotocol/sdk` | MCP SDK | `new Server(...)` | Стандартный MCP |
| `importlib.metadata` | `package.json` entry points | Entry points | `"hermes.plugins"` | Pip-плагины |
| `importlib.util` | Dynamic import | Directory plugins | `import(pluginPath)` | Загрузка плагинов |
| `yaml` | `yaml` (js-yaml) | YAML | `yaml.load(text)` | plugin.yaml |

### Подводные камни переноса

1. **@modelcontextprotocol/sdk**: Официальный npm SDK для MCP. Поддерживает
   stdio и SSE transport. API почти идентичен Python MCP SDK.

2. **Plugin discovery**: В Python — `importlib.util.spec_from_file_location()`.
   В Node.js — `import()` (dynamic import).

3. **ACP**: `agent-client-protocol` npm package (или кастомная реализация).

---

## Кросс-ссылки

- [02 — Модели и провайдеры](./02-models-and-providers.md)
- [03 — Инструменты и тулсеты](./03-tools-and-toolsets.md)
- [08 — Память](./08-memory.md)
