import { randomUUID } from "crypto";
import * as fs from "fs";
import * as path from "path";
import * as stream from "stream";

// Local-disk replacement for the Replit GCS-backed object storage.
// Files are stored under UPLOADS_DIR (default: /var/www/geem/uploads).
// The API serves them via GET /api/storage/objects/* and
// GET /api/storage/public-objects/*.

function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

function ensureDir(dir: string) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

// Detect content type from file signature (magic bytes) when the file has
// no extension — this is the case for all uploads, which are stored as
// bare UUIDs under UPLOADS_DIR/uploads/<uuid>.
function sniffContentType(data: Buffer): string | null {
  const PNG_SIG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  if (data.length >= 8 && PNG_SIG.every((b, i) => data[i] === b)) return "image/png";
  if (data.length >= 3 && data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "image/jpeg";
  if (data.length >= 6 && data.subarray(0, 6).toString("ascii") === "GIF87a") return "image/gif";
  if (data.length >= 6 && data.subarray(0, 6).toString("ascii") === "GIF89a") return "image/gif";
  if (data.length >= 12 && data.subarray(0, 4).toString("ascii") === "RIFF" && data.subarray(8, 12).toString("ascii") === "WEBP") return "image/webp";
  if (data.length >= 4 && data[0] === 0x00 && data[1] === 0x00 && data[2] === 0x01 && data[3] === 0x00) return "image/x-icon";
  if (data.length >= 4 && data.subarray(0, 4).toString("ascii") === "%PDF") return "application/pdf";
  // SVG only — require an actual <svg root element, not just any XML document,
  // so generic XML doesn't get promoted to a scriptable image type.
  const head = data.subarray(0, Math.min(data.length, 1024)).toString("utf8").trimStart();
  if (/^(<\?xml[^>]*>\s*)?(<!--.*?-->\s*)*<svg[\s>]/is.test(head)) return "image/svg+xml";
  return null;
}

export class ObjectNotFoundError extends Error {
  constructor() {
    super("Object not found");
    this.name = "ObjectNotFoundError";
    Object.setPrototypeOf(this, ObjectNotFoundError.prototype);
  }
}

// Minimal stub so storage.ts compiles without GCS types
export const objectStorageClient = null;

export class ObjectStorageService {
  constructor() {
    ensureDir(path.join(getUploadsDir(), "uploads"));
    ensureDir(path.join(getUploadsDir(), "public"));
  }

  // Return an internal upload token that the client will POST files to
  // via /api/storage/uploads/direct-upload
  async getObjectEntityUploadURL(): Promise<string> {
    const objectId = randomUUID();
    // Return a relative path the client will POST to
    return `/api/storage/uploads/direct/${objectId}`;
  }

  normalizeObjectEntityPath(rawPath: string): string {
    // rawPath is already /api/storage/uploads/direct/<uuid>
    // Convert to the served path: /api/storage/objects/uploads/<uuid>
    if (rawPath.startsWith("/api/storage/uploads/direct/")) {
      const uuid = rawPath.slice("/api/storage/uploads/direct/".length);
      return `/objects/uploads/${uuid}`;
    }
    return rawPath;
  }

  async searchPublicObject(filePath: string): Promise<{ filePath: string } | null> {
    const fullPath = path.join(getUploadsDir(), "public", filePath);
    if (fs.existsSync(fullPath)) return { filePath: fullPath };
    return null;
  }

  async downloadObject(file: { filePath: string }, cacheTtlSec: number = 3600): Promise<Response> {
    if (!fs.existsSync(file.filePath)) throw new ObjectNotFoundError();
    const data = fs.readFileSync(file.filePath);
    const ext = path.extname(file.filePath).toLowerCase();
    const mime: Record<string, string> = {
      ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
      ".gif": "image/gif", ".webp": "image/webp", ".svg": "image/svg+xml",
      ".pdf": "application/pdf", ".mp4": "video/mp4", ".ico": "image/x-icon",
    };
    // Uploaded files are stored as bare UUIDs with no extension, so extension
    // lookup almost always misses. Sniff the actual bytes as a fallback —
    // otherwise every upload silently falls back to application/octet-stream
    // and browsers refuse to render it as an image.
    const contentType = mime[ext] || sniffContentType(data) || "application/octet-stream";
    return new Response(data, {
      headers: {
        "Content-Type": contentType,
        "Cache-Control": `public, max-age=${cacheTtlSec}`,
        "Content-Length": String(data.length),
      },
    });
  }

  async getObjectEntityFile(objectPath: string): Promise<{ filePath: string }> {
    // objectPath looks like /objects/uploads/<uuid>
    if (!objectPath.startsWith("/objects/")) throw new ObjectNotFoundError();
    const rel = objectPath.slice("/objects/".length); // uploads/<uuid>
    const fullPath = path.join(getUploadsDir(), rel);
    if (!fs.existsSync(fullPath)) throw new ObjectNotFoundError();
    return { filePath: fullPath };
  }

  async trySetObjectEntityAclPolicy(rawPath: string, _aclPolicy: unknown): Promise<string> {
    return this.normalizeObjectEntityPath(rawPath);
  }

  async canAccessObjectEntity(_opts: unknown): Promise<boolean> {
    return true;
  }
}

// Stream helper used by storage routes
export function createFileReadStream(filePath: string): stream.Readable {
  return fs.createReadStream(filePath);
}
