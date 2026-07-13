import type Anthropic from "@anthropic-ai/sdk";
import {
  countMessages,
  db,
  getGroup,
  membersOf,
  messagesInRange,
  newId,
  now,
  senderName,
} from "../db.js";
import { PRUNE_THRESHOLD, recallProbability, recallState } from "./decay.js";
import type { CharacterRow, GroupRow, MemoryRow, MessageRow } from "../types.js";

/** How many new messages accumulate before a summarization pass runs. */
export const MEMORY_WINDOW = 20;
/** Max recalled memories injected into a character's prompt. */
export const MAX_RECALLED = 12;

interface MemoryItem {
  content: string;
  involved: string[];
}

async function summarize(
  client: Anthropic,
  model: string,
  group: GroupRow,
  msgs: MessageRow[],
): Promise<MemoryItem[]> {
  const transcript = msgs
    .map((m) => `${m.sender === "user" ? "User" : senderName(m.sender)}: ${m.content || "(attachment)"}`)
    .join("\n");

  const response = await client.messages.create({
    model,
    max_tokens: 1500,
    system:
      "You extract memorable moments from group chat transcripts. Respond with JSON only.",
    messages: [
      {
        role: "user",
        content: `Here is an excerpt from the group chat "${group.name}":\n\n${transcript}\n\nSummarize this excerpt into 2-5 distinct memory records — the things a participant would actually remember later (facts learned, plans made, jokes, arguments, notable moments). Each record: one or two sentences, neutral "what happened" phrasing, using people's names (use "User" for the human). Also list the names of who was involved in each moment.`,
      },
    ],
    output_config: {
      format: {
        type: "json_schema",
        schema: {
          type: "object",
          properties: {
            memories: {
              type: "array",
              items: {
                type: "object",
                properties: {
                  content: { type: "string" },
                  involved: { type: "array", items: { type: "string" } },
                },
                required: ["content", "involved"],
                additionalProperties: false,
              },
            },
          },
          required: ["memories"],
          additionalProperties: false,
        },
      },
    },
  } as Anthropic.MessageCreateParamsNonStreaming);

  const text = response.content.find((b) => b.type === "text")?.text ?? "{}";
  const parsed = JSON.parse(text) as { memories?: MemoryItem[] };
  return (parsed.memories ?? []).filter((m) => m.content?.trim()).slice(0, 5);
}

/**
 * If enough messages accumulated since the last checkpoint, summarize the new
 * window into one memory row per (group member × memory item). participated=1
 * when the member spoke inside the window, 0 when they only observed (§8.2).
 */
export async function maybeWriteMemories(
  client: Anthropic,
  model: string,
  groupId: string,
): Promise<void> {
  const group = getGroup(groupId);
  if (!group) return;
  const total = countMessages(group.id);
  if (total - group.memory_checkpoint < MEMORY_WINDOW) return;

  const windowMsgs = messagesInRange(group.id, group.memory_checkpoint);
  const members = membersOf(group.id);
  if (windowMsgs.length === 0 || members.length === 0) return;

  try {
    const items = await summarize(client, model, group, windowMsgs);
    const speakers = new Set(windowMsgs.map((m) => m.sender));
    const byName = new Map(members.map((m) => [m.name.toLowerCase(), m.id]));
    const insert = db.prepare(
      `INSERT INTO memories (id, character_id, group_id, content, participant_ids, participated, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    const ts = now();
    for (const member of members) {
      for (const item of items) {
        const ids = item.involved
          .map((n) => {
            const key = n.toLowerCase();
            if (key === "user" || key === "you") return "user";
            return byName.get(key);
          })
          .filter((v): v is string => Boolean(v));
        insert.run(
          newId(),
          member.id,
          group.id,
          item.content.trim(),
          JSON.stringify(ids),
          speakers.has(member.id) ? 1 : 0,
          ts,
        );
      }
    }
    db.prepare("UPDATE groups SET memory_checkpoint = ? WHERE id = ?").run(total, group.id);
    console.log(
      `[memory] wrote ${items.length} memories × ${members.length} characters for "${group.name}"`,
    );
  } catch (err) {
    console.error("[memory] summarization failed:", err);
  }
}

export interface RecalledMemory {
  content: string;
  created_at: string;
  groupName: string;
}

/**
 * Memories the character still recalls right now, after the decay roll.
 * Friends carry memory across every group (§5/§8.1); non-friends recall only
 * memories formed in the current group.
 */
export function recallMemories(character: CharacterRow, currentGroupId: string): RecalledMemory[] {
  const rows = (
    character.is_friend
      ? db.prepare("SELECT * FROM memories WHERE character_id = ?").all(character.id)
      : db
          .prepare("SELECT * FROM memories WHERE character_id = ? AND group_id = ?")
          .all(character.id, currentGroupId)
  ) as MemoryRow[];

  const nowDate = new Date();
  return rows
    .filter((r) => recallState(r.id, r.created_at, r.participated === 1, nowDate) === "recalled")
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, MAX_RECALLED)
    .map((r) => ({
      content: r.content,
      created_at: r.created_at,
      groupName: getGroup(r.group_id)?.name ?? "another group",
    }));
}

/** Permanently deletes memories whose recall probability has decayed below the prune threshold. */
export function pruneForgotten(): number {
  const rows = db.prepare("SELECT id, participated, created_at FROM memories").all() as Pick<
    MemoryRow,
    "id" | "participated" | "created_at"
  >[];
  const del = db.prepare("DELETE FROM memories WHERE id = ?");
  let n = 0;
  const nowMs = Date.now();
  for (const r of rows) {
    const ageDays = (nowMs - new Date(r.created_at).getTime()) / 86_400_000;
    if (recallProbability(ageDays, r.participated === 1) < PRUNE_THRESHOLD) {
      del.run(r.id);
      n++;
    }
  }
  if (n > 0) console.log(`[memory] pruned ${n} fully-forgotten memories`);
  return n;
}
