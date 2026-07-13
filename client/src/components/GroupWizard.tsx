import { useState } from "react";
import Modal, { Field, btnGhost, btnPrimary, inputCls } from "./Modal";
import Avatar from "./Avatar";
import type { Character, NewMemberDraft } from "../types";

const emptyMember = (): NewMemberDraft => ({
  name: "",
  personality: "",
  background: "",
  relationship_to_user: "",
});

export default function GroupWizard({
  friends,
  onCreate,
  onClose,
}: {
  friends: Character[];
  onCreate: (payload: {
    name: string;
    allow_ai_chatter: boolean;
    existing_member_ids: string[];
    new_members: NewMemberDraft[];
  }) => Promise<void>;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [allowChatter, setAllowChatter] = useState(false);
  const [friendIds, setFriendIds] = useState<Set<string>>(new Set());
  const [members, setMembers] = useState<NewMemberDraft[]>([emptyMember(), emptyMember()]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const totalMembers = friendIds.size + members.filter((m) => m.name.trim()).length;

  const setMember = (i: number, patch: Partial<NewMemberDraft>) =>
    setMembers((prev) => prev.map((m, j) => (j === i ? { ...m, ...patch } : m)));

  const create = async () => {
    if (!name.trim()) return setError("Give the group a name.");
    if (totalMembers === 0) return setError("Add at least one AI member.");
    setBusy(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        allow_ai_chatter: allowChatter,
        existing_member_ids: [...friendIds],
        new_members: members.filter((m) => m.name.trim()),
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create the group.");
      setBusy(false);
    }
  };

  return (
    <Modal title="Create a Group" onClose={onClose} wide>
      <Field label="Group name">
        <input
          className={inputCls}
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. weekend crew"
          autoFocus
        />
      </Field>

      <label className="mb-4 flex items-center gap-2 text-sm text-[#dbdee1]">
        <input
          type="checkbox"
          checked={allowChatter}
          onChange={(e) => setAllowChatter(e.target.checked)}
        />
        Allow characters to talk to each other unprompted
      </label>

      {friends.length > 0 && (
        <Field label="Invite existing friends" hint="Friends bring their memories of you (and of each other) into the new group.">
          <div className="flex flex-wrap gap-2">
            {friends.map((f) => {
              const on = friendIds.has(f.id);
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() =>
                    setFriendIds((prev) => {
                      const next = new Set(prev);
                      if (on) next.delete(f.id);
                      else next.add(f.id);
                      return next;
                    })
                  }
                  className={`flex items-center gap-2 rounded-full px-3 py-1 text-sm ${
                    on ? "bg-[#5865f2] text-white" : "bg-[#1e1f22] text-[#b5bac1] hover:bg-[#3f4147]"
                  }`}
                >
                  <Avatar name={f.name} url={f.avatar_url} seed={f.id} size={20} />
                  {f.name}
                </button>
              );
            })}
          </div>
        </Field>
      )}

      <div className="mb-1 text-xs font-bold tracking-wide text-[#b5bac1] uppercase">
        New characters
      </div>
      {members.map((m, i) => (
        <fieldset key={i} className="mb-3 rounded-lg border border-[#3f4147] p-3">
          <div className="mb-2 flex items-center justify-between">
            <span className="text-sm font-semibold text-white">Member {i + 1}</span>
            <button
              className="text-xs text-[#949ba4] hover:text-[#da373c]"
              onClick={() => setMembers((prev) => prev.filter((_, j) => j !== i))}
            >
              remove
            </button>
          </div>
          <input
            className={`${inputCls} mb-2`}
            placeholder="Name (required)"
            value={m.name}
            onChange={(e) => setMember(i, { name: e.target.value })}
          />
          <textarea
            className={`${inputCls} mb-2`}
            rows={2}
            placeholder="Personality traits — e.g. sarcastic, loyal, obsessed with retro games"
            value={m.personality}
            onChange={(e) => setMember(i, { personality: e.target.value })}
          />
          <textarea
            className={`${inputCls} mb-2`}
            rows={2}
            placeholder="Background / backstory"
            value={m.background}
            onChange={(e) => setMember(i, { background: e.target.value })}
          />
          <input
            className={inputCls}
            placeholder="Relationship to you (optional) — e.g. college roommate"
            value={m.relationship_to_user}
            onChange={(e) => setMember(i, { relationship_to_user: e.target.value })}
          />
        </fieldset>
      ))}
      <button
        className="mb-4 text-sm text-[#00a8fc] hover:underline"
        onClick={() => setMembers((prev) => [...prev, emptyMember()])}
      >
        + Add another member
      </button>

      {totalMembers > 5 && (
        <p className="mb-3 rounded bg-[#4e3a10] px-3 py-2 text-xs text-[#f0c987]">
          ⚠️ {totalMembers} members means {totalMembers} model calls can fire per message — expect
          slower and pricier turns. You can still proceed.
        </p>
      )}
      {error && <p className="mb-3 text-sm text-[#f23f43]">{error}</p>}

      <div className="flex justify-end gap-2 pb-1">
        <button className={btnGhost} onClick={onClose}>
          Cancel
        </button>
        <button className={btnPrimary} onClick={() => void create()} disabled={busy}>
          {busy ? "Creating…" : "Create & join"}
        </button>
      </div>
    </Modal>
  );
}
