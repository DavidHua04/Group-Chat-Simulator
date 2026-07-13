import { Router } from "express";
import { db, getCharacter, listCharacters, newId, now, relationshipsOf } from "../db.js";
import { upload } from "../uploads.js";
import type { CharacterRow } from "../types.js";

export const charactersRouter = Router();

function serializeCharacter(c: CharacterRow) {
  const rels = relationshipsOf(c.id);
  return {
    ...c,
    avatar_url: c.avatar_path ? `/uploads/${c.avatar_path}` : null,
    relationship_to_user: rels.find((r) => r.target === "user")?.description ?? "",
  };
}

function upsertUserRelationship(characterId: string, description: string | undefined) {
  if (description === undefined) return;
  db.prepare("DELETE FROM relationships WHERE character_id = ? AND target = 'user'").run(
    characterId,
  );
  if (description.trim()) {
    db.prepare(
      "INSERT INTO relationships (id, character_id, target, description) VALUES (?, ?, 'user', ?)",
    ).run(newId(), characterId, description.trim());
  }
}

charactersRouter.get("/", (req, res) => {
  const friendsOnly = req.query.friends === "1";
  res.json(listCharacters(friendsOnly).map(serializeCharacter));
});

charactersRouter.post("/", (req, res) => {
  const { name, personality = "", background = "", is_friend = false, relationship_to_user } =
    req.body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return res.status(400).json({ error: "name is required" });
  }
  const id = newId();
  db.prepare(
    `INSERT INTO characters (id, name, personality, background, is_friend, has_contact_info, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
  ).run(id, name.trim(), personality, background, is_friend ? 1 : 0, is_friend ? 1 : 0, now());
  upsertUserRelationship(id, relationship_to_user);
  res.status(201).json(serializeCharacter(getCharacter(id)!));
});

// §8.6 — editing allowed; existing memories are intentionally untouched
charactersRouter.put("/:id", (req, res) => {
  const c = getCharacter(req.params.id);
  if (!c) return res.status(404).json({ error: "character not found" });
  const { name = c.name, personality = c.personality, background = c.background, relationship_to_user } =
    req.body ?? {};
  db.prepare("UPDATE characters SET name = ?, personality = ?, background = ? WHERE id = ?").run(
    String(name).trim() || c.name,
    String(personality),
    String(background),
    c.id,
  );
  upsertUserRelationship(c.id, relationship_to_user);
  res.json(serializeCharacter(getCharacter(c.id)!));
});

// friending also grants the user's "personal contact info" (spec §6)
charactersRouter.post("/:id/friend", (req, res) => {
  const c = getCharacter(req.params.id);
  if (!c) return res.status(404).json({ error: "character not found" });
  const isFriend = Boolean(req.body?.is_friend);
  db.prepare(
    "UPDATE characters SET is_friend = ?, has_contact_info = CASE WHEN ? THEN 1 ELSE has_contact_info END WHERE id = ?",
  ).run(isFriend ? 1 : 0, isFriend ? 1 : 0, c.id);
  res.json(serializeCharacter(getCharacter(c.id)!));
});

charactersRouter.post("/:id/avatar", upload.single("avatar"), (req, res) => {
  const c = getCharacter(req.params.id);
  if (!c) return res.status(404).json({ error: "character not found" });
  if (!req.file) return res.status(400).json({ error: "no file uploaded" });
  db.prepare("UPDATE characters SET avatar_path = ? WHERE id = ?").run(req.file.filename, c.id);
  res.json(serializeCharacter(getCharacter(c.id)!));
});
