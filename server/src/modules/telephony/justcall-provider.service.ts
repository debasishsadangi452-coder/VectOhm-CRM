import { Injectable, Logger } from "@nestjs/common";
import { JustCallConnectionService, JUSTCALL_API } from "./justcall-connection.service";

// Thin wrapper over the pieces of JustCall's REST API the *server* genuinely
// owns: reading numbers and recording URLs. Placing/controlling a live call
// happens client-side via the JustCall Dialer SDK (see GlobalCallWidget) --
// the browser owns the audio path directly, so there is no server-side
// initiateCall()/muteCall()/hangupCall() here. See the plan's §E for why.
//
// Endpoint paths below follow JustCall's confirmed base URL/auth format but
// were not individually verified against the live, logged-in API reference --
// each call site notes that. Verify against developer.justcall.io/reference
// before relying on a specific path in production; fix the path here rather
// than working around a wrong one elsewhere.
@Injectable()
export class JustCallProviderService {
  private readonly logger = new Logger(JustCallProviderService.name);

  constructor(private readonly connection: JustCallConnectionService) {}

  async listNumbers(): Promise<Array<{ id: string; number: string; country: string }>> {
    const { apiKey, apiSecret } = await this.connection.requireCredentials();
    const res = await fetch(`${JUSTCALL_API}/phone-numbers`, {
      headers: { Authorization: `${apiKey}:${apiSecret}`, Accept: "application/json" },
    });
    if (!res.ok) {
      throw new Error(`JustCall listNumbers failed: ${res.status}`);
    }
    const body = await res.json();
    // Response shape not independently verified -- adjust the mapping below
    // once a real account's payload is inspected.
    return body?.data ?? body ?? [];
  }

  async getRecordingUrl(providerCallId: string): Promise<string | null> {
    const { apiKey, apiSecret } = await this.connection.requireCredentials();
    const res = await fetch(`${JUSTCALL_API}/calls/${encodeURIComponent(providerCallId)}`, {
      headers: { Authorization: `${apiKey}:${apiSecret}`, Accept: "application/json" },
    });
    if (!res.ok) {
      this.logger.warn(`JustCall getRecordingUrl(${providerCallId}) failed: ${res.status}`);
      return null;
    }
    const body = await res.json();
    return body?.data?.recording_url ?? body?.recording_url ?? null;
  }
}
