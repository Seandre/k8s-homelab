# Homepage Next-Agent Handoff

Last updated: 2026-07-20T21:47:10Z

## Current state

- Repository `main` is clean and published at `51fae76` (`origin/main` matches).
- The custom Homepage is an isolated preview at
  `https://homepage-preview.lab.seandre.dev`.
- Stock Homepage remains production at `home.lab.seandre.dev` and is the
  rollback target. Production traffic has not been changed.
- Gate D preview technical closeout passed with the owner-approved shortened
  soak at `2026-07-20T21:37:34Z`.
- Preview artifact: `ghcr.io/seandre/k8s-homelab-homepage:unpoller-pdu-20260720-3`
  pinned to digest
  `sha256:d75558ed538c832d9f51259d022511619e44aac1af5d7c6c059d85ef97297dc5`.
- Argo CD `homelab` was `Synced` / `Healthy` at `c3d8968` during closeout.
- Homepage preview was 2/2 Ready with zero restarts; UnPoller was 1/1 Ready
  with zero restarts.
- Prometheus retained only the UnPoller outlet-power family plus scrape
  health. The target, exact `pve-01`/`pve-02` series, and one-hour history were
  healthy; no related firing alert was present.
- Bootstrap schema v2 returned `CURRENT` PDU data with non-null total and both
  PVE watt values. PDU-specific names, outlet labels, endpoints, credentials,
  and raw metrics were not exposed.
- Documentation image workflow deployed
  `ghcr.io/seandre/k8s-homelab-docs:sha-84c614e` through the Git-managed docs
  Deployment. `npm run build` and `git diff --check` passed.

## Next task: HP-029 production cutover

HP-029 is the next implementation task in
`docs/build/homepage-rework.md`. It requires explicit owner approval for a
production change window. The previous user instruction approved only the
shortened preview soak; it did not approve production cutover.

If the owner has not explicitly approved HP-029, stop and request that approval.
Do not change the production Service, Ingress, selectors, stock Deployment, or
stock ConfigMap while waiting.

If approval is provided, follow the exact procedure in
`docs/operations/homepage-rework.md` and verify:

1. The stock Homepage Deployment, ConfigMap, Service, TLS Secret, and
   `home.lab.seandre.dev` Ingress are preserved as a named rollback target.
2. Git-managed Service/Ingress ownership routes production to the custom app
   without overlapping selectors.
3. Argo CD reports the relevant applications `Synced` / `Healthy`.
4. Production `/`, health endpoints, bootstrap, SSE, routes, links, TLS, and
   responsive/browser smoke checks pass.
5. Restart counts, error behavior, resource use, and adapter states remain
   acceptable through the approved observation window.

Never weaken strict TLS, broaden Prometheus retention, expose raw exporter
metrics, add outlet-control access, or commit any Secret/API key content.

## Subsequent tasks

- HP-030: execute and document the Git-only rollback drill, then restore the
  custom app and verify forward recovery.
- HP-031: close v1 documentation and mark only acceptance criteria with actual
  evidence. Keep OKD deployment/ownership and automatic failover deferred.

## Useful references

- [Homepage build plan](docs/build/homepage-rework.md)
- [Preview and rollback runbook](docs/operations/homepage-rework.md)
- [Observability/PDU runbook](docs/operations/homepage-observability.md)
- [Gate C and PDU evidence](docs/overview/homepage-gate-c-evidence.md)
- Historical closeout details: [HANDOFF.md](HANDOFF.md)

## Safety boundary

Rollback is Git-only. Preserve the stock Homepage until production cutover is
explicitly approved and keep it available until HP-030 completes. Do not use
insecure TLS as a fallback, do not run destructive cleanup, and do not dump
full exporter responses because they contain unrelated raw telemetry.
