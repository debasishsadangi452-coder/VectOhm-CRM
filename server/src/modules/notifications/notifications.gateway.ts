import { Injectable, Logger } from "@nestjs/common";
import {
  WebSocketGateway,
  WebSocketServer,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from "@nestjs/websockets";
import type { Server, Socket } from "socket.io";
import { JwtService } from "@nestjs/jwt";
import { ConfigService } from "@nestjs/config";
import { RoleName } from "@prisma/client";
import { PrismaService } from "../../prisma/prisma.service";

// First-ever WebSocket infrastructure in this codebase (everything else --
// chat, notifications -- is refetchInterval polling, see use-chat.ts and
// use-notifications.ts). Auth mirrors JwtStrategy exactly (same
// JWT_ACCESS_SECRET, same "sub" payload shape) but verified directly here
// rather than through Passport/JwtAuthGuard, since a socket handshake isn't
// a per-request HTTP call Passport can guard the normal way.
//
// Rooms: `user:{id}` (always), `dept:{departmentId}` (if the user has one),
// and `admins` (Admin role only) -- broadcastEngagementEvent() below uses
// all three so an event reaches its owner, their department's
// managers/employees, and every Admin, without a per-viewer query at
// emit time. A client naturally in more than one matching room (e.g. the
// event's own owner, who's also in their dept room) may receive the same
// event twice -- deduped client-side by event id, cheaper than tracking
// exact per-socket room membership overlap here.
@Injectable()
@WebSocketGateway({
  path: process.env.WS_PATH || "/socket.io",
  transports: ["websocket", "polling"],
  cors: {
    origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
      // Allow all origins with credentials (matching app.enableCors in main.ts)
      callback(null, true);
    },
    credentials: true,
  },
})
export class NotificationsGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(NotificationsGateway.name);

  @WebSocketServer()
  private server!: Server;

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = this.extractToken(socket);
      if (!token) {
        throw new Error("No token provided");
      }
      const payload = await this.jwt.verifyAsync<{ sub: string }>(token, {
        secret: this.config.getOrThrow<string>("JWT_ACCESS_SECRET"),
      });
      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
        select: { id: true, isActive: true, departmentId: true, role: { select: { name: true } } },
      });
      if (!user || !user.isActive) {
        throw new Error("User not found or inactive");
      }

      socket.data.userId = user.id;
      await socket.join(`user:${user.id}`);
      if (user.departmentId) {
        await socket.join(`dept:${user.departmentId}`);
      }
      if (user.role.name === RoleName.ADMIN) {
        await socket.join("admins");
      }
    } catch (err) {
      this.logger.warn(
        `WS connection rejected: ${err instanceof Error ? err.message : String(err)}`,
      );
      socket.disconnect(true);
    }
  }

  handleDisconnect() {
    // socket.io leaves all rooms automatically on disconnect -- nothing
    // else to clean up here.
  }

  private extractToken(socket: Socket): string | null {
    const authToken = socket.handshake.auth?.token as string | undefined;
    if (authToken) {
      return authToken;
    }
    const header = socket.handshake.headers.authorization;
    if (header?.startsWith("Bearer ")) {
      return header.slice(7);
    }
    return null;
  }

  emitToUser(userId: string, event: string, payload: unknown) {
    this.server?.to(`user:${userId}`).emit(event, payload);
  }

  // The Engagement Center's live activity feed / the notification bell's
  // instant-push -- one call site, three audiences (see class doc comment).
  broadcastEngagementEvent(event: {
    ownerId?: string | null;
    departmentId?: string | null;
    [key: string]: unknown;
  }) {
    if (event.ownerId) {
      this.server?.to(`user:${event.ownerId}`).emit("engagement_event", event);
    }
    if (event.departmentId) {
      this.server?.to(`dept:${event.departmentId}`).emit("engagement_event", event);
    }
    this.server?.to("admins").emit("engagement_event", event);
  }
}
