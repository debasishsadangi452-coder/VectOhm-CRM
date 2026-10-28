import type { ChatChannel, ChatMessage, PersonRef } from "@/lib/api/types";

export type ChatKind = "group" | "personal" | "channel";

export const chatKind = (c: Pick<ChatChannel, "isDM" | "isGroup">): ChatKind =>
  c.isDM ? "personal" : c.isGroup ? "group" : "channel";

const fullName = (p: Pick<PersonRef, "firstName" | "lastName">) => `${p.firstName} ${p.lastName}`.trim();

/** The other person in a one-to-one chat. */
export function dmPartner(c: ChatChannel, myId: string | undefined): PersonRef | null {
  return (c.dmUserId1 === myId ? c.dmUser2 : c.dmUser1) ?? null;
}

/** What a chat is called in the list and header: the other person for a personal chat, otherwise its name. */
export function chatTitle(c: ChatChannel, myId: string | undefined): string {
  if (c.isDM) {
    const partner = dmPartner(c, myId);
    return partner ? fullName(partner) : "Colleague";
  }
  return c.name || (c.isGroup ? "Group" : "Channel");
}

/** The line under a chat's title in its header. */
export function chatSubtitle(c: ChatChannel, myId: string | undefined): string {
  if (c.isGroup) {
    const names = c.members.map((m) => (m.userId === myId ? "You" : m.user.firstName));
    const shown = names.slice(0, 6).join(", ");
    return names.length > 6 ? `${shown} +${names.length - 6} more` : shown;
  }
  if (c.isDM) return "Personal chat";
  return c.description || (c.department ? `${c.department.name} channel` : "Everyone");
}

/** The preview text under a chat's name in the list: "You: hi" / "Ravi: hi" / "hi". */
export function lastMessagePreview(c: ChatChannel, myId: string | undefined): string {
  const m = c.lastMessage;
  if (!m) return c.isGroup ? "Group created" : "No messages yet";
  const text = cleanContent(m.content).replace(/\s+/g, " ").trim();
  if (m.isSystem) return text;
  if (m.senderId === myId) return `You: ${text}`;
  return c.isDM ? text : `${m.sender.firstName}: ${text}`;
}

/** Messages from the bots (task updates and so on) carry decoration the chat doesn't show. */
export function cleanContent(content: string): string {
  return content
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/^📋\s*/gm, "")
    .replace(/^🔔\s*/gm, "")
    .replace(/^📌\s*/gm, "");
}

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
const DAY = 24 * 60 * 60 * 1000;

/** Chat list time: "14:05" today, "Yesterday", a weekday this week, otherwise the date. */
export function formatListTime(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const daysAgo = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  if (daysAgo <= 0) return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "2-digit", month: "2-digit", year: "2-digit" });
}

/** The centred label between days in a conversation. */
export function formatDayLabel(iso: string, now = new Date()): string {
  const d = new Date(iso);
  const daysAgo = Math.round((startOfDay(now) - startOfDay(d)) / DAY);
  if (daysAgo <= 0) return "Today";
  if (daysAgo === 1) return "Yesterday";
  if (daysAgo < 7) return d.toLocaleDateString([], { weekday: "long" });
  return d.toLocaleDateString([], { day: "numeric", month: "long", year: "numeric" });
}

export const dayKeyOfIso = (iso: string) => {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
};

export type MessageRow =
  | { type: "day"; key: string; label: string }
  | { type: "system"; key: string; message: ChatMessage }
  | {
      type: "message";
      key: string;
      message: ChatMessage;
      /** First bubble of a run by the same sender: shows the name (in groups) and a bubble tail. */
      startsRun: boolean;
    };

/** Flattens messages into day separators, centred system lines and bubbles grouped into runs by sender. */
export function buildMessageRows(messages: ChatMessage[], now = new Date()): MessageRow[] {
  const rows: MessageRow[] = [];
  let lastDay = "";
  let lastSender = "";
  for (const m of messages) {
    const day = dayKeyOfIso(m.createdAt);
    if (day !== lastDay) {
      rows.push({ type: "day", key: `day-${day}`, label: formatDayLabel(m.createdAt, now) });
      lastDay = day;
      lastSender = "";
    }
    if (m.isSystem) {
      rows.push({ type: "system", key: m.id, message: m });
      lastSender = "";
      continue;
    }
    rows.push({ type: "message", key: m.id, message: m, startsRun: m.senderId !== lastSender });
    lastSender = m.senderId;
  }
  return rows;
}

// A small fixed palette so the same person keeps the same colour for their name in a group.
const NAME_COLORS = [
  "text-emerald-500",
  "text-sky-500",
  "text-violet-500",
  "text-rose-500",
  "text-amber-500",
  "text-teal-500",
  "text-fuchsia-500",
  "text-orange-500",
];
export function nameColor(id: string): string {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return NAME_COLORS[h % NAME_COLORS.length];
}

export function chatInitials(name: string): string {
  const parts = name.replace(/[#]/g, "").trim().split(/[\s-]+/).filter(Boolean);
  return ((parts[0]?.[0] ?? "?") + (parts[1]?.[0] ?? "")).toUpperCase();
}
