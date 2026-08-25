import { useRef, useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Images, X, Upload, CheckCircle2, AlertCircle } from "lucide-react";

interface UploadItem {
  file: File;
  preview: string;
  status: "pending" | "uploading" | "done" | "error";
  url?: string;
  progress: number;
  error?: string;
}

interface MultiImageUploadProps {
  onAdd: (url: string) => void;
  label?: string;
  maxFiles?: number;
  className?: string;
}

export function MultiImageUpload({ onAdd, label = "Add Multiple Photos", maxFiles = 20, className = "" }: MultiImageUploadProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [items, setItems] = useState<UploadItem[]>([]);
  const [isUploading, setIsUploading] = useState(false);

  const uploadFile = useCallback(async (item: UploadItem, updateItem: (id: string, update: Partial<UploadItem>) => void): Promise<string | null> => {
    const id = item.preview; // use preview URL as key
    try {
      const token = localStorage.getItem("geem_token");
      updateItem(id, { status: "uploading", progress: 10 });

      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: item.file.name, size: item.file.size, contentType: item.file.type || "image/jpeg" }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

      updateItem(id, { progress: 50 });

      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: item.file,
        headers: { "Content-Type": item.file.type || "image/jpeg" },
      });
      if (!putRes.ok) throw new Error("Upload failed");

      const serveUrl = `/api/storage${objectPath}`;
      updateItem(id, { status: "done", url: serveUrl, progress: 100 });
      return serveUrl;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      updateItem(id, { status: "error", error: msg, progress: 0 });
      return null;
    }
  }, []);

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []).slice(0, maxFiles);
    if (!files.length) return;
    if (fileRef.current) fileRef.current.value = "";

    const newItems: UploadItem[] = files.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: "pending",
      progress: 0,
    }));

    setItems(newItems);
    setIsUploading(true);

    const updateItem = (id: string, update: Partial<UploadItem>) => {
      setItems(prev => prev.map(it => it.preview === id ? { ...it, ...update } : it));
    };

    // Upload sequentially to avoid overwhelming the server
    for (const item of newItems) {
      const url = await uploadFile(item, updateItem);
      if (url) onAdd(url);
    }

    setIsUploading(false);
  }

  const doneCount = items.filter(i => i.status === "done").length;
  const errorCount = items.filter(i => i.status === "error").length;
  const pendingCount = items.filter(i => i.status === "uploading" || i.status === "pending").length;

  return (
    <div className={`space-y-3 ${className}`}>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleFiles}
      />

      <div
        className="border-2 border-dashed border-primary/40 rounded-xl p-6 flex flex-col items-center justify-center gap-2 text-muted-foreground cursor-pointer hover:border-primary hover:bg-primary/5 transition-colors"
        onClick={() => !isUploading && fileRef.current?.click()}
      >
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Images className="h-6 w-6 text-primary" />
        </div>
        <p className="text-sm font-semibold text-foreground">{label}</p>
        <p className="text-xs text-center">Click to select multiple images at once — JPG, PNG, WebP supported</p>
        <Button size="sm" variant="outline" disabled={isUploading} onClick={e => { e.stopPropagation(); fileRef.current?.click(); }}>
          <Upload className="h-3.5 w-3.5 mr-1.5" />
          {isUploading ? `Uploading ${pendingCount} remaining…` : "Select Files"}
        </Button>
      </div>

      {items.length > 0 && (
        <div className="space-y-2">
          {/* Status summary */}
          {isUploading && (
            <div className="text-xs text-muted-foreground flex items-center gap-2">
              <div className="h-3.5 w-3.5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              Uploading {pendingCount} image{pendingCount !== 1 ? "s" : ""}… {doneCount} done
            </div>
          )}
          {!isUploading && (doneCount > 0 || errorCount > 0) && (
            <div className="text-xs flex items-center gap-3">
              {doneCount > 0 && <span className="flex items-center gap-1 text-green-600"><CheckCircle2 className="h-3.5 w-3.5" />{doneCount} uploaded</span>}
              {errorCount > 0 && <span className="flex items-center gap-1 text-destructive"><AlertCircle className="h-3.5 w-3.5" />{errorCount} failed</span>}
            </div>
          )}

          {/* Preview grid */}
          <div className="grid grid-cols-4 sm:grid-cols-6 gap-2">
            {items.map((item) => (
              <div key={item.preview} className="relative aspect-square rounded-lg overflow-hidden border bg-muted">
                <img src={item.preview} alt="" className="w-full h-full object-cover" />
                {/* Status overlay */}
                {item.status === "uploading" && (
                  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                    <div className="h-6 w-6 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  </div>
                )}
                {item.status === "done" && (
                  <div className="absolute bottom-0 left-0 right-0 bg-green-600/80 flex items-center justify-center py-0.5">
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  </div>
                )}
                {item.status === "error" && (
                  <div className="absolute inset-0 bg-destructive/50 flex items-center justify-center">
                    <AlertCircle className="h-5 w-5 text-white" />
                  </div>
                )}
                {item.status === "pending" && (
                  <div className="absolute inset-0 bg-black/30 flex items-center justify-center">
                    <div className="h-4 w-4 border border-white/50 rounded-full" />
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Clear/retry button after all done */}
          {!isUploading && (
            <Button
              size="sm"
              variant="ghost"
              className="text-xs h-7"
              onClick={() => { items.forEach(it => URL.revokeObjectURL(it.preview)); setItems([]); }}
            >
              <X className="h-3 w-3 mr-1" />Clear preview
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
