import { useState } from "react";
import Avatar from "./Avatar";
import { btnPrimary } from "./Modal";
import type { Character, Group } from "../types";

export default function FriendsPanel({
  friends,
  groups,
  onNewFriend,
  onEdit,
  onAddToGroup,
  onUnfriend,
}: {
  friends: Character[];
  groups: Group[];
  onNewFriend: () => void;
  onEdit: (c: Character) => void;
  onAddToGroup: (characterId: string, groupId: string) => Promise<void>;
  onUnfriend: (c: Character) => void;
}) {
  const [pick, setPick] = useState<Record<string, string>>({});

  return (
    <div className="flex h-full flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-[#26272b] px-4 py-3">
        <span className="text-xl">👥</span>
        <h1 className="font-semibold text-white">Friends</h1>
        <div className="flex-1" />
        <button className={btnPrimary} onClick={onNewFriend}>
          New Friend
        </button>
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {friends.length === 0 && (
          <div className="mt-16 text-center text-[#949ba4]">
            <div className="mb-2 text-4xl">🫂</div>
            <p className="mb-1 font-medium text-white">No friends yet</p>
            <p className="mx-auto max-w-md text-sm">
              Create a character directly as a friend, or star a character inside any group.
              Friends keep their memories of you across every group you invite them to.
            </p>
          </div>
        )}
        <div className="mx-auto flex max-w-3xl flex-col gap-2">
          {friends.map((f) => {
            const joinable = groups.filter((g) => !g.members.some((m) => m.id === f.id));
            const chosen = pick[f.id] ?? "";
            return (
              <div
                key={f.id}
                className="flex items-center gap-3 rounded-lg bg-[#2b2d31] px-4 py-3"
              >
                <Avatar name={f.name} url={f.avatar_url} seed={f.id} size={44} />
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-white">{f.name}</div>
                  <div className="truncate text-sm text-[#949ba4]">
                    {f.personality.replace(/\s+/g, " ").slice(0, 80) || "No personality set"}
                  </div>
                </div>
                {joinable.length > 0 && (
                  <div className="flex items-center gap-1">
                    <select
                      className="rounded bg-[#1e1f22] px-2 py-1.5 text-sm text-[#dbdee1]"
                      value={chosen}
                      onChange={(e) => setPick((p) => ({ ...p, [f.id]: e.target.value }))}
                    >
                      <option value="">Add to group…</option>
                      {joinable.map((g) => (
                        <option key={g.id} value={g.id}>
                          {g.name}
                        </option>
                      ))}
                    </select>
                    <button
                      className="rounded bg-[#23a559] px-2.5 py-1.5 text-sm font-medium text-white disabled:opacity-40"
                      disabled={!chosen}
                      onClick={() => {
                        void onAddToGroup(f.id, chosen);
                        setPick((p) => ({ ...p, [f.id]: "" }));
                      }}
                    >
                      Add
                    </button>
                  </div>
                )}
                <button
                  className="text-sm text-[#00a8fc] hover:underline"
                  onClick={() => onEdit(f)}
                >
                  Edit
                </button>
                <button
                  className="text-lg text-[#f0b232]"
                  title="Remove from friends"
                  onClick={() => onUnfriend(f)}
                >
                  ★
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
