# IE-007 Nest Evidence

Date: 2026-07-21

Result: **FIXTURE ONLY; OWNER GATE PENDING**. IE-004 is live. A redacted live
registry count found zero configured official Nest entries. No Google account,
project, OAuth, device, Home Assistant entity, or credential identifier was
printed or recorded.

## Repository preparation

- `home-assistant/nest/contract.json` fixes the six canonical aliases, official
  integration/API dependency, normalized states, and fail-closed empty live
  capabilities.
- `home-assistant/nest/test-contract.sh` checks the contract against IE-001 and
  rejects common credential, vendor-ID, and raw-entity-ID assignments.
- `docs/operations/nest-living-room.md` defines the owner gate, current official
  setup path, capability discovery, safe control tests, cloud-loss behavior, and
  scoped rollback.

## Evidence available before authorization

The official integration contract supports thermostat climate state,
temperature, humidity, and an optional fan timer. Actual HVAC modes, setpoint
shape/range/step, and fan timer support are device-advertised and therefore stay
empty/unsupported in Git until live verification. No fixture claims a capability
that has not been observed.

Live Home Assistant inspection emitted only these redacted facts:

```text
nest_config_entries=0
nest_state=not_configured
```

## Required completion evidence

- Owner completion of Device Access registration, Google OAuth, Pub/Sub, and
  official HA account linking.
- Advancing temperature/humidity observations and source freshness timing.
- Advertised HVAC modes, setpoint shape/range/step, and fan timer durations.
- Read/control/restore results for every advertised capability.
- Cloud-loss transition to unavailable/null current values, independent-source
  continuity, and fresh recovery without fabricated state.

Rollback removes only the official Nest HA entry and authorization/private
credentials. It must not modify Aranet, ESPHome, Coway, or their network paths.
