# Homelab

Kubernetes homelab built on Proxmox VE.

## Hardware

- Host: HP EliteDesk 800 G6 Mini
- CPU: Intel Core i5-10500T
- RAM: 64 GB
- Boot/system disk: 256 GB NVMe
- VM/data disk: 2 TB NVMe
- Hypervisor: Proxmox VE

## Goal

Build a reproducible Kubernetes homelab for platform engineering and GitOps workflows.

Target stack:

- Proxmox VE
- Ubuntu Server VMs
- k3s
- Argo CD
- ingress
- cert-manager
- monitoring
- local test apps

## Current Status

Last verified: 2026-06-30.

- Proxmox VE installed on the 256 GB NVMe in the HP EliteDesk mini PC
- 2 TB NVMe configured as Proxmox LVM-thin storage `vmdata`
- UniFi `Servers` network on VLAN ID `40` selected for homelab infrastructure
- Proxmox host reachable at `192.168.40.20`
- Kubernetes VMs cloned, resized, networked, and prepared
- Three-node k3s cluster is running k3s `v1.36.2+k3s1`; all nodes are `Ready`:
  - `k8s-control-01` at `192.168.40.21`
  - `k8s-worker-01` at `192.168.40.22`
  - `k8s-worker-02` at `192.168.40.23`
- Workstation kubeconfig lives at `~/.kube/k8s-homelab.yaml`
- Argo CD is installed in the `argocd` namespace and all Argo CD pods are running
- Argo CD reconciles this repo through the `homelab` root application
- `homelab`, `homelab-infrastructure`, `homelab-apps`, and `homelab-monitoring` are `Synced` and `Healthy`
- MetalLB and Traefik ingress are installed through Argo CD
- MetalLB assigns the reserved ingress VIP `192.168.40.30` to the Traefik `LoadBalancer` service
- cert-manager is installed through Argo CD
- Internal TLS certificates are issued by the `homelab-ca` ClusterIssuer
- Monitoring is installed through Argo CD with kube-prometheus-stack
- Argo CD is exposed at `https://argocd.lab.home.arpa`
- The nginx test app is exposed at `https://nginx-test.lab.home.arpa`
- Grafana is exposed at `https://grafana.lab.home.arpa`
- Homepage is exposed at `https://home.lab.home.arpa`
- UniFi UDM Pro Intrusion Prevention was identified as the cause of intermittent SSH/TCP timeouts and adjusted
- Next step: add a storage/persistence layer and start practicing operational workflows around backup, restore, upgrades, and GitOps changes

## Repo Map

- `docs/`: hardware, network, install, rebuild, decision, and troubleshooting notes
- `proxmox/`: Proxmox storage and VM layout notes
- `ansible/`: inventory and playbooks for node prep and k3s operations
- `kubernetes/bootstrap/`: one-time bootstrap manifests for Argo CD and other cluster bring-up steps
- `kubernetes/apps/`: reusable application definitions that can be selected by one or more clusters
- `kubernetes/infrastructure/`: reusable infrastructure definitions such as ingress and certificate management
- `kubernetes/clusters/homelab/`: the homelab cluster entrypoint and selection layer for Argo CD-managed apps and infrastructure
- `docs/learning-roadmap.md`: practical next steps for learning from the running homelab

## GitOps Flow

The repo keeps reusable definitions separate from cluster-specific selection:

1. The `homelab` root Argo CD application watches `kubernetes/clusters/homelab`.
2. The root application creates child applications, including `homelab-apps` and `homelab-infrastructure`.
3. `homelab-apps` watches `kubernetes/clusters/homelab/apps`, whose kustomization selects app definitions from `kubernetes/apps`.
4. `homelab-infrastructure` watches `kubernetes/clusters/homelab/infrastructure`, whose kustomization selects infrastructure definitions from `kubernetes/infrastructure`.

App manifests should stay in `kubernetes/apps` unless they are truly cluster-specific. Moving them under `kubernetes/clusters/homelab` would mix reusable app definitions with the homelab deployment selection layer.

## Current Direction

The cluster has a working GitOps control plane. The next phase should use that foundation to learn day-2 platform operations:

1. Keep GitHub as the source of truth while the lab is still easy to rebuild.
2. Add persistent storage, then prove backup and restore with a small stateful workload.
3. Replace temporary test workloads with real services that exercise ingress, TLS, storage, secrets, and monitoring.
4. Practice GitOps change management: PR, sync, rollback, drift detection, and failure recovery.
5. Add a utility/admin VM for stable in-network operations after the storage and backup path is understood.

Self-hosted Git is intentionally deferred. It can be revisited later, but GitHub is simpler and safer during bootstrap because the desired cluster state remains available even if the homelab is down.

## Common Commands

Check cluster nodes:

```bash
KUBECONFIG=~/.kube/k8s-homelab.yaml kubectl get nodes -o wide
```

Check Argo CD:

```bash
KUBECONFIG=~/.kube/k8s-homelab.yaml kubectl -n argocd get pods
KUBECONFIG=~/.kube/k8s-homelab.yaml kubectl get applications.argoproj.io -A
```

Access Argo CD locally:

```bash
KUBECONFIG=~/.kube/k8s-homelab.yaml kubectl -n argocd port-forward svc/argocd-server 8080:443
```

Access Argo CD through ingress:

```bash
open https://argocd.lab.home.arpa
```

Get the initial Argo CD admin password:

```bash
KUBECONFIG=~/.kube/k8s-homelab.yaml kubectl -n argocd get secret argocd-initial-admin-secret \
  -o jsonpath='{.data.password}' | base64 -d
```
