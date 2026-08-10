#!/bin/sh
set -eu

# Docker creates named volumes as root. Initialize only the local, rebuildable
# soft-state volume, then run the bridge without root privileges.
mkdir -p /data
chown -R node:node /data

exec su node -s /bin/sh -c 'exec node /app/dist/index.js'
