import { BadRequestException, ForbiddenException, Injectable } from "@nestjs/common";
import { JobBoard, RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret, encryptSecret } from "../../common/utils/token-crypto";
import type { RequestUser } from "../../common/types/request-user.type";

// These eight take credentials. Indeed and Google for Jobs are excluded --
// they're the public feed / structured-data boards and have no credential
// concept at all (see indeed.adapter.ts / google-jobs.adapter.ts).
const CONNECTABLE_BOARDS: JobBoard[] = [
  JobBoard.LINKEDIN,
  JobBoard.NAUKRI,
  JobBoard.GLASSDOOR,
  JobBoard.ZIPRECRUITER,
  JobBoard.MONSTER,
  JobBoard.DICE,
  JobBoard.SIMPLYHIRED,
  JobBoard.CAREERBUILDER,
];

// Public-safe view of a connection -- never includes the key. Same shape as
// ApolloConnectionStatus (apollo-connection.service.ts).
export interface JobBoardConnectionStatus {
  board: JobBoard;
  connected: boolean;
  connectedByName: string | null;
  connectedAt: string | null;
}

@Injectable()
export class JobBoardConnectionService {
  constructor(private readonly prisma: PrismaService) {}

  async getAllStatuses(): Promise<JobBoardConnectionStatus[]> {
    const rows = await this.prisma.jobBoardConnection.findMany({
      include: { connectedBy: { select: { firstName: true, lastName: true } } },
    });
    const byBoard = new Map(rows.map((r) => [r.board, r]));

    return CONNECTABLE_BOARDS.map((board) => {
      const row = byBoard.get(board);
      if (!row) {
        return { board, connected: false, connectedByName: null, connectedAt: null };
      }
      return {
        board,
        connected: true,
        connectedByName: row.connectedBy ? `${row.connectedBy.firstName} ${row.connectedBy.lastName}` : null,
        connectedAt: row.connectedAt.toISOString(),
      };
    });
  }

  // No live-verification step here, unlike ApolloConnectionService.connect()
  // -- LinkedIn/Naukri/Glassdoor have no self-serve API for us to check a key
  // against yet. This just stores the credential securely for whenever a
  // real partner integration exists; it does not change posting behavior
  // today (see job-board.types.ts adapters, all still stubs).
  async connect(board: JobBoard, apiKey: string, user: RequestUser): Promise<JobBoardConnectionStatus> {
    this.assertConnectable(board);
    this.assertCanManage(user);

    const enc = encryptSecret(apiKey);
    await this.prisma.jobBoardConnection.upsert({
      where: { board },
      create: {
        board,
        encryptedApiKey: enc.ciphertext,
        apiKeyIv: enc.iv,
        apiKeyAuthTag: enc.authTag,
        connectedById: user.id,
      },
      update: {
        encryptedApiKey: enc.ciphertext,
        apiKeyIv: enc.iv,
        apiKeyAuthTag: enc.authTag,
        connectedById: user.id,
        connectedAt: new Date(),
      },
    });

    return this.statusFor(board);
  }

  async disconnect(board: JobBoard, user: RequestUser): Promise<void> {
    this.assertConnectable(board);
    this.assertCanManage(user);
    await this.prisma.jobBoardConnection.deleteMany({ where: { board } });
  }

  // Forward-compatible hook for a future real adapter -- nothing calls this
  // yet since there's no real API to hand the key to.
  async getDecryptedApiKey(board: JobBoard): Promise<string | null> {
    const row = await this.prisma.jobBoardConnection.findUnique({ where: { board } });
    if (!row) return null;
    return decryptSecret({ ciphertext: row.encryptedApiKey, iv: row.apiKeyIv, authTag: row.apiKeyAuthTag });
  }

  private async statusFor(board: JobBoard): Promise<JobBoardConnectionStatus> {
    const all = await this.getAllStatuses();
    return all.find((s) => s.board === board)!;
  }

  private assertConnectable(board: JobBoard) {
    if (!CONNECTABLE_BOARDS.includes(board)) {
      throw new BadRequestException(`${board} has no credential concept -- it's served via the public feed.`);
    }
  }

  // Recruitment-specific data, unlike Apollo/JustCall which are
  // cross-department -- a Manager must actually belong to Recruitment.
  private assertCanManage(user: RequestUser) {
    const isAdmin = user.role.name === RoleName.ADMIN;
    const isRecruitmentManager = user.role.name === RoleName.MANAGER && user.department?.name === "Recruitment";
    if (!isAdmin && !isRecruitmentManager) {
      throw new ForbiddenException("Only Admin or a Recruitment manager can manage job board connections");
    }
  }
}
