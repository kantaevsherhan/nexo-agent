import { render } from "ink";
import { App } from "./app.js";
import { Agent } from "../core/agent.js";

// Load tools
import "../tools/terminal.js";
import "../tools/file-tools.js";
import "../tools/search-tools.js";
import "../tools/skills-tool.js";
import "../tools/kanban-tools.js";
import "../tools/cron-tools.js";

export function startTUI(options: { model?: string; provider?: string } = {}): void {
  const agent = new Agent(options);
  const { waitUntilExit } = render(<App agent={agent} />);
  waitUntilExit().then(() => {
    agent.close();
    process.exit(0);
  });
}
