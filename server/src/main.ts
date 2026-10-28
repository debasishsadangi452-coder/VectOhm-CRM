import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { ValidationPipe } from "@nestjs/common";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import { AppModule } from "./app.module";

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });

  // Deployed behind a single reverse proxy (Railway) -- without this,
  // Express's req.ip is the proxy's address for every request, which would
  // make CareersModule's per-IP ThrottlerGuard (see careers.module.ts) rate
  // limit the entire public careers site as one shared bucket instead of
  // per visitor.
  app.set("trust proxy", 1);

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: "cross-origin" },
    }),
  );
  app.use(cookieParser());
  app.enableCors((req: any, callback: (err: Error | null, options?: any) => void) => {
    const origin: string | undefined = req.headers.origin;
    const respond = (allow: boolean) => callback(null, { origin: allow, credentials: true });

    if (!origin) return respond(true);
    const cleanOrigin = origin.replace(/\/+$/, "");

    // Same-origin deploy (Caddy serves the app and /api on one host): trust an Origin that matches
    // the host the request was addressed to, so no CORS_ORIGIN/APP_URL config is needed.
    const host = (req.headers["x-forwarded-host"] ?? req.headers.host ?? "").toString().split(",")[0].trim();
    if (host && (cleanOrigin === `https://${host}` || cleanOrigin === `http://${host}`)) {
      return respond(true);
    }

    const isLocalhost =
      cleanOrigin.startsWith("http://localhost:") ||
      cleanOrigin.startsWith("http://127.0.0.1:") ||
      cleanOrigin.startsWith("http://192.168.") ||
      cleanOrigin.startsWith("http://172.");

    const isExtension = cleanOrigin.startsWith("chrome-extension://");

    const allowedOrigins = [
      process.env.APP_URL?.replace(/\/+$/, ""),
      ...(process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((s) => s.trim().replace(/\/+$/, ""))
        : []),
    ].filter(Boolean);

    // Any other origin is rejected -- this previously fell through to allow-all, which combined with
    // `credentials: true` let ANY website make credentialed (cookie-bearing) cross-origin requests.
    // `false` (not an Error) means the request is still processed server-side but the browser gets no
    // Access-Control-Allow-Origin header; non-browser callers (curl, the desktop agent) send no Origin
    // header at all (handled above).
    respond(isLocalhost || isExtension || allowedOrigins.includes(cleanOrigin));
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
    }),
  );

  const port = process.env.PORT ?? 3001;
  await app.listen(port);
  console.log(`Venus CRM API listening on http://localhost:${port}`);
}

bootstrap();
