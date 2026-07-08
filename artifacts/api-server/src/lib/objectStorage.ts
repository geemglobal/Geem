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
      ".pdf": "application/pdf", ".mp4": "video/mp4",
    };
    const contentType = mime[ext] || "application/octet-stream";
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
