---
name: Nginx geem.pk config
description: Key facts about the geem.pk nginx configuration — file location, add_header inheritance trap, and security header placement.
---

## Critical facts

**File**: `/etc/nginx/sites-enabled/geem.pk.conf` — this is a **direct file, not a symlink** to `sites-available`. Editing only `sites-available/geem.pk.conf` has no effect on the live site; you must edit `sites-enabled/geem.pk.conf` directly.

**Why:** At some point Certbot or manual setup created two separate files rather than the standard symlink pattern. Always verify with `ls -la /etc/nginx/sites-enabled/`.

## nginx `add_header` inheritance trap

nginx only inherits `add_header` directives from a parent level if the child location has **zero** `add_header` directives of its own. The `location /` and `location ~* \.html$` blocks in geem.pk.conf already have `add_header Cache-Control` — so any server-level `add_header X-Frame-Options` etc. is silently ignored for those locations.

**How to apply:** Security headers must be declared **inside each location block that needs them**, not just at the server level:

```nginx
location / {
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
    add_header Permissions-Policy "camera=(), microphone=(), geolocation=(self)" always;
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;
    add_header Cache-Control "no-cache, max-age=0, must-revalidate" always;
    add_header Pragma "no-cache" always;
    try_files $uri /index.html;
}
```

Same pattern needed in `location ~* \.html$`.

## Verification

After any nginx change, always verify headers actually appear:
```bash
curl -sI --resolve geem.pk:443:127.0.0.1 https://geem.pk/ | grep -iE 'x-frame|x-content|referrer|permissions|strict-transport'
```

`curl http://localhost/` returns 404 — expected, the HTTP block just redirects and the HTTPS block is on port 443 with domain SNI. Test via `--resolve` or from an external host.
