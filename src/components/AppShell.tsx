import { Link, useLocation, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard,
  Inbox,
  Send,
  BookOpen,
  Activity,
  FileBarChart,
  LogOut,
  Languages,
  ShieldCheck,
  Printer,
  Search,
  Settings as SettingsIcon,
  Sparkles,

} from "lucide-react";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ReactNode } from "react";

interface NavItem {
  to: string;
  labelKey: Parameters<ReturnType<typeof useI18n>["t"]>[0];
  icon: typeof LayoutDashboard;
  directorAllowed: boolean;
  secretaryAllowed: boolean;
}

const NAV: NavItem[] = [
  { to: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, directorAllowed: true, secretaryAllowed: true },
  { to: "/scanner", labelKey: "scanner", icon: Printer, directorAllowed: true, secretaryAllowed: true },
  { to: "/incoming", labelKey: "incoming", icon: Inbox, directorAllowed: true, secretaryAllowed: true },
  { to: "/outgoing", labelKey: "outgoing", icon: Send, directorAllowed: true, secretaryAllowed: true },
  { to: "/activity", labelKey: "activity", icon: Activity, directorAllowed: true, secretaryAllowed: true },
  { to: "/search", labelKey: "searchNav", icon: Search, directorAllowed: true, secretaryAllowed: true },
  { to: "/legal", labelKey: "legalLibrary", icon: BookOpen, directorAllowed: true, secretaryAllowed: true },
  { to: "/reports", labelKey: "reports", icon: FileBarChart, directorAllowed: true, secretaryAllowed: true },
  { to: "/assistant", labelKey: "assistant", icon: Sparkles, directorAllowed: true, secretaryAllowed: true },
  { to: "/settings", labelKey: "settings", icon: SettingsIcon, directorAllowed: true, secretaryAllowed: true },
];

export function AppShell({ children }: { children: ReactNode }) {
  const { fullName, role, signOut } = useAuth();
  const { t, lang, setLang } = useI18n();
  const location = useLocation();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    navigate({ to: "/auth" });
  };

  const initials = (fullName || "U")
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const visibleNav = NAV.filter((n) => (role === "director" ? n.directorAllowed : n.secretaryAllowed));

  return (
    <div className="flex min-h-screen bg-background">
      {/* Sidebar (desktop) */}
      <aside className="hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 border-b border-sidebar-border px-5 py-5">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-[var(--primary-glow)] text-primary-foreground shadow-[var(--shadow-elegant)]">
            <ShieldCheck className="h-5 w-5" />
          </div>
          <div className="leading-tight">
            <p className="text-sm font-semibold">{t("appName")}</p>
            <p className="text-xs text-sidebar-foreground/60">{t("appTagline")}</p>
          </div>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-4">
          {visibleNav.map((n) => {
            const active = location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={[
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm transition-colors",
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground",
                ].join(" ")}
              >
                <Icon className="h-4 w-4" />
                <span>{t(n.labelKey)}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-sidebar-border p-3">
          <div className="flex items-center gap-3 rounded-md p-2">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--primary-glow)] text-sm font-semibold text-primary-foreground">
              {initials}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium">{fullName || t("welcomeBack")}</p>
              <p className="text-xs text-sidebar-foreground/60">
                {role === "director" ? t("roleDirector") : t("roleSecretary")}
              </p>
            </div>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header
          className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-card px-4 md:px-6"
          style={{ paddingTop: "env(safe-area-inset-top)" }}
        >
          <div className="flex items-center gap-2 md:hidden">
            <div className="flex h-8 w-8 items-center justify-center rounded-md bg-[var(--primary-glow)] text-primary-foreground">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <p className="text-sm font-semibold truncate">{t("appName")}</p>
          </div>
          <div className="ml-auto flex items-center gap-2">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="gap-2">
                  <Languages className="h-4 w-4" />
                  <span className="text-xs uppercase">{lang}</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setLang("fr")}>{t("french")}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => setLang("en")}>{t("english")}</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>

            <Button variant="ghost" size="sm" onClick={handleSignOut} className="gap-2">
              <LogOut className="h-4 w-4" />
              <span className="hidden sm:inline">{t("signOut")}</span>
            </Button>
          </div>
        </header>

        <main
          className="flex-1 overflow-auto p-4 md:p-6"
          style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 5rem)" }}
        >
          {children}
        </main>

        {/* Mobile bottom nav (app-like) */}
        <nav
          className="fixed bottom-0 left-0 right-0 z-40 flex border-t border-border bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80 md:hidden overflow-x-auto"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {visibleNav.map((n) => {
            const active = location.pathname.startsWith(n.to);
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={[
                  "flex min-w-[68px] flex-1 flex-col items-center justify-center gap-1 px-2 py-2 text-[10px] whitespace-nowrap",
                  active ? "text-primary" : "text-muted-foreground",
                ].join(" ")}
              >
                <Icon className={["h-5 w-5", active ? "scale-110" : ""].join(" ")} />
                <span className="leading-none">{t(n.labelKey)}</span>
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

