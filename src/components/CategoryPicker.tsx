import { CATEGORIES, categoryColorClasses, findSub } from "@/lib/classification";
import { useI18n } from "@/lib/i18n";

interface Props {
  value: string;
  onChange: (sub: string) => void;
}

export function CategoryPicker({ value, onChange }: Props) {
  const { lang } = useI18n();
  return (
    <div className="space-y-3">
      {CATEGORIES.map((cat) => {
        const c = categoryColorClasses(cat.color);
        return (
          <div key={cat.code} className={`rounded-lg border ${c.border} ${c.bg} p-3`}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`h-2.5 w-2.5 rounded-full ${c.dot}`} />
              <p className={`text-sm font-semibold ${c.text}`}>
                {cat.code} — {lang === "fr" ? cat.labelFr : cat.labelEn}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {cat.subs.map((sub) => {
                const active = value === sub.code;
                return (
                  <button
                    key={sub.code}
                    type="button"
                    onClick={() => onChange(sub.code)}
                    className={[
                      "rounded-md border px-2.5 py-1 text-xs transition-all",
                      active
                        ? `${c.dot} text-white border-transparent shadow-sm`
                        : "border-border bg-card hover:border-foreground/30",
                    ].join(" ")}
                  >
                    {sub.code} · {lang === "fr" ? sub.labelFr : sub.labelEn}
                  </button>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function CategoryBadge({ code }: { code: string }) {
  const found = findSub(code);
  if (!found) return <span className="text-xs text-muted-foreground">{code}</span>;
  const c = categoryColorClasses(found.cat.color);
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-xs font-medium ${c.bg} ${c.border} ${c.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${c.dot}`} />
      {code}
    </span>
  );
}
