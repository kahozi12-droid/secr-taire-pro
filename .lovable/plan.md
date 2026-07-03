# Gestion de Cloud — nouveau menu latéral

Ajout d'un nouveau libellé **« Gestion de Cloud »** dans la barre latérale (icône nuage), placé entre « Tableau de bord » et « Imprimante/Scanner ». Route dédiée `/cloud` avec une interface complète en onglets.

## Structure de la page (`/cloud`)

Barre supérieure : sélecteur d'année · statistiques rapides (nb fichiers, taille totale) · bouton **Initialiser structure** · bouton **Synchroniser tout**.

En dessous, 5 onglets :

### 1. Explorateur
- Vue arborescente à gauche (Année → Mois → Entrants/Sortants → Sous-catégorie).
- Panneau droit : liste des fichiers du dossier sélectionné avec taille et date.
- Fil d'Ariane cliquable.
- Actions par fichier : **Aperçu** (URL signée), **Télécharger**, **Renommer**, **Déplacer**, **Supprimer** (→ corbeille).
- Actions dossier : **Nouveau dossier**, **Téléverser fichiers** (drag & drop multi-fichiers), **Télécharger le dossier en ZIP**.

### 2. Recherche
- Champ de recherche global (nom de fichier + référence).
- Filtres : année, mois, groupe (Entrants/Sortants), sous-catégorie, plage de dates.
- Résultats cliquables → ouverture aperçu.

### 3. Statistiques
- Cartes : total fichiers, taille totale, dernière synchro.
- Graphique répartition par catégorie (barres).
- Graphique répartition par mois (aires).
- Top 5 des sous-catégories les plus remplies.

### 4. Synchronisation
- Vue côte à côte **Cloud ↔ Local** pour l'année sélectionnée.
- Trois listes : présent des deux côtés, seulement cloud, seulement local.
- Boutons : **Envoyer vers cloud**, **Télécharger vers local**, **Tout synchroniser**.
- Barre de progression pendant l'opération.
- Panneau **Journal de synchronisation** en bas : historique des 20 dernières synchros (date, sens, nb fichiers, erreurs).

### 5. Sécurité
- **Corbeille** : fichiers supprimés < 30 jours, avec **Restaurer** / **Supprimer définitivement**.
- **Journal d'activité** : qui a téléversé/supprimé/renommé quoi et quand (filtrable).
- **Permissions par dossier** : lecture seule côté secrétaire vs directeur (basée sur les rôles existants — pas de nouvelle table de permissions par dossier, on réutilise `user_roles`). Le directeur peut tout, les secrétaires peuvent gérer sauf la corbeille définitive et le journal complet.

## Détails techniques

### Base de données (une seule migration)

Trois nouvelles tables dans `public` :

```text
cloud_trash
  id uuid pk
  original_path text        -- chemin relatif dans scanner-archive
  trashed_path  text        -- chemin dans scanner-archive/.trash/
  size          bigint
  trashed_at    timestamptz default now()
  trashed_by    uuid → auth.users
  auto_purge_at timestamptz  -- trashed_at + 30 days

cloud_activity_log
  id uuid pk
  user_id      uuid
  action       text  -- upload | download | delete | rename | move | mkdir | sync | restore | purge
  path         text
  target_path  text  -- pour rename/move
  bytes        bigint
  created_at   timestamptz default now()

cloud_sync_log
  id uuid pk
  user_id      uuid
  direction    text  -- to_cloud | to_local | both
  scope        text  -- ex "2026" ou "2026/01-Janvier"
  files_synced int
  files_skipped int
  errors       int
  duration_ms  int
  created_at   timestamptz default now()
```

RLS : SELECT pour authentifiés, INSERT pour authentifiés (`user_id = auth.uid()`), DELETE réservée au directeur (`has_role`).

### Fichiers ajoutés / modifiés

- **Nouveau** `src/routes/_app/cloud.tsx` — page principale avec Tabs.
- **Nouveau** `src/components/cloud/CloudExplorer.tsx` — arborescence + liste + actions fichier/dossier.
- **Nouveau** `src/components/cloud/CloudSearch.tsx`.
- **Nouveau** `src/components/cloud/CloudStats.tsx` (recharts).
- **Nouveau** `src/components/cloud/CloudSync.tsx` — diff Cloud/Local + boutons + journal.
- **Nouveau** `src/components/cloud/CloudSecurity.tsx` — corbeille + activity log.
- **Nouveau** `src/components/cloud/FilePreviewDialog.tsx` — aperçu PDF/image (réutilise le pattern existant).
- **Nouveau** `src/components/cloud/RenameMoveDialog.tsx`.
- **Étendu** `src/lib/scannerArchive.ts` — ajout `cloudRename`, `cloudMove`, `cloudSoftDelete`, `cloudRestore`, `cloudPurge`, `cloudWalkAll`, `cloudZipDownload`, `cloudStats`.
- **Nouveau** `src/lib/cloudActivity.ts` — helpers d'insertion dans `cloud_activity_log` et `cloud_sync_log`.
- **Modifié** `src/components/AppShell.tsx` — ajout du menu « Gestion de Cloud » (icône `Cloud`) entre Tableau de bord et Imprimante/Scanner.
- **Modifié** `src/lib/i18n.ts` — libellés FR/EN.

### Bibliothèques
- `jszip` pour le téléchargement de dossiers en ZIP (nouvelle dépendance).

### Sécurité
- Toutes les opérations passent par le client Supabase authentifié — RLS Storage inchangée (`{uid}/scanner-archive/...`).
- Suppression = déplacement vers `{uid}/scanner-archive/.trash/{timestamp}_{originalPath}`, jamais `remove()` direct. Purge réelle après 30 jours ou via bouton directeur.
- Chaque action utilisateur est loggée dans `cloud_activity_log`.

## Ce qui reste inchangé
- Le workflow d'archivage automatique (`ArchiveChoiceDialog`) et la structure des dossiers.
- Les boutons de synchro dans `dashboard.tsx` et `scanner.tsx` (ils restent, complémentaires).
- Les rôles existants (`secretary` / `director`).

Valide ce plan et je passe à l'implémentation.
