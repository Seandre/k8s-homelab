# IE-006 Aranet4 Evidence

Date: 2026-07-21

Result: **COMPLETE**. IE-005 is complete. The owner
confirmed firmware `2.0.15` and enabled Smart Home Integration. Home Assistant
has the official Aranet integration configured for the Living Room device and
all five required readings are present.

## Repository contract

- `home-assistant/aranet/contract.json` fixes the five normalized aliases,
  normalized units, local dependency, source/value states, and null unavailable
  behavior without a raw entity or hardware identifier.
- `home-assistant/aranet/test-contract.sh` checks that contract against the IE-001
  baseline and rejects common identifier assignments.
- `docs/operations/aranet4-living-room.md` defines the owner gate, official HA
  onboarding, local-operation test, Atom-loss truthfulness test, and rollback.

## Commands and live observations

```sh
home-assistant/aranet/test-contract.sh
home-assistant/esphome/test-config.sh
home-assistant/k3s/test-manifests.sh
git diff --check
```

The live integration and entity registries were reduced to domain counts and
generic sensor names before output. Temperature, humidity, pressure, CO2, and
battery returned plausible values with the expected source units. CO2 and
pressure produced multiple advancing steady-state recorder timestamps; sensors
whose value did not change did not create a new recorder row.

With only the Atom powered off, its address stopped responding and TCP 6053
closed. Aranet reports stopped; after more than two minutes HA still retained
the last numeric state. The normalized contract therefore classifies readings
past its freshness bound as `STALE` and emits `null` for the current value rather
than treating HA's cached number as current. After Atom power was restored, its
address and TCP 6053 returned without an HA restart and CO2 produced a new local
report.

For the accepted Internet-loss test, the Argo application controller was scaled
from one replica to zero, public HTTPS was removed from the HA NetworkPolicy,
and the live policy was verified to retain only DNS and Atom TCP 6053. Public
IPv4 was blocked while the Atom API remained reachable. Aranet CO2 continued to
advance locally throughout the sustained outage. The exact policy and one Argo
replica were restored; Argo finished Synced/Healthy with self-heal enabled.

Authenticated HA state confirmed continuing Aranet observations during Internet
loss. Atom power loss separately stopped updates and produced stale state; power
restoration resumed fresh reports without an HA restart. The normalized adapter
must use report freshness rather than value-change timestamps for unchanged
sensors.

Rollback removes only the Aranet HA entry/private mapping and this IE-006
repository change. The working ESPHome proxy and narrow network rules remain.
