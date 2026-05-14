// Printer assignment by role.
// Secretaries → shared "main" printer. Director → personal printer.
// The application connects to a watched folder where the physical printer
// drops its scans. The logical assignment is automatic; the local folder
// is picked once per device via the File System Access API.

import type { AppRole } from "@/providers/AuthProvider";

export interface PrinterConfig {
  id: string;
  name: string;
  description: string;
  description_en: string;
}

export const PRINTERS: Record<"main" | "director", PrinterConfig> = {
  main: {
    id: "MAIN-PRINTER-01",
    name: "Imprimante Secrétariat",
    description: "Imprimante partagée du secrétariat (4 utilisateurs)",
    description_en: "Shared secretariat printer (4 users)",
  },
  director: {
    id: "DIRECTOR-PRINTER-01",
    name: "Imprimante Direction",
    description: "Imprimante personnelle du Directeur",
    description_en: "Director's personal printer",
  },
};

export function printerForRole(role: AppRole | null): PrinterConfig {
  return role === "director" ? PRINTERS.director : PRINTERS.main;
}
