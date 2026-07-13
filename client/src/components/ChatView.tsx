import { useEffect, useRef, useState } from "react";
import { api } from "../api";
import { useGroupStream } from "../useGroupStream";
import Avatar from "./Avatar";
import Composer from "./Composer";
import MemberList from "./MemberList";
import type { Character, Group, Message } from "../types";

interface Pending {
  name: string;
  text: string;
}

const dayKey = (iso: string) => new Date(iso).toDateString();

export default function ChatView({
  group,
  onToggleChatter,
  onEditCharacter,
  onToggleFriend,
}: {
  group: Group;
  onToggleChatter: (g: Group, value: boolean) => void;
  onEditCharacter: (c: Character) => void;
  onToggleFriend: (c: Character) => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [pending, setPending] = useState<Record<string, Pending>>({});
  const [toast, setToast] = useState<string | null>(null);
  const [limitsDismissed, setLimitsDismissed] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    setMessages([]);
    setPending({});
    setLimitsDismissed(localStorage.getItem(`limits-${group.id}`) === "1");
    api.messages.list(group.id).then(setMessages).catch(console.error);
  }, [group.id]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, pending]);

  const showToast = (msg: string) => {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 8000);
  };

  useGroupStream(group.id, {
    onMessage: (m) => {
      setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
      setPending((p) => {
        if (!(m.sender in p)) return p;
        const { [m.sender]: _drop, ...rest } = p;
        return rest;
      });
    },
    onTyping: (e) => {
      setPending((p) => {
        if (e.state === "start") return { ...p, [e.characterId]: { name: e.name, text: "" } };
        const { [e.characterId]: _drop, ...rest } = p;
        return rest;
      });
    },
    onDelta: (e) => {
      setPending((p) =>
        p[e.characterId]
          ? { ...p, [e.characterId]: { ...p[e.characterId], text: p[e.characterId].text + e.text } }
          : p,
      );
    },
    onError: showToast,
  });

  const send = async (content: string, files: File[]) => {
    const m = await api.messages.send(group.id, content, files);
    setMessages((prev) => (prev.some((x) => x.id === m.id) ? prev : [...prev, m]));
  };

  const memberById = (id: string) => group.members.find((m) => m.id === id);
  const overLimit = group.members.length > 5 || messages.length > 300;

  return (
    <div className="flex h-full min-w-0 flex-1">
      <div className="flex h-full min-w-0 flex-1 flex-col">
        {/* header */}
        <header className="flex items-center gap-3 border-b border-[#26272b] px-4 py-3 shadow-sm">
          <span className="text-xl text-[#80848e]">#</span>
          <h1 className="truncate font-semibold text-white">{group.name}</h1>
          <div className="flex-1" />
          <label className="flex cursor-pointer items-center gap-2 text-sm text-[#b5bac1]">
            <span className="hidden sm:inline">Allow characters to talk to each other</span>
            <span className="sm:hidden">AI chatter</span>
            <input
              type="checkbox"
              checked={Boolean(group.allow_ai_chatter)}
              onChange={(e) => onToggleChatter(group, e.target.checked)}
              className="peer sr-only"
            />
            <span className="relative h-5 w-9 rounded-full bg-[#4e5058] transition-colors peer-checked:bg-[#23a559] after:absolute after:top-0.5 after:left-0.5 after:h-4 after:w-4 after:rounded-full after:bg-white after:transition-transform peer-checked:after:translate-x-4" />
          </label>
        </header>

        {/* §8.4 soft-limit warning */}
        {overLimit && !limitsDismissed && (
          <div className="flex items-start gap-3 bg-[#4e3a10] px-4 py-2 text-sm text-[#f0c987]">
            <span>⚠️</span>
            <p className="flex-1">
              {group.members.length > 5 ? "This group is getting large. " : ""}
              {messages.length > 300 ? "This conversation is getting long. " : ""}
              Every character reply is a separate model call, so token usage grows with group size
              and history — responses may get slower and cost more. You can keep going if you like.
            </p>
            <button
              className="font-semibold hover:underline"
              onClick={() => {
                localStorage.setItem(`limits-${group.id}`, "1");
                setLimitsDismissed(true);
              }}
            >
              Got it
            </button>
          </div>
        )}

        {/* messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4">
          {messages.length === 0 && (
            <div className="mt-16 text-center text-[#949ba4]">
              <div className="mb-2 text-4xl">👋</div>
              <p>
                This is the beginning of <span className="font-semibold text-white">#{group.name}</span>.
                Say something!
              </p>
            </div>
          )}
          {messages.map((m, i) => {
            const prev = messages[i - 1];
            const newDay = !prev || dayKey(prev.created_at) !== dayKey(m.created_at);
            const compact =
              !newDay &&
              prev.sender === m.sender &&
              new Date(m.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000;
            const member = memberById(m.sender);
            return (
              <div key={m.id}>
                {newDay && (
                  <div className="my-4 flex items-center gap-3 text-xs text-[#949ba4]">
                    <div className="h-px flex-1 bg-[#3f4147]" />
                    {new Date(m.created_at).toLocaleDateString(undefined, {
                      weekday: "long",
                      month: "long",
                      day: "numeric",
                    })}
                    <div className="h-px flex-1 bg-[#3f4147]" />
                  </div>
                )}
                <MessageRow
                  message={m}
                  compact={compact}
                  avatarUrl={m.sender === "user" ? null : (member?.avatar_url ?? null)}
                />
              </div>
            );
          })}

          {/* simulated typing / live streaming bubbles */}
          {Object.entries(pending).map(([cid, p]) => (
            <div key={cid} className="mt-3 flex gap-3">
              <Avatar name={p.name} url={memberById(cid)?.avatar_url} seed={cid} size={40} />
              <div className="min-w-0">
                <div className="mb-0.5 flex items-baseline gap-2">
                  <span className="text-sm font-semibold text-white">{p.name}</span>
                  <span className="text-xs text-[#949ba4]">
                    {p.text ? "typing" : "is typing"}
                    <span className="typing-dot">.</span>
                    <span className="typing-dot">.</span>
                    <span className="typing-dot">.</span>
                  </span>
                </div>
                {p.text && (
                  <p className="text-sm whitespace-pre-wrap text-[#b5bac1] italic">{p.text}</p>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        <Composer groupName={group.name} onSend={send} onError={showToast} />

        {toast && (
          <div className="absolute bottom-20 left-1/2 z-40 -translate-x-1/2 rounded bg-[#da373c] px-4 py-2 text-sm text-white shadow-lg">
            {toast}
          </div>
        )}
      </div>

      <MemberList members={group.members} onEdit={onEditCharacter} onToggleFriend={onToggleFriend} />
    </div>
  );
}

function MessageRow({
  message: m,
  compact,
  avatarUrl,
}: {
  message: Message;
  compact: boolean;
  avatarUrl: string | null;
}) {
  const time = new Date(m.created_at).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
  });
  return (
    <div className={`group flex gap-3 px-1 hover:bg-[#2e3035] ${compact ? "py-0.5" : "mt-3 py-0.5"}`}>
      {compact ? (
        <div className="w-10 min-w-10 pt-1 text-right text-[10px] text-transparent select-none group-hover:text-[#949ba4]">
          {time}
        </div>
      ) : (
        <Avatar name={m.sender_name} url={avatarUrl} seed={m.sender} size={40} />
      )}
      <div className="min-w-0 flex-1">
        {!compact && (
          <div className="flex items-baseline gap-2">
            <span
              className={`text-sm font-semibold ${m.sender === "user" ? "text-[#5865f2]" : "text-white"}`}
            >
              {m.sender_name}
            </span>
            <span className="text-xs text-[#949ba4]">{time}</span>
          </div>
        )}
        {m.content && <p className="text-sm whitespace-pre-wrap text-[#dbdee1]">{m.content}</p>}
        {m.attachments.map((a) =>
          a.kind === "image" ? (
            <a key={a.id} href={a.url} target="_blank" rel="noreferrer">
              <img
                src={a.url}
                alt={a.original_name}
                className="mt-1 max-h-72 max-w-xs rounded-lg object-contain"
              />
            </a>
          ) : (
            <a
              key={a.id}
              href={a.url}
              target="_blank"
              rel="noreferrer"
              className="mt-1 inline-flex items-center gap-2 rounded border border-[#3f4147] bg-[#2b2d31] px-3 py-2 text-sm text-[#00a8fc] hover:underline"
            >
              📎 {a.original_name}
            </a>
          ),
        )}
      </div>
    </div>
  );
}
