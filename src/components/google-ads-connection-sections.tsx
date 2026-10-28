import { useState, useEffect, FormEvent } from "react";
import { CheckCircle2, Loader2, Sparkles, Target, BarChart2, RefreshCw, Code, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  useGoogleAdsStatus,
  useConnectGoogleAds,
  useDisconnectGoogleAds,
  useSyncGoogleAds,
  useGa4Status,
  useConnectGa4,
  useDisconnectGa4,
  useSyncGa4,
} from "@/hooks/use-google-ads";
import { ApiError } from "@/lib/api/client";

export function GoogleAdsConnectionSection() {
  const { data: status, isLoading } = useGoogleAdsStatus();
  const connectAds = useConnectGoogleAds();
  const disconnectAds = useDisconnectGoogleAds();
  const syncAds = useSyncGoogleAds();

  const [customerAccountId, setCustomerAccountId] = useState("");
  const [managerAccountId, setManagerAccountId] = useState("");
  const [developerToken, setDeveloperToken] = useState("");
  const [conversionActionId, setConversionActionId] = useState("Deal_Won");
  const [isSimulated, setIsSimulated] = useState(true);

  useEffect(() => {
    if (status?.connected) {
      setCustomerAccountId(status.customerAccountId ?? "");
      setManagerAccountId(status.managerAccountId ?? "");
      setIsSimulated(status.isSimulated);
    }
  }, [status]);

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    try {
      await connectAds.mutateAsync({
        customerAccountId: customerAccountId.trim(),
        managerAccountId: managerAccountId.trim() || undefined,
        developerToken: developerToken.trim() || undefined,
        conversionActionId: conversionActionId.trim() || "Deal_Won",
        isSimulated,
      });
      toast.success("Google Ads account connected successfully!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to connect Google Ads");
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectAds.mutateAsync();
      setCustomerAccountId("");
      setDeveloperToken("");
      toast.success("Google Ads disconnected.");
    } catch {
      toast.error("Could not disconnect Google Ads");
    }
  }

  async function handleSync() {
    try {
      const res = await syncAds.mutateAsync();
      toast.success(res.message || "Google Ads metrics synced!");
    } catch {
      toast.error("Failed to sync Google Ads metrics");
    }
  }

  function handleFillDemo() {
    setCustomerAccountId("982-415-8820");
    setManagerAccountId("112-904-7711");
    setDeveloperToken("TEST_DEV_TOKEN_DEMO_ACCESS");
    setConversionActionId("Deal_Won");
    setIsSimulated(true);
    toast.info("Filled demo Google Ads parameters (Sandbox / Simulation mode)");
  }

  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <div className="size-8 rounded-lg bg-blue-500/10 border border-blue-500/20 grid place-items-center text-blue-600 shrink-0">
            <Target className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Google Ads & Offline Conversion Integration</h2>
            <p className="text-xs text-text-dim mt-0.5 max-w-xl">
              Connect your Google Ads Manager / Customer Account. Automatically attributes incoming website leads
              and pushes closed deal revenue back to Google's Smart Bidding algorithm via Offline Conversion Import.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFillDemo}
          className="text-xs gap-1.5 shrink-0 border-blue-500/30 text-blue-600 hover:bg-blue-500/10"
        >
          <Sparkles className="size-3.5" />
          Fill Demo Data
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-dim">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : status?.connected ? (
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success shrink-0" />
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Connected to Google Ads ({status.customerAccountId})
                </span>
                <p className="text-[11px] text-text-dim">
                  Mode: <span className="font-semibold">{status.isSimulated ? "Sandbox / Simulation (Demo Data)" : "Live Google Ads API"}</span>
                  {status.lastSyncedAt && ` · Synced: ${new Date(status.lastSyncedAt).toLocaleTimeString()}`}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncAds.isPending}
              className="text-xs gap-1 h-7"
            >
              <RefreshCw className={`size-3 ${syncAds.isPending ? "animate-spin" : ""}`} />
              Sync Now
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive text-xs"
              onClick={handleDisconnect}
              disabled={disconnectAds.isPending}
            >
              {disconnectAds.isPending ? <Loader2 className="size-4 animate-spin" /> : "Disconnect Google Ads"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-3 max-w-xl">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="ads-customer-id">Google Ads Customer ID</Label>
              <Input
                id="ads-customer-id"
                value={customerAccountId}
                onChange={(e) => setCustomerAccountId(e.target.value)}
                placeholder="e.g. 123-456-7890"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="ads-manager-id">Manager (MCC) ID (optional)</Label>
              <Input
                id="ads-manager-id"
                value={managerAccountId}
                onChange={(e) => setManagerAccountId(e.target.value)}
                placeholder="e.g. 987-654-3210"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ads-dev-token">Developer Token (optional for Sandbox)</Label>
            <Input
              id="ads-dev-token"
              type="password"
              value={developerToken}
              onChange={(e) => setDeveloperToken(e.target.value)}
              placeholder="Google Ads API Developer Token"
            />
            <p className="text-[11px] text-text-dim">
              Leave blank or use "Fill Demo Data" to test without real Google Ads credentials.
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ads-conv-action">Offline Conversion Action Name</Label>
            <Input
              id="ads-conv-action"
              value={conversionActionId}
              onChange={(e) => setConversionActionId(e.target.value)}
              placeholder="Deal_Won"
            />
            <p className="text-[11px] text-text-dim">
              The conversion action in Google Ads that receives closed deal dollar values.
            </p>
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={connectAds.isPending} className="text-xs">
              {connectAds.isPending ? <Loader2 className="size-4 animate-spin" /> : "Connect Google Ads"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function GoogleAnalyticsConnectionSection() {
  const { data: status, isLoading } = useGa4Status();
  const connectGa4 = useConnectGa4();
  const disconnectGa4 = useDisconnectGa4();
  const syncGa4 = useSyncGa4();

  const [propertyId, setPropertyId] = useState("");
  const [serviceAccountJson, setServiceAccountJson] = useState("");
  const [isSimulated, setIsSimulated] = useState(true);

  useEffect(() => {
    if (status?.connected) {
      setPropertyId(status.propertyId ?? "");
      setIsSimulated(status.isSimulated);
    }
  }, [status]);

  async function handleConnect(e: FormEvent) {
    e.preventDefault();
    try {
      await connectGa4.mutateAsync({
        propertyId: propertyId.trim(),
        serviceAccountKeyJson: serviceAccountJson.trim() || undefined,
        isSimulated,
      });
      toast.success("Google Analytics 4 connected successfully!");
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : "Failed to connect GA4");
    }
  }

  async function handleDisconnect() {
    try {
      await disconnectGa4.mutateAsync();
      setPropertyId("");
      toast.success("GA4 disconnected.");
    } catch {
      toast.error("Could not disconnect GA4");
    }
  }

  async function handleSync() {
    try {
      const res = await syncGa4.mutateAsync();
      toast.success(res.message || "GA4 web metrics synced!");
    } catch {
      toast.error("Failed to sync GA4 web metrics");
    }
  }

  function handleFillDemo() {
    setPropertyId("properties/398271822");
    setServiceAccountJson('{"type": "service_account", "project_id": "venus-crm-demo"}');
    setIsSimulated(true);
    toast.info("Filled demo GA4 parameters (Sandbox / Simulation mode)");
  }

  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <div className="size-8 rounded-lg bg-amber-500/10 border border-amber-500/20 grid place-items-center text-amber-600 shrink-0">
            <BarChart2 className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Google Analytics 4 (GA4) Integration</h2>
            <p className="text-xs text-text-dim mt-0.5 max-w-xl">
              Connect your GA4 Property. Pulls daily sessions, engaged visitors, traffic source attribution
              (Paid Search vs. Organic vs. LinkedIn Referral), and bounce rates into CRM analytics.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFillDemo}
          className="text-xs gap-1.5 shrink-0 border-amber-500/30 text-amber-600 hover:bg-amber-500/10"
        >
          <Sparkles className="size-3.5" />
          Fill Demo Data
        </Button>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-text-dim">
          <Loader2 className="size-4 animate-spin" /> Loading…
        </div>
      ) : status?.connected ? (
        <div className="space-y-4 max-w-xl">
          <div className="flex items-center justify-between rounded-lg border border-success/30 bg-success/10 px-4 py-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 className="size-4 text-success shrink-0" />
              <div>
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                  Connected to GA4 ({status.propertyId})
                </span>
                <p className="text-[11px] text-text-dim">
                  Mode: <span className="font-semibold">{status.isSimulated ? "Sandbox / Simulation (Demo Data)" : "Live GA4 Data API"}</span>
                  {status.lastSyncedAt && ` · Synced: ${new Date(status.lastSyncedAt).toLocaleTimeString()}`}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleSync}
              disabled={syncGa4.isPending}
              className="text-xs gap-1 h-7"
            >
              <RefreshCw className={`size-3 ${syncGa4.isPending ? "animate-spin" : ""}`} />
              Sync Now
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              className="text-destructive hover:text-destructive text-xs"
              onClick={handleDisconnect}
              disabled={disconnectGa4.isPending}
            >
              {disconnectGa4.isPending ? <Loader2 className="size-4 animate-spin" /> : "Disconnect GA4"}
            </Button>
          </div>
        </div>
      ) : (
        <form onSubmit={handleConnect} className="space-y-3 max-w-xl">
          <div className="space-y-1.5">
            <Label htmlFor="ga4-prop-id">GA4 Property ID</Label>
            <Input
              id="ga4-prop-id"
              value={propertyId}
              onChange={(e) => setPropertyId(e.target.value)}
              placeholder="e.g. properties/398271822"
              required
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="ga4-key-json">Service Account Key JSON (optional for Sandbox)</Label>
            <Textarea
              id="ga4-key-json"
              value={serviceAccountJson}
              onChange={(e) => setServiceAccountJson(e.target.value)}
              placeholder='Paste Google Cloud Service Account JSON key here...'
              rows={3}
            />
          </div>

          <div className="flex items-center gap-2 pt-1">
            <Button type="submit" disabled={connectGa4.isPending} className="text-xs">
              {connectGa4.isPending ? <Loader2 className="size-4 animate-spin" /> : "Connect GA4"}
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

export function GoogleAdsTrackingScriptSection() {
  const [copied, setCopied] = useState(false);

  const snippetCode = `<!-- Venus CRM Website Attribution & GCLID Tracker -->
<script>
(function() {
  function getParam(p) {
    var match = RegExp('[?&]' + p + '=([^&]*)').exec(window.location.search);
    return match && decodeURIComponent(match[1].replace(/\\+/g, ' '));
  }
  var keys = ['gclid', 'wbraid', 'gbraid', 'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content'];
  keys.forEach(function(k) {
    var v = getParam(k);
    if (v) sessionStorage.setItem('venus_' + k, v);
  });
  window.getVenusAttribution = function() {
    return {
      gclid: sessionStorage.getItem('venus_gclid') || null,
      wbraid: sessionStorage.getItem('venus_wbraid') || null,
      gbraid: sessionStorage.getItem('venus_gbraid') || null,
      utmSource: sessionStorage.getItem('venus_utm_source') || null,
      utmMedium: sessionStorage.getItem('venus_utm_medium') || null,
      utmCampaign: sessionStorage.getItem('venus_utm_campaign') || null,
      landingPage: window.location.href
    };
  };
})();
</script>`;

  function handleCopy() {
    navigator.clipboard.writeText(snippetCode);
    setCopied(true);
    toast.success("Tracking script copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="bg-panel border border-border-subtle rounded-xl p-6 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-start gap-2.5">
          <div className="size-8 rounded-lg bg-emerald-500/10 border border-emerald-500/20 grid place-items-center text-emerald-600 shrink-0">
            <Code className="size-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold">Website Tracking Snippet (For venusglobaltech.com)</h2>
            <p className="text-xs text-text-dim mt-0.5 max-w-xl">
              Paste this tag into your website's &lt;head&gt; or tag manager. It automatically captures Google Ads Click IDs
              (GCLID, WBRAID, GBRAID) and UTM tags, persisting them for contact inquiries and job applications.
            </p>
          </div>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleCopy}
          className="text-xs gap-1.5 shrink-0"
        >
          {copied ? <Check className="size-3.5 text-success" /> : <Copy className="size-3.5" />}
          {copied ? "Copied" : "Copy Snippet"}
        </Button>
      </div>

      <pre className="bg-canvas border border-border-subtle p-3.5 rounded-lg text-[11px] font-mono text-text-dim overflow-x-auto select-all">
        {snippetCode}
      </pre>
    </div>
  );
}

