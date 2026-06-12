import { toolRegistry } from "./registry.js";
import { loadAllSkills, loadSkill, createSkill, formatSkillForPrompt } from "../skills/index.js";

toolRegistry.register({
  name: "skills_list",
  toolset: "skills",
  schema: {
    type: "function",
    function: {
      name: "skills_list",
      description: "List all available skills.",
      parameters: {
        type: "object",
        properties: {},
      },
    },
  },
  handler: async () => {
    const skills = await loadAllSkills();
    return JSON.stringify({
      skills: skills.map((s) => ({
        name: s.name,
        description: s.description,
        version: s.version,
      })),
      count: skills.length,
    });
  },
});

toolRegistry.register({
  name: "skill_view",
  toolset: "skills",
  schema: {
    type: "function",
    function: {
      name: "skill_view",
      description: "View the content of a specific skill.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of the skill to view",
          },
        },
        required: ["name"],
      },
    },
  },
  handler: async (args) => {
    const name = args.name as string;
    const skill = await loadSkill(name);
    if (!skill) {
      return JSON.stringify({ error: `Skill not found: ${name}` });
    }
    return JSON.stringify({
      name: skill.name,
      description: skill.description,
      content: skill.content,
    });
  },
});

toolRegistry.register({
  name: "skill_create",
  toolset: "skills",
  schema: {
    type: "function",
    function: {
      name: "skill_create",
      description: "Create a new skill from task experience.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name for the new skill",
          },
          description: {
            type: "string",
            description: "Description of the skill",
          },
          content: {
            type: "string",
            description: "Markdown content for the skill",
          },
          tags: {
            type: "array",
            items: { type: "string" },
            description: "Tags for the skill",
          },
        },
        required: ["name", "description", "content"],
      },
    },
  },
  handler: async (args) => {
    const skill = await createSkill(
      args.name as string,
      args.description as string,
      args.content as string,
      { tags: args.tags as string[] | undefined }
    );
    return JSON.stringify({ success: true, skill: { name: skill.name, version: skill.version } });
  },
});

toolRegistry.register({
  name: "skill_apply",
  toolset: "skills",
  schema: {
    type: "function",
    function: {
      name: "skill_apply",
      description: "Load a skill and return its content for use in the current task.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Name of the skill to apply",
          },
        },
        required: ["name"],
      },
    },
  },
  handler: async (args) => {
    const name = args.name as string;
    const skill = await loadSkill(name);
    if (!skill) {
      return JSON.stringify({ error: `Skill not found: ${name}` });
    }
    return JSON.stringify({ applied: true, content: formatSkillForPrompt(skill) });
  },
});
