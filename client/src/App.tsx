import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import Sidebar, { type View } from "./components/Sidebar";
import ChatView from "./components/ChatView";
import FriendsPanel from "./components/FriendsPanel";
import GroupWizard from "./components/GroupWizard";
import CharacterEditor from "./components/CharacterEditor";
import SettingsModal from "./components/SettingsModal";
import type { Character, Group, Settings } from "./types";

export default function App() {
  const [groups, setGroups] = useState<Group[]>([]);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [settings, setSettings] = useState<Settings | null>(null);
  const [view, setView] = useState<View>({ type: "friends" });
  const [showSettings, setShowSettings] = useState(false);
  const [showWizard, setShowWizard] = useState(false);
  // undefined → editor closed; null → creating a new friend; Character → editing
  const [editorTarget, setEditorTarget] = useState<Character | null | undefined>(undefined);

  const refresh = useCallback(async () => {
    const [g, c] = await Promise.all([api.groups.list(), api.characters.list()]);
    setGroups(g);
    setCharacters(c);
    return g;
  }, []);

  useEffect(() => {
    void (async () => {
      const s = await api.settings.get();
      setSettings(s);
      const g = await refresh();
      if (g.length > 0) setView({ type: "group", id: g[0].id });
      if (!s.has_api_key) setShowSettings(true);
    })().catch(console.error);
  }, [refresh]);

  const activeGroup = view.type === "group" ? groups.find((g) => g.id === view.id) : undefined;
  const friends = characters.filter((c) => c.is_friend);

  const toggleChatter = async (g: Group, value: boolean) => {
    setGroups((prev) =>
      prev.map((x) => (x.id === g.id ? { ...x, allow_ai_chatter: value ? 1 : 0 } : x)),
    );
    await api.groups.update(g.id, { allow_ai_chatter: value });
  };

  const toggleFriend = async (c: Character) => {
    await api.characters.setFriend(c.id, !c.is_friend);
    await refresh();
  };

  return (
    <div className="flex h-full">
      <Sidebar
        groups={groups}
        view={view}
        onSelect={setView}
        onNewGroup={() => setShowWizard(true)}
        onSettings={() => setShowSettings(true)}
      />

      {view.type === "group" && activeGroup ? (
        <ChatView
          group={activeGroup}
          onToggleChatter={(g, v) => void toggleChatter(g, v)}
          onEditCharacter={(c) => setEditorTarget(c)}
          onToggleFriend={(c) => void toggleFriend(c)}
        />
      ) : (
        <FriendsPanel
          friends={friends}
          groups={groups}
          onNewFriend={() => setEditorTarget(null)}
          onEdit={(c) => setEditorTarget(c)}
          onAddToGroup={async (cid, gid) => {
            await api.groups.addMember(gid, cid);
            await refresh();
          }}
          onUnfriend={(c) => void toggleFriend(c)}
        />
      )}

      {showWizard && (
        <GroupWizard
          friends={friends}
          onClose={() => setShowWizard(false)}
          onCreate={async (payload) => {
            const g = await api.groups.create(payload);
            await refresh();
            setShowWizard(false);
            setView({ type: "group", id: g.id });
          }}
        />
      )}

      {editorTarget !== undefined && (
        <CharacterEditor
          character={editorTarget}
          onClose={() => setEditorTarget(undefined)}
          onSaved={async () => {
            await refresh();
          }}
        />
      )}

      {showSettings && settings && (
        <SettingsModal
          settings={settings}
          onSaved={setSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}
