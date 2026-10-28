import { JustCallDialer, type LoggedInEventData } from "@justcall/justcall-dialer-sdk";

// Singleton -- the SDK owns a real <iframe> (with mic/autoplay permissions)
// mounted into the DOM node with this id; there's exactly one JustCall
// session per browser tab, matching GlobalCallWidget being mounted once in
// the app shell. Re-creating the JustCallDialer on every widget open would
// re-login the agent and drop any in-progress call.
export const DIALER_CONTAINER_ID = "justcall-dialer-container";

let dialer: JustCallDialer | null = null;
let loginState: LoggedInEventData | null = null;

export function getOrCreateDialer(handlers: {
  onLogin?: (data: LoggedInEventData) => void;
  onLogout?: () => void;
  onReady?: () => void;
}): JustCallDialer {
  if (dialer) return dialer;

  dialer = new JustCallDialer({
    dialerId: DIALER_CONTAINER_ID,
    onLogin: (data) => {
      loginState = data;
      handlers.onLogin?.(data);
    },
    onLogout: () => {
      loginState = null;
      handlers.onLogout?.();
    },
    onReady: handlers.onReady,
  });
  return dialer;
}

export function getDialer(): JustCallDialer | null {
  return dialer;
}

export function getLoginState(): LoggedInEventData | null {
  return loginState;
}

// Never destroyed on widget close -- only on sign-out (see logout handling
// in the app shell), so the agent doesn't have to log back into JustCall's
// iframe every time they close the floating widget between calls.
export function destroyDialer(): void {
  dialer?.destroy();
  dialer = null;
  loginState = null;
}
