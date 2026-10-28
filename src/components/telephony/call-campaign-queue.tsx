import { useState } from "react";
import { Loader2, ListChecks, PhoneCall, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  useCallCampaigns,
  useClaimNextCallCampaignLead,
  useMyCallQueue,
} from "@/hooks/use-telephony";
import { useCallStore } from "@/stores/call-store";
import { CreateCallCampaignDialog } from "./create-call-campaign-dialog";

// The power-dialer view (§11/§12): pick a calling list and work through it
// one lead at a time. "Call next" claims the next open lead (atomically, so
// two agents on the same open list never call the same person -- see
// CallCampaignsService.claimNext) and hands it straight to the same
// GlobalCallWidget outbound calls already use. Saving that call's
// disposition (CallDispositionForm) is what advances the lead to DONE on the
// backend -- there's no separate "next" click needed once a call finishes.
export function CallCampaignQueue() {
  const { data: campaigns, isLoading: campaignsLoading } = useCallCampaigns();
  const { data: queue } = useMyCallQueue();
  const claimNext = useClaimNextCallCampaignLead();
  const startCall = useCallStore((s) => s.startCall);
  const [createOpen, setCreateOpen] = useState(false);
  const [dialingCampaignId, setDialingCampaignId] = useState<string | null>(null);

  async function handleCallNext(campaignId: string) {
    setDialingCampaignId(campaignId);
    try {
      const lead = await claimNext.mutateAsync(campaignId);
      if (!lead) return;
      startCall({
        toNumber: lead.contact.phone as string,
        displayName: `${lead.contact.firstName} ${lead.contact.lastName}`,
        contactId: lead.contact.id,
        campaignId,
      });
    } finally {
      setDialingCampaignId(null);
    }
  }

  const queueByCampaign = new Map<string, number>();
  for (const lead of queue ?? []) {
    queueByCampaign.set(lead.campaign.id, (queueByCampaign.get(lead.campaign.id) ?? 0) + 1);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-text-dim">
          {queue?.length ?? 0} lead{queue?.length === 1 ? "" : "s"} waiting across your calling
          lists.
        </p>
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          <Plus /> New calling list
        </Button>
      </div>

      {campaignsLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-dim py-4">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : !campaigns || campaigns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border-subtle p-8 text-center">
          <ListChecks className="size-6 text-text-dim mx-auto mb-2" />
          <p className="text-sm text-text-dim">
            No calling lists yet. Create one to start a power-dialer session.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {campaigns.map((c) => {
            const remaining = queueByCampaign.get(c.id) ?? 0;
            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-border-subtle bg-panel p-4"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium truncate">{c.name}</p>
                  <p className="text-xs text-text-dim mt-0.5">
                    {c._count.leads} total · {remaining} open · by {c.creator.firstName}{" "}
                    {c.creator.lastName}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={remaining === 0 || dialingCampaignId === c.id}
                  onClick={() => handleCallNext(c.id)}
                >
                  {dialingCampaignId === c.id ? (
                    <Loader2 className="size-3.5 animate-spin" />
                  ) : (
                    <>
                      <PhoneCall className="size-3.5" /> Call next
                    </>
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      )}

      <CreateCallCampaignDialog open={createOpen} onOpenChange={setCreateOpen} />
    </div>
  );
}
