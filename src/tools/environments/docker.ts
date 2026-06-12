import { exec } from "child_process";
import { promisify } from "util";

const execAsync = promisify(exec);

export interface DockerBackendOptions {
  image?: string;
  workdir?: string;
  timeout?: number;
}

export class DockerBackend {
  private image: string;
  private workdir: string;
  private timeout: number;

  constructor(options: DockerBackendOptions = {}) {
    this.image = options.image ?? "node:20-slim";
    this.workdir = options.workdir ?? "/workspace";
    this.timeout = options.timeout ?? 30000;
  }

  async execCommand(command: string): Promise<{ stdout: string; stderr: string }> {
    const dockerCmd = [
      "docker", "run", "--rm",
      "-v", `${process.cwd()}:${this.workdir}`,
      "-w", this.workdir,
      this.image,
      "sh", "-c", command,
    ].join(" ");

    try {
      const { stdout, stderr } = await execAsync(dockerCmd, {
        maxBuffer: 1024 * 1024,
        timeout: this.timeout,
      });
      return { stdout: stdout.trim(), stderr: stderr.trim() };
    } catch (err) {
      const error = err as { stdout?: string; stderr?: string; message?: string };
      return {
        stdout: error.stdout ?? "",
        stderr: error.stderr ?? error.message ?? "Docker execution failed",
      };
    }
  }

  async isAvailable(): Promise<boolean> {
    try {
      await execAsync("docker info", { timeout: 5000 });
      return true;
    } catch {
      return false;
    }
  }
}
