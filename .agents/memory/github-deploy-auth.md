---
name: GitHub deployment auth
description: Authentication and deployment behavior for pushing Geem changes
---

Pushes to the Geem GitHub repository are authenticated with the workspace secret named `GITHUB_CLASSIC_KEY`; do not put the token in chat, files, or git remotes.

**Why:** The repository accepts the commit only through token-based HTTPS authentication, and the documented VPS deployment is triggered by a push to `main`.

**How to apply:** Use the secure secret flow when a push is rejected for missing credentials, then push `main` and verify the live health endpoint.