import type Anthropic from "@anthropic-ai/sdk";
import { senderName } from "../db.js";
import type { CharacterRow, GroupRow, MessageRow } from "../types.js";

const oneLine = (s: string, max = 120) =>
  s.replace(/\s+/g, " ").trim().slice(0, max) || "(no description)";

function formatTail(msgs: MessageRow[], count = 12): string {
  return msgs
    .slice(-count)
    .map((m) => `${senderName(m.sender)}: ${m.content || "(attachment)"}`)
    .join("\n");
}

/**
 * Decides which character(s) speak next.
 * mode "reply": after a user message — returns 1-2 speakers (falls back to a random member).
 * mode "chatter": AI-to-AI follow-up rounds (§8.3) — returns 0 or 1 speaker.
 */
export async function pickSpeakers(
  client: Anthropic,
  model: string,
  group: GroupRow,
  members: CharacterRow[],
  msgs: MessageRow[],
  mode: "reply" | "chatter",
): Promise<CharacterRow[]> {
  if (members.length === 0) return [];
  if (members.length === 1) {
    if (mode === "reply") return [members[0]];
    // single member shouldn't monologue forever
  }

  const roster = members.map((m) => `- ${m.name}: ${oneLine(m.personality)}`).join("\n");
  const question =
    mode === "reply"
      ? "Given the personalities and the flow of conversation, which member(s) would naturally respond next? Pick 1 or 2 names (the most natural responder first)."
      : 'The user has not spoken since the last messages. Would any member naturally keep the conversation going on their own right now (a reaction, a follow-up, banter)? If yes, pick exactly 1 name. If the conversation should rest and wait for the user, return an empty list. Prefer resting over forced chatter.';

  try {
    const response = await client.messages.create({
      model,
      max_tokens: 300,
      system:
        "You are the invisible director of a simulated group chat. You never speak in the chat; you only decide who talks next. Respond with JSON only.",
      messages: [
        {
          role: "user",
          content: `GROUP: ${group.name}\n\nMEMBERS:\n${roster}\n\nRECENT MESSAGES:\n${formatTail(msgs)}\n\n${question}`,
        },
      ],
      output_config: {
        format: {
          type: "json_schema",
          schema: {
            type: "object",
            properties: {
              speakers: { type: "array", items: { type: "string" } },
            },
            required: ["speakers"],
            additionalProperties: false,
          },
        },
      },
    } as Anthropic.MessageCreateParamsNonStreaming);

    const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
    const parsed = JSON.parse(text) as { speakers?: string[] };
    const names = Array.isArray(parsed.speakers) ? parsed.speakers : [];
    const picked: CharacterRow[] = [];
    for (const name of names) {
      const member = members.find((m) => m.name.toLowerCase() === String(name).toLowerCase());
      if (member && !picked.includes(member)) picked.push(member);
    }
    const cap = mode === "reply" ? 2 : 1;
    if (mode === "reply" && picked.length === 0) {
      return [members[Math.floor(Math.random() * members.length)]];
    }
    return picked.slice(0, cap);
  } catch (err) {
    console.error("[director] failed, falling back:", err);
    if (mode === "reply") return [members[Math.floor(Math.random() * members.length)]];
    return [];
  }
}
