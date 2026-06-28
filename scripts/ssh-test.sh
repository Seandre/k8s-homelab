#!/usr/bin/env bash
set -euo pipefail

user="${1:-sean}"
key="${2:-$HOME/.ssh/id_ed25519_github}"

hosts=(
  "192.168.40.21"
  "192.168.40.22"
  "192.168.40.23"
  "192.168.40.24"
)

for host in "${hosts[@]}"; do
  echo "Testing SSH to ${user}@${host}..."
  ssh -i "${key}" -o BatchMode=yes -o ConnectTimeout=5 "${user}@${host}" "hostname" || true
done
