import Database from "better-sqlite3";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { NEXO_HOME } from "../core/config.js";

export interface Session {
  id: string;
  source: string;
  model: string;
  createdAt: number;
  updatedAt: number;
}

export interface Message {
  id: number;
  sessionId: string;
  role: string;
  content: string;
  toolCalls?: string;
  toolCallId?: string;
  createdAt: number;
}

export class SessionDB {
  private db: Database.Database;

  constructor(dbPath?: string) {
    const dir = dbPath ? join(dbPath, "..") : join(NEXO_HOME, "sessions");
    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true });
    }
    const path = dbPath ?? join(NEXO_HOME, "sessions", "state.db");
    this.db = new Database(path);
    this.db.pragma("journal_mode = WAL");
    this.db.pragma("foreign_keys = ON");
    this.init();
  }

  private init(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        source TEXT NOT NULL DEFAULT 'cli',
        model TEXT NOT NULL DEFAULT '',
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        updated_at INTEGER NOT NULL DEFAULT (unixepoch())
      );

      CREATE TABLE IF NOT EXISTS messages (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL,
        content TEXT NOT NULL DEFAULT '',
        tool_calls TEXT,
        tool_call_id TEXT,
        created_at INTEGER NOT NULL DEFAULT (unixepoch()),
        FOREIGN KEY (session_id) REFERENCES sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
    `);

    // Try to create FTS5 table
    try {
      this.db.exec(`
        CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
          session_id, role, content,
          tokenize='porter unicode61'
        );
      `);
    } catch {
      // FTS5 might already exist or not be available
    }
  }

  createSession(id: string, source: string = "cli", model: string = ""): Session {
    const stmt = this.db.prepare(
      "INSERT INTO sessions (id, source, model) VALUES (?, ?, ?)"
    );
    stmt.run(id, source, model);
    return { id, source, model, createdAt: Date.now(), updatedAt: Date.now() };
  }

  getSession(id: string): Session | undefined {
    const row = this.db.prepare("SELECT * FROM sessions WHERE id = ?").get(id) as
      | { id: string; source: string; model: string; created_at: number; updated_at: number }
      | undefined;
    if (!row) return undefined;
    return {
      id: row.id,
      source: row.source,
      model: row.model,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  addMessage(sessionId: string, role: string, content: string, toolCalls?: string, toolCallId?: string): number {
    const stmt = this.db.prepare(
      "INSERT INTO messages (session_id, role, content, tool_calls, tool_call_id) VALUES (?, ?, ?, ?, ?)"
    );
    const result = stmt.run(sessionId, role, content, toolCalls ?? null, toolCallId ?? null);

    // Update FTS
    try {
      const ftsStmt = this.db.prepare(
        "INSERT INTO messages_fts (session_id, role, content) VALUES (?, ?, ?)"
      );
      ftsStmt.run(sessionId, role, content);
    } catch {
      // FTS might not be available
    }

    // Update session timestamp
    this.db.prepare("UPDATE sessions SET updated_at = unixepoch() WHERE id = ?").run(sessionId);

    return Number(result.lastInsertRowid);
  }

  getMessages(sessionId: string): Message[] {
    const rows = this.db.prepare(
      "SELECT * FROM messages WHERE session_id = ? ORDER BY created_at ASC"
    ).all(sessionId) as Array<{
      id: number;
      session_id: string;
      role: string;
      content: string;
      tool_calls: string | null;
      tool_call_id: string | null;
      created_at: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      sessionId: r.session_id,
      role: r.role,
      content: r.content,
      toolCalls: r.tool_calls ?? undefined,
      toolCallId: r.tool_call_id ?? undefined,
      createdAt: r.created_at,
    }));
  }

  search(query: string, limit: number = 20): Array<{ sessionId: string; role: string; content: string }> {
    try {
      const rows = this.db.prepare(
        "SELECT session_id, role, content FROM messages_fts WHERE messages_fts MATCH ? LIMIT ?"
      ).all(query, limit) as Array<{ session_id: string; role: string; content: string }>;
      return rows.map((r) => ({
        sessionId: r.session_id,
        role: r.role,
        content: r.content,
      }));
    } catch {
      return [];
    }
  }

  listSessions(limit: number = 50): Session[] {
    const rows = this.db.prepare(
      "SELECT * FROM sessions ORDER BY updated_at DESC LIMIT ?"
    ).all(limit) as Array<{
      id: string;
      source: string;
      model: string;
      created_at: number;
      updated_at: number;
    }>;

    return rows.map((r) => ({
      id: r.id,
      source: r.source,
      model: r.model,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    }));
  }

  deleteSession(id: string): void {
    this.db.prepare("DELETE FROM messages WHERE session_id = ?").run(id);
    this.db.prepare("DELETE FROM sessions WHERE id = ?").run(id);
    try {
      this.db.prepare("DELETE FROM messages_fts WHERE session_id = ?").run(id);
    } catch {
      // FTS cleanup
    }
  }

  close(): void {
    this.db.close();
  }
}
