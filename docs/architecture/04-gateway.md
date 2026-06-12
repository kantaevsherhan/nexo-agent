# 04 — Шлюз сообщений (Gateway)

## Введение

Gateway — это долгоживущий процесс, объединяющий все мессенджер-платформы
(Telegram, Discord, Slack, WhatsApp, Matrix и др.) в единый интерфейс.
Один процесс gateway обслуживает все подключённые платформы одновременно.

---

## Как это работает

### Архитектура Gateway

```
┌─────────────────────────────────────────────────────┐
│                   GatewayRunner                     │
│               gateway/run.py (~15.8k LOC)           │
│                                                     │
│  asyncio event loop                                 │
│  ├── SessionStore (сессии)                          │
│  ├── AIAgent cache (LRU, 128 max)                  │
│  ├── Cron scheduler (background tick)               │
│  └── Platform adapters                              │
└──────────────────┬──────────────────────────────────┘
                   │
    ┌──────────────┼──────────────────────┐
    │              │                      │
┌───▼──────┐ ┌────▼──────┐ ┌─────────────▼─────────┐
│ Telegram │ │ Discord   │ │  Slack / WhatsApp /   │
│ adapter  │ │ adapter   │ │  Matrix / Signal /... │
│          │ │           │ │                       │
└───┬──────┘ └────┬──────┘ └──────────┬────────────┘
    │              │                   │
    ▼              ▼                   ▼
  Bot API      Discord.js SDK      Platform SDKs
```

### Поток сообщения через Gateway

```
1. Входящее сообщение от платформы
   │
   ▼
2. Platform adapter → GatewayEvent (нормализация)
   │  { platform, chat_id, user_id, content, ... }
   │
   ▼
3. SessionStore.get_or_create(session_key)
   │  → Проверка reset policy
   │  → Загрузка history из state.db
   │
   ▼
4. AIAgent cache lookup (LRU, 128 agents max, 1h idle TTL)
   │  → Новый agent или существующий
   │
   ▼
5. agent.interrupt() если уже запущен → queue message
   │  или
   │  agent.run_conversation(message)
   │
   ▼
6. Стриминг ответа → Platform adapter → отправка в чат
   │
   ▼
7. Сохранение в state.db (SessionDB)
```

### Session management

`gateway/session.py`:
- `SessionSource` — dataclass с platform, chat_id, user_id, thread_id
- `SessionResetPolicy` — когда начинать новую сессию
- Хранение: `~/.hermes/sessions/sessions.json` (index) + `state.db` (сообщения)

### Platform adapters

Каждая платформа наследуется от `gateway/platforms/base.py`:

```python
class PlatformAdapter(ABC):
    async def connect(self)      # Подключение к API
    async def disconnect(self)   # Отключение
    async def send(self, chat_id, content, metadata)  # Отправка
    async def start(self)        # Запуск polling/webhook
```

Поддерживаемые платформы (32 файла в `gateway/platforms/`):
- Telegram, Discord, Slack, WhatsApp
- Matrix, Mattermost, Signal
- WeChat (Weixin), WeCom, DingTalk, Feishu
- Email, SMS, Webhook
- BlueBubbles, QQBot, Yuanbao
- HomeAssistant, API Server

### Стриминг в gateway

Агент стримит ответы через callbacks:
- `stream_delta_callback` — каждый токен текста
- `tool_start_callback` — начало вызова инструмента
- `tool_complete_callback` — завершение инструмента
- `status_callback` — статусные сообщения

Gateway перенаправляет эти callbacks в platform adapter для доставки.

---

## Реализация в коде

| Файл | Роль |
|------|------|
| `gateway/run.py` | `GatewayRunner` — основной класс, asyncio loop, session cache |
| `gateway/session.py` | `SessionSource`, `SessionManager`, reset policy |
| `gateway/config.py` | `GatewayConfig`, `Platform` enum |
| `gateway/platforms/base.py` | `PlatformAdapter` — абстрактный базовый класс |
| `gateway/platforms/telegram.py` | Telegram Bot API (python-telegram-bot) |
| `gateway/platforms/discord.py` | Discord (discord.py) |
| `gateway/platforms/slack.py` | Slack (slack-bolt, slack-sdk) |
| `gateway/platforms/whatsapp.py` | WhatsApp |
| `gateway/platforms/matrix.py` | Matrix (mautrix) |
| `gateway/platforms/signal.py` | Signal |
| `gateway/platforms/webhook.py` | Generic webhook |
| `gateway/platforms/api_server.py` | OpenAI-compatible API server |
| `gateway/hooks.py` | Lifecycle hooks (pre/post tool call) |
| `gateway/delivery.py` | Доставка ответов в мессенджеры |
| `gateway/slash_commands.py` | Slash-команды в gateway |
| `gateway/mirror.py` | Mirroring сообщений |

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `python-telegram-bot` (==22.6, opt-in) | Telegram Bot API | `telegram.py` — polling/webhook | Нативная поддержка Telegram |
| `discord.py` (==2.7.1, opt-in) | Discord API | `discord.py` — intents, events | Нативная поддержка Discord |
| `slack-bolt` (==1.27.0, opt-in) | Slack框架 | `slack.py` — events, slash commands | Нативная поддержка Slack |
| `aiohttp` (==3.13.4) | Async HTTP | Webhook, callback modes | HTTP-сервер для webhook'ов |
| `mautrix` (==0.21.0, opt-in) | Matrix | `matrix.py` — end-to-end encryption | Полная поддержка Matrix |
| `asyncio` | Event loop | Основной loop gateway | Мультиплатформенность в одном loop |
| `sqlite3` | БД | Session persistence | Хранение сессий |

---

## Перенос на Node.js

### Архитектура

```typescript
// Gateway на Node.js
import { Telegraf } from 'telegraf';
import { Client as DiscordClient } from 'discord.js';
import { App } from '@slack/bolt';

class GatewayRunner {
  private adapters: PlatformAdapter[] = [];
  private sessionStore: SessionStore;
  private agentCache: LRUCache<string, AIAgent>;

  async start(): Promise<void> {
    // Запуск всех адаптеров параллельно
    await Promise.all(this.adapters.map(a => a.connect()));
    // Cron tick
    setInterval(() => this.cronScheduler.tick(), 60_000);
  }

  async handleMessage(event: GatewayEvent): Promise<void> {
    const session = await this.sessionStore.getOrCreate(event.sessionKey);
    const agent = this.getOrCreateAgent(session);
    const response = await agent.runConversation(event.content);
    await this.adapters.find(a => a.platform === event.platform)
      .send(event.chatId, response);
  }
}
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `python-telegram-bot` | `telegraf` / `grammy` | Telegram Bot | `new Telegraf(token)` | Нативный Telegram |
| `discord.py` | `discord.js` | Discord Bot | `new Client({ intents })` | Нативный Discord |
| `slack-bolt` | `@slack/bolt` | Slack App | `new App({ token, signingSecret })` | Нативный Slack |
| `aiohttp` | `express` / `fastify` | HTTP-сервер | `app.post('/webhook', handler)` | Webhook-эндпоинты |
| `mautrix` | `matrix-js-sdk` | Matrix | `new MatrixClient(homeserverUrl)` | Matrix client |
| `asyncio` | Нативный event loop | Event loop | `async/await` | Нативно |
| `sqlite3` | `better-sqlite3` | SQLite | `new Database(path)` | Session persistence |

### Подводные камни переноса

1. **Event loop**: Python gateway использует `asyncio.run()` +长期运行 event loop.
   Node.js event loop является нативным — gateway просто `await`-ит все операции.

2. **Telegram**: `telegraf` / `grammy` — зрелые альтернативы. `grammy` более
   современный и активно поддерживается. Оба работают с long polling и webhooks.

3. **Discord**: `discord.js` — стандарт де-факто. Поддерживает intents, eventos,
   slash commands. `discord.py` имеет аналогичный API.

4. **Matrix**: `matrix-js-sdk` — полная поддержка E2E encryption. Альтернатива:
   `matrix-bot-sdk` для ботов.

5. **Мультиплатформенность**: В Python один `asyncio` loop обслуживает все
   платформы. В Node.js — аналогично: один event loop + `Promise.all()`.

6. **Кэширование агентов**: В Python — `OrderedDict` с LRU (128 max, 1h idle TTL).
   В Node.js — `lru-cache` npm package.

---

## Кросс-ссылки

- [01 — Общая архитектура](./01-architecture.md)
- [05 — Cron и планировщик](./05-cron-and-scheduling.md)
- [11 — TUI](./11-tui.md)
