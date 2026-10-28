import { Injectable, Logger, OnApplicationBootstrap } from "@nestjs/common";
import { RoleName } from "@prisma/client";
import * as bcrypt from "bcryptjs";
import { PrismaService } from "../../prisma/prisma.service";

/**
 * First-boot setup for a fresh deployment. `prisma migrate deploy` creates empty tables, and the
 * dev seed (prisma/seed.ts) wipes data so it must never run in production. Instead:
 *  - make sure the three role rows exist (every user needs one), and
 *  - if ADMIN_EMAIL + ADMIN_PASSWORD are set and no such user exists yet, create that admin.
 * An existing account is never modified, so a password changed in the app survives redeploys.
 */
@Injectable()
export class AdminBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(AdminBootstrapService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onApplicationBootstrap() {
    try {
      await this.bootstrap();
    } catch (err) {
      // Don't take the API down over this -- the app is still usable if an admin already exists.
      this.logger.error(`Admin bootstrap failed: ${(err as Error).message}`);
    }
  }

  private async bootstrap() {
    const roles = await Promise.all(
      Object.values(RoleName).map((name) =>
        this.prisma.role.upsert({ where: { name }, update: {}, create: { name } }),
      ),
    );

    const email = process.env.ADMIN_EMAIL?.trim().toLowerCase();
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) return;

    const existing = await this.prisma.user.findUnique({ where: { email } });
    if (existing) return;

    const adminRole = roles.find((r) => r.name === RoleName.ADMIN)!;
    const [firstName, ...rest] = (process.env.ADMIN_NAME?.trim() || "Admin").split(/\s+/);
    await this.prisma.user.create({
      data: {
        email,
        passwordHash: await bcrypt.hash(password, 10),
        firstName,
        lastName: rest.join(" "),
        roleId: adminRole.id,
        canSignOut: true,
      },
    });
    this.logger.log(`Created initial admin account ${email}`);
  }
}
