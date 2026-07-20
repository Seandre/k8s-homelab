# Homepage Implementation Baseline

Status: HP-001 discovery snapshot, captured 2026-07-19.

This document records the repository-visible HP-001 baseline captured before the
custom Homepage cutover. At that time the stock Homepage was production. The
custom app now serves production; the stock resources remain deployed as the
named rollback target. No live resources were modified while capturing this
baseline.

## Status legend

- **Verified:** stated directly in the current repository manifests or approved
  documentation.
- **Planned:** required by the approved architecture, but not yet deployed or
  implemented.
- **Unresolved:** an owner or later implementation task must supply or approve
  the value.

## Current deployment and rollback target

| Item | Verified baseline |
|---|---|
| Application | Stock `gethomepage/homepage` deployment |
| Image | `ghcr.io/gethomepage/homepage:v1.13.2` in `kubernetes/apps/homepage/deployment.yaml` |
| Namespace | `homepage`, resource `Namespace/homepage` |
| Deployment | `Deployment/homepage`, 1 replica, label `app.kubernetes.io/name=homepage` |
| Container port | HTTP/TCP `3000` |
| Service | `Service/homepage` in namespace `homepage`, port `3000` to target port `http` |
| Production hostname | `home.lab.seandre.dev` |
| Ingress | `Ingress/homepage`, Traefik `websecure`, production Let's Encrypt certificate, Secret `homepage-public-tls` |
| Config | `ConfigMap/homepage`, mounted as the stock Homepage configuration |
| Service account | `ServiceAccount/homepage` |
| RBAC | `ClusterRole/homepage` and `ClusterRoleBinding/homepage`; read-only `get/list` for core `nodes` and `metrics.k8s.io/nodes` |
| Health check | `/api/healthcheck` for both liveness and readiness |
| GitOps selection | `kubernetes/clusters/homelab/apps/kustomization.yaml` selects `../../../apps/homepage` |

### Exact rollback files

Keep these files intact as the named rollback target after the production
cutover and rollback gates:

- `kubernetes/apps/homepage/namespace.yaml`
- `kubernetes/apps/homepage/serviceaccount.yaml`
- `kubernetes/apps/homepage/rbac.yaml`
- `kubernetes/apps/homepage/configmap.yaml`
- `kubernetes/apps/homepage/deployment.yaml`
- `kubernetes/apps/homepage/service.yaml`
- `kubernetes/apps/homepage/ingress.yaml`
- `kubernetes/apps/homepage/kustomization.yaml`
- `kubernetes/clusters/homelab/apps/kustomization.yaml` (the current Homepage
  selection)

The rollback identity is the existing `homepage` namespace, Deployment, Service,
ConfigMap, RBAC, ServiceAccount, and production Ingress. The current production
Ingress identity and hostname remain stable, while the Git-managed backend now
targets `homepage-custom-production`; see the [production and rollback
runbook](../operations/homepage-rework.md).

## Existing service links

These are every link currently present in `services.yaml`, copied from
`kubernetes/apps/homepage/configmap.yaml` (lines 27–171). Widget URLs are
internal telemetry endpoints, not user-facing service links; they are listed
separately below.

| Group | Label | URL | Current description |
|---|---|---|---|
| Infrastructure | Argo CD | `https://argocd.lab.seandre.dev` | GitOps control plane |
| Infrastructure | Grafana | `https://grafana.lab.seandre.dev` | Cluster dashboards |
| Infrastructure | UniFi | `https://unifi.ui.com` | Network management |
| Host Status | pve-01 | `https://pve-01.lab.seandre.dev:8006` | Primary Proxmox host |
| Host Status | pve-02 | `https://pve-02.lab.seandre.dev:8006` | Standalone Proxmox host |
| Host Status | bastion-01 | `https://nexus.lab.seandre.dev` | OKD infrastructure VM on pve-02 |
| Host Hardware | CPU Temperature | `https://pve-01.lab.seandre.dev:8006` | pve-01 CPU package temperature |
| Host Hardware | System NVMe Temperature | `https://pve-01.lab.seandre.dev:8006` | 256 GB system NVMe temperature |
| Host Hardware | VM Data NVMe Temperature | `https://pve-01.lab.seandre.dev:8006` | 2 TB VM storage NVMe temperature |
| Host Hardware | Host OS Storage | `https://pve-01.lab.seandre.dev:8006` | Proxmox root filesystem usage |
| Host Hardware | VM Data Disk I/O | `https://pve-01.lab.seandre.dev:8006` | 2 TB `vmdata` NVMe throughput |
| Host Hardware | Proxmox Network | `https://pve-01.lab.seandre.dev:8006` | `vmbr0` bridge traffic |
| Apps | Homelab Docs | `https://docs.lab.seandre.dev` | Infrastructure documentation and runbooks |
| Apps | nginx test | `https://nginx-test.lab.seandre.dev` | Ingress test app |

## Existing bookmarks

| Group | Label | URL | Abbreviation |
|---|---|---|---|
| Homelab | Repository | `https://github.com/seandre/k8s-homelab` | `GH` |
| Homelab | Homepage Docs | `https://gethomepage.dev/` | `HP` |

The existing `Homepage Docs` bookmark is preserved in this rollback snapshot.
For the custom homepage, the approved replacement is a `Homepage GitHub` link
to `https://github.com/gethomepage/homepage`; changing the production ConfigMap
belongs to a later cutover/configuration task.

## Existing telemetry and utility configuration

| Source or utility | Verified current configuration |
|---|---|
| Glances | Server-side Homepage widgets call `http://192.168.40.20:61208/api/4/all`, `192.168.40.25:61208/api/4/all`, and `192.168.40.33:61208/api/4/all` every 5 seconds; host hardware widgets use the same hosts on port `61208`. |
| Glances fields | CPU, memory, swap, uptime; pve-01 package/system NVMe/VM data temperatures, root filesystem, `nvme1n1` disk I/O, and `vmbr0` network. |
| Kubernetes | Stock config uses cluster mode and requests node and metrics-server data through the Homepage ServiceAccount. |
| Search | DuckDuckGo, opening results in a new tab. |
| Weather | Open-Meteo widget, imperial units, five-minute cache, label `Local Weather`. |
| Date/time | Short date/time, 12-hour format. |
| Pod resources | CPU, memory, root disk, and uptime for the Homepage pod. |

## Planned values and unresolved questions

| Topic | Status and handoff question |
|---|---|
| Custom application | **Implemented:** one stateless TypeScript/React/Vite/Fastify container, introduced under a preview hostname before production cutover. |
| Preview hostname | **Approved:** `homepage-preview.lab.seandre.dev`. |
| Application port | **Approved:** one HTTP process/port on `3000`, matching the current Service and proposed custom container port. |
| Production port and ownership | **Verified:** Service port `3000`; the production Ingress keeps its identity and now targets `homepage-custom-production:3000`. The stock `homepage` Service remains the rollback target. |
| Monitoring components | **Verified:** `kube-prometheus-stack` chart `87.3.0` enables Prometheus, Alertmanager, and Grafana; Prometheus retention is `7d`. **Unresolved:** exact service DNS names and approved query/field allowlists belong in HP-002. |
| Preview DNS/TLS | **Approved plan:** create a private split-DNS record for `homepage-preview.lab.seandre.dev` pointing to the existing ingress VIP `192.168.40.30`; use the existing `letsencrypt-production` ClusterIssuer and ACME DNS-01 flow. This is a plan only; no DNS, certificate, or cluster resource was changed. |
| Current live state | **Superseded by later evidence:** see the [Homepage v1 evidence index](homepage-v1-evidence.md) and [preview/production runbook](../operations/homepage-rework.md). |

## Baseline sources

- `kubernetes/apps/homepage/` — current deployment and rollback manifests.
- `kubernetes/clusters/homelab/apps/kustomization.yaml` — GitOps selection.
- `kubernetes/clusters/homelab/monitoring.yaml` — monitoring components and retention.
- `docs/overview/homepage-architecture.md` — approved target architecture.
- `docs/overview/infrastructure-reference.md` — verified host, network, and DNS facts.
- `docs/overview/architecture-decisions.md` — approved decisions and current direction.
- `README.md` — repository status and exposed services.
