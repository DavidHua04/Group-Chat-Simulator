import { useRef, useState } from "react";
import { api } from "../api";
import Modal, { Field, btnGhost, btnPrimary, inputCls } from "./Modal";
import Avatar from "./Avatar";
import type { Character } from "../types";

/**
 * Edit an existing character, or create a new friend directly (spec §6).
 * Per spec §8.6, saving an edit requires explicit confirmation and never
 * touches the character's existing memories.
 */
export default function CharacterEditor({
  character,
  onSaved,
  onClose,
}: {
  character: Character | null; // null → create a new friend
  onSaved: () => Promise<void> | void;
  onClose: () => void;
}) {
  const editing = character !== null;
  const [name, setName] = useState(character?.name ?? "");
  const [personality, setPersonality] = useState(character?.personality ?? "");
  const [background, setBackground] = useState(character?.background ?? "");
  const [relationship, setRelationship] = useState(character?.relationship_to_user ?? "");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const avatarInput = useRef<HTMLInputElement>(null);

  const save = async () => {
    if (!name.trim()) return setError("A name is required.");
    setBusy(true);
    setError(null);
    try {
      let saved: Character;
      if (editing) {
        saved = await api.characters.update(character.id, {
          name,
          personality,
          background,
          relationship_to_user: relationship,
        });
      } else {
        saved = await api.characters.create({
          name,
          personality,
          background,
          relationship_to_user: relationship,
          is_friend: true,
        });
      }
      if (avatarFile) await api.characters.uploadAvatar(saved.id, avatarFile);
      await onSaved();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save.");
      setBusy(false);
      setConfirming(false);
    }
  };

  if (confirming) {
    return (
      <Modal title={`Update ${character!.name}?`} onClose={() => setConfirming(false)}>
        <p className="mb-4 text-sm text-[#dbdee1]">
          You're about to change this character's personality or background.
        </p>
        <p className="mb-5 rounded bg-[#1e1f22] px-3 py-2 text-sm text-[#949ba4]">
          Their existing memories will <span className="font-semibold text-[#dbdee1]">not</span> be
          affected — everything they remember stays as it is and keeps fading naturally over time.
          Only how they behave from now on will change.
        </p>
        <div className="flex justify-end gap-2">
          <button className={btnGhost} onClick={() => setConfirming(false)}>
            Go back
          </button>
          <button className={btnPrimary} onClick={() => void save()} disabled={busy}>
            {busy ? "Saving…" : "Yes, update them"}
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal title={editing ? `Edit ${character.name}` : "Create a Friend"} onClose={onClose} wide>
      <div className="mb-4 flex items-center gap-4">
        <button type="button" onClick={() => avatarInput.current?.click()} title="Set avatar">
          {avatarFile ? (
            <img
              src={URL.createObjectURL(avatarFile)}
              className="h-16 w-16 rounded-full object-cover"
              alt="avatar preview"
            />
          ) : (
            <Avatar
              name={name || "?"}
              url={character?.avatar_url}
              seed={character?.id ?? name}
              size={64}
            />
          )}
        </button>
        <div className="text-xs text-[#949ba4]">
          Click the circle to upload an avatar (optional).
          {editing && Boolean(character.is_friend) && (
            <div className="mt-1 text-[#c9cdfb]">
              ★ Friend — carries memories with them across all groups.
            </div>
          )}
        </div>
        <input
          ref={avatarInput}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => setAvatarFile(e.target.files?.[0] ?? null)}
        />
      </div>

      <Field label="Name">
        <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label="Personality traits">
        <textarea
          className={inputCls}
          rows={3}
          value={personality}
          onChange={(e) => setPersonality(e.target.value)}
          placeholder="Freeform — e.g. dry humor, fiercely competitive, secretly sentimental"
        />
      </Field>
      <Field label="Background / backstory">
        <textarea
          className={inputCls}
          rows={3}
          value={background}
          onChange={(e) => setBackground(e.target.value)}
        />
      </Field>
      <Field label="Relationship to you" hint="Optional — how this character knows you.">
        <input
          className={inputCls}
          value={relationship}
          onChange={(e) => setRelationship(e.target.value)}
        />
      </Field>

      {error && <p className="mb-3 text-sm text-[#f23f43]">{error}</p>}

      <div className="flex justify-end gap-2 pb-1">
        <button className={btnGhost} onClick={onClose}>
          Cancel
        </button>
        <button
          className={btnPrimary}
          disabled={busy}
          onClick={() => (editing ? setConfirming(true) : void save())}
        >
          {editing ? "Save changes" : "Create friend"}
        </button>
      </div>
    </Modal>
  );
}
