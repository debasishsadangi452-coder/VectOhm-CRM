import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  Hash,
  Info,
  Loader2,
  Lock,
  MessagesSquare,
  Pin,
  Plus,
  Search,
  Send,
  UserPlus,
  Users,
} from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useUsers } from "@/hooks/use-users";
import { useDepartments } from "@/hooks/use-departments";
import {
  useChannels,
  useMessages,
  useCreateChannel,
  useOpenDM,
  useSendMessage,
  useTogglePinMessage,
  useMarkChannelRead,
} from "@/hooks/use-chat";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { NewGroupDialog } from "@/components/chat/new-group-dialog";
import { GroupInfoDialog } from "@/components/chat/group-info-dialog";
import type { ChatChannel } from "@/lib/api/types";
import {
  buildMessageRows,
  chatInitials,
  chatKind,
  chatSubtitle,
  chatTitle,
  cleanContent,
  dmPartner,
  formatListTime,
  lastMessagePreview,
  nameColor,
  type ChatKind,
} from "@/lib/chat-utils";
import { getInitials } from "@/lib/utils";

export const Route = createFileRoute("/_app/chat")({
  component: ChatPage,
});

type Filter = "all" | "unread" | ChatKind;

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unread", label: "Unread" },
  { id: "personal", label: "Personal" },
  { id: "group", label: "Groups" },
  { id: "channel", label: "Channels" },
];

// The round picture for a chat in the list and header: a person's initials, a group icon, or a channel glyph.
function ChatAvatar({ chat, myId, size = "size-12" }: { chat: ChatChannel; myId: string | undefined; size?: string }) {
  const kind = chatKind(chat);
  if (kind === "personal") {
    const partner = dmPartner(chat, myId);
    return (
      <Avatar className={`${size} shrink-0 bg-primary/15`}>
        <AvatarFallback className="text-sm font-semibold text-primary">
          {partner ? getInitials(partner) : "?"}
        </AvatarFallback>
      </Avatar>
    );
  }
  const Icon = kind === "group" ? Users : chat.departmentId ? Lock : Hash;
  return (
    <Avatar className={`${size} shrink-0 ${kind === "group" ? "bg-emerald-500/15" : "bg-sky-500/15"}`}>
      <AvatarFallback className={kind === "group" ? "text-emerald-600" : "text-sky-600"}>
        {chat.name ? (
          <span className="text-sm font-semibold">{chatInitials(chat.name)}</span>
        ) : (
          <Icon className="size-5" />
        )}
      </AvatarFallback>
    </Avatar>
  );
}

function ChatPage() {
  const currentUser = useAuthStore((s) => s.user);
  const myId = currentUser?.id;
  const { data: channels } = useChannels();
  const { data: users } = useUsers();
  const { data: departments } = useDepartments();

  const [activeChannelId, setActiveChannelId] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [colleagueSearch, setColleagueSearch] = useState("");
  const [mentions, setMentions] = useState<Map<string, string>>(new Map());
  const inputRef = useRef<HTMLInputElement>(null);

  // List filters, and in-chat search / pinned filter
  const [listSearch, setListSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [chatSearch, setChatSearch] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [showPinnedOnly, setShowPinnedOnly] = useState(false);

  // Dialog states
  const [newChannelOpen, setNewChannelOpen] = useState(false);
  const [newDMOpen, setNewDMOpen] = useState(false);
  const [newGroupOpen, setNewGroupOpen] = useState(false);
  const [groupInfoOpen, setGroupInfoOpen] = useState(false);

  // New channel form state
  const [channelName, setChannelName] = useState("");
  const [channelDescription, setChannelDescription] = useState("");
  const [channelDeptId, setChannelDeptId] = useState<string>("public");

  // Mutations
  const createChannel = useCreateChannel();
  const openDM = useOpenDM();
  const sendMessage = useSendMessage();
  const togglePinMessage = useTogglePinMessage();
  const markChannelRead = useMarkChannelRead();

  const activeChannel = useMemo(
    () => channels?.find((c) => c.id === activeChannelId) || null,
    [channels, activeChannelId],
  );
  const activeKind = activeChannel ? chatKind(activeChannel) : null;

  const { data: messages } = useMessages(activeChannelId || undefined, chatSearch || undefined);

  // Mark the chat read whenever it becomes active, and again when new messages arrive while it is open
  // -- this is what makes the unread badges (here and in the sidebar) actually decrease.
  const activeUnread = activeChannel?.unreadCount ?? 0;
  useEffect(() => {
    if (activeChannelId) markChannelRead.mutate(activeChannelId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannelId, activeUnread]);

  // A chat that disappears (left a group, removed) stops being the open one.
  useEffect(() => {
    if (activeChannelId && channels && !channels.some((c) => c.id === activeChannelId)) {
      setActiveChannelId(null);
    }
  }, [channels, activeChannelId]);

  // The list: newest activity first, narrowed by the filter chips and the search box.
  const visibleChats = useMemo(() => {
    const q = listSearch.trim().toLowerCase();
    const when = (c: ChatChannel) => Date.parse(c.lastMessage?.createdAt ?? c.updatedAt);
    return (channels ?? [])
      .filter((c) => {
        if (filter === "unread") return (c.unreadCount ?? 0) > 0;
        if (filter !== "all") return chatKind(c) === filter;
        return true;
      })
      .filter((c) => !q || chatTitle(c, myId).toLowerCase().includes(q))
      .sort((a, b) => when(b) - when(a));
  }, [channels, filter, listSearch, myId]);

  const displayedMessages = useMemo(
    () => (messages ?? []).filter((m) => !showPinnedOnly || m.pinnedAt != null),
    [messages, showPinnedOnly],
  );
  const rows = useMemo(() => buildMessageRows(displayedMessages), [displayedMessages]);

  // Keep the newest message in view
  const bottomRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [rows.length, activeChannelId]);

  // Reset the in-chat filters when switching chats
  useEffect(() => {
    setChatSearch("");
    setSearchOpen(false);
    setShowPinnedOnly(false);
    setMentions(new Map());
  }, [activeChannelId]);

  const handleTogglePin = async (messageId: string) => {
    try {
      await togglePinMessage.mutateAsync(messageId);
    } catch (err) {
      console.error("Failed to toggle pin", err);
    }
  };

  // Colleagues for a new personal chat: everyone but me, narrowed by the search box
  const eligibleColleagues = useMemo(() => {
    if (!users || !currentUser) return [];
    return users.filter(
      (u) =>
        u.isActive &&
        u.id !== currentUser.id &&
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(colleagueSearch.toLowerCase()),
    );
  }, [users, currentUser, colleagueSearch]);

  // Submit new public/dept channel
  const handleCreateChannel = async (e: FormEvent) => {
    e.preventDefault();
    if (!channelName.trim()) return;

    try {
      const formattedName = channelName.trim().toLowerCase().replace(/\s+/g, "-");
      const result = await createChannel.mutateAsync({
        name: formattedName,
        description: channelDescription.trim() || undefined,
        departmentId: channelDeptId === "public" ? undefined : channelDeptId,
      });
      setChannelName("");
      setChannelDescription("");
      setChannelDeptId("public");
      setNewChannelOpen(false);
      setActiveChannelId(result.id);
    } catch (err) {
      console.error("Failed to create channel", err);
    }
  };

  // Start new personal chat with a colleague
  const handleStartDM = async (recipientId: string) => {
    try {
      const result = await openDM.mutateAsync(recipientId);
      setColleagueSearch("");
      setNewDMOpen(false);
      setActiveChannelId(result.id);
    } catch (err) {
      console.error("Failed to open DM channel", err);
    }
  };

  // ─── @mentions ─────────────────────────────────────────────────────────────
  // Who can be mentioned here: a group's members, everyone for a channel, nobody in a one-to-one chat.
  const mentionable = useMemo(() => {
    if (!activeChannel || !users || activeKind === "personal") return [];
    const memberIds = activeKind === "group" ? new Set(activeChannel.members?.map((m) => m.userId)) : null;
    return users.filter((u) => u.isActive && u.id !== myId && (!memberIds || memberIds.has(u.id)));
  }, [activeChannel, activeKind, users, myId]);

  const mentionMatch = /(^|\s)@([^\s@]*)$/.exec(messageText);
  const mentionOptions = mentionMatch
    ? mentionable
        .filter((u) => `${u.firstName} ${u.lastName}`.toLowerCase().includes(mentionMatch[2].toLowerCase()))
        .slice(0, 6)
    : [];

  const pickMention = (u: { id: string; firstName: string; lastName: string }) => {
    const label = `@${u.firstName} ${u.lastName}`;
    setMessageText((t) => t.replace(/(^|\s)@([^\s@]*)$/, (_m, lead: string) => `${lead}${label} `));
    setMentions((prev) => new Map(prev).set(u.id, label));
    inputRef.current?.focus();
  };

  // Highlights "@First Last" for people in the team wherever it appears in a message.
  const mentionRegex = useMemo(() => {
    const names = (users ?? []).map((u) => `${u.firstName} ${u.lastName}`.trim()).filter(Boolean);
    if (names.length === 0) return null;
    const escaped = names.sort((a, b) => b.length - a.length).map((n) => n.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp(`(@(?:${escaped.join("|")}))`, "g");
  }, [users]);

  const renderContent = (text: string, own: boolean) => {
    if (!mentionRegex) return text;
    return text.split(mentionRegex).map((part, i) =>
      i % 2 === 1 ? (
        <span key={i} className={`rounded px-0.5 font-semibold ${own ? "bg-white/25" : "bg-primary/15 text-primary"}`}>
          {part}
        </span>
      ) : (
        part
      ),
    );
  };

  const handleSendMessage = async (e: FormEvent) => {
    e.preventDefault();
    if (!messageText.trim() || !activeChannelId) return;

    const content = messageText.trim();
    const mentionIds = [...mentions].filter(([, label]) => content.includes(label)).map(([id]) => id);
    setMessageText("");
    setMentions(new Map());

    try {
      await sendMessage.mutateAsync({ channelId: activeChannelId, content, mentionIds });
    } catch (err) {
      console.error("Failed to send message", err);
    }
  };

  const showName = activeKind !== "personal"; // names above other people's bubbles in groups and channels

  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden bg-background">
      {/* LEFT: chat list */}
      <div
        className={`${activeChannelId ? "hidden md:flex" : "flex"} w-full shrink-0 select-none flex-col border-r border-border-subtle bg-panel md:w-80`}
      >
        <div className="flex items-center justify-between px-4 pb-2 pt-4">
          <span className="text-lg font-semibold tracking-tight">Chats</span>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button size="sm" className="h-8 gap-1.5">
                <Plus className="size-4" /> New
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuItem onClick={() => setNewGroupOpen(true)} className="gap-2">
                <Users className="size-4" /> New group
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNewDMOpen(true)} className="gap-2">
                <UserPlus className="size-4" /> New personal chat
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setNewChannelOpen(true)} className="gap-2">
                <Hash className="size-4" /> New channel
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="px-3 pb-2">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 size-4 text-text-dim" />
            <Input
              value={listSearch}
              onChange={(e) => setListSearch(e.target.value)}
              placeholder="Search chats"
              className="h-9 rounded-full bg-background pl-9 text-xs"
            />
          </div>
        </div>

        <div className="flex gap-1.5 overflow-x-auto px-3 pb-2">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`shrink-0 rounded-full px-3 py-1 text-[11px] font-medium transition-colors ${
                filter === f.id
                  ? "bg-primary/15 text-primary"
                  : "bg-background text-text-dim hover:text-text"
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <ScrollArea className="flex-1">
          {visibleChats.length === 0 ? (
            <p className="px-6 py-12 text-center text-xs text-text-dim">
              {channels && channels.length > 0 ? "No chats match." : "No chats yet. Start one with New."}
            </p>
          ) : (
            visibleChats.map((c) => {
              const active = c.id === activeChannelId;
              const unread = c.unreadCount ?? 0;
              const when = c.lastMessage?.createdAt ?? null;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveChannelId(c.id)}
                  className={`flex w-full items-center gap-3 border-b border-border-subtle/50 px-3 py-2.5 text-left transition-colors ${
                    active ? "bg-primary/10" : "hover:bg-panel-elevated"
                  }`}
                >
                  <ChatAvatar chat={c} myId={myId} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{chatTitle(c, myId)}</span>
                      {when && (
                        <span className={`shrink-0 text-[10px] ${unread > 0 ? "font-semibold text-emerald-500" : "text-text-dim"}`}>
                          {formatListTime(when)}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate text-xs text-text-dim">{lastMessagePreview(c, myId)}</span>
                      {unread > 0 && !active && (
                        <span className="flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 px-1.5 text-[10px] font-bold text-white">
                          {unread > 99 ? "99+" : unread}
                        </span>
                      )}
                    </div>
                  </div>
                </button>
              );
            })
          )}
        </ScrollArea>
      </div>

      {/* RIGHT: conversation */}
      {activeChannel ? (
        <div className={`${activeChannelId ? "flex" : "hidden md:flex"} min-w-0 flex-1 flex-col bg-background`}>
          <div className="flex h-16 shrink-0 select-none items-center gap-3 border-b border-border-subtle bg-panel px-3 md:px-5">
            <Button variant="ghost" size="icon" className="size-8 md:hidden" onClick={() => setActiveChannelId(null)}>
              <ArrowLeft className="size-4" />
            </Button>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-3 text-left"
              onClick={() => activeKind === "group" && setGroupInfoOpen(true)}
              disabled={activeKind !== "group"}
            >
              <ChatAvatar chat={activeChannel} myId={myId} size="size-10" />
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold">{chatTitle(activeChannel, myId)}</div>
                <div className="truncate text-[11px] text-text-dim">{chatSubtitle(activeChannel, myId)}</div>
              </div>
            </button>

            <div className="flex items-center gap-1.5">
              {searchOpen ? (
                <Input
                  value={chatSearch}
                  onChange={(e) => setChatSearch(e.target.value)}
                  placeholder="Search messages…"
                  className="h-8 w-40 bg-background text-xs md:w-56"
                  autoFocus
                />
              ) : null}
              <Button
                variant="ghost"
                size="icon"
                className="size-8"
                title="Search messages"
                onClick={() => {
                  setSearchOpen((v) => !v);
                  if (searchOpen) setChatSearch("");
                }}
              >
                <Search className="size-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className={`size-8 ${showPinnedOnly ? "bg-amber-500/10 text-amber-500" : ""}`}
                title={showPinnedOnly ? "Show all messages" : "Show pinned messages only"}
                onClick={() => setShowPinnedOnly((v) => !v)}
              >
                <Pin className="size-4" />
              </Button>
              {activeKind === "group" && (
                <Button variant="ghost" size="icon" className="size-8" title="Group info" onClick={() => setGroupInfoOpen(true)}>
                  <Info className="size-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Messages */}
          <ScrollArea className="flex-1 bg-panel-elevated/40">
            <div className="mx-auto max-w-3xl space-y-1 px-3 py-4 md:px-6">
              {rows.length === 0 ? (
                <div className="flex flex-col items-center justify-center space-y-2 py-20 text-center">
                  <MessagesSquare className="size-8 text-primary/30" />
                  <p className="text-xs font-semibold text-text-dim">
                    {showPinnedOnly ? "No pinned messages" : chatSearch ? "No messages match" : "No messages yet"}
                  </p>
                  {!showPinnedOnly && !chatSearch && (
                    <p className="max-w-[250px] text-[10px] text-text-dim">Send a message to start the conversation.</p>
                  )}
                </div>
              ) : (
                rows.map((row) => {
                  if (row.type === "day") {
                    return (
                      <div key={row.key} className="flex justify-center py-2">
                        <span className="rounded-lg bg-panel px-3 py-1 text-[11px] font-medium text-text-dim shadow-sm">
                          {row.label}
                        </span>
                      </div>
                    );
                  }
                  if (row.type === "system") {
                    return (
                      <div key={row.key} className="flex justify-center py-1">
                        <span className="max-w-[85%] rounded-lg bg-panel/80 px-3 py-1 text-center text-[11px] text-text-dim">
                          {cleanContent(row.message.content)}
                        </span>
                      </div>
                    );
                  }
                  const m = row.message;
                  const own = m.senderId === myId;
                  return (
                    <div key={row.key} className={`group flex ${own ? "justify-end" : "justify-start"} ${row.startsRun ? "pt-2" : ""}`}>
                      <div
                        className={`relative max-w-[82%] rounded-2xl px-3 py-1.5 text-sm shadow-sm md:max-w-[70%] ${
                          own
                            ? `bg-primary text-primary-foreground ${row.startsRun ? "rounded-tr-sm" : ""}`
                            : `border border-border-subtle bg-panel text-text ${row.startsRun ? "rounded-tl-sm" : ""}`
                        }`}
                      >
                        {showName && !own && row.startsRun && (
                          <div className={`mb-0.5 text-xs font-semibold ${nameColor(m.senderId)}`}>
                            {m.sender.firstName} {m.sender.lastName}
                          </div>
                        )}
                        <div className="whitespace-pre-wrap break-words leading-relaxed">{renderContent(cleanContent(m.content), own)}</div>
                        <div className={`mt-0.5 flex items-center justify-end gap-1 text-[10px] ${own ? "text-primary-foreground/70" : "text-text-dim"}`}>
                          {m.pinnedAt && <Pin className="size-3 fill-amber-500 text-amber-500" aria-label="Pinned message" />}
                          {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </div>
                        <button
                          type="button"
                          onClick={() => handleTogglePin(m.id)}
                          className={`absolute top-1 ${own ? "-left-7" : "-right-7"} rounded p-1 opacity-0 transition-opacity hover:bg-panel group-hover:opacity-100 ${
                            m.pinnedAt ? "text-amber-500 opacity-100" : "text-text-dim hover:text-amber-500"
                          }`}
                          title={m.pinnedAt ? "Unpin message" : "Pin message"}
                        >
                          <Pin className="size-3.5" />
                        </button>
                      </div>
                    </div>
                  );
                })
              )}
              <div ref={bottomRef} />
            </div>
          </ScrollArea>

          <form onSubmit={handleSendMessage} className="relative flex items-center gap-2 border-t border-border-subtle bg-panel p-3">
            {mentionOptions.length > 0 && (
              <div className="absolute bottom-full left-3 z-10 mb-1 w-72 overflow-hidden rounded-lg border border-border-subtle bg-panel shadow-lg">
                <div className="px-3 py-1.5 text-[10px] font-medium uppercase tracking-wide text-text-dim">
                  Mention someone — they get a notification
                </div>
                {mentionOptions.map((u) => (
                  <button
                    key={u.id}
                    type="button"
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={() => pickMention(u)}
                    className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm hover:bg-panel-elevated"
                  >
                    <Avatar className="size-6 bg-primary/10">
                      <AvatarFallback className="text-[10px]">{getInitials(u)}</AvatarFallback>
                    </Avatar>
                    {u.firstName} {u.lastName}
                  </button>
                ))}
              </div>
            )}
            {mentionable.length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="size-10 shrink-0 rounded-full text-lg font-semibold text-text-dim"
                title="Mention someone"
                onClick={() => {
                  setMessageText((t) => (t && !/\s$/.test(t) ? `${t} @` : `${t}@`));
                  inputRef.current?.focus();
                }}
              >
                @
              </Button>
            )}
            <Input
              ref={inputRef}
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              placeholder={`Message ${chatTitle(activeChannel, myId)}`}
              className="h-10 flex-1 rounded-full bg-background px-4 text-sm"
              autoFocus
            />
            <Button type="submit" size="icon" disabled={!messageText.trim()} className="size-10 shrink-0 rounded-full">
              <Send className="size-4" />
            </Button>
          </form>
        </div>
      ) : (
        <div className="hidden flex-1 flex-col items-center justify-center bg-background text-center md:flex">
          <MessagesSquare className="size-12 text-primary/20" />
          <h2 className="mt-4 text-sm font-semibold text-text">Team Chat</h2>
          <p className="mt-1.5 max-w-sm text-xs text-text-dim">
            Pick a chat on the left, or start a new group or personal chat with anyone on the team.
          </p>
          <div className="mt-4 flex gap-2">
            <Button size="sm" onClick={() => setNewGroupOpen(true)} className="gap-1.5">
              <Users className="size-4" /> New group
            </Button>
            <Button size="sm" variant="outline" onClick={() => setNewDMOpen(true)} className="gap-1.5">
              <UserPlus className="size-4" /> New personal chat
            </Button>
          </div>
        </div>
      )}

      {/* DIALOG: New group */}
      <NewGroupDialog
        open={newGroupOpen}
        onOpenChange={setNewGroupOpen}
        users={users ?? []}
        currentUserId={myId}
        onCreated={(id) => setActiveChannelId(id)}
      />

      {/* DIALOG: Group info */}
      <GroupInfoDialog
        group={groupInfoOpen && activeChannel?.isGroup ? activeChannel : null}
        onOpenChange={setGroupInfoOpen}
        users={users ?? []}
        currentUserId={myId}
        onLeft={() => setActiveChannelId(null)}
      />

      {/* DIALOG: Create Channel */}
      <Dialog open={newChannelOpen} onOpenChange={setNewChannelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Create Chat Channel</DialogTitle>
            <DialogDescription className="text-xs text-text-dim">
              Create a new channel for team collaboration or announcements. For a private chat with chosen people, use
              New group instead.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleCreateChannel} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="chan-name">Channel Name</Label>
              <Input
                id="chan-name"
                value={channelName}
                onChange={(e) => setChannelName(e.target.value)}
                placeholder="e.g. general-chatter"
                required
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="chan-description">Description (optional)</Label>
              <Input
                id="chan-description"
                value={channelDescription}
                onChange={(e) => setChannelDescription(e.target.value)}
                placeholder="e.g. Quick team syncing & announcements"
              />
            </div>
            <div className="space-y-1.5">
              <Label>Department Scope</Label>
              <Select value={channelDeptId} onValueChange={setChannelDeptId}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="public">Public (All Departments)</SelectItem>
                  {currentUser?.role.name === "ADMIN"
                    ? departments?.map((d) => (
                        <SelectItem key={d.id} value={d.id}>
                          Only {d.name} members
                        </SelectItem>
                      ))
                    : currentUser?.department && (
                        <SelectItem value={currentUser.department.id}>Only {currentUser.department.name} members</SelectItem>
                      )}
                </SelectContent>
              </Select>
              <p className="text-[10px] text-text-dim">
                Restricting to a department makes the channel visible only to employees within that department.
              </p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setNewChannelOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={createChannel.isPending}>
                {createChannel.isPending && <Loader2 className="mr-1.5 size-4 animate-spin" />}
                Create Channel
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* DIALOG: New personal chat */}
      <Dialog open={newDMOpen} onOpenChange={setNewDMOpen}>
        <DialogContent className="flex h-[420px] flex-col sm:max-w-md">
          <DialogHeader>
            <DialogTitle>New personal chat</DialogTitle>
            <DialogDescription className="text-xs text-text-dim">Start a one-to-one chat with a colleague.</DialogDescription>
          </DialogHeader>
          <div className="relative my-2 shrink-0">
            <Search className="absolute left-2.5 top-2.5 size-4 text-text-dim" />
            <Input
              value={colleagueSearch}
              onChange={(e) => setColleagueSearch(e.target.value)}
              placeholder="Search colleague by name..."
              className="pl-9 text-xs"
              autoFocus
            />
          </div>
          <ScrollArea className="flex-1 rounded-lg border border-border-subtle bg-panel-elevated p-2">
            <div className="space-y-1">
              {eligibleColleagues.length > 0 ? (
                eligibleColleagues.map((u) => (
                  <button
                    key={u.id}
                    onClick={() => handleStartDM(u.id)}
                    className="flex w-full items-center justify-between rounded-lg p-2 text-left text-xs font-medium transition-all hover:bg-panel hover:text-primary"
                  >
                    <div className="flex items-center gap-2">
                      <Avatar className="size-7 bg-primary/10">
                        <AvatarFallback className="text-[10px]">{getInitials(u)}</AvatarFallback>
                      </Avatar>
                      <span>
                        {u.firstName} {u.lastName}
                      </span>
                    </div>
                    {u.department && (
                      <span className="rounded bg-panel px-1.5 py-0.5 text-[8px] text-text-dim">{u.department.name}</span>
                    )}
                  </button>
                ))
              ) : (
                <div className="py-8 text-center text-xs text-text-dim">No other colleagues found matching query.</div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}
