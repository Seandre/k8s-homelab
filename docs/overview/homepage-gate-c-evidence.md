# Homepage Gate C Evidence

This record contains sanitized live-read verification results. Each request used
an approved endpoint, returned only an HTTP status code, and used no mutation
method. Disposable Kubernetes verification Pods were deleted after each check.

| Source | Result | Notes |
|---|---:|---|
| Argo CD applications | 200 | Read-only token accepted. |
| Proxmox `pve-01` | 200 | Replacement `PVEAuditor` token accepted; superseded token revoked. |
| Proxmox `pve-02` | 200 | Publicly trusted TLS certificate; no custom CA is required. |
| Proxmox Backup Server | 200 | Read-only token and supplied CA accepted. |
| UniFi Site Manager | 200 | Replacement read-only Site Manager API key accepted. |
| Optional USP-PDU-PRO inventory | 200 | One PDU candidate exists; no power-related field is returned. |
| Optional USP-PDU-PRO statistics | 400 | The documented per-device route is not addressable through the Site Manager schema. |
| Open-Meteo forecast | 200 | Public Portland forecast endpoint reachable. |
| Glances `pve-01` | 200 | Temporary bridge endpoint reachable. |
| Glances `pve-02` | 200 | Temporary bridge endpoint reachable. |
| Glances `pbs-01` | 200 | Temporary bridge endpoint reachable. |
| Custom k3s reader | 200 / 403 | Nodes and deployments are readable; Secrets are forbidden. |

The two USP-PDU-PRO Site Manager rows above are historical evidence from the
original v1 investigation. They showed that the Site Manager device schema was
not a usable power source; they do not describe the later local-controller
exporter path.

## PDU local-exporter evidence — 2026-07-20

The replacement read-only path passed Gate C review at Git revision `c3d8968`:

| Check | Result | Notes |
|---|---:|---|
| Local UnPoller controller connection | PASS | `https://unifi.local`, Site Manager-generated API key, pinned controller certificate, and strict TLS verification; no insecure fallback |
| Prometheus target and retention | PASS | Target `UP`; only `unpoller_device_outlet_outlet_power` plus scrape health retained |
| PDU cardinality | PASS | Exactly one PDU device discovered |
| PVE outlet mapping | PASS | Exactly one series each for exact labels `pve-01` and `pve-02` |
| Public contract | PASS | Bootstrap schema v2 exposes total and per-PVE watts without credentials, controller/device identifiers, PDU/outlet labels, or raw metrics |
| Optional-source isolation | PASS | PDU failure is `INFO`/`NO DATA` only and cannot degrade PVE, Kubernetes, or global health |

OKD-labeled outlets contribute to the PDU total only; they are not mapped to
host fields. The deployed preview image is
`sha256:d75558ed538c832d9f51259d022511619e44aac1af5d7c6c059d85ef97297dc5`.
This evidence closes the PDU integration/security review. The owner-approved
shortened Gate D technical soak also passed at `2026-07-20T21:37:34Z`; the
preview remained healthy and production traffic was unchanged.

## Deferred and outstanding items

- Prometheus and Alertmanager are provisioned for the isolated preview as of
  2026-07-20. The stock production Homepage remains unchanged; production
  cutover and any production alerting decision are separate approvals.
- The direct Site Manager PDU route remains unsupported. It was superseded by
  the reviewed local UnPoller path above; no speculative Site Manager adapter
  was added.
- `homepage-custom-k3s-reader` is applied through the Homepage kustomization.
  Its ClusterRole permits only `get`, `list`, and `watch` on nodes, deployments,
  statefulsets, and daemonsets. Secrets and pod mutation are denied.

## Gate status

The credentialed adapters, public/temporary read-only sources, optional PDU
decision, and custom k3s identity have completed their checks. Gate C requires
only owner approval of this matrix before the Phase 5 prerequisite is satisfied.

Owner approval was recorded on 2026-07-20.
