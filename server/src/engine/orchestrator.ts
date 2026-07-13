import {
  getGroup,
  getModel,
  insertMessage,
  listMessages,
  membersOf,
  serializeMessage,
} from "../db.js";
import { broadcast } from "../sse.js";
import { getClient } from "./client.js";
import { generateCharacterReply } from "./character.js";
import { pickSpeakers } from "./director.js";
import { maybeWriteMemories } from "./memory.js";
import type { CharacterRow } from "../types.js";

/** Max AI→AI follow-up messages per user message when §8.3 chatter is enabled. */
const MAX_CHATTER_MESSAGES = 3;

const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

// one turn at a time per group — later user messages chain behind the current run
const queues = new Map<string, Promise<void>>();

export function enqueueTurn(groupId: string): void {
  const prev = queues.get(groupId) ?? Promise.resolve();
  const next = prev
    .then(() => runTurn(groupId))
    .catch((err) => {
      console.error("[orchestrator] turn failed:", err);
      broadcast(groupId, "error", {
        message: err instanceof Error ? err.message : "Something went wrong generating replies.",
      });
    });
  queues.set(groupId, next);
  void next.finally(() => {
    if (queues.get(groupId) === next) queues.delete(groupId);
  });
}

async function runTurn(groupId: string): Promise<void> {
  const client = getClient();
  if (!client) {
    broadcast(groupId, "error", {
      message: "No Anthropic API key configured. Open Settings and paste your key.",
    });
    return;
  }
  const model = getModel();
  const group = getGroup(groupId);
  if (!group) return;
  const members = membersOf(groupId);
  if (members.length === 0) return;

  let msgs = listMessages(groupId);
  const lastUser = [...msgs].reverse().find((m) => m.sender === "user");

  // characters addressed by name always respond (in mention order)
  let speakers: CharacterRow[] = [];
  if (lastUser) {
    speakers = members
      .filter((m) => new RegExp(`\\b${escapeRe(m.name)}\\b`, "i").test(lastUser.content))
      .sort(
        (a, b) =>
          lastUser.content.toLowerCase().indexOf(a.name.toLowerCase()) -
          lastUser.content.toLowerCase().indexOf(b.name.toLowerCase()),
      )
      .slice(0, 3);
  }
  if (speakers.length === 0) {
    speakers = await pickSpeakers(client, model, group, members, msgs, "reply");
  }

  const speak = async (character: CharacterRow) => {
    broadcast(groupId, "typing", { characterId: character.id, name: character.name, state: "start" });
    try {
      msgs = listMessages(groupId); // refresh so each speaker sees prior replies
      const text = await generateCharacterReply(
        client,
        model,
        group,
        character,
        members,
        msgs,
        (delta) => broadcast(groupId, "delta", { characterId: character.id, text: delta }),
      );
      const saved = insertMessage(groupId, character.id, text);
      broadcast(groupId, "message", serializeMessage(saved));
    } finally {
      broadcast(groupId, "typing", { characterId: character.id, name: character.name, state: "stop" });
    }
  };

  for (const character of speakers) {
    await speak(character);
  }

  // §8.3 — characters talking to each other, unprompted, capped per user turn
  if (group.allow_ai_chatter) {
    for (let i = 0; i < MAX_CHATTER_MESSAGES; i++) {
      msgs = listMessages(groupId);
      const next = await pickSpeakers(client, model, group, members, msgs, "chatter");
      if (next.length === 0) break;
      await speak(next[0]);
    }
  }

  await maybeWriteMemories(client, model, groupId);
}
