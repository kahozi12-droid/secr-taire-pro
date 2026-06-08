import type { CapacitorConfig } from "@capacitor/cli";

/**
 * Capacitor configuration for the native Android / iOS shell.
 *
 * The app is server-rendered (TanStack Start on Cloudflare Workers), so the
 * native shell loads the published URL directly instead of bundling a static
 * build. Replace `server.url` with your own published / custom domain when
 * shipping to the App Store / Play Store.
 *
 * See MOBILE.md at the project root for the full build instructions.
 */
const config: CapacitorConfig = {
  appId: "app.lovable.59db28e470a349b8a87cb1f37b6976a8",
  appName: "Secrétariat Direction",
  // For production native builds, point at your published Lovable URL or custom domain.
  webDir: "dist",
  server: {
    url: "https://id-preview--59db28e4-70a3-49b8-a87c-b1f37b6976a8.lovable.app",
    cleartext: false,
    androidScheme: "https",
  },
  ios: {
    contentInset: "always",
  },
  android: {
    backgroundColor: "#0b1220",
  },
};

export default config;
