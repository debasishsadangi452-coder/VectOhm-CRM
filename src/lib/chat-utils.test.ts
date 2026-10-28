import { describe, expect, it } from "vitest";
import {
  buildMessageRows,
  chatInitials,
  chatKind,
  chatSubtitle,
  chatTitle,
  formatDayLabel,
  formatListTime,
  lastMessagePreview,
  nameColor,
} from "./chat-utils";
import type { ChatChannel, ChatMessage } from "@/lib/api/types";

const person = (id: string, firstName = id.toUpperCase()) => ({ id, firstName, lastName: "Person", avatarUrl: null });

const channel = (over: Partial<ChatChannel> = {}): ChatChannel =>
  ({
    id: "c1",
    name: null,
    description: null,
    isDM: false,
    isGroup: false,
    createdById: null,
    members: [],
    departmentId: null,
    dmUserId1: null,
    dmUserId2: null,
    dmUser1: null,
    dmUser2: null,
    department: null,
    createdAt: "2026-10-20T10:00:00Z",
    updatedAt: "2026-10-20T10:00:00Z",
    ...over,
  }) as ChatChannel;

const msg = (id: string, senderId: string, createdAt: string, over: Partial<ChatMessage> = {}): ChatMessage =>
  ({
    id,
    content: id,
    channelId: "c1",
    senderId,
    sender: person(senderId),
    pinnedAt: null,
    isSystem: false,
    createdAt,
    updatedAt: createdAt,
    ...over,
  }) as ChatMessage;

describe("chat kinds and titles", () => {
  it("tells personal chats, groups and channels apart", () => {
    expect(chatKind({ isDM: true, isGroup: false })).toBe("personal");
    expect(chatKind({ isDM: false, isGroup: true })).toBe("group");
    expect(chatKind({ isDM: false, isGroup: false })).toBe("channel");
  });

  it("names a personal chat after the other person and a group after itself", () => {
    const dm = channel({ isDM: true, dmUserId1: "me", dmUserId2: "ravi", dmUser1: person("me"), dmUser2: person("ravi", "Ravi") });
    expect(chatTitle(dm, "me")).toBe("Ravi Person");
    expect(chatTitle(dm, "ravi")).toBe("ME Person");
    expect(chatTitle(channel({ isGroup: true, name: "Night crew" }), "me")).toBe("Night crew");
  });

  it("lists group members in the subtitle, with you first-person and a cap", () => {
    const members = ["me", "a", "b", "c", "d", "e", "f", "g"].map((id) => ({
      userId: id,
      isAdmin: false,
      joinedAt: "",
      user: person(id, id.toUpperCase()),
    }));
    expect(chatSubtitle(channel({ isGroup: true, members: members.slice(0, 3) }), "me")).toBe("You, A, B");
    expect(chatSubtitle(channel({ isGroup: true, members }), "me")).toBe("You, A, B, C, D, E +2 more");
  });
});

describe("last message preview", () => {
  const last = (over = {}) => ({
    id: "m",
    content: "see you at 6",
    createdAt: "2026-10-20T10:00:00Z",
    senderId: "a",
    isSystem: false,
    sender: person("a", "Asha"),
    ...over,
  });

  it("prefixes who said it, except in a personal chat", () => {
    expect(lastMessagePreview(channel({ isGroup: true, lastMessage: last() }), "me")).toBe("Asha: see you at 6");
    expect(lastMessagePreview(channel({ isDM: true, lastMessage: last() }), "me")).toBe("see you at 6");
    expect(lastMessagePreview(channel({ isGroup: true, lastMessage: last({ senderId: "me" }) }), "me")).toBe("You: see you at 6");
  });

  it("shows system lines as they are and handles an empty chat", () => {
    expect(lastMessagePreview(channel({ isGroup: true, lastMessage: last({ isSystem: true, content: "Asha left" }) }), "me")).toBe("Asha left");
    expect(lastMessagePreview(channel({ isGroup: true }), "me")).toBe("Group created");
    expect(lastMessagePreview(channel({ isDM: true }), "me")).toBe("No messages yet");
  });
});

describe("times", () => {
  const now = new Date(2026, 9, 26, 15, 0);
  it("shows the time today, 'Yesterday', a weekday, then a date", () => {
    expect(formatListTime(new Date(2026, 9, 26, 9, 5).toISOString(), now)).toMatch(/09:05|9:05/);
    expect(formatListTime(new Date(2026, 9, 25, 23, 0).toISOString(), now)).toBe("Yesterday");
    expect(formatListTime(new Date(2026, 9, 22, 10, 0).toISOString(), now)).not.toMatch(/\d/);
    expect(formatListTime(new Date(2026, 8, 1, 10, 0).toISOString(), now)).toMatch(/\d/);
  });

  it("labels days in a conversation", () => {
    expect(formatDayLabel(new Date(2026, 9, 26, 1, 0).toISOString(), now)).toBe("Today");
    expect(formatDayLabel(new Date(2026, 9, 25, 1, 0).toISOString(), now)).toBe("Yesterday");
  });
});

describe("buildMessageRows", () => {
  const now = new Date(2026, 9, 26, 15, 0);
  it("adds day separators, centres system lines and groups bubbles into runs", () => {
    const rows = buildMessageRows(
      [
        msg("1", "a", new Date(2026, 9, 25, 20, 0).toISOString()),
        msg("2", "a", new Date(2026, 9, 25, 20, 1).toISOString()),
        msg("3", "b", new Date(2026, 9, 25, 20, 2).toISOString()),
        msg("sys", "a", new Date(2026, 9, 26, 9, 0).toISOString(), { isSystem: true }),
        msg("4", "b", new Date(2026, 9, 26, 9, 5).toISOString()),
      ],
      now,
    );
    expect(rows.map((r) => r.type)).toEqual(["day", "message", "message", "message", "day", "system", "message"]);
    const runs = rows.filter((r) => r.type === "message").map((r) => (r.type === "message" ? r.startsRun : null));
    expect(runs).toEqual([true, false, true, true]); // b's bubble after a day change starts a new run
  });
});

describe("small helpers", () => {
  it("gives the same person the same colour every time", () => {
    expect(nameColor("user-1")).toBe(nameColor("user-1"));
  });
  it("makes initials from a chat name", () => {
    expect(chatInitials("Night shift crew")).toBe("NS");
    expect(chatInitials("general")).toBe("G");
    expect(chatInitials("#sales-team")).toBe("ST");
  });
});
