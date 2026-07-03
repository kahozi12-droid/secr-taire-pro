import { Outlet, createRootRoute, HeadContent, Scripts, Link } from "@tanstack/react-router";
import appCss from "../styles.css?url";
import { AppProviders } from "@/providers/AppProviders";

function NotFoundComponent() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="max-w-md text-center">
        <h1 className="text-7xl font-bold text-foreground">404</h1>
        <p className="mt-4 text-sm text-muted-foreground">
          Page introuvable / Page not found
        </p>
        <div className="mt-6">
          <Link
            to="/"
            className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
          >
            Accueil / Home
          </Link>
        </div>
      </div>
    </div>
  );
}

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1, viewport-fit=cover, maximum-scale=1" },
      { title: "Digicab — Gestion documentaire" },
      {
        name: "description",
        content:
          "Application de gestion du courrier, des documents administratifs et juridiques pour le secrétariat de direction.",
      },
      { name: "theme-color", content: "#0b1220" },
      { name: "apple-mobile-web-app-capable", content: "yes" },
      { name: "apple-mobile-web-app-status-bar-style", content: "black-translucent" },
      { name: "apple-mobile-web-app-title", content: "Secrétariat" },
      { name: "mobile-web-app-capable", content: "yes" },
      { property: "og:title", content: "Digicab — Gestion documentaire" },
      { name: "twitter:title", content: "Digicab — Gestion documentaire" },
      { name: "description", content: "Secrétaire Pro automates administrative tasks and document management for public institutions." },
      { property: "og:description", content: "Secrétaire Pro automates administrative tasks and document management for public institutions." },
      { name: "twitter:description", content: "Secrétaire Pro automates administrative tasks and document management for public institutions." },
      { property: "og:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fd581cd0-6ca6-411e-8a7a-ec60511a6b6e/id-preview-50c51cb8--59db28e4-70a3-49b8-a87c-b1f37b6976a8.lovable.app-1783067062069.png" },
      { name: "twitter:image", content: "https://pub-bb2e103a32db4e198524a2e9ed8f35b4.r2.dev/fd581cd0-6ca6-411e-8a7a-ec60511a6b6e/id-preview-50c51cb8--59db28e4-70a3-49b8-a87c-b1f37b6976a8.lovable.app-1783067062069.png" },
      { name: "twitter:card", content: "summary_large_image" },
      { property: "og:type", content: "website" },
    ],
    links: [
      { rel: "stylesheet", href: appCss },
      { rel: "manifest", href: "/manifest.webmanifest" },
      { rel: "icon", href: "/favicon.ico" },
      { rel: "apple-touch-icon", href: "/apple-touch-icon.png" },
    ],
  }),

  shellComponent: RootShell,
  component: RootComponent,
  notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <head>
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
  return (
    <AppProviders>
      <Outlet />
    </AppProviders>
  );
}
