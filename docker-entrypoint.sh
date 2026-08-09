#!/bin/sh
set -eu

# Docker creates named volumes as root. Initialize only the local, rebuildable
# soft-state volume, then run the bridge without root privileges.
mkdir -p /data
chown -R bun:bun /data

exec su bun -s /bin/sh -c 'exec bun run src/index.ts'
