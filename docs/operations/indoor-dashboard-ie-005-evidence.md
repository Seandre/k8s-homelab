# IE-005 AtomS3 Lite Bluetooth Proxy Evidence

Date: 2026-07-21

Result: **PREPARED; OWNER GATE REQUIRED**. Secret-free configuration, immutable
build/flash steps, reservation contract, narrow path design, tests, and rollback
are complete. No secret was created, hardware flashed, or firewall changed.

## Changed files

- `home-assistant/esphome/atom-living-room.yaml`
- `home-assistant/esphome/secrets.example.yaml`
- `home-assistant/esphome/.gitignore`
- `home-assistant/esphome/test-config.sh`
- `docs/operations/atom-living-room-ble-proxy.md`
- `docs/operations/indoor-dashboard-ie-005-evidence.md`
- `docs/overview/indoor-dashboard-baseline.md`

## Prepared contract and verification

The ESP32-S3/ESP-IDF configuration has encrypted native API, protected OTA,
active BLE proxying, diagnostics, bounded logging, and GPIO35 status pixels.
ESPHome `2026.7.0` is pinned by container index digest. Real secrets are ignored.
The proposed route permits only nodes `192.168.40.21-23` to one confirmed IoT
`/32` on TCP 6053; tests prove it was not added before the gate.

```sh
home-assistant/esphome/test-config.sh
git diff --check
```

Live acceptance requires owner-supplied secrets, USB flash, placement, and the
confirmed reservation. Then add and test the paired Kubernetes/UniFi exceptions
exactly as documented. IE-006 remains blocked until discovery, reboot/OTA
recovery, and negative firewall tests pass.

Before live rules, rollback is a repository revert. After activation, remove the
Kubernetes `/32:6053` egress first and its UniFi allow second; retain broad denies.

