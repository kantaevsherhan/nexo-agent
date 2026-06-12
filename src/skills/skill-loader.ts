import { readFile, readdir, writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import { join } from "path";
import matter from "gray-matter";
import { NEXO_HOME } from "../core/config.js";

export interface Skill {
  name: string;
  description: string;
  version: string;
  author: string;
  content: string;
  metadata: Record<string, unknown>;
}

export interface SkillFrontmatter {
  name?: string;
  description?: string;
  version?: string;
  author?: string;
  platforms?: string[];
  metadata?: {
    hermes?: {
      tags?: string[];
      category?: string;
      config?: string[];
    };
  };
}

function getSkillsDirs(): string[] {
  const dirs: string[] = [];
  const userSkillsDir = join(NEXO_HOME, "skills");
  if (existsSync(userSkillsDir)) dirs.push(userSkillsDir);
  const localSkillsDir = join(process.cwd(), "skills");
  if (existsSync(localSkillsDir)) dirs.push(localSkillsDir);
  return dirs;
}

async function loadSkillFromDir(skillDir: string): Promise<Skill | null> {
  const skillPath = join(skillDir, "SKILL.md");
  try {
    const raw = await readFile(skillPath, "utf-8");
    const { data, content } = matter(raw);
    const fm = data as SkillFrontmatter;
    return {
      name: fm.name ?? skillDir.split("/").pop() ?? "unknown",
      description: fm.description ?? "",
      version: fm.version ?? "1.0.0",
      author: fm.author ?? "",
      content,
      metadata: fm.metadata ?? {},
    };
  } catch {
    return null;
  }
}

export async function loadAllSkills(): Promise<Skill[]> {
  const skills: Skill[] = [];
  const dirs = getSkillsDirs();

  for (const dir of dirs) {
    try {
      const entries = await readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skill = await loadSkillFromDir(join(dir, entry.name));
        if (skill) skills.push(skill);
      }
    } catch {
      // Skip inaccessible dirs
    }
  }

  return skills;
}

export async function loadSkill(name: string): Promise<Skill | null> {
  const dirs = getSkillsDirs();
  for (const dir of dirs) {
    const skill = await loadSkillFromDir(join(dir, name));
    if (skill) return skill;
  }
  return null;
}

export async function createSkill(
  name: string,
  description: string,
  content: string,
  options: { author?: string; tags?: string[] } = {}
): Promise<Skill> {
  const skillsDir = join(NEXO_HOME, "skills", name);
  if (!existsSync(skillsDir)) {
    await mkdir(skillsDir, { recursive: true });
  }

  const frontmatter: SkillFrontmatter = {
    name,
    description,
    version: "1.0.0",
    author: options.author ?? "",
    metadata: {
      hermes: {
        tags: options.tags ?? [],
        category: name,
      },
    },
  };

  const raw = matter.stringify(content, frontmatter);
  await writeFile(join(skillsDir, "SKILL.md"), raw, "utf-8");

  return {
    name,
    description,
    version: "1.0.0",
    author: options.author ?? "",
    content,
    metadata: frontmatter.metadata ?? {},
  };
}

export function formatSkillForPrompt(skill: Skill): string {
  return `[Skill: ${skill.name}]\n${skill.content}`;
}
