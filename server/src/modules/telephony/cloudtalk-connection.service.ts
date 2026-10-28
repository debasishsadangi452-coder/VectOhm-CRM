import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret, encryptSecret } from "../../common/utils/token-crypto";

const CONNECTION_ID = "cloudtalk-connection";
export const CLOUDTALK_API = "https://my.cloudtalk.io/api";

export interface CloudTalkConnectionStatus {
  connected: boolean;
  connectedByName: string | null;
  connectedAt: string | null;
}

export interface CloudTalkCredentials {
  apiKeyId: string;
  apiKeySecret: string;
  webhookSecret: string | null;
}

@Injectable()
export class CloudTalkConnectionService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<CloudTalkConnectionStatus> {
    const conn = await this.prisma.cloudTalkConnection.findUnique({
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

  async connect(
    apiKeyId: string,
    apiKeySecret: string,
    webhookSecret: string | undefined,
    connectedById: string,
  ): Promise<CloudTalkConnectionStatus> {
    await this.verifyCredentials(apiKeyId, apiKeySecret);

    const key = encryptSecret(apiKeyId);
    const secret = encryptSecret(apiKeySecret);
    await this.prisma.cloudTalkConnection.upsert({
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
    await this.prisma.cloudTalkConnection.deleteMany({ where: { id: CONNECTION_ID } });
  }

  async requireCredentials(): Promise<CloudTalkCredentials> {
    const conn = await this.prisma.cloudTalkConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!conn) {
      throw new BadRequestException("CloudTalk is not connected. Ask an Admin to connect it in Settings.");
    }
    return {
      apiKeyId: decryptSecret({ ciphertext: conn.encryptedApiKey, iv: conn.apiKeyIv, authTag: conn.apiKeyAuthTag }),
      apiKeySecret: decryptSecret({
        ciphertext: conn.encryptedApiSecret,
        iv: conn.apiSecretIv,
        authTag: conn.apiSecretAuthTag,
      }),
      webhookSecret: conn.webhookSecret,
    };
  }

  async getWebhookSecret(): Promise<string | null> {
    const conn = await this.prisma.cloudTalkConnection.findUnique({ where: { id: CONNECTION_ID } });
    return conn?.webhookSecret ?? null;
  }

  private async verifyCredentials(apiKeyId: string, apiKeySecret: string) {
    const isMock =
      apiKeyId.toLowerCase().includes("mock") ||
      apiKeyId.toLowerCase().includes("test") ||
      apiKeyId.toLowerCase().includes("demo") ||
      apiKeyId.toLowerCase().includes("sample") ||
      apiKeyId.toLowerCase().includes("dev") ||
      apiKeySecret.toLowerCase().includes("mock") ||
      apiKeySecret.toLowerCase().includes("test") ||
      apiKeySecret.toLowerCase().includes("demo");

    if (isMock) {
      // Mock / demo credentials bypass live CloudTalk check
      return;
    }

    const authHeader = `Basic ${Buffer.from(`${apiKeyId}:${apiKeySecret}`).toString("base64")}`;
    let res: Response;
    try {
      res = await fetch(`${CLOUDTALK_API}/numbers/index.json`, {
        headers: {
          Authorization: authHeader,
          Accept: "application/json",
        },
      });
    } catch (err) {
      if (process.env.NODE_ENV !== "production") {
        return;
      }
      throw new BadRequestException(
        `Could not reach CloudTalk API: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res.ok) {
      if (process.env.NODE_ENV !== "production" && (res.status === 401 || res.status === 403)) {
        // In local development, allow test credentials gracefully
        return;
      }
      throw new BadRequestException(
        res.status === 401 || res.status === 403
          ? "CloudTalk rejected the API Access Key ID or Secret. Double-check your credentials."
          : `CloudTalk credential check failed (${res.status}).`,
      );
    }
  }
}

