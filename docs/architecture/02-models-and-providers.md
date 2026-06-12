# 02 — Модели и провайдеры

## Введение

Hermes Agent работает с десятками LLM-провайдеров через единую абстракцию.
Провайдеры описываются декларативными профилями (`ProviderProfile`), а транспортные
слои адаптируют запросы под конкретный API.

---

## Как это работает

### Архитектура провайдеров

```
┌─────────────────────────────────────────────────────┐
│                   AIAgent                           │
│  client = OpenAI(base_url, api_key)                │
│  model = "claude-opus-4-20250514"                   │
│  api_mode = "chat_completions" | "codex_responses"  │
└──────────────────┬──────────────────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
  ┌──────▼──────┐    ┌───────▼───────┐
  │ chat_compl. │    │ codex_responses│
  │ transports/ │    │ transports/    │
  └──────┬──────┘    └───────┬───────┘
         │                   │
         ▼                   ▼
  ┌──────────────────────────────────┐
  │  OpenAI SDK (httpx transport)    │
  │  POST /v1/chat/completions       │
  │  или POST /v1/responses          │
  └──────────────────────────────────┘
                   │
         ┌─────────┼─────────┐
         │         │         │
    ┌────▼───┐ ┌──▼────┐ ┌──▼─────┐
    │ OpenAI │ │Anthrop│ │  GMI   │
    │ Router │ │  ic   │ │ Cloud  │
    │        │ │       │ │        │
    └────────┘ └───────┘ └────────┘
```

### ProviderProfile — декларативный профиль

Каждый провайдер описан в `providers/base.py:ProviderProfile`:

```python
@dataclass
class ProviderProfile:
    name: str                    # "openrouter", "anthropic", "gmi"
    api_mode: str = "chat_completions"  # или "codex_responses"
    aliases: tuple = ()          # альтернативные имена
    env_vars: tuple = ()         # переменные окружения для API-ключа
    base_url: str = ""           # базовый URL API
    auth_type: str = "api_key"   # api_key | oauth_device_code | copilot
    supports_vision: bool = False
    fixed_temperature: Any = None  # None = по умолчанию, OMIT_TEMPERATURE = не отправлять
    default_max_tokens: int | None = None
    fallback_models: tuple = ()  # модели для /model picker
    default_headers: dict = field(default_factory=dict)
```

### Discovery провайдеров

Провайдеры обнаруживаются лениво (`providers/__init__.py:53`):

1. Сканирование `plugins/model-providers/<name>/` (встроенные)
2. Сканирование `$HERMES_HOME/plugins/model-providers/<name>/` (пользовательские)
3. Обратная совместимость: `providers/<name>.py` (legacy)

Пользовательские плагины перезаписывают встроенные (last-writer-wins).

### Запрос к API

Основной путь — `agent/conversation_loop.py`:

1. `_prepare_api_messages()` — санитизация, конвертация форматов
2. `apply_anthropic_cache_control()` — установка cache markers
3. `_get_transport(mode).call(api_kwargs)` — dispatch на транспорт
4. Стриминг: `interruptible_streaming_api_call()` — чтение SSE-событий
5. Обработка ответа: извлечение content, tool_calls, usage

### Tool calling

Модель возвращает `tool_calls` вместо текста:

```json
{
  "tool_calls": [{
    "id": "call_abc123",
    "type": "function",
    "function": {
      "name": "terminal",
      "arguments": "{\"command\": \"ls -la\"}"
    }
  }]
}
```

Агент:
1. Добавляет `assistant` сообщение с `tool_calls`
2. Вызывает `handle_function_call(name, args)` для каждого tool_call
3. Добавляет `tool` сообщение с результатом
4. Повторяет запрос к модели

---

## Реализация в коде

| Файл | Роль |
|------|------|
| `providers/__init__.py` | Discovery провайдеров, `register_provider()`, `get_provider_profile()` |
| `providers/base.py` | `ProviderProfile` — dataclass профиля |
| `plugins/model-providers/*/` | Плагины провайдеров (openrouter, anthropic, gmi, deepseek…) |
| `agent/transports/` | Транспортные слои: `chat_completions`, `codex_responses` |
| `agent/chat_completion_helpers.py` | Стриминг, обработка ошибок, fallback |
| `agent/anthropic_adapter.py` | Конвертация сообщений для Anthropic API |
| `agent/codex_responses_adapter.py` | Адаптер для Responses API |
| `agent/model_metadata.py` | Метаданные моделей (контекстное окно, capabilities) |
| `agent/error_classifier.py` | Классификация ошибок API (rate limit, auth, billing…) |
| `agent/credential_pool.py` | Пул credentials для ротации при rate limits |
| `agent/usage_pricing.py` | Калькуляция стоимости токенов |
| `agent/prompt_caching.py` | Управление prompt caching (Anthropic, OpenAI) |
| `agent/retry_utils.py` | `jittered_backoff()` — экспоненциальный backoff |

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `openai` (==2.24.0) | OpenAI-совместимый SDK | `client.chat.completions.create()`, streaming | Единый интерфейс к 100+ провайдерам через OpenRouter |
| `httpx` (==0.28.1) | Async HTTP-клиент | Транспорт для OpenAI SDK, SOCKS-прокси | Connection pooling, keepalive, прокси |
| `tenacity` (==9.1.4) | Retry-декораторы | Повторные запросы при transient ошибках | Устойчивость к 429/5xx |
| `anthropic` (==0.86.0, opt-in) | Anthropic SDK | Прямые запросы к Claude API | Нативные thinking blocks, cache control |

---

## Перенос на Node.js

### Архитектура

Node.js-версия использует те же npm-пакеты для LLM API. TypeScript-типы
обеспечивают строгую типизацию на этапе компиляции.

```typescript
// Провайдер на Node.js
interface ProviderProfile {
  name: string;
  apiMode: 'chat_completions' | 'codex_responses';
  baseUrl: string;
  authType: 'api_key' | 'oauth';
  envVars: string[];
  supportsVision: boolean;
  fixedTemperature?: number | null;
}

// Запрос к LLM
const client = new OpenAI({ baseURL: profile.baseUrl, apiKey });
const stream = await client.chat.completions.create({
  model,
  messages,
  tools,
  stream: true,
});

for await (const chunk of stream) {
  const delta = chunk.choices[0]?.delta;
  if (delta?.content) process.stdout.write(delta.content);
  if (delta?.tool_calls) handleToolCalls(delta.tool_calls);
}
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `openai` | `openai` (npm v5) | OpenAI SDK | `new OpenAI({ baseURL })` | Единый клиент, стриминг |
| — | `@anthropic-ai/sdk` | Anthropic SDK | `new Anthropic()` | Claude: нативные cache control, thinking |
| — | `@google/genai` | Google AI SDK | `new GoogleGenAI()` | Gemini: нативные function calls |
| `httpx` | `undici` | HTTP | Транспорт для SDK | Высокая производительность |
| `tenacity` | `retry` / `p-retry` | Retry | `retry(fn, { retries: 3 })` | Устойчивость к ошибкам |
| — | `eventsource-client` | SSE-клиент | Стриминг | Для провайдеров без нативного SDK |

### Подводные камни переноса

1. **Два API-режима**: `chat_completions` (OpenAI-compatible) и `codex_responses`
   (Responses API). В Node.js SDK OpenAI поддерживает оба через `client.chat.completions`
   и `client.responses`.

2. **Стриминг**: В Python используется `for chunk in response` (sync generator).
   В Node.js — `for await (const chunk of stream)` (async iterable).

3. **Prompt caching**: Anthropic cache control markers устанавливаются через
   `prompt_caching.py`. В `@anthropic-ai/sdk` аналогично: `cache_control: { type: "ephemeral" }`.

4. **Credential pool**: В Python реализован в `agent/credential_pool.py`.
   В Node.js — аналогичная структура с массивом ключей и ротацией при 429.

5. **Адаптеры провайдеров**: Каждый провайдер может иметь кастомные headers,
   temperature overrides, модели. В TypeScript — union types для каждого профиля.

---

## Кросс-ссылки

- [01 — Общая архитектура](./01-architecture.md)
- [03 — Инструменты и тулсеты](./03-tools-and-toolsets.md)
- [09 — Плагины и MCP](./09-plugins-and-mcp.md)
