import { createRootRoute, HeadContent, Outlet, Scripts, redirect } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useEffect } from "react";
import { AuthProvider } from "@/lib/auth/provider";
import { PreviewHostBridge } from "@/components/preview-host-bridge";
import { CookieBanner } from "@/components/cookie-banner";
import { useCookieConsent } from "@/lib/jokes/cookie-consent";
import appCss from "../styles.css?url";

const APP_NAME = "Laugh4.LoL";

const fetchSessionUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getSessionUser } = await import("@/lib/auth/verify.server");
  const u = await getSessionUser();
  return u ? { id: u.id, email: u.email } : null;
});

export const Route = createRootRoute({
  beforeLoad: async ({ location }) => {
    const path = location.pathname;
    const lower = path.toLowerCase();
    if ((lower === "/jokester" || lower === "/admin") && path !== "/admin") {
      throw redirect({ to: "/admin" });
    }
    return { sessionUser: await fetchSessionUser() };
  },
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: APP_NAME },
      { name: "description", content: "We Could All Use A Little Laugh! The living joke vault with Jester Bones." },
      { name: "theme-color", content: "#F6DE4B" },
    ],
    links: [
      { rel: "icon", type: "image/svg+xml", href: "/favicon.svg" },
      { rel: "preconnect", href: "https://fonts.googleapis.com" },
      { rel: "preconnect", href: "https://fonts.gstatic.com", crossOrigin: "anonymous" },
      {
        rel: "stylesheet",
        href: "https://fonts.googleapis.com/css2?family=Figtree:wght@400;500;600;700&family=Lilita+One&display=swap",
      },
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/__grok/manifest.webmanifest" },
      { rel: "apple-touch-icon", href: "/__grok/icon-180.png" },
    ],
  }),
  component: RootDocument,
});

function RootDocument() {
  const hydrateCookies = useCookieConsent((s) => s.hydrate);
  useEffect(() => {
    hydrateCookies();
  }, [hydrateCookies]);

  return (
    <html lang="en" className="antialiased" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="bg-bg font-sans text-ink">
        <PreviewHostBridge />
        <AuthProvider>
          <Outlet />
        </AuthProvider>
        <CookieBanner />
        <Scripts />
      </body>
    </html>
  );
}
