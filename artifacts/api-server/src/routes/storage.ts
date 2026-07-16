import { Router, type IRouter, type Request, type Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { randomUUID } from "crypto";
import { ObjectStorageService, ObjectNotFoundError } from "../lib/objectStorage";

const router: IRouter = Router();
const objectStorageService = new ObjectStorageService();

function getUploadsDir(): string {
  return process.env.UPLOADS_DIR || path.join(process.cwd(), "uploads");
}

// Request a "upload URL" — in local-disk mode we return a direct-upload path
router.post("/storage/uploads/request-url", async (req: Request, res: Response): Promise<void> => {
  const { name, size, contentType } = (req.body ?? {}) as Record<string, unknown>;
  if (!name || !size || !contentType) {
    res.status(400).json({ error: "Required: name, size, contentType" });
    return;
  }
  try {
    const uuid = randomUUID();
    const uploadURL = `/api/storage/uploads/direct/${uuid}`;
    const objectPath = `/objects/uploads/${uuid}`;
    res.json({ uploadURL, objectPath, metadata: { name, size, contentType } });
  } catch (error) {
    req.log.error({ err: error }, "Error generating upload URL");
    res.status(500).json({ error: "Failed to generate upload URL" });
  }
});

// Direct file upload endpoint (replaces GCS presigned PUT)
router.put("/storage/uploads/direct/:uuid", async (req: Request, res: Response): Promise<void> => {
  const uuid = String(req.params["uuid"] ?? "");
  if (!uuid || !/^[0-9a-f-]{36}$/.test(uuid)) {
    res.status(400).json({ error: "Invalid upload ID" });
    return;
  }
  const uploadsDir = path.join(getUploadsDir(), "uploads");
  if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });
  const filePath = path.join(uploadsDir, uuid);
  try {
    await new Promise<void>((resolve, reject) => {
      const write = fs.createWriteStream(filePath);
      req.pipe(write);
      write.on("finish", resolve);
      write.on("error", reject);
      req.on("error", reject);
    });
    res.status(200).json({ ok: true });
  } catch (err) {
    req.log.error({ err }, "Direct upload failed");
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    res.status(500).json({ error: "Upload failed" });
  }
});

// Serve public objects (not auth-gated)
router.get("/storage/public-objects/*filePath", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.params["filePath"];
    const filePath = Array.isArray(raw) ? (raw as string[]).join("/") : String(raw ?? "");
    const file = await objectStorageService.searchPublicObject(filePath);
    if (!file) { res.status(404).json({ error: "File not found" }); return; }
    const response = await objectStorageService.downloadObject(file);
    const headers = Object.fromEntries(response.headers.entries());
    res.set(headers);
    const buf = await response.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (error) {
    req.log.error({ err: error }, "Error serving public object");
    res.status(500).json({ error: "Failed to serve file" });
  }
});

// Serve private/uploaded objects
router.get("/storage/objects/*objectPath", async (req: Request, res: Response): Promise<void> => {
  try {
    const raw = req.params["objectPath"];
    const objectPath = "/objects/" + (Array.isArray(raw) ? (raw as string[]).join("/") : String(raw ?? ""));
    const file = await objectStorageService.getObjectEntityFile(objectPath);
    const response = await objectStorageService.downloadObject(file, 3600);
    const headers = Object.fromEntries(response.headers.entries());
    res.set(headers);
    const buf = await response.arrayBuffer();
    res.send(Buffer.from(buf));
  } catch (error) {
    if (error instanceof ObjectNotFoundError) { res.status(404).json({ error: "File not found" }); return; }
    req.log.error({ err: error }, "Error serving object");
    res.status(500).json({ error: "Failed to serve file" });
  }
});

export default router;
