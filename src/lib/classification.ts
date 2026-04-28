// Classification system per institutional spec.
export type CategoryMain = "SAE" | "ETA" | "CSP" | "JRG";

export interface SubCategory {
  code: string; // e.g. "SAE/DG"
  labelFr: string;
  labelEn: string;
}

export interface Category {
  code: CategoryMain;
  color: "blue" | "green" | "yellow" | "red";
  labelFr: string;
  labelEn: string;
  subs: SubCategory[];
}

export const CATEGORIES: Category[] = [
  {
    code: "SAE",
    color: "blue",
    labelFr: "Service Administratif et Économique",
    labelEn: "Administrative & Economic Service",
    subs: [
      { code: "SAE/DG", labelFr: "Direction Générale", labelEn: "General Direction" },
      { code: "SAE/RAP", labelFr: "Rapports", labelEn: "Reports" },
      { code: "SAE/INT", labelFr: "Affaires Internes", labelEn: "Internal Affairs" },
    ],
  },
  {
    code: "ETA",
    color: "green",
    labelFr: "État",
    labelEn: "State",
    subs: [
      { code: "ETA/MIN", labelFr: "Ministères", labelEn: "Ministries" },
      { code: "ETA/GOUV", labelFr: "Gouvernement", labelEn: "Government" },
      { code: "ETA/SER", labelFr: "Services Étatiques", labelEn: "State Services" },
    ],
  },
  {
    code: "CSP",
    color: "yellow",
    labelFr: "Coopération & Partenariats",
    labelEn: "Cooperation & Partnerships",
    subs: [
      { code: "CSP/SOCI", labelFr: "Société Civile", labelEn: "Civil Society" },
      { code: "CSP/COO", labelFr: "Coopération", labelEn: "Cooperation" },
      { code: "CSP/OP", labelFr: "Opérations", labelEn: "Operations" },
    ],
  },
  {
    code: "JRG",
    color: "red",
    labelFr: "Juridique & Réglementaire",
    labelEn: "Legal & Regulatory",
    subs: [
      { code: "JRG/PAR", labelFr: "Parquet", labelEn: "Prosecution" },
      { code: "JRG/ARR", labelFr: "Arrêtés", labelEn: "Decrees" },
      { code: "JRG/COR", labelFr: "Correspondance Juridique", labelEn: "Legal Correspondence" },
      { code: "JRG/INV", labelFr: "Investigations", labelEn: "Investigations" },
      { code: "JRG/CG", labelFr: "Conseil Général", labelEn: "General Council" },
      { code: "JRG/STA", labelFr: "Statuts", labelEn: "Statutes" },
    ],
  },
];

export function findCategoryByMain(main: string): Category | undefined {
  return CATEGORIES.find((c) => c.code === main);
}

export function findSub(code: string): { cat: Category; sub: SubCategory } | undefined {
  for (const cat of CATEGORIES) {
    const sub = cat.subs.find((s) => s.code === code);
    if (sub) return { cat, sub };
  }
  return undefined;
}

export function categoryColorClasses(color: Category["color"]): {
  text: string;
  bg: string;
  border: string;
  dot: string;
} {
  switch (color) {
    case "blue":
      return {
        text: "text-[var(--cat-sae)]",
        bg: "bg-[var(--cat-sae-bg)]",
        border: "border-[var(--cat-sae)]/30",
        dot: "bg-[var(--cat-sae)]",
      };
    case "green":
      return {
        text: "text-[var(--cat-eta)]",
        bg: "bg-[var(--cat-eta-bg)]",
        border: "border-[var(--cat-eta)]/30",
        dot: "bg-[var(--cat-eta)]",
      };
    case "yellow":
      return {
        text: "text-[var(--cat-csp)]",
        bg: "bg-[var(--cat-csp-bg)]",
        border: "border-[var(--cat-csp)]/40",
        dot: "bg-[var(--cat-csp)]",
      };
    case "red":
      return {
        text: "text-[var(--cat-jrg)]",
        bg: "bg-[var(--cat-jrg-bg)]",
        border: "border-[var(--cat-jrg)]/30",
        dot: "bg-[var(--cat-jrg)]",
      };
  }
}
