import { useEffect, useRef, useState } from "react";
import { Phone, PhoneOff, X } from "lucide-react";
import { useAuthStore } from "@/stores/auth-store";
import { useCallStore, type IncomingCall } from "@/stores/call-store";
import { canUseCalling } from "@/lib/telephony/access";
import {
  useCloudTalkConnection,
  useCreateCall,
  useJustCallConnection,
  useLinkProviderCallId,
  useLookupCallerByPhone,
} from "@/hooks/use-telephony";
import {
  DIALER_CONTAINER_ID,
  getOrCreateDialer,
  getLoginState,
} from "@/lib/telephony/justcall-dialer";
import { triggerCloudTalkCall } from "@/lib/telephony/cloudtalk-dialer";
import { CallDispositionForm } from "./call-disposition-form";
import { UnknownCallerPrompt } from "./unknown-caller-prompt";
import { cn } from "@/lib/utils";
import type {
  CallEndedEventData,
  CallRingingEventData,
  LoggedInEventData,
} from "@justcall/justcall-dialer-sdk";

export function GlobalCallWidget() {
  const user = useAuthStore((s) => s.user);
  const canUse = !!user && canUseCalling(user);
  const { data: justCallConnection } = useJustCallConnection(canUse);
  const { data: cloudTalkConnection } = useCloudTalkConnection(canUse);
  const connection = justCallConnection?.connected
    ? justCallConnection
    : cloudTalkConnection;
  const isCloudTalk = !justCallConnection?.connected && !!cloudTalkConnection?.connected;

  const {
    isOpen,
    target,
    incoming,
    localCallId,
    status,
    durationSec,
    receiveIncomingCall,
    resolveIncomingCall,
    setLocalCallId,
    setStatus,
    close,
  } = useCallStore();

  const [loginState, setLoginState] = useState<LoggedInEventData | null>(null);
  const [dialerReady, setDialerReady] = useState(false);
  const dialedFor = useRef<string | null>(null);
  const incomingHandledFor = useRef<string | null>(null);

  const createCall = useCreateCall();
  const linkProviderCallId = useLinkProviderCallId();
  const { data: lookupResult, isFetched: lookupFetched } = useLookupCallerByPhone(incoming?.from);

  // Create the JustCall dialer singleton if JustCall is connected
  useEffect(() => {
    if (!canUse || !justCallConnection?.connected) return;

    const instance = getOrCreateDialer({
      onLogin: (data) => setLoginState(data),
      onLogout: () => setLoginState(null),
      onReady: () => setDialerReady(true),
    });

    instance.on("call-ringing", (data: CallRingingEventData) => {
      const store = useCallStore.getState();
      if (data.direction === "inbound") {
        store.receiveIncomingCall({
          from: data.from,
          to: data.to,
          providerCallId: data.call_sid ?? null,
        });
        return;
      }
      store.setStatus("ringing");
      if (store.localCallId && data.call_sid) {
        linkProviderCallId.mutate({ id: store.localCallId, providerCallId: data.call_sid });
      }
    });
    instance.on("call-answered", () => {
      useCallStore.getState().setStatus("connected");
    });
    instance.on("call-ended", (data: CallEndedEventData) => {
      useCallStore.getState().setStatus("ended", data.duration);
    });

    instance.ready().then(() => setDialerReady(true));
    setLoginState(getLoginState());
  }, [canUse, justCallConnection?.connected]);

  // Handle call initiation for both CloudTalk and JustCall
  useEffect(() => {
    if (!isOpen || !target || status !== "initiating") return;
    if (dialedFor.current === target.toNumber) return;

    if (isCloudTalk) {
      dialedFor.current = target.toNumber;
      triggerCloudTalkCall(target.toNumber);
      createCall.mutate(
        {
          toNumber: target.toNumber,
          provider: "cloudtalk",
          contactId: target.contactId,
          companyId: target.companyId,
          dealId: target.dealId,
          campaignId: target.campaignId,
        },
        {
          onSuccess: (call) => {
            setLocalCallId(call.id);
            setStatus("ringing");
          },
        },
      );
      return;
    }

    if (justCallConnection?.connected && dialerReady) {
      dialedFor.current = target.toNumber;
      const dialer = getOrCreateDialer({});
      dialer.dialNumber(target.toNumber);

      createCall.mutate(
        {
          toNumber: target.toNumber,
          provider: "justcall",
          fromNumber: loginState?.login_numbers?.[0],
          contactId: target.contactId,
          companyId: target.companyId,
          dealId: target.dealId,
          campaignId: target.campaignId,
        },
        { onSuccess: (call) => setLocalCallId(call.id) },
      );
    }
  }, [
    isOpen,
    target,
    status,
    isCloudTalk,
    justCallConnection?.connected,
    dialerReady,
    loginState,
    createCall,
    setLocalCallId,
    setStatus,
  ]);

  useEffect(() => {
    dialedFor.current = null;
  }, [target?.toNumber]);

  // Inbound call handling
  useEffect(() => {
    if (!incoming || !lookupFetched) return;
    if (incomingHandledFor.current === incoming.from) return;
    incomingHandledFor.current = incoming.from;

    createCall.mutate(
      {
        toNumber: incoming.to,
        fromNumber: incoming.from,
        direction: "INBOUND",
        provider: isCloudTalk ? "cloudtalk" : "justcall",
        contactId: lookupResult?.contactId,
        companyId: lookupResult?.company?.id,
        dealId: lookupResult?.deal?.id,
      },
      {
        onSuccess: (call) => {
          setLocalCallId(call.id);
          if (incoming.providerCallId) {
            linkProviderCallId.mutate({ id: call.id, providerCallId: incoming.providerCallId });
          }
          resolveIncomingCall({
            toNumber: incoming.from,
            displayName: lookupResult
              ? `${lookupResult.firstName} ${lookupResult.lastName}`
              : "Unknown caller",
            contactId: lookupResult?.contactId,
            companyId: lookupResult?.company?.id,
            dealId: lookupResult?.deal?.id,
          });
        },
      },
    );
  }, [
    incoming,
    lookupFetched,
    lookupResult,
    createCall,
    setLocalCallId,
    linkProviderCallId,
    resolveIncomingCall,
  ]);

  useEffect(() => {
    incomingHandledFor.current = null;
  }, [incoming?.from]);

  if (!canUse) return null;

  const showResolvingIncoming = !!incoming;
  const isUnknownCaller = !!target && !target.contactId;

  return (
    <>
      {/* Permanent mount point for the SDK's iframe -- see comment above. */}
      <div
        id={DIALER_CONTAINER_ID}
        className={cn("fixed z-50", isOpen ? "bottom-24 right-6" : "hidden")}
      />

      {isOpen && (target || showResolvingIncoming) ? (
        <div className="fixed bottom-6 right-6 z-50 w-80 rounded-xl border border-border-subtle bg-panel shadow-lg">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border-subtle">
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate">
                {target?.displayName ?? "Incoming call…"}
              </p>
              <p className="text-xs text-text-dim">{target?.toNumber ?? incoming?.from}</p>
            </div>
            <button
              type="button"
              onClick={close}
              className="text-text-dim hover:text-foreground shrink-0"
              aria-label="Close call widget"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="px-4 py-3 space-y-3">
            <StatusPill status={status} durationSec={durationSec} />

            {!connection?.connected ? (
              <p className="text-xs text-text-dim">
                Telephony provider (CloudTalk or JustCall) isn't connected yet. Ask an Admin to connect it in Settings.
              </p>
            ) : !isCloudTalk && !loginState?.logged_in ? (
              <p className="text-xs text-text-dim">
                Log into JustCall in the dialer panel above to place this call.
              </p>
            ) : isCloudTalk ? (
              <p className="text-[11px] text-text-dim">
                Calling via CloudTalk desktop / web phone client.
              </p>
            ) : null}

            {target?.dealId ? (
              <p className="text-[11px] text-text-dim">Linked to an open deal for this contact.</p>
            ) : null}

            {status === "ended" && localCallId ? (
              <div className="space-y-3">
                {isUnknownCaller && <UnknownCallerPrompt phone={target.toNumber} />}
                <CallDispositionForm callId={localCallId} onDone={close} />
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}

function StatusPill({ status, durationSec }: { status: string; durationSec: number | null }) {
  const config: Record<string, { label: string; icon: typeof Phone; className: string }> = {
    idle: { label: "Idle", icon: Phone, className: "text-text-dim" },
    initiating: { label: "Initiating…", icon: Phone, className: "text-text-dim" },
    ringing: { label: "Ringing…", icon: Phone, className: "text-warning" },
    connected: { label: "Connected", icon: Phone, className: "text-success" },
    ended: { label: "Call ended", icon: PhoneOff, className: "text-text-dim" },
  };
  const { label, icon: Icon, className } = config[status] ?? config.idle;
  return (
    <div className={cn("flex items-center gap-2 text-sm", className)}>
      <Icon className="size-4" />
      <span>{label}</span>
      {durationSec != null ? (
        <span className="text-text-dim">
          · {Math.floor(durationSec / 60)}:{String(durationSec % 60).padStart(2, "0")}
        </span>
      ) : null}
    </div>
  );
}

export type { IncomingCall };
