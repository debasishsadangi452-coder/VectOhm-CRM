import { BadRequestException, Controller, Get, Query, Res } from "@nestjs/common";
import { Response } from "express";
import { EmailOAuthService } from "./email-oauth.service";
import { Public } from "../../common/decorators/public.decorator";
import { CurrentUser } from "../../common/decorators/current-user.decorator";
import type { RequestUser } from "../../common/types/request-user.type";

function frontendUrl(path: string): string {
  const base = (process.env.APP_URL || process.env.CORS_ORIGIN || "http://localhost:8080").replace(
    /\/$/,
    "",
  );
  return `${base}${path}`;
}

@Controller("email-oauth")
export class EmailOAuthController {
  constructor(private readonly service: EmailOAuthService) {}

  // Whether each provider has GOOGLE_CLIENT_ID/SECRET etc. configured, so
  // the frontend can show "Connect with Google" as available/disabled
  // without guessing from a failed request.
  @Get("providers")
  providers() {
    return {
      google: this.service.isConfigured("GOOGLE"),
      microsoft: this.service.isConfigured("MICROSOFT"),
      zoho: this.service.isConfigured("ZOHO"),
    };
  }

  // Regular authenticated route -- the frontend fetches this URL, then
  // navigates the browser to the URL it returns (a top-level redirect to
  // Google/Microsoft's consent screen can't itself carry an Authorization
  // header, which is exactly why the *callback* below has to be @Public()
  // and rely on the signed state instead).
  @Get("google/authorize")
  authorizeGoogle(@CurrentUser() user: RequestUser) {
    return { url: this.service.buildAuthorizeUrl("GOOGLE", user.id) };
  }

  @Get("microsoft/authorize")
  authorizeMicrosoft(@CurrentUser() user: RequestUser) {
    return { url: this.service.buildAuthorizeUrl("MICROSOFT", user.id) };
  }

  @Get("zoho/authorize")
  authorizeZoho(@CurrentUser() user: RequestUser) {
    return { url: this.service.buildAuthorizeUrl("ZOHO", user.id) };
  }

  // Public: reached by the browser's own top-level redirect from the
  // provider, not by the frontend's authenticated fetch client. Identity
  // comes from the signed `state` (see common/utils/oauth-state.ts), not a
  // session. Redirects back into the app either way so the user lands
  // somewhere sensible instead of staring at a bare JSON response.
  @Public()
  @Get("google/callback")
  async googleCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ) {
    return this.handleCallback("GOOGLE", code, state, error, res);
  }

  @Public()
  @Get("microsoft/callback")
  async microsoftCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ) {
    return this.handleCallback("MICROSOFT", code, state, error, res);
  }

  @Public()
  @Get("zoho/callback")
  async zohoCallback(
    @Query("code") code: string | undefined,
    @Query("state") state: string | undefined,
    @Query("error") error: string | undefined,
    @Res() res: Response,
  ) {
    return this.handleCallback("ZOHO", code, state, error, res);
  }

  private async handleCallback(
    provider: "GOOGLE" | "MICROSOFT" | "ZOHO",
    code: string | undefined,
    state: string | undefined,
    error: string | undefined,
    res: Response,
  ) {
    if (error) {
      return res.redirect(frontendUrl(`/account?emailConnect=denied`));
    }
    if (!code || !state) {
      throw new BadRequestException("Missing code/state on OAuth callback");
    }
    try {
      await this.service.handleCallback(provider, code, state);
      return res.redirect(frontendUrl(`/account?emailConnect=success`));
    } catch {
      return res.redirect(frontendUrl(`/account?emailConnect=error`));
    }
  }
}
