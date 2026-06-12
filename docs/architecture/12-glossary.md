# 12 — Глоссарий

Краткие определения ключевых концепций Hermes Agent.

---

## Основные концепции

### Agent Loop (Цикл агента)
Основной цикл выполнения: пользователь → модель → инструменты → ответ.
Реализован в `agent/conversation_loop.py`. Повторяется до `max_iterations` (90)
или пока модель не вернёт текст без tool_calls.

### AIAgent
Центральный класс (`run_agent.py`), управляющий диалогом. Хранит состояние:
сообщения, модель, провайдер, инструменты, контекстное окно. Инициализируется
~60 параметрами через `agent/agent_init.py`.

### Tool (Инструмент)
Функция с JSON-схемой, которую модель может вызвать. Каждый инструмент —
`ToolEntry` в реестре (`tools/registry.py`): имя, схема, handler, check_fn.

### Toolset (Тулсет)
Группа инструментов для контроля доступа. Определяется в `toolsets.py`:
`TOOLSETS` словарь с `tools` (список имён) и `includes` (ссылки на другие тулсеты).

### Provider (Провайдер)
LLM API (OpenAI, Anthropic, OpenRouter, GMI, Ollama…). Описывается
`ProviderProfile` (`providers/base.py`): auth, endpoints, quirks.

### Gateway (Шлюз)
Долгоживущий процесс, объединяющий мессенджер-платформы. `gateway/run.py`:
`GatewayRunner` управляет адаптерами, сессиями, cron-ом.

### Platform Adapter (Адаптер платформы)
Класс для конкретного мессенджера (Telegram, Discord, Slack…). Наследуется
от `gateway/platforms/base.py:PlatformAdapter`.

### Session (Сессия)
Набор сообщений между пользователем и агентом. Хранится в `state.db`
(SQLite). Каждая сессия имеет `session_id`, `source`, `model`.

### System Prompt
Системное сообщение, собирающееся один раз за сессию. Три уровня:
- **stable**: идентичность, инструменты, навыки
- **context**: AGENTS.md, .cursorrules
- **volatile**: память, время, модель

### Context Window (Контекстное окно)
Максимальное количество токенов, которое модель обрабатывает за запрос.
Управляется `ContextCompressor`: автоматическое сжатие средних частей.

### Context Compressor (Компрессор контекста)
`agent/context_compressor.py` — автоматическое сжатие длинных диалогов.
Защищает голову и хвост, сжимает средние части через LLM-суммаризацию.

### Iteration Budget (Бюджет итераций)
Счётчик `agent/iteration_budget.py`. Лимит: 90 (родитель), 50 (подагент).
`consume()` — потратить итерацию, `refund()` — вернуть (execute_code).

### Trajectory (Траектория)
Полная история одного agent turn: все сообщения, tool calls, результаты.
Сохраняется через `agent/trajectory.py` для обучения.

### Skill (Навык)
Процедурная память агента. Markdown-файл `SKILL.md` с инструкциями.
Хранится в `skills/` (встроенные) или `~/.hermes/skills/` (пользовательские).

### Plugin (Плагин)
Расширение через `hermes_cli/plugins.py`. Регистрирует hooks, tools,
CLI-команды. Источники: bundled, user, project, pip.

### MCP (Model Context Protocol)
Стандартный протокол для подключения LLM к внешним инструментам.
Hermes является и MCP-клиентом (`tools/mcp_tool.py`), и MCP-сервером
(`mcp_serve.py`).

### ACP (Agent Client Protocol)
Протокол для интеграции с IDE (VS Code, Zed, JetBrains).
Реализован в `acp_adapter/`.

### Kanban
Мультиагентная доска задач. SQLite-хранилище, dispatcher для назначения
задач воркерам. CLI: `hermes kanban <verb>`.

### Cron
Планировщик задач (`cron/`). Запускает агента по расписанию.
Форматы: duration, "every", cron-выражение, ISO timestamp.

### Credential Pool (Пул credentials)
Механизм ротации API-ключей при rate limits.
`agent/credential_pool.py`: несколько ключей, автоматическая ротация при 429.

### Failover (Переключение)
Автоматический переход на запасную модель при ошибке.
`agent/error_classifier.py` классифицирует ошибки, `_try_activate_fallback()`
переключает модель.

### Delegate (Делегирование)
Создание подагента с изолированным контекстом.
`tools/delegate_tool.py`: parent блокируется до завершения children.

### Curator (Куратор)
Фоновая система жизненного цикла навыков.
`agent/curator.py`: auto-archive stale skills, LLM review, backup.

### Context Engine (Движок контекста)
Плагинная система управления контекстом.
`agent/context_engine.py` + `plugins/context_engine/`.

### Skin Engine (Движок скинов)
Датаскинное темирование CLI.
`hermes_cli/skin_engine.py`: YAML-файлы с темами, кастомные спиннеры, цвета.

### Memory Provider (Провайдер памяти)
Плагин для внешней памяти (honcho, mem0, supermemory…).
`agent/memory_provider.py` — ABC.

### Tool Guardrails (Защита инструментов)
Механизм блокировки опасных tool calls.
`agent/tool_guardrails.py`: guardrail controller, approval flow.

---

## Термины

| Термин | Определение |
|--------|-------------|
| Turn | Один ход диалога (пользователь → агент → ответ) |
| Tool call | Вызов инструмента моделью |
| Tool result | JSON-результат выполнения инструмента |
| Streaming | Потоковая передача токенов от модели |
| Prompt caching | Кэширование промпта на стороне API |
| Prefix cache | Часть промпта, кэшированная между запросами |
| Checkpoint | Снимок состояния сессии |
| Branch | Ветка диалога (новый путь от существующего сообщения) |
| Compression | Сжатие контекста (summary) |
| Fallback | Запасная модель при ошибке |
| Heartbeat | Периодическое подтверждение активности |
| Interrupt | Прерывание текущего tool call |
| Steer | Инъекция пользовательского сообщения в tool result |
| Workspace | Рабочая директория агента |
| Profile | Множественные изолированные инстансы Hermes |
| Batch | Параллельный запуск нескольких задач |
| SOUL.md | Файл идентичности агента |
| AGENTS.md | Контекстные инструкции проекта |
| .cursorrules | Правила для Cursor IDE |
