# Portage mobile — Guide

Ce projet supporte trois modes mobiles :

## 1. Responsive Web (déjà actif)
Toutes les pages s'adaptent automatiquement aux écrans téléphone / tablette :
barre de navigation en bas façon app, en-tête sticky avec safe-area iOS,
tableaux scrollables horizontalement.

Aucune installation requise — accessible depuis le navigateur.

## 2. PWA installable (déjà actif)
L'app peut être installée sur l'écran d'accueil iOS / Android :

- **iOS Safari** : Partager → "Sur l'écran d'accueil"
- **Android Chrome** : Menu ⋮ → "Installer l'application"

Fichiers : `public/manifest.webmanifest`, icônes `public/icon-*.png`,
balises meta dans `src/routes/__root.tsx`.

## 3. App native (Capacitor) — Android & iOS

La configuration est dans `capacitor.config.ts`. Comme l'app utilise du SSR
sur Cloudflare, le shell natif charge directement l'URL publiée (pas de
build statique). Mets à jour `server.url` avec ton domaine personnalisé
avant de publier sur les stores.

### Installer les dépendances Capacitor

```bash
bun add @capacitor/core @capacitor/cli @capacitor/android @capacitor/ios
```

### Initialiser les plateformes (1ère fois)

```bash
bunx cap add android
bunx cap add ios   # macOS uniquement
```

### Synchroniser après modifications

```bash
bunx cap sync
```

### Ouvrir dans Android Studio / Xcode

```bash
bunx cap open android
bunx cap open ios
```

### Publier
- **Android** : Build → Generate Signed Bundle → uploader sur Google Play.
- **iOS** : Xcode → Product → Archive → uploader via Transporter sur App Store Connect.

### Note
Tu dois installer **Android Studio** (Android) et / ou **Xcode** (iOS) sur
ta propre machine — ces outils ne peuvent pas tourner dans Lovable.
