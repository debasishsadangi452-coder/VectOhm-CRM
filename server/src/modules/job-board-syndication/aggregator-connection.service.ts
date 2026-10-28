import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret, encryptSecret } from "../../common/utils/token-crypto";
import type { RequestUser } from "../../common/types/request-user.type";

const CONNECTION_ID = "job-distribution-aggregator-connection";

// Public-safe view of the connection -- never includes the key.
export interface AggregatorConnectionStatus {
  connected: boolean;
  provider: string | null;
  baseUrl: string | null;
  connectedByName: string | null;
  connectedAt: string | null;
}

export interface AggregatorCredentials {
  provider: string;
  baseUrl: string;
  apiKey: string;
}

// Stores credentials for a job-distribution aggregator (Broadbean, Appcast,
// JobTarget, etc.) -- a single commercial integration that fans one posting
// out to many boards, bought as an alternative to the direct per-board
// partnerships JobBoardConnection is for (see that model's comment; those
// stay simulated because that path realistically requires an ATS vendor's
// volume, not a single company's).
//
// `provider`/`baseUrl` are free text because no aggregator has been chosen
// yet -- this only has to store whichever vendor's details get entered here.
// Same reasoning as JobBoardConnectionService: no live-verification step,
// since we don't have real API docs yet to check a key against. And same as
// that service, connecting here does NOT change posting behavior by itself
// -- see adapters/aggregator-client.service.ts for exactly what's still
// needed (the vendor-specific request/response shape) before an adapter can
// actually use this.
@Injectable()
export class AggregatorConnectionService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus(): Promise<AggregatorConnectionStatus> {
    const conn = await this.prisma.jobDistributionAggregatorConnection.findUnique({
      where: { id: CONNECTION_ID },
      include: { connectedBy: { select: { firstName: true, lastName: true } } },
    });
    if (!conn) {
      return { connected: false, provider: null, baseUrl: null, connectedByName: null, connectedAt: null };
    }
    return {
      connected: true,
      provider: conn.provider,
      baseUrl: conn.baseUrl,
      connectedByName: conn.connectedBy ? `${conn.connectedBy.firstName} ${conn.connectedBy.lastName}` : null,
      connectedAt: conn.connectedAt.toISOString(),
    };
  }

  async connect(creds: AggregatorCredentials, user: RequestUser): Promise<AggregatorConnectionStatus> {
    this.assertCanManage(user);

    const enc = encryptSecret(creds.apiKey);
    await this.prisma.jobDistributionAggregatorConnection.upsert({
      where: { id: CONNECTION_ID },
      create: {
        id: CONNECTION_ID,
        provider: creds.provider,
        baseUrl: creds.baseUrl,
        encryptedApiKey: enc.ciphertext,
        apiKeyIv: enc.iv,
        apiKeyAuthTag: enc.authTag,
        connectedById: user.id,
      },
      update: {
        provider: creds.provider,
        baseUrl: creds.baseUrl,
        encryptedApiKey: enc.ciphertext,
        apiKeyIv: enc.iv,
        apiKeyAuthTag: enc.authTag,
        connectedById: user.id,
        connectedAt: new Date(),
      },
    });

    return this.getStatus();
  }

  async disconnect(user: RequestUser): Promise<void> {
    this.assertCanManage(user);
    await this.prisma.jobDistributionAggregatorConnection.deleteMany({ where: { id: CONNECTION_ID } });
  }

  // Used by adapters/aggregator-client.service.ts once it actually calls out
  // to the configured vendor.
  async requireConnection(): Promise<{ provider: string; baseUrl: string; apiKey: string }> {
    const conn = await this.prisma.jobDistributionAggregatorConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!conn) {
      throw new BadRequestException(
        "No job distribution aggregator is connected. Ask an Admin or Recruitment manager to connect one in Settings.",
      );
    }
    return {
      provider: conn.provider,
      baseUrl: conn.baseUrl,
      apiKey: decryptSecret({ ciphertext: conn.encryptedApiKey, iv: conn.apiKeyIv, authTag: conn.apiKeyAuthTag }),
    };
  }

  // Same rule as JobBoardConnectionService.assertCanManage -- Recruitment
  // data, so a Manager must actually belong to Recruitment.
  private assertCanManage(user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isRecruitmentManager = user.role.name === RoleName.MANAGER && user.department?.name === "Recruitment";
    if (!isAdmin && !isRecruitmentManager) {
      throw new ForbiddenException("Only Admin or a Recruitment manager can manage the job distribution aggregator");
    }
  }
}
