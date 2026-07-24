import OpenAI from "openai";

// Lazy singleton — validated on first use, not at module load.
// This prevents the entire server from crashing if env vars are not yet set.
let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;
  if (!process.env.AI_INTEGRATIONS_OPENAI_BASE_URL) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_BASE_URL must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }
  if (!process.env.AI_INTEGRATIONS_OPENAI_API_KEY) {
    throw new Error(
      "AI_INTEGRATIONS_OPENAI_API_KEY must be set. Did you forget to provision the OpenAI AI integration?",
    );
  }
  _client = new OpenAI({
    apiKey: process.env.AI_INTEGRATIONS_OPENAI_API_KEY,
    baseURL: process.env.AI_INTEGRATIONS_OPENAI_BASE_URL,
  });
  return _client;
}

export const openai = new Proxy({} as OpenAI, {
  get(_target, prop) {
    return (getClient() as any)[prop];
  },
});
