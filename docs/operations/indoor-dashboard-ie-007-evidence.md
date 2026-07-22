# IE-007 Nest Evidence

Date: 2026-07-21

Result: **LIVE; STALE-STATE GUARD PENDING**. IE-004 is live. The owner
completed Google Device Access/OAuth/Pub/Sub linking, and the official Nest
integration is configured as `Living Room Nest` in `Living Room`. No Google
account, project, OAuth, device, Home Assistant entity, or credential identifier
was printed or recorded.

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

The thermostat reported plausible temperature and humidity. Its registry
advertised `heat`, `cool`, `heat_cool`, and `off`; 50–90°F limits; single and
range setpoints; fan on/off; and Eco preset. The dashboard contract intentionally
omits Eco because it is not an approved IE-001 command.

Owner-reviewed Developer Tools tests proved every approved mode, HEAT/COOL/RANGE
setpoint shapes with 1°F changes, and fan start/cancel. Fan on produced a
12-hour timeout, so the only allowlisted durations are `720` (start) and `0`
(cancel). A combined mode-and-temperature call changed mode but left the prior
setpoint unchanged; future gateway logic must converge mode first and submit a
separate setpoint call. Every test was confirmed from a subsequent cloud state,
and the thermostat was restored to `heat_cool`, 66–69°F, fan off.

Initial live Home Assistant inspection emitted only these redacted facts:

```text
nest_config_entries=0
nest_state=not_configured
```

## Remaining completion evidence

During a verified HA Internet outage, Nest stopped updating for more than 23
minutes while local Aranet continued. Raw HA retained cached climate and sensor
values instead of becoming unavailable. After access returned, a safe 1°F range
probe did not converge until the Nest config entry was reloaded; it then
surfaced, and the thermostat was immediately restored to `heat_cool`, 66–69°F,
fan off. The downstream freshness guard must reject all commands while stale and
emit unavailable/null current values. IE-007 remains open until that guard is
implemented and tested; delayed convergence must be covered by IE-012.

Rollback removes only the official Nest HA entry and authorization/private
credentials. It must not modify Aranet, ESPHome, Coway, or their network paths.
