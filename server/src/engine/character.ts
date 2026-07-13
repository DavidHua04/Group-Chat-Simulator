import fs from "node:fs";
import path from "node:path";
import type Anthropic from "@anthropic-ai/sdk";
import {
  attachmentsFor,
  getCharacter,
  relationshipsOf,
  senderName,
  UPLOADS_DIR,
} from "../db.js";
import { recallMemories } from "./memory.js";
import type { CharacterRow, GroupRow, MessageRow } from "../types.js";

const MAX_ATTACHMENT_BYTES = 4 * 1024 * 1024;
// only the newest messages carry real image/document blocks; older ones are text notes
const RECENT_ATTACHMENT_MESSAGES = 12;
const IMAGE_MEDIA_TYPES = new Set(["image/jpeg", "image/png", "image/gif", "image/webp"]);

const oneLine = (s: string, max = 120) => s.replace(/\s+/g, " ").trim().slice(0, max);

function humanizeAge(createdAt: string): string {
  const days = Math.floor((Date.now() - new Date(createdAt).getTime()) / 86_400_000);
  if (days <= 0) return "earlier today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

function buildSystem(
  group: GroupRow,
  character: CharacterRow,
  members: CharacterRow[],
): Anthropic.TextBlockParam[] {
  const others = members.filter((m) => m.id !== character.id);
  const rels = relationshipsOf(character.id)
    .map((r) => {
      const who = r.target === "user" ? "the user" : (getCharacter(r.target)?.name ?? "someone");
      return `- With ${who}: ${r.description}`;
    })
    .join("\n");

  const parts = [
    `You are ${character.name}, one member of a casual group chat called "${group.name}". The chat contains the user (the human, shown as «You») and other characters.`,
    ``,
    `YOUR PERSONALITY:\n${character.personality || "(none given — be yourself)"}`,
    ``,
    `YOUR BACKGROUND:\n${character.background || "(none given)"}`,
  ];
  if (rels) parts.push(``, `YOUR RELATIONSHIPS:\n${rels}`);
  if (others.length > 0) {
    parts.push(
      ``,
      `OTHER MEMBERS OF THIS GROUP:\n${others
        .map((m) => `- ${m.name}: ${oneLine(m.personality) || "(unknown)"}`)
        .join("\n")}`,
    );
  }
  parts.push(
    ``,
    `HOW TO BEHAVE:`,
    `- Always stay in character as ${character.name}.`,
    `- Write like a real person texting in a group chat: informal, usually 1-3 sentences. Occasionally longer if the topic warrants it.`,
    `- React to the other characters as well as to the user; you are all in the same room.`,
    `- If someone shared an image or file, react to its actual content in your own voice.`,
    `- Do not repeat or paraphrase what others just said; add something of your own.`,
    `- Output ONLY the text of your next chat message: no name prefix, no quotation marks, no narration or stage directions.`,
  );
  if (!character.has_contact_info) {
    parts.push(
      `- You do NOT have the user's personal contact info (they haven't added you as a friend). Very occasionally, if it fits the moment naturally, you may ask the user to add you as a friend so you can stay in touch outside this group. Don't be pushy about it.`,
    );
  }

  const blocks: Anthropic.TextBlockParam[] = [
    // stable per character+group → prompt-cache friendly
    { type: "text", text: parts.join("\n"), cache_control: { type: "ephemeral" } },
  ];

  const memories = recallMemories(character, group.id);
  if (memories.length > 0) {
    const lines = memories
      .map((m) => `- [${humanizeAge(m.created_at)}, in "${m.groupName}"] ${m.content}`)
      .join("\n");
    // volatile block — sits after the cache breakpoint on purpose
    blocks.push({
      type: "text",
      text: `THINGS YOU REMEMBER FROM PAST CONVERSATIONS (older memories have faded away):\n${lines}`,
    });
  }
  return blocks;
}

function attachmentBlocks(messageId: string): Anthropic.ContentBlockParam[] {
  const blocks: Anthropic.ContentBlockParam[] = [];
  for (const att of attachmentsFor(messageId)) {
    const filePath = path.join(UPLOADS_DIR, att.path);
    try {
      const stat = fs.statSync(filePath);
      if (stat.size > MAX_ATTACHMENT_BYTES) {
        blocks.push({ type: "text", text: `[attached file too large to view: ${att.original_name}]` });
        continue;
      }
      if (att.kind === "image" && IMAGE_MEDIA_TYPES.has(att.mime)) {
        blocks.push({
          type: "image",
          source: {
            type: "base64",
            media_type: att.mime as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
            data: fs.readFileSync(filePath).toString("base64"),
          },
        });
      } else if (att.mime === "application/pdf") {
        blocks.push({
          type: "document",
          source: {
            type: "base64",
            media_type: "application/pdf",
            data: fs.readFileSync(filePath).toString("base64"),
          },
        });
      } else if (att.mime.startsWith("text/") || /json|xml|csv/.test(att.mime)) {
        const text = fs.readFileSync(filePath, "utf8").slice(0, 20_000);
        blocks.push({
          type: "text",
          text: `[content of attached file "${att.original_name}"]\n${text}`,
        });
      } else {
        blocks.push({ type: "text", text: `[attached a file: ${att.original_name} (${att.mime})]` });
      }
    } catch {
      blocks.push({ type: "text", text: `[attached a file: ${att.original_name}]` });
    }
  }
  return blocks;
}

function buildTranscript(character: CharacterRow, msgs: MessageRow[]): Anthropic.MessageParam[] {
  const recent = msgs.slice(-80);
  const attachFrom = Math.max(0, recent.length - RECENT_ATTACHMENT_MESSAGES);
  const out: Anthropic.MessageParam[] = [];

  recent.forEach((m, i) => {
    const hasAttachments = attachmentsFor(m.id).length > 0;
    if (m.sender === character.id) {
      out.push({ role: "assistant", content: m.content || "(sent an attachment)" });
      return;
    }
    const label = m.sender === "user" ? "You" : senderName(m.sender);
    const blocks: Anthropic.ContentBlockParam[] = [
      { type: "text", text: `«${label}»: ${m.content || "(sent an attachment)"}` },
    ];
    if (hasAttachments) {
      if (i >= attachFrom) blocks.push(...attachmentBlocks(m.id));
      else blocks.push({ type: "text", text: `[${label} sent attachment(s) earlier]` });
    }
    out.push({ role: "user", content: blocks });
  });

  // API requires the first message to be a user turn
  while (out.length > 0 && out[0].role === "assistant") out.shift();

  // incremental prompt-cache breakpoint on the newest message
  const last = out[out.length - 1];
  if (last) {
    if (typeof last.content === "string") {
      last.content = [
        { type: "text", text: last.content, cache_control: { type: "ephemeral" } },
      ];
    } else if (Array.isArray(last.content) && last.content.length > 0) {
      const lastBlock = last.content[last.content.length - 1] as { cache_control?: unknown };
      lastBlock.cache_control = { type: "ephemeral" };
    }
  }
  return out;
}

export async function generateCharacterReply(
  client: Anthropic,
  model: string,
  group: GroupRow,
  character: CharacterRow,
  members: CharacterRow[],
  msgs: MessageRow[],
  onDelta: (text: string) => void,
): Promise<string> {
  const system = buildSystem(group, character, members);
  const messages = buildTranscript(character, msgs);
  if (messages.length === 0) {
    messages.push({ role: "user", content: `«You»: (joins the chat) Hi everyone!` });
  }

  const stream = client.messages.stream({
    model,
    max_tokens: 1024,
    system,
    messages,
  });
  stream.on("text", onDelta);
  const final = await stream.finalMessage();

  console.log(
    `[character] ${character.name} replied — tokens in=${final.usage.input_tokens} cached=${final.usage.cache_read_input_tokens ?? 0} out=${final.usage.output_tokens} stop=${final.stop_reason}`,
  );

  const text = final.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
  return text || "…";
}
