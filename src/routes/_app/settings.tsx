import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/providers/AuthProvider";
import { useI18n } from "@/lib/i18n";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { User, KeyRound, Mail, ShieldCheck, Palette, Bell } from "lucide-react";

export const Route = createFileRoute("/_app/settings")({
  component: SettingsPage,
});

type Preferences = {
  theme?: "light" | "dark" | "system";
  language?: "fr" | "en";
  dateFormat?: "dd/MM/yyyy" | "yyyy-MM-dd" | "MM/dd/yyyy";
  notifyNewMail?: boolean;
  notifyDailyReport?: boolean;
  notifyLegalUpdates?: boolean;
};

function SettingsPage() {
  const { user, fullName, refreshProfile } = useAuth();
  const { lang, setLang } = useI18n();

  // Profile
  const [name, setName] = useState(fullName);
  const [jobTitle, setJobTitle] = useState("");
  const [phone, setPhone] = useState("");
  const [savingProfile, setSavingProfile] = useState(false);

  // Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPwd, setSavingPwd] = useState(false);

  // Email
  const [newEmail, setNewEmail] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  // Preferences
  const [prefs, setPrefs] = useState<Preferences>({
    theme: "system",
    language: lang,
    dateFormat: "dd/MM/yyyy",
    notifyNewMail: true,
    notifyDailyReport: true,
    notifyLegalUpdates: false,
  });
  const [savingPrefs, setSavingPrefs] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await supabase
        .from("profiles")
        .select("full_name, job_title, phone, preferences")
        .eq("id", user.id)
        .maybeSingle();
      if (data) {
        setName(data.full_name ?? "");
        // @ts-expect-error - new columns until types regenerate
        setJobTitle(data.job_title ?? "");
        // @ts-expect-error
        setPhone(data.phone ?? "");
        // @ts-expect-error
        const p = (data.preferences ?? {}) as Preferences;
        setPrefs((prev) => ({ ...prev, ...p, language: p.language ?? lang }));
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id]);

  const saveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: name, job_title: jobTitle, phone } as never)
      .eq("id", user.id);
    setSavingProfile(false);
    if (error) return toast.error(error.message);
    toast.success("Profil enregistré");
    await refreshProfile();
  };

  const savePassword = async () => {
    if (newPassword.length < 8) return toast.error("Min. 8 caractères");
    if (newPassword !== confirmPassword) return toast.error("Les mots de passe ne correspondent pas");
    setSavingPwd(true);
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setSavingPwd(false);
    if (error) return toast.error(error.message);
    setNewPassword("");
    setConfirmPassword("");
    toast.success("Mot de passe mis à jour");
  };

  const saveEmail = async () => {
    if (!newEmail.includes("@")) return toast.error("E-mail invalide");
    setSavingEmail(true);
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    setSavingEmail(false);
    if (error) return toast.error(error.message);
    toast.success("E-mail de confirmation envoyé");
  };

  const savePrefs = async () => {
    if (!user) return;
    setSavingPrefs(true);
    const { error } = await supabase
      .from("profiles")
      .update({ preferences: prefs } as never)
      .eq("id", user.id);
    setSavingPrefs(false);
    if (error) return toast.error(error.message);
    if (prefs.language && prefs.language !== lang) setLang(prefs.language);
    toast.success("Préférences enregistrées");
  };

  const signOutEverywhere = async () => {
    const { error } = await supabase.auth.signOut({ scope: "global" });
    if (error) return toast.error(error.message);
    toast.success("Déconnexion sur tous les appareils");
  };

  const pwdStrength = (() => {
    let s = 0;
    if (newPassword.length >= 8) s++;
    if (/[A-Z]/.test(newPassword)) s++;
    if (/[0-9]/.test(newPassword)) s++;
    if (/[^A-Za-z0-9]/.test(newPassword)) s++;
    return s;
  })();
  const strengthLabel = ["Très faible", "Faible", "Moyen", "Fort", "Très fort"][pwdStrength];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Paramètres de compte</h1>
        <p className="text-sm text-muted-foreground">
          Gérez votre profil, votre sécurité et vos préférences.
        </p>
      </div>

      <Tabs defaultValue="profile" className="space-y-4">
        <TabsList className="grid w-full grid-cols-3 md:grid-cols-6">
          <TabsTrigger value="profile" className="gap-1"><User className="h-4 w-4" />Profil</TabsTrigger>
          <TabsTrigger value="password" className="gap-1"><KeyRound className="h-4 w-4" />Mot de passe</TabsTrigger>
          <TabsTrigger value="email" className="gap-1"><Mail className="h-4 w-4" />E-mail</TabsTrigger>
          <TabsTrigger value="security" className="gap-1"><ShieldCheck className="h-4 w-4" />Sécurité</TabsTrigger>
          <TabsTrigger value="display" className="gap-1"><Palette className="h-4 w-4" />Affichage</TabsTrigger>
          <TabsTrigger value="notifications" className="gap-1"><Bell className="h-4 w-4" />Notifications</TabsTrigger>
        </TabsList>

        <TabsContent value="profile">
          <Card>
            <CardHeader>
              <CardTitle>Profil personnel</CardTitle>
              <CardDescription>Informations affichées dans l'application.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nom complet</Label>
                <Input value={name} onChange={(e) => setName(e.target.value)} maxLength={120} />
              </div>
              <div className="space-y-2">
                <Label>Fonction / Titre</Label>
                <Input value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} maxLength={120} placeholder="Ex: Secrétaire de direction" />
              </div>
              <div className="space-y-2">
                <Label>Téléphone</Label>
                <Input value={phone} onChange={(e) => setPhone(e.target.value)} maxLength={30} placeholder="+243 ..." />
              </div>
              <Button onClick={saveProfile} disabled={savingProfile}>
                {savingProfile ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="password">
          <Card>
            <CardHeader>
              <CardTitle>Modifier le mot de passe</CardTitle>
              <CardDescription>Choisissez un mot de passe robuste (8+ caractères).</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nouveau mot de passe</Label>
                <Input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} />
                {newPassword && (
                  <div className="flex items-center gap-2">
                    <div className="flex h-1.5 flex-1 gap-1">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-full flex-1 rounded ${
                            i < pwdStrength
                              ? pwdStrength <= 1
                                ? "bg-destructive"
                                : pwdStrength === 2
                                ? "bg-yellow-500"
                                : "bg-green-500"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>
                    <span className="text-xs text-muted-foreground">{strengthLabel}</span>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                <Label>Confirmer le mot de passe</Label>
                <Input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} />
              </div>
              <Button onClick={savePassword} disabled={savingPwd || !newPassword}>
                {savingPwd ? "Enregistrement…" : "Mettre à jour"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="email">
          <Card>
            <CardHeader>
              <CardTitle>Adresse e-mail</CardTitle>
              <CardDescription>
                Actuelle : <span className="font-medium">{user?.email}</span>. Un lien de confirmation sera envoyé à la nouvelle adresse.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Nouvelle adresse e-mail</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} maxLength={255} />
              </div>
              <Button onClick={saveEmail} disabled={savingEmail || !newEmail}>
                {savingEmail ? "Envoi…" : "Envoyer la confirmation"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="security">
          <Card>
            <CardHeader>
              <CardTitle>Sécurité du compte</CardTitle>
              <CardDescription>Gérez vos sessions actives.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="rounded-md border p-4">
                <p className="text-sm font-medium">Session actuelle</p>
                <p className="text-xs text-muted-foreground">
                  Connecté en tant que {user?.email}
                </p>
              </div>
              <div className="rounded-md border border-dashed p-4">
                <p className="text-sm font-medium">Authentification à deux facteurs (2FA)</p>
                <p className="text-xs text-muted-foreground">
                  Bientôt disponible. Activez la 2FA pour renforcer votre compte.
                </p>
              </div>
              <Button variant="destructive" onClick={signOutEverywhere}>
                Déconnecter tous les appareils
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="display">
          <Card>
            <CardHeader>
              <CardTitle>Préférences d'affichage</CardTitle>
              <CardDescription>Langue, thème et format de date.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Langue</Label>
                <Select
                  value={prefs.language}
                  onValueChange={(v) => setPrefs({ ...prefs, language: v as "fr" | "en" })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="fr">Français</SelectItem>
                    <SelectItem value="en">English</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Thème</Label>
                <Select
                  value={prefs.theme}
                  onValueChange={(v) => setPrefs({ ...prefs, theme: v as Preferences["theme"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="system">Système</SelectItem>
                    <SelectItem value="light">Clair</SelectItem>
                    <SelectItem value="dark">Sombre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Format de date</Label>
                <Select
                  value={prefs.dateFormat}
                  onValueChange={(v) => setPrefs({ ...prefs, dateFormat: v as Preferences["dateFormat"] })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="dd/MM/yyyy">31/12/2026</SelectItem>
                    <SelectItem value="yyyy-MM-dd">2026-12-31</SelectItem>
                    <SelectItem value="MM/dd/yyyy">12/31/2026</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={savePrefs} disabled={savingPrefs}>
                {savingPrefs ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="notifications">
          <Card>
            <CardHeader>
              <CardTitle>Notifications</CardTitle>
              <CardDescription>Choisissez les alertes que vous souhaitez recevoir.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Nouveau courrier arrivé</p>
                  <p className="text-xs text-muted-foreground">Alerte par e-mail à chaque nouveau document.</p>
                </div>
                <Switch
                  checked={!!prefs.notifyNewMail}
                  onCheckedChange={(v) => setPrefs({ ...prefs, notifyNewMail: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Rapport journalier</p>
                  <p className="text-xs text-muted-foreground">Récapitulatif quotidien des activités.</p>
                </div>
                <Switch
                  checked={!!prefs.notifyDailyReport}
                  onCheckedChange={(v) => setPrefs({ ...prefs, notifyDailyReport: v })}
                />
              </div>
              <div className="flex items-center justify-between rounded-md border p-3">
                <div>
                  <p className="text-sm font-medium">Veille juridique</p>
                  <p className="text-xs text-muted-foreground">Alerte sur les nouveaux textes ajoutés à la bibliothèque.</p>
                </div>
                <Switch
                  checked={!!prefs.notifyLegalUpdates}
                  onCheckedChange={(v) => setPrefs({ ...prefs, notifyLegalUpdates: v })}
                />
              </div>
              <Button onClick={savePrefs} disabled={savingPrefs}>
                {savingPrefs ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
