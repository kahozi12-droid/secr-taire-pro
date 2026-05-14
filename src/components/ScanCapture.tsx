import { useRef, useState } from "react";
import { Camera, Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useI18n } from "@/lib/i18n";

interface Props {
  value: File | null;
  onChange: (f: File | null) => void;
}

export function ScanCapture({ value, onChange }: Props) {
  const { t } = useI18n();
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);

  const handleFile = (f: File | null) => {
    onChange(f);
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(f && (f.type.startsWith("image/") || f.type === "application/pdf") ? URL.createObjectURL(f) : null);
  };

  const isPdf = value?.type === "application/pdf";
  const isImage = value?.type.startsWith("image/");

  return (
    <div className="space-y-3">
      <div className="rounded-lg border-2 border-dashed border-border bg-muted/30 p-6 text-center">
        {value ? (
          <div className="space-y-3">
            {isImage && previewUrl ? (
              <img src={previewUrl} alt="preview" className="mx-auto max-h-64 rounded-md border border-border object-contain" />
            ) : isPdf && previewUrl ? (
              <iframe title={value.name} src={previewUrl} className="mx-auto h-80 w-full rounded-md border border-border bg-card" />
            ) : (
              <div className="mx-auto flex h-32 w-32 items-center justify-center rounded-md bg-card text-xs text-muted-foreground">
                {value.name.split(".").pop()?.toUpperCase()}
              </div>
            )}
            <div className="flex items-center justify-center gap-2 text-sm">
              <span className="font-medium">{value.name}</span>
              <Button variant="ghost" size="sm" onClick={() => handleFile(null)}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="space-y-2">
            <p className="text-sm font-medium">{t("scanOrUpload")}</p>
            <p className="text-xs text-muted-foreground">{t("scanHint")}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
              <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {t("uploadFile")}
              </Button>
              <Button type="button" variant="outline" size="sm" onClick={() => cameraRef.current?.click()}>
                <Camera className="mr-2 h-4 w-4" />
                {t("useCamera")}
              </Button>
            </div>
          </div>
        )}
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
        <input
          ref={cameraRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
        />
      </div>
    </div>
  );
}
