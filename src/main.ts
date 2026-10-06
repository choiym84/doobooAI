import "dotenv/config";

import { GeminiScheduleInterpreter } from "./ai/gemini-schedule-interpreter.js";
import { createDiscordClient } from "./discord/client.js";
import { loadConfig } from "./shared/config.js";
import { OpenMeteoWeatherService } from "./weather/open-meteo-weather-service.js";

const config = loadConfig(process.env);

// Discord, database, and AI adapters are deliberately composed here rather
// than calling each other directly. This keeps local and deployed execution
// identical: only environment variables and the database endpoint change.
console.info({
  environment: config.appEnv,
  aiProvider: config.aiProvider,
  aiModel: config.aiModel,
}, "Discord AI assistant bootstrap complete");

const interpreter = new GeminiScheduleInterpreter(config.aiModel, config.geminiApiKey!);
const weatherService = new OpenMeteoWeatherService();
const discordClient = createDiscordClient(
  interpreter,
  weatherService,
  config.discordInputChannelId,
);
await discordClient.login(config.discordBotToken);
