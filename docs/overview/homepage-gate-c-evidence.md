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

## Deferred and outstanding items

- Prometheus and Alertmanager are not provisioned, per owner direction. Their
  fixture-backed disabled states remain intentional.
- The optional USP-PDU-PRO is `NOT SUPPORTED` for v1. Its Site Manager inventory
  has no power field, and the documented per-device statistics route cannot be
  addressed through the available Site Manager response. No PDU credential or
  speculative adapter is added.
- `homepage-custom-k3s-reader` is applied through the Homepage kustomization.
  Its ClusterRole permits only `get`, `list`, and `watch` on nodes, deployments,
  statefulsets, and daemonsets. Secrets and pod mutation are denied.

## Gate status

The credentialed adapters, public/temporary read-only sources, optional PDU
decision, and custom k3s identity have completed their checks. Gate C requires
only owner approval of this matrix before the Phase 5 prerequisite is satisfied.

Owner approval was recorded on 2026-07-20.
