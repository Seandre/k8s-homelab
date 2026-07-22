#!/bin/sh
set -eu

root_dir=$(CDPATH= cd -- "$(dirname -- "$0")/../.." && pwd)
config="$root_dir/home-assistant/esphome/atom-living-room.yaml"
example="$root_dir/home-assistant/esphome/secrets.example.yaml"
policy="$root_dir/kubernetes/apps/home-assistant/networkpolicy.yaml"

grep -q '^  name: ${device_name}$' "$config"
grep -q '^  variant: esp32s3$' "$config"
grep -q '^    type: esp-idf$' "$config"
grep -q '^    key: !secret atom_api_encryption_key$' "$config"
grep -q '^    password: !secret atom_ota_password$' "$config"
grep -q '^bluetooth_proxy:$' "$config"
grep -q '^  level: WARN$' "$config"
grep -q '^    pin: GPIO35$' "$config"

for key in atom_wifi_ssid atom_wifi_password atom_api_encryption_key atom_ota_password; do
  grep -q "^${key}: REPLACE_" "$example"
  ! grep -q "^${key}:" "$config"
done

# The post-flash route is exactly the owner-confirmed Atom /32 and native API
# port. It must never become an IoT subnet-wide exception.
grep -q 'cidr: 192\.168\.30\.239/32' "$policy"
grep -q 'port: 6053' "$policy"
! grep -Eq 'cidr: 192\.168\.30\.0/24|cidr: 192\.168\.30\.0/23' "$policy"
! grep -Eq '192\.168\.30\.[0-9]+' "$config" "$example"

echo "IE-005 configuration contract: PASS"
