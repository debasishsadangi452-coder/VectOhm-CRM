import { BadRequestException, Injectable } from "@nestjs/common";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret, encryptSecret } from "../../common/utils/token-crypto";

const CONNECTION_ID = "apollo-connection";
export const APOLLO_API = "https://api.apollo.io/v1";

// Public-safe view of the connection -- never includes the key.
export interface ApolloConnectionStatus {
  connected: boolean;
  connectedByName: string | null;
  connectedAt: string | null;
}

function hasEnvApiKey(): boolean {
  return Boolean(process.env.APOLLO_API_KEY?.trim());
}

@Injectable()
export class ApolloConnectionService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<ApolloConnectionStatus> {
    const conn = await this.prisma.apolloConnection.findUnique({
      where: { id: CONNECTION_ID },
      include: { connectedBy: { select: { firstName: true, lastName: true } } },
    });
    if (!conn) {
      return hasEnvApiKey()
        ? { connected: true, connectedByName: "Server environment", connectedAt: null }
        : { connected: false, connectedByName: null, connectedAt: null };
    }
    return {
      connected: true,
      connectedByName: conn.connectedBy
        ? `${conn.connectedBy.firstName} ${conn.connectedBy.lastName}`
        : null,
      connectedAt: conn.connectedAt.toISOString(),
    };
  }

  // Validates the key against Apollo BEFORE persisting, so a bad key never
  // gets stored as if it were working -- same principle as GithubService.
  async connect(apiKey: string, connectedById: string): Promise<ApolloConnectionStatus> {
    await this.verifyApiKey(apiKey);

    const enc = encryptSecret(apiKey);
    await this.prisma.apolloConnection.upsert({
      where: { id: CONNECTION_ID },
      create: {
        id: CONNECTION_ID,
        encryptedApiKey: enc.ciphertext,
        apiKeyIv: enc.iv,
        apiKeyAuthTag: enc.authTag,
        connectedById,
      },
      update: {
        encryptedApiKey: enc.ciphertext,
        apiKeyIv: enc.iv,
        apiKeyAuthTag: enc.authTag,
        connectedById,
        connectedAt: new Date(),
      },
    });

    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    await this.prisma.apolloConnection.deleteMany({ where: { id: CONNECTION_ID } });
  }

  // Used by ApolloService for every search/enrich call. A key connected in
  // Settings wins; APOLLO_API_KEY from the environment is the fallback.
  async requireApiKey(): Promise<string> {
    const conn = await this.prisma.apolloConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!conn) {
      if (hasEnvApiKey()) return process.env.APOLLO_API_KEY!.trim();
      throw new BadRequestException("Apollo is not connected. Ask an Admin to connect it in Settings.");
    }
    return decryptSecret({
      ciphertext: conn.encryptedApiKey,
      iv: conn.apiKeyIv,
      authTag: conn.apiKeyAuthTag,
    });
  }

  private async verifyApiKey(apiKey: string) {
    let res: Response;
    try {
      res = await fetch(`${APOLLO_API}/auth/health`, {
        headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      });
    } catch (err) {
      throw new BadRequestException(
        `Could not reach Apollo's API: ${err instanceof Error ? err.message : String(err)}`,
      );
    }

    if (!res.ok) {
      throw new BadRequestException(
        res.status === 401 || res.status === 403
          ? "Apollo rejected the API key. Double-check the value."
          : `Apollo key check failed (${res.status}).`,
      );
    }
  }
}
