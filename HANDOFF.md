# UniFi PDU Power Telemetry Handoff

Last updated: 2026-07-20T21:37:34Z

## Objective

Finish the documentation/status closeout for the deployed UniFi PDU Pro power
telemetry integration. Do not change production Homepage traffic. The custom
Homepage remains an isolated preview and stock Homepage remains production and
the rollback target.

## Implemented and deployed

- Git revision: `c3d8968` (`Enable validated PDU power mapping`).
- Argo CD application `homelab`: `Synced` / `Healthy` at `c3d8968` at the most
  recent check.
- Homepage preview: 2/2 Ready, zero restarts at the most recent check.
- Current Homepage image:
  `ghcr.io/seandre/k8s-homelab-homepage:unpoller-pdu-20260720-3@sha256:d75558ed538c832d9f51259d022511619e44aac1af5d7c6c059d85ef97297dc5`.
- UnPoller: 1/1 Ready, zero restarts at the most recent check.
- UnPoller image:
  `ghcr.io/unpoller/unpoller:v3.3.1@sha256:9dcccdc931a6830735f6978caf8cd67699b0dc33e37cf9ef4638611791c4df62`.
- Strict TLS is enabled for `https://unifi.local`; the pinned certificate is
  used and there is no insecure fallback.
- Authentication uses the manually managed
  `monitoring/unpoller-unifi-readonly` Secret with API-key configuration. No
  credentials are committed.
- Prometheus retains only `unpoller_device_outlet_outlet_power` plus scrape
  health from UnPoller.
- Exactly one PDU (`USP-PDU-Pro`) and exactly one series for each required
  `pve-01` and `pve-02` outlet label passed preflight.
- Homepage bootstrap schema v2 exposes only total watts, normalized PVE 01/02
  watts, freshness, and source state. It does not expose the PDU name, outlet
  labels, controller identifiers, credentials, or raw metrics.
- Additional OKD-labeled outlets contribute to total PDU draw only. They are
  not mapped to PVE host fields and are not exposed publicly.

## Current working tree

The closeout changes are committed and pushed in `84c614e`:

- `docs/build/homepage-rework.md`
- `docs/index.md`
- `docs/operations/homepage-observability.md`
- `docs/operations/homepage-rework.md`
- `docs/overview/documentation-order.md`
- `docs/overview/homepage-architecture.md`
- `docs/overview/homepage-data-sources.md`
- `docs/overview/homepage-gate-c-evidence.md`

Those nine files update stale planned/staged language, record the enabled PDU
mapping, preserve dated historical evidence, and record the owner-approved
shortened Gate D technical closeout. They passed the VitePress build and
`git diff --check`; the repository was clean after publication.

## Soak status — technical closeout passed

- Later Homepage mapping pod start: `2026-07-20T21:08:23Z`.
- Earliest honest one-hour close: `2026-07-20T22:08:23Z`.
- The owner accepted a shortened soak. Closeout at `2026-07-20T21:37:34Z`
  passed: Argo healthy/synced at `c3d8968`, Homepage 2/2 with zero restarts,
  UnPoller 1/1 with zero restarts, `up` history healthy, one retained UnPoller
  metric family, both PVE series continuously present, no related firing
  alerts, and public bootstrap schema v2 `CURRENT` with non-null total and
  both PVE watt values. The PDU-specific redaction scan was clean; the only
  generic controller match was the existing `network.unifi.controller` status
  value `UniFi Site Manager`, not a PDU identifier or credential.

Gate D preview technical closeout is recorded. Production cutover remains
separate and is not authorized by this technical result.

## Required closeout checks

Use read-only checks and do not dump the full exporter metric response because
it contains unrelated raw device/client telemetry.

1. Confirm Argo CD `homelab` is `Synced` and `Healthy` at current `main`.
2. Confirm Homepage preview is 2/2 Ready, has zero restarts, and uses the pinned
   digest above.
3. Confirm UnPoller is 1/1 Ready with zero restarts.
4. Confirm Prometheus:
   - `min_over_time(up{service="unpoller"}[1h]) == 1`;
   - only one `unpoller_*` metric family is retained;
   - the exact `pve-01` and `pve-02` outlet series were continuously present;
   - no PDU/UnPoller-related alert is firing.
5. Query `https://homepage-preview.lab.seandre.dev/api/v1/bootstrap` and confirm:
   - `data.schemaVersion == 2`;
   - `data.network.pduPower.metadata.freshness == "CURRENT"`;
   - total watts and both PVE `powerWatts` values are non-null;
   - no raw outlet names, PDU/controller identifiers, API keys, tokens, or
     credential-shaped fields appear.

## Documentation closeout

The shortened soak passed:

1. The pending/in-progress soak language in the eight edited docs was replaced
   with timestamped PASS evidence.
2. The exact shortened close checks were recorded, and stock Homepage remains
   production/rollback unless the user separately approves cutover.
3. Gate D was updated according to the owner-approved shortened-soak
   convention; the successful technical closeout does not authorize production
   cutover.
4. The remaining stale statement in
   `docs/overview/homepage-gate-c-evidence.md`: the deferred section still says
   Prometheus and Alertmanager are not provisioned. It was superseded with the
   current provisioned preview state while preserving production separation.

If any soak check fails, leave Gate D unchecked, document the exact failed
condition, and do not weaken TLS, retention, mapping, redaction, or network
policy controls.

## Final validation and publication — complete

Run:

```sh
git diff --check
cd docs-site/vitepress
npm run build
```

The complete diff was reviewed, `origin/main` was unchanged before publication,
and commit `84c614e` was pushed to `main`. The documentation workflow owns the
image pin/update and Argo CD will reconcile that deployment. The repository is
clean. No secrets, local API-key files, port-forward output, or raw exporter
data were committed.

## Rollback boundary

Rollback is Git-only. Disable `pduPower.enabled` or revert the PDU/Homepage
mapping commits and reconcile with Argo CD. Never use insecure TLS as a
fallback, never broaden Prometheus retention, and never add outlet-control API
access.
