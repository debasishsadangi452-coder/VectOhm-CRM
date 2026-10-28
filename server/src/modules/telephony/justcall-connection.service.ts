import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret, encryptSecret } from "../../common/utils/token-crypto";

const CONNECTION_ID = "justcall-connection";
export const JUSTCALL_API = "https://api.justcall.io/v2.1";

// Public-safe view of the connection -- never includes the key/secret.
export interface JustCallConnectionStatus {
  connected: boolean;
  connectedByName: string | null;
  connectedAt: string | null;
}

export interface JustCallCredentials {
  apiKey: string;
  apiSecret: string;
  webhookSecret: string | null;
}

@Injectable()
export class JustCallConnectionService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<JustCallConnectionStatus> {
    const conn = await this.prisma.justCallConnection.findUnique({
      where: { id: CONNECTION_ID },
      include: { connectedBy: { select: { firstName: true, lastName: true } } },
    });
    if (!conn) {
      return { connected: false, connectedByName: null, connectedAt: null };
    }
    return {
      connected: true,
      connectedByName: conn.connectedBy
        ? `${conn.connectedBy.firstName} ${conn.connectedBy.lastName}`
        : null,
      connectedAt: conn.connectedAt.toISOString(),
    };
  }

  // Validates the key/secret against JustCall BEFORE persisting -- same
  // principle as ApolloConnectionService/GithubService: a bad credential
  // never gets stored as if it were working.
  async connect(
    apiKey: string,
    apiSecret: string,
    webhookSecret: string | undefined,
    connectedById: string,
  ): Promise<JustCallConnectionStatus> {
    await this.verifyCredentials(apiKey, apiSecret);

    const key = encryptSecret(apiKey);
    const secret = encryptSecret(apiSecret);
    await this.prisma.justCallConnection.upsert({
      where: { id: CONNECTION_ID },
      create: {
        id: CONNECTION_ID,
        encryptedApiKey: key.ciphertext,
        apiKeyIv: key.iv,
        apiKeyAuthTag: key.authTag,
        encryptedApiSecret: secret.ciphertext,
        apiSecretIv: secret.iv,
        apiSecretAuthTag: secret.authTag,
        webhookSecret: webhookSecret ?? null,
        connectedById,
      },
      update: {
        encryptedApiKey: key.ciphertext,
        apiKeyIv: key.iv,
        apiKeyAuthTag: key.authTag,
        encryptedApiSecret: secret.ciphertext,
        apiSecretIv: secret.iv,
        apiSecretAuthTag: secret.authTag,
        webhookSecret: webhookSecret ?? null,
        connectedById,
        connectedAt: new Date(),
      },
    });

    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    await this.prisma.justCallConnection.deleteMany({ where: { id: CONNECTION_ID } });
  }

  // Used by JustCallProviderService for every outbound REST call.
  async requireCredentials(): Promise<JustCallCredentials> {
    const conn = await this.prisma.justCallConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!conn) {
      throw new BadRequestException("JustCall is not connected. Ask an Admin to connect it in Settings.");
    }
    return {
      apiKey: decryptSecret({ ciphertext: conn.encryptedApiKey, iv: conn.apiKeyIv, authTag: conn.apiKeyAuthTag }),
      apiSecret: decryptSecret({
        ciphertext: conn.encryptedApiSecret,
        iv: conn.apiSecretIv,
        authTag: conn.apiSecretAuthTag,
      }),
      webhookSecret: conn.webhookSecret,
    };
  }

  // Only the webhook controller needs this (it runs before auth, so it can't
  // go through requireCredentials' BadRequestException flow the same way).
  async getWebhookSecret(): Promise<string | null> {
    const conn = await this.prisma.justCallConnection.findUnique({ where: { id: CONNECTION_ID } });
    return conn?.webhookSecret ?? null;
  }

  // NOTE: the exact "list numbers" path (used here purely as a lightweight
  // credential check) was not independently confirmed against JustCall's
  // live, logged-in API reference -- only the base URL, auth header format,
  // and general REST shape were. If this 404s against a real account, check
  // developer.justcall.io/reference while logged in and correct the path;
  // do not guess a second time.
  private async verifyCredentials(apiKey: string, apiSecret: string) {
    let res: Response;
    try {
      res = await fetch(`${JUSTCALL_API}/phone-numbers`, {
        headers: {
          Authorization: `${apiKey}:${apiSecret}`,
          Accept: "application/json",
        },
      });
    } catch (err) {
      throw new BadRequestException(
        `Could not reach JustCall's API: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res.ok) {
      throw new BadRequestException(
        res.status === 401 || res.status === 403
          ? "JustCall rejected the API key/secret. Double-check the values."
          : `JustCall credential check failed (${res.status}).`,
      );
    }
  }
}
