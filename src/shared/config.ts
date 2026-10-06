import { z } from "zod";

const configSchema = z.object({
  APP_ENV: z.enum(["local", "test", "production"]).default("local"),
  LOG_LEVEL: z.enum(["trace", "debug", "info", "warn", "error"]).default("info"),
  PORT: z.coerce.number().int().positive().default(3000),
  DATABASE_URL: z.string().url(),
  DISCORD_BOT_TOKEN: z.string().min(1),
  DISCORD_INPUT_CHANNEL_ID: z.string().regex(/^\d{17,20}$/),
  AI_PROVIDER: z.enum(["gemini", "ollama", "openai"]).default("gemini"),
  AI_MODEL: z.string().min(1),
  GEMINI_API_KEY: z.string().optional(),
});

export type AppConfig = {
  appEnv: "local" | "test" | "production";
  logLevel: "trace" | "debug" | "info" | "warn" | "error";
  port: number;
  databaseUrl: string;
  discordBotToken: string;
  discordInputChannelId: string;
  aiProvider: "gemini" | "ollama" | "openai";
  aiModel: string;
  geminiApiKey?: string;
};

export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const parsed = configSchema.parse(environment);

  // Gemini currently rejects this model for some new API users. Keep old
  // local .env files working while allowing future model changes via config.
  const aiModel = parsed.AI_MODEL === "gemini-2.5-flash-lite"
    ? "gemini-3.5-flash-lite"
    : parsed.AI_MODEL;

  if (aiModel !== parsed.AI_MODEL) {
    console.warn({ from: parsed.AI_MODEL, to: aiModel }, "Migrating deprecated Gemini model");
  }

  if (parsed.AI_PROVIDER === "gemini" && !parsed.GEMINI_API_KEY) {
    throw new Error("GEMINI_API_KEY is required when AI_PROVIDER=gemini.");
  }

  return {
    appEnv: parsed.APP_ENV,
    logLevel: parsed.LOG_LEVEL,
    port: parsed.PORT,
    databaseUrl: parsed.DATABASE_URL,
    discordBotToken: parsed.DISCORD_BOT_TOKEN,
    discordInputChannelId: parsed.DISCORD_INPUT_CHANNEL_ID,
    aiProvider: parsed.AI_PROVIDER,
    aiModel,
    geminiApiKey: parsed.GEMINI_API_KEY,
  };
}
