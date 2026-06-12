import { Cron } from "croner";
import { JobsStore, type CronJob } from "./jobs-store.js";
import { logger } from "../core/logger.js";

export type JobRunner = (job: CronJob) => Promise<void>;

export class CronScheduler {
  private store: JobsStore;
  private running = new Map<string, Cron>();
  private runner: JobRunner;

  constructor(runner: JobRunner) {
    this.store = new JobsStore();
    this.runner = runner;
  }

  start(): void {
    const jobs = this.store.getEnabledJobs();
    for (const job of jobs) {
      this.scheduleJob(job);
    }
    logger.info(`Scheduler started with ${jobs.length} jobs`);
  }

  stop(): void {
    for (const [id, cron] of this.running) {
      cron.stop();
      this.running.delete(id);
    }
    logger.info("Scheduler stopped");
  }

  private scheduleJob(job: CronJob): void {
    if (this.running.has(job.id)) {
      this.running.get(job.id)!.stop();
    }

    try {
      const cron = new Cron(job.schedule, async () => {
        if (job.status === "running") return;
        this.store.updateJob(job.id, { status: "running" });
        logger.info(`Running job: ${job.name} (${job.id})`);

        try {
          await this.runner(job);
          this.store.updateJob(job.id, {
            status: "scheduled",
            lastRun: new Date().toISOString(),
          });
          logger.info(`Job completed: ${job.name}`);
        } catch (err) {
          logger.error(`Job failed: ${job.name}`, err);
          this.store.updateJob(job.id, { status: "scheduled" });
        }
      });

      this.running.set(job.id, cron);
    } catch (err) {
      logger.error(`Invalid cron schedule for job ${job.name}: ${job.schedule}`, err);
    }
  }

  addJob(job: CronJob): void {
    if (job.enabled) {
      this.scheduleJob(job);
    }
  }

  removeJob(id: string): void {
    if (this.running.has(id)) {
      this.running.get(id)!.stop();
      this.running.delete(id);
    }
  }

  getStore(): JobsStore {
    return this.store;
  }
}
