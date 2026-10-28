import { useState } from "react";
import {
  Activity,
  Loader2,
  Phone,
  StickyNote,
  Trash2,
  Users,
  Info,
  Mail,
  ArrowDownLeft,
  ArrowUpRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useActivities, useCreateActivity, useDeleteActivity } from "@/hooks/use-activities";
import { useContacts } from "@/hooks/use-contacts";
import { useSyncedEmails } from "@/hooks/use-synced-emails";
import { useEngagementEvents } from "@/hooks/use-engagement";
import { useAuthStore } from "@/stores/auth-store";
import { ACTIVITY_TYPES, ACTIVITY_TYPE_LABELS, type ActivityType } from "@/lib/api/types";

const ACTIVITY_TYPE_ICON: Record<ActivityType, typeof Phone> = {
  CALL: Phone,
  MEETING: Users,
  NOTE: StickyNote,
  SYSTEM: Info,
};

const ACTIVITY_TYPE_TONE: Record<ActivityType, string> = {
  CALL: "text-info",
  MEETING: "text-violet",
  NOTE: "text-text-dim",
  SYSTEM: "text-amber-500",
};

const NO_CONTACT = "__none__";

// Suggested dispositions offered as a datalist rather than a fixed enum --
// teams word these differently, and the column stays free text on the server.
const OUTCOME_SUGGESTIONS = [
  "Connected",
  "No answer",
  "Left voicemail",
  "Meeting booked",
  "Demo scheduled",
  "Follow-up needed",
  "Not interested",
  "Wrong contact",
];

// Date and time are separate columns so the log scans like a spreadsheet --
// a run of entries on the same day lines up instead of every row repeating
// the date at a different width.
function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function formatDuration(minutes: number | null): string {
  if (minutes === null || minutes <= 0) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

interface DealActivityTimelineProps {
  dealId: string;
  // SyncedEmail.dealId is deliberately never set by EmailSyncEngineService
  // (matching an inbound/outbound address to a Contact is reliable; guessing
  // which of that Contact's several Deals it's "about" isn't) -- so this
  // component looks up synced mail by the deal's linked Contact instead.
  // Named distinctly from the "who you spoke to" contactId state below.
  dealContactId?: string | null;
}

export function DealActivityTimeline({ dealId, dealContactId }: DealActivityTimelineProps) {
  const currentUser = useAuthStore((s) => s.user);
  const { data: activities, isLoading } = useActivities(dealId);
  const { data: contacts } = useContacts();
  const { data: syncedEmails } = useSyncedEmails(
    { contactId: dealContactId ?? undefined },
    !!dealContactId,
  );
  const { data: engagementEvents } = useEngagementEvents({ dealId });
  const createActivity = useCreateActivity(dealId);
  const deleteActivity = useDeleteActivity(dealId);

  const [type, setType] = useState<ActivityType>("CALL");
  const [contactId, setContactId] = useState<string>(NO_CONTACT);
  const [outcome, setOutcome] = useState("");
  const [duration, setDuration] = useState("");
  const [content, setContent] = useState("");

  const isPrivileged = currentUser?.role.name === "ADMIN" || currentUser?.role.name === "MANAGER";
  // Notes and system rows have no counterparty or duration worth capturing.
  const isConversation = type === "CALL" || type === "MEETING";

  async function handleAdd() {
    if (!content.trim()) return;
    try {
      await createActivity.mutateAsync({
        dealId,
        type,
        content: content.trim(),
        contactId: contactId === NO_CONTACT ? null : contactId,
        outcome: isConversation ? outcome.trim() || null : null,
        durationMin: isConversation && duration ? Number(duration) : null,
      });
      setContent("");
      setOutcome("");
      setDuration("");
    } catch {
      // No inline error surfaced -- this is a lightweight log, not a form;
      // a failed add just leaves the inputs populated so the user can retry.
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteActivity.mutateAsync(id);
    } catch {
      // same as above
    }
  }

  const rowCount = activities?.length ?? 0;
  const headerCell =
    "border-b border-r border-border-subtle px-3 py-2 font-medium whitespace-nowrap";
  const bodyCell = "border-b border-r border-border-subtle px-3 py-2 align-top";

  return (
    <div className="space-y-3">
      <div className="flex items-baseline justify-between">
        <p className="text-sm font-medium">Activity log</p>
        {rowCount > 0 && (
          <p className="font-mono text-[11px] text-text-dim">
            {rowCount} {rowCount === 1 ? "entry" : "entries"}
          </p>
        )}
      </div>

      {/* Entry row -- laid out like the columns it writes into. */}
      <div className="rounded-lg border border-border-subtle bg-canvas/30 p-3">
        <div className="grid gap-2 lg:grid-cols-12">
          <div className="space-y-1 lg:col-span-2">
            <Label className="text-[10px] uppercase tracking-wide text-text-dim">Type</Label>
            <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ACTIVITY_TYPES.filter((t) => t !== "SYSTEM").map((t) => (
                  <SelectItem key={t} value={t}>
                    {ACTIVITY_TYPE_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 lg:col-span-3">
            <Label className="text-[10px] uppercase tracking-wide text-text-dim">
              Who you spoke to
            </Label>
            <Select value={contactId} onValueChange={setContactId}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={NO_CONTACT}>No contact</SelectItem>
                {contacts?.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.firstName} {c.lastName}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1 lg:col-span-5">
            <Label className="text-[10px] uppercase tracking-wide text-text-dim">
              What was discussed
            </Label>
            <Input
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Walked through pricing; they want a revised quote by Friday…"
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAdd();
                }
              }}
            />
          </div>

          <div className="space-y-1 lg:col-span-2">
            <Label className="text-[10px] uppercase tracking-wide text-text-dim">
              {isConversation ? "Outcome" : "—"}
            </Label>
            <Input
              value={outcome}
              onChange={(e) => setOutcome(e.target.value)}
              placeholder="Connected"
              list="activity-outcomes"
              disabled={!isConversation}
            />
            <datalist id="activity-outcomes">
              {OUTCOME_SUGGESTIONS.map((o) => (
                <option key={o} value={o} />
              ))}
            </datalist>
          </div>
        </div>

        <div className="mt-2 flex items-end justify-between gap-2">
          <div className="space-y-1">
            <Label className="text-[10px] uppercase tracking-wide text-text-dim">
              Duration (min)
            </Label>
            <Input
              type="number"
              min={0}
              max={1440}
              value={duration}
              onChange={(e) => setDuration(e.target.value)}
              placeholder="15"
              disabled={!isConversation}
              className="w-28"
            />
          </div>
          <Button
            type="button"
            onClick={handleAdd}
            disabled={createActivity.isPending || !content.trim()}
          >
            {createActivity.isPending ? <Loader2 className="size-4 animate-spin" /> : "Add entry"}
          </Button>
        </div>
      </div>

      {dealContactId && syncedEmails && syncedEmails.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Mail className="size-3.5 text-text-dim" />
            Synced emails with this contact
          </p>
          <div className="rounded-lg border border-border-subtle divide-y divide-border-subtle max-h-48 overflow-y-auto">
            {syncedEmails.map((email) => (
              <div key={email.id} className="flex items-start gap-2 px-3 py-2">
                {email.direction === "SENT" ? (
                  <ArrowUpRight className="size-3.5 mt-0.5 text-primary shrink-0" />
                ) : (
                  <ArrowDownLeft className="size-3.5 mt-0.5 text-cyan-400 shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{email.subject || "(no subject)"}</p>
                  <p className="text-[11px] text-text-dim truncate">{email.bodyPreview}</p>
                </div>
                <span className="text-[10px] text-text-dim whitespace-nowrap shrink-0">
                  {new Date(email.occurredAt).toLocaleDateString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {engagementEvents && engagementEvents.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-sm font-medium flex items-center gap-1.5">
            <Activity className="size-3.5 text-primary" />
            Engagement events for this deal
          </p>
          <div className="rounded-lg border border-border-subtle divide-y divide-border-subtle max-h-48 overflow-y-auto">
            {engagementEvents.map((evt) => (
              <div key={evt.id} className="flex items-center justify-between px-3 py-2">
                <div className="min-w-0 flex-1 pr-2">
                  <p className="text-xs font-medium truncate">{evt.type.replace(/_/g, " ")}</p>
                  <p className="text-[10px] text-text-dim">
                    {new Date(evt.occurredAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-[10px] px-1.5 py-0.5 rounded bg-primary/10 text-primary font-medium uppercase shrink-0">
                  {evt.type.split("_")[0]}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Spreadsheet-style log: fixed header, ruled columns, zebra rows. */}
      <div className="overflow-hidden rounded-lg border border-border-subtle">
        <div className="max-h-[32rem] overflow-auto">
          <table className="w-full min-w-[900px] border-collapse text-left">
            <thead className="sticky top-0 z-10 bg-panel-elevated">
              <tr className="text-[10px] uppercase tracking-wide text-text-dim">
                <th className={`${headerCell} w-24`}>Date</th>
                <th className={`${headerCell} w-16`}>Time</th>
                <th className={`${headerCell} w-24`}>Type</th>
                <th className={`${headerCell} w-40`}>Contact</th>
                <th className={headerCell}>What was discussed</th>
                <th className={`${headerCell} w-32`}>Outcome</th>
                <th className={`${headerCell} w-20`}>Duration</th>
                <th className={`${headerCell} w-28`}>Logged by</th>
                <th className="w-10 border-b border-border-subtle" />
              </tr>
            </thead>
            <tbody>
              {isLoading && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-xs text-text-dim">
                    Loading…
                  </td>
                </tr>
              )}
              {!isLoading && rowCount === 0 && (
                <tr>
                  <td colSpan={9} className="px-3 py-6 text-center text-xs text-text-dim">
                    No activity logged yet.
                  </td>
                </tr>
              )}
              {activities?.map((activity, i) => {
                const Icon = ACTIVITY_TYPE_ICON[activity.type];
                const canDelete =
                  activity.type !== "SYSTEM" &&
                  (isPrivileged || activity.creatorId === currentUser?.id);
                return (
                  <tr
                    key={activity.id}
                    className={`group ${i % 2 === 1 ? "bg-canvas/40" : ""} hover:bg-accent/30`}
                  >
                    <td
                      className={`${bodyCell} whitespace-nowrap font-mono text-[11px] text-text-dim`}
                    >
                      {formatDate(activity.occurredAt)}
                    </td>
                    <td
                      className={`${bodyCell} whitespace-nowrap font-mono text-[11px] text-text-dim`}
                    >
                      {formatTime(activity.occurredAt)}
                    </td>
                    <td className={`${bodyCell} whitespace-nowrap`}>
                      <span className="flex items-center gap-1.5">
                        <Icon
                          className={`size-3.5 shrink-0 ${ACTIVITY_TYPE_TONE[activity.type]}`}
                          strokeWidth={2}
                        />
                        <span className="text-xs">{ACTIVITY_TYPE_LABELS[activity.type]}</span>
                      </span>
                    </td>
                    <td className={`${bodyCell} text-xs`}>
                      {activity.contact ? (
                        <span className="block truncate">
                          {activity.contact.firstName} {activity.contact.lastName}
                        </span>
                      ) : (
                        <span className="text-text-dim">—</span>
                      )}
                    </td>
                    <td className={`${bodyCell} text-sm`}>
                      <span className="break-words">{activity.content}</span>
                    </td>
                    <td className={`${bodyCell} text-xs`}>
                      {activity.outcome ? (
                        <span className="rounded-full border border-border-subtle bg-panel-elevated px-2 py-0.5 text-[11px]">
                          {activity.outcome}
                        </span>
                      ) : (
                        <span className="text-text-dim">—</span>
                      )}
                    </td>
                    <td
                      className={`${bodyCell} whitespace-nowrap font-mono text-[11px] text-text-dim`}
                    >
                      {formatDuration(activity.durationMin)}
                    </td>
                    <td className={`${bodyCell} text-xs text-text-dim`}>
                      <span className="block truncate">
                        {activity.type === "SYSTEM"
                          ? "System"
                          : `${activity.creator.firstName} ${activity.creator.lastName}`}
                      </span>
                    </td>
                    <td className="border-b border-border-subtle px-1 py-2 text-right align-top">
                      {canDelete && (
                        <button
                          type="button"
                          onClick={() => handleDelete(activity.id)}
                          disabled={deleteActivity.isPending}
                          className="text-text-dim opacity-0 transition-opacity hover:text-destructive focus-visible:opacity-100 group-hover:opacity-100"
                          aria-label="Delete activity"
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
