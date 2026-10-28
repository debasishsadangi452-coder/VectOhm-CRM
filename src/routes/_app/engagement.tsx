import { createFileRoute, Link } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import {
  Activity,
  Mail,
  MailOpen,
  MousePointerClick,
  MessageSquareReply,
  CalendarClock,
  Phone,
  CheckCircle2,
  Rocket,
  Flag,
  Loader2,
  Send,
  X,
  Sparkles,
} from "lucide-react";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useEngagementEvents, useEngagementMetrics } from "@/hooks/use-engagement";
import {
  useFollowUps,
  useGenerateFollowUpDraft,
  useSendFollowUp,
  useDismissFollowUp,
} from "@/hooks/use-follow-ups";
import { EngagementBadge } from "@/components/engagement-badge";
import type { EngagementEvent, EngagementEventType, FollowUpTask } from "@/lib/api/types";

export const Route = createFileRoute("/_app/engagement")({
  component: EngagementCenterPage,
});

const EVENT_META: Record<EngagementEventType, { label: string; icon: typeof Mail }> = {
  EMAIL_SENT: { label: "sent an email", icon: Mail },
  EMAIL_OPENED: { label: "opened your email", icon: MailOpen },
  EMAIL_CLICKED: { label: "clicked a link", icon: MousePointerClick },
  EMAIL_REPLIED: { label: "replied", icon: MessageSquareReply },
  FOLLOWUP_SCHEDULED: { label: "follow-up scheduled", icon: CalendarClock },
  FOLLOWUP_SENT: { label: "follow-up sent", icon: Send },
  FOLLOWUP_DISMISSED: { label: "follow-up dismissed", icon: X },
  DEAL_CREATED: { label: "created a deal", icon: Flag },
  DEAL_STAGE_CHANGED: { label: "moved a deal stage", icon: Flag },
  MEETING_BOOKED: { label: "logged a meeting", icon: CalendarClock },
  CALL_LOGGED: { label: "logged a call", icon: Phone },
  TASK_COMPLETED: { label: "completed a task", icon: CheckCircle2 },
  SEQUENCE_STARTED: { label: "started a sequence", icon: Rocket },
  SEQUENCE_COMPLETED: { label: "completed a sequence", icon: Rocket },
};

function EngagementCenterPage() {
  useDepartmentGuard("Sales");

  const { data: metrics } = useEngagementMetrics();
  const { data: events, isLoading: eventsLoading } = useEngagementEvents({ take: 30 });
  const { data: followUps, isLoading: followUpsLoading } = useFollowUps("PENDING");

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <div className="flex items-center gap-2">
        <Activity className="size-5 text-text-dim" />
        <h1 className="text-xl font-semibold tracking-tight">Engagement Center</h1>
      </div>

      <MetricsHeader metrics={metrics} />

      <div className="grid lg:grid-cols-[1fr_380px] gap-4 items-start">
        <ActivityFeed events={events} isLoading={eventsLoading} />
        <FollowUpQueue tasks={followUps} isLoading={followUpsLoading} />
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="bg-panel border border-border-subtle rounded-lg px-4 py-3">
      <p className="text-[11px] uppercase tracking-wide text-text-dim">{label}</p>
      <p className="text-xl font-semibold tabular-nums mt-1">{value}</p>
    </div>
  );
}

function MetricsHeader({ metrics }: { metrics: ReturnType<typeof useEngagementMetrics>["data"] }) {
  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-medium text-text-dim mb-2">Today</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          <StatCard label="Emails Sent" value={metrics?.today.emailsSent ?? "—"} />
          <StatCard label="Emails Opened" value={metrics?.today.emailsOpened ?? "—"} />
          <StatCard label="Open Rate" value={metrics ? `${metrics.today.openRate}%` : "—"} />
          <StatCard label="Click Rate" value={metrics ? `${metrics.today.clickRate}%` : "—"} />
          <StatCard label="Follow-Ups Due" value={metrics?.today.followUpsDue ?? "—"} />
          <StatCard label="Follow-Ups Sent" value={metrics?.today.followUpsSent ?? "—"} />
          <StatCard label="Meetings" value={metrics?.today.meetingsGenerated ?? "—"} />
        </div>
      </div>
      <div>
        <p className="text-xs font-medium text-text-dim mb-2">This Week</p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <StatCard label="Total Engagements" value={metrics?.thisWeek.totalEngagements ?? "—"} />
          <StatCard label="Hot Leads" value={metrics?.thisWeek.hotLeads ?? "—"} />
          <StatCard label="Warm Leads" value={metrics?.thisWeek.warmLeads ?? "—"} />
          <StatCard label="Cold Leads" value={metrics?.thisWeek.coldLeads ?? "—"} />
        </div>
      </div>
    </div>
  );
}

function eventName(event: EngagementEvent): string {
  if (event.contact) return `${event.contact.firstName} ${event.contact.lastName}`;
  if (event.owner) return `${event.owner.firstName} ${event.owner.lastName}`;
  return "Someone";
}

function eventSource(event: EngagementEvent): string | null {
  return event.campaign?.name ?? event.sequence?.name ?? null;
}

function ActivityFeed({ events, isLoading }: { events?: EngagementEvent[]; isLoading: boolean }) {
  return (
    <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle">
        <p className="text-sm font-medium">Activity Feed</p>
      </div>
      <div className="divide-y divide-border-subtle max-h-[65vh] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-text-dim p-4">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}
        {!isLoading && (events ?? []).length === 0 && (
          <p className="text-sm text-text-dim p-4">No engagement activity yet.</p>
        )}
        {(events ?? []).map((event) => {
          const meta = EVENT_META[event.type];
          const Icon = meta.icon;
          const source = eventSource(event);
          return (
            <div key={event.id} className="flex items-start gap-3 px-4 py-3">
              <div className="mt-0.5 size-7 shrink-0 rounded-full bg-canvas/60 border border-border-subtle grid place-items-center">
                <Icon className="size-3.5 text-text-dim" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm truncate">
                  <span className="font-medium">{eventName(event)}</span>{" "}
                  <span className="text-text-dim">{meta.label}</span>
                </p>
                <p className="text-xs text-text-dim truncate">
                  {source ? `${source} · ` : ""}
                  {new Date(event.occurredAt).toLocaleString()}
                  {event.dealId && (
                    <>
                      {" · "}
                      <Link to="/deals/$id" params={{ id: event.dealId }} className="text-primary hover:underline">
                        Open Deal
                      </Link>
                    </>
                  )}
                </p>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function bucketLabel(task: FollowUpTask): "Overdue" | "Due Now" | "Due Today" | null {
  const due = new Date(task.dueAt);
  const now = new Date();
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const endOfToday = new Date(now);
  endOfToday.setHours(23, 59, 59, 999);

  if (due < startOfToday) return "Overdue";
  if (due <= now) return "Due Now";
  if (due <= endOfToday) return "Due Today";
  return null;
}

function FollowUpQueue({ tasks, isLoading }: { tasks?: FollowUpTask[]; isLoading: boolean }) {
  const buckets: Record<"Overdue" | "Due Now" | "Due Today", FollowUpTask[]> = {
    Overdue: [],
    "Due Now": [],
    "Due Today": [],
  };
  for (const task of tasks ?? []) {
    const label = bucketLabel(task);
    if (label) buckets[label].push(task);
  }

  return (
    <div className="bg-panel border border-border-subtle rounded-xl overflow-hidden">
      <div className="px-4 py-3 border-b border-border-subtle">
        <p className="text-sm font-medium">Follow-Up Queue</p>
      </div>
      <div className="max-h-[65vh] overflow-y-auto">
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-text-dim p-4">
            <Loader2 className="size-4 animate-spin" /> Loading…
          </div>
        )}
        {!isLoading &&
          (["Overdue", "Due Now", "Due Today"] as const).map((label) =>
            buckets[label].length > 0 ? (
              <div key={label}>
                <p className="text-[11px] font-medium uppercase tracking-wide text-text-dim px-4 pt-3 pb-1">
                  {label} ({buckets[label].length})
                </p>
                <div className="divide-y divide-border-subtle">
                  {buckets[label].map((task) => (
                    <FollowUpRow key={task.id} task={task} />
                  ))}
                </div>
              </div>
            ) : null,
          )}
        {!isLoading && (tasks ?? []).length === 0 && (
          <p className="text-sm text-text-dim p-4">Nothing due right now.</p>
        )}
      </div>
    </div>
  );
}

function FollowUpRow({ task }: { task: FollowUpTask }) {
  const [editing, setEditing] = useState(false);
  const [subject, setSubject] = useState(task.aiDraftSubject ?? "");
  const [body, setBody] = useState(task.aiDraftBody ?? "");
  const generateDraft = useGenerateFollowUpDraft();
  const send = useSendFollowUp();
  const dismiss = useDismissFollowUp();

  async function openEditor() {
    if (!subject && !body) {
      const draft = await generateDraft.mutateAsync(task.id);
      setSubject(draft.subject);
      setBody(draft.body);
    }
    setEditing(true);
  }

  function handleSend() {
    send.mutate(
      { id: task.id, subject, body },
      { onSuccess: () => setEditing(false) },
    );
  }

  return (
    <div className="px-4 py-3 space-y-2">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">
            {task.contact.firstName} {task.contact.lastName}
          </p>
          <p className="text-xs text-text-dim truncate">
            {task.contact.company?.name ?? "—"}
          </p>
        </div>
        <EngagementBadge tier={task.contact.engagementTier} score={task.contact.engagementScore} />
      </div>

      {!editing ? (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={openEditor}
            disabled={generateDraft.isPending}
            className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-60"
          >
            {generateDraft.isPending ? (
              <Loader2 className="size-3 animate-spin" />
            ) : (
              <Sparkles className="size-3" />
            )}
            Create Follow-Up
          </button>
          <button
            type="button"
            onClick={() => dismiss.mutate(task.id)}
            disabled={dismiss.isPending}
            className="text-xs font-medium px-2.5 py-1 rounded-md border border-border-subtle text-text-dim hover:bg-canvas/50"
          >
            Dismiss
          </button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <input
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-border-subtle bg-canvas/40"
            placeholder="Subject"
          />
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="w-full text-xs px-2 py-1.5 rounded-md border border-border-subtle bg-canvas/40"
            placeholder="Body"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSend}
              disabled={send.isPending || !subject.trim() || !body.trim()}
              className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-md bg-primary text-primary-foreground hover:brightness-110 disabled:opacity-60"
            >
              {send.isPending ? <Loader2 className="size-3 animate-spin" /> : <Send className="size-3" />}
              Send
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-xs font-medium px-2.5 py-1 rounded-md border border-border-subtle text-text-dim hover:bg-canvas/50"
            >
              Cancel
            </button>
          </div>
          {send.isError && (
            <p className="text-[11px] text-destructive">
              {send.error instanceof Error ? send.error.message : "Failed to send"}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
