// Predefined legal text types (classification by type of text).
export const LEGAL_TEXT_TYPES = [
  "Constitution",
  "Loi",
  "Loi organique",
  "Ordonnance",
  "Décret",
  "Arrêté",
  "Circulaire",
  "Règlement",
  "Décision",
  "Convention",
  "Jurisprudence",
  "Autre",
] as const;

export type LegalTextType = (typeof LEGAL_TEXT_TYPES)[number];

export const LEGAL_RELATIONS: { value: string; label: string }[] = [
  { value: "related", label: "Lié à" },
  { value: "modifies", label: "Modifie" },
  { value: "abrogates", label: "Abroge" },
  { value: "implements", label: "Met en œuvre" },
  { value: "cites", label: "Cite" },
];

export function relationLabel(v: string): string {
  return LEGAL_RELATIONS.find((r) => r.value === v)?.label ?? v;
}
