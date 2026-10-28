import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { Phone, Settings } from "lucide-react";
import { useDepartmentGuard } from "@/hooks/use-department-guard";
import { useCalls, useJustCallConnection, useCloudTalkConnection } from "@/hooks/use-telephony";
import { CallHistoryTable } from "@/components/telephony/call-history-table";
import { CallCampaignQueue } from "@/components/telephony/call-campaign-queue";
import { CallAnalyticsDashboard } from "@/components/telephony/call-analytics-dashboard";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import type { CallStatus } from "@/lib/api/types";

export const Route = createFileRoute("/_app/calls")({
  component: CallsPage,
});

const STATUS_FILTERS: Array<{ value: CallStatus | "ALL"; label: string }> = [
  { value: "ALL", label: "All statuses" },
  { value: "COMPLETED", label: "Completed" },
  { value: "CONNECTED", label: "Connected" },
  { value: "RINGING", label: "Ringing" },
  { value: "FAILED", label: "Failed" },
  { value: "BUSY", label: "Busy" },
  { value: "NO_ANSWER", label: "No answer" },
];

// Standalone call log -- Employees see their own calls, Manager/Admin see
// every Sales call (Admin explicitly unrestricted across departments too),
// see CallsService.visibilityScope on the backend.
function CallsPage() {
  useDepartmentGuard("Sales");
  const { data: justCallConnection } = useJustCallConnection();
  const { data: cloudTalkConnection } = useCloudTalkConnection();
  const isConnected = !!justCallConnection?.connected || !!cloudTalkConnection?.connected;
  const [status, setStatus] = useState<CallStatus | "ALL">("ALL");

  const { data: calls } = useCalls(status === "ALL" ? {} : { status });
  const totalCalls = calls?.length ?? 0;
  const connected =
    calls?.filter((c) => c.status === "COMPLETED" || c.status === "CONNECTED").length ?? 0;

  return (
    <div className="p-6 space-y-6 max-w-5xl mx-auto">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-lg font-semibold flex items-center gap-2">
            <Phone className="size-5" /> Calls
          </h1>
          <p className="text-sm text-text-dim mt-1">
            Every call placed through CloudTalk or JustCall, with recordings and outcomes.
          </p>
        </div>
      </div>

      {!isConnected && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm">
          <div>
            <p className="font-semibold text-amber-900 dark:text-amber-200">CloudTalk VoIP is not connected yet</p>
            <p className="text-xs text-amber-800/80 dark:text-amber-300/80 mt-0.5">
              Connect your CloudTalk API credentials in Settings to enable 1-click dialing, call logs, and team recordings.
            </p>
          </div>
          <Button asChild size="sm" className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs shrink-0">
            <Link to="/admin/settings">
              <Settings className="size-3.5 mr-1.5" />
              Configure CloudTalk
            </Link>
          </Button>
        </div>
      )}

      <Tabs defaultValue="log">
        <TabsList>
          <TabsTrigger value="log">Call Log</TabsTrigger>
          <TabsTrigger value="dialer">Power Dialer</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="log" className="space-y-4 mt-4">
          <div className="flex items-center justify-between gap-4">
            <div className="grid grid-cols-2 gap-3 max-w-sm flex-1">
              <div className="rounded-xl border border-border-subtle bg-panel p-4">
                <p className="text-xs text-text-dim">Total calls</p>
                <p className="text-2xl font-semibold mt-1">{totalCalls}</p>
              </div>
              <div className="rounded-xl border border-border-subtle bg-panel p-4">
                <p className="text-xs text-text-dim">Connected</p>
                <p className="text-2xl font-semibold mt-1">{connected}</p>
              </div>
            </div>
            <Select value={status} onValueChange={(v) => setStatus(v as CallStatus | "ALL")}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <CallHistoryTable status={status === "ALL" ? undefined : status} />
        </TabsContent>

        <TabsContent value="dialer" className="mt-4">
          <CallCampaignQueue />
        </TabsContent>

        <TabsContent value="analytics" className="mt-4">
          <CallAnalyticsDashboard />
        </TabsContent>
      </Tabs>
    </div>
  );
}
