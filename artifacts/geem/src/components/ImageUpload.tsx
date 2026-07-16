import { useRef } from "react";
import { useImageUpload } from "@/hooks/useImageUpload";
import { Button } from "@/components/ui/button";
import { Upload, X, Image } from "lucide-react";

interface ImageUploadProps {
  value?: string | null;
  onChange: (url: string) => void;
  onClear?: () => void;
  label?: string;
  className?: string;
}

export function ImageUpload({ value, onChange, onClear, label = "Upload Image", className = "" }: ImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { uploadFile, isUploading, progress, error } = useImageUpload({
    onSuccess: (result) => onChange(result.serveUrl),
  });

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    uploadFile(file);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className={`space-y-2 ${className}`}>
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />

      {value ? (
        <div className="relative group rounded-lg overflow-hidden border bg-muted">
          <img src={value} alt="Product" className="w-full h-48 object-cover" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
            <Button size="sm" variant="secondary" onClick={() => fileRef.current?.click()} disabled={isUploading}>
              <Upload className="h-4 w-4 mr-1" />Change
            </Button>
            {onClear && (
              <Button size="sm" variant="destructive" onClick={onClear}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      ) : (
        <div
          className="border-2 border-dashed rounded-lg p-8 flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-colors"
          onClick={() => !isUploading && fileRef.current?.click()}
        >
          {isUploading ? (
            <>
              <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              <p className="text-sm">Uploading... {progress}%</p>
            </>
          ) : (
            <>
              <Image className="h-8 w-8" />
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs">Click to browse — JPG, PNG, WebP</p>
            </>
          )}
        </div>
      )}

      {isUploading && !value && (
        <div className="h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full bg-primary transition-all duration-300 rounded-full" style={{ width: `${progress}%` }} />
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
