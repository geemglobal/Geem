---
name: VPS deploy safety
description: Safe deployment behavior when the production checkout has local changes
---

When the VPS checkout has local or generated changes, preserve them with a labeled `git stash -u` before pulling the release; do not force-reset the production working tree.

**Why:** The deployment script uses `git pull`, which refuses to overwrite local files. A stash keeps those changes recoverable while allowing the released commit to build and restart.

**How to apply:** Check the VPS commit and service health after the deploy, and leave the preserved stash available for later review rather than deleting it automatically.