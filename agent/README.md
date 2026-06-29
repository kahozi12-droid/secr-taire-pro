# DigiCab — Agent Local (Option 2)

Petit pont HTTP installé sur le PC de chaque secrétaire / directeur.
Il expose les **imprimantes et scanners** Windows à l'app web DigiCab
(qui ne peut pas y accéder seule à cause du sandbox du navigateur).

## Pourquoi utiliser cette option ?
- Aucun `.exe` lourd à télécharger (~115 Mo d'Electron).
- L'app web reste à jour automatiquement.
- Détection automatique des imprimantes / scanners installés sur Windows.
- Impression silencieuse (sans la boîte de dialogue) sur une imprimante précise.
- Numérisation déclenchée depuis l'app (si **NAPS2** est installé).

## Installation (≈ 2 min)

1. **Installer Node.js LTS** : <https://nodejs.org> (suivant → suivant → terminer).
2. Décompresser ce dossier `agent/` quelque part (ex. `C:\DigiCab-Agent\`).
3. Double-clic sur **`start.bat`**.
   Une fenêtre noire s'ouvre et affiche :
   ```
   DigiCab Local Agent v1.0.0
   Listening on http://127.0.0.1:17777
   ```
   👉 **Laisser cette fenêtre ouverte** (elle peut être réduite).
4. *(Optionnel)* Double-clic sur **`install-autostart.bat`** pour que
   l'agent démarre automatiquement à chaque ouverture de session.

## Numérisation directe (scanner TWAIN/WIA)
Pour que l'app puisse déclencher un scan, installer aussi
**NAPS2** : <https://www.naps2.com> (gratuit, open-source).
L'agent détecte automatiquement `NAPS2.Console.exe`.

Sans NAPS2, tout le reste fonctionne (impression, liste imprimantes,
lecture du dossier surveillé).

## Vérification
Ouvrir <http://127.0.0.1:17777/health> dans un navigateur → doit afficher
un JSON `{ "ok": true, ... }`.

Dans l'app DigiCab → **Paramètres → Gestion des imprimantes**, le statut
"Agent local" passe à **Connecté** automatiquement.

## Endpoints (référence technique)
| Méthode | URL | Description |
|---|---|---|
| GET  | `/health` | Ping + version |
| GET  | `/printers` | Liste des imprimantes Windows |
| POST | `/print` | `{ printer, fileBase64, filename }` |
| GET  | `/scanners` | Liste des scanners (via NAPS2) |
| POST | `/scan` | Déclenche un scan → renvoie PDF base64 |
| GET  | `/folder/list?path=...` | Liste les fichiers d'un dossier |
| GET  | `/folder/file?path=...` | Renvoie un fichier en base64 |

## Sécurité
- L'agent écoute **uniquement sur `127.0.0.1`** → invisible sur le réseau.
- CORS limité aux domaines DigiCab.
- *(Optionnel)* Définir `DIGICAB_AGENT_TOKEN=monsecret` avant `start.bat`
  pour exiger un en-tête `X-Agent-Token` sur toutes les requêtes.

## Désinstallation
- Fermer la fenêtre noire.
- Supprimer le raccourci `DigiCab Agent.lnk` dans
  `%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup`.
- Supprimer le dossier.
