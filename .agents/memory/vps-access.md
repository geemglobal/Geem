---
name: VPS and DB access
description: How to SSH to the VPS and run DB queries
---

## SSH
- Host: root@164.68.120.130
- Password stored in secret: VPS_SSH_PRIVATE_KEY (it's a password, not a key)
- Use: `sshpass -p "${VPS_SSH_PRIVATE_KEY}" ssh -o StrictHostKeyChecking=no root@164.68.120.130`

## Database
- DB name: geemdb
- User: postgres (no direct root access)
- Run queries: `su -s /bin/bash postgres -c "psql -d geemdb -c '...'"`
- Note: always filter out "could not change directory" and "Permission denied" lines (they're noise from the su context)

## Repo on VPS
- Path: /var/www/geempk/Inventory-Commerce-Hub
- GitHub token in secret: GITHUB_CLASSIC_TOKEN

## Local clone
- Clone to /tmp/geem-repo for editing; it may be cleaned up between sessions — re-clone if missing.
