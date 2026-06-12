import { toolRegistry } from "./registry.js";
import { KanbanDB } from "../plans/kanban-db.js";

let kanbanDB: KanbanDB | null = null;

function getKanbanDB(): KanbanDB {
  if (!kanbanDB) {
    kanbanDB = new KanbanDB();
  }
  return kanbanDB;
}

toolRegistry.register({
  name: "kanban_create",
  toolset: "kanban",
  schema: {
    type: "function",
    function: {
      name: "kanban_create",
      description: "Create a new task on the Kanban board.",
      parameters: {
        type: "object",
        properties: {
          title: { type: "string", description: "Task title" },
          description: { type: "string", description: "Task description" },
          priority: { type: "string", enum: ["low", "medium", "high"], description: "Task priority" },
        },
        required: ["title"],
      },
    },
  },
  handler: async (args) => {
    const db = getKanbanDB();
    const task = db.createTask(args.title as string, (args.description as string) ?? "", {
      priority: (args.priority as string) ?? "medium",
    });
    return JSON.stringify({ success: true, task });
  },
});

toolRegistry.register({
  name: "kanban_list",
  toolset: "kanban",
  schema: {
    type: "function",
    function: {
      name: "kanban_list",
      description: "List tasks on the Kanban board.",
      parameters: {
        type: "object",
        properties: {
          status: { type: "string", enum: ["open", "in_progress", "blocked", "done", "abandoned"], description: "Filter by status" },
        },
      },
    },
  },
  handler: async (args) => {
    const db = getKanbanDB();
    const tasks = db.listTasks("default", args.status as any);
    return JSON.stringify({ tasks, count: tasks.length });
  },
});

toolRegistry.register({
  name: "kanban_complete",
  toolset: "kanban",
  schema: {
    type: "function",
    function: {
      name: "kanban_complete",
      description: "Mark a task as done.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Task ID" },
        },
        required: ["taskId"],
      },
    },
  },
  handler: async (args) => {
    const db = getKanbanDB();
    const success = db.completeTask(args.taskId as string);
    return JSON.stringify({ success });
  },
});

toolRegistry.register({
  name: "kanban_block",
  toolset: "kanban",
  schema: {
    type: "function",
    function: {
      name: "kanban_block",
      description: "Block a task.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Task ID" },
        },
        required: ["taskId"],
      },
    },
  },
  handler: async (args) => {
    const db = getKanbanDB();
    const success = db.blockTask(args.taskId as string);
    return JSON.stringify({ success });
  },
});

toolRegistry.register({
  name: "kanban_show",
  toolset: "kanban",
  schema: {
    type: "function",
    function: {
      name: "kanban_show",
      description: "Show details of a specific task.",
      parameters: {
        type: "object",
        properties: {
          taskId: { type: "string", description: "Task ID" },
        },
        required: ["taskId"],
      },
    },
  },
  handler: async (args) => {
    const db = getKanbanDB();
    const task = db.getTask(args.taskId as string);
    if (!task) return JSON.stringify({ error: "Task not found" });
    return JSON.stringify({ task });
  },
});
