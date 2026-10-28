import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Outlet,
  createRootRouteWithContext,
  useRouter,
  HeadContent,
  Scripts,
} from "@tanstack/react-router";
import type { ReactNode } from "react";

import appCss from "../styles.css?url";
import { Toaster } from "@/components/ui/sonner";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <p className="font-mono text-xs uppercase tracking-widest text-text-dim">Error 404</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">Route not found</h1>
        <p className="mt-2 text-sm text-text-dim">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <a
          href="/"
          className="mt-6 inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground shadow-lg shadow-primary/20 hover:brightness-110"
        >
          Go home
        </a>
      </div>
    </div>
  );
}

function ErrorComponent({ error, reset }: { error: Error; reset: () => void }) {
  if (
    !error?.message?.includes("startTime") &&
    !error?.message?.includes("reportAllChanges") &&
    !error?.stack?.includes("reportAllChanges")
  ) {
    console.error(error);
  }
  const router = useRouter();

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-lg text-center">
        <h1 className="text-xl font-semibold tracking-tight">This page didn't load</h1>
        <p className="mt-2 text-sm text-text-dim">
          Something went wrong. Try refreshing or head back home.
        </p>
        {error?.message && (
          <div className="mt-4 p-3 rounded-lg border border-destructive/30 bg-destructive/10 text-left text-xs text-destructive font-mono break-words">
            {error.message}
          </div>
        )}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <button
            onClick={() => {
              router.invalidate();
              reset();
            }}
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:brightness-110"
          >
            Try again
          </button>
          <a
            href="/"
            className="inline-flex items-center justify-center rounded-md border border-border bg-panel px-4 py-2 text-sm font-medium text-foreground hover:bg-accent"
          >
            Go home
          </a>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: "Venus CRM — Enterprise Operating System" },
      {
        name: "description",
        content:
          "Venus CRM is the all-in-one operating system for modern companies: CRM, HR, projects, sprints, recruitment, SEO, chat, and analytics in one place.",
      },
      { name: "author", content: "Venus CRM" },
      { property: "og:title", content: "Venus CRM — Enterprise Operating System" },
      {
        property: "og:description",
        content:
          "CRM, HR, projects, sprints, recruitment, SEO, chat, and analytics — unified.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" },
      { rel: "icon", href: "/favicon.ico", type: "image/x-icon" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap",
      },
    ],
    scripts: [
      {
        children: `(function(){if(typeof window==="undefined")return;function isErr(m,e){var str=(m||"")+" "+(e&&e.message?e.message:"")+" "+(e&&e.stack?e.stack:"");return str.indexOf("startTime")!==-1||str.indexOf("reportAllChanges")!==-1}window.addEventListener("error",function(e){if(isErr(e.message,e.error)){e.preventDefault();e.stopImmediatePropagation();return true}},true);var prevErr=window.onerror;window.onerror=function(m,u,l,c,e){if(isErr(m,e))return true;if(typeof prevErr==="function")return prevErr.apply(this,arguments)};window.addEventListener("unhandledrejection",function(e){var r=e.reason;if(r&&isErr(typeof r==="string"?r:r.message,r)){e.preventDefault();e.stopImmediatePropagation()}},true);var origErr=console.error;console.error=function(){var str=Array.prototype.slice.call(arguments).map(function(a){return a instanceof Error?((a.message||"")+" "+(a.stack||"")):String(a)}).join(" ");if(isErr(str))return;return origErr.apply(console,arguments)};var origST=window.setTimeout;window.setTimeout=function(fn,delay){var args=Array.prototype.slice.call(arguments,2);if(typeof fn==="function"){var wrapped=function(){try{return fn.apply(this,arguments)}catch(err){if(isErr(err&&err.message,err))return;throw err}};return origST.apply(this,[wrapped,delay].concat(args))}return origST.apply(this,arguments)};var origSI=window.setInterval;window.setInterval=function(fn,delay){var args=Array.prototype.slice.call(arguments,2);if(typeof fn==="function"){var wrapped=function(){try{return fn.apply(this,arguments)}catch(err){if(isErr(err&&err.message,err))return;throw err}};return origSI.apply(this,[wrapped,delay].concat(args))}return origSI.apply(this,arguments)};var origRAF=window.requestAnimationFrame;if(origRAF){window.requestAnimationFrame=function(fn){var wrapped=function(){try{return fn.apply(this,arguments)}catch(err){if(isErr(err&&err.message,err))return;throw err}};return origRAF.call(this,wrapped)}};if(window.PerformanceObserver){try{var PO=window.PerformanceObserver;var WrapPO=function(cb){return new PO(function(list,obs){try{return cb(list,obs)}catch(err){if(isErr(err&&err.message,err))return;throw err}})};WrapPO.prototype=PO.prototype;WrapPO.supportedEntryTypes=PO.supportedEntryTypes;window.PerformanceObserver=WrapPO}catch(_){}}})();`,
      },
    ],
  }),
  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
  errorComponent: ErrorComponent,
});

function RootShell({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){if(typeof window==="undefined")return;function s(m,e){var t=(m||"")+" "+(e&&e.message?e.message:"")+" "+(e&&e.stack?e.stack:"");return t.indexOf("startTime")!==-1||t.indexOf("reportAllChanges")!==-1}window.addEventListener("error",function(e){if(s(e.message,e.error)){e.preventDefault();e.stopImmediatePropagation();return true}},true);var o=window.onerror;window.onerror=function(m,u,l,c,e){if(s(m,e))return true;if(typeof o==="function")return o.apply(this,arguments)};window.addEventListener("unhandledrejection",function(e){var r=e.reason;if(r&&s(typeof r==="string"?r:r.message,r)){e.preventDefault();e.stopImmediatePropagation()}},true);var ce=console.error;console.error=function(){var str=Array.prototype.slice.call(arguments).map(function(a){return a instanceof Error?((a.message||"")+" "+(a.stack||"")):String(a)}).join(" ");if(s(str))return;return ce.apply(console,arguments)};if(window.PerformanceObserver){try{var O=window.PerformanceObserver;var P=function(cb){return new O(function(list,obs){try{return cb(list,obs)}catch(err){if(s(err&&err.message,err))return;throw err}})};P.prototype=O.prototype;P.supportedEntryTypes=O.supportedEntryTypes;window.PerformanceObserver=P}catch(_){}}})();`,
          }}
        />
        <HeadContent />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  );
}

function RootComponent() {
  const { queryClient } = Route.useRouteContext();

  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
      <Toaster richColors position="bottom-right" />
    </QueryClientProvider>
  );
}
