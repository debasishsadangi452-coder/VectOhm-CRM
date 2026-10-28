import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from "@nestjs/common";
import type { Request, Response } from "express";
import { ConfigService } from "@nestjs/config";
import { AuthService } from "./auth.service";
import { LoginDto } from "./dto/login.dto";
import { ForgotPasswordDto } from "./dto/forgot-password.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { AcceptTermsDto } from "./dto/accept-terms.dto";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

const REFRESH_COOKIE_NAME = "refreshToken";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  // Best-effort client IP + device + timezone offset. Behind the single-container Caddy proxy the
  // real client IP arrives in X-Forwarded-For (Caddy sets it); fall back to the
  // socket address for direct/local requests.
  private extractContext(req: Request, dtoOffset?: number) {
    const forwarded = req.headers["x-forwarded-for"];
    const forwardedIp = Array.isArray(forwarded) ? forwarded[0] : forwarded?.split(",")[0]?.trim();
    const headerTz = req.headers["x-timezone-offset"]
      ? parseInt(String(req.headers["x-timezone-offset"]), 10)
      : undefined;
    const offset =
      dtoOffset ?? (typeof headerTz === "number" && !isNaN(headerTz) ? headerTz : undefined);
    return {
      ipAddress: forwardedIp || req.socket?.remoteAddress || null,
      userAgent: req.headers["user-agent"] ?? null,
      timezoneOffset: offset,
    };
  }

  // Scope the cookie to "/" (not "/auth"): in the single-container deploy the
  // browser reaches the API through a reverse proxy at "/api/*" (Caddy strips
  // the prefix before Nest sees "/auth/*"), so a "/auth"-scoped cookie would
  // never be sent on the real "/api/auth/refresh" request and every reload
  // would log the user out. "/" matches both the proxied and the direct
  // (localhost) paths.
  private setRefreshCookie(res: Response, token: string, expiresAt: Date) {
    res.cookie(REFRESH_COOKIE_NAME, token, {
      httpOnly: true,
      secure: this.config.get("NODE_ENV") === "production",
      sameSite: "lax",
      // Express derives the real cookie Expires from `maxAge` when both are
      // set, silently overriding `expires` -- so don't set maxAge here, or
      // the browser cookie's lifetime stops matching the actual token TTL.
      expires: expiresAt,
      path: "/",
    });
  }

  @Public()
  @Post("login")
  @HttpCode(HttpStatus.OK)
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const {
      user,
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      termsAccepted,
      termsVersion,
      termsText,
    } = await this.authService.login(
      dto.email,
      dto.password,
      this.extractContext(req, dto.timezoneOffset),
    );
    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    // Never put the raw refresh token in the JSON body -- it's set as an
    // httpOnly cookie above specifically so client-side JS (and anything
    // that runs in the page, including an XSS payload) can never read it.
    // Returning it here too, or storing it in localStorage on the frontend,
    // would defeat that. The desktop agent (which has no browser cookie jar)
    // gets it a different way: it parses the raw Set-Cookie response header
    // itself -- see desktop-agent/src/auth.ts.
    return { accessToken, user, termsAccepted, termsVersion, termsText };
  }

  @Public()
  @Post("refresh")
  @HttpCode(HttpStatus.OK)
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (!token) {
      throw new UnauthorizedException("Missing refresh token");
    }
    const {
      user,
      accessToken,
      refreshToken,
      refreshTokenExpiresAt,
      termsAccepted,
      termsVersion,
      termsText,
    } = await this.authService.refresh(token);
    this.setRefreshCookie(res, refreshToken, refreshTokenExpiresAt);
    return { accessToken, user, termsAccepted, termsVersion, termsText };
  }

  @Public()
  @Post("logout")
  @HttpCode(HttpStatus.OK)
  async logout(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE_NAME];
    if (token) {
      await this.authService.logout(token, this.extractContext(req));
    }
    res.clearCookie(REFRESH_COOKIE_NAME, { path: "/" });
    return { success: true };
  }

  // Always 200 (never reveals whether the email exists). If it does, a reset
  // link is emailed.
  @Public()
  @Post("forgot-password")
  @HttpCode(HttpStatus.OK)
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.requestPasswordReset(dto.email);
    return { success: true };
  }

  @Public()
  @Post("reset-password")
  @HttpCode(HttpStatus.OK)
  async resetPassword(@Body() dto: ResetPasswordDto) {
    await this.authService.resetPassword(dto.token, dto.newPassword);
    return { success: true };
  }

  @Get("me")
  me(@CurrentUser() user: RequestUser) {
    return user;
  }

  // Not @Public() -- needs @CurrentUser() to know who's accepting.
  @Post("accept-terms")
  @HttpCode(HttpStatus.OK)
  async acceptTerms(
    @Body() dto: AcceptTermsDto,
    @CurrentUser() user: RequestUser,
    @Req() req: Request,
  ) {
    await this.authService.acceptTerms(user.id, dto.version, this.extractContext(req));
    return { success: true };
  }
}
