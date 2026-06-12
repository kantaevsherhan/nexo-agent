import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";
import { randomUUID } from "crypto";
import { NEXO_HOME } from "../core/config.js";

export type JobStatus = "scheduled" | "paused" | "running";

export interface CronJob {
  id: string;
  name: string;
  prompt: string;
  schedule: string;
  enabled: boolean;
  status: JobStatus;
  model?: string;
  provider?: string;
  workdir?: string;
  nextRun?: string;
  lastRun?: string;
  createdAt: number;
  updatedAt: number;
}

export class JobsStore {
  private jobs: Map<string, CronJob> = new Map();
  private filePath: string;

  constructor() {
    const dir = join(NEXO_HOME, "cron");
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    this.filePath = join(dir, "jobs.json");
    this.load();
  }

  private load(): void {
    if (!existsSync(this.filePath)) return;
    try {
      const data = JSON.parse(readFileSync(this.filePath, "utf-8")) as CronJob[];
      for (const job of data) {
        if (job.status === "running") {
          job.status = "scheduled";
        }
        this.jobs.set(job.id, job);
      }
    } catch {
      // Invalid file, start fresh
    }
  }

  private save(): void {
    const data = Array.from(this.jobs.values());
    writeFileSync(this.filePath, JSON.stringify(data, null, 2), "utf-8");
  }

  createJob(name: string, prompt: string, schedule: string, options: Partial<Omit<CronJob, "id" | "createdAt" | "updatedAt">> = {}): CronJob {
    const id = randomUUID();
    const now = Date.now();
    const job: CronJob = {
      id,
      name,
      prompt,
      schedule,
      enabled: options.enabled ?? true,
      status: "scheduled",
      model: options.model,
      provider: options.provider,
      workdir: options.workdir,
      createdAt: now,
      updatedAt: now,
    };
    this.jobs.set(id, job);
    this.save();
    return job;
  }

  getJob(id: string): CronJob | undefined {
    return this.jobs.get(id);
  }

  updateJob(id: string, updates: Partial<CronJob>): CronJob | undefined {
    const job = this.jobs.get(id);
    if (!job) return undefined;
    Object.assign(job, updates, { updatedAt: Date.now() });
    this.save();
    return job;
  }

  deleteJob(id: string): boolean {
    const deleted = this.jobs.delete(id);
    if (deleted) this.save();
    return deleted;
  }

  listJobs(): CronJob[] {
    return Array.from(this.jobs.values());
  }

  getEnabledJobs(): CronJob[] {
    return this.listJobs().filter((j) => j.enabled && j.status === "scheduled");
  }
}
