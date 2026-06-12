import chalk from "chalk";
import { getConfig } from "./config.js";

export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

const LEVEL_MAP: Record<string, LogLevel> = {
  debug: LogLevel.DEBUG,
  info: LogLevel.INFO,
  warn: LogLevel.WARN,
  error: LogLevel.ERROR,
};

function getLevel(): LogLevel {
  const level = getConfig().logLevel;
  return LEVEL_MAP[level] ?? LogLevel.INFO;
}

function formatTimestamp(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

export const logger = {
  debug(message: string, ...args: unknown[]): void {
    if (getLevel() <= LogLevel.DEBUG) {
      console.debug(chalk.gray(`[${formatTimestamp()}] DEBUG`), message, ...args);
    }
  },

  info(message: string, ...args: unknown[]): void {
    if (getLevel() <= LogLevel.INFO) {
      console.log(chalk.cyan(`[${formatTimestamp()}] INFO`), message, ...args);
    }
  },

  warn(message: string, ...args: unknown[]): void {
    if (getLevel() <= LogLevel.WARN) {
      console.warn(chalk.yellow(`[${formatTimestamp()}] WARN`), message, ...args);
    }
  },

  error(message: string, ...args: unknown[]): void {
    if (getLevel() <= LogLevel.ERROR) {
      console.error(chalk.red(`[${formatTimestamp()}] ERROR`), message, ...args);
    }
  },

  success(message: string, ...args: unknown[]): void {
    console.log(chalk.green(`[${formatTimestamp()}] OK`), message, ...args);
  },
};
