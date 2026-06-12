# 05 — Cron и планировщик задач

## Введение

Встроенный планировщик (`cron/`) позволяет агенту выполнять задачи по расписанию
без участия пользователя. Запускается внутри gateway-процесса, хранит задания
в JSON-файле, выполняет через `AIAgent`.

---

## Как это работает

### Архитектура

```
┌────────────────────────────────────────┐
│         GatewayRunner                  │
│  gateway/run.py                        │
│  background thread → scheduler.tick()  │
│  каждые 60 секунд                      │
└──────────┬─────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│      cron/scheduler.py                 │
│  tick() → проверка due jobs            │
│  run_job() → AIAgent.run_conversation  │
│  file lock: ~/.hermes/cron/.tick.lock  │
└──────────┬─────────────────────────────┘
           │
           ▼
┌────────────────────────────────────────┐
│      cron/jobs.py                      │
│  Хранилище: ~/.hermes/cron/jobs.json   │
│  Вывод: ~/.hermes/cron/output/{id}/    │
└────────────────────────────────────────┘
```

### Форматы расписаний

| Формат | Пример | Описание |
|--------|--------|----------|
| Duration | `"30m"`, `"2h"`, `"1d"` | Интервал от текущего момента |
| "every" | `"every 2h"`, `"every monday 9am"` | Натуральный язык |
| Cron-выражение | `"0 9 * * *"` | 5-полевый cron-синтаксис |
| ISO timestamp | `"2026-06-01T09:00:00Z"` | Разовый запуск |

### Структура задачи

```python
job = {
    "id": "uuid",
    "name": "Daily standup",
    "prompt": "Запланируй мой день",
    "schedule": "0 9 * * *",
    "enabled": True,
    "state": "scheduled",  # scheduled | paused | running
    "skills": ["github"],
    "model": "gpt-4o",
    "provider": "openrouter",
    "script": "python collect_data.py",  # optional pre-run script
    "context_from": "prev_job_id",  # optional chaining
    "workdir": "/path/to/project",  # optional working directory
    "delivery": {"platform": "telegram", "chat_id": "..."},
    "next_run": "2026-06-13T09:00:00Z",
    "last_run": "2026-06-12T09:00:00Z",
}
```

### Безопасность

- **Toolset-фильтрация**: Cron-агенты не получают `cronjob`, `messaging`, `clarify`
- **Prompt injection scanning**: Собранный промпт проверяется на инъекции
- **3-минутный hard interrupt**: Зависшие cron-сессии принудительно останавливаются
- **Catchup window**: Половина периода задания (clamp 120s–2h)
- **Grace window**: 120s для пропущенных one-shot задач
- **File lock**: `~/.hermes/cron/.tick.lock` предотвращает параллельные tick'и

### Доставка результатов

Cron-задачи могут доставлять результаты в мессенджеры:
- Telegram, Discord, Slack, WhatsApp
- Matrix, Signal, Mattermost
- Email, SMS, Webhook

Доставка идёт в отдельную cron-сессию (не в основной чат).

---

## Реализация в коде

| Файл | Роль |
|------|------|
| `cron/jobs.py` | Хранилище задач (jobs.json), CRUD-операции |
| `cron/scheduler.py` | Тик-цикл, запуск задач, file lock, delivery |
| `gateway/run.py` | Запуск `scheduler.tick()` в background thread |

### Файлы данных

- `~/.hermes/cron/jobs.json` — все задачи
- `~/.hermes/cron/output/{job_id}/{timestamp}.md` — результаты выполнения
- `~/.hermes/cron/.tick.lock` — файловый lock

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `croniter` (==6.0.0) | Cron-парсинг | Вычисление `next_run` | Парсинг 5-полевых cron-выражений |
| `threading` | Lock | `_jobs_file_lock`, `.tick.lock` | Потокобезопасность |
| `fcntl` / `msvcrt` | File lock | Межпроцессный lock | Предотвращение параллельных tick'и |
| `json` | Хранение | jobs.json | Простое хранилище |
| `uuid` | Генерация ID | `job["id"] = str(uuid4())` | Уникальные идентификаторы |
| `subprocess` | Запуск скриптов | `script` field execution | Пред-запуск скриптов |

---

## Перенос на Node.js

### Архитектура

```typescript
// Cron на Node.js
import { Cron } from 'croner';

class CronScheduler {
  private jobs: Map<string, CronJob>;
  private lock: FileLock;

  tick(): void {
    const now = Date.now();
    for (const [id, job] of this.jobs) {
      if (job.isEnabled && job.nextRun <= now) {
        this.runJob(job);
        job.nextRun = this.calculateNextRun(job.schedule);
      }
    }
  }

  async runJob(job: CronJob): Promise<void> {
    const agent = new AIAgent({ model: job.model, provider: job.provider });
    const result = await agent.runConversation(job.prompt);
    await this.deliverResult(job, result);
  }
}
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `croniter` | `croner` | Cron-парсинг | `new Cron(schedule).next()` | Вычисление следующего запуска |
| `croniter` | `cron-parser` | Cron-парсинг | `cronParser.parseExpression(schedule)` | Альтернативный парсер |
| `fcntl`/`msvcrt` | `proper-lockfile` | File lock | `lockfile.lock('tick.lock')` | Межпроцессный lock |
| `json` | `fs/promises` | Хранение | `JSON.parse(await readFile('jobs.json'))` | Чтение/запись jobs |
| `threading.Lock` | Нативный event loop | Синхронизация | Single-threaded, не нужен lock | Event loop serializes |

### Подводные камни переноса

1. **File lock**: Python использует `fcntl` (POSIX) / `msvcrt` (Windows) для
   межпроцессного lock. В Node.js — `proper-lockfile` (npm) или `fs-O_EXCL`.

2. **Параллельность**: Python gateway запускает `tick()` в отдельном thread.
   В Node.js — `setInterval()` в основном event loop (single-threaded).

3. **One-shot jobs**: ISO-timestamp задачи выполняются один раз. В Python —
   `croniter` для вычисления. В Node.js — `setTimeout()` или `croner`.

4. **Delivery**: Доставка результатов в мессенджеры через тот же gateway.
   В Node.js — reuse адаптеров из gateway.

---

## Кросс-ссылки

- [04 — Gateway](./04-gateway.md)
- [08 — Память](./08-memory.md)
- [07 — Навыки](./07-skills.md)
