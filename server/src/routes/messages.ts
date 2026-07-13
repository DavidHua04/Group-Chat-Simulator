import { Router } from "express";
import { db, getGroup, insertMessage, listMessages, newId, serializeMessage } from "../db.js";
import { broadcast } from "../sse.js";
import { enqueueTurn } from "../engine/orchestrator.js";
import { originalName, upload } from "../uploads.js";

export const messagesRouter = Router();

messagesRouter.get("/:groupId/messages", (req, res) => {
  if (!getGroup(req.params.groupId)) return res.status(404).json({ error: "group not found" });
  res.json(listMessages(req.params.groupId).map(serializeMessage));
});

messagesRouter.post("/:groupId/messages", upload.array("files", 5), (req, res) => {
  const group = getGroup(req.params.groupId);
  if (!group) return res.status(404).json({ error: "group not found" });

  const content = typeof req.body?.content === "string" ? req.body.content.trim() : "";
  const files = (req.files as Express.Multer.File[] | undefined) ?? [];
  if (!content && files.length === 0) {
    return res.status(400).json({ error: "message is empty" });
  }

  const message = insertMessage(group.id, "user", content);
  const insertAtt = db.prepare(
    "INSERT INTO attachments (id, message_id, kind, path, mime, original_name) VALUES (?, ?, ?, ?, ?, ?)",
  );
  for (const f of files) {
    insertAtt.run(
      newId(),
      message.id,
      f.mimetype.startsWith("image/") ? "image" : "file",
      f.filename,
      f.mimetype,
      originalName(f),
    );
  }

  const serialized = serializeMessage(message);
  broadcast(group.id, "message", serialized);
  enqueueTurn(group.id);
  res.status(201).json(serialized);
});
