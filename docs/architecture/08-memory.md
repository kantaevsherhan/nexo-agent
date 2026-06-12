# 08 — Память

## Введение

Система памяти Hermes Agent включает: SQLite-хранилище сессий (FTS5 поиск),
плагинные memory-провайдеры (honcho, mem0, supermemory…), и контекстные блоки
(MEMORY.md, USER.md).

---

## Как это работает

### Архитектура памяти

```
┌─────────────────────────────────────────────────┐
│                  AIAgent                        │
│                                                 │
│  System Prompt                                  │
│  ├── stable: идентичность                       │
│  ├── context: AGENTS.md, .cursorrules           │
│  └── volatile: MEMORY.md + memory provider      │
│                                                 │
│  Memory Manager                                 │
│  ├── prefetch(query) → context до turn          │
│  ├── sync_turn(messages) → сохранение после turn │
│  └── build_system_prompt() → инъекция в промпт  │
└──────────────────┬──────────────────────────────┘
                   │
    ┌──────────────┼──────────────┐
    │              │              │
┌───▼──────┐ ┌────▼─────┐ ┌─────▼──────┐
│ SQLite   │ │ Plugin   │ │ MEMORY.md  │
│ state.db │ │ Provider │ │ (файл)     │
│ (FTS5)   │ │ (honcho, │ │            │
│          │ │  mem0,   │ │            │
│          │ │  ...)    │ │            │
└──────────┘ └──────────┘ └────────────┘
```

### SessionDB — SQLite хранилище

`hermes_state.py` — `SessionDB`:
- **WAL mode** для concurrent readers + один writer
- **FTS5** виртуальная таблица для полнотекстового поиска
- Хранит: сессии, сообщения, модель, system prompt
- **Schema version**: 15 (миграции при обновлении)

```sql
-- Основные таблицы
CREATE TABLE sessions (
    id TEXT PRIMARY KEY,
    source TEXT,       -- 'cli', 'telegram', 'discord', ...
    model TEXT,
    created_at REAL,
    updated_at REAL
);

CREATE VIRTUAL TABLE messages_fts USING fts5(
    session_id, role, content,
    tokenize='porter unicode61'
);
```

### Memory providers

`agent/memory_manager.py` — `MemoryManager`:
- Оркестрирует зарегистрированных memory-провайдеров
- Только ОДИН внешний провайдер за раз
- Lifecycle: `prefetch()` → turn → `sync_turn()` → `queue_prefetch()`

Провайдеры (`plugins/memory/`):
- honcho, mem0, supermemory, byterover, hindsight, holographic, openviking, retaindb
- Каждый реализует `MemoryProvider` ABC

### Контекстные файлы

Системный промпт включает:
- `~/.hermes/MEMORY.md` — постоянная память
- `~/.hermes/USER.md` — профиль пользователя
- `AGENTS.md`, `.cursorrules` — контекст проекта

---

## Реализация в коде

| Файл | Роль |
|------|------|
| `hermes_state.py` | `SessionDB` — SQLite (WAL + FTS5), CRUD сессий |
| `agent/memory_manager.py` | `MemoryManager` — оркестрация провайдеров |
| `agent/memory_provider.py` | `MemoryProvider` — ABC для провайдеров |
| `agent/context_compressor.py` | Автосжатие контекста (summary) |
| `plugins/memory/*/` | Провайдеры: honcho, mem0, supermemory… |
| `tools/memory_tool.py` | Инструмент memory для агента |
| `tools/session_search_tool.py` | Полнотекстовый поиск по сессиям |

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `sqlite3` | БД | SessionDB, state.db | Хранение сессий |
| FTS5 | Полнотекстовый поиск | messages_fts виртуальная таблица | Поиск по истории |

---

## Перенос на Node.js

### Архитектуura

```typescript
// SessionDB на Node.js
import Database from 'better-sqlite3';

class SessionDB {
  private db: Database.Database;

  constructor(dbPath: string) {
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        source TEXT,
        model TEXT,
        created_at INTEGER
      );
      CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
        session_id, role, content,
        tokenize='porter unicode61'
      );
    `);
  }

  search(query: string): Message[] {
    return this.db.prepare(
      'SELECT * FROM messages_fts WHERE messages_fts MATCH ?'
    ).all(query);
  }
}
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `sqlite3` | `better-sqlite3` | SQLite | `new Database(path)` | WAL, FTS5, синхронный |
| — | `better-sqlite3` (FTS5) | Полнотекстовый поиск | `MATCH` запросы | Поиск по истории |

### Подводные камни переноса

1. **better-sqlite3** синхронный — отлично для однопоточного Node.js.
   WAL mode поддерживается нативно.

2. **FTS5** доступен в `better-sqlite3` без дополнительных зависимостей.

3. **Memory providers**: Каждый провайдер — отдельный npm-пакет или API вызов.
   `MemoryProvider` интерфейс на TypeScript.

---

## Кросс-ссылки

- [01 — Общая архитектура](./01-architecture.md)
- [07 — Навыки](./07-skills.md)
- [09 — Плагины и MCP](./09-plugins-and-mcp.md)
