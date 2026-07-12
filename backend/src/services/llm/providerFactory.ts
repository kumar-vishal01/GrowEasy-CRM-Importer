import { LLMProvider } from "./LLMProvider";
import { OpenAIProvider } from "./OpenAIProvider";
import { MockProvider } from "./MockProvider";
import { logger } from "../../utils/logger";
import { GroqProvider } from "./GroqProvider";

let cachedProvider: LLMProvider | null = null;

/**
 * Selects the active LLM provider based on LLM_PROVIDER env var.
 * Defaults to "mock" if unset, so the app runs out of the box with no
 * API key required. Set LLM_PROVIDER=openai + OPENAI_API_KEY for live use.
 */
export function getLLMProvider(): LLMProvider {
  if (cachedProvider) return cachedProvider;

  const providerName = (process.env.LLM_PROVIDER || "mock").toLowerCase();

  switch (providerName) {
    case "openai": {
      const apiKey = process.env.OPENAI_API_KEY;
      if (!apiKey) {
        logger.warn("OPENAI_API_KEY not set — falling back to mock provider");
        cachedProvider = new MockProvider();
        break;
      }
      cachedProvider = new OpenAIProvider(apiKey, process.env.OPENAI_MODEL);
      break;
    }

    case "groq": {
      const apiKey = process.env.GROQ_API_KEY;
      if (!apiKey) {
        logger.warn("GROQ_API_KEY not set — falling back to mock provider");
        cachedProvider = new MockProvider();
        break;
      }
      cachedProvider = new GroqProvider(apiKey, process.env.GROQ_MODEL);
      break;
    }


    case "mock":
    default:
      cachedProvider = new MockProvider();
      break;
  }

  logger.info("LLM provider initialized", { provider: cachedProvider.name });
  return cachedProvider;
}
