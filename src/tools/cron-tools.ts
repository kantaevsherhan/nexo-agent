import { toolRegistry } from "./registry.js";
import { JobsStore } from "../cron/jobs-store.js";

let jobsStore: JobsStore | null = null;

function getJobsStore(): JobsStore {
  if (!jobsStore) {
    jobsStore = new JobsStore();
  }
  return jobsStore;
}

toolRegistry.register({
  name: "cron_create",
  toolset: "cron",
  schema: {
    type: "function",
    function: {
      name: "cron_create",
      description: "Create a scheduled cron job.",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Job name" },
          prompt: { type: "string", description: "Prompt to execute" },
          schedule: { type: "string", description: "Cron expression (e.g. '0 9 * * *') or interval (e.g. '30m', '2h')" },
        },
        required: ["name", "prompt", "schedule"],
      },
    },
  },
  handler: async (args) => {
    const store = getJobsStore();
    const job = store.createJob(args.name as string, args.prompt as string, args.schedule as string);
    return JSON.stringify({ success: true, job });
  },
});

toolRegistry.register({
  name: "cron_list",
  toolset: "cron",
  schema: {
    type: "function",
    function: {
      name: "cron_list",
      description: "List all scheduled cron jobs.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  handler: async () => {
    const store = getJobsStore();
    const jobs = store.listJobs();
    return JSON.stringify({ jobs, count: jobs.length });
  },
});

toolRegistry.register({
  name: "cron_delete",
  toolset: "cron",
  schema: {
    type: "function",
    function: {
      name: "cron_delete",
      description: "Delete a cron job.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Job ID" },
        },
        required: ["jobId"],
      },
    },
  },
  handler: async (args) => {
    const store = getJobsStore();
    const success = store.deleteJob(args.jobId as string);
    return JSON.stringify({ success });
  },
});

toolRegistry.register({
  name: "cron_pause",
  toolset: "cron",
  schema: {
    type: "function",
    function: {
      name: "cron_pause",
      description: "Pause a cron job.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Job ID" },
        },
        required: ["jobId"],
      },
    },
  },
  handler: async (args) => {
    const store = getJobsStore();
    const job = store.updateJob(args.jobId as string, { enabled: false, status: "paused" });
    return JSON.stringify({ success: !!job });
  },
});

toolRegistry.register({
  name: "cron_resume",
  toolset: "cron",
  schema: {
    type: "function",
    function: {
      name: "cron_resume",
      description: "Resume a paused cron job.",
      parameters: {
        type: "object",
        properties: {
          jobId: { type: "string", description: "Job ID" },
        },
        required: ["jobId"],
      },
    },
  },
  handler: async (args) => {
    const store = getJobsStore();
    const job = store.updateJob(args.jobId as string, { enabled: true, status: "scheduled" });
    return JSON.stringify({ success: !!job });
  },
});
