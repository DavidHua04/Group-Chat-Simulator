import Avatar from "./Avatar";
import type { Character } from "../types";

export default function MemberList({
  members,
  onEdit,
  onToggleFriend,
}: {
  members: Character[];
  onEdit: (c: Character) => void;
  onToggleFriend: (c: Character) => void;
}) {
  return (
    <aside className="hidden h-full w-60 flex-col overflow-y-auto bg-[#2b2d31] px-2 py-4 lg:flex">
      <h3 className="mb-2 px-2 text-xs font-bold tracking-wide text-[#949ba4] uppercase">
        Members — {members.length}
      </h3>
      {members.map((c) => (
        <div
          key={c.id}
          className="group flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 hover:bg-[#35373c]"
          onClick={() => onEdit(c)}
          title="Click to view / edit"
        >
          <Avatar name={c.name} url={c.avatar_url} seed={c.id} size={32} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5">
              <span className="truncate text-sm font-medium text-[#dbdee1]">{c.name}</span>
              {Boolean(c.is_friend) && (
                <span
                  className="rounded bg-[#5865f2]/30 px-1 text-[10px] font-semibold text-[#c9cdfb]"
                  title="Friend — carries memories across groups"
                >
                  FRIEND
                </span>
              )}
            </div>
            <div className="truncate text-xs text-[#949ba4]">
              {c.personality.replace(/\s+/g, " ").slice(0, 40) || "…"}
            </div>
          </div>
          <button
            className={`invisible text-base group-hover:visible ${
              c.is_friend ? "text-[#f0b232]" : "text-[#4e5058] hover:text-[#f0b232]"
            }`}
            title={c.is_friend ? "Remove from friends" : "Add as friend"}
            onClick={(e) => {
              e.stopPropagation();
              onToggleFriend(c);
            }}
          >
            {c.is_friend ? "★" : "☆"}
          </button>
        </div>
      ))}
    </aside>
  );
}
