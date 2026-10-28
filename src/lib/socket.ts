import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/stores/auth-store";
import { getApiUrl } from "@/lib/api/client";

const API_URL = getApiUrl();
// getApiUrl() returns a relative "/api" in production (reverse proxy like Caddy/Nginx proxies /api/*
// to the Nest server, stripping the prefix) or an absolute
// http://localhost:4001 in local dev (no proxy, no prefix, direct connect).
// socket.io-client only uses its `uri` argument to pick the origin -- it
// ignores any path segment there and always talks to `path` (default
// "/socket.io") for the actual handshake. So passing "/api" as the uri and
// leaving `path` at its default silently drops the /api prefix, and in
// production that handshake lands on the frontend server instead of Nest
// (404s on /socket.io). Route it through /api explicitly so proxy routes it
// to the same place every other API call goes.
const IS_RELATIVE_API = API_URL.startsWith("/");
const WS_ENABLED = import.meta.env.VITE_ENABLE_WS === "true";

let socket: Socket | null = null;
let connectionFailed = false;

export function getSocket(): Socket | null {
  if (!WS_ENABLED || connectionFailed) {
    return null;
  }
  if (socket) {
    return socket;
  }
  try {
    socket = io(IS_RELATIVE_API ? undefined : API_URL, {
      autoConnect: false,
      path: IS_RELATIVE_API ? `${API_URL.replace(/\/+$/, "")}/socket.io` : "/socket.io",
      transports: ["websocket", "polling"],
      reconnection: false,
      timeout: 5000,
      auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
    });

    socket.on("connect_error", () => {
      connectionFailed = true;
      if (socket) {
        socket.disconnect();
      }
    });

    return socket;
  } catch {
    connectionFailed = true;
    return null;
  }
}
