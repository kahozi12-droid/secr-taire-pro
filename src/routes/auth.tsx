import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ShieldCheck, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/auth")({
  component: AuthPage,
});

function AuthPage() {
  const { t, lang, setLang } = useI18n();
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [accountType, setAccountType] = useState<"secretary" | "director">("secretary");

  useEffect(() => {
    if (!loading && session) navigate({ to: "/dashboard" });
  }, [loading, session, navigate]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    // Verify the selected account type matches the user's actual role
    const uid = data.user?.id;
    if (uid) {
      const { data: roles } = await supabase.from("user_roles").select("role").eq("user_id", uid);
      const userRoles = (roles ?? []).map((r) => r.role);
      const expected = accountType;
      if (!userRoles.includes(expected)) {
        await supabase.auth.signOut();
        setBusy(false);
        toast.error(t("accountTypeMismatch"));
        return;
      }
    }
    setBusy(false);
    navigate({ to: "/dashboard" });
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/`,
        data: { full_name: fullName, account_type: accountType },
      },
    });
    setBusy(false);
    if (error) toast.error(error.message);
    else {
      toast.success(t("saved"));
      navigate({ to: "/dashboard" });
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[var(--gradient-primary)] p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 flex items-center justify-center gap-3 text-primary-foreground">
          <div className="flex h-12 w-12 items-center justify-center rounded-md bg-white/15 backdrop-blur">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div>
            <h1 className="text-xl font-semibold">{t("appName")}</h1>
            <p className="text-sm text-white/70">{t("appTagline")}</p>
          </div>
        </div>

        <div className="rounded-xl bg-card p-6 shadow-[var(--shadow-elegant)]">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-lg font-semibold">{t("welcomeBack")}</h2>
              <p className="text-xs text-muted-foreground">{t("accessSecretariat")}</p>
            </div>
            <div className="flex gap-1 rounded-md border border-border p-0.5">
              <button
                onClick={() => setLang("fr")}
                className={`rounded px-2 py-0.5 text-xs ${lang === "fr" ? "bg-primary text-primary-foreground" : ""}`}
              >
                FR
              </button>
              <button
                onClick={() => setLang("en")}
                className={`rounded px-2 py-0.5 text-xs ${lang === "en" ? "bg-primary text-primary-foreground" : ""}`}
              >
                EN
              </button>
            </div>
          </div>

          <Tabs defaultValue="signin">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="signin">{t("signIn")}</TabsTrigger>
              <TabsTrigger value="signup">{t("signUp")}</TabsTrigger>
            </TabsList>

            <TabsContent value="signin">
              <form onSubmit={handleSignIn} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label htmlFor="si-email">{t("email")}</Label>
                  <Input id="si-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="si-pw">{t("password")}</Label>
                  <Input id="si-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="si-type">{t("accountType")}</Label>
                  <Select value={accountType} onValueChange={(v) => setAccountType(v as "secretary" | "director")}>
                    <SelectTrigger id="si-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="director">{t("accountDirector")}</SelectItem>
                      <SelectItem value="secretary">{t("accountSecretary")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("signIn")}
                </Button>
              </form>
            </TabsContent>

            <TabsContent value="signup">
              <form onSubmit={handleSignUp} className="space-y-3 pt-2">
                <div className="space-y-1">
                  <Label htmlFor="su-name">{t("fullName")}</Label>
                  <Input id="su-name" value={fullName} onChange={(e) => setFullName(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="su-email">{t("email")}</Label>
                  <Input id="su-email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="su-pw">{t("password")}</Label>
                  <Input id="su-pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} />
                </div>
                <div className="space-y-1">
                  <Label htmlFor="su-type">{t("accountType")}</Label>
                  <Select value={accountType} onValueChange={(v) => setAccountType(v as "secretary" | "director")}>
                    <SelectTrigger id="su-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="director">{t("accountDirector")}</SelectItem>
                      <SelectItem value="secretary">{t("accountSecretary")}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <Button type="submit" className="w-full" disabled={busy}>
                  {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {t("signUp")}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </div>

        <p className="mt-4 text-center text-xs text-white/70">
          © {new Date().getFullYear()} · Secrétariat Direction
        </p>
      </div>
    </div>
  );
}
