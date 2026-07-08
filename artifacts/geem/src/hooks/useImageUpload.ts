import { useState, useCallback } from "react";

interface UploadResult {
  objectPath: string;
  serveUrl: string;
}

interface UseImageUploadOptions {
  onSuccess?: (result: UploadResult) => void;
  onError?: (err: string) => void;
}

export function useImageUpload(options: UseImageUploadOptions = {}) {
  const [isUploading, setIsUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const uploadFile = useCallback(async (file: File): Promise<UploadResult | null> => {
    setIsUploading(true);
    setError(null);
    setProgress(10);
    try {
      const token = localStorage.getItem("geem_token");
      // Step 1: get presigned URL
      const urlRes = await fetch("/api/storage/uploads/request-url", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ name: file.name, size: file.size, contentType: file.type || "image/jpeg" }),
      });
      if (!urlRes.ok) throw new Error("Failed to get upload URL");
      const { uploadURL, objectPath } = await urlRes.json() as { uploadURL: string; objectPath: string };

      setProgress(40);
      // Step 2: PUT file directly to GCS
      const putRes = await fetch(uploadURL, {
        method: "PUT",
        body: file,
        headers: { "Content-Type": file.type || "image/jpeg" },
      });
      if (!putRes.ok) throw new Error("Upload to storage failed");

      setProgress(100);
      // objectPath looks like /objects/<uuid> — serve via /api/storage/objects/<uuid>
      const serveUrl = `/api/storage${objectPath}`;
      const result = { objectPath, serveUrl };
      options.onSuccess?.(result);
      return result;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setError(msg);
      options.onError?.(msg);
      return null;
    } finally {
      setIsUploading(false);
    }
  }, [options]);

  return { uploadFile, isUploading, progress, error };
}
