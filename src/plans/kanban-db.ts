import Database from "better-sqlite3";
import { randomUUID } from "crypto";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { NEXO_HOME } from "../core/config.js";

export type TaskStatus = "open" | "in_progress" | "blocked" | "done" | "abandoned";

export interface KanbanTask {
  id: string;
  title: string;
  description: string;
  status: TaskStatus;
  assignee: string;
  board: string;
  priority: string;
  blockedBy: string[];
  createdAt: number;
  updatedAt: number;
}

export class KanbanDB {
  private db: Database.Database;

  constructor(boardName: string = "default") {
    const dir = join(NEXO_HOME, "kanban");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    const dbPath = join(dir, `${boardName}.db`);
    this.db = new Database(dbPath);
    this.db.pragma("journal_mode = WAL");
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS tasks (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        status TEXT NOT NULL DEFAULT 'open',
        assignee TEXT NOT NULL DEFAULT '',
        board TEXT NOT NULL DEFAULT 'default',
        priority TEXT NOT NULL DEFAULT 'medium',
        blocked_by TEXT NOT NULL DEFAULT '[]',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );
      CREATE INDEX IF NOT EXISTS idx_tasks_status ON tasks(status);
      CREATE INDEX IF NOT EXISTS idx_tasks_board ON tasks(board);
    `);
  }

  createTask(title: string, description: string = "", options: Partial<Omit<KanbanTask, "id" | "createdAt" | "updatedAt">> = {}): KanbanTask {
    const id = randomUUID();
    const now = Math.floor(Date.now() / 1000);
    this.db.prepare(
      "INSERT INTO tasks (id, title, description, status, assignee, board, priority, blocked_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(
      id,
      title,
      description,
      options.status ?? "open",
      options.assignee ?? "",
      options.board ?? "default",
      options.priority ?? "medium",
      JSON.stringify(options.blockedBy ?? []),
      now,
      now
    );
    return this.getTask(id)!;
  }

  getTask(id: string): KanbanTask | undefined {
    const row = this.db.prepare("SELECT * FROM tasks WHERE id = ?").get(id) as any;
    if (!row) return undefined;
    return this.rowToTask(row);
  }

  claimTask(taskId: string, assignee: string): boolean {
    const result = this.db.prepare(
      "UPDATE tasks SET status = 'in_progress', assignee = ?, updated_at = unixepoch() WHERE id = ? AND status = 'open'"
    ).run(assignee, taskId);
    return result.changes > 0;
  }

  completeTask(taskId: string): boolean {
    const result = this.db.prepare(
      "UPDATE tasks SET status = 'done', updated_at = unixepoch() WHERE id = ? AND status = 'in_progress'"
    ).run(taskId);
    return result.changes > 0;
  }

  blockTask(taskId: string): boolean {
    const result = this.db.prepare(
      "UPDATE tasks SET status = 'blocked', updated_at = unixepoch() WHERE id = ? AND status IN ('open', 'in_progress')"
    ).run(taskId);
    return result.changes > 0;
  }

  unblockTask(taskId: string): boolean {
    const result = this.db.prepare(
      "UPDATE tasks SET status = 'open', updated_at = unixepoch() WHERE id = ? AND status = 'blocked'"
    ).run(taskId);
    return result.changes > 0;
  }

  abandonTask(taskId: string): boolean {
    const result = this.db.prepare(
      "UPDATE tasks SET status = 'abandoned', updated_at = unixepoch() WHERE id = ?"
    ).run(taskId);
    return result.changes > 0;
  }

  listTasks(board: string = "default", status?: TaskStatus): KanbanTask[] {
    let query = "SELECT * FROM tasks WHERE board = ?";
    const params: unknown[] = [board];
    if (status) {
      query += " AND status = ?";
      params.push(status);
    }
    query += " ORDER BY created_at ASC";
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.rowToTask(r));
  }

  private rowToTask(row: any): KanbanTask {
    return {
      id: row.id,
      title: row.title,
      description: row.description,
      status: row.status,
      assignee: row.assignee,
      board: row.board,
      priority: row.priority,
      blockedBy: JSON.parse(row.blocked_by),
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  close(): void {
    this.db.close();
  }
}
