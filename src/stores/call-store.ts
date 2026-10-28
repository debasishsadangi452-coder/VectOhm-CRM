import { create } from "zustand";

// The lead/deal context a call was placed for -- shown in GlobalCallWidget's
// header so the agent knows who they're talking to without leaving the
// floating widget to go check.
export interface CallTarget {
  toNumber: string;
  displayName: string;
  contactId?: string;
  companyId?: string;
  dealId?: string;
  // Set when this call was placed from a power-dialer queue (see
  // CallCampaignQueue) -- lets the backend advance the queue once a
  // disposition is saved (CallsService.updateDisposition).
  campaignId?: string;
}

export type WidgetCallStatus = "idle" | "initiating" | "ringing" | "connected" | "ended";

// A call ringing in on the agent's JustCall line, before anyone has decided
// whether to treat it as a known contact or an unknown-caller quick-add
// (§9/§10). Separate from `target`: an incoming call doesn't have a CRM
// target picked yet -- GlobalCallWidget resolves one (via lookupByPhone) and
// only then promotes it into `target`.
export interface IncomingCall {
  from: string;
  to: string;
  providerCallId: string | null;
}

interface CallState {
  isOpen: boolean;
  target: CallTarget | null;
  incoming: IncomingCall | null;
  // Our own DB row id for the in-progress call (see CallButton -> createCall).
  localCallId: string | null;
  status: WidgetCallStatus;
  durationSec: number | null;
  startCall: (target: CallTarget) => void;
  receiveIncomingCall: (incoming: IncomingCall) => void;
  resolveIncomingCall: (target: CallTarget) => void;
  setLocalCallId: (id: string) => void;
  setStatus: (status: WidgetCallStatus, durationSec?: number) => void;
  close: () => void;
}

// Global so CallButton (mounted anywhere -- Contact sheet, Deal page, list
// rows) can open the one floating widget mounted once in the app shell (see
// _app.tsx), matching this codebase's existing zustand-for-cross-tree-state
// pattern (see auth-store.ts).
export const useCallStore = create<CallState>((set) => ({
  isOpen: false,
  target: null,
  incoming: null,
  localCallId: null,
  status: "idle",
  durationSec: null,
  startCall: (target) =>
    set({
      isOpen: true,
      target,
      incoming: null,
      localCallId: null,
      status: "initiating",
      durationSec: null,
    }),
  // The SDK's call-ringing fired for a call we didn't place ourselves --
  // open the widget in "ringing" state immediately so the agent sees
  // something is happening, before the (async) caller lookup resolves.
  receiveIncomingCall: (incoming) =>
    set({
      isOpen: true,
      incoming,
      target: null,
      localCallId: null,
      status: "ringing",
      durationSec: null,
    }),
  // Lookup resolved (or the agent dismissed it as unknown) -- promote the
  // incoming call into a normal `target` so the rest of the widget doesn't
  // need to know the direction.
  resolveIncomingCall: (target) => set({ target, incoming: null }),
  setLocalCallId: (id) => set({ localCallId: id }),
  setStatus: (status, durationSec) =>
    set((s) => ({ status, durationSec: durationSec ?? s.durationSec })),
  close: () =>
    set({
      isOpen: false,
      target: null,
      incoming: null,
      localCallId: null,
      status: "idle",
      durationSec: null,
    }),
}));
