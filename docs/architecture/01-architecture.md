# 01 — Общая архитектура

## Введение

Hermes Agent — это самобучающийся терминальный AI-агент, построенный вокруг цикла
"промпт → модель → инструмент → ответ". Ядро — класс `AIAgent` в `run_agent.py`,
который управляет диалогом, вызовами инструментов и контекстным окном.

---

## Как это работает

### Agent Loop — основной цикл

```
Пользователь вводит сообщение
         │
         ▼
┌─────────────────────────────┐
│ 1. Сборка системного промпта│  system_prompt.py
│    (stable + context +      │  → stable: идентичность, навыки, среда
│     volatile)               │  → context: AGENTS.md, .cursorrules
│                             │  → volatile: память, время, модель
└──────────────┬──────────────┘
               │
               ▼
┌─────────────────────────────┐
│ 2. POST /v1/chat/completions│  conversation_loop.py
│    messages: [system, user, │  → OpenAI SDK (chat_completions)
│      assistant, tool, ...]  │  →или codex_responses (Responses API)
│    tools: [schema1, ...]    │
└──────────────┬──────────────┘
               │
         ┌─────┴─────┐
         │           │
    Текст        Tool Calls
    ответ        (список)
         │           │
         ▼           ▼
    Вернуть    ┌──────────────────┐
    ответ      │ 3. Выполнение    │  model_tools.py → handle_function_call()
    пользователю │    инструмента  │  → tools/registry.py → конкретный handler
               │    (параллельно) │
               └────────┬─────────┘
                        │
                        ▼
               ┌──────────────────┐
               │ 4. Результат     │  JSON-строка
               │    → role: tool  │  добавляется в messages
               └────────┬─────────┘
                        │
                        ▼
               ┌──────────────────┐
               │ 5. Повтор цикла  │  → шаг 2 (с обновлёнными messages)
               │    до max_iter   │  → IterationBudget: consume()/remaining
               └──────────────────┘
```

### Максимальные итерации

- `max_iterations = 90` (по умолчанию) для родительского агента
- `delegation.max_iterations = 50` для подагентов
- `IterationBudget` — потокобезопасный счётчик с `consume()` и `refund()`
- `execute_code` возвращает итерации обратно (refund), т.к. не считается за внешний вызов

### Состояние агента

`AIAgent.__init__` (реализован в `agent/agent_init.py:154`) принимает ~60 параметров.
Ключевые атрибуты состояния:

| Атрибут | Тип | Назначение |
|---------|-----|------------|
| `messages` / `_session_messages` | `List[Dict]` | Полная история диалога |
| `client` | `OpenAI` | HTTP-клиент к LLM |
| `model` | `str` | Текущая модель |
| `provider` | `str` | Текущий провайдер |
| `api_mode` | `str` | `chat_completions` или `codex_responses` |
| `tools` | `List[Dict]` | Схемы доступных инструментов |
| `context_compressor` | `ContextCompressor` | Автосжатие контекста |
| `_memory_manager` | `MemoryManager` | Оркестрация памяти |
| `_iteration_budget` | `IterationBudget` | Счётчик итераций |
| `session_id` | `str` | UUID сессии |
| `_fallback_chain` | `List[Dict]` | Цепочка запасных моделей |
| `_credential_pool` | `CredentialPool` | Пул credentials для ротации |

---

## Реализация в коде

### Ключевые файлы

| Файл | Роль |
|------|------|
| `run_agent.py` | Класс `AIAgent` — обёртка, инициализация, базовые методы (~5.3k LOC) |
| `agent/agent_init.py` | `init_agent()` — тело `__init__` (~1.7k LOC) |
| `agent/conversation_loop.py` | `run_conversation()` — основной цикл (~4.2k LOC) |
| `agent/system_prompt.py` | Сборка системного промпта (3 уровня) |
| `agent/iteration_budget.py` | `IterationBudget` — счётчик итераций |
| `agent/context_compressor.py` | `ContextCompressor` — автосжатие контекста |
| `agent/error_classifier.py` | Классификация ошибок API, `FailoverReason` |
| `agent/retry_utils.py` | `jittered_backoff()` — экспоненциальный backoff |
| `agent/prompt_caching.py` | Управление кэшированием промптов (Anthropic cache control) |
| `agent/transports/` | Транспортные слои: `chat_completions`, `codex_responses` |
| `hermes_state.py` | `SessionDB` — SQLite (WAL + FTS5) для хранения сессий |

### Формат сообщений

Все сообщения следуют формату OpenAI:

```python
{"role": "system", "content": "..."}
{"role": "user", "content": "..."}
{"role": "assistant", "content": "...", "tool_calls": [...]}
{"role": "tool", "tool_call_id": "...", "content": "..."}
```

Содержимое `content` может быть строкой или списком частей (мультимодальный формат):

```python
{"role": "user", "content": [
    {"type": "text", "text": "Что на этом изображении?"},
    {"type": "image_url", "image_url": {"url": "data:image/jpeg;base64,..."}}
]}
```

### Кэширование системного промпта

Системный промпт собирается **один раз за сессию** и кэшируется в
`agent._cached_system_prompt`. Это единственное условие для сохранения
上游 prefix cache: если промпт пересобирается mid-session, кэш ломается и
стоимость API-вызовов резко возрастает.

### Контекстное окно и компрессия

`ContextCompressor` (реализован в `agent/context_compressor.py`) мониторит
количество токенов и автоматически сжимает средние части разговора, защищая
голову (первые системные/пользовательские сообщения) и хвост (последние 4 хода).

Стратегия:
1. Защита первых N сообщений (system, первый user, первый assistant, первый tool)
2. Защита последних 4 ходов
3. Сжатие средних частей, начиная со 2-го tool-ответа
4. Замена сжатой области на одну summary-сумму
5. Итеративное обновление суммаризации (при повторных компрессиях)

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `openai` (==2.24.0) | OpenAI-совместимый SDK | `client.chat.completions.create()` | Единый интерфейс к LLM API |
| `httpx` (==0.28.1) | Async HTTP-клиент | Транспорт для OpenAI SDK, прямые запросы | SOCKS-прокси, keepalive, connection pooling |
| `pydantic` (==2.13.4) | Валидация данных | Модели конфигурации, ответов | Типобезопасность, автоматическая валидация |
| `pyyaml` (==6.0.3) | YAML-парсер | Конфигурация config.yaml | Настройки агента |
| `ruamel.yaml` (==0.18.17) | YAML с комментариями | Запись config.yaml | Сохранение комментариев при записи |
| `rich` (==14.3.3) | Форматированный вывод | Баннер, панели, таблицы в CLI | Красивый вывод в терминале |
| `prompt_toolkit` (==3.0.52) | Интерактивный CLI | Ввод с автодополнением, REPL | Интерфейс ввода/вывода |
| `croniter` (==6.0.0) | Cron-парсинг | Планировщик задач | Вычисление следующего запуска |
| `tenacity` (==9.1.4) | Retry-декораторы | Повторные запросы к API | Устойчивость к ошибкам |
| `Pillow` (==12.2.0) | Обработка изображений | Сжатие/изменение размера картинок | Вставка в контекст |
| `psutil` (==7.2.2) | Управление процессами | Проверка PID, дерево процессов | Кросс-платформенное управление процессами |
| `jinja2` (==3.1.6) | Шаблонизатор | Генерация промптов | Динамические шаблоны системного промпта |
| `Markdown` (==3.10.2) | Markdown → HTML | Конвертация для Matrix, send_message | Rich-форматирование в мессенджерах |
| `PyJWT` (==2.12.1) | JWT-токены | Skills Hub auth (GitHub App) | Аутентификация |
| `python-dotenv` (==1.2.2) | Загрузка .env | API-ключи из ~/.hermes/.env | Безопасное хранение секретов |
| `fire` (==0.7.1) | CLI через декораторы | Запуск `run_agent.py` напрямую | Быстрый CLI для отладки |
| `pathspec` (==1.1.1) | .gitignore-матчинг | Desktop build stamp | Фильтрация файлов |
| `fastapi` (>=0.104.0) | Веб-фреймворк | Dashboard API, webhook | REST API |
| `uvicorn` (>=0.24.0) | ASGI-сервер | Запуск FastAPI | Асинхронный HTTP-сервер |
| `ptyprocess` (>=0.7.0) | PTY (POSIX) | Терминальные сессии | Эмуляция терминала |

---

## Перенос на Node.js

### Архитектура

Агентский цикл на Node.js выглядит идентично по логике, но использует нативные
механизмы: `async/await` вместо `asyncio`, EventEmitter вместо callback'ов,
TypeScript для типизации вместо pydantic.

```
// Основной цикл на Node.js (концепт)
async function runConversation(agent: AIAgent, userMessage: string): Promise<string> {
  agent.messages.push({ role: 'user', content: userMessage });

  while (agent.iterationBudget.remaining > 0) {
    const response = await agent.client.chat.completions.create({
      model: agent.model,
      messages: agent.messages,
      tools: agent.tools,
    });

    if (!response.choices[0].message.tool_calls) {
      return response.choices[0].message.content;
    }

    agent.messages.push(response.choices[0].message);

    for (const toolCall of response.choices[0].message.tool_calls) {
      const result = await handleFunctionCall(toolCall.function.name, JSON.parse(toolCall.function.arguments));
      agent.messages.push({
        role: 'tool',
        tool_call_id: toolCall.id,
        content: JSON.stringify(result),
      });
    }
  }
}
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `openai` | `openai` (npm, v5+) | OpenAI-совместимый SDK | `new OpenAI({ baseURL, apiKey })` | Единый клиент к LLM API |
| `openai` (Anthropic) | `@anthropic-ai/sdk` | Anthropic Messages API | `new Anthropic()` | Нативная поддержка Claude |
| `httpx` | `undici` | HTTP-клиент | Транспорт для SDK | Быстрый HTTP, connection pooling |
| `pydantic` | `zod` | Валидация схем | `z.object({...})` | Runtime-валидация + генерация TypeScript-типов |
| `pyyaml` | `yaml` (js-yaml) | YAML-парсер | `yaml.load(text)` | Чтение config.yaml |
| `rich` | `chalk` + `cli-table3` | Форматирование | `chalk.cyan('text')` | Цветной вывод в CLI |
| `prompt_toolkit` | `ink` (React для CLI) | Интерактивный ввод | `<TextInput />` | REPL-интерфейс |
| `croniter` | `croner` | Cron-парсинг | `new Cron(schedule)` | Вычисление следующего запуска |
| `tenacity` | `retry` (npm) | Retry | `retry(asyncFn, { retries: 3 })` | Устойчивость к ошибкам |
| `Pillow` | `sharp` | Изображения | `sharp(buffer).resize(800)` | Сжатие изображений |
| `psutil` | `process` (npm) | Процессы | `process.kill(pid)` | Управление процессами |
| `sqlite3` | `better-sqlite3` | SQLite | `new Database(path)` | Синхронная SQLite (быстрее) |
| `threading` | `worker_threads` | Мультипоточность | `new Worker(path)` | Параллельное выполнение |
| `asyncio` | Нативный event loop | Асинхронность | `async/await` | Нативно, без обёрток |
| `subprocess` | `child_process` | Запуск процессов | `exec()` / `spawn()` | Выполнение команд |
| `ptyprocess` | `node-pty` | PTY | `pty.spawn(command)` | Эмуляция терминала |
| `pathlib` | `node:path` + `fs/promises` | Файловые пути | `path.join()`, `fs.readFile()` | Работа с ФС |

### Подводные камни переноса

1. **asyncio → event loop**: Python'овский `asyncio.run()` создаёт и закрывает loop.
   В Node.js event loop существует всегда — нет проблемы "Event loop is closed".
   Но `model_tools.py` использует паттерн persistent loop для sync→async bridge;
   в Node.js это не нужно — все вызовы нативно async.

2. **Мультипоточность**: Python использует `threading` + `GIL` для параллельности
   (реальная параллельность только через `multiprocessing` или `concurrent.futures`).
   В Node.js `worker_threads` дают true parallelism, но通常 используют `Promise.all`
   для I/O-bound задач (нет GIL-ограничений).

3. **Потокобезопасность**: `IterationBudget` в Python использует `threading.Lock()`.
   В Node.js достаточно `Atomic<number>` или просто числа (single-threaded event loop).

4. **TypeScript вместо Pydantic**: Zod схемы автоматически генерируют TS-типы
   через `z.infer<typeof schema>` — это строгое соответствие runtime и compile-time.

5. **OpenAI SDK**: npm-пакет `openai` почти идентичен Python-версии по API.
   Стриминг через `for await (const chunk of stream)` вместо `stream.choices`.

6. **SQLite**: `better-sqlite3` синхронный (как Python sqlite3), что упрощает код.
   FTS5 доступен напрямую.

---

## Кросс-ссылки

- [02 — Модели и провайдеры](./02-models-and-providers.md)
- [03 — Инструменты и тулсеты](./03-tools-and-toolsets.md)
- [08 — Память](./08-memory.md)
- [12 — Глоссарий](./12-glossary.md)
