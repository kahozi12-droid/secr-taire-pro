## Objectif

Ajouter un système de classement des rapports dans le menu Rapports, avec 5 classeurs et gestion automatique par année.

## Classeurs

1. Rapports des Missions
2. Rapports Techniques
3. Rapports Financiers
4. Rapports Administratifs
5. Rapports Journaliers (auto-générés — déjà en place)

## Fonctionnalités

- **Onglets** dans `/reports` : un onglet par classeur + l'onglet « Rapport du jour » existant.
- **Sous-classement par année** : à l'intérieur de chaque classeur, les rapports sont regroupés automatiquement par année (ex. « Rapports des Missions 2026 », « Rapports des Missions 2025 »). L'année courante est ouverte par défaut. Au passage à la nouvelle année, un nouveau groupe s'ouvre automatiquement (basé sur `report_date`).
- **Ajout d'un rapport** (secrétaires) : titre, date, description, fichier (PDF/image), classeur cible.
- **Traitement par le directeur** : chaque rapport a un statut « Lu / Non lu par le directeur ». Le directeur (et lui seul) peut marquer comme lu/non lu. Affichage d'un badge visuel + date de lecture.
- **Ouverture du fichier** : clic sur le rapport → aperçu signé (comme pour les courriers).
- **Suppression** : secrétaires uniquement.
- **Rapport journalier** reste sur son onglet actuel (template imprimable inchangé).

## Schéma BDD

Nouvelle table `report_documents` :
- `category` enum: mission | technical | financial | administrative
- `title`, `description`, `report_date` (sert au regroupement par année)
- `file_path`, `file_name`, `mime_type`
- `read_by_director` bool, `read_at`, `read_by`
- `created_by`, timestamps

RLS :
- SELECT : authentifiés
- INSERT/UPDATE/DELETE : secrétaires
- UPDATE du champ « lu » : directeur OU secrétaire (policy dédiée pour le directeur)

Storage : réutilise le bucket `documents` existant, sous-dossier `reports/{category}/{year}/`.

## UI

`src/routes/_app/reports.tsx` réorganisé avec un composant `<Tabs>` :
- Onglet « Journalier » → contenu actuel (template imprimable)
- Un onglet par classeur → liste regroupée par année (accordéon par année), avec bouton « + Nouveau rapport » (secrétaire), badge statut, action « Marquer comme lu » (directeur).

i18n : ajout des libellés FR/EN pour les 4 catégories, statut lu/non lu, ajout de rapport, etc.

## Fichiers touchés

- migration SQL (nouvelle table + RLS + index)
- `src/routes/_app/reports.tsx` (refactor avec Tabs)
- nouveau composant `src/components/ReportFolder.tsx` (liste par année + actions)
- nouveau composant `src/components/NewReportDialog.tsx` (upload)
- `src/lib/i18n.ts` (libellés)
