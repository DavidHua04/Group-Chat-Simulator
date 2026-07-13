import { initials } from "./Avatar";
import type { Group } from "../types";

export type View = { type: "group"; id: string } | { type: "friends" };

export default function Sidebar({
  groups,
  view,
  onSelect,
  onNewGroup,
  onSettings,
}: {
  groups: Group[];
  view: View;
  onSelect: (v: View) => void;
  onNewGroup: () => void;
  onSettings: () => void;
}) {
  const iconCls = (active: boolean) =>
    `flex h-12 w-12 cursor-pointer items-center justify-center overflow-hidden text-sm font-semibold transition-all duration-150 ${
      active
        ? "rounded-2xl bg-[#5865f2] text-white"
        : "rounded-3xl bg-[#313338] text-[#dbdee1] hover:rounded-2xl hover:bg-[#5865f2] hover:text-white"
    }`;

  return (
    <nav className="flex h-full w-[72px] flex-col items-center gap-2 overflow-y-auto bg-[#1e1f22] py-3">
      <button
        className={iconCls(view.type === "friends")}
        onClick={() => onSelect({ type: "friends" })}
        title="Friends"
      >
        👥
      </button>
      <div className="my-1 h-0.5 w-8 rounded bg-[#35363c]" />
      {groups.map((g) => (
        <button
          key={g.id}
          className={iconCls(view.type === "group" && view.id === g.id)}
          onClick={() => onSelect({ type: "group", id: g.id })}
          title={g.name}
        >
          {initials(g.name)}
        </button>
      ))}
      <button
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-3xl bg-[#313338] text-xl text-[#23a559] transition-all duration-150 hover:rounded-2xl hover:bg-[#23a559] hover:text-white"
        onClick={onNewGroup}
        title="Create a group"
      >
        +
      </button>
      <div className="flex-1" />
      <button
        className="flex h-12 w-12 cursor-pointer items-center justify-center rounded-3xl bg-[#313338] text-xl transition-all duration-150 hover:rounded-2xl hover:bg-[#4e5058]"
        onClick={onSettings}
        title="Settings"
      >
        ⚙️
      </button>
    </nav>
  );
}
