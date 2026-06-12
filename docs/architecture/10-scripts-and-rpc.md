# 10 — Скрипты, RPC и окружения

## Введение

Hermes Agent выполняет скрипты и команды через систему терминальных бэкендов:
local, Docker, SSH, Modal, Singularity, Daytona. Каждый бэкенд реализует
выполнение команд в изолированном окружении.

---

## Как это работает

### Архитектура терминальных бэкендов

```
┌─────────────────────────────────────────┐
│           terminal tool                 │
│      tools/terminal_tool.py             │
│                                         │
│  resolve_backend() → TerminalBackend    │
└──────────────────┬──────────────────────┘
                   │
    ┌──────────────┼──────────────────────────┐
    │              │              │           │
┌───▼──────┐ ┌────▼─────┐ ┌─────▼─────┐ ┌───▼──────┐
│  Local   │ │  Docker  │ │   SSH     │ │  Modal   │
│          │ │          │ │           │ │          │
│subprocess│ │dockerode │ │ paramiko  │ │ modal SDK│
│ptyprocess│ │          │ │ ssh2      │ │          │
└──────────┘ └──────────┘ └───────────┘ └──────────┘
```

### Бэкенды

| Бэкенд | Реализация | Описание |
|--------|-----------|----------|
| `local` | `subprocess` / `ptyprocess` | Выполнение на хосте |
| `docker` | Docker SDK | Контейнерная изоляция |
| `ssh` | `paramiko` / `ssh2` | Удалённое выполнение |
| `modal` | `modal` SDK | Cloud sandbox |
| `singularity` | Singularity CLI | HPC-контейнеры |
| `daytona` | `daytona` SDK | Cloud dev environments |

### Terminal tool — основной интерфейс

```python
# tools/terminal_tool.py
registry.register(
    name="terminal",
    toolset="terminal",
    schema={...},
    handler=terminal_tool,
    check_fn=check_terminal_requirements,
)
```

### Delegate tool — подагенты

`tools/delegate_tool.py`:
- Создаёт дочерний `AIAgent` с изолированным контекстом
- Ограниченный тулсет (нет `delegate_task`, `clarify`, `memory`, `send_message`)
- Синхронный: родитель ждёт завершения ребёнка
- Батч-режим: `tasks: [...]` → параллельные подагенты
- `ThreadPoolExecutor` с auto-approve/deny callbacks

### Programmatic tool calling (execute_code)

`tools/code_execution_tool.py` — агент пишет и выполняет код:
- Python sandbox через `exec()`
- Итерации: execute_code возвращает итерации обратно (refund)
- Ограничения: sandbox-allowed tools

---

## Реализация в коде

| Файл | Роль |
|------|------|
| `tools/terminal_tool.py` | Terminal tool — выполнение команд |
| `tools/delegate_tool.py` | Delegate tool — подагенты |
| `tools/code_execution_tool.py` | Execute code — программное выполнение |
| `tools/environments/` | Бэкенды: local, docker, ssh, modal, singularity, daytona |
| `tools/process_registry.py` | Отслеживание фоновых процессов |
| `tools/approval.py` | Одобрение опасных команд |

---

## Используемые библиотеки (Python)

| Библиотека | Что делает | Как применена | Зачем нужна |
|-----------|-----------|---------------|-------------|
| `subprocess` | Запуск процессов | Local backend | Выполнение shell-команд |
| `ptyprocess` | PTY (POSIX) | Интерактивные команды | Эмуляция терминала |
| `pywinpty` | PTY (Windows) | Windows PTY | Кросс-платформенность |
| `psutil` | Процессы | Отслеживание PID | Проверка живых процессов |
| `docker` (SDK) | Docker API | Docker backend | Контейнерная изоляция |
| `paramiko` | SSH | SSH backend | Удалённое выполнение |
| `modal` (opt-in) | Modal SDK | Cloud sandbox | Cloud изоляция |

---

## Перенос на Node.js

### Архитектура

```typescript
// Terminal tool на Node.js
import { spawn } from 'child_process';
import * as pty from 'node-pty';

async function terminalTool(command: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const proc = spawn('bash', ['-c', command], { stdio: 'pipe' });
    let stdout = '';
    proc.stdout.on('data', (data) => stdout += data.toString());
    proc.stderr.on('data', (data) => stdout += data.toString());
    proc.on('close', (code) => resolve(stdout));
    proc.on('error', reject);
  });
}

// Docker
import Docker from 'dockerode';
const docker = new Docker();
const container = await docker.createContainer({ Image: 'ubuntu', Cmd: ['ls'] });

// SSH
import { Client } from 'ssh2';
const ssh = new Client();
ssh.connect({ host, username, password });
```

### npm-библиотеки

| Python | npm | Что делает | Как применить | Зачем |
|--------|-----|-----------|---------------|-------|
| `subprocess` | `child_process` | Запуск процессов | `spawn()` / `exec()` | Shell-команды |
| `ptyprocess` | `node-pty` | PTY | `pty.spawn()` | Интерактивные команды |
| `psutil` | `process` / `tree-kill` | Процессы | `process.kill()` | Kill processes |
| `docker` | `dockerode` | Docker | `new Docker()` | Контейнеры |
| `paramiko` | `ssh2` | SSH | `new Client()` | Удалённое выполнение |
| `modal` | `modal` (Python) | Cloud | HTTP API | Cloud sandbox |

### Подводные камни переноса

1. **node-pty**: Нативный C++ addon. Требует `node-gyp` и build tools.
   Работает на Linux/macOS/Windows. Analog PTY на Windows через ConPTY.

2. **child_process**: `spawn()` для long-running, `exec()` для short commands.
   `execSync()` для синхронных операций.

3. **Docker**: `dockerode` — полный Docker SDK для Node.js. Docker API через
   Unix socket или TCP.

4. **SSH**: `ssh2` — зрелый SSH-клиент. Поддерживает ключи, пароли, tunnels.

---

## Кросс-ссылки

- [03 — Инструменты и тулсеты](./03-tools-and-toolsets.md)
- [01 — Общая архитектура](./01-architecture.md)
