import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { randomUUID } from "node:crypto";
import type {
  AttachmentRow,
  CharacterRow,
  GroupRow,
  MessageRow,
  RelationshipRow,
  SerializedMessage,
} from "./types.js";

const here = path.dirname(fileURLToPath(import.meta.url));
export const DATA_DIR = path.join(here, "..", "data");
export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

export const db = new Database(path.join(DATA_DIR, "app.db"));
db.pragma("journal_mode = WAL");

db.exec(`
CREATE TABLE IF NOT EXISTS characters (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  personality TEXT NOT NULL DEFAULT '',
  background TEXT NOT NULL DEFAULT '',
  avatar_path TEXT,
  is_friend INTEGER NOT NULL DEFAULT 0,
  has_contact_info INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS groups (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  allow_ai_chatter INTEGER NOT NULL DEFAULT 0,
  memory_checkpoint INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS group_members (
  group_id TEXT NOT NULL,
  character_id TEXT NOT NULL,
  PRIMARY KEY (group_id, character_id)
);
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  target TEXT NOT NULL,
  description TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  group_id TEXT NOT NULL,
  sender TEXT NOT NULL,
  content TEXT NOT NULL DEFAULT '',
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_messages_group ON messages(group_id);
CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  message_id TEXT NOT NULL,
  kind TEXT NOT NULL,
  path TEXT NOT NULL,
  mime TEXT NOT NULL,
  original_name TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS memories (
  id TEXT PRIMARY KEY,
  character_id TEXT NOT NULL,
  group_id TEXT NOT NULL,
  content TEXT NOT NULL,
  participant_ids TEXT NOT NULL DEFAULT '[]',
  participated INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_memories_character ON memories(character_id);
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`);

export const now = () => new Date().toISOString();
export const newId = () => randomUUID();

// ---------- settings ----------

export function getSetting(key: string): string | null {
  const row = db.prepare("SELECT value FROM settings WHERE key = ?").get(key) as
    | { value: string }
    | undefined;
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  db.prepare(
    "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
  ).run(key, value);
}

export function getApiKey(): string | null {
  return getSetting("api_key") || process.env.ANTHROPIC_API_KEY || null;
}

export function getModel(): string {
  return getSetting("model") || "claude-opus-4-8";
}

// ---------- characters ----------

export function getCharacter(id: string): CharacterRow | undefined {
  return db.prepare("SELECT * FROM characters WHERE id = ?").get(id) as CharacterRow | undefined;
}

export function listCharacters(friendsOnly = false): CharacterRow[] {
  return db
    .prepare(`SELECT * FROM characters ${friendsOnly ? "WHERE is_friend = 1" : ""} ORDER BY name`)
    .all() as CharacterRow[];
}

export function relationshipsOf(characterId: string): RelationshipRow[] {
  return db
    .prepare("SELECT * FROM relationships WHERE character_id = ?")
    .all(characterId) as RelationshipRow[];
}

// ---------- groups ----------

export function getGroup(id: string): GroupRow | undefined {
  return db.prepare("SELECT * FROM groups WHERE id = ?").get(id) as GroupRow | undefined;
}

export function listGroups(): GroupRow[] {
  return db.prepare("SELECT * FROM groups ORDER BY created_at").all() as GroupRow[];
}

export function membersOf(groupId: string): CharacterRow[] {
  return db
    .prepare(
      `SELECT c.* FROM characters c
       JOIN group_members gm ON gm.character_id = c.id
       WHERE gm.group_id = ? ORDER BY c.name`,
    )
    .all(groupId) as CharacterRow[];
}

// ---------- messages ----------

export function listMessages(groupId: string, limit = 1000): MessageRow[] {
  return db
    .prepare(
      `SELECT id, group_id, sender, content, created_at FROM (
         SELECT rowid AS _rid, * FROM messages WHERE group_id = ? ORDER BY _rid DESC LIMIT ?
       ) ORDER BY _rid`,
    )
    .all(groupId, limit) as MessageRow[];
}

export function countMessages(groupId: string): number {
  const row = db.prepare("SELECT COUNT(*) AS n FROM messages WHERE group_id = ?").get(groupId) as {
    n: number;
  };
  return row.n;
}

export function messagesInRange(groupId: string, offset: number): MessageRow[] {
  return db
    .prepare("SELECT * FROM messages WHERE group_id = ? ORDER BY rowid LIMIT -1 OFFSET ?")
    .all(groupId, offset) as MessageRow[];
}

export function insertMessage(groupId: string, sender: string, content: string): MessageRow {
  const row: MessageRow = {
    id: newId(),
    group_id: groupId,
    sender,
    content,
    created_at: now(),
  };
  db.prepare(
    "INSERT INTO messages (id, group_id, sender, content, created_at) VALUES (?, ?, ?, ?, ?)",
  ).run(row.id, row.group_id, row.sender, row.content, row.created_at);
  return row;
}

export function attachmentsFor(messageId: string): AttachmentRow[] {
  return db
    .prepare("SELECT * FROM attachments WHERE message_id = ?")
    .all(messageId) as AttachmentRow[];
}

export function senderName(sender: string): string {
  if (sender === "user") return "You";
  return getCharacter(sender)?.name ?? "Unknown";
}

export function serializeMessage(m: MessageRow): SerializedMessage {
  return {
    id: m.id,
    group_id: m.group_id,
    sender: m.sender,
    sender_name: senderName(m.sender),
    content: m.content,
    created_at: m.created_at,
    attachments: attachmentsFor(m.id).map((a) => ({
      id: a.id,
      kind: a.kind,
      url: `/uploads/${a.path}`,
      mime: a.mime,
      original_name: a.original_name,
    })),
  };
}
