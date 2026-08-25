"use strict";
const http    = require("http");
const crypto  = require("crypto");
const { spawn } = require("child_process");
const fs      = require("fs");

const SECRET  = process.env.WEBHOOK_SECRET || "";
const PORT    = process.env.WEBHOOK_PORT   || 9001;
const SCRIPT  = "/var/www/geempk/deploy.sh";
const LOG     = "/var/log/geem-deploy.log";

let deploying = false;

function verify(body, sig) {
  if (!SECRET) return true;
  const digest = "sha256=" + crypto.createHmac("sha256", SECRET).update(body).digest("hex");
  try { return crypto.timingSafeEqual(Buffer.from(digest), Buffer.from(sig)); }
  catch { return false; }
}

const server = http.createServer((req, res) => {
  if (req.method !== "POST" || req.url !== "/webhook/deploy") {
    res.writeHead(404); res.end("not found"); return;
  }

  let body = "";
  req.on("data", d => body += d);
  req.on("end", () => {
    const sig = req.headers["x-hub-signature-256"] || "";
    if (!verify(body, sig)) {
      res.writeHead(401); res.end("Unauthorized"); return;
    }

    let event;
    try { event = JSON.parse(body); } catch { res.writeHead(400); res.end("bad json"); return; }

    const ghEvent = req.headers["x-github-event"];
    if (ghEvent !== "push" || event.ref !== "refs/heads/main") {
      res.writeHead(200); res.end("ignored"); return;
    }

    if (deploying) {
      res.writeHead(202); res.end("deploy already running — skipped"); return;
    }

    res.writeHead(202); res.end("deploy queued");
    deploying = true;

    // Use fs.openSync to get a real file descriptor — spawn requires an fd integer, not a Stream
    const fd = fs.openSync(LOG, "a");
    const proc = spawn("bash", [SCRIPT], { stdio: ["ignore", fd, fd] });
    proc.on("close", code => {
      try { fs.closeSync(fd); } catch {}
      deploying = false;
      console.log("[webhook] deploy exited with code", code);
    });
    proc.on("error", err => {
      try { fs.closeSync(fd); } catch {}
      deploying = false;
      console.error("[webhook] spawn error:", err.message);
    });
  });
});

server.listen(PORT, "127.0.0.1", () =>
  console.log("[webhook] listening on 127.0.0.1:" + PORT)
);
