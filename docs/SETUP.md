# nexo-agent — Руководство по настройке

## Быстрый старт

```bash
# 1. Клонировать и установить зависимости
git clone <repo-url> && cd nexo-agent
npm install

# 2. Создать .env файл
cp .env.example .env   # или создать вручную

# 3. Собрать проект
npm run build

# 4. Запустить
npm start chat          # интерактивный чат
npm start cron          # планировщик задач
npm start gateway       # шлюз (Telegram + крон)
```

---

## Переменные окружения

Создайте файл `.env` в корне проекта (или в `~/.nexo-agent/.env`):

```env
# === Обязательные ===
OPENAI_API_KEY=sk-...           # API-ключ OpenAI (или совместимого провайдера)

# === Провайдер и модель ===
NEXO_PROVIDER=openai            # openai | openrouter | together | groq
NEXO_MODEL=gpt-4o               # gpt-4o | gpt-4o-mini | claude-3.5-sonnet | ...

# === Опциональные ===
NEXO_BASE_URL=                  # кастомный URL API (для self-hosted)
NEXO_MAX_TOKENS=4096            # макс. токенов в ответе
NEXO_TEMPERATURE=0.7            # температура (0.0–2.0)
NEXO_MAX_ITERATIONS=90          # макс. итераций агента за один ответ
NEXO_LOG_LEVEL=info             # debug | info | warn | error
NEXO_WORKDIR=                   # рабочая директория агента
NEXO_SESSION_DIR=               # директория для сессий
NEXO_SKILLS_DIR=                # директория для навыков

# === Gateway (если используете telegram) ===
TELEGRAM_BOT_TOKEN=123456:ABC...  # токен Telegram-бота
```

---

## Команды CLI

| Команда | Описание |
|---------|----------|
| `nexo chat` | Интерактивный чат с агентом |
| `nexo tui` | TUI-интерфейс (терминальный UI) |
| `nexo cron` | Запуск планировщика задач (без Telegram) |
| `nexo gateway` | Шлюз: Telegram-бот + крон |
| `nexo rpc` | RPC-сервер для вызова инструментов |
| `nexo test-stream` | Проверка подключения к LLM |
| `nexo config` | Показать текущую конфигурацию |
| `nexo setup` | Мастер первичной настройки |

### Опции

```bash
nexo chat --model gpt-4o-mini    # выбрать модель
nexo chat --provider openrouter  # выбрать провайдер
```

---

## Конфигурация через файл

Создайте `nexo.config.yaml` (или `.json`) в корне проекта:

```yaml
model: gpt-4o
provider: openai
maxTokens: 4096
temperature: 0.7
maxIterations: 90
logLevel: info
```

Приоритет: **переменные окружения > конфигурационный файл > значения по умолчанию**.

---

## Cron (Планировщик задач)

### Запуск

```bash
npm start cron
```

### Создание задач

Через чат:
```
Создай cron задачу: "Сделай отчёт" каждые 2 часа
```

Через инструмент `cron_create`:
```json
{
  "name": "Daily report",
  "prompt": "Сформируй отчёт за сегодня",
  "schedule": "0 9 * * *"
}
```

### Форматы расписаний

| Формат | Пример | Описание |
|--------|--------|----------|
| Cron | `0 9 * * *` | Каждый день в 9:00 |
| Cron | `*/5 * * * *` | Каждые 5 минут |
| Интервал | `30m`, `2h`, `1d` | От текущего момента |
| Натуральный язык | `every monday 9am` | Понедельник в 9:00 |

### Управление задачами

| Инструмент | Описание |
|-----------|----------|
| `cron_create` | Создать задачу |
| `cron_list` | Список всех задач |
| `cron_pause` | Приостановить задачу |
| `cron_resume` | Возобновить задачу |
| `cron_delete` | Удалить задачу |

### Файлы данных

```
~/.nexo-agent/cron/
├── jobs.json              # все задачи
└── output/{job_id}/       # результаты выполнения
```

---

## Gateway (Шлюз)

Gateway объединяет Telegram-бота и планировщик в один процесс.

```bash
npm start gateway
```

Требуется `TELEGRAM_BOT_TOKEN` в `.env`.

### Создание Telegram-бота

1. Откройте `@BotFather` в Telegram
2. Отправьте `/newbot`
3. Скопируйте токен в `.env`

---

## Инструменты

| Тулсет | Инструменты | Описание |
|--------|-------------|----------|
| `file` | `file_read`, `file_write`, `file_edit` | Работа с файлами |
| `terminal` | `terminal_exec` | Выполнение команд ОС |
| `search` | `search_files`, `search_content` | Поиск файлов и текста |
| `kanban` | `kanban_create`, `kanban_list`, ... | Управление задачами |
| `cron` | `cron_create`, `cron_list`, ... | Планировщик |
| `skills` | `skill_list`, `skill_install`, ... | Навыки агента |

---

## Навыки (Skills)

Навыки — это специализированные инструкции для агента.

```bash
# Установка навыка
nexo chat
> Установи навык imagegen
```

Навыки хранятся в `~/.nexo-agent/skills/`.

---

## Решение проблем

### `TELEGRAM_BOT_TOKEN environment variable is required`

`.env` файл не загружается. Убедитесь что:
- Файл `.env` существует в корне проекта
- Содержит `TELEGRAM_BOT_TOKEN=...`
- Используйте `npm start` (не `npx tsx`) — `npm start` запускает собранную версию

### Cron не выполняет задачи

1. Проверьте статус: `cron_list` — статус должен быть `scheduled`
2. Если статус `running` — перезапустите `npm start cron`
3. Задача выполняется агентом через LLM — убедитесь что `OPENAI_API_KEY` настроен

### Агент не находит инструменты

Инструменты загружаются автоматически при запуске. Если не работают:
- Проверьте что `npm run build` выполнен
- Убедитесь что файлы `src/tools/*.ts` скомпилированы в `dist/tools/`

### Ошибки компиляции

```bash
npm run typecheck    # проверка типов
npm run lint         # проверка стиля
npm run build        # пересборка
```
