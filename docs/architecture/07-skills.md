# 07 — Навыки (Skills)

## Введение

Skills — это процедурная память агента. Каждый навык — это Markdown-файл
(`SKILL.md`) с инструкциями, который агент загружает при выполнении задач.
Навыки создаются из опыта, применяются в новых задачах и управляются через
-curator.

---

## Как это работает

### Архитектура навыков

```
┌──────────────────────────────────────────┐
│  ~/.hermes/skills/                       │
│  ├── github/                             │
│  │   └── SKILL.md                       │
│  ├── mlops/                              │
│  │   └── SKILL.md                       │
│  ├── software-development/               │
│  │   └── SKILL.md                       │
│  └── .archive/                           │
│      └── archived-skill/                 │
└──────────────────┬───────────────────────┘
                   │
         ┌─────────┴─────────┐
         │                   │
    ┌────▼──────┐     ┌──────▼──────┐
    │ Built-in  │     │ User-created│
    │ skills/   │     │ ~/.hermes/  │
    │ (repo)    │     │ skills/     │
    └───────────┘     └─────────────┘
```

### Формат SKILL.md

```markdown
---
name: github-auth
description: GitHub authentication and API usage patterns.
version: 1.0.0
author: John Doe (@johndoe)
license: MIT
platforms: [linux, macos, windows]
metadata:
  hermes:
    tags: [github, auth, api]
    category: github
    config:
      - GITHUB_TOKEN
---

# GitHub Authentication Skill

## When to Use
Use this skill when the user needs to authenticate with GitHub.

## Prerequisites
- GITHUB_TOKEN environment variable

## How to Run
...
```

### Загрузка навыков

1. Агент получает задачу
2. `agent/skill_commands.py` сканирует `~/.hermes/skills/`
3. Релевантные навыки загружаются как **user message** (не system prompt)
4. Содержимое SKILL.md инжектируется в контекст

### Curator — самообучение

Curator (`agent/curator.py`) — фоновая система жизненного цикла:
- Отслеживает использование навыков (use_count, view_count, patch_count)
- Auto-archives неиспользуемые навыки (`stale_after_days`, `archive_after_days`)
- LLM review для оценки качества
- Пользовательские навыки НЕ удаляются (только archive)
- Pinned навыки защищены от всех переходов

### Skills Hub

`tools/skills_hub.py` — интеграция с GitHub App для загрузки/публикации навыков.

---

## Реализация в коде

| Файл | Роль |
|------|------|
| `agent/skill_commands.py` | Загрузка и инъекция навыков в контекст |
| `agent/skill_utils.py` | Утилиты для работы с навыками |
| `agent/skill_preprocessing.py` | Предобработка SKILL.md |
| `agent/skill_bundles.py` | Группировка навыков |
| `agent/curator.py` | Lifecycle management навыков |
| `agent/curator_backup.py` | Бэкапы перед archive |
| `tools/skills_tool.py` | Инструмент skills_list, skill_view, skill_manage |
| `tools/skills_hub.py` | Hub integration |
| `tools/skill_provenance.py` | Отслеживание происхождения |
| `tools/skill_usage.py` | Статистика использования (.usage.json) |
| `skills/` | Встроенные навыки (19 категорий) |
| `optional-skills/` | Тяжёлые навыки (не активны по умолчанию) |

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `pathlib` | Файловые пути | Сканирование skills/ | Работа с ФС |
| `yaml` | YAML frontmatter | Парсинг метаданных SKILL.md | Извлечение frontmatter |
| `re` | Регулярные выражения | Парсинг SKILL.md | Поиск секций |

---

## Перенос на Node.js

### Архитектура

```typescript
// Загрузка навыков на Node.js
import matter from 'gray-matter';
import { readFile, readdir } from 'fs/promises';
import { join } from 'path';

interface Skill {
  name: string;
  description: string;
  content: string;  // SKILL.md body
  metadata: Record<string, any>;
}

async function loadSkills(skillsDir: string): Promise<Skill[]> {
  const skills: Skill[] = [];
  for (const entry of await readdir(skillsDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const skillPath = join(skillsDir, entry.name, 'SKILL.md');
    try {
      const raw = await readFile(skillPath, 'utf-8');
      const { data, content } = matter(raw);
      skills.push({ name: data.name, description: data.description, content, metadata: data });
    } catch {}
  }
  return skills;
}
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `yaml` (frontmatter) | `gray-matter` | YAML frontmatter | `matter(rawContent)` | Парсинг SKILL.md |
| `pathlib` | `node:path` | Пути | `join(dir, name, 'SKILL.md')` | Работа с ФС |
| `re` | `regexp` | Regex | `/^##\s+/gm` | Поиск секций |
| `json` | `fs/promises` | Хранение | `.usage.json` | Статистика |

### Подводные камни переноса

1. **gray-matter**: Стандартный npm-парсер для YAML frontmatter. Работает с
   любым Markdown-файлом.

2. **Curator**: LLM-based review можно реализовать через те же LLM API вызовы.

3. **File system**: Навыки хранятся на ФС (как в Python). `fs/promises` для
   асинхронного чтения.

---

## Кросс-ссылки

- [01 — Общая архитектура](./01-architecture.md)
- [08 — Память](./08-memory.md)
- [03 — Инструменты и тулсеты](./03-tools-and-toolsets.md)
