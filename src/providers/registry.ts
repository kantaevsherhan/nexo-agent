import type { ProviderProfile } from "./types.js";

const BUILTIN_PROVIDERS: ProviderProfile[] = [
  {
    name: "openai",
    apiMode: "chat_completions",
    baseUrl: "https://api.openai.com/v1",
    envVars: ["OPENAI_API_KEY"],
    authType: "api_key",
    supportsVision: true,
    fixedTemperature: null,
    defaultMaxTokens: null,
    defaultHeaders: {},
  },
  {
    name: "openrouter",
    apiMode: "chat_completions",
    baseUrl: "https://openrouter.ai/api/v1",
    envVars: ["OPENROUTER_API_KEY"],
    authType: "api_key",
    supportsVision: true,
    fixedTemperature: null,
    defaultMaxTokens: null,
    defaultHeaders: {},
  },
  {
    name: "anthropic",
    apiMode: "chat_completions",
    baseUrl: "https://api.anthropic.com/v1",
    envVars: ["ANTHROPIC_API_KEY"],
    authType: "api_key",
    supportsVision: true,
    fixedTemperature: null,
    defaultMaxTokens: null,
    defaultHeaders: {},
  },
];

const providerRegistry = new Map<string, ProviderProfile>();

for (const profile of BUILTIN_PROVIDERS) {
  providerRegistry.set(profile.name, profile);
}

export function registerProvider(profile: ProviderProfile): void {
  providerRegistry.set(profile.name, profile);
}

export function getProviderProfile(name: string): ProviderProfile | undefined {
  return providerRegistry.get(name);
}

export function listProviders(): ProviderProfile[] {
  return Array.from(providerRegistry.values());
}

export function resolveApiKey(profile: ProviderProfile): string | undefined {
  for (const envVar of profile.envVars) {
    const key = process.env[envVar];
    if (key) return key;
  }
  return undefined;
}
