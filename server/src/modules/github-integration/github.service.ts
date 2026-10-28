import { BadRequestException, Injectable, Logger } from "@nestjs/common";
import { GithubAccountType } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";
import { decryptSecret, encryptSecret } from "../../common/utils/token-crypto";

const CONNECTION_ID = "github-connection";
const GITHUB_API = "https://api.github.com";

// Public-safe view of the connection -- never includes the token.
export interface GithubConnectionStatus {
  connected: boolean;
  accountType: GithubAccountType | null;
  accountLogin: string | null;
  connectedByEmail: string | null;
}

export interface CreatedRepo {
  name: string;
  htmlUrl: string;
}

@Injectable()
export class GithubService {
  private readonly logger = new Logger(GithubService.name);

  constructor(private readonly prisma: PrismaService) {}

  // --- connection record management ---

  async getStatus(): Promise<GithubConnectionStatus> {
    const conn = await this.prisma.githubConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!conn) {
      return { connected: false, accountType: null, accountLogin: null, connectedByEmail: null };
    }
    return {
      connected: true,
      accountType: conn.accountType,
      accountLogin: conn.accountLogin,
      connectedByEmail: conn.connectedByEmail,
    };
  }

  async isConnected(): Promise<boolean> {
    const conn = await this.prisma.githubConnection.findUnique({
      where: { id: CONNECTION_ID },
      select: { id: true },
    });
    return !!conn;
  }

  // Validates the token/login against GitHub BEFORE persisting, so a bad
  // token never gets stored as if it were working.
  async connect(
    accountType: GithubAccountType,
    accountLogin: string,
    token: string,
    connectedByEmail: string | null,
  ): Promise<GithubConnectionStatus> {
    await this.verifyCredentials(accountType, accountLogin, token);

    const enc = encryptSecret(token);
    await this.prisma.githubConnection.upsert({
      where: { id: CONNECTION_ID },
      create: {
        id: CONNECTION_ID,
        accountType,
        accountLogin,
        encryptedToken: enc.ciphertext,
        tokenIv: enc.iv,
        tokenAuthTag: enc.authTag,
        connectedByEmail,
      },
      update: {
        accountType,
        accountLogin,
        encryptedToken: enc.ciphertext,
        tokenIv: enc.iv,
        tokenAuthTag: enc.authTag,
        connectedByEmail,
      },
    });

    return this.getStatus();
  }

  async disconnect(): Promise<void> {
    await this.prisma.githubConnection.deleteMany({ where: { id: CONNECTION_ID } });
  }

  // Re-verifies the currently-stored connection is still valid.
  async testStored(): Promise<{ ok: true; accountLogin: string }> {
    const { accountType, accountLogin, token } = await this.requireConnection();
    await this.verifyCredentials(accountType, accountLogin, token);
    return { ok: true, accountLogin };
  }

  // --- repo + collaborator operations (used by ProjectsService) ---

  // Best-effort: creates a private repo for a project. Returns null (never
  // throws) on any failure so project creation is never blocked by GitHub.
  async createRepoForProject(name: string, description: string | null): Promise<CreatedRepo | null> {
    let conn: Awaited<ReturnType<typeof this.loadConnection>>;
    try {
      conn = await this.loadConnection();
    } catch {
      return null; // not connected -- nothing to do
    }
    if (!conn) return null;

    const repoName = slugifyRepoName(name);
    const endpoint =
      conn.accountType === GithubAccountType.ORG
        ? `${GITHUB_API}/orgs/${conn.accountLogin}/repos`
        : `${GITHUB_API}/user/repos`;

    try {
      const res = await this.githubFetch(endpoint, conn.token, {
        method: "POST",
        body: JSON.stringify({
          name: repoName,
          description: description ?? undefined,
          private: true,
          auto_init: true,
        }),
      });

      if (!res.ok) {
        const detail = await safeErrorMessage(res);
        this.logger.warn(`GitHub repo creation for "${name}" failed (${res.status}): ${detail}`);
        return null;
      }

      const body = (await res.json()) as { name: string; html_url: string };
      return { name: body.name, htmlUrl: body.html_url };
    } catch (err) {
      this.logger.error(`GitHub repo creation for "${name}" threw: ${errMessage(err)}`);
      return null;
    }
  }

  // Best-effort collaborator invite. Returns whether the invite call
  // succeeded so callers can surface it, but never throws.
  async inviteCollaborator(repoName: string, githubUsername: string): Promise<boolean> {
    const conn = await this.loadConnection();
    if (!conn) return false;

    const owner = conn.accountType === GithubAccountType.ORG ? conn.accountLogin : conn.accountLogin;
    try {
      const res = await this.githubFetch(
        `${GITHUB_API}/repos/${owner}/${repoName}/collaborators/${githubUsername}`,
        conn.token,
        { method: "PUT", body: JSON.stringify({ permission: "push" }) },
      );
      // 201 = invitation created, 204 = already a collaborator. Both are "fine".
      if (res.ok) return true;
      this.logger.warn(
        `GitHub collaborator invite (${githubUsername} -> ${repoName}) failed: ${await safeErrorMessage(res)}`,
      );
      return false;
    } catch (err) {
      this.logger.error(`GitHub collaborator invite threw: ${errMessage(err)}`);
      return false;
    }
  }

  async removeCollaborator(repoName: string, githubUsername: string): Promise<boolean> {
    const conn = await this.loadConnection();
    if (!conn) return false;

    const owner = conn.accountLogin;
    try {
      const res = await this.githubFetch(
        `${GITHUB_API}/repos/${owner}/${repoName}/collaborators/${githubUsername}`,
        conn.token,
        { method: "DELETE" },
      );
      return res.ok;
    } catch (err) {
      this.logger.error(`GitHub collaborator removal threw: ${errMessage(err)}`);
      return false;
    }
  }

  // Extract the "owner/repo" -> repo name from a stored githubUrl so member
  // endpoints can act on the right repo.
  repoNameFromUrl(githubUrl: string | null): string | null {
    if (!githubUrl) return null;
    const match = /github\.com\/[^/]+\/([^/]+?)(?:\.git)?\/?$/.exec(githubUrl.trim());
    return match ? match[1] : null;
  }

  // --- internals ---

  private async loadConnection() {
    const conn = await this.prisma.githubConnection.findUnique({ where: { id: CONNECTION_ID } });
    if (!conn) return null;
    const token = decryptSecret({
      ciphertext: conn.encryptedToken,
      iv: conn.tokenIv,
      authTag: conn.tokenAuthTag,
    });
    return { accountType: conn.accountType, accountLogin: conn.accountLogin, token };
  }

  private async requireConnection() {
    const conn = await this.loadConnection();
    if (!conn) {
      throw new BadRequestException("GitHub is not connected");
    }
    return conn;
  }

  private githubFetch(url: string, token: string, init?: RequestInit) {
    return fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "VenusCRM",
        "Content-Type": "application/json",
        ...(init?.headers ?? {}),
      },
    });
  }

  // Confirms the token is valid and (for ORG) that the org is reachable.
  private async verifyCredentials(accountType: GithubAccountType, accountLogin: string, token: string) {
    const userRes = await this.githubFetch(`${GITHUB_API}/user`, token);
    if (!userRes.ok) {
      throw new BadRequestException(
        userRes.status === 401
          ? "GitHub rejected the token (401). Check the token value and its scopes."
          : `GitHub token check failed (${userRes.status}): ${await safeErrorMessage(userRes)}`,
      );
    }

    if (accountType === GithubAccountType.ORG) {
      const orgRes = await this.githubFetch(`${GITHUB_API}/orgs/${accountLogin}`, token);
      if (!orgRes.ok) {
        throw new BadRequestException(
          orgRes.status === 404
            ? `Organization "${accountLogin}" was not found or the token can't see it.`
            : `Could not verify organization "${accountLogin}" (${orgRes.status}).`,
        );
      }
    } else {
      // For a personal account, confirm the login matches the token owner.
      const body = (await userRes.json()) as { login: string };
      if (body.login.toLowerCase() !== accountLogin.toLowerCase()) {
        throw new BadRequestException(
          `Token belongs to "${body.login}", not "${accountLogin}". Use the account that owns the token.`,
        );
      }
    }
  }
}

// Turn a project name into a valid, lowercase GitHub repo slug.
function slugifyRepoName(name: string): string {
  const slug = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-{2,}/g, "-");
  return slug || "project";
}

async function safeErrorMessage(res: Response): Promise<string> {
  try {
    const body = (await res.json()) as { message?: string };
    return body.message ?? res.statusText;
  } catch {
    return res.statusText;
  }
}

function errMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
