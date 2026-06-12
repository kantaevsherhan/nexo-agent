# 03 — Инструменты и тулсеты

## Введение

Система инструментов — это "руки" агента. Каждый инструмент — это функция
с JSON-схемой, которую модель может вызвать. Инструменты группируются в
тулсеты для контроля доступа по платформе.

---

## Как это работает

### Архитектура реестра инструментов

```
┌─────────────────────────────────────────────────┐
│ model_tools.py                                  │
│  get_tool_definitions(toolsets, disabled)        │
│  handle_function_call(name, args)                │
└──────────────────┬──────────────────────────────┘
                   │
         ┌─────────▼─────────┐
         │ tools/registry.py │
         │  ToolRegistry     │
         │  (singleton)      │
         └─────────┬─────────┘
                   │
    ┌──────────────┼──────────────────┐
    │              │                  │
┌───▼──────┐ ┌────▼──────┐ ┌────────▼────────┐
│ terminal │ │ read_file │ │ delegate_task   │
│ tool.py  │ │ tool.py   │ │ tool.py         │
│ register │ │ register  │ │ register        │
│ (import) │ │ (import)  │ │ (import)        │
└──────────┘ └───────────┘ └─────────────────┘
```

### Цепочка обнаружения инструментов

1. **AST-сканирование**: `tools/registry.py:discover_builtin_tools()` сканирует
   `tools/*.py` через AST-парсинг, ищет вызовы `registry.register()` на
   верхнем уровне модуля
2. **Импорт**: Каждый модуль с `registry.register()` импортируется →
   `register()` вызывается при import time
3. **Регистрация**: `ToolEntry` добавляется в `ToolRegistry._tools`
4. **Фильтрация**: `get_tool_definitions()` фильтрует по toolset, check_fn

### Структура ToolEntry

```python
class ToolEntry:
    name: str                    # "terminal"
    toolset: str                 # "terminal"
    schema: dict                 # OpenAI-format JSON schema
    handler: Callable            # Функция-обработчик
    check_fn: Callable | None    # Проверка доступности (Docker, API key…)
    requires_env: list[str]      # Обязательные env-переменные
    is_async: bool               # Async handler?
    description: str             # Описание
    emoji: str                   # Эмодзи для вывода
    max_result_size_chars: int   # Лимит размера результата
    dynamic_schema_overrides: Callable  # Динамические переопределения схемы
```

### Вызов инструмента

```
Модель → tool_calls: [{ name: "terminal", arguments: '{"command":"ls"}' }]
         │
         ▼
handle_function_call("terminal", {"command": "ls"})
         │
         ▼
registry.get_entry("terminal") → ToolEntry
         │
         ▼
entry.handler(args) → JSON-строка
         │
         ▼
Результат добавляется в messages как role: tool
```

### Тулсеты — группировка

Тулсеты определены в `toolsets.py` как словарь `TOOLSETS`:

```python
TOOLSETS = {
    "web": {
        "description": "Web research and content extraction tools",
        "tools": ["web_search", "web_extract"],
        "includes": []  # ссылки на другие тулсеты
    },
    "terminal": {
        "description": "Terminal execution tools",
        "tools": ["terminal"],
        "includes": []
    },
    "hermes-cli": {
        "description": "Full CLI toolset",
        "tools": [],
        "includes": ["web", "terminal", "file", "browser", "skills", "vision", ...]
    },
}
```

Ключевые тулсеты:
- `_HERMES_CORE_TOOLS` — базовый набор для всех платформ (~50 инструментов)
- `_HERMES_WEBHOOK_SAFE_TOOLS` — безопасный набор для webhook'ов
- Составные тулсеты (`hermes-cli`, `messaging`) наследуют индивидуальные

### Фильтрация

`get_tool_definitions()` выполняет:
1. Разворачивание `includes` для составных тулсетов
2. Вычитание `disabled_toolsets`
3. Вызов `check_fn()` для каждого инструмента (TTL-кэш 30 сек)
4. Динамическое обновление схем (execute_code, discord)
5. Кэширование результата по `(toolsets, registry_generation, config_fp)`

---

## Реализация в коде

| Файл | Роль |
|------|------|
| `tools/registry.py` | `ToolRegistry` (singleton), `ToolEntry`, `discover_builtin_tools()` |
| `model_tools.py` | `get_tool_definitions()`, `handle_function_call()`, async bridging |
| `toolsets.py` | `TOOLSETS`, `_HERMES_CORE_TOOLS`, `resolve_toolset()`, `validate_toolset()` |
| `toolset_distributions.py` | Распределения тулсетов по платформам |
| `tools/terminal_tool.py` | Терминал (local/docker/ssh/modal/singularity/daytona) |
| `tools/file_tools.py` | read_file, write_file, patch, search_files |
| `tools/web_tools.py` | web_search, web_extract |
| `tools/browser_tool.py` | Браузерная автоматизация (Playwright) |
| `tools/vision_tools.py` | Анализ изображений |
| `tools/delegate_tool.py` | Делегирование подагентам |
| `tools/skills_tool.py` | Управление навыками |
| `tools/memory_tool.py` | Инструмент памяти |
| `tools/mcp_tool.py` | MCP-инструменты (обнаружение из конфига) |
| `tools/code_execution_tool.py` | Программное выполнение кода |
| `tools/interrupt.py` | Глобальный interrupt event для инструментов |

### Пример: terminal tool

```python
# tools/terminal_tool.py
registry.register(
    name="terminal",
    toolset="terminal",
    schema={
        "name": "terminal",
        "description": "Execute a terminal command",
        "parameters": {
            "type": "object",
            "properties": {
                "command": {"type": "string", "description": "Shell command"},
                "background": {"type": "boolean", "description": "Run in background"},
            },
            "required": ["command"]
        }
    },
    handler=lambda args, **kw: terminal_tool(command=args.get("command"), ...),
    check_fn=check_terminal_requirements,
    requires_env=[],
)
```

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `subprocess` | Запуск процессов | `terminal_tool` — выполнение команд | Базовый запуск shell-команд |
| `ptyprocess` | PTY (POSIX) | Эмуляция терминала | Интерактивные команды |
| `pathlib` | Файловые пути | read/write/patch | Безопасная работа с ФС |
| `ast` | Парсинг Python | AST-сканирование `tools/*.py` | Обнаружение `registry.register()` |
| `threading` | Мультипоточность | Параллельный вызов инструментов | `_MAX_TOOL_WORKERS = 8` |

---

## Перенос на Node.js

### Архитектура

```typescript
// Реестр инструментов на Node.js
interface ToolEntry {
  name: string;
  toolset: string;
  schema: z.ZodObject<any>;  // Zod вместо JSON schema
  handler: (args: Record<string, any>) => Promise<string>;
  checkFn?: () => boolean;
  requiresEnv?: string[];
}

class ToolRegistry {
  private tools = new Map<string, ToolEntry>();

  register(entry: ToolEntry): void {
    this.tools.set(entry.name, entry);
  }

  async handleFunctionCall(name: string, args: Record<string, any>): Promise<string> {
    const entry = this.tools.get(name);
    if (!entry) throw new Error(`Unknown tool: ${name}`);
    return entry.handler(args);
  }
}
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `subprocess` | `child_process` | Запуск процессов | `exec(command)` / `spawn(command)` | Выполнение shell-команд |
| `ptyprocess` | `node-pty` | PTY | `pty.spawn(command)` | Интерактивные терминальные сессии |
| `pathlib` | `node:path` + `fs/promises` | Файловые пути | `path.join()`, `fs.readFile()` | Работа с ФС |
| `ast` | `acorn` / `@babel/parser` | Парсинг JS/TS | Парсинг `.ts` файлов | Обнаружение регистраций инструментов |
| `threading` | `worker_threads` | Мультипоточность | `new Worker()` | Параллельный вызов |
| `json` (schema) | `zod` | Валидация | `z.object({ command: z.string() })` | Строгая типизация + валидация |

### Подводные камни переноса

1. **AST-сканирование**: В Python используется `ast` для поиска `registry.register()`.
   В Node.js — `acorn` или `@babel/parser` для парсинга `.ts` файлов. Или можно
   использовать decorator-based registration (TypeScript decorators).

2. **PTY**: `node-pty` — нативный C++ addon, требует `node-gyp`. Работает на
   Linux/macOS/Windows. `ptyprocess` в Python — чистый Python, но только POSIX.

3. **Параллелизм инструментов**: В Python — `ThreadPoolExecutor(max_workers=8)`.
   В Node.js — `Promise.all()` для I/O-bound операций, `worker_threads` для CPU-bound.

4. **Interrupt**: В Python — глобальный `threading.Event`. В Node.js — `AbortController` /
   `AbortSignal` для отмены операций.

---

## Кросс-ссылки

- [01 — Общая архитектура](./01-architecture.md)
- [02 — Модели и провайдеры](./02-models-and-providers.md)
- [03 — Инструменты и тулсеты](./03-tools-and-toolsets.md)
- [10 — Скрипты и RPC](./10-scripts-and-rpc.md)
