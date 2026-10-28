import { Loader2 } from "lucide-react";
import { useCallAnalytics } from "@/hooks/use-telephony";

function formatDuration(sec: number): string {
  const h = Math.floor(sec / 3600);
  const m = Math.floor((sec % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m ${sec % 60}s`;
}

// Calling performance dashboard (§20). Same visibility scoping as the call
// log itself (CallsService.analytics): an Employee sees only their own
// numbers, Manager/Admin see the whole team.
export function CallAnalyticsDashboard() {
  const { data, isLoading } = useCallAnalytics();

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 text-sm text-text-dim py-8">
        <Loader2 className="size-4 animate-spin" /> Loading analytics…
      </div>
    );
  }

  const stats = [
    { label: "Total calls", value: data.totalCalls.toLocaleString() },
    { label: "Connected", value: data.connected.toLocaleString() },
    { label: "Missed", value: data.missed.toLocaleString() },
    { label: "No answer", value: data.noAnswer.toLocaleString() },
    { label: "Total talk time", value: formatDuration(data.totalTalkSec) },
    { label: "Avg. call", value: formatDuration(data.avgCallSec) },
    { label: "Connection rate", value: `${Math.round(data.connectionRate * 100)}%` },
  ];

  const maxAgentCalls = Math.max(1, ...data.byAgent.map((a) => a.calls));

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {stats.map((s) => (
          <div key={s.label} className="rounded-xl border border-border-subtle bg-panel p-4">
            <p className="text-xs text-text-dim">{s.label}</p>
            <p className="text-xl font-semibold mt-1">{s.value}</p>
          </div>
        ))}
      </div>

      {data.byAgent.length > 0 && (
        <div className="rounded-xl border border-border-subtle bg-panel p-5">
          <p className="text-sm font-medium mb-4">By agent</p>
          <div className="space-y-3">
            {data.byAgent
              .sort((a, b) => b.calls - a.calls)
              .map((a) => (
                <div key={a.agentId} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-medium">{a.name}</span>
                    <span className="text-text-dim">
                      {a.calls} calls · {a.connected} connected · {formatDuration(a.talkSec)}
                    </span>
                  </div>
                  <div className="h-1.5 rounded-full bg-canvas/50 overflow-hidden">
                    <div
                      className="h-full rounded-full bg-primary"
                      style={{ width: `${(a.calls / maxAgentCalls) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
