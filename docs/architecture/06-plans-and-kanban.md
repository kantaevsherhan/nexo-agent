# 06 — Планы и Kanban

## Введение

Hermes Agent поддерживает декомпозицию задач через систему планов (`plans/`,
`.plans/`) и мультиагентную координацию через Kanban-доски. Kanban позволяет
нескольким профилям/агентам сотрудничать над общими задачами.

---

## Как это работает

### Kanban-архитектура

```
┌──────────────────────────────────────────┐
│          Kanban Board (SQLite)           │
│  ~/.hermes/kanban/<board>.db            │
│                                          │
│  ┌─────────┐ ┌────────┐ ┌──────────┐   │
│  │  TODO   │ │IN PROG │ │  DONE    │   │
│  │         │ │        │ │          │   │
│  │ Task 1  │ │ Task 2 │ │ Task 3   │   │
│  │ Task 4  │ │        │ │          │   │
│  └─────────┘ └────────┘ └──────────┘   │
└──────────────────┬───────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼────┐         ┌────▼────┐
    │Worker 1 │         │Worker 2 │
    │(profile)│         │(profile)│
    └─────────┘         └─────────┘
```

### Структура задачи Kanban

```python
task = {
    "id": "task-uuid",
    "title": "Implement auth module",
    "description": "...",
    "status": "open",  # open | in_progress | blocked | done | abandoned
    "assignee": "coder-profile",
    "board": "my-project",
    "priority": "high",
    "created_at": "...",
    "updated_at": "...",
    "blocked_by": [],  # IDs зависимостей
    "links": [],       # Связи с другими задачами
}
```

### Dispatcher

Диспетчер — долгоживущий цикл, который:
1. Reclaims stale claims (задачи без heartbeat)
2. Promotes ready tasks (все зависимости выполнены)
3. Atomically claims задачи
4. Spawns assigned profiles (запускает агента)

Работает внутри gateway по умолчанию (`kanban.dispatch_in_gateway: true`).

### Инструменты Kanban

Для агентов-воркеров доступен тулсет `kanban`:
- `kanban_show` — показать задачу
- `kanban_complete` — завершить задачу
- `kanban_block` — заблокировать задачу
- `kanban_heartbeat` — подтвердить активность
- `kanban_comment` — добавить комментарий

### Изоляция

- **Board** — жёсткая граница: воркеры видят только свой board
- **Tenant** — мягкое пространство внутри board (workspace-path + memory-key)

###.failure_limit

После `kanban.failure_limit` (по умолчанию 2) последовательных неудачных попыток
на одной задаче, dispatcher автоматически блокирует её для предотвращения spin-лупов.

---

## Реализация в коде

| Файл | Роль |
|------|------|
| `hermes_cli/kanban.py` | CLI: `hermes kanban <verb>` |
| `hermes_cli/kanban_db.py` | SQLite-хранилище досок |
| `hermes_cli/kanban_decompose.py` | Декомпозиция задач LLM |
| `hermes_cli/kanban_specify.py` | Детализация задач |
| `hermes_cli/kanban_swarm.py` | Мультиагентный запуск |
| `tools/kanban_tools.py` | Инструменты для агентов-воркеров |
| `gateway/kanban_watchers.py` | Мониторинг в gateway |

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `sqlite3` | БД | Kanban board storage | Хранение задач |
| `threading` | Lock | `_jobs_file_lock` | Потокобезопасность |

---

## Перенос на Node.js

### Архитектура

```typescript
// Kanban на Node.js
import Database from 'better-sqlite3';

class KanbanDB {
  private db: Database.Database;

  createTask(task: Omit<KanbanTask, 'id'>): KanbanTask {
    const id = randomUUID();
    this.db.prepare('INSERT INTO tasks ...').run(id, task.title, ...);
    return { ...task, id };
  }

  claimTask(taskId: string, assignee: string): boolean {
    const result = this.db.prepare(
      'UPDATE tasks SET status = ?, assignee = ? WHERE id = ? AND status = ?'
    ).run('in_progress', assignee, taskId, 'open');
    return result.changes > 0;
  }
}
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `sqlite3` | `better-sqlite3` | SQLite | `new Database(path)` | Синхронная, быстрая |
| `threading` | Нативный event loop | Синхронизация | Single-threaded | Не нужен |

### Подводные камни переноса

1. **SQLite**: `better-sqlite3` синхронный — отлично для Kanban (мало concurrency).
   WAL mode поддерживается.

2. **Dispatcher**: В Python запускается в background thread. В Node.js —
   `setInterval()` в event loop.

3. **Atomic claims**: В SQL — `UPDATE ... WHERE status = 'open' RETURNING *`.
   Атомарность обеспечивается SQLite.

---

## Кросс-ссылки

- [03 — Инструменты и тулсеты](./03-tools-and-toolsets.md)
- [01 — Общая архитектура](./01-architecture.md)
