# Hermes Agent — Техническая документация

Подробное описание архитектуры и внутреннего устройства Hermes Agent —
самообучающегося терминального AI-агента от Nous Research.

Каждый раздел объясняет **как** подсистема работает под капотом и
**как** её перенести на Node.js.

---

## Оглавление

| Файл | Подсистема |
|------|-----------|
| [01-architecture.md](./01-architecture.md) | Общая архитектура и agent loop |
| [02-models-and-providers.md](./02-models-and-providers.md) | Модели и провайдеры LLM |
| [03-tools-and-toolsets.md](./03-tools-and-toolsets.md) | Инструменты и система toolsets |
| [04-gateway.md](./04-gateway.md) | Шлюз сообщений (мессенджеры) |
| [05-cron-and-scheduling.md](./05-cron-and-scheduling.md) | Cron и планировщик задач |
| [06-plans-and-kanban.md](./06-plans-and-kanban.md) | Планы и Kanban |
| [07-skills.md](./07-skills.md) | Навыки (Skills) |
| [08-memory.md](./08-memory.md) | Память агента |
| [09-plugins-and-mcp.md](./09-plugins-and-mcp.md) | Плагины и MCP |
| [10-scripts-and-rpc.md](./10-scripts-and-rpc.md) | Скрипты, RPC и окружения |
| [11-tui.md](./11-tui.md) | Терминальный интерфейс (TUI) |
| [12-glossary.md](./12-glossary.md) | Глоссарий |

---

## Карта проекта — что в какой папке

```
hermes-agent/
├── run_agent.py          # Класс AIAgent — основной цикл агента (~5.3k LOC)
├── model_tools.py        # Оркестрация инструментов, get_tool_definitions()
├── toolsets.py           # Определения тулсетов, _HERMES_CORE_TOOLS
├── cli.py                # Класс HermesCLI — интерактивный CLI (~13k LOC)
├── hermes_state.py       # SessionDB — SQLite-хранилище сессий (FTS5)
├── hermes_constants.py   # get_hermes_home(), profile-aware пути
├── hermes_logging.py     # Логирование: agent.log / errors.log
├── trajectory_compressor.py  # Сжатие траекторий для обучения
├── mcp_serve.py          # MCP-сервер (stdio) — мост к Claude Code, Cursor
├── batch_runner.py       # Параллельный batch-processed запуск
├── hermes_bootstrap.py   # UTF-8 stdio на Windows (первый import)
├── agent/                # Внутренности агента
│   ├── agent_init.py     # __init__ AIAgent (~1.7k LOC)
│   ├── conversation_loop.py  # Основной цикл run_conversation (~4.2k LOC)
│   ├── system_prompt.py  # Сборка системного промпта (stable/context/volatile)
│   ├── context_compressor.py  # Автосжатие контекстного окна
│   ├── memory_manager.py # Оркестрация memory-провайдеров
│   ├── memory_provider.py # ABC для memory-бэкендов
│   ├── display.py        # KawaiiSpinner — анимированный спиннер
│   ├── error_classifier.py # Классификация ошибок API
│   ├── retry_utils.py    # Jittered backoff, retry-логика
│   ├── iteration_budget.py # Потокобезопасный счётчик итераций
│   ├── prompt_builder.py # Шаблоны промптов, идентичность агента
│   ├── prompt_caching.py # Управление кэшированием промптов
│   ├── transports/       # Транспортные слои (chat_completions, codex_responses)
│   ├── providers/        # Адаптеры провайдеров (Anthropic, Gemini, Bedrock…)
│   ├── chat_completion_helpers.py  # Стриминг, обработка ответов
│   ├── trajectory.py     # Сохранение траекторий
│   └── ...               # ~90 модулей
├── tools/                # Реализации инструментов (авто-обнаружение)
│   ├── registry.py       # Центральный реестр ToolRegistry
│   ├── terminal_tool.py  # Выполнение команд (local/docker/ssh/modal)
│   ├── file_tools.py     # read_file, write_file, patch, search_files
│   ├── delegate_tool.py  # Делегирование подагентам
│   ├── browser_tool.py   # Браузерная автоматизация
│   ├── vision_tools.py   # Анализ изображений
│   ├── web_tools.py      # Веб-поиск и извлечение контента
│   ├── skills_tool.py    # Управление навыками
│   ├── memory_tool.py    # Инструмент памяти
│   ├── environments/     # Бэкенды терминала (local, docker, ssh, modal, singularity, daytona)
│   └── ...               # ~85 файлов
├── gateway/              # Мессенджер-шлюз
│   ├── run.py            # GatewayRunner — запуск всех платформ (~15.8k LOC)
│   ├── session.py        # Управление сессиями шлюза
│   ├── config.py         # GatewayConfig, Platform enum
│   ├── platforms/        # Адаптеры: telegram, discord, slack, whatsapp, matrix…
│   └── ...               # ~29 файлов
├── hermes_cli/           # CLI-подкоманды, настройка, плагины
│   ├── main.py           # Точка входа hermes CLI
│   ├── commands.py       # COMMAND_REGISTRY — все slash-команды
│   ├── config.py         # load_config(), DEFAULT_CONFIG
│   ├── plugins.py        # PluginManager — обнаружение плагинов
│   ├── skin_engine.py    # Движок тем/скинов
│   └── ...               # ~113 файлов
├── cron/                 # Планировщик задач
│   ├── jobs.py           # Хранилище задач (jobs.json)
│   └── scheduler.py      # Тик-цикл планировщика
├── plugins/              # Плагины
│   ├── memory/           # Провайдеры памяти (honcho, mem0, supermemory…)
│   ├── model-providers/  # Инференс-бэкенды (openrouter, anthropic, gmi…)
│   ├── context_engine/   # Плагины контекстного движка
│   ├── kanban/           # Мультиагентная доска
│   └── ...               # ~19 директорий
├── providers/            # Профили провайдеров (ProviderProfile)
├── ui-tui/               # TUI на React/Ink (TypeScript)
├── tui_gateway/          # JSON-RPC бэкенд для TUI
├── acp_adapter/          # ACP-сервер (VS Code / Zed / JetBrains)
├── acp_registry/         # Метаданные агента для ACP
├── plans/                # Планы разработки
├── skills/               # Встроенные навыки (19 категорий)
├── optional-skills/      # Тяжёлые/нишевые навыки (не активны по умолч.)
├── tests/                # Тестовый suite (~17k тестов, ~900 файлов)
├── scripts/              # Вспомогательные скрипты
└── pyproject.toml        # Зависимости, метаданные пакета
```

---

## Общая таблица стека: Python → Node.js

| Подсистема | Python | Node.js (npm) |
|------------|--------|---------------|
| HTTP-клиент | `httpx`, `requests` | `undici`, `node-fetch` |
| LLM SDK | `openai` | `openai` (npm), `@anthropic-ai/sdk` |
| Валидация схем | `pydantic` | `zod` |
| CLI-интерфейс | `prompt_toolkit`, `rich` | `ink`, `@clack/prompts`, `chalk` |
| TUI (терминал) | `prompt_toolkit` | `ink`, `blessed` |
| БД (SQLite) | `sqlite3` (stdlib) | `better-sqlite3` |
| Полнотекстовый поиск | SQLite FTS5 | `better-sqlite3` (FTS5) |
| YAML | `pyyaml`, `ruamel.yaml` | `yaml` (js-yaml) |
| Cron-парсинг | `croniter` | `cron-parser`, `croner` |
| Markdown | `markdown` | `marked`, `marked-terminal` |
| Мессенджеры | `python-telegram-bot`, `discord.py`, `slack-bolt` | `telegraf`/`grammy`, `discord.js`, `@slack/bolt` |
| SSE/стриминг | `httpx` (async streaming) | `eventsource-client`, native `fetch` + `ReadableStream` |
| Мультипоточность | `threading`, `concurrent.futures` | `Worker_threads`, `Promise.all` |
| Асинхронность | `asyncio` | Нативный event loop (`async/await`) |
| Файловые операции | `pathlib`, `os` | `fs/promises`, `path` |
| Токенизация | `tiktoken`, кастомные | `js-tiktoken`, `tiktoken-node` |
| Процессы | `subprocess`, `ptyprocess` | `child_process`, `node-pty` |
| Docker | `docker` (SDK) | `dockerode` |
| SSH | `paramiko` | `ssh2` |
| MCP SDK | `mcp` (Python) | `@modelcontextprotocol/sdk` |
| ACP | `agent-client-protocol` (Python) | `@anthropic-ai/agent-client-protocol` |
| Конфигурация | `pyyaml` + `python-dotenv` | `cosmiconfig`, `dotenv` |
| Rich/форматирование | `rich` | `chalk`, `ora`, `cli-table3` |
| Изображения | `Pillow` | `sharp` |
| JWT | `PyJWT` | `jsonwebtoken` |

---

## Верхнеуровневая архитектура

```
┌──────────────────────────────────────────────────────┐
│                   Пользователь                       │
│              CLI / TUI / Мессенджер / ACP            │
└──────────────┬───────────────────┬───────────────────┘
               │                   │
    ┌──────────▼──────────┐ ┌─────▼────────────────┐
    │   HermesCLI (cli.py)│ │  GatewayRunner       │
    │   prompt_toolkit    │ │  gateway/run.py      │
    │   rich + spinner    │ │  asyncio event loop   │
    └──────────┬──────────┘ └─────┬────────────────┘
               │                   │
               └─────────┬─────────┘
                         │
              ┌──────────▼──────────┐
              │    AIAgent           │
              │  run_agent.py        │
              │  (~60 параметров)    │
              └──────────┬──────────┘
                         │
          ┌──────────────┼──────────────┐
          │              │              │
  ┌───────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
  │ System Prompt │ │ Tools    │ │ Memory      │
  │ system_prompt │ │ Registry │ │ Manager     │
  │ .py           │ │ model_   │ │ memory_     │
  │               │ │ tools.py │ │ manager.py  │
  └───────────────┘ └────┬─────┘ └─────────────┘
                         │
              ┌──────────┼──────────┐
              │          │          │
      ┌───────▼──┐ ┌────▼────┐ ┌───▼───────┐
      │ OpenAI   │ │ Provider│ │ Context   │
      │ SDK      │ │ Profiles│ │ Compressor│
      │ (API)    │ │ providers│ │ context_  │
      └──────────┘ └─────────┘ │ compressor│
                                └───────────┘
```

### Поток данных для одного хода (turn)

1. **Ввод**: пользователь → `cli.py` / `gateway/run.py` / `tui_gateway`
2. **Системный промпт**: `system_prompt.py` собирает stable + context + volatile
3. **Вызов API**: `conversation_loop.py` → OpenAI SDK → `client.chat.completions.create()`
4. **Ответ модели**:
   - Текст → возврат пользователю
   - Tool calls → `handle_function_call()` → `model_tools.py` → `tools/registry.py`
5. **Инструмент**: конкретный `tools/*.py` выполняет операцию
6. **Результат**: JSON-строка → добавляется в `messages` как `role: tool`
7. **Цикл**: шаги 3–6 повторяются до `max_iterations` (90) или пока нет tool calls
8. **Компрессия**: если контекст превышает порог → `context_compressor.py`
9. **Сохранение**: `hermes_state.py` → SQLite (`state.db`)
