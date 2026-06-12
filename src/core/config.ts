import { z } from "zod";
import { readFileSync, existsSync } from "fs";
import { join } from "path";
import { config as dotenvConfig } from "dotenv";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

const ConfigSchema = z.object({
  model: z.string().default("gpt-4o"),
  provider: z.string().default("openai"),
  baseUrl: z.string().optional(),
  apiKey: z.string().optional(),
  maxTokens: z.number().default(4096),
  temperature: z.number().min(0).max(2).default(0.7),
  maxIterations: z.number().default(90),
  workdir: z.string().optional(),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  sessionDir: z.string().optional(),
  skillsDir: z.string().optional(),
});

export type AppConfig = z.infer<typeof ConfigSchema>;

const HOME_DIR = process.env.HOME || process.env.USERPROFILE || ".";
const NEXO_HOME = process.env.NEXO_HOME || join(HOME_DIR, ".nexo-agent");

function loadEnvFile(): void {
  const envPath = join(NEXO_HOME, ".env");
  if (existsSync(envPath)) {
    dotenvConfig({ path: envPath });
  }
  const localEnv = join(process.cwd(), ".env");
  if (existsSync(localEnv)) {
    dotenvConfig({ path: localEnv });
  }
}

function loadConfigFile(): Partial<AppConfig> {
  const configPaths = [
    join(process.cwd(), "nexo.config.yaml"),
    join(process.cwd(), "nexo.config.yml"),
    join(process.cwd(), "nexo.config.json"),
  ];

  for (const configPath of configPaths) {
    if (!existsSync(configPath)) continue;
    const raw = readFileSync(configPath, "utf-8");
    if (configPath.endsWith(".json")) {
      return JSON.parse(raw) as Partial<AppConfig>;
    }
    // YAML
    try {
      const yaml = require("yaml") as typeof import("yaml");
      return yaml.parse(raw) as Partial<AppConfig>;
    } catch {
      const jsYaml = require("js-yaml") as typeof import("js-yaml");
      return jsYaml.load(raw) as Partial<AppConfig>;
    }
  }
  return {};
}

function loadConfigFromEnv(): Partial<AppConfig> {
  return {
    model: process.env.NEXO_MODEL,
    provider: process.env.NEXO_PROVIDER,
    baseUrl: process.env.NEXO_BASE_URL,
    apiKey: process.env.NEXO_API_KEY || process.env.OPENAI_API_KEY,
    maxTokens: process.env.NEXO_MAX_TOKENS ? parseInt(process.env.NEXO_MAX_TOKENS) : undefined,
    temperature: process.env.NEXO_TEMPERATURE ? parseFloat(process.env.NEXO_TEMPERATURE) : undefined,
    maxIterations: process.env.NEXO_MAX_ITERATIONS ? parseInt(process.env.NEXO_MAX_ITERATIONS) : undefined,
    workdir: process.env.NEXO_WORKDIR,
    logLevel: process.env.NEXO_LOG_LEVEL as AppConfig["logLevel"],
    sessionDir: process.env.NEXO_SESSION_DIR,
    skillsDir: process.env.NEXO_SKILLS_DIR,
  };
}

let _config: AppConfig | null = null;

export function getConfig(): AppConfig {
  if (_config) return _config;
  loadEnvFile();
  const fileConfig = loadConfigFile();
  const envConfig = loadConfigFromEnv();
  _config = ConfigSchema.parse({ ...fileConfig, ...envConfig });
  return _config;
}

export function resetConfig(): void {
  _config = null;
}

export { NEXO_HOME };
