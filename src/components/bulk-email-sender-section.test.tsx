import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;

const mocks = vi.hoisted(() => ({
  status: { connected: false, httpFallbackAvailable: true } as Record<string, unknown>,
  availability: { google: true, microsoft: true, zoho: true } as Record<string, boolean>,
  connectGoogle: vi.fn(),
  connectMicrosoft: vi.fn(),
  connectZoho: vi.fn(),
}));

vi.mock("@/hooks/use-email-connections", () => {
  const idle = () => ({ mutate: vi.fn(), mutateAsync: vi.fn(), isPending: false, data: undefined });
  return {
  useEmailConnectionStatus: () => ({ data: mocks.status, isLoading: false }),
  useOAuthProviderAvailability: () => ({ data: mocks.availability }),
  useConnectEmail: idle,
  useTestEmailConnection: idle,
  useDisconnectEmail: idle,
  useNetworkDiagnostic: idle,
  useConnectGoogle: () => ({ mutate: mocks.connectGoogle, isPending: false }),
  useConnectMicrosoft: () => ({ mutate: mocks.connectMicrosoft, isPending: false }),
  useConnectZoho: () => ({ mutate: mocks.connectZoho, isPending: false }),
  useSetDefaultEmailConnection: idle,
  };
});

import { BulkEmailSenderSection } from "./bulk-email-sender-section";

describe("BulkEmailSenderSection - connect buttons", () => {
  let host: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    mocks.status = { connected: false, httpFallbackAvailable: true };
    mocks.availability = { google: true, microsoft: true, zoho: true };
    [mocks.connectGoogle, mocks.connectMicrosoft, mocks.connectZoho].forEach((m) => m.mockReset());
    host = document.createElement("div");
    document.body.appendChild(host);
    root = createRoot(host);
  });
  afterEach(() => {
    act(() => root.unmount());
    host.remove();
  });

  const button = (text: string) =>
    Array.from(host.querySelectorAll("button")).find((b) => b.textContent?.trim() === text) as HTMLButtonElement;

  it("offers Google, Outlook and Zoho, and Zoho starts its own sign-in", () => {
    act(() => root.render(<BulkEmailSenderSection />));
    expect(button("Connect with Google")).toBeDefined();
    expect(button("Connect with Outlook")).toBeDefined();
    act(() => button("Connect with Zoho").click());
    expect(mocks.connectZoho).toHaveBeenCalledTimes(1);
    expect(mocks.connectGoogle).not.toHaveBeenCalled();
    expect(mocks.connectMicrosoft).not.toHaveBeenCalled();
  });

  it("disables Zoho with an explanation when the server has no Zoho app configured", () => {
    mocks.availability = { google: true, microsoft: true, zoho: false };
    act(() => root.render(<BulkEmailSenderSection />));
    const zoho = button("Connect with Zoho");
    expect(zoho.disabled).toBe(true);
    expect(zoho.title).toMatch(/Zoho connect isn't configured/);
    expect(button("Connect with Google").disabled).toBe(false);
  });

  it("says Zoho is sending-only", () => {
    act(() => root.render(<BulkEmailSenderSection />));
    expect(host.textContent).toMatch(/Zoho sends over its web API/);
  });
});
