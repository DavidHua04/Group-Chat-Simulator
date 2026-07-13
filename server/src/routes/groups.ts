import { Router } from "express";
import {
  countMessages,
  db,
  getCharacter,
  getGroup,
  listGroups,
  membersOf,
  newId,
  now,
} from "../db.js";
import { subscribe } from "../sse.js";
import type { CharacterRow } from "../types.js";

export const groupsRouter = Router();

function serializeGroup(id: string) {
  const g = getGroup(id)!;
  return {
    ...g,
    members: membersOf(id).map((c: CharacterRow) => ({
      ...c,
      avatar_url: c.avatar_path ? `/uploads/${c.avatar_path}` : null,
    })),
    message_count: countMessages(id),
  };
}

groupsRouter.get("/", (_req, res) => {
  res.json(listGroups().map((g) => serializeGroup(g.id)));
});

groupsRouter.post("/", (req, res) => {
  const {
    name,
    allow_ai_chatter = false,
    existing_member_ids = [],
    new_members = [],
  } = req.body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }

  const groupId = newId();
  db.prepare(
    "INSERT INTO groups (id, name, allow_ai_chatter, memory_checkpoint, created_at) VALUES (?, ?, ?, 0, ?)",
  ).run(groupId, name.trim(), allow_ai_chatter ? 1 : 0, now());

  const addMember = db.prepare(
    "INSERT OR IGNORE INTO group_members (group_id, character_id) VALUES (?, ?)",
  );
  for (const cid of existing_member_ids as string[]) {
    if (getCharacter(cid)) addMember.run(groupId, cid);
  }
  for (const nm of new_members as Array<{
    name?: string;
    personality?: string;
    background?: string;
    relationship_to_user?: string;
  }>) {
    if (!nm?.name?.trim()) continue;
    const cid = newId();
    db.prepare(
      `INSERT INTO characters (id, name, personality, background, is_friend, has_contact_info, created_at)
       VALUES (?, ?, ?, ?, 0, 0, ?)`,
    ).run(cid, nm.name.trim(), nm.personality ?? "", nm.background ?? "", now());
    if (nm.relationship_to_user?.trim()) {
      db.prepare(
        "INSERT INTO relationships (id, character_id, target, description) VALUES (?, ?, 'user', ?)",
      ).run(newId(), cid, nm.relationship_to_user.trim());
    }
    addMember.run(groupId, cid);
  }

  res.status(201).json(serializeGroup(groupId));
});

groupsRouter.patch("/:id", (req, res) => {
  const g = getGroup(req.params.id);
  if (!g) return res.status(404).json({ error: "group not found" });
  const name = typeof req.body?.name === "string" && req.body.name.trim() ? req.body.name.trim() : g.name;
  const allow =
    req.body?.allow_ai_chatter === undefined
      ? g.allow_ai_chatter
      : req.body.allow_ai_chatter
        ? 1
        : 0;
  db.prepare("UPDATE groups SET name = ?, allow_ai_chatter = ? WHERE id = ?").run(name, allow, g.id);
  res.json(serializeGroup(g.id));
});

groupsRouter.post("/:id/members", (req, res) => {
  const g = getGroup(req.params.id);
  if (!g) return res.status(404).json({ error: "group not found" });
  const c = getCharacter(req.body?.character_id);
  if (!c) return res.status(404).json({ error: "character not found" });
  db.prepare("INSERT OR IGNORE INTO group_members (group_id, character_id) VALUES (?, ?)").run(
    g.id,
    c.id,
  );
  res.json(serializeGroup(g.id));
});

groupsRouter.delete("/:id/members/:characterId", (req, res) => {
  db.prepare("DELETE FROM group_members WHERE group_id = ? AND character_id = ?").run(
    req.params.id,
    req.params.characterId,
  );
  res.json(serializeGroup(req.params.id));
});

groupsRouter.get("/:id/stream", (req, res) => {
  if (!getGroup(req.params.id)) return res.status(404).end();
  subscribe(req.params.id, req, res);
});
