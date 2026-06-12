#!/usr/bin/env node

import chalk from "chalk";

const VERSION = "0.1.0";

function printBanner(): void {
  console.log();
  console.log(chalk.cyan.bold("  ╔═══════════════════════════════════════╗"));
  console.log(chalk.cyan.bold("  ║       ") + chalk.white.bold("nexo-agent") + chalk.cyan.bold(" v" + VERSION) + chalk.cyan.bold("        ║"));
  console.log(chalk.cyan.bold("  ║   Node.js AI Agent Framework         ║"));
  console.log(chalk.cyan.bold("  ╚═══════════════════════════════════════╝"));
  console.log();
}

function printUsage(): void {
  console.log(chalk.white("Usage:"));
  console.log("  nexo [command] [options]");
  console.log();
  console.log(chalk.white("Commands:"));
  console.log("  chat              Start interactive chat (default)");
  console.log("  config            Show current configuration");
  console.log("  version           Show version");
  console.log("  help              Show this help message");
  console.log();
  console.log(chalk.white("Options:"));
  console.log("  --model <model>   LLM model to use");
  console.log("  --provider <p>    Provider to use");
  console.log("  --verbose         Enable debug logging");
}

function printVersion(): void {
  console.log(`nexo-agent v${VERSION}`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const command = args[0] || "help";

  switch (command) {
    case "version":
    case "-v":
    case "--version":
      printVersion();
      break;

    case "help":
    case "-h":
    case "--help":
      printBanner();
      printUsage();
      break;

    case "chat":
      printBanner();
      console.log(chalk.gray("Chat mode — coming in Phase 3"));
      break;

    case "config":
      printBanner();
      const { getConfig } = await import("../core/config.js");
      const config = getConfig();
      console.log(chalk.white("Current configuration:"));
      console.log(JSON.stringify(config, null, 2));
      break;

    default:
      console.error(chalk.red(`Unknown command: ${command}`));
      printUsage();
      process.exit(1);
  }
}

main().catch((err) => {
  console.error(chalk.red("Fatal error:"), err);
  process.exit(1);
});
