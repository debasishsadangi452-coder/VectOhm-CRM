import { Injectable, Logger } from "@nestjs/common";
import { CloudTalkConnectionService, CLOUDTALK_API } from "./cloudtalk-connection.service";

export interface CloudTalkNumber {
  id: string;
  number: string;
  country: string;
  label?: string;
}

export interface CloudTalkAgent {
  id: string;
  email: string;
  name: string;
  status?: string;
  extension?: string;
}

@Injectable()
export class CloudTalkProviderService {
  private readonly logger = new Logger(CloudTalkProviderService.name);

  constructor(private readonly connection: CloudTalkConnectionService) {}

  private async getAuthHeader(): Promise<string> {
    const { apiKeyId, apiKeySecret } = await this.connection.requireCredentials();
    return `Basic ${Buffer.from(`${apiKeyId}:${apiKeySecret}`).toString("base64")}`;
  }

  async listNumbers(): Promise<CloudTalkNumber[]> {
    try {
      const authHeader = await this.getAuthHeader();
      const res = await fetch(`${CLOUDTALK_API}/numbers/index.json`, {
        headers: { Authorization: authHeader, Accept: "application/json" },
      });
      if (res.ok) {
        const body = await res.json();
        const items = body?.responseData?.data ?? body?.data ?? body ?? [];
        if (Array.isArray(items) && items.length > 0) {
          return items.map((item: any) => ({
            id: String(item.id ?? item.number_id ?? item.number),
            number: String(item.number ?? item.phone_number ?? item.name ?? ""),
            country: String(item.country ?? item.country_code ?? "US").toUpperCase(),
            label: item.name ?? item.label ?? undefined,
          }));
        }
      }
    } catch (err) {
      this.logger.warn(`CloudTalk listNumbers live fetch skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    // Default mock CloudTalk VoIP business lines for local/demo usage
    return [
      { id: "ct-num-1", number: "+1 (415) 890-2134", country: "US", label: "US - San Francisco Sales Line" },
      { id: "ct-num-2", number: "+1 (646) 555-0199", country: "US", label: "US - New York Inbound" },
      { id: "ct-num-3", number: "+44 20 7946 0912", country: "GB", label: "UK - London Sales Office" },
      { id: "ct-num-4", number: "+61 2 9374 4000", country: "AU", label: "AU - Sydney Operations" },
    ];
  }


  async clickToCall(params: {
    calleeNumber: string;
    agentEmail?: string;
    agentId?: string;
    callerId?: string;
  }): Promise<{ success: boolean; callId?: string }> {
    const authHeader = await this.getAuthHeader();
    const payload: Record<string, any> = {
      callee_number: params.calleeNumber,
    };
    if (params.agentId) payload.agent_id = params.agentId;
    if (params.agentEmail) payload.agent_email = params.agentEmail;
    if (params.callerId) payload.caller_id = params.callerId;

    try {
      const res = await fetch(`${CLOUDTALK_API}/calls/clickToCall.json`, {
        method: "POST",
        headers: {
          Authorization: authHeader,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        this.logger.warn(`CloudTalk clickToCall failed: ${res.status}`);
        return { success: false };
      }

      const body = await res.json();
      return {
        success: true,
        callId: body?.responseData?.call_id ?? body?.call_id ?? undefined,
      };
    } catch (err) {
      this.logger.error(`CloudTalk clickToCall error: ${err instanceof Error ? err.message : String(err)}`);
      return { success: false };
    }
  }

  async getRecordingUrl(providerCallId: string): Promise<string | null> {
    const authHeader = await this.getAuthHeader();
    try {
      const res = await fetch(`${CLOUDTALK_API}/calls/${encodeURIComponent(providerCallId)}.json`, {
        headers: { Authorization: authHeader, Accept: "application/json" },
      });
      if (!res.ok) {
        this.logger.warn(`CloudTalk getRecordingUrl(${providerCallId}) failed: ${res.status}`);
        return null;
      }
      const body = await res.json();
      return (
        body?.responseData?.recording_url ??
        body?.data?.recording_url ??
        body?.recording_url ??
        null
      );
    } catch (err) {
      this.logger.warn(`CloudTalk getRecordingUrl exception: ${err instanceof Error ? err.message : String(err)}`);
      return null;
    }
  }

  async listAgents(): Promise<CloudTalkAgent[]> {
    try {
      const authHeader = await this.getAuthHeader();
      const res = await fetch(`${CLOUDTALK_API}/agents/index.json`, {
        headers: { Authorization: authHeader, Accept: "application/json" },
      });
      if (res.ok) {
        const body = await res.json();
        const items = body?.responseData?.data ?? body?.data ?? body ?? [];
        if (Array.isArray(items) && items.length > 0) {
          return items.map((agent: any) => ({
            id: String(agent.id),
            email: agent.email ?? "",
            name: agent.name ?? `${agent.first_name ?? ""} ${agent.last_name ?? ""}`.trim(),
            status: agent.status ?? "offline",
            extension: agent.extension ?? undefined,
          }));
        }
      }
    } catch (err) {
      this.logger.warn(`CloudTalk listAgents live fetch skipped: ${err instanceof Error ? err.message : String(err)}`);
    }

    return [
      { id: "ct-agent-1", email: "jon@venushiring.com", name: "Jon Carter", status: "online", extension: "101" },
    ];
  }
}

