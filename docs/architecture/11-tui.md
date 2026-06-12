# 11 — Терминальный интерфейс (TUI)

## Введение

Hermes Agent имеет две реализации TUI: классический CLI на `prompt_toolkit`
(Python) и современный TUI на React/Ink (TypeScript). Обе работают поверх
одного JSON-RPC бэкенда (`tui_gateway/`).

---

## Как это работает

### Архитектура TUI

```
┌──────────────────────────────────────────────────┐
│                  Ink (React)                     │
│              ui-tui/src/app.tsx                  │
│                                                  │
│  ┌────────────┐ ┌──────────┐ ┌──────────────┐  │
│  │ Transcript │ │ Composer │ │  Status Bar  │  │
│  │ (messages) │ │ (input)  │ │  (model/cost)│  │
│  └────────────┘ └──────────┘ └──────────────┘  │
└──────────────────┬───────────────────────────────┘
                   │  JSON-RPC over stdio
                   │  (Newline-delimited)
┌──────────────────▼───────────────────────────────┐
│              tui_gateway/server.py               │
│                                                  │
│  Transport: StdioTransport (stdin/stdout)        │
│                                                  │
│  Methods:                                        │
│  ├── prompt.submit → message.delta/complete      │
│  ├── session.list/resume                         │
│  ├── slash.exec → slash worker                   │
│  ├── complete.slash → completions               │
│  └── approval.respond ← approval.request         │
│                                                  │
│  Events:                                         │
│  ├── message.delta (токен текста)                │
│  ├── tool.start/progress/complete                │
│  ├── thinking (reasoning content)                │
│  └── status (lifecycle updates)                  │
└──────────────────┬───────────────────────────────┘
                   │
                   ▼
          AIAgent (Python)
```

### Классический CLI (prompt_toolkit)

`cli.py` — `HermesCLI`:
- **Rich** для баннера, панелей, таблиц
- **prompt_toolkit** для ввода с автодополнением
- **KawaiiSpinner** (`agent/display.py`) — анимированные спиннеры
- Skin engine (`hermes_cli/skin_engine.py`) — датаскинное темирование

### Современный TUI (Ink)

`ui-tui/` — React для терминала:
- **Ink** — React-компоненты для CLI
- **nanostores** — легковесные атомы состояния
- TypeScript для типизации

Структура `ui-tui/src/`:
```
├── app.tsx          # Главный компонент
├── entry.tsx        # Точка входа
├── gatewayClient.ts # JSON-RPC клиент
├── gatewayTypes.ts  # Типы протокола
├── theme.ts         # Тема
├── components/      # UI-компоненты
├── hooks/           # React hooks
├── lib/             # Утилиты
└── protocol/        # JSON-RPC протокол
```

### TUI Gateway — JSON-RPC бэкенд

`tui_gateway/server.py` (~9k LOC):
- Новый JSON-RPC over stdio
- Запуск AIAgent в ThreadPoolExecutor
- Session management
- Slash-команды через `_SlashWorker`

---

## Реализация в коде

| Файл | Роль |
|------|------|
| `cli.py` | Классический CLI (~13.5k LOC) |
| `hermes_cli/banner.py` | ASCII art баннер |
| `hermes_cli/skin_engine.py` | Движок тем |
| `agent/display.py` | KawaiiSpinner — анимации |
| `hermes_cli/commands.py` | COMMAND_REGISTRY — все slash-команды |
| `hermes_cli/completion.py` | Автодополнение |
| `ui-tui/src/` | Современный TUI (Ink/React) |
| `ui-tui/packages/hermes-ink/` | Кастомные Ink-компоненты |
| `tui_gateway/server.py` | JSON-RPC бэкенд |
| `tui_gateway/transport.py` | StdioTransport |
| `tui_gateway/slash_worker.py` | Slash-команды в worker |

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `prompt_toolkit` (==3.0.52) | CLI фреймворк | REPL, автодополнение, ввод | Интерактивный CLI |
| `rich` (==14.3.3) | Форматированный вывод | Баннер, панели, таблицы | Красивый вывод |

## Используемые библиотеки (TypeScript/ui-tui)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `ink` (v6) | React для CLI | UI-компоненты | Терминальный UI |
| `react` (v19) | UI framework | Компоненты | Декларативный UI |
| `nanostores` | State management | Атомы состояния | Легковесный shared state |
| `@nanostores/react` | React bindings | `useStore(atom)` | Хуки для nanostores |
| `ink-text-input` | Text input | Composer | Ввод текста |
| `unicode-animations` | Анимации | Спиннеры | Анимации в CLI |
| `tsx` | TypeScript runner | Dev/build | Запуск .tsx файлов |

---

## Перенос на Node.js

### Архитектура

TUI уже реализован на Node.js (Ink/React) в `ui-tui/`. Классический CLI
на prompt_toolkit (Python) не требует переноса — он заменяется Ink TUI.

```typescript
// TUI Gateway на Node.js
import { Server } from './tui_gateway/server';

// JSON-RPC over stdio
const server = new Server();
process.stdin.pipe(server.transport);
server.transport.pipe(process.stdout);

// Или: Ink TUI напрямую
import { render } from 'ink';
import { App } from './app';

render(<App />);
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `prompt_toolkit` | `ink` | CLI UI | `<Box><Text>...</Text></Box>` | Терминальный UI |
| `rich` | `chalk` + `ora` | Форматирование | `chalk.cyan()`, `ora().start()` | Цветной вывод |
| — | `@clack/prompts` | Prompts | `text({ message })` | Интерактивные промпты |
| `threading` | `worker_threads` | Мультипоточность | `new Worker()` | Запуск AIAgent |

### Подводные камни переноса

1. **Ink уже на Node.js**: `ui-tui/` — полностью TypeScript TUI. Перенос
   не требуется — это уже реализовано.

2. **JSON-RPC**: Протокол между Ink и tui_gateway стандартный.
   На Node.js можно использовать нативный streams.

3. **prompt_toolkit → Ink**: Классический CLI заменяется Ink. Разница:
   prompt_toolkit — синхронный REPL, Ink — декларативный React UI.

---

## Кросс-ссылки

- [04 — Gateway](./04-gateway.md)
- [01 — Общая архитектура](./01-architecture.md)
