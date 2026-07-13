import Anthropic from "@anthropic-ai/sdk";
import { getApiKey } from "../db.js";

let cached: { key: string; client: Anthropic } | null = null;

/** Returns an Anthropic client for the configured key, or null if no key is set. */
export function getClient(): Anthropic | null {
  const key = getApiKey();
  if (!key) return null;
  if (!cached || cached.key !== key) {
    cached = { key, client: new Anthropic({ apiKey: key }) };
  }
  return cached.client;
}
