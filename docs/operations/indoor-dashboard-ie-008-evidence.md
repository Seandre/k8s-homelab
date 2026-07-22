# IE-008 Coway live-onboarding evidence

Date: 2026-07-21

Result: **LIVE; STALE-STATE GUARD PENDING**. IE-002 verified the pinned
integration and synthetic Airmega 250S entity behavior. The owner completed
IoCare onboarding, and both physical units passed independently. No
IoCare credential, account data, vendor/device identifier, or raw Home Assistant
entity ID was requested or recorded.

## Repository preparation

- `home-assistant/coway/contract.json` fixes the two canonical devices and all
  public aliases while keeping every live capability empty and unobserved.
- `home-assistant/coway/fixtures/capabilities.pending.json` is the fail-closed
  redacted fixture used until both physical units pass independently.
- `home-assistant/coway/test-contract.sh` checks aliases, candidate value safety,
  fail-closed state, documentation, and common secret/identifier leakage.
- `docs/operations/coway-live-onboarding.md` defines the credential gate,
  independent control matrix, restoration, outage behavior, and rollback.

## Live observations

The account produced one official `coway` config entry and two correctly named,
room-assigned devices. Both units reported plausible AQI, PM2.5, PM10, pre-filter,
and MAX2-filter values. Public `filter_life` uses the conservative minimum of
the two filter percentages.

Using a temporary owner-created HA token, each unit independently passed power
off/on, speeds 1–3, Auto/Night/Rapid, timers off/1/2/4/8 hours, light
on/off/AQI-off, sensitive/normal/insensitive, and lock on/off. Each API call was
followed by HA state convergence before the next call. Living Room remained
untouched during Bedroom tests and vice versa. Both were restored to power on,
speed 2, timer off, AQI light off, normal sensitivity, and unlocked. Auto Eco
remains report-only and is absent from the control allowlist.

## Remaining completion evidence

During a verified HA Internet outage, Coway logged a real cloud connection
failure and both devices stopped updating for more than 25 minutes while Aranet
continued locally. Raw HA retained cached numeric states instead of becoming
unavailable. After access returned, both PM2.5 readings refreshed successfully
and every control remained at its restore baseline. The downstream freshness
guard must emit unavailable/null current values and reject controls while stale
before IE-008 closes.

Rollback removes only the Coway IoCare Home Assistant entry and its private
credentials. Repository rollback removes this package's files and does not
change either purifier or the image-baked integration.
